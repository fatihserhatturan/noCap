from __future__ import annotations

from collections import defaultdict
from typing import Any

from nocap.analysis.aligner import AlignedSyllable
from nocap.text.rhyme import classify_group
from nocap.text.syllables import WordAnalysis


def build_rhyme_chains(syllables: list[AlignedSyllable]) -> list[dict[str, Any]]:
    groups: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for idx, syl in enumerate(syllables):
        if syl.rhyme_group:
            groups[syl.rhyme_group].append({"syllable_idx": idx, "word": syl.word, "time": syl.time, "bar_no": syl.bar_no})
    return [{"group": label, "count": len(entries), "occurrences": entries} for label, entries in sorted(groups.items())]


def build_rhyme_groups(syllables: list[AlignedSyllable], word_analyses: list[WordAnalysis] | None) -> list[dict[str, Any]]:
    output: list[dict[str, Any]] = []
    for label, entries in sorted(_group_syllables(syllables).items()):
        word_ids = sorted({s.word_id for s in entries if s.word_id >= 0})
        group_words = [word_analyses[word_id] for word_id in word_ids if word_analyses and word_id < len(word_analyses)]
        match = classify_group(group_words)
        output.append({
            "id": label,
            "type": match.kind,
            "placement": rhyme_placement(entries),
            "phonetic_key": match.key or phonetic_key(word_analyses, word_ids),
            "strength": round(match.strength, 3),
            "occurrences": [occurrence(s) for s in entries],
        })
    return output


def occurrence(syl: AlignedSyllable) -> dict[str, Any]:
    return {
        "word_id": syl.word_id,
        "syllable_start": syl.syllable_index,
        "syllable_end": syl.syllable_index,
        "start": syl.start if syl.start >= 0 else syl.time,
        "end": syl.end if syl.end >= 0 else syl.time,
        "time": syl.center_time if syl.center_time >= 0 else syl.time,
        "bar_no": syl.bar_no,
        "word": syl.word,
    }


def phonetic_key(word_analyses: list[WordAnalysis] | None, word_ids: list[int]) -> str:
    if not word_analyses or not word_ids:
        return ""
    for word_id in word_ids:
        if word_id < len(word_analyses):
            phones = word_analyses[word_id].phones
            return " ".join(p.rstrip("012") for p in phones[-3:]) if phones else word_analyses[word_id].clean[-3:]
    return ""


def rhyme_placement(entries: list[AlignedSyllable]) -> str:
    by_bar: dict[int, set[int]] = defaultdict(set)
    for entry in entries:
        if entry.word_id >= 0:
            by_bar[entry.bar_no].add(entry.word_id)
    return "internal" if any(len(word_ids) > 1 for word_ids in by_bar.values()) else "end"


def _group_syllables(syllables: list[AlignedSyllable]) -> dict[str, list[AlignedSyllable]]:
    groups: dict[str, list[AlignedSyllable]] = defaultdict(list)
    for syllable in syllables:
        if syllable.rhyme_group:
            groups[syllable.rhyme_group].append(syllable)
    return groups
