from __future__ import annotations

import unittest

from nocap.analysis.aligner import align_words
from nocap.analysis.flow_metrics import compute_bar_metrics, compute_summary
from nocap.audio.beat_tracker import build_from_bpm
from nocap.audio.transcriber import TranscriptWord
from nocap.text.syllables import WordAnalysis


class AlignmentMetricsTest(unittest.TestCase):
    def test_word_alignment_clamps_too_short_windows(self) -> None:
        grid = build_from_bpm(120, 2)
        analysis = WordAnalysis("arrival", "arrival", 3, [0, 1, 0], [])
        aligned = align_words([TranscriptWord("arrival", 0.1, 0.12)], grid, word_analyses=[analysis])
        self.assertEqual(3, len(aligned))
        self.assertLess(aligned[0].timing_quality, 1.0)
        self.assertGreater(aligned[-1].end - aligned[0].start, 0.09)

    def test_word_alignment_uses_stress_weighted_syllable_windows(self) -> None:
        grid = build_from_bpm(120, 2)
        analysis = WordAnalysis("record", "record", 2, [0, 1], [])
        aligned = align_words([TranscriptWord("record", 0.0, 1.0)], grid, word_analyses=[analysis])
        self.assertGreater(aligned[1].end - aligned[1].start, aligned[0].end - aligned[0].start)
        self.assertTrue(aligned[1].stress)

    def test_v2_metrics_score_onbeat_lower_than_offbeat(self) -> None:
        grid = build_from_bpm(120, 2)
        analysis = [WordAnalysis("cat", "cat", 1, [1], [])]
        onbeat = align_words([TranscriptWord("cat", 0.0, 0.06)], grid, word_analyses=analysis)
        offbeat = align_words([TranscriptWord("cat", 0.22, 0.28)], grid, word_analyses=analysis)
        self.assertLess(compute_bar_metrics(onbeat, grid)[0].syncopation_score, compute_bar_metrics(offbeat, grid)[0].syncopation_score)

    def test_v2_syncopation_scores_weak_subdivisions(self) -> None:
        grid = build_from_bpm(120, 2)
        analysis = [WordAnalysis("cat", "cat", 1, [1], [])]
        eighth = align_words([TranscriptWord("cat", 0.0325, 0.0925)], grid, word_analyses=analysis)
        sixteenth = align_words([TranscriptWord("cat", 0.06375, 0.12375)], grid, word_analyses=analysis)
        self.assertGreaterEqual(compute_bar_metrics(eighth, grid)[0].syncopation_score, 0.5)
        self.assertGreaterEqual(compute_bar_metrics(sixteenth, grid)[0].syncopation_score, 0.4)

    def test_v2_summary_includes_delivery_consistency(self) -> None:
        grid = build_from_bpm(120, 4)
        words = [TranscriptWord("cat", 0.0, 0.06), TranscriptWord("hat", 0.5, 0.56), TranscriptWord("bat", 1.0, 1.06), TranscriptWord("mat", 1.5, 1.56)]
        analyses = [WordAnalysis(word.word, word.word, 1, [1], []) for word in words]
        summary = compute_summary(compute_bar_metrics(align_words(words, grid, word_analyses=analyses), grid), align_words(words, grid, word_analyses=analyses))
        self.assertGreater(summary.delivery_consistency, 0.0)
        self.assertLessEqual(summary.delivery_consistency, 1.0)
