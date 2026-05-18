from __future__ import annotations

import math
from collections import defaultdict
from dataclasses import dataclass

from nocap.audio.beat_tracker import BeatGrid
from nocap.analysis.aligner import AlignedSyllable


@dataclass
class BarMetrics:
    bar_no: int
    syllable_count: int
    density: float          # syllables per beat
    syncopation: float      # 0.0–1.0, fraction of syllables landing off-beat
    stressed_ratio: float   # fraction of syllables that are stressed


@dataclass
class FlowSummary:
    avg_density: float
    peak_density: float
    syncopation_score: float    # song-wide average
    consistency: float          # 1 - normalised std of bar densities (higher = more consistent)
    rhyme_chain_avg: float      # average rhyme-chain length


def compute_bar_metrics(syllables: list[AlignedSyllable], grid: BeatGrid) -> list[BarMetrics]:
    """Compute per-bar metrics from aligned syllables."""
    # group syllables by bar
    by_bar: dict[int, list[AlignedSyllable]] = defaultdict(list)
    for s in syllables:
        by_bar[s.bar_no].append(s)

    # count beats per bar
    beats_per_bar: dict[int, int] = defaultdict(int)
    for beat in grid.beats:
        beats_per_bar[beat.bar_no] += 1

    metrics: list[BarMetrics] = []
    for bar_no in sorted(by_bar):
        syls = by_bar[bar_no]
        n_beats = beats_per_bar.get(bar_no, grid.time_signature)
        density = len(syls) / n_beats if n_beats else 0.0

        # off-beat = beat_pos > 0.15 (not landing right on a beat)
        off_beat = sum(1 for s in syls if s.beat_pos > 0.15)
        syncopation = off_beat / len(syls) if syls else 0.0

        stressed = sum(1 for s in syls if s.stress)
        stressed_ratio = stressed / len(syls) if syls else 0.0

        metrics.append(BarMetrics(
            bar_no=bar_no,
            syllable_count=len(syls),
            density=round(density, 3),
            syncopation=round(syncopation, 3),
            stressed_ratio=round(stressed_ratio, 3),
        ))
    return metrics


def compute_summary(
    bar_metrics: list[BarMetrics],
    syllables: list[AlignedSyllable],
) -> FlowSummary:
    if not bar_metrics:
        return FlowSummary(0, 0, 0, 0, 0)

    densities = [b.density for b in bar_metrics]
    avg_density = sum(densities) / len(densities)
    peak_density = max(densities)

    syncopation_score = sum(b.syncopation for b in bar_metrics) / len(bar_metrics)

    # consistency: 1 - (std / mean), clamped to [0, 1]
    if avg_density > 0:
        variance = sum((d - avg_density) ** 2 for d in densities) / len(densities)
        std = math.sqrt(variance)
        consistency = max(0.0, 1.0 - std / avg_density)
    else:
        consistency = 0.0

    rhyme_chain_avg = _avg_rhyme_chain(syllables)

    return FlowSummary(
        avg_density=round(avg_density, 3),
        peak_density=round(peak_density, 3),
        syncopation_score=round(syncopation_score, 3),
        consistency=round(consistency, 3),
        rhyme_chain_avg=round(rhyme_chain_avg, 3),
    )


def _avg_rhyme_chain(syllables: list[AlignedSyllable]) -> float:
    """Average length of consecutive rhyme-group runs."""
    if not syllables:
        return 0.0

    chains: list[int] = []
    run = 0
    current = ""
    for s in syllables:
        if s.rhyme_group and s.rhyme_group == current:
            run += 1
        else:
            if run > 1:
                chains.append(run)
            run = 1 if s.rhyme_group else 0
            current = s.rhyme_group
    if run > 1:
        chains.append(run)

    return sum(chains) / len(chains) if chains else 0.0
