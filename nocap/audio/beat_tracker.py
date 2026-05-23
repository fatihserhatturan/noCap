from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from nocap.i18n import msg

from .loader import AudioData


@dataclass
class Beat:
    time: float      # seconds
    beat_no: int     # 1-based within bar (1-4 for 4/4)
    bar_no: int      # 1-based bar index
    confidence: float = 1.0
    downbeat_confidence: float = 0.0
    source: str = "detected"


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
        raise ImportError(msg("audio.needLibrosa")) from e

    tempo, beat_frames = librosa.beat.beat_track(
        y=audio.y, sr=audio.sr, units="frames"
    )
    beat_times: np.ndarray = librosa.frames_to_time(beat_frames, sr=audio.sr)

    bpm = float(np.atleast_1d(tempo)[0])
    if not np.isfinite(bpm) or bpm <= 0:
        bpm = 90.0

    if len(beat_times) == 0:
        return build_from_bpm(bpm, audio.duration, time_signature=time_signature)

    confidence = _beat_confidence(beat_times)
    beats: list[Beat] = []
    for i, t in enumerate(beat_times):
        beat_no = (i % time_signature) + 1
        bar_no = (i // time_signature) + 1
        beats.append(Beat(
            time=float(t),
            beat_no=beat_no,
            bar_no=bar_no,
            confidence=confidence,
            downbeat_confidence=0.5 if beat_no == 1 else 0.0,
            source="detected",
        ))

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
        beats.append(Beat(
            time=round(t, 6),
            beat_no=beat_no,
            bar_no=bar_no,
            confidence=1.0,
            downbeat_confidence=1.0 if beat_no == 1 else 0.0,
            source="synthetic",
        ))
        t += beat_interval
        i += 1
    return BeatGrid(bpm=bpm, beats=beats, time_signature=time_signature)


def apply_bar_offset(grid: BeatGrid, bar_offset: int) -> BeatGrid:
    """Shift bar numbers without changing beat times or beat positions."""
    if bar_offset == 0:
        return grid
    return BeatGrid(
        bpm=grid.bpm,
        time_signature=grid.time_signature,
        beats=[
            Beat(
                time=beat.time,
                beat_no=beat.beat_no,
                bar_no=max(1, beat.bar_no + bar_offset),
                confidence=beat.confidence,
                downbeat_confidence=beat.downbeat_confidence,
                source="manual",
            )
            for beat in grid.beats
        ],
    )


def apply_downbeat_offset(grid: BeatGrid, beat_offset: int, source: str = "manual") -> BeatGrid:
    """Rotate beat numbering by a manual downbeat offset."""
    if beat_offset == 0 or not grid.beats:
        return grid
    offset = beat_offset % grid.time_signature
    beats: list[Beat] = []
    for i, beat in enumerate(grid.beats):
        adjusted = i - offset
        beat_no = (adjusted % grid.time_signature) + 1
        bar_no = max(1, (adjusted // grid.time_signature) + 1)
        beats.append(Beat(
            time=beat.time,
            beat_no=beat_no,
            bar_no=bar_no,
            confidence=beat.confidence,
            downbeat_confidence=1.0 if beat_no == 1 else 0.0,
            source=source,
        ))
    return BeatGrid(bpm=grid.bpm, beats=beats, time_signature=grid.time_signature)


def apply_detected_downbeat_offset(
    grid: BeatGrid,
    beat_offset: int,
    confidence: float,
    threshold: float = 0.75,
) -> BeatGrid:
    """Only apply an automatic downbeat correction when confidence is high."""
    if confidence < threshold:
        return grid
    return apply_downbeat_offset(grid, beat_offset, source="detected")


def _beat_confidence(beat_times: np.ndarray) -> float:
    if len(beat_times) < 3:
        return 0.5
    intervals = np.diff(beat_times)
    mean = float(np.mean(intervals))
    if mean <= 0:
        return 0.35
    jitter = float(np.std(intervals) / mean)
    return round(max(0.35, min(1.0, 1.0 - jitter * 2.0)), 3)
