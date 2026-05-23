from __future__ import annotations

from typing import Any

from nocap.analysis.aligner import AlignedSyllable
from nocap.analysis.flow_metrics import BarMetrics, FlowSummary


def beats_out(grid, beat_source: str | None, beat_onsets=None, beat_tempos=None) -> list[dict[str, Any]]:
    onset_by_idx = {item.beat_index: item.strength for item in beat_onsets or []}
    tempo_by_idx = {item.beat_index: item for item in beat_tempos or []}
    return [{
        "time": beat.time,
        "beat_no": beat.beat_no,
        "bar_no": beat.bar_no,
        "beat_index": idx,
        "confidence": getattr(beat, "confidence", 1.0),
        "downbeat_confidence": getattr(beat, "downbeat_confidence", 0.5 if beat.beat_no == 1 else 0.0),
        "source": beat_source or getattr(beat, "source", "detected"),
        "onset_strength": onset_by_idx.get(idx, 0.0),
        "local_bpm": getattr(tempo_by_idx.get(idx), "local_bpm", 0.0),
        "tempo_confidence": getattr(tempo_by_idx.get(idx), "tempo_confidence", 0.0),
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


def bars_out(bar_metrics: list[BarMetrics], bar_onsets=None, bar_tempos=None, bar_spectral=None) -> list[dict[str, Any]]:
    onset_by_bar = {item.bar_no: item for item in bar_onsets or []}
    tempo_by_bar = {item.bar_no: item for item in bar_tempos or []}
    spectral_by_bar = {item.bar_no: item for item in bar_spectral or []}
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
        "pocket_consistency": getattr(bar, "pocket_consistency", 0.0),
        "pocket_confidence": getattr(bar, "pocket_confidence", 0.0),
        "pocket_label": getattr(bar, "pocket_label", "loose"),
        "onset_density": getattr(onset_by_bar.get(bar.bar_no), "onset_density", 0.0),
        "onset_strength_avg": getattr(onset_by_bar.get(bar.bar_no), "onset_strength_avg", 0.0),
        "vocal_onset_alignment": getattr(onset_by_bar.get(bar.bar_no), "vocal_onset_alignment", 0.0),
        "local_bpm": getattr(tempo_by_bar.get(bar.bar_no), "local_bpm", 0.0),
        "tempo_variance": getattr(tempo_by_bar.get(bar.bar_no), "tempo_variance", 0.0),
        "tempo_confidence": getattr(tempo_by_bar.get(bar.bar_no), "tempo_confidence", 0.0),
        "rms_avg": getattr(spectral_by_bar.get(bar.bar_no), "rms_avg", 0.0),
        "spectral_centroid_avg": getattr(spectral_by_bar.get(bar.bar_no), "spectral_centroid_avg", 0.0),
        "spectral_bandwidth_avg": getattr(spectral_by_bar.get(bar.bar_no), "spectral_bandwidth_avg", 0.0),
        "zero_crossing_rate_avg": getattr(spectral_by_bar.get(bar.bar_no), "zero_crossing_rate_avg", 0.0),
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
