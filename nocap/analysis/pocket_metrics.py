from __future__ import annotations

from typing import Any


def signed_beat_offset(beat_pos: float) -> float:
    return beat_pos if beat_pos <= 0.5 else beat_pos - 1.0


def variance(values: list[float]) -> float:
    if not values:
        return 0.0
    avg = sum(values) / len(values)
    return sum((value - avg) ** 2 for value in values) / len(values)


def apply_track_pocket_profile(bar_metrics: list[Any]) -> None:
    usable = [bar for bar in bar_metrics if bar.syllable_count >= 3]
    center = _weighted_average(usable, "pocket_offset")
    for bar in bar_metrics:
        _apply_bar_profile(bar, center)


def pocket_score(bar_metrics: list[Any]) -> float:
    usable = [bar for bar in bar_metrics if bar.syllable_count >= 3]
    if not usable:
        return 0.0
    weight = sum(bar.syllable_count for bar in usable)
    if weight <= 0:
        return 0.0
    return sum(bar.pocket_confidence * bar.syllable_count for bar in usable) / weight


def _apply_bar_profile(bar: Any, center: float) -> None:
    relative = bar.pocket_offset - center
    consistency = _clamp(1.0 - bar.timing_variance * 10.0 - abs(relative) * 2.8)
    density_confidence = min(1.0, bar.syllable_count / 6.0)
    bar.pocket_consistency = round(consistency, 3)
    bar.pocket_confidence = round(consistency * density_confidence, 3)
    bar.pocket_label = _label(relative, bar.pocket_confidence)


def _weighted_average(items: list[Any], attr: str) -> float:
    weight = sum(item.syllable_count for item in items)
    if weight <= 0:
        return 0.0
    return sum(getattr(item, attr) * item.syllable_count for item in items) / weight


def _label(relative_offset: float, confidence: float) -> str:
    if confidence < 0.45:
        return "loose"
    if relative_offset >= 0.07:
        return "behind"
    if relative_offset <= -0.07:
        return "ahead"
    return "center"


def _clamp(value: float) -> float:
    return max(0.0, min(1.0, value))
