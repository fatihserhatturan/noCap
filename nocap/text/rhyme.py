from __future__ import annotations

from dataclasses import dataclass

from .syllables import WordAnalysis


@dataclass
class RhymeGroup:
    label: str          # "A", "B", "C", ...
    ending: str         # phonetic ending used for matching
    word_indices: list[int]   # indices into the global syllable list


@dataclass(frozen=True)
class RhymeProfile:
    key: str
    vowel: str
    tail: tuple[str, ...]
    syllable_count: int
    has_phones: bool


@dataclass(frozen=True)
class RhymeMatch:
    kind: str
    strength: float
    key: str


def detect(words: list[WordAnalysis], window: int = 4) -> list[str]:
    """Assign a rhyme-group label to each word in the list.

    Uses the last stressed vowel + following consonants (CMU phones) as the
    rhyme key. Falls back to the last two characters when phones are absent.
    Returns a list of labels parallel to `words` (e.g. ['', '', 'A', 'A', '']).
    """
    labels = [""] * len(words)
    group_profiles: dict[str, RhymeProfile] = {}
    counter = 0

    for i, wa in enumerate(words):
        profile = profile_for_word(wa)
        if not profile.key:
            continue

        matched = _find_match(profile, i, labels, words, window)
        if matched is not None:
            label = matched
        else:
            label = _find_global_match(profile, group_profiles)
            if label is None:
                label = _index_to_label(counter)
                counter += 1

        labels[i] = label
        group_profiles.setdefault(label, profile)

    # clear labels that appear only once (not actually rhyming)
    from collections import Counter
    counts = Counter(l for l in labels if l)
    return [l if counts[l] > 1 else "" for l in labels]


def build_groups(words: list[WordAnalysis], labels: list[str]) -> list[RhymeGroup]:
    """Collect RhymeGroup objects from parallel word + label lists."""
    from collections import defaultdict
    buckets: dict[str, list[int]] = defaultdict(list)
    endings: dict[str, str] = {}
    for i, (wa, label) in enumerate(zip(words, labels)):
        if label:
            buckets[label].append(i)
            endings[label] = _rhyme_ending(wa)
    return [
        RhymeGroup(label=lbl, ending=endings.get(lbl, ""), word_indices=idxs)
        for lbl, idxs in sorted(buckets.items())
    ]


def profile_for_word(wa: WordAnalysis) -> RhymeProfile:
    if wa.phones:
        phones = wa.phones
        for j in range(len(phones) - 1, -1, -1):
            if phones[j][-1].isdigit() and int(phones[j][-1]) in (1, 2):
                ending = [p.rstrip("012") for p in phones[j:]]
                while len(ending) > 2 and ending[-1] in {"S", "Z"}:
                    ending.pop()
                vowel = ending[0] if ending else ""
                tail = tuple(p for p in ending[1:] if not _is_vowel_phone(p))
                return RhymeProfile(
                    key=" ".join(ending),
                    vowel=vowel,
                    tail=tail,
                    syllable_count=wa.syllable_count,
                    has_phones=True,
                )
    fallback = wa.clean[-3:] if len(wa.clean) >= 3 else wa.clean
    return RhymeProfile(
        key=fallback,
        vowel=_fallback_vowel(wa.clean),
        tail=tuple(fallback[-1:]),
        syllable_count=wa.syllable_count,
        has_phones=False,
    )


def classify_pair(left: WordAnalysis, right: WordAnalysis) -> RhymeMatch | None:
    return _match_profiles(profile_for_word(left), profile_for_word(right))


def classify_group(words: list[WordAnalysis]) -> RhymeMatch:
    if len(words) < 2:
        profile = profile_for_word(words[0]) if words else RhymeProfile("", "", (), 0, False)
        return RhymeMatch("perfect", 1.0, profile.key)

    matches: list[RhymeMatch] = []
    for i, left in enumerate(words):
        for right in words[i + 1:]:
            match = classify_pair(left, right)
            if match:
                matches.append(match)

    if not matches:
        profile = profile_for_word(words[0])
        return RhymeMatch("fallback", 0.35, profile.key)

    if any(word.syllable_count > 1 for word in words) and any(m.kind in {"perfect", "slant"} for m in matches):
        strongest = max(matches, key=lambda match: match.strength)
        return RhymeMatch("multi_syllable", max(0.78, strongest.strength - 0.04), strongest.key)

    priority = {"perfect": 4, "slant": 3, "assonance": 2, "fallback": 1}
    return max(matches, key=lambda match: (priority.get(match.kind, 0), match.strength))


# ── helpers ───────────────────────────────────────────────────────────────────

def _rhyme_ending(wa: WordAnalysis) -> str:
    """Extract the phonetic rhyme nucleus (last stressed vowel + trailing consonants)."""
    if wa.phones:
        phones = wa.phones
        # find last stressed vowel
        for j in range(len(phones) - 1, -1, -1):
            if phones[j][-1].isdigit() and int(phones[j][-1]) in (1, 2):
                # strip stress digit, keep from here to end
                ending = [p.rstrip("012") for p in phones[j:]]
                while len(ending) > 2 and ending[-1] in {"S", "Z"}:
                    ending.pop()
                return " ".join(ending)
    # fallback: last two chars of clean word
    return wa.clean[-2:] if len(wa.clean) >= 2 else wa.clean


def _find_match(
    profile: RhymeProfile,
    current_idx: int,
    labels: list[str],
    words: list[WordAnalysis],
    window: int,
) -> str | None:
    """Look back `window` labelled words for a matching ending."""
    seen = 0
    for j in range(current_idx - 1, -1, -1):
        if labels[j]:
            if _match_profiles(profile, profile_for_word(words[j])) is not None:
                return labels[j]
            seen += 1
            if seen >= window:
                break
    return None


def _find_global_match(profile: RhymeProfile, group_profiles: dict[str, RhymeProfile]) -> str | None:
    best: tuple[str, RhymeMatch] | None = None
    for label, other in group_profiles.items():
        match = _match_profiles(profile, other)
        if match is None:
            continue
        if best is None or match.strength > best[1].strength:
            best = (label, match)
    return best[0] if best else None


def _match_profiles(left: RhymeProfile, right: RhymeProfile) -> RhymeMatch | None:
    if not left.key or not right.key:
        return None
    if left.key == right.key:
        return RhymeMatch("perfect", 1.0, left.key)
    if left.vowel and left.vowel == right.vowel:
        tail_overlap = len(set(left.tail) & set(right.tail))
        tail_max = max(len(set(left.tail)), len(set(right.tail)), 1)
        tail_score = tail_overlap / tail_max
        if tail_score >= 0.5:
            return RhymeMatch("slant", 0.82, left.key)
        return RhymeMatch("assonance", 0.62, left.vowel)
    if left.tail and right.tail and left.tail[-1:] == right.tail[-1:]:
        return RhymeMatch("slant", 0.55, left.key)
    return None


def _is_vowel_phone(phone: str) -> bool:
    return any(ch in phone for ch in ("AA", "AE", "AH", "AO", "AW", "AY", "EH", "ER", "EY", "IH", "IY", "OW", "OY", "UH", "UW"))


def _fallback_vowel(clean: str) -> str:
    for ch in reversed(clean):
        if ch in "aeiouy":
            return ch
    return ""


def _index_to_label(n: int) -> str:
    """0→A, 1→B, …, 25→Z, 26→AA, …"""
    result = ""
    n += 1
    while n:
        n, r = divmod(n - 1, 26)
        result = chr(65 + r) + result
    return result
