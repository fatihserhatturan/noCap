from __future__ import annotations

import unittest
from pathlib import Path

import numpy as np

from nocap.analysis.aligner import align, align_words
from nocap.analysis.exporter import build_flowmap
from nocap.analysis.flow_metrics import compute_bar_metrics, compute_summary
from nocap.audio.beat_tracker import BeatGrid, build_from_bpm
from nocap.audio.loader import AudioData
from nocap.audio.separator import assess_vocal_stem
from nocap.audio.transcriber import TranscriptWord
from nocap.text.parser import TimedLine, parse
from nocap.text.rhyme import detect
from nocap.text.syllables import analyze_line


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
        flowmap = build_flowmap("smoke", grid, aligned, bars, summary, audio_path="/tmp/track.wav")

        self.assertEqual(2, len(lines))
        self.assertGreater(len(aligned), 0)
        self.assertEqual("/tmp/track.wav", flowmap["metadata"]["audio_path"])

    def test_empty_beat_grid_returns_no_alignment(self) -> None:
        grid = BeatGrid(bpm=90, beats=[])

        self.assertEqual([], align([TimedLine(0, "cat hat")], grid))
        self.assertEqual([], align_words([TranscriptWord("cat", 0, 1)], grid))

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
