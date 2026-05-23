from __future__ import annotations

import unittest

from nocap.analysis.flow_metrics import BarMetrics
from nocap.analysis.onset_metrics import BarOnset
from nocap.analysis.section_metrics import compute_section_metrics
from nocap.analysis.spectral_metrics import BarSpectral
from nocap.analysis.tempo_metrics import BarTempo


class SectionMetricsTest(unittest.TestCase):
    def test_groups_bars_into_conservative_sections(self) -> None:
        bars = [BarMetrics(idx, 4, 2.0, 0.25, 0.5, syncopation_score=0.25) for idx in range(1, 11)]
        onsets = [BarOnset(idx, 1.0, 0.4, 0.4) for idx in range(1, 11)]
        tempos = [BarTempo(idx, 90.0, 0.0, 0.9) for idx in range(1, 11)]
        spectral = [BarSpectral(idx, 0.5, 1000.0, 500.0, 0.05) for idx in range(1, 11)]

        sections = compute_section_metrics(bars, onsets, tempos, spectral)

        self.assertEqual(["section_1", "section_2"], [section.id for section in sections])
        self.assertEqual((1, 8), (sections[0].start_bar, sections[0].end_bar))
        self.assertEqual((9, 10), (sections[1].start_bar, sections[1].end_bar))
        self.assertEqual(2.0, sections[0].avg_density)
        self.assertEqual(90.0, sections[0].local_bpm)
        self.assertEqual(0.5, sections[0].rms_avg)
        self.assertEqual(1000.0, sections[0].spectral_centroid_avg)

    def test_empty_bars_return_no_sections(self) -> None:
        self.assertEqual([], compute_section_metrics([]))
