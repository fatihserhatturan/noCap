from __future__ import annotations

import unittest

import numpy as np

from nocap.analysis.onset_metrics import compute_onset_metrics
from nocap.audio.beat_grid import Beat, BeatGrid
from nocap.audio.features import OnsetEnvelope


class OnsetMetricsTest(unittest.TestCase):
    def test_aggregates_onset_strength_by_beat_and_bar(self) -> None:
        envelope = OnsetEnvelope(
            times=np.array([0.05, 0.45, 0.55, 0.95, 1.05, 1.45, 1.55, 1.95]),
            strengths=np.array([1.0, 0.1, 0.8, 0.2, 0.0, 0.3, 0.5, 0.1]),
        )
        grid = BeatGrid(120, [Beat(idx * 0.5, (idx % 4) + 1, 1) for idx in range(4)])

        beats, bars = compute_onset_metrics(envelope, grid)

        self.assertEqual([1.0, 0.8, 0.3, 0.5], [beat.strength for beat in beats])
        self.assertEqual(1, len(bars))
        self.assertEqual(1.0, bars[0].onset_density)
        self.assertAlmostEqual(0.65, bars[0].onset_strength_avg)

    def test_empty_envelope_defaults_to_zero(self) -> None:
        grid = BeatGrid(120, [Beat(0.0, 1, 1)])

        beats, bars = compute_onset_metrics(OnsetEnvelope(np.array([]), np.array([])), grid)

        self.assertEqual(0.0, beats[0].strength)
        self.assertEqual(0.0, bars[0].onset_density)
