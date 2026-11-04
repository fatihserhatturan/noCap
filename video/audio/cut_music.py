"""Cuts "Hype | Drill Music" by kontraa (Pixabay Content License) into the 30-bar shape of
promo v3, and writes `src/v3/beatmap.json` with its kicks, claps, drops and gaps.

The track is 140 BPM like the edit, with its bar lines from 0.018 s, so whole bars can
be moved without changing the tempo:

Bars 0–3   track bars 12–15: 808 and melody, no hats; a gap before the drop
Bars 4–17  track bars 16–29: the drop, full beat
Bars 18–21 track bars 80–83: breakdown, the 808 drops out; a gap before the drop
Bars 22–27 track bars 87–92: the full beat comes back
Bars 28–29 track bars 128–129: melody only under the logo, then a fade

The track itself is not committed (its license forbids redistributing it on its own).
Download it from https://pixabay.com/music/trap-hype-drill-music-438398/ and run:

usage: python video/audio/cut_music.py path/to/kontraa-hype-drill-music-438398.mp3
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import librosa
import numpy as np
import soundfile as sf

SR = 44100
BPM = 140
BEAT = 60 / BPM
BAR = 4 * BEAT
FIRST_BAR = 0.018  # where the track's bar lines start
BARS = 30
TAIL = 2.4
DROPS = (4, 22)
GAPS = ((3, 3.5), (21, 3.5))  # (bar, beat): silence from here to the next downbeat
FADE = int(0.012 * SR)

# (first bar in the edit, first bar in the track, number of bars)
PLAN = ((0, 12, 4), (4, 16, 14), (18, 80, 4), (22, 87, 6), (28, 128, 2))

VIDEO = Path(__file__).resolve().parents[1]


def track_sample(bar: float) -> int:
    return int(round((FIRST_BAR + bar * BAR) * SR))


def splice(y: np.ndarray) -> np.ndarray:
    """Joins the planned stretches with short crossfades on the bar lines."""
    out = None
    for i, (_, start, n) in enumerate(PLAN):
        extra = int(TAIL * SR) if i == len(PLAN) - 1 else FADE
        part = y[:, track_sample(start) : track_sample(start + n) + extra]
        if out is None:
            out = part.copy()
            continue
        w = np.linspace(0, 1, FADE)
        joint = out[:, -FADE:] * (1 - w) + part[:, :FADE] * w
        out = np.concatenate([out[:, :-FADE], joint, part[:, FADE:]], axis=1)
    return out


def shape(out: np.ndarray) -> np.ndarray:
    """Gaps before the drops, a click-free start, the tail faded out, peak at -1 dBFS."""
    for bar, beat in GAPS:
        a, b = int(round((bar * BAR + beat * BEAT) * SR)), int(round((bar + 1) * BAR * SR))
        ramp = int(0.02 * SR)
        env = np.zeros(b - a)
        env[:ramp] = np.linspace(1, 0, ramp)
        out[:, a:b] *= env
    out[:, :220] *= np.linspace(0, 1, 220)
    n = int(TAIL * SR)
    out[:, -n:] *= np.linspace(1, 0, n) ** 2
    return out * (10 ** (-1 / 20) / np.abs(out).max())


def hits(mono: np.ndarray, lo: float, hi: float, threshold: float) -> list[float]:
    """Onset times (s) of strong hits in a frequency band, for the visual pulses."""
    hop = 256
    spec = np.abs(librosa.stft(mono, n_fft=2048, hop_length=hop))
    freqs = librosa.fft_frequencies(sr=SR, n_fft=2048)
    band = librosa.amplitude_to_db(spec[(freqs >= lo) & (freqs < hi)] + 1e-9).mean(0)
    rise = np.maximum(0, np.diff(band, prepend=band[0]))
    peaks = librosa.util.peak_pick(rise, pre_max=8, post_max=8, pre_avg=30, post_avg=30, delta=threshold, wait=20)
    times = librosa.frames_to_time(peaks, sr=SR, hop_length=hop)
    return [round(float(t), 4) for t in times if t < BARS * BAR]


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    y, _ = librosa.load(sys.argv[1], sr=SR, mono=False)
    out = shape(splice(y))
    sf.write(VIDEO / "public" / "audio" / "music.wav", out.T, SR, subtype="PCM_16")
    mono = out.mean(0)
    beatmap = {
        "bpm": BPM,
        "bars": BARS,
        "kicks": hits(mono, 30, 120, 4.0),
        "claps": hits(mono, 1500, 4000, 9.0),
        "drops": [round(d * BAR, 4) for d in DROPS],
        "gaps": [round(b * BAR + beat * BEAT, 4) for b, beat in GAPS],
    }
    (VIDEO / "src" / "v3" / "beatmap.json").write_text(json.dumps(beatmap, indent=1) + "\n")
    print(f"music.wav: {out.shape[1] / SR:.2f} s, {len(beatmap['kicks'])} kicks, {len(beatmap['claps'])} claps")


if __name__ == "__main__":
    main()
