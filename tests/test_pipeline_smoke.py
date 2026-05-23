from __future__ import annotations

import unittest

from nocap.analysis.aligner import align, align_words
from nocap.analysis.exporter import build_flowmap
from nocap.analysis.flow_metrics import compute_bar_metrics, compute_summary
from nocap.audio.beat_tracker import BeatGrid, build_from_bpm
from nocap.audio.transcriber import TranscriptResult, TranscriptWord, require_word_timestamps
from nocap.text.parser import TimedLine, parse
from nocap.text.rhyme import detect
from nocap.text.syllables import analyze_line


class PipelineSmokeTest(unittest.TestCase):
    def test_lrc_pipeline_builds_flowmap(self) -> None:
        lines = parse("[00:00.00]cat hat\n[00:02.00]bat mat\n")
        grid = build_from_bpm(120, 4)
        words = [word for line in lines for word in analyze_line(line.text)]
        aligned = align(lines, grid, detect(words), words)
        bars = compute_bar_metrics(aligned, grid)
        summary = compute_summary(bars, aligned)
        flowmap = build_flowmap("smoke", grid, aligned, bars, summary, audio_path="/tmp/track.wav", duration=4.25)

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
