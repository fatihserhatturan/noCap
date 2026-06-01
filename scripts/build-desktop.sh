#!/usr/bin/env bash
# Build noCap as a fully self-contained macOS .app + .dmg
#
# Usage:
#   ./scripts/build-desktop.sh              # full build
#   ./scripts/build-desktop.sh --skip-backend   # skip PyInstaller (use existing build/backend)
#   ./scripts/build-desktop.sh --skip-frontend  # skip Vite+electron-builder
#
# Prerequisites (one-time setup already done):
#   - .venv with project deps + openai-whisper installed
#   - Whisper model cached at ~/.cache/whisper/
#   - Node.js + npm installed

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
FRONTEND_DIR="$PROJECT_ROOT/frontend"
VENV_DIR="$PROJECT_ROOT/.venv"
VENV_PYTHON="$VENV_DIR/bin/python3"
BUILD_DIR="$FRONTEND_DIR/build"

SKIP_BACKEND=false
SKIP_FRONTEND=false
for arg in "$@"; do
  case $arg in
    --skip-backend)  SKIP_BACKEND=true ;;
    --skip-frontend) SKIP_FRONTEND=true ;;
  esac
done

echo "▶ noCap desktop build"
echo "  Project : $PROJECT_ROOT"
echo "  Build   : $BUILD_DIR"
echo ""

# ── Sanity checks ─────────────────────────────────────────────────────────────

if [ ! -f "$VENV_PYTHON" ]; then
  echo "✗ .venv not found. Run:"
  echo "    python3 -m venv .venv && source .venv/bin/activate && pip install -e '.[dev]' && pip install openai-whisper"
  exit 1
fi

# ── 1. Copy Whisper model ──────────────────────────────────────────────────────

WHISPER_CACHE="$HOME/.cache/whisper"
WHISPER_OUT="$BUILD_DIR/whisper_models"
mkdir -p "$WHISPER_OUT"

# Pick the best available model (prefer already-cached)
WHISPER_MODEL=""
for name in "medium.en" "medium"; do
  if [ -f "$WHISPER_CACHE/$name.pt" ]; then
    WHISPER_MODEL="$WHISPER_CACHE/$name.pt"
    echo "▶ Whisper model  : $WHISPER_MODEL"
    cp "$WHISPER_MODEL" "$WHISPER_OUT/"
    break
  fi
done

if [ -z "$WHISPER_MODEL" ]; then
  echo "▶ Whisper model not cached — downloading medium.en (~1.5 GB)..."
  "$VENV_PYTHON" -c "import whisper; whisper.load_model('medium.en')"
  cp "$WHISPER_CACHE/medium.en.pt" "$WHISPER_OUT/"
fi

echo "  Whisper model copied to build/whisper_models/"

# ── 2. Build Python backend with PyInstaller ───────────────────────────────────

if [ "$SKIP_BACKEND" = false ]; then
  echo ""
  echo "▶ Building Python backend (PyInstaller — this takes ~10 min first run)..."

  # Ensure PyInstaller is installed
  if ! "$VENV_PYTHON" -m PyInstaller --version &>/dev/null; then
    echo "  Installing PyInstaller..."
    "$VENV_DIR/bin/pip" install pyinstaller --quiet
  fi

  BACKEND_OUT="$BUILD_DIR/backend"
  rm -rf "$BACKEND_OUT/nocap-server"

  cd "$PROJECT_ROOT"
  "$VENV_DIR/bin/pyinstaller" \
    --name nocap-server \
    --onedir \
    --noconfirm \
    --distpath "$BACKEND_OUT" \
    --workpath "/tmp/nocap-pyinstaller-work" \
    --specpath "/tmp/nocap-pyinstaller-spec" \
    --collect-all whisper \
    --collect-all librosa \
    --collect-all numba \
    --collect-all llvmlite \
    --collect-all torch \
    --collect-all torchaudio \
    --collect-all scipy \
    --collect-all sklearn \
    --collect-all soundfile \
    --collect-all pronouncing \
    --collect-all syllables \
    --collect-all cmudict \
    --collect-all tiktoken \
    --collect-all flask \
    --collect-submodules nocap \
    --hidden-import nocap.web.desktop \
    --hidden-import nocap.web.app \
    --hidden-import nocap.web.analysis_routes \
    --hidden-import nocap.web.library_routes \
    --hidden-import nocap.web.media_routes \
    --hidden-import nocap.pipeline.service \
    --hidden-import nocap.audio.transcriber \
    --hidden-import nocap.audio.beat_tracker \
    --hidden-import nocap.audio.separator \
    --hidden-import nocap.analysis.aligner \
    --hidden-import nocap.text.rhyme \
    nocap/web/desktop.py

  echo "  Backend built → $BACKEND_OUT/nocap-server/"
fi

# ── 3. Convert icon PNG → icns (if needed) ────────────────────────────────────

ICON_PNG="$BUILD_DIR/icon.png"
ICON_ICNS="$BUILD_DIR/icon.icns"
if [ -f "$ICON_PNG" ] && [ ! -f "$ICON_ICNS" ]; then
  echo ""
  echo "▶ Converting icon.png → icon.icns"
  ICONSET="$BUILD_DIR/icon.iconset"
  mkdir -p "$ICONSET"
  for size in 16 32 64 128 256 512; do
    sips -z $size $size "$ICON_PNG" --out "$ICONSET/icon_${size}x${size}.png"        >/dev/null
    double=$((size * 2))
    sips -z $double $double "$ICON_PNG" --out "$ICONSET/icon_${size}x${size}@2x.png" >/dev/null
  done
  iconutil -c icns "$ICONSET" -o "$ICON_ICNS"
  rm -rf "$ICONSET"
fi

# ── 4. Build React + Electron, then package ───────────────────────────────────

if [ "$SKIP_FRONTEND" = false ]; then
  echo ""
  echo "▶ Building React app + Electron main process..."
  cd "$FRONTEND_DIR"
  npm install --silent
  npm run desktop:build
fi

echo ""
echo "✓ Build complete!"
echo "  DMG → $FRONTEND_DIR/dist-app/"
