from __future__ import annotations

from dataclasses import dataclass


@dataclass
class AudioContextMetrics:
    beat_onsets: list
    bar_onsets: list
    beat_tempos: list
    bar_tempos: list
    bar_spectral: list
    sections: list


def compute_context_metrics(audio_data, grid, bars) -> AudioContextMetrics:
    beat_onsets, bar_onsets = _onsets(audio_data, grid)
    beat_tempos, bar_tempos = _tempos(grid)
    bar_spectral = _spectral(audio_data, grid)
    sections = _sections(bars, bar_onsets, bar_tempos, bar_spectral)
    return AudioContextMetrics(beat_onsets, bar_onsets, beat_tempos, bar_tempos, bar_spectral, sections)


def _onsets(audio_data, grid):
    if audio_data is None:
        return [], []
    try:
        from nocap.analysis.onset_metrics import compute_onset_metrics
        from nocap.audio.features import onset_envelope
        return compute_onset_metrics(onset_envelope(audio_data.y, audio_data.sr), grid)
    except Exception:
        return [], []


def _tempos(grid):
    from nocap.analysis.tempo_metrics import compute_tempo_metrics
    return compute_tempo_metrics(grid)


def _spectral(audio_data, grid):
    if audio_data is None:
        return []
    try:
        from nocap.analysis.spectral_metrics import compute_spectral_metrics
        from nocap.audio.features import spectral_features
        return compute_spectral_metrics(spectral_features(audio_data.y, audio_data.sr), grid)
    except Exception:
        return []


def _sections(bars, bar_onsets, bar_tempos, bar_spectral):
    from nocap.analysis.section_metrics import compute_section_metrics
    return compute_section_metrics(bars, bar_onsets, bar_tempos, bar_spectral)
