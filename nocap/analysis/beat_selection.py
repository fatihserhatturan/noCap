from __future__ import annotations

from nocap.audio.beat_grid import BeatGrid


def select_best_grid(candidates: list[BeatGrid]) -> BeatGrid | None:
    usable = [candidate for candidate in candidates if candidate.beats]
    if not usable:
        return None
    return max(usable, key=_score)


def _score(grid: BeatGrid) -> tuple[float, int]:
    confidence = sum(beat.confidence for beat in grid.beats) / len(grid.beats)
    return confidence, len(grid.beats)
