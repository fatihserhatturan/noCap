from __future__ import annotations

from .rhyme_detect import build_groups, detect, index_to_label as _index_to_label
from .rhyme_match import classify_group, classify_pair, match_profiles as _match_profiles
from .rhyme_models import RhymeGroup, RhymeMatch, RhymeProfile
from .rhyme_profile import (
    fallback_vowel as _fallback_vowel,
    is_vowel_phone as _is_vowel_phone,
    profile_for_word,
    rhyme_ending as _rhyme_ending,
)

__all__ = [
    "RhymeGroup",
    "RhymeProfile",
    "RhymeMatch",
    "detect",
    "build_groups",
    "profile_for_word",
    "classify_pair",
    "classify_group",
    "_rhyme_ending",
    "_match_profiles",
    "_is_vowel_phone",
    "_fallback_vowel",
    "_index_to_label",
]
