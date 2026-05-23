from __future__ import annotations

import queue
import json
import tempfile
import threading
import traceback
import uuid
from pathlib import Path

from nocap.library import LibraryStore
from nocap.pipeline import AnalysisOptions, ProgressEvent, analyze_track

from .sse import safe_suffix, sse
from .state import SessionState


def register_analysis_routes(app, store: LibraryStore, state: SessionState) -> None:
    from flask import Response, abort, request, stream_with_context

    @app.route("/api/flowmap.json")
    def flowmap_api():
        if state.flowmap is None:
            abort(404)
        return app.response_class(response=json.dumps(state.flowmap, ensure_ascii=False), mimetype="application/json")

    @app.route("/api/analyze", methods=["POST"])
    def analyze_api():
        if "audio" not in request.files:
            return {"error": "no audio file"}, 400
        uploaded = request.files["audio"]
        suffix = safe_suffix(uploaded.filename)
        tmp = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)
        tmp.close()
        uploaded.save(tmp.name)
        tmp_path = Path(tmp.name)
        model = _safe_model(request.form.get("model"))
        title = Path(uploaded.filename).stem
        track_id = uuid.uuid4().hex

        @stream_with_context
        def generate():
            events: queue.Queue[ProgressEvent | tuple[str, object]] = queue.Queue()

            def run() -> None:
                try:
                    result = analyze_track(tmp_path, AnalysisOptions(title=title, whisper_model=model, separate=True), events.put)
                    events.put(("complete", result))
                except Exception as exc:
                    events.put(("error", exc))

            threading.Thread(target=run, daemon=True).start()
            while True:
                item = events.get()
                if isinstance(item, ProgressEvent):
                    yield sse("progress", step=item.step, msg=item.message, done=item.done)
                    continue
                kind, payload = item
                if kind == "complete":
                    yield _complete(payload, store, state, track_id, title, suffix, tmp_path)
                    return
                yield _fail(payload, store, track_id, tmp_path)
                return

        return Response(generate(), mimetype="text/event-stream", headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        })


def _safe_model(model: str | None) -> str:
    return model if model in {"tiny", "base", "small", "medium", "large"} else "small"


def _complete(result, store: LibraryStore, state: SessionState, track_id: str, title: str, suffix: str, tmp_path: Path) -> str:
    final_audio = store.track_dir(track_id) / f"audio{suffix}"
    result.flowmap["metadata"]["audio_path"] = str(final_audio)
    metadata, audio_path, vocals_path = store.save_track(
        track_id=track_id,
        title=title,
        flowmap=result.flowmap,
        tmp_audio=tmp_path,
        audio_suffix=suffix,
        vocals_audio=result.vocals_audio,
    )
    state.flowmap = result.flowmap
    state.set_files(audio_path, vocals_path)
    return sse("complete", flowmap=result.flowmap, track=metadata, has_vocals=vocals_path is not None)


def _fail(exc: object, store: LibraryStore, track_id: str, tmp_path: Path) -> str:
    import shutil
    tmp_path.unlink(missing_ok=True)
    shutil.rmtree(store.track_dir(track_id), ignore_errors=True)
    return sse("error", msg=str(exc), trace="".join(traceback.format_exception(exc)))
