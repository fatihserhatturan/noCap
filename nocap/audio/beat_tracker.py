from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from .loader import AudioData


@dataclass
class Beat:
    time: float      # seconds
    beat_no: int     # 1-based within bar (1-4 for 4/4)
    bar_no: int      # 1-based bar index


@dataclass
class BeatGrid:
    bpm: float
    beats: list[Beat]
    time_signature: int = 4   # beats per bar


def track(audio: AudioData, time_signature: int = 4) -> BeatGrid:
    """Detect BPM and build a beat grid from an AudioData object."""
    try:
        import librosa
    except ImportError as e:
        raise ImportError("librosa is required: pip install librosa") from e

    tempo, beat_frames = librosa.beat.beat_track(
        y=audio.y, sr=audio.sr, units="frames"
    )
    beat_times: np.ndarray = librosa.frames_to_time(beat_frames, sr=audio.sr)

    bpm = float(np.atleast_1d(tempo)[0])
    if not np.isfinite(bpm) or bpm <= 0:
        bpm = 90.0

    if len(beat_times) == 0:
        return build_from_bpm(bpm, audio.duration, time_signature=time_signature)

    beats: list[Beat] = []
    for i, t in enumerate(beat_times):
        beat_no = (i % time_signature) + 1
        bar_no = (i // time_signature) + 1
        beats.append(Beat(time=float(t), beat_no=beat_no, bar_no=bar_no))

    return BeatGrid(bpm=bpm, beats=beats, time_signature=time_signature)


def build_from_bpm(bpm: float, duration: float, time_signature: int = 4) -> BeatGrid:
    """Build a synthetic beat grid from a known BPM and duration (no audio needed)."""
    beat_interval = 60.0 / bpm
    beats: list[Beat] = []
    t = 0.0
    i = 0
    while t < duration:
        beat_no = (i % time_signature) + 1
        bar_no = (i // time_signature) + 1
        beats.append(Beat(time=round(t, 6), beat_no=beat_no, bar_no=bar_no))
        t += beat_interval
        i += 1
    return BeatGrid(bpm=bpm, beats=beats, time_signature=time_signature)
