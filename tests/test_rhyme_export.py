from __future__ import annotations

import unittest

from nocap.analysis.aligner import align_words
from nocap.analysis.exporter import build_flowmap
from nocap.analysis.flow_metrics import compute_bar_metrics, compute_summary
from nocap.audio.beat_tracker import build_from_bpm
from nocap.audio.transcriber import TranscriptWord
from nocap.text.rhyme import classify_pair, detect
from nocap.text.syllables import analyze_line


class RhymeExportTest(unittest.TestCase):
    def test_v2_rhyme_groups_include_english_multisyllable_rhyme(self) -> None:
        words = [TranscriptWord("time", 0.0, 0.2), TranscriptWord("rhyme", 0.5, 0.7), TranscriptWord("nation", 1.0, 1.35), TranscriptWord("patience", 1.5, 1.85)]
        flowmap = _flowmap_for(words)
        self.assertTrue(any(group["type"] == "perfect" for group in flowmap["rhyme_groups"]))
        self.assertTrue(any(group["type"] == "multi_syllable" for group in flowmap["rhyme_groups"]))

    def test_english_rhyme_classifier_detects_slant_and_assonance(self) -> None:
        slant = classify_pair(analyze_line("cat")[0], analyze_line("bit")[0])
        assonance = classify_pair(analyze_line("light")[0], analyze_line("mind")[0])
        self.assertIsNotNone(slant)
        self.assertEqual("slant", slant.kind)
        self.assertIsNotNone(assonance)
        self.assertEqual("assonance", assonance.kind)

    def test_v2_rhyme_groups_mark_internal_placement(self) -> None:
        words = [TranscriptWord("cat", 0.0, 0.12), TranscriptWord("bit", 0.25, 0.37), TranscriptWord("flow", 2.0, 2.15)]
        flowmap = _flowmap_for(words, title="internal")
        self.assertTrue(any(group["type"] == "slant" and group["placement"] == "internal" for group in flowmap["rhyme_groups"]))

    def test_phase4_forced_bpm_keeps_synthetic_beat_source(self) -> None:
        words = [TranscriptWord("cat", 0.0, 0.12)]
        flowmap = _flowmap_for(words, analyses_override=[analyze_line("cat")[0]], title="forced", bpm=100)
        self.assertEqual(100, flowmap["metadata"]["bpm"])
        self.assertEqual("synthetic", flowmap["beats"][0]["source"])
        self.assertEqual(1.0, flowmap["beats"][0]["downbeat_confidence"])


def _flowmap_for(words: list[TranscriptWord], title: str = "rhymes", analyses_override=None, bpm: int = 120):
    analyses = analyses_override or [analyze_line(word.word)[0] for word in words]
    labels = detect(analyses)
    grid = build_from_bpm(bpm, 3)
    aligned = align_words(words, grid, labels, analyses)
    bars = compute_bar_metrics(aligned, grid)
    summary = compute_summary(bars, aligned)
    return build_flowmap(title, grid, aligned, bars, summary, transcript_words=words, word_analyses=analyses)
