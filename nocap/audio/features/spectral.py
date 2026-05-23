from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from nocap.i18n import msg


@dataclass
class SpectralFeatures:
    times: np.ndarray
    rms: np.ndarray
    spectral_centroid: np.ndarray
    spectral_bandwidth: np.ndarray
    zero_crossing_rate: np.ndarray


def spectral_features(y: np.ndarray, sr: int) -> SpectralFeatures:
    try:
        import librosa
    except ImportError as e:
        raise ImportError(msg("audio.needLibrosa")) from e

    rms = librosa.feature.rms(y=y)[0]
    centroid = librosa.feature.spectral_centroid(y=y, sr=sr)[0]
    bandwidth = librosa.feature.spectral_bandwidth(y=y, sr=sr)[0]
    zcr = librosa.feature.zero_crossing_rate(y)[0]
    length = min(len(rms), len(centroid), len(bandwidth), len(zcr))
    rms = _normalize(rms[:length])
    times = librosa.times_like(rms, sr=sr)
    return SpectralFeatures(
        times=times,
        rms=rms,
        spectral_centroid=centroid[:length],
        spectral_bandwidth=bandwidth[:length],
        zero_crossing_rate=zcr[:length],
    )


def _normalize(values: np.ndarray) -> np.ndarray:
    peak = float(np.max(values)) if len(values) else 0.0
    return values / peak if peak > 0 else values
