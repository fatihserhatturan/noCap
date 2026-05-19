from __future__ import annotations

import json
import tempfile
import atexit
from pathlib import Path

_FRONTEND_DIST_DIR = Path(__file__).resolve().parents[2] / "frontend" / "dist"

# current session state (set after a successful analysis)
_current_flowmap: dict | None = None
_current_audio: Path | None   = None
_current_vocals: Path | None  = None
_owned_temp_files: set[Path]   = set()


def _cleanup_owned_temp(path: Path | None) -> None:
    if path is None or path not in _owned_temp_files:
        return
    try:
        path.unlink(missing_ok=True)
    finally:
        _owned_temp_files.discard(path)


def _cleanup_all_owned_temp() -> None:
    for path in list(_owned_temp_files):
        _cleanup_owned_temp(path)


def _set_current_files(audio: Path | None, vocals: Path | None, owned: set[Path] | None = None) -> None:
    global _current_audio, _current_vocals
    old_audio, old_vocals = _current_audio, _current_vocals
    _current_audio = audio
    _current_vocals = vocals
    if owned:
        _owned_temp_files.update(owned)
    _cleanup_owned_temp(old_audio)
    _cleanup_owned_temp(old_vocals)


atexit.register(_cleanup_all_owned_temp)


def start(
    flowmap_path: Path | None = None,
    audio_path: str | None = None,
    port: int = 5757,
) -> None:
    """Start the noCap web server.

    Can be launched:
      - standalone (no args): user uploads a file from the browser
      - with a pre-analysed flowmap: opens the viewer directly
    """
    global _current_flowmap, _current_audio, _current_vocals

    if flowmap_path and flowmap_path.exists():
        _current_flowmap = json.loads(flowmap_path.read_text(encoding="utf-8"))

    resolved_audio = audio_path
    if resolved_audio is None and _current_flowmap:
        resolved_audio = _current_flowmap.get("metadata", {}).get("audio_path")

    if resolved_audio and Path(resolved_audio).exists():
        _set_current_files(Path(resolved_audio).resolve(), None)

    try:
        from flask import Flask, Response, abort, request, send_file, stream_with_context
        import logging

        app = Flask(__name__, static_folder=str(_FRONTEND_DIST_DIR))
        logging.getLogger("werkzeug").setLevel(logging.ERROR)

        # ── API routes (must be defined before the static catch-all) ────────────

        @app.route("/api/flowmap.json")
        def flowmap_api():
            if _current_flowmap is None:
                abort(404)
            return app.response_class(
                response=json.dumps(_current_flowmap, ensure_ascii=False),
                mimetype="application/json",
            )

        @app.route("/api/audio")
        def audio_api():
            if _current_audio is None or not _current_audio.exists():
                abort(404)
            return send_file(str(_current_audio), conditional=True)

        @app.route("/api/audio/vocals")
        def vocals_api():
            if _current_vocals is None or not _current_vocals.exists():
                abort(404)
            return send_file(str(_current_vocals), conditional=True)

        @app.route("/api/analyze", methods=["POST"])
        def analyze_api():
            if "audio" not in request.files:
                return {"error": "no audio file"}, 400

            uploaded    = request.files["audio"]
            model_name  = request.form.get("model") or "small"
            if model_name not in {"tiny", "base", "small", "medium", "large"}:
                model_name = "small"
            suffix      = Path(uploaded.filename).suffix.lower() or ".mp3"
            tmp         = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)
            tmp.close()
            uploaded.save(tmp.name)
            tmp_path    = Path(tmp.name)
            track_title = Path(uploaded.filename).stem

            @stream_with_context
            def generate():
                global _current_flowmap, _current_audio, _current_vocals
                try:
                    # ── 1. load audio ─────────────────────────────────────────
                    yield _sse("progress", step="load", msg="Loading audio…")
                    from nocap.audio.loader import load
                    audio_data = load(tmp_path)
                    yield _sse("progress", step="load",
                               msg=f"{audio_data.duration:.1f}s loaded", done=True)

                    # ── 2. beat detection (original mix) ──────────────────────
                    yield _sse("progress", step="beat", msg="Detecting beats…")
                    from nocap.audio.beat_tracker import track
                    grid = track(audio_data)
                    yield _sse("progress", step="beat",
                               msg=f"BPM: {grid.bpm:.1f}", done=True)

                    # ── 3. vocal isolation, then transcription ────────────────
                    vocals_path = None
                    transcription_audio = audio_data

                    from nocap.audio.separator import separate as do_sep, is_available
                    if is_available():
                        yield _sse("progress", step="transcribe",
                                   msg="Isolating vocals with Demucs…")
                        try:
                            vocals = do_sep(audio_data)
                            transcription_audio = vocals
                            import soundfile as sf
                            vocals_tmp = tempfile.NamedTemporaryFile(
                                suffix="_vocals.wav", delete=False)
                            vocals_tmp.close()
                            sf.write(vocals_tmp.name, vocals.y, vocals.sr)
                            vocals_path = Path(vocals_tmp.name)
                        except Exception:
                            if vocals_path is not None:
                                vocals_path.unlink(missing_ok=True)
                            vocals_path = None
                            transcription_audio = audio_data

                    yield _sse("progress", step="transcribe",
                               msg=f"Loading Whisper {model_name}…")
                    from nocap.audio.transcriber import transcribe, words_to_timed_lines
                    tr = transcribe(
                        transcription_audio,
                        model_name=model_name,
                    )
                    yield _sse("progress", step="transcribe",
                               msg=f"Language: {tr.language} · {len(tr.words)} words",
                               done=True)

                    # ── 4. analysis ───────────────────────────────────────────
                    yield _sse("progress", step="align", msg="Analyzing flow…")

                    lines = words_to_timed_lines(tr.words) if tr.has_word_timestamps \
                            else tr.timed_lines

                    from nocap.text.syllables import analyze_line
                    from nocap.text.rhyme import detect as detect_rhymes
                    if tr.has_word_timestamps:
                        from nocap.text.syllables import analyze_word
                        all_words = [
                            (analyze_line(tw.word)[0] if analyze_line(tw.word) else analyze_word(tw.word))
                            for tw in tr.words
                        ]
                    else:
                        all_words = []
                        for line in lines:
                            all_words.extend(analyze_line(line.text))
                    rhyme_labels = detect_rhymes(all_words)

                    if tr.has_word_timestamps:
                        from nocap.analysis.aligner import align_words
                        aligned = align_words(tr.words, grid,
                                             rhyme_labels=rhyme_labels,
                                             word_analyses=all_words)
                    else:
                        from nocap.analysis.aligner import align
                        aligned = align(lines, grid,
                                       rhyme_labels=rhyme_labels,
                                       word_analyses=all_words)

                    from nocap.analysis.flow_metrics import compute_bar_metrics, compute_summary
                    from nocap.analysis.exporter import build_flowmap
                    bar_metrics = compute_bar_metrics(aligned, grid)
                    summary     = compute_summary(bar_metrics, aligned)
                    flowmap     = build_flowmap(
                        title=track_title,
                        grid=grid,
                        syllables=aligned,
                        bar_metrics=bar_metrics,
                        summary=summary,
                        audio_path=str(tmp_path),
                    )

                    yield _sse("progress", step="align",
                               msg=f"{len(aligned)} syllables mapped", done=True)

                    # store for /api/flowmap.json, /api/audio, /api/audio/vocals
                    _current_flowmap = flowmap
                    owned_paths = {tmp_path}
                    if vocals_path is not None:
                        owned_paths.add(vocals_path)
                    _set_current_files(tmp_path, vocals_path, owned_paths)

                    yield _sse("complete",
                               flowmap=flowmap,
                               has_vocals=vocals_path is not None)

                except Exception as exc:
                    import traceback
                    yield _sse("error", msg=str(exc),
                               trace=traceback.format_exc())
                    tmp_path.unlink(missing_ok=True)

            return Response(
                generate(),
                mimetype="text/event-stream",
                headers={
                    "Cache-Control": "no-cache",
                    "X-Accel-Buffering": "no",
                    "Connection": "keep-alive",
                },
            )

        # ── static pages (catch-all last) ─────────────────────────────────────

        @app.route("/")
        def index():
            return _send_frontend_index()

        @app.route("/<path:asset_path>")
        def static_asset(asset_path: str):
            candidate = _FRONTEND_DIST_DIR / asset_path
            if candidate.exists() and candidate.is_file():
                return send_file(str(candidate))
            return _send_frontend_index()

        app.run(host="localhost", port=port, debug=False, threaded=True)

    except ImportError:
        raise RuntimeError("Flask is required: pip install flask")


def _send_frontend_index():
    from flask import send_file

    index_path = _FRONTEND_DIST_DIR / "index.html"
    if index_path.exists():
        return send_file(str(index_path))
    return (
        "Frontend build not found. Run `npm run build` in frontend/ for "
        "`nocap serve`, or use `nocap dev` during development.",
        503,
        {"Content-Type": "text/plain; charset=utf-8"},
    )


# ── SSE helper ────────────────────────────────────────────────────────────────

def _sse(event_type: str, **payload) -> str:
    payload["type"] = event_type
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"
