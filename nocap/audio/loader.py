from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import numpy as np


@dataclass
class AudioData:
    y: np.ndarray       # mono waveform samples
    sr: int             # sample rate
    duration: float     # seconds
    path: Path


def load(path: str | Path, target_sr: int = 22050) -> AudioData:
    """Load an audio file, resample to target_sr, convert to mono."""
    try:
        import librosa
    except ImportError as e:
        raise ImportError("librosa is required: pip install librosa") from e

    path = Path(path)
    if not path.exists():
        raise FileNotFoundError(f"Audio file not found: {path}")

    y, sr = librosa.load(str(path), sr=target_sr, mono=True)
    duration = librosa.get_duration(y=y, sr=sr)
    return AudioData(y=y, sr=sr, duration=float(duration), path=path)
