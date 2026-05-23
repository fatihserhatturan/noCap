from __future__ import annotations

import math
from collections import defaultdict
from dataclasses import dataclass

from nocap.audio.beat_tracker import BeatGrid
from nocap.analysis.aligner import AlignedSyllable
from nocap.analysis.pocket_metrics import apply_track_pocket_profile, pocket_score, signed_beat_offset, variance as calc_variance


@dataclass
class BarMetrics:
    bar_no: int
    syllable_count: int
    density: float          # syllables per beat
    syncopation: float      # 0.0–1.0, fraction of syllables landing off-beat
    stressed_ratio: float   # fraction of syllables that are stressed
    syncopation_score: float = 0.0
    pocket_offset: float = 0.0
    timing_variance: float = 0.0
    stressed_on_beat_ratio: float = 0.0
    pocket_consistency: float = 0.0
    pocket_confidence: float = 0.0
    pocket_label: str = "loose"


@dataclass
class FlowSummary:
    avg_density: float
    peak_density: float
    syncopation_score: float    # song-wide average
    consistency: float          # 1 - normalised std of bar densities (higher = more consistent)
    rhyme_chain_avg: float      # average rhyme-chain length
    pocket_score: float = 0.0
    timing_quality_avg: float = 0.0
    density_variation: float = 0.0
    delivery_consistency: float = 0.0


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

        sync_scores = [_syncopation_score(s) for s in syls]
        syncopation = sum(sync_scores) / len(sync_scores) if sync_scores else 0.0

        stressed = sum(1 for s in syls if s.stress)
        stressed_ratio = stressed / len(syls) if syls else 0.0
        stressed_on_beat = sum(1 for s in syls if s.stress and s.is_on_beat)
        stressed_on_beat_ratio = stressed_on_beat / stressed if stressed else 0.0

        offsets = [signed_beat_offset(s.beat_pos) for s in syls]
        pocket_offset = sum(offsets) / len(offsets) if offsets else 0.0
        timing_variance = calc_variance(offsets)

        metrics.append(BarMetrics(
            bar_no=bar_no,
            syllable_count=len(syls),
            density=round(density, 3),
            syncopation=round(syncopation, 3),
            stressed_ratio=round(stressed_ratio, 3),
            syncopation_score=round(syncopation, 3),
            pocket_offset=round(pocket_offset, 3),
            timing_variance=round(timing_variance, 3),
            stressed_on_beat_ratio=round(stressed_on_beat_ratio, 3),
        ))
    apply_track_pocket_profile(metrics)
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
    pocket_score = _pocket_score(bar_metrics)
    timing_quality_avg = _timing_quality_avg(syllables)
    density_variation = calc_variance(densities)
    delivery_consistency = _delivery_consistency(consistency, pocket_score, timing_quality_avg)

    return FlowSummary(
        avg_density=round(avg_density, 3),
        peak_density=round(peak_density, 3),
        syncopation_score=round(syncopation_score, 3),
        consistency=round(consistency, 3),
        rhyme_chain_avg=round(rhyme_chain_avg, 3),
        pocket_score=round(pocket_score, 3),
        timing_quality_avg=round(timing_quality_avg, 3),
        density_variation=round(density_variation, 3),
        delivery_consistency=round(delivery_consistency, 3),
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


def _syncopation_score(syllable: AlignedSyllable) -> float:
    if syllable.is_on_beat:
        return 0.0
    pos = syllable.beat_pos
    beat_distance = min(pos, abs(1.0 - pos))
    if _near(pos, 0.5):
        return 1.0
    if _near(pos, 0.25) or _near(pos, 0.75):
        return 0.72
    if _near_grid(pos, 8) and not _near_grid(pos, 4):
        return 0.55
    if _near_grid(pos, 16) and not _near_grid(pos, 8):
        return 0.42
    return max(0.0, min(1.0, beat_distance / 0.5))


def _pocket_score(bar_metrics: list[BarMetrics]) -> float:
    return pocket_score(bar_metrics)


def _timing_quality_avg(syllables: list[AlignedSyllable]) -> float:
    if not syllables:
        return 0.0
    return sum(getattr(s, "timing_quality", 1.0) for s in syllables) / len(syllables)


def _delivery_consistency(consistency: float, pocket_score: float, timing_quality_avg: float) -> float:
    return max(0.0, min(1.0, consistency * 0.5 + pocket_score * 0.3 + timing_quality_avg * 0.2))


def _near(value: float, target: float, tolerance: float = 0.035) -> bool:
    return abs(value - target) <= tolerance


def _near_grid(value: float, denominator: int, tolerance: float = 0.035) -> bool:
    step = 1.0 / denominator
    nearest = round(value / step) * step
    return abs(value - nearest) <= tolerance
