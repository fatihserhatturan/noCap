from __future__ import annotations

import bisect

from nocap.text.syllables import WordAnalysis


def beat_position(t: float, beat_times: list[float]) -> tuple[int, float]:
    if not beat_times:
        return 0, 0.0
    idx = bisect.bisect_right(beat_times, t) - 1
    idx = max(0, min(idx, len(beat_times) - 1))
    beat_start = beat_times[idx]
    if idx + 1 < len(beat_times):
        beat_len = beat_times[idx + 1] - beat_start
    else:
        beat_len = (beat_times[-1] - beat_times[0]) / max(len(beat_times) - 1, 1)
    pos = (t - beat_start) / beat_len if beat_len > 0 else 0.0
    return idx, max(0.0, min(pos, 1.0))


def safe_word_window(start: float, end: float, syllable_count: int) -> tuple[float, float, float]:
    min_duration = max(0.06, syllable_count * 0.035)
    if end <= start:
        return start, start + min_duration, 0.2
    duration = end - start
    if duration < min_duration:
        # Anchor on start — whisper timestamps mark when a word *begins*, not its midpoint.
        # Pulling the window backward (midpoint centering) shifts syllables earlier than
        # the transcript places them, which worsens sync against playback.
        return start, start + min_duration, max(0.35, duration / min_duration)
    if duration > max(1.2, syllable_count * 0.45):
        return start, end, 0.65
    return start, end, 1.0


def weighted_syllable_windows(start: float, end: float, wa: WordAnalysis) -> list[tuple[float, float]]:
    count = max(1, wa.syllable_count)
    if count == 1:
        return [(start, end)]
    weights = [_stress_weight(wa, idx) for idx in range(count)]
    total = sum(weights) or float(count)
    cursor = start
    duration = end - start
    windows: list[tuple[float, float]] = []
    for idx, weight in enumerate(weights):
        next_cursor = end if idx == count - 1 else cursor + duration * (weight / total)
        windows.append((cursor, next_cursor))
        cursor = next_cursor
    return windows


def nearest_subdivision(beat_pos: float) -> tuple[str, float]:
    candidates: list[tuple[str, float]] = []
    for denom in (4, 8, 16):
        step = 1.0 / denom
        nearest = round(beat_pos / step) * step
        candidates.append((f"1/{denom}", abs(beat_pos - nearest)))
    return min(candidates, key=lambda item: item[1])


def _stress_weight(wa: WordAnalysis, idx: int) -> float:
    stress = wa.stress_pattern[idx] if idx < len(wa.stress_pattern) else 0
    return 1.18 if stress in (1, 2) else 0.92
