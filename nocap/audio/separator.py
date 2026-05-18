from __future__ import annotations

import subprocess
import sys
import tempfile
from pathlib import Path

from nocap.audio.loader import AudioData, load


def separate(audio: AudioData, model: str = "htdemucs") -> AudioData:
    """Isolate vocals using Demucs. Returns a vocals-only AudioData.

    Requires the optional `separator` extra:
        pip install nocap[separator]
    """
    try:
        import demucs  # noqa: F401
    except ImportError as e:
        raise ImportError(
            "demucs is required for vocal separation: pip install demucs"
        ) from e

    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)

        # demucs CLI: --two-stems=vocals produces vocals.wav + no_vocals.wav
        cmd = [
            sys.executable, "-m", "demucs",
            "--two-stems", "vocals",
            "--model", model,
            "--out", str(tmp_path),
            str(audio.path),
        ]
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            raise RuntimeError(
                f"Demucs failed (exit {result.returncode}):\n{result.stderr}"
            )

        # demucs places output at <out>/<model>/<stem>/<filename>.wav
        vocals_path = _find_vocals(tmp_path, model, audio.path.stem)
        if not vocals_path:
            raise FileNotFoundError(
                f"Could not find Demucs vocals output in {tmp_path}"
            )

        # copy to a stable temp file before the tmpdir is cleaned up
        import shutil
        stable = Path(tempfile.mktemp(suffix="_vocals.wav"))
        shutil.copy2(vocals_path, stable)

    return load(stable, target_sr=audio.sr)


def is_available() -> bool:
    try:
        import demucs  # noqa: F401
        return True
    except ImportError:
        return False


# ── helpers ───────────────────────────────────────────────────────────────────

def _find_vocals(out_dir: Path, model: str, stem: str) -> Path | None:
    """Locate the vocals file produced by Demucs (layout varies by version)."""
    candidates = [
        out_dir / model / "vocals" / f"{stem}.wav",
        out_dir / model / stem / "vocals.wav",
        out_dir / "vocals" / f"{stem}.wav",
    ]
    for c in candidates:
        if c.exists():
            return c
    # broad glob fallback
    for p in out_dir.rglob("vocals.wav"):
        return p
    return None
