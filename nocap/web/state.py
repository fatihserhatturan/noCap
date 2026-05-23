from __future__ import annotations

import atexit
from pathlib import Path
from typing import Any


class SessionState:
    def __init__(self) -> None:
        self.flowmap: dict[str, Any] | None = None
        self.audio: Path | None = None
        self.vocals: Path | None = None
        self._owned_temp_files: set[Path] = set()
        atexit.register(self.cleanup_all)

    def set_files(self, audio: Path | None, vocals: Path | None, owned: set[Path] | None = None) -> None:
        old_audio, old_vocals = self.audio, self.vocals
        self.audio = audio
        self.vocals = vocals
        if owned:
            self._owned_temp_files.update(owned)
        self.cleanup_owned(old_audio)
        self.cleanup_owned(old_vocals)

    def cleanup_owned(self, path: Path | None) -> None:
        if path is None or path not in self._owned_temp_files:
            return
        try:
            path.unlink(missing_ok=True)
        finally:
            self._owned_temp_files.discard(path)

    def cleanup_all(self) -> None:
        for path in list(self._owned_temp_files):
            self.cleanup_owned(path)

    def clear_if_inside(self, track_dir: Path) -> None:
        if _inside(self.audio, track_dir) or _inside(self.vocals, track_dir):
            self.flowmap = None
            self.set_files(None, None)


def _inside(path: Path | None, directory: Path) -> bool:
    if path is None:
        return False
    try:
        path.resolve().relative_to(directory.resolve())
    except (OSError, ValueError):
        return False
    return True
