from __future__ import annotations

from dataclasses import dataclass

from nocap.audio.beat_grid import BeatGrid


@dataclass
class BeatTempo:
    beat_index: int
    local_bpm: float
    tempo_confidence: float


@dataclass
class BarTempo:
    bar_no: int
    local_bpm: float
    tempo_variance: float
    tempo_confidence: float


def compute_tempo_metrics(grid: BeatGrid) -> tuple[list[BeatTempo], list[BarTempo]]:
    beat_tempos = [BeatTempo(idx, *_local_tempo(grid, idx)) for idx, _ in enumerate(grid.beats)]
    bar_tempos: list[BarTempo] = []
    for bar_no in sorted({beat.bar_no for beat in grid.beats}):
        values = [item.local_bpm for item in beat_tempos if grid.beats[item.beat_index].bar_no == bar_no and item.local_bpm > 0]
        confidence = [item.tempo_confidence for item in beat_tempos if grid.beats[item.beat_index].bar_no == bar_no]
        avg = sum(values) / len(values) if values else grid.bpm
        variance = _variance(values)
        avg_confidence = sum(confidence) / len(confidence) if confidence else 0.0
        bar_tempos.append(BarTempo(bar_no, round(avg, 3), round(variance, 3), round(avg_confidence, 3)))
    return beat_tempos, bar_tempos


def _local_tempo(grid: BeatGrid, idx: int) -> tuple[float, float]:
    intervals = _neighbor_intervals(grid, idx)
    if not intervals:
        return round(grid.bpm, 3), 0.0
    avg_interval = sum(intervals) / len(intervals)
    if avg_interval <= 0:
        return round(grid.bpm, 3), 0.0
    bpm = 60.0 / avg_interval
    variance = _variance(intervals)
    confidence = max(0.0, min(1.0, 1.0 - variance / max(avg_interval * avg_interval, 1e-9)))
    return round(bpm, 3), round(confidence, 3)


def _neighbor_intervals(grid: BeatGrid, idx: int) -> list[float]:
    intervals: list[float] = []
    if idx > 0:
        intervals.append(grid.beats[idx].time - grid.beats[idx - 1].time)
    if idx + 1 < len(grid.beats):
        intervals.append(grid.beats[idx + 1].time - grid.beats[idx].time)
    return [value for value in intervals if value > 0]


def _variance(values: list[float]) -> float:
    if not values:
        return 0.0
    avg = sum(values) / len(values)
    return sum((value - avg) ** 2 for value in values) / len(values)
