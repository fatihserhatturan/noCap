from __future__ import annotations

import json
import tempfile
from pathlib import Path

_STATIC_DIR = Path(__file__).parent / "static"

# current session state (set after a successful analysis)
_current_flowmap: dict | None = None
_current_audio: Path | None   = None


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
    global _current_flowmap, _current_audio

    if flowmap_path and flowmap_path.exists():
        _current_flowmap = json.loads(flowmap_path.read_text(encoding="utf-8"))

    if audio_path and Path(audio_path).exists():
        _current_audio = Path(audio_path).resolve()

    try:
        from flask import Flask, Response, abort, request, send_file, stream_with_context
        import logging

        app = Flask(__name__, static_folder=str(_STATIC_DIR))
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

        @app.route("/api/analyze", methods=["POST"])
        def analyze_api():
            if "audio" not in request.files:
                return {"error": "no audio file"}, 400

            uploaded = request.files["audio"]
            suffix = Path(uploaded.filename).suffix.lower() or ".mp3"
            tmp = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)
            uploaded.save(tmp.name)
            tmp_path = Path(tmp.name)
            track_title = Path(uploaded.filename).stem

            @stream_with_context
            def generate():
                global _current_flowmap, _current_audio
                try:
                    # ── 1. load audio ─────────────────────────────────────────
                    yield _sse("progress", step="load", msg="Loading audio…")
                    from nocap.audio.loader import load
                    audio_data = load(tmp_path)
                    yield _sse("progress", step="load",
                               msg=f"{audio_data.duration:.1f}s loaded", done=True)

                    # ── 2. beat detection ─────────────────────────────────────
                    yield _sse("progress", step="beat", msg="Detecting beats…")
                    from nocap.audio.beat_tracker import track
                    grid = track(audio_data)
                    yield _sse("progress", step="beat",
                               msg=f"BPM: {grid.bpm:.1f}", done=True)

                    # ── 3. transcription ──────────────────────────────────────
                    yield _sse("progress", step="transcribe",
                               msg="Loading Whisper model…")
                    from nocap.audio.transcriber import transcribe, words_to_timed_lines
                    tr = transcribe(audio_data, model_name="base")
                    yield _sse("progress", step="transcribe",
                               msg=f"Language: {tr.language} · {len(tr.words)} words",
                               done=True)

                    # ── 4. analysis ───────────────────────────────────────────
                    yield _sse("progress", step="align", msg="Analyzing flow…")

                    lines = words_to_timed_lines(tr.words) if tr.has_word_timestamps \
                            else tr.timed_lines

                    from nocap.text.syllables import analyze_line
                    from nocap.text.rhyme import detect as detect_rhymes
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

                    # store for /api/flowmap.json and /api/audio
                    _current_flowmap = flowmap
                    _current_audio   = tmp_path

                    yield _sse("complete", flowmap=flowmap)

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
            return send_file(str(_STATIC_DIR / "index.html"))

        @app.route("/style.css")
        def style_css():
            return send_file(str(_STATIC_DIR / "style.css"))

        @app.route("/flowmap.js")
        def flowmap_js():
            return send_file(str(_STATIC_DIR / "flowmap.js"))

        @app.route("/player.js")
        def player_js():
            return send_file(str(_STATIC_DIR / "player.js"))

        app.run(host="localhost", port=port, debug=False, threaded=True)

    except ImportError:
        raise RuntimeError("Flask is required: pip install flask")


# ── SSE helper ────────────────────────────────────────────────────────────────

def _sse(event_type: str, **payload) -> str:
    payload["type"] = event_type
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"
