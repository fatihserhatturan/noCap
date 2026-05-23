from __future__ import annotations

import numpy as np

from nocap.i18n import msg


def percussive_signal(y: np.ndarray) -> np.ndarray:
    try:
        import librosa
    except ImportError as exc:
        raise ImportError(msg("audio.needLibrosa")) from exc
    _, percussive = librosa.effects.hpss(y)
    return np.asarray(percussive, dtype=np.float32)
