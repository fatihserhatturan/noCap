from __future__ import annotations

from pathlib import Path

from nocap.library import LibraryStore

from .app import create_app, hydrate_state
from .state import SessionState

_FRONTEND_DIST_DIR = Path(__file__).resolve().parents[2] / "frontend" / "dist"
_LIBRARY_DIR = Path(__file__).resolve().parents[2] / ".nocap_library" / "tracks"


def start(
    flowmap_path: Path | None = None,
    audio_path: str | None = None,
    port: int = 5757,
) -> None:
    """Start the noCap web server."""
    try:
        state = SessionState()
        store = LibraryStore(_LIBRARY_DIR)
        hydrate_state(state, flowmap_path, audio_path)
        app = create_app(_FRONTEND_DIST_DIR, store, state)
        app.run(host="localhost", port=port, debug=False, threaded=True)
    except ImportError as exc:
        raise RuntimeError("Flask is required: pip install flask") from exc
