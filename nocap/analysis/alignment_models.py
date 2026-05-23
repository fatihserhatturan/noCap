from __future__ import annotations

from dataclasses import dataclass


@dataclass
class AlignedSyllable:
    word: str
    syllable_index: int
    time: float
    beat_pos: float
    beat_no: int
    bar_no: int
    global_beat_idx: int
    stress: bool
    rhyme_group: str
    word_id: int = -1
    start: float = -1.0
    end: float = -1.0
    center_time: float = -1.0
    subdivision: str = "1/4"
    is_on_beat: bool = False
    timing_quality: float = 1.0
    beat_distance: float = 0.0
