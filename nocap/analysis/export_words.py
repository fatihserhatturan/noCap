from __future__ import annotations

from collections import defaultdict
from typing import Any

from nocap.analysis.aligner import AlignedSyllable
from nocap.text.syllables import WordAnalysis


def build_words(
    transcript_words: list[Any] | None,
    word_analyses: list[WordAnalysis] | None,
    syllables: list[AlignedSyllable],
) -> list[dict[str, Any]]:
    if transcript_words is None:
        return []
    by_word = _syllables_by_word(syllables)
    output: list[dict[str, Any]] = []
    for idx, timed_word in enumerate(transcript_words):
        analysis = word_analyses[idx] if word_analyses and idx < len(word_analyses) else None
        word_syllables = by_word.get(idx, [])
        output.append(_word_out(idx, timed_word, analysis, word_syllables))
    return output


def _word_out(idx: int, timed_word: Any, analysis: WordAnalysis | None, syllables: list[AlignedSyllable]) -> dict[str, Any]:
    quality = sum(s.timing_quality for s in syllables) / len(syllables) if syllables else 0.0
    return {
        "id": idx,
        "word": getattr(timed_word, "word", ""),
        "start": round(float(getattr(timed_word, "start", 0.0)), 4),
        "end": round(float(getattr(timed_word, "end", 0.0)), 4),
        "probability": round(float(getattr(timed_word, "probability", 1.0)), 3),
        "syllable_count": analysis.syllable_count if analysis else len(syllables),
        "stress_pattern": analysis.stress_pattern if analysis else [],
        "timing_quality": round(quality, 3),
    }


def _syllables_by_word(syllables: list[AlignedSyllable]) -> dict[int, list[AlignedSyllable]]:
    by_word: dict[int, list[AlignedSyllable]] = defaultdict(list)
    for syllable in syllables:
        if syllable.word_id >= 0:
            by_word[syllable.word_id].append(syllable)
    return by_word
