from __future__ import annotations

import numpy as np

from nocap.audio.beat_grid import Beat, BeatGrid
from nocap.i18n import msg


def candidate_from_signal(y: np.ndarray, sr: int, time_signature: int, source: str) -> BeatGrid:
    try:
        import librosa
    except ImportError as exc:
        raise ImportError(msg("audio.needLibrosa")) from exc
    tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr, units="frames")
    beat_times = librosa.frames_to_time(beat_frames, sr=sr)
    bpm = _bpm(tempo)
    confidence = beat_confidence(beat_times)
    beats = [
        Beat(
            time=float(time),
            beat_no=(idx % time_signature) + 1,
            bar_no=(idx // time_signature) + 1,
            confidence=confidence,
            downbeat_confidence=0.5 if idx % time_signature == 0 else 0.0,
            source=source,
        )
        for idx, time in enumerate(beat_times)
    ]
    return BeatGrid(bpm=bpm, beats=beats, time_signature=time_signature)


def beat_confidence(beat_times: np.ndarray) -> float:
    if len(beat_times) < 3:
        return 0.5 if len(beat_times) else 0.0
    intervals = np.diff(beat_times)
    mean = float(np.mean(intervals))
    if mean <= 0:
        return 0.35
    jitter = float(np.std(intervals) / mean)
    return round(max(0.35, min(1.0, 1.0 - jitter * 2.0)), 3)


def _bpm(tempo) -> float:
    bpm = float(np.atleast_1d(tempo)[0])
    return bpm if np.isfinite(bpm) and bpm > 0 else 90.0
