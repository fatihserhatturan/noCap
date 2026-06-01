<p align="center">
  <img src="source/logo-transparent.png" width="120" alt="noCap" />
</p>

<h1 align="center">noCap</h1>

<p align="center">
  A hip-hop flow & rhythm analyzer that maps every syllable to the beat grid —
  with real-time visualization, rhyme detection, and deep timing metrics.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/platform-macOS-lightgrey?logo=apple" alt="platform" />
  <img src="https://img.shields.io/badge/python-3.10+-blue?logo=python" alt="python" />
  <img src="https://img.shields.io/badge/license-MIT-green" alt="license" />
</p>

---

## What is noCap?

noCap takes an audio file, isolates the vocals, transcribes every word with
word-level timestamps, and aligns each syllable to a beat grid. The result is
an interactive **flow map** — a piano-roll-style canvas where you can see and
hear exactly how a rapper rides the beat.

**It answers questions like:**
- How dense is the flow? (syllables per beat)
- How much syncopation is there?
- Is the delivery ahead, on, or behind the pocket?
- Where do the rhyme chains land on the grid?

---

## Features

- **Beat detection** — BPM and beat grid from the raw waveform (librosa)
- **Vocal separation** — Demucs stem isolation for cleaner transcription
- **Speech recognition** — OpenAI Whisper with word-level timestamps
- **Syllable alignment** — CMU Pronouncing Dictionary for stress patterns
- **Flow metrics** — density, syncopation, pocket, timing variance per bar
- **Rhyme detection** — phonetic matching across perfect, slant, and internal rhymes
- **Interactive visualization** — WebGL canvas (Pixi.js), hover tooltips, click-to-play
- **Library** — save and re-open analyzed tracks
- **macOS desktop app** — self-contained Electron + PyInstaller bundle (no setup required)

---

## Getting Started

### Prerequisites

- Python 3.10+
- Node.js 20+

### Development

```bash
# 1. Clone
git clone https://github.com/your-org/nocap.git
cd nocap

# 2. Python environment
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev,separator]"
pip install openai-whisper

# 3. Frontend dependencies
cd frontend && npm install && cd ..

# 4. Run (Flask API + Vite dev server + Electron window)
cd frontend && npm run desktop:dev
```

The first time you analyze a track, Whisper will download the `medium.en`
model (~1.5 GB) into `~/.cache/whisper/`. Subsequent runs use the cache.

### Web-only mode (no Electron)

```bash
# Terminal 1 — backend
source .venv/bin/activate && nocap serve

# Terminal 2 — frontend
cd frontend && npm run dev
```

Open `http://localhost:8765`.

---

## Building the macOS App

Produces a self-contained `.dmg` that requires no Python or model installation
on the target machine.

```bash
./scripts/build-desktop.sh
# → frontend/dist-app/noCap-0.1.0-arm64.dmg  (Apple Silicon)
# → frontend/dist-app/noCap-0.1.0.dmg         (Intel)
```

First build takes ~15 minutes (PyInstaller bundles torch + whisper + demucs).
Subsequent builds that skip the backend are much faster:

```bash
./scripts/build-desktop.sh --skip-backend
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop shell | Electron 33 |
| Frontend | React 19, TypeScript, Pixi.js 8, Vite 6 |
| Backend | Python / Flask 3 |
| Beat detection | librosa 0.11 |
| Transcription | openai-whisper (medium.en) |
| Vocal separation | Demucs 4 (htdemucs) |
| Syllable/stress | CMU Pronouncing Dictionary |
| Packaging | PyInstaller + electron-builder |

---

## Project Structure

```
nocap/
├── frontend/src/        # React UI — components, hooks, Pixi rendering
├── nocap/audio/         # Beat detection, transcription, vocal separation
├── nocap/analysis/      # Flow metrics, alignment, rhyme detection
├── nocap/pipeline/      # Orchestration layer
├── nocap/web/           # Flask API + SSE streaming
├── nocap/text/          # Lyric parsing, syllable analysis
├── nocap/library/       # Track persistence
└── scripts/             # Build automation
```

All source files are kept under 200 lines — see `CODE_QUALITY.md`.

---

## Development Checks

```bash
python3 -m unittest -q
python3 scripts/check_line_limits.py
cd frontend && npm run typecheck && npm run build
```

---

