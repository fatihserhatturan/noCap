from __future__ import annotations

from dataclasses import dataclass


@dataclass
class Beat:
    time: float
    beat_no: int
    bar_no: int
    confidence: float = 1.0
    downbeat_confidence: float = 0.0
    source: str = "detected"


@dataclass
class BeatGrid:
    bpm: float
    beats: list[Beat]
    time_signature: int = 4
