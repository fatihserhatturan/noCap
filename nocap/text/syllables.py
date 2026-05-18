from __future__ import annotations

import re
from dataclasses import dataclass, field


@dataclass
class WordAnalysis:
    word: str
    clean: str              # lowercase, no punctuation
    syllable_count: int
    stress_pattern: list[int]   # 1 = primary, 2 = secondary, 0 = unstressed (CMU codes)
    phones: list[str] = field(default_factory=list)


def analyze_word(word: str) -> WordAnalysis:
    """Return syllable count and stress pattern for a single word."""
    clean = re.sub(r"[^a-zA-Z']", "", word).lower()
    phones, stress = _lookup_cmu(clean)
    if phones:
        return WordAnalysis(
            word=word,
            clean=clean,
            syllable_count=len(stress),
            stress_pattern=stress,
            phones=phones,
        )
    # CMU miss → fallback heuristic
    count = _count_heuristic(clean)
    return WordAnalysis(
        word=word,
        clean=clean,
        syllable_count=max(1, count),
        stress_pattern=[1] + [0] * max(0, count - 1),
        phones=[],
    )


def analyze_line(line: str) -> list[WordAnalysis]:
    """Analyze all words in a line of lyrics."""
    return [analyze_word(w) for w in line.split() if re.search(r"[a-zA-Z]", w)]


# ── CMU pronouncing dictionary lookup ────────────────────────────────────────

def _lookup_cmu(word: str) -> tuple[list[str], list[int]]:
    try:
        import pronouncing
    except ImportError:
        return [], []

    phones_list = pronouncing.phones_for_word(word)
    if not phones_list:
        return [], []
    phones = phones_list[0].split()
    stress = [int(p[-1]) for p in phones if p[-1].isdigit()]
    return phones, stress


# ── heuristic syllable counter ────────────────────────────────────────────────

_VOWELS = re.compile(r"[aeiouy]+", re.IGNORECASE)
_SILENT_E = re.compile(r"[^aeiouy]e$", re.IGNORECASE)
_CONSONANT_LE = re.compile(r"[^aeiouy]le$", re.IGNORECASE)


def _count_heuristic(word: str) -> int:
    if not word:
        return 0
    count = len(_VOWELS.findall(word))
    if _SILENT_E.search(word):
        count -= 1
    if _CONSONANT_LE.search(word):
        count += 1
    return max(1, count)
