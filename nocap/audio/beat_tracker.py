from __future__ import annotations

import numpy as np

from nocap.analysis.beat_selection import select_best_grid
from nocap.audio.beat_candidates import candidate_from_signal
from nocap.audio.beat_grid import Beat, BeatGrid
from nocap.audio.features import percussive_signal

from .loader import AudioData


def track(audio: AudioData, time_signature: int = 4) -> BeatGrid:
    """Detect BPM and build a beat grid from an AudioData object."""
    mix_grid = candidate_from_signal(audio.y, audio.sr, time_signature, source="mix")
    candidates = [mix_grid]
    try:
        candidates.append(candidate_from_signal(percussive_signal(audio.y), audio.sr, time_signature, source="percussive"))
    except Exception:
        pass
    grid = select_best_grid(candidates)
    if grid is None:
        return build_from_bpm(mix_grid.bpm, audio.duration, time_signature=time_signature)
    return grid


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
    from nocap.audio.beat_candidates import beat_confidence
    return beat_confidence(beat_times)
