from __future__ import annotations

import unittest

from nocap.analysis.tempo_metrics import compute_tempo_metrics
from nocap.audio.beat_grid import Beat, BeatGrid


class TempoMetricsTest(unittest.TestCase):
    def test_constant_grid_has_stable_local_tempo(self) -> None:
        grid = BeatGrid(120, [Beat(idx * 0.5, (idx % 4) + 1, 1) for idx in range(4)])

        beats, bars = compute_tempo_metrics(grid)

        self.assertEqual([120.0, 120.0, 120.0, 120.0], [beat.local_bpm for beat in beats])
        self.assertTrue(all(beat.tempo_confidence == 1.0 for beat in beats))
        self.assertEqual(120.0, bars[0].local_bpm)
        self.assertEqual(0.0, bars[0].tempo_variance)

    def test_irregular_grid_lowers_confidence(self) -> None:
        grid = BeatGrid(100, [
            Beat(0.0, 1, 1),
            Beat(0.5, 2, 1),
            Beat(1.2, 3, 1),
            Beat(1.7, 4, 1),
        ])

        beats, bars = compute_tempo_metrics(grid)

        self.assertLess(beats[1].tempo_confidence, 1.0)
        self.assertGreater(bars[0].tempo_variance, 0.0)
