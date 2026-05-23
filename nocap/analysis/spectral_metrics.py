from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from nocap.audio.beat_grid import BeatGrid
from nocap.audio.features import SpectralFeatures


@dataclass
class BarSpectral:
    bar_no: int
    rms_avg: float
    spectral_centroid_avg: float
    spectral_bandwidth_avg: float
    zero_crossing_rate_avg: float


def compute_spectral_metrics(features: SpectralFeatures, grid: BeatGrid) -> list[BarSpectral]:
    windows = _bar_windows(grid)
    return [_bar_metric(bar_no, start, end, features) for bar_no, start, end in windows]


def _bar_windows(grid: BeatGrid) -> list[tuple[int, float, float]]:
    starts: dict[int, float] = {}
    for beat in grid.beats:
        starts.setdefault(beat.bar_no, beat.time)
    bar_numbers = sorted(starts)
    intervals = [b.time - a.time for a, b in zip(grid.beats, grid.beats[1:]) if b.time > a.time]
    beat_len = float(np.median(intervals)) if intervals else 60.0 / max(grid.bpm, 1.0)
    windows: list[tuple[int, float, float]] = []
    for idx, bar_no in enumerate(bar_numbers):
        start = starts[bar_no]
        end = starts[bar_numbers[idx + 1]] if idx + 1 < len(bar_numbers) else start + beat_len * grid.time_signature
        windows.append((bar_no, start, end))
    return windows


def _bar_metric(bar_no: int, start: float, end: float, features: SpectralFeatures) -> BarSpectral:
    mask = (features.times >= start) & (features.times < end)
    return BarSpectral(
        bar_no=bar_no,
        rms_avg=round(_avg(features.rms, mask), 4),
        spectral_centroid_avg=round(_avg(features.spectral_centroid, mask), 3),
        spectral_bandwidth_avg=round(_avg(features.spectral_bandwidth, mask), 3),
        zero_crossing_rate_avg=round(_avg(features.zero_crossing_rate, mask), 4),
    )


def _avg(values: np.ndarray, mask: np.ndarray) -> float:
    selected = values[mask]
    if len(selected):
        return float(np.mean(selected))
    return 0.0
