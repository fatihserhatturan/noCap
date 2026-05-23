from __future__ import annotations

from nocap.audio.beat_tracker import BeatGrid
from nocap.text.parser import TimedLine
from nocap.text.syllables import WordAnalysis, analyze_line

from .alignment_helpers import beat_position
from .alignment_models import AlignedSyllable


def align(lines: list[TimedLine], grid: BeatGrid, rhyme_labels: list[str] | None = None, word_analyses: list[WordAnalysis] | None = None) -> list[AlignedSyllable]:
    all_words = _words(lines) if word_analyses is None else word_analyses
    labels = rhyme_labels or [""] * len(all_words)
    beat_times = [b.time for b in grid.beats]
    if not beat_times:
        return []
    if all(line.start >= 0 for line in lines):
        return _align_timed(lines, labels, grid, beat_times)
    return _align_untimed(all_words, labels, grid, beat_times)


def _align_timed(lines: list[TimedLine], labels: list[str], grid: BeatGrid, beat_times: list[float]) -> list[AlignedSyllable]:
    result: list[AlignedSyllable] = []
    word_cursor = 0
    for li, line in enumerate(lines):
        words = analyze_line(line.text)
        if not words:
            continue
        end_time = lines[li + 1].start if li + 1 < len(lines) and lines[li + 1].start >= 0 else beat_times[-1]
        total_syllables = sum(w.syllable_count for w in words)
        if total_syllables == 0:
            word_cursor += len(words)
            continue
        syl_t = line.start
        step = max(end_time - line.start, 0.01) / total_syllables
        for wi, wa in enumerate(words):
            result.extend(_word_syllables(wa, word_cursor + wi, labels, syl_t, step, grid, beat_times))
            syl_t += step * wa.syllable_count
        word_cursor += len(words)
    return result


def _align_untimed(words: list[WordAnalysis], labels: list[str], grid: BeatGrid, beat_times: list[float]) -> list[AlignedSyllable]:
    total_syllables = sum(w.syllable_count for w in words)
    if total_syllables == 0 or not grid.beats:
        return []
    duration = beat_times[-1] - beat_times[0] if len(beat_times) > 1 else 60.0
    step = duration / total_syllables
    result: list[AlignedSyllable] = []
    syl_t = beat_times[0]
    for wi, wa in enumerate(words):
        result.extend(_word_syllables(wa, wi, labels, syl_t, step, grid, beat_times))
        syl_t += step * wa.syllable_count
    return result


def _word_syllables(wa: WordAnalysis, word_idx: int, labels: list[str], start: float, step: float, grid: BeatGrid, beat_times: list[float]) -> list[AlignedSyllable]:
    result: list[AlignedSyllable] = []
    label = labels[word_idx] if word_idx < len(labels) else ""
    for si in range(wa.syllable_count):
        syl_t = start + si * step
        bi, pos = beat_position(syl_t, beat_times)
        beat = grid.beats[bi]
        stressed = si < len(wa.stress_pattern) and wa.stress_pattern[si] in (1, 2)
        result.append(AlignedSyllable(wa.word, si, round(syl_t, 4), round(pos, 4), beat.beat_no, beat.bar_no, bi, stressed, label))
    return result


def _words(lines: list[TimedLine]) -> list[WordAnalysis]:
    output: list[WordAnalysis] = []
    for line in lines:
        output.extend(analyze_line(line.text))
    return output
