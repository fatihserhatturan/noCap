from __future__ import annotations

from typing import Any

from nocap.analysis.aligner import AlignedSyllable
from nocap.analysis.flow_metrics import BarMetrics, FlowSummary


def beats_out(grid, beat_source: str | None) -> list[dict[str, Any]]:
    return [{
        "time": beat.time,
        "beat_no": beat.beat_no,
        "bar_no": beat.bar_no,
        "beat_index": idx,
        "confidence": getattr(beat, "confidence", 1.0),
        "downbeat_confidence": getattr(beat, "downbeat_confidence", 0.5 if beat.beat_no == 1 else 0.0),
        "source": beat_source or getattr(beat, "source", "detected"),
    } for idx, beat in enumerate(grid.beats)]


def syllables_out(syllables: list[AlignedSyllable]) -> list[dict[str, Any]]:
    return [{
        "word": syl.word,
        "word_id": syl.word_id,
        "syllable_index": syl.syllable_index,
        "time": syl.time,
        "start": syl.start if syl.start >= 0 else syl.time,
        "end": syl.end if syl.end >= 0 else syl.time,
        "center_time": syl.center_time if syl.center_time >= 0 else syl.time,
        "beat_pos": syl.beat_pos,
        "beat_no": syl.beat_no,
        "bar_no": syl.bar_no,
        "global_beat_idx": syl.global_beat_idx,
        "beat_index": syl.global_beat_idx,
        "subdivision": syl.subdivision,
        "is_on_beat": syl.is_on_beat,
        "stress": syl.stress,
        "rhyme_group": syl.rhyme_group,
        "timing_quality": round(syl.timing_quality, 3),
    } for syl in syllables]


def bars_out(bar_metrics: list[BarMetrics]) -> list[dict[str, Any]]:
    return [{
        "bar_no": bar.bar_no,
        "syllable_count": bar.syllable_count,
        "density": bar.density,
        "syncopation": bar.syncopation,
        "syncopation_score": bar.syncopation_score,
        "pocket_offset": bar.pocket_offset,
        "timing_variance": bar.timing_variance,
        "stressed_on_beat_ratio": bar.stressed_on_beat_ratio,
        "stressed_ratio": bar.stressed_ratio,
    } for bar in bar_metrics]


def summary_out(summary: FlowSummary) -> dict[str, Any]:
    return {
        "avg_density": summary.avg_density,
        "peak_density": summary.peak_density,
        "syncopation_score": summary.syncopation_score,
        "consistency": summary.consistency,
        "rhyme_chain_avg": summary.rhyme_chain_avg,
        "pocket_score": summary.pocket_score,
        "timing_quality_avg": summary.timing_quality_avg,
        "density_variation": summary.density_variation,
        "delivery_consistency": summary.delivery_consistency,
    }
