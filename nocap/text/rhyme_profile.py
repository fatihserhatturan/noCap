from __future__ import annotations

from .rhyme_models import RhymeProfile
from .syllables import WordAnalysis


def profile_for_word(wa: WordAnalysis) -> RhymeProfile:
    if wa.phones:
        for idx in range(len(wa.phones) - 1, -1, -1):
            if wa.phones[idx][-1].isdigit() and int(wa.phones[idx][-1]) in (1, 2):
                ending = _trim_plural([phone.rstrip("012") for phone in wa.phones[idx:]])
                return RhymeProfile(
                    key=" ".join(ending),
                    vowel=ending[0] if ending else "",
                    tail=tuple(phone for phone in ending[1:] if not is_vowel_phone(phone)),
                    syllable_count=wa.syllable_count,
                    has_phones=True,
                )
    fallback = wa.clean[-3:] if len(wa.clean) >= 3 else wa.clean
    return RhymeProfile(fallback, fallback_vowel(wa.clean), tuple(fallback[-1:]), wa.syllable_count, False)


def rhyme_ending(wa: WordAnalysis) -> str:
    if wa.phones:
        for idx in range(len(wa.phones) - 1, -1, -1):
            if wa.phones[idx][-1].isdigit() and int(wa.phones[idx][-1]) in (1, 2):
                return " ".join(_trim_plural([phone.rstrip("012") for phone in wa.phones[idx:]]))
    return wa.clean[-2:] if len(wa.clean) >= 2 else wa.clean


def is_vowel_phone(phone: str) -> bool:
    vowels = ("AA", "AE", "AH", "AO", "AW", "AY", "EH", "ER", "EY", "IH", "IY", "OW", "OY", "UH", "UW")
    return any(ch in phone for ch in vowels)


def fallback_vowel(clean: str) -> str:
    for ch in reversed(clean):
        if ch in "aeiouy":
            return ch
    return ""


def _trim_plural(ending: list[str]) -> list[str]:
    while len(ending) > 2 and ending[-1] in {"S", "Z"}:
        ending.pop()
    return ending
