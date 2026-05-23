from __future__ import annotations

from typing import TYPE_CHECKING

from nocap.audio.beat_tracker import BeatGrid
from nocap.text.syllables import WordAnalysis, analyze_line, analyze_word

from .alignment_helpers import beat_position, nearest_subdivision, safe_word_window, weighted_syllable_windows
from .alignment_models import AlignedSyllable

if TYPE_CHECKING:
    from nocap.audio.transcriber import TranscriptWord


def align_words(
    transcript_words: list["TranscriptWord"],
    grid: BeatGrid,
    rhyme_labels: list[str] | None = None,
    word_analyses: list[WordAnalysis] | None = None,
) -> list[AlignedSyllable]:
    analyses = word_analyses or [_analysis(word.word) for word in transcript_words]
    labels = rhyme_labels or [""] * len(analyses)
    beat_times = [b.time for b in grid.beats]
    if not beat_times:
        return []
    result: list[AlignedSyllable] = []
    for wi, (tw, wa) in enumerate(zip(transcript_words, analyses)):
        if wa.syllable_count == 0:
            continue
        result.extend(_align_word(wi, tw, wa, labels, grid, beat_times))
    return result


def _align_word(wi: int, tw, wa: WordAnalysis, labels: list[str], grid: BeatGrid, beat_times: list[float]) -> list[AlignedSyllable]:
    label = labels[wi] if wi < len(labels) else ""
    word_start, word_end, quality = safe_word_window(tw.start, tw.end, wa.syllable_count)
    result: list[AlignedSyllable] = []
    for si, (syl_start, syl_end) in enumerate(weighted_syllable_windows(word_start, word_end, wa)):
        syl_t = (syl_start + syl_end) / 2
        bi, pos = beat_position(syl_t, beat_times)
        beat = grid.beats[bi]
        stressed = si < len(wa.stress_pattern) and wa.stress_pattern[si] in (1, 2)
        subdivision, _ = nearest_subdivision(pos)
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
            timing_quality=quality,
            beat_distance=round(beat_distance, 4),
        ))
    return result


def _analysis(word: str) -> WordAnalysis:
    parsed = analyze_line(word)
    return parsed[0] if parsed else analyze_word(word)
