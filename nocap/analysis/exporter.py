from __future__ import annotations

import json
from collections import defaultdict
from pathlib import Path
from typing import Any

from nocap.audio.beat_tracker import BeatGrid
from nocap.analysis.aligner import AlignedSyllable
from nocap.analysis.flow_metrics import BarMetrics, FlowSummary
from nocap.text.rhyme import classify_group
from nocap.text.syllables import WordAnalysis


def build_flowmap(
    title: str,
    grid: BeatGrid,
    syllables: list[AlignedSyllable],
    bar_metrics: list[BarMetrics],
    summary: FlowSummary,
    audio_path: str | None = None,
    duration: float | None = None,
    transcript_words: list[Any] | None = None,
    word_analyses: list[WordAnalysis] | None = None,
    analysis_mode: str = "legacy",
    beat_source: str | None = None,
) -> dict[str, Any]:
    """Assemble the canonical FlowMap dict."""
    beats_out = [
        {
            "time": b.time,
            "beat_no": b.beat_no,
            "bar_no": b.bar_no,
            "beat_index": idx,
            "confidence": getattr(b, "confidence", 1.0),
            "downbeat_confidence": getattr(b, "downbeat_confidence", 0.5 if b.beat_no == 1 else 0.0),
            "source": beat_source or getattr(b, "source", "detected"),
        }
        for idx, b in enumerate(grid.beats)
    ]

    syllables_out = [
        {
            "word": s.word,
            "word_id": s.word_id,
            "syllable_index": s.syllable_index,
            "time": s.time,
            "start": s.start if s.start >= 0 else s.time,
            "end": s.end if s.end >= 0 else s.time,
            "center_time": s.center_time if s.center_time >= 0 else s.time,
            "beat_pos": s.beat_pos,
            "beat_no": s.beat_no,
            "bar_no": s.bar_no,
            "global_beat_idx": s.global_beat_idx,
            "beat_index": s.global_beat_idx,
            "subdivision": s.subdivision,
            "is_on_beat": s.is_on_beat,
            "stress": s.stress,
            "rhyme_group": s.rhyme_group,
            "timing_quality": round(s.timing_quality, 3),
        }
        for s in syllables
    ]

    bars_out = [
        {
            "bar_no": b.bar_no,
            "syllable_count": b.syllable_count,
            "density": b.density,
            "syncopation": b.syncopation,
            "syncopation_score": b.syncopation_score,
            "pocket_offset": b.pocket_offset,
            "timing_variance": b.timing_variance,
            "stressed_on_beat_ratio": b.stressed_on_beat_ratio,
            "stressed_ratio": b.stressed_ratio,
        }
        for b in bar_metrics
    ]

    words_out = _build_words(transcript_words, word_analyses, syllables)
    rhyme_chains = _build_rhyme_chains(syllables)
    rhyme_groups = _build_rhyme_groups(syllables, word_analyses)
    metadata_duration = duration if duration is not None else (grid.beats[-1].time if grid.beats else 0.0)

    return {
        "schema_version": 2,
        "metadata": {
            "title": title,
            "bpm": round(grid.bpm, 2),
            "duration": round(float(metadata_duration), 3),
            "time_signature": grid.time_signature,
            "audio_path": audio_path,
            "analysis_mode": analysis_mode,
        },
        "beats": beats_out,
        "words": words_out,
        "syllables": syllables_out,
        "bars": bars_out,
        "rhyme_groups": rhyme_groups,
        "rhyme_chains": rhyme_chains,
        "summary": {
            "avg_density": summary.avg_density,
            "peak_density": summary.peak_density,
            "syncopation_score": summary.syncopation_score,
            "consistency": summary.consistency,
            "rhyme_chain_avg": summary.rhyme_chain_avg,
            "pocket_score": summary.pocket_score,
            "timing_quality_avg": summary.timing_quality_avg,
            "density_variation": summary.density_variation,
            "delivery_consistency": summary.delivery_consistency,
        },
    }


def save(flowmap: dict[str, Any], path: str | Path) -> Path:
    """Write the FlowMap dict to a JSON file."""
    path = Path(path)
    path.write_text(json.dumps(flowmap, ensure_ascii=False, indent=2), encoding="utf-8")
    return path


# ── helpers ───────────────────────────────────────────────────────────────────

def _build_rhyme_chains(syllables: list[AlignedSyllable]) -> list[dict[str, Any]]:
    groups: dict[str, list[dict]] = defaultdict(list)
    for i, s in enumerate(syllables):
        if s.rhyme_group:
            groups[s.rhyme_group].append({
                "syllable_idx": i,
                "word": s.word,
                "time": s.time,
                "bar_no": s.bar_no,
            })
    return [
        {"group": label, "count": len(entries), "occurrences": entries}
        for label, entries in sorted(groups.items())
    ]


def _build_words(
    transcript_words: list[Any] | None,
    word_analyses: list[WordAnalysis] | None,
    syllables: list[AlignedSyllable],
) -> list[dict[str, Any]]:
    if transcript_words is None:
        return []

    by_word: dict[int, list[AlignedSyllable]] = defaultdict(list)
    for syllable in syllables:
        if syllable.word_id >= 0:
            by_word[syllable.word_id].append(syllable)

    words_out: list[dict[str, Any]] = []
    for idx, tw in enumerate(transcript_words):
        analysis = word_analyses[idx] if word_analyses and idx < len(word_analyses) else None
        word_syllables = by_word.get(idx, [])
        quality = (
            sum(s.timing_quality for s in word_syllables) / len(word_syllables)
            if word_syllables else 0.0
        )
        words_out.append({
            "id": idx,
            "word": getattr(tw, "word", ""),
            "start": round(float(getattr(tw, "start", 0.0)), 4),
            "end": round(float(getattr(tw, "end", 0.0)), 4),
            "probability": round(float(getattr(tw, "probability", 1.0)), 3),
            "syllable_count": analysis.syllable_count if analysis else len(word_syllables),
            "stress_pattern": analysis.stress_pattern if analysis else [],
            "timing_quality": round(quality, 3),
        })
    return words_out


def _build_rhyme_groups(
    syllables: list[AlignedSyllable],
    word_analyses: list[WordAnalysis] | None,
) -> list[dict[str, Any]]:
    groups: dict[str, list[AlignedSyllable]] = defaultdict(list)
    for syllable in syllables:
        if syllable.rhyme_group:
            groups[syllable.rhyme_group].append(syllable)

    output: list[dict[str, Any]] = []
    for label, entries in sorted(groups.items()):
        word_ids = sorted({s.word_id for s in entries if s.word_id >= 0})
        group_words = [
            word_analyses[word_id]
            for word_id in word_ids
            if word_analyses and word_id < len(word_analyses)
        ]
        match = classify_group(group_words)
        placement = _rhyme_placement(entries)
        output.append({
            "id": label,
            "type": match.kind,
            "placement": placement,
            "phonetic_key": match.key or _phonetic_key(word_analyses, word_ids),
            "strength": round(match.strength, 3),
            "occurrences": [
                {
                    "word_id": s.word_id,
                    "syllable_start": s.syllable_index,
                    "syllable_end": s.syllable_index,
                    "start": s.start if s.start >= 0 else s.time,
                    "end": s.end if s.end >= 0 else s.time,
                    "time": s.center_time if s.center_time >= 0 else s.time,
                    "bar_no": s.bar_no,
                    "word": s.word,
                }
                for s in entries
            ],
        })
    return output


def _phonetic_key(word_analyses: list[WordAnalysis] | None, word_ids: list[int]) -> str:
    if not word_analyses or not word_ids:
        return ""
    keys: list[str] = []
    for word_id in word_ids:
        if word_id < len(word_analyses):
            phones = word_analyses[word_id].phones
            keys.append(" ".join(p.rstrip("012") for p in phones[-3:]) if phones else word_analyses[word_id].clean[-3:])
    return keys[0] if keys else ""


def _rhyme_placement(entries: list[AlignedSyllable]) -> str:
    by_bar: dict[int, set[int]] = defaultdict(set)
    for entry in entries:
        if entry.word_id >= 0:
            by_bar[entry.bar_no].add(entry.word_id)
    if any(len(word_ids) > 1 for word_ids in by_bar.values()):
        return "internal"
    return "end"
