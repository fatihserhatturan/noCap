from __future__ import annotations

import json
from collections import defaultdict
from pathlib import Path
from typing import Any

from nocap.audio.beat_tracker import BeatGrid
from nocap.analysis.aligner import AlignedSyllable
from nocap.analysis.flow_metrics import BarMetrics, FlowSummary


def build_flowmap(
    title: str,
    grid: BeatGrid,
    syllables: list[AlignedSyllable],
    bar_metrics: list[BarMetrics],
    summary: FlowSummary,
    audio_path: str | None = None,
) -> dict[str, Any]:
    """Assemble the canonical FlowMap dict."""
    beats_out = [
        {"time": b.time, "beat_no": b.beat_no, "bar_no": b.bar_no}
        for b in grid.beats
    ]

    syllables_out = [
        {
            "word": s.word,
            "syllable_index": s.syllable_index,
            "time": s.time,
            "beat_pos": s.beat_pos,
            "beat_no": s.beat_no,
            "bar_no": s.bar_no,
            "global_beat_idx": s.global_beat_idx,
            "stress": s.stress,
            "rhyme_group": s.rhyme_group,
        }
        for s in syllables
    ]

    bars_out = [
        {
            "bar_no": b.bar_no,
            "syllable_count": b.syllable_count,
            "density": b.density,
            "syncopation": b.syncopation,
            "stressed_ratio": b.stressed_ratio,
        }
        for b in bar_metrics
    ]

    rhyme_chains = _build_rhyme_chains(syllables)

    return {
        "metadata": {
            "title": title,
            "bpm": round(grid.bpm, 2),
            "duration": grid.beats[-1].time if grid.beats else 0.0,
            "time_signature": grid.time_signature,
            "audio_path": audio_path,
        },
        "beats": beats_out,
        "syllables": syllables_out,
        "bars": bars_out,
        "rhyme_chains": rhyme_chains,
        "summary": {
            "avg_density": summary.avg_density,
            "peak_density": summary.peak_density,
            "syncopation_score": summary.syncopation_score,
            "consistency": summary.consistency,
            "rhyme_chain_avg": summary.rhyme_chain_avg,
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
