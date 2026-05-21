from __future__ import annotations

import bisect
from dataclasses import dataclass
from typing import TYPE_CHECKING

from nocap.audio.beat_tracker import BeatGrid
from nocap.text.parser import TimedLine
from nocap.text.syllables import WordAnalysis, analyze_line

if TYPE_CHECKING:
    from nocap.audio.transcriber import TranscriptWord


@dataclass
class AlignedSyllable:
    word: str
    syllable_index: int     # which syllable within the word (0-based)
    time: float             # seconds (-1.0 if unknown)
    beat_pos: float         # 0.0–1.0 position within the beat interval
    beat_no: int            # beat number within bar (1-4)
    bar_no: int             # bar number (1-based)
    global_beat_idx: int    # index into BeatGrid.beats
    stress: bool
    rhyme_group: str        # "" if no rhyme
    word_id: int = -1
    start: float = -1.0
    end: float = -1.0
    center_time: float = -1.0
    subdivision: str = "1/4"
    is_on_beat: bool = False
    timing_quality: float = 1.0
    beat_distance: float = 0.0


def align(
    lines: list[TimedLine],
    grid: BeatGrid,
    rhyme_labels: list[str] | None = None,
    word_analyses: list[WordAnalysis] | None = None,
) -> list[AlignedSyllable]:
    """Map each syllable in the lyrics to a position on the beat grid.

    Three modes depending on what timestamp info is available:
      - Timed lines (start >= 0): distribute syllables evenly within the line window
      - All lines untimed: distribute all syllables evenly across the whole grid
    """
    if word_analyses is None:
        all_words: list[WordAnalysis] = []
        for line in lines:
            all_words.extend(analyze_line(line.text))
    else:
        all_words = word_analyses

    if rhyme_labels is None:
        rhyme_labels = [""] * len(all_words)

    beat_times = [b.time for b in grid.beats]
    if not beat_times:
        return []

    all_timed = all(line.start >= 0 for line in lines)

    if all_timed:
        return _align_timed(lines, all_words, rhyme_labels, grid, beat_times)
    return _align_untimed(all_words, rhyme_labels, grid, beat_times)


# ── timed alignment ───────────────────────────────────────────────────────────

def _align_timed(
    lines: list[TimedLine],
    all_words: list[WordAnalysis],
    rhyme_labels: list[str],
    grid: BeatGrid,
    beat_times: list[float],
) -> list[AlignedSyllable]:
    result: list[AlignedSyllable] = []
    word_cursor = 0

    for li, line in enumerate(lines):
        words = analyze_line(line.text)
        if not words:
            word_cursor += len(words)
            continue

        # determine end time: start of next line or last beat
        if li + 1 < len(lines) and lines[li + 1].start >= 0:
            end_time = lines[li + 1].start
        else:
            end_time = beat_times[-1] if beat_times else line.start + 2.0

        total_syllables = sum(w.syllable_count for w in words)
        if total_syllables == 0:
            word_cursor += len(words)
            continue

        duration = max(end_time - line.start, 0.01)
        step = duration / total_syllables

        syl_t = line.start
        for wi, wa in enumerate(words):
            global_word_idx = word_cursor + wi
            label = rhyme_labels[global_word_idx] if global_word_idx < len(rhyme_labels) else ""
            for si in range(wa.syllable_count):
                bi, beat_pos = _beat_position(syl_t, beat_times)
                beat = grid.beats[bi]
                stressed = si < len(wa.stress_pattern) and wa.stress_pattern[si] in (1, 2)
                result.append(AlignedSyllable(
                    word=wa.word,
                    syllable_index=si,
                    time=round(syl_t, 4),
                    beat_pos=round(beat_pos, 4),
                    beat_no=beat.beat_no,
                    bar_no=beat.bar_no,
                    global_beat_idx=bi,
                    stress=stressed,
                    rhyme_group=label,
                ))
                syl_t += step

        word_cursor += len(words)
    return result


# ── untimed alignment ─────────────────────────────────────────────────────────

def _align_untimed(
    all_words: list[WordAnalysis],
    rhyme_labels: list[str],
    grid: BeatGrid,
    beat_times: list[float],
) -> list[AlignedSyllable]:
    total_syllables = sum(w.syllable_count for w in all_words)
    total_beats = len(grid.beats)
    if total_syllables == 0 or total_beats == 0:
        return []

    duration = beat_times[-1] - beat_times[0] if len(beat_times) > 1 else 60.0
    step = duration / total_syllables

    result: list[AlignedSyllable] = []
    syl_t = beat_times[0] if beat_times else 0.0
    for wi, wa in enumerate(all_words):
        label = rhyme_labels[wi] if wi < len(rhyme_labels) else ""
        for si in range(wa.syllable_count):
            bi, beat_pos = _beat_position(syl_t, beat_times)
            beat = grid.beats[bi]
            stressed = si < len(wa.stress_pattern) and wa.stress_pattern[si] in (1, 2)
            result.append(AlignedSyllable(
                word=wa.word,
                syllable_index=si,
                time=round(syl_t, 4),
                beat_pos=round(beat_pos, 4),
                beat_no=beat.beat_no,
                bar_no=beat.bar_no,
                global_beat_idx=bi,
                stress=stressed,
                rhyme_group=label,
            ))
            syl_t += step
    return result


# ── word-level alignment (Whisper) ───────────────────────────────────────────

def align_words(
    transcript_words: list[TranscriptWord],
    grid: BeatGrid,
    rhyme_labels: list[str] | None = None,
    word_analyses: list[WordAnalysis] | None = None,
) -> list[AlignedSyllable]:
    """High-precision alignment using Whisper word-level timestamps.

    Each word has its own start/end time; syllables are distributed evenly
    within that window instead of across a whole lyric line.
    """
    if word_analyses is None:
        word_analyses = [analyze_line(w.word)[0] if analyze_line(w.word) else _fallback_wa(w.word)
                         for w in transcript_words]

    if rhyme_labels is None:
        rhyme_labels = [""] * len(word_analyses)

    beat_times = [b.time for b in grid.beats]
    if not beat_times:
        return []

    result: list[AlignedSyllable] = []

    for wi, (tw, wa) in enumerate(zip(transcript_words, word_analyses)):
        label = rhyme_labels[wi] if wi < len(rhyme_labels) else ""
        if wa.syllable_count == 0:
            continue

        word_start, word_end, timing_quality = _safe_word_window(tw.start, tw.end, wa.syllable_count)
        windows = _weighted_syllable_windows(word_start, word_end, wa)

        for si, (syl_start, syl_end) in enumerate(windows):
            syl_t = (syl_start + syl_end) / 2
            bi, pos = _beat_position(syl_t, beat_times)
            beat    = grid.beats[bi]
            stressed = si < len(wa.stress_pattern) and wa.stress_pattern[si] in (1, 2)
            subdivision, _ = _nearest_subdivision(pos)
            beat_distance = min(pos, abs(1.0 - pos))
            result.append(AlignedSyllable(
                word=wa.word,
                syllable_index=si,
                time=round(syl_t, 4),
                beat_pos=round(pos, 4),
                beat_no=beat.beat_no,
                bar_no=beat.bar_no,
                global_beat_idx=bi,
                stress=stressed,
                rhyme_group=label,
                word_id=wi,
                start=round(syl_start, 4),
                end=round(syl_end, 4),
                center_time=round(syl_t, 4),
                subdivision=subdivision,
                is_on_beat=beat_distance <= 0.08,
                timing_quality=timing_quality,
                beat_distance=round(beat_distance, 4),
            ))

    return result


def _fallback_wa(word: str) -> WordAnalysis:
    from nocap.text.syllables import analyze_word
    return analyze_word(word)


# ── utility ───────────────────────────────────────────────────────────────────

def _beat_position(t: float, beat_times: list[float]) -> tuple[int, float]:
    """Return (beat_index, fractional_position_within_beat) for time t."""
    if not beat_times:
        return 0, 0.0

    idx = bisect.bisect_right(beat_times, t) - 1
    idx = max(0, min(idx, len(beat_times) - 1))

    beat_start = beat_times[idx]
    if idx + 1 < len(beat_times):
        beat_len = beat_times[idx + 1] - beat_start
    else:
        # estimate last beat length from previous interval
        beat_len = (beat_times[-1] - beat_times[0]) / max(len(beat_times) - 1, 1)

    pos = (t - beat_start) / beat_len if beat_len > 0 else 0.0
    return idx, max(0.0, min(pos, 1.0))


def _safe_word_window(start: float, end: float, syllable_count: int) -> tuple[float, float, float]:
    """Clamp broken Whisper word windows while keeping a quality signal."""
    min_duration = max(0.06, syllable_count * 0.035)
    if end <= start:
        return start, start + min_duration, 0.2
    duration = end - start
    if duration < min_duration:
        midpoint = (start + end) / 2
        half = min_duration / 2
        return max(0.0, midpoint - half), midpoint + half, max(0.35, duration / min_duration)
    if duration > max(1.2, syllable_count * 0.45):
        return start, end, 0.65
    return start, end, 1.0


def _weighted_syllable_windows(start: float, end: float, wa: WordAnalysis) -> list[tuple[float, float]]:
    """Split a word into syllable windows with a slight stress-aware bias."""
    count = max(1, wa.syllable_count)
    if count == 1:
        return [(start, end)]

    weights: list[float] = []
    for idx in range(count):
        stress = wa.stress_pattern[idx] if idx < len(wa.stress_pattern) else 0
        weights.append(1.18 if stress in (1, 2) else 0.92)

    total = sum(weights) or float(count)
    cursor = start
    duration = end - start
    windows: list[tuple[float, float]] = []
    for idx, weight in enumerate(weights):
        next_cursor = end if idx == count - 1 else cursor + duration * (weight / total)
        windows.append((cursor, next_cursor))
        cursor = next_cursor
    return windows


def _nearest_subdivision(beat_pos: float) -> tuple[str, float]:
    """Return the closest musically useful subdivision and distance within a beat."""
    candidates: list[tuple[str, float]] = []
    for denom in (4, 8, 16):
        step = 1.0 / denom
        nearest = round(beat_pos / step) * step
        distance = abs(beat_pos - nearest)
        candidates.append((f"1/{denom}", distance))
    return min(candidates, key=lambda item: item[1])
