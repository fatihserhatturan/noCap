from __future__ import annotations

from dataclasses import dataclass

from nocap.analysis.flow_metrics import BarMetrics


@dataclass
class SectionMetrics:
    id: str
    label: str
    start_bar: int
    end_bar: int
    bar_count: int
    avg_density: float
    syncopation_score: float
    onset_strength_avg: float
    local_bpm: float
    tempo_confidence: float
    rms_avg: float
    spectral_centroid_avg: float
    spectral_bandwidth_avg: float
    zero_crossing_rate_avg: float


def compute_section_metrics(
    bar_metrics: list[BarMetrics],
    bar_onsets=None,
    bar_tempos=None,
    bar_spectral=None,
    bars_per_section: int = 8,
) -> list[SectionMetrics]:
    if not bar_metrics:
        return []
    onset_by_bar = {item.bar_no: item for item in bar_onsets or []}
    tempo_by_bar = {item.bar_no: item for item in bar_tempos or []}
    spectral_by_bar = {item.bar_no: item for item in bar_spectral or []}
    sections: list[SectionMetrics] = []
    for idx, start in enumerate(range(0, len(bar_metrics), bars_per_section), start=1):
        group = bar_metrics[start:start + bars_per_section]
        sections.append(_section(idx, group, onset_by_bar, tempo_by_bar, spectral_by_bar))
    return sections


def _section(idx: int, bars: list[BarMetrics], onset_by_bar: dict, tempo_by_bar: dict, spectral_by_bar: dict) -> SectionMetrics:
    bar_numbers = [bar.bar_no for bar in bars]
    return SectionMetrics(
        id=f"section_{idx}",
        label=f"Section {idx}",
        start_bar=min(bar_numbers),
        end_bar=max(bar_numbers),
        bar_count=len(bars),
        avg_density=round(_avg([bar.density for bar in bars]), 3),
        syncopation_score=round(_avg([bar.syncopation_score for bar in bars]), 3),
        onset_strength_avg=round(_avg([getattr(onset_by_bar.get(bar.bar_no), "onset_strength_avg", 0.0) for bar in bars]), 3),
        local_bpm=round(_avg([getattr(tempo_by_bar.get(bar.bar_no), "local_bpm", 0.0) for bar in bars]), 3),
        tempo_confidence=round(_avg([getattr(tempo_by_bar.get(bar.bar_no), "tempo_confidence", 0.0) for bar in bars]), 3),
        rms_avg=round(_avg([getattr(spectral_by_bar.get(bar.bar_no), "rms_avg", 0.0) for bar in bars]), 4),
        spectral_centroid_avg=round(_avg([getattr(spectral_by_bar.get(bar.bar_no), "spectral_centroid_avg", 0.0) for bar in bars]), 3),
        spectral_bandwidth_avg=round(_avg([getattr(spectral_by_bar.get(bar.bar_no), "spectral_bandwidth_avg", 0.0) for bar in bars]), 3),
        zero_crossing_rate_avg=round(_avg([getattr(spectral_by_bar.get(bar.bar_no), "zero_crossing_rate_avg", 0.0) for bar in bars]), 4),
    )


def _avg(values: list[float]) -> float:
    usable = [value for value in values if value > 0]
    return sum(usable) / len(usable) if usable else 0.0
