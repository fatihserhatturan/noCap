from __future__ import annotations

import unittest
from pathlib import Path

import numpy as np

from nocap.analysis.aligner import align_words
from nocap.audio.beat_tracker import apply_bar_offset, apply_detected_downbeat_offset, apply_downbeat_offset, build_from_bpm
from nocap.audio.loader import AudioData
from nocap.audio.separator import assess_vocal_stem
from nocap.audio.transcriber import TranscriptWord
from nocap.text.syllables import WordAnalysis


class BeatsSeparatorTest(unittest.TestCase):
    def test_phase4_bar_offset_updates_aligned_syllable_bars(self) -> None:
        grid = apply_bar_offset(build_from_bpm(120, 3), 2)
        aligned = align_words([TranscriptWord("cat", 0.0, 0.12)], grid, word_analyses=[WordAnalysis("cat", "cat", 1, [1], [])])
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
        self.assertFalse(assess_vocal_stem(vocals, mix).usable)

    def test_vocal_stem_quality_accepts_active_stem(self) -> None:
        t = np.linspace(0, 1, 22050, endpoint=False, dtype=np.float32)
        mix = AudioData(y=np.sin(2 * np.pi * 220 * t).astype(np.float32) * 0.3, sr=22050, duration=1.0, path=Path("mix.wav"))
        vocals = AudioData(y=np.sin(2 * np.pi * 220 * t).astype(np.float32) * 0.12, sr=22050, duration=1.0, path=Path("mix.wav"))
        self.assertTrue(assess_vocal_stem(vocals, mix).usable)
