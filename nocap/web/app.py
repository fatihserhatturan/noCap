from __future__ import annotations

import json
import logging
from pathlib import Path

from nocap.library import LibraryStore

from .analysis_routes import register_analysis_routes
from .library_routes import register_library_routes
from .media_routes import register_media_routes
from .state import SessionState


def create_app(frontend_dist: Path, store: LibraryStore, state: SessionState):
    from flask import Flask

    app = Flask(__name__, static_folder=str(frontend_dist))
    logging.getLogger("werkzeug").setLevel(logging.ERROR)
    register_analysis_routes(app, store, state)
    register_library_routes(app, store, state)
    register_media_routes(app, state, frontend_dist)
    return app


def hydrate_state(state: SessionState, flowmap_path: Path | None, audio_path: str | None) -> None:
    if flowmap_path and flowmap_path.exists():
        state.flowmap = json.loads(flowmap_path.read_text(encoding="utf-8"))
    resolved_audio = audio_path
    if resolved_audio is None and state.flowmap:
        resolved_audio = state.flowmap.get("metadata", {}).get("audio_path")
    if resolved_audio and Path(resolved_audio).exists():
        state.set_files(Path(resolved_audio).resolve(), None)
