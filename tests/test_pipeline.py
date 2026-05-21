from __future__ import annotations

import unittest
from pathlib import Path

import numpy as np

from nocap.analysis.aligner import align, align_words
from nocap.analysis.exporter import build_flowmap
from nocap.analysis.flow_metrics import compute_bar_metrics, compute_summary
from nocap.audio.beat_tracker import (
    BeatGrid,
    apply_bar_offset,
    apply_detected_downbeat_offset,
    apply_downbeat_offset,
    build_from_bpm,
)
from nocap.audio.loader import AudioData
from nocap.audio.separator import assess_vocal_stem
from nocap.audio.transcriber import TranscriptResult, TranscriptWord, require_word_timestamps
from nocap.text.parser import TimedLine, parse
from nocap.text.rhyme import classify_pair, detect
from nocap.text.syllables import WordAnalysis, analyze_line


class PipelineTest(unittest.TestCase):
    def test_lrc_pipeline_builds_flowmap(self) -> None:
        lines = parse("[00:00.00]cat hat\n[00:02.00]bat mat\n")
        grid = build_from_bpm(120, 4)

        words = []
        for line in lines:
            words.extend(analyze_line(line.text))

        aligned = align(lines, grid, detect(words), words)
        bars = compute_bar_metrics(aligned, grid)
        summary = compute_summary(bars, aligned)
        flowmap = build_flowmap(
            "smoke",
            grid,
            aligned,
            bars,
            summary,
            audio_path="/tmp/track.wav",
            duration=4.25,
        )

        self.assertEqual(2, len(lines))
        self.assertGreater(len(aligned), 0)
        self.assertEqual("/tmp/track.wav", flowmap["metadata"]["audio_path"])
        self.assertEqual(4.25, flowmap["metadata"]["duration"])
        self.assertEqual(2, flowmap["schema_version"])

    def test_empty_beat_grid_returns_no_alignment(self) -> None:
        grid = BeatGrid(bpm=90, beats=[])

        self.assertEqual([], align([TimedLine(0, "cat hat")], grid))
        self.assertEqual([], align_words([TranscriptWord("cat", 0, 1)], grid))

    def test_word_timestamps_are_required_for_v2_timing(self) -> None:
        result = TranscriptResult(text="hello", language="en", timed_lines=[TimedLine(0, "hello")])

        with self.assertRaisesRegex(ValueError, "word-level timestamps required for v2 timing"):
            require_word_timestamps(result)

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

        first_duration = aligned[0].end - aligned[0].start
        second_duration = aligned[1].end - aligned[1].start
        self.assertGreater(second_duration, first_duration)
        self.assertTrue(aligned[1].stress)

    def test_v2_metrics_score_onbeat_lower_than_offbeat(self) -> None:
        grid = build_from_bpm(120, 2)
        onbeat = align_words([TranscriptWord("cat", 0.0, 0.06)], grid, word_analyses=[
            WordAnalysis("cat", "cat", 1, [1], []),
        ])
        offbeat = align_words([TranscriptWord("cat", 0.22, 0.28)], grid, word_analyses=[
            WordAnalysis("cat", "cat", 1, [1], []),
        ])

        onbeat_metrics = compute_bar_metrics(onbeat, grid)[0]
        offbeat_metrics = compute_bar_metrics(offbeat, grid)[0]

        self.assertLess(onbeat_metrics.syncopation_score, offbeat_metrics.syncopation_score)

    def test_v2_syncopation_scores_weak_subdivisions(self) -> None:
        grid = build_from_bpm(120, 2)
        eighth = align_words([TranscriptWord("cat", 0.0325, 0.0925)], grid, word_analyses=[
            WordAnalysis("cat", "cat", 1, [1], []),
        ])
        sixteenth = align_words([TranscriptWord("cat", 0.06375, 0.12375)], grid, word_analyses=[
            WordAnalysis("cat", "cat", 1, [1], []),
        ])

        eighth_metrics = compute_bar_metrics(eighth, grid)[0]
        sixteenth_metrics = compute_bar_metrics(sixteenth, grid)[0]

        self.assertGreaterEqual(eighth_metrics.syncopation_score, 0.5)
        self.assertGreaterEqual(sixteenth_metrics.syncopation_score, 0.4)

    def test_v2_summary_includes_delivery_consistency(self) -> None:
        grid = build_from_bpm(120, 4)
        words = [
            TranscriptWord("cat", 0.0, 0.06),
            TranscriptWord("hat", 0.5, 0.56),
            TranscriptWord("bat", 1.0, 1.06),
            TranscriptWord("mat", 1.5, 1.56),
        ]
        analyses = [WordAnalysis(word.word, word.word, 1, [1], []) for word in words]
        aligned = align_words(words, grid, word_analyses=analyses)
        bars = compute_bar_metrics(aligned, grid)
        summary = compute_summary(bars, aligned)

        self.assertGreater(summary.delivery_consistency, 0.0)
        self.assertLessEqual(summary.delivery_consistency, 1.0)

    def test_v2_rhyme_groups_include_english_multisyllable_rhyme(self) -> None:
        words = [
            TranscriptWord("time", 0.0, 0.2),
            TranscriptWord("rhyme", 0.5, 0.7),
            TranscriptWord("nation", 1.0, 1.35),
            TranscriptWord("patience", 1.5, 1.85),
        ]
        analyses = [analyze_line(word.word)[0] for word in words]
        labels = detect(analyses)
        grid = build_from_bpm(120, 3)
        aligned = align_words(words, grid, labels, analyses)
        bars = compute_bar_metrics(aligned, grid)
        summary = compute_summary(bars, aligned)

        flowmap = build_flowmap("rhymes", grid, aligned, bars, summary, transcript_words=words, word_analyses=analyses)

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
        words = [
            TranscriptWord("cat", 0.0, 0.12),
            TranscriptWord("bit", 0.25, 0.37),
            TranscriptWord("flow", 2.0, 2.15),
        ]
        analyses = [analyze_line(word.word)[0] for word in words]
        labels = detect(analyses)
        grid = build_from_bpm(120, 3)
        aligned = align_words(words, grid, labels, analyses)
        bars = compute_bar_metrics(aligned, grid)
        summary = compute_summary(bars, aligned)

        flowmap = build_flowmap("internal", grid, aligned, bars, summary, transcript_words=words, word_analyses=analyses)

        self.assertTrue(any(
            group["type"] == "slant" and group["placement"] == "internal"
            for group in flowmap["rhyme_groups"]
        ))

    def test_phase4_forced_bpm_keeps_synthetic_beat_source(self) -> None:
        grid = build_from_bpm(100, 3)
        aligned = align_words([TranscriptWord("cat", 0.0, 0.12)], grid, word_analyses=[
            WordAnalysis("cat", "cat", 1, [1], []),
        ])
        bars = compute_bar_metrics(aligned, grid)
        summary = compute_summary(bars, aligned)

        flowmap = build_flowmap("forced", grid, aligned, bars, summary)

        self.assertEqual(100, flowmap["metadata"]["bpm"])
        self.assertEqual("synthetic", flowmap["beats"][0]["source"])
        self.assertEqual(1.0, flowmap["beats"][0]["downbeat_confidence"])

    def test_phase4_bar_offset_updates_aligned_syllable_bars(self) -> None:
        grid = apply_bar_offset(build_from_bpm(120, 3), 2)

        aligned = align_words([TranscriptWord("cat", 0.0, 0.12)], grid, word_analyses=[
            WordAnalysis("cat", "cat", 1, [1], []),
        ])

        self.assertEqual(3, grid.beats[0].bar_no)
        self.assertEqual(3, aligned[0].bar_no)

    def test_phase4_low_confidence_downbeat_offset_is_not_applied(self) -> None:
        grid = build_from_bpm(120, 3)

        unchanged = apply_detected_downbeat_offset(grid, beat_offset=1, confidence=0.4)
        changed = apply_downbeat_offset(grid, beat_offset=1)

        self.assertEqual([beat.beat_no for beat in grid.beats], [beat.beat_no for beat in unchanged.beats])
        self.assertNotEqual([beat.beat_no for beat in grid.beats], [beat.beat_no for beat in changed.beats])

    def test_vocal_stem_quality_rejects_near_empty_stem(self) -> None:
        mix = AudioData(y=np.ones(22050, dtype=np.float32) * 0.2, sr=22050, duration=1.0, path=Path("mix.wav"))
        vocals = AudioData(y=np.zeros(22050, dtype=np.float32), sr=22050, duration=1.0, path=Path("mix.wav"))

        quality = assess_vocal_stem(vocals, mix)

        self.assertFalse(quality.usable)

    def test_vocal_stem_quality_accepts_active_stem(self) -> None:
        t = np.linspace(0, 1, 22050, endpoint=False, dtype=np.float32)
        mix = AudioData(y=np.sin(2 * np.pi * 220 * t).astype(np.float32) * 0.3, sr=22050, duration=1.0, path=Path("mix.wav"))
        vocals = AudioData(y=np.sin(2 * np.pi * 220 * t).astype(np.float32) * 0.12, sr=22050, duration=1.0, path=Path("mix.wav"))

        quality = assess_vocal_stem(vocals, mix)

        self.assertTrue(quality.usable)


if __name__ == "__main__":
    unittest.main()
