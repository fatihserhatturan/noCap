from __future__ import annotations

import unittest

from nocap.analysis.flow_metrics import BarMetrics
from nocap.analysis.pocket_metrics import apply_track_pocket_profile, pocket_score


class PocketMetricsTest(unittest.TestCase):
    def test_track_relative_pocket_rewards_consistent_offset(self) -> None:
        bars = [
            BarMetrics(1, 6, 1.5, 0.3, 0.8, pocket_offset=0.11, timing_variance=0.006),
            BarMetrics(2, 6, 1.5, 0.3, 0.8, pocket_offset=0.12, timing_variance=0.005),
            BarMetrics(3, 6, 1.5, 0.3, 0.8, pocket_offset=0.10, timing_variance=0.006),
        ]

        apply_track_pocket_profile(bars)

        self.assertTrue(all(bar.pocket_confidence > 0.85 for bar in bars))
        self.assertTrue(all(bar.pocket_label == "center" for bar in bars))
        self.assertGreater(pocket_score(bars), 0.85)

    def test_loose_bar_is_not_marked_as_confident_pocket(self) -> None:
        bars = [
            BarMetrics(1, 6, 1.5, 0.3, 0.8, pocket_offset=0.02, timing_variance=0.005),
            BarMetrics(2, 6, 1.5, 0.3, 0.8, pocket_offset=0.31, timing_variance=0.08),
        ]

        apply_track_pocket_profile(bars)

        self.assertLess(bars[1].pocket_confidence, 0.45)
        self.assertEqual("loose", bars[1].pocket_label)


if __name__ == "__main__":
    unittest.main()
