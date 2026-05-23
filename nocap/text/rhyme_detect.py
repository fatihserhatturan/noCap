from __future__ import annotations

from collections import Counter, defaultdict

from .rhyme_match import match_profiles
from .rhyme_models import RhymeGroup, RhymeProfile
from .rhyme_profile import profile_for_word, rhyme_ending
from .syllables import WordAnalysis


def detect(words: list[WordAnalysis], window: int = 4) -> list[str]:
    labels = [""] * len(words)
    group_profiles: dict[str, RhymeProfile] = {}
    counter = 0
    for idx, word in enumerate(words):
        profile = profile_for_word(word)
        if not profile.key:
            continue
        label = _find_match(profile, idx, labels, words, window) or _find_global_match(profile, group_profiles)
        if label is None:
            label = index_to_label(counter)
            counter += 1
        labels[idx] = label
        group_profiles.setdefault(label, profile)
    counts = Counter(label for label in labels if label)
    return [label if counts[label] > 1 else "" for label in labels]


def build_groups(words: list[WordAnalysis], labels: list[str]) -> list[RhymeGroup]:
    buckets: dict[str, list[int]] = defaultdict(list)
    endings: dict[str, str] = {}
    for idx, (word, label) in enumerate(zip(words, labels)):
        if label:
            buckets[label].append(idx)
            endings[label] = rhyme_ending(word)
    return [RhymeGroup(label, endings.get(label, ""), indexes) for label, indexes in sorted(buckets.items())]


def index_to_label(n: int) -> str:
    result = ""
    n += 1
    while n:
        n, remainder = divmod(n - 1, 26)
        result = chr(65 + remainder) + result
    return result


def _find_match(profile: RhymeProfile, current_idx: int, labels: list[str], words: list[WordAnalysis], window: int) -> str | None:
    seen = 0
    for idx in range(current_idx - 1, -1, -1):
        if labels[idx]:
            if match_profiles(profile, profile_for_word(words[idx])) is not None:
                return labels[idx]
            seen += 1
            if seen >= window:
                break
    return None


def _find_global_match(profile: RhymeProfile, group_profiles: dict[str, RhymeProfile]) -> str | None:
    best = None
    for label, other in group_profiles.items():
        match = match_profiles(profile, other)
        if match is not None and (best is None or match.strength > best[1].strength):
            best = (label, match)
    return best[0] if best else None
