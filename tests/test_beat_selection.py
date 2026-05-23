from __future__ import annotations

import unittest

from nocap.analysis.beat_selection import select_best_grid
from nocap.audio.beat_grid import Beat, BeatGrid


class BeatSelectionTest(unittest.TestCase):
    def test_selects_higher_confidence_grid(self) -> None:
        mix = _grid("mix", 0.55, 4)
        percussive = _grid("percussive", 0.9, 4)

        selected = select_best_grid([mix, percussive])

        self.assertIsNotNone(selected)
        self.assertEqual("percussive", selected.beats[0].source)

    def test_uses_beat_count_as_tiebreaker(self) -> None:
        short = _grid("mix", 0.8, 2)
        long = _grid("percussive", 0.8, 4)

        selected = select_best_grid([short, long])

        self.assertEqual(4, len(selected.beats))

    def test_empty_candidates_return_none(self) -> None:
        self.assertIsNone(select_best_grid([BeatGrid(90, [])]))


def _grid(source: str, confidence: float, count: int) -> BeatGrid:
    return BeatGrid(
        bpm=90,
        beats=[
            Beat(time=float(idx), beat_no=(idx % 4) + 1, bar_no=(idx // 4) + 1, confidence=confidence, source=source)
            for idx in range(count)
        ],
    )
