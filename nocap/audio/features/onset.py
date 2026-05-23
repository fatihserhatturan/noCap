from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from nocap.i18n import msg


@dataclass
class OnsetEnvelope:
    times: np.ndarray
    strengths: np.ndarray


def onset_envelope(y: np.ndarray, sr: int) -> OnsetEnvelope:
    try:
        import librosa
    except ImportError as exc:
        raise ImportError(msg("audio.needLibrosa")) from exc
    strengths = librosa.onset.onset_strength(y=y, sr=sr)
    times = librosa.times_like(strengths, sr=sr)
    peak = float(np.max(strengths)) if strengths.size else 0.0
    normalized = strengths / peak if peak > 0 else strengths
    return OnsetEnvelope(times=np.asarray(times), strengths=np.asarray(normalized))
