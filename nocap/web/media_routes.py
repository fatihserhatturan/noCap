from __future__ import annotations

from pathlib import Path

from nocap.i18n import msg

from .state import SessionState


def register_media_routes(app, state: SessionState, frontend_dist: Path) -> None:
    from flask import abort, send_file

    @app.route("/api/audio")
    def audio_api():
        if state.audio is None or not state.audio.exists():
            abort(404)
        return send_file(str(state.audio), conditional=True)

    @app.route("/api/audio/vocals")
    def vocals_api():
        if state.vocals is None or not state.vocals.exists():
            abort(404)
        return send_file(str(state.vocals), conditional=True)

    @app.route("/")
    def index():
        return send_index(frontend_dist)

    @app.route("/<path:asset_path>")
    def static_asset(asset_path: str):
        candidate = frontend_dist / asset_path
        if candidate.exists() and candidate.is_file():
            return send_file(str(candidate))
        return send_index(frontend_dist)


def send_index(frontend_dist: Path):
    from flask import send_file

    index_path = frontend_dist / "index.html"
    if index_path.exists():
        return send_file(str(index_path))
    return (
        msg("web.noFrontendBuild"),
        503,
        {"Content-Type": "text/plain; charset=utf-8"},
    )
