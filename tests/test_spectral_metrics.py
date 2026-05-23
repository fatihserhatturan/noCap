from __future__ import annotations

import unittest

import numpy as np

from nocap.analysis.spectral_metrics import compute_spectral_metrics
from nocap.audio.beat_grid import Beat, BeatGrid
from nocap.audio.features import SpectralFeatures


class SpectralMetricsTest(unittest.TestCase):
    def test_aggregates_spectral_context_by_bar(self) -> None:
        features = SpectralFeatures(
            times=np.array([0.1, 0.4, 0.6, 0.9, 1.1, 1.4, 1.6, 1.9]),
            rms=np.array([0.2, 0.4, 0.6, 0.8, 0.3, 0.5, 0.7, 0.9]),
            spectral_centroid=np.array([100, 200, 300, 400, 500, 600, 700, 800]),
            spectral_bandwidth=np.array([50, 60, 70, 80, 90, 100, 110, 120]),
            zero_crossing_rate=np.array([0.01, 0.02, 0.03, 0.04, 0.05, 0.06, 0.07, 0.08]),
        )
        grid = BeatGrid(120, [
            Beat(0.0, 1, 1),
            Beat(0.5, 2, 1),
            Beat(1.0, 1, 2),
            Beat(1.5, 2, 2),
        ], time_signature=2)

        bars = compute_spectral_metrics(features, grid)

        self.assertEqual([1, 2], [bar.bar_no for bar in bars])
        self.assertEqual(0.5, bars[0].rms_avg)
        self.assertEqual(250.0, bars[0].spectral_centroid_avg)
        self.assertEqual(65.0, bars[0].spectral_bandwidth_avg)
        self.assertEqual(0.025, bars[0].zero_crossing_rate_avg)


if __name__ == "__main__":
    unittest.main()
