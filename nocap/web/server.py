from __future__ import annotations

import sys
from pathlib import Path

from nocap.library import LibraryStore

from .app import create_app, hydrate_state
from .state import SessionState


def _frontend_dist() -> Path:
    # PyInstaller --onedir: bundled files live under sys._MEIPASS
    if getattr(sys, 'frozen', False) and hasattr(sys, '_MEIPASS'):
        return Path(sys._MEIPASS) / 'frontend_dist'
    return Path(__file__).resolve().parents[2] / 'frontend' / 'dist'


def _library_dir() -> Path:
    # In the packaged .app, store user data in home dir so it survives updates
    if getattr(sys, 'frozen', False):
        return Path.home() / '.nocap_library' / 'tracks'
    return Path(__file__).resolve().parents[2] / '.nocap_library' / 'tracks'


def start(
    flowmap_path: Path | None = None,
    audio_path: str | None = None,
    port: int = 5757,
) -> None:
    """Start the noCap web server."""
    try:
        state = SessionState()
        store = LibraryStore(_library_dir())
        hydrate_state(state, flowmap_path, audio_path)
        app = create_app(_frontend_dist(), store, state)
        app.run(host="localhost", port=port, debug=False, threaded=True)
    except ImportError as exc:
        raise RuntimeError("Flask is required: pip install flask") from exc
