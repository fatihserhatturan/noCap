from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from nocap.audio.beat_tracker import BeatGrid
from nocap.analysis.aligner import AlignedSyllable
from nocap.analysis.export_parts import bars_out, beats_out, summary_out, syllables_out
from nocap.analysis.export_rhymes import build_rhyme_chains, build_rhyme_groups
from nocap.analysis.export_words import build_words
from nocap.analysis.flow_metrics import BarMetrics, FlowSummary
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
        "beats": beats_out(grid, beat_source),
        "words": build_words(transcript_words, word_analyses, syllables),
        "syllables": syllables_out(syllables),
        "bars": bars_out(bar_metrics),
        "rhyme_groups": build_rhyme_groups(syllables, word_analyses),
        "rhyme_chains": build_rhyme_chains(syllables),
        "summary": summary_out(summary),
    }


def save(flowmap: dict[str, Any], path: str | Path) -> Path:
    path = Path(path)
    path.write_text(json.dumps(flowmap, ensure_ascii=False, indent=2), encoding="utf-8")
    return path
