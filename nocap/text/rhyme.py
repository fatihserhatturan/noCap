from __future__ import annotations

from dataclasses import dataclass

from .syllables import WordAnalysis


@dataclass
class RhymeGroup:
    label: str          # "A", "B", "C", ...
    ending: str         # phonetic ending used for matching
    word_indices: list[int]   # indices into the global syllable list


def detect(words: list[WordAnalysis], window: int = 4) -> list[str]:
    """Assign a rhyme-group label to each word in the list.

    Uses the last stressed vowel + following consonants (CMU phones) as the
    rhyme key. Falls back to the last two characters when phones are absent.
    Returns a list of labels parallel to `words` (e.g. ['', '', 'A', 'A', '']).
    """
    labels = [""] * len(words)
    group_map: dict[str, str] = {}  # ending → label
    counter = 0

    for i, wa in enumerate(words):
        ending = _rhyme_ending(wa)
        if not ending:
            continue

        # look for a matching ending within the previous `window` labelled words
        matched = _find_match(ending, i, labels, words, window)
        if matched is not None:
            label = matched
        else:
            # check global group map (across the whole song)
            if ending in group_map:
                label = group_map[ending]
            else:
                label = _index_to_label(counter)
                group_map[ending] = label
                counter += 1

        labels[i] = label
        group_map[ending] = label

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


# ── helpers ───────────────────────────────────────────────────────────────────

def _rhyme_ending(wa: WordAnalysis) -> str:
    """Extract the phonetic rhyme nucleus (last stressed vowel + trailing consonants)."""
    if wa.phones:
        phones = wa.phones
        # find last stressed vowel
        for j in range(len(phones) - 1, -1, -1):
            if phones[j][-1].isdigit() and int(phones[j][-1]) in (1, 2):
                # strip stress digit, keep from here to end
                return " ".join(p.rstrip("012") for p in phones[j:])
    # fallback: last two chars of clean word
    return wa.clean[-2:] if len(wa.clean) >= 2 else wa.clean


def _find_match(
    ending: str,
    current_idx: int,
    labels: list[str],
    words: list[WordAnalysis],
    window: int,
) -> str | None:
    """Look back `window` labelled words for a matching ending."""
    seen = 0
    for j in range(current_idx - 1, -1, -1):
        if labels[j]:
            if _rhyme_ending(words[j]) == ending:
                return labels[j]
            seen += 1
            if seen >= window:
                break
    return None


def _index_to_label(n: int) -> str:
    """0→A, 1→B, …, 25→Z, 26→AA, …"""
    result = ""
    n += 1
    while n:
        n, r = divmod(n - 1, 26)
        result = chr(65 + r) + result
    return result
