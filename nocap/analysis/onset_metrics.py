from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from nocap.audio.beat_grid import BeatGrid
from nocap.audio.features import OnsetEnvelope


@dataclass
class BeatOnset:
    beat_index: int
    strength: float


@dataclass
class BarOnset:
    bar_no: int
    onset_density: float
    onset_strength_avg: float
    vocal_onset_alignment: float


def compute_onset_metrics(envelope: OnsetEnvelope, grid: BeatGrid) -> tuple[list[BeatOnset], list[BarOnset]]:
    beat_metrics = [BeatOnset(idx, _window_strength(envelope, beat.time, _beat_end(grid, idx))) for idx, beat in enumerate(grid.beats)]
    bar_metrics: list[BarOnset] = []
    for bar_no in sorted({beat.bar_no for beat in grid.beats}):
        indexes = [idx for idx, beat in enumerate(grid.beats) if beat.bar_no == bar_no]
        strengths = [beat_metrics[idx].strength for idx in indexes]
        active = sum(1 for value in strengths if value >= 0.25)
        density = active / len(strengths) if strengths else 0.0
        avg = sum(strengths) / len(strengths) if strengths else 0.0
        bar_metrics.append(BarOnset(bar_no, round(density, 3), round(avg, 3), round(avg, 3)))
    return beat_metrics, bar_metrics


def _window_strength(envelope: OnsetEnvelope, start: float, end: float) -> float:
    if envelope.times.size == 0:
        return 0.0
    mask = (envelope.times >= start) & (envelope.times < end)
    if not np.any(mask):
        nearest = int(np.argmin(np.abs(envelope.times - start)))
        return round(float(envelope.strengths[nearest]), 3)
    return round(float(np.max(envelope.strengths[mask])), 3)


def _beat_end(grid: BeatGrid, idx: int) -> float:
    if idx + 1 < len(grid.beats):
        return grid.beats[idx + 1].time
    if idx > 0:
        return grid.beats[idx].time + (grid.beats[idx].time - grid.beats[idx - 1].time)
    return grid.beats[idx].time + 0.5
