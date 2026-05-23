from __future__ import annotations

from .rhyme_models import RhymeMatch, RhymeProfile
from .rhyme_profile import profile_for_word
from .syllables import WordAnalysis


def classify_pair(left: WordAnalysis, right: WordAnalysis) -> RhymeMatch | None:
    return match_profiles(profile_for_word(left), profile_for_word(right))


def classify_group(words: list[WordAnalysis]) -> RhymeMatch:
    if len(words) < 2:
        profile = profile_for_word(words[0]) if words else RhymeProfile("", "", (), 0, False)
        return RhymeMatch("perfect", 1.0, profile.key)
    matches = _pair_matches(words)
    if not matches:
        return RhymeMatch("fallback", 0.35, profile_for_word(words[0]).key)
    if any(word.syllable_count > 1 for word in words) and any(m.kind in {"perfect", "slant"} for m in matches):
        strongest = max(matches, key=lambda match: match.strength)
        return RhymeMatch("multi_syllable", max(0.78, strongest.strength - 0.04), strongest.key)
    priority = {"perfect": 4, "slant": 3, "assonance": 2, "fallback": 1}
    return max(matches, key=lambda match: (priority.get(match.kind, 0), match.strength))


def match_profiles(left: RhymeProfile, right: RhymeProfile) -> RhymeMatch | None:
    if not left.key or not right.key:
        return None
    if left.key == right.key:
        return RhymeMatch("perfect", 1.0, left.key)
    if left.vowel and left.vowel == right.vowel:
        tail_score = _tail_score(left, right)
        return RhymeMatch("slant", 0.82, left.key) if tail_score >= 0.5 else RhymeMatch("assonance", 0.62, left.vowel)
    if left.tail and right.tail and left.tail[-1:] == right.tail[-1:]:
        return RhymeMatch("slant", 0.55, left.key)
    return None


def _pair_matches(words: list[WordAnalysis]) -> list[RhymeMatch]:
    matches: list[RhymeMatch] = []
    for idx, left in enumerate(words):
        for right in words[idx + 1:]:
            match = classify_pair(left, right)
            if match:
                matches.append(match)
    return matches


def _tail_score(left: RhymeProfile, right: RhymeProfile) -> float:
    tail_overlap = len(set(left.tail) & set(right.tail))
    tail_max = max(len(set(left.tail)), len(set(right.tail)), 1)
    return tail_overlap / tail_max
