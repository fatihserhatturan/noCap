from __future__ import annotations

import functools
import json
import os
import re
import shutil
import subprocess
import tempfile
import wave
from dataclasses import dataclass, field
from pathlib import Path

from nocap.i18n import msg
from nocap.audio.loader import AudioData
from nocap.text.parser import TimedLine


@dataclass
class TranscriptWord:
    word: str
    start: float    # seconds
    end: float      # seconds
    probability: float = 1.0


@dataclass
class TranscriptResult:
    text: str
    language: str
    # segment-level lines (always populated)
    timed_lines: list[TimedLine]
    # word-level timestamps emitted by whisper.cpp JSON output
    words: list[TranscriptWord] = field(default_factory=list)

    @property
    def has_word_timestamps(self) -> bool:
        return len(self.words) > 0


def require_word_timestamps(result: TranscriptResult) -> None:
    if not result.has_word_timestamps:
        raise ValueError(msg("audio.needWordTimestamps"))


DEFAULT_WHISPER_CPP_MODEL = "medium.en"
DEFAULT_WHISPER_CPP_MODEL_PATH = (
    Path(__file__).resolve().parents[2]
    / "vendor"
    / "whisper.cpp"
    / "models"
    / "ggml-medium.en.bin"
)

HIP_HOP_PROMPT = None  # prompt causes hallucination on vocal stems; omit


def transcribe(
    audio: AudioData,
    language: str | None = None,
    progress_callback=None,
    initial_prompt: str | None = None,
    beam_size: int = 5,
    temperature: float = 0.0,
    whisper_progress_callback=None,
) -> TranscriptResult:
    if progress_callback:
        progress_callback(msg("audio.loadingWhisperModel"))
    if progress_callback:
        progress_callback(msg("audio.transcribing"))

    audio_arr = _resample_to_16k(audio)

    # Prefer openai-whisper (PyTorch) when available: it uses cross-attention DTW
    # for word_timestamps, giving ~10 ms accuracy.  whisper.cpp timestamps are
    # quantised to 20 ms and its -dtw flag has known reliability bugs (t_dtw = -1).
    try:
        result = _run_openai_whisper(
            audio_arr,
            language=language,
            initial_prompt=initial_prompt,
            beam_size=beam_size,
            temperature=temperature,
        )
    except ImportError:
        result = _run_whisper_cpp(
            audio_arr,
            language=language,
            initial_prompt=initial_prompt,
            beam_size=beam_size,
            temperature=temperature,
            whisper_progress_callback=whisper_progress_callback,
        )

    words = _filter_words(_extract_words(result))
    timed_lines = _segments_to_timed_lines(result)

    return TranscriptResult(
        text=result.get("text", "").strip(),
        language=result.get("language", "en"),
        timed_lines=timed_lines,
        words=words,
    )


def words_to_timed_lines(words: list[TranscriptWord], pause_threshold: float = 0.6) -> list[TimedLine]:
    """Group word-level timestamps into lyric lines by detecting pauses."""
    if not words:
        return []

    lines: list[TimedLine] = []
    current_words: list[TranscriptWord] = [words[0]]

    for w in words[1:]:
        gap = w.start - current_words[-1].end
        if gap > pause_threshold:
            lines.append(TimedLine(
                start=round(current_words[0].start, 3),
                text=" ".join(cw.word for cw in current_words),
            ))
            current_words = [w]
        else:
            current_words.append(w)

    if current_words:
        lines.append(TimedLine(
            start=round(current_words[0].start, 3),
            text=" ".join(cw.word for cw in current_words),
        ))

    return lines


# ── Audio resampling ─────────────────────────────────────────────────────────

def _resample_to_16k(audio: AudioData):
    """Return a float32 numpy array at 16 kHz (Whisper's required rate)."""
    import numpy as np
    WHISPER_SR = 16000
    if audio.sr == WHISPER_SR:
        return audio.y.astype(np.float32)
    try:
        import librosa
        return librosa.resample(audio.y, orig_sr=audio.sr, target_sr=WHISPER_SR).astype(np.float32)
    except ImportError:
        # naive linear interpolation fallback
        import math
        ratio = WHISPER_SR / audio.sr
        n_out = int(len(audio.y) * ratio)
        indices = np.linspace(0, len(audio.y) - 1, n_out)
        return np.interp(indices, np.arange(len(audio.y)), audio.y).astype(np.float32)


# ── Internal helpers ──────────────────────────────────────────────────────────

def _run_openai_whisper(
    audio_arr,
    *,
    language: str | None,
    initial_prompt: str | None,
    beam_size: int,
    temperature: float,
) -> dict:
    """Transcribe using openai-whisper (PyTorch) with DTW word timestamps."""
    import whisper  # raises ImportError if not installed → falls back to whisper.cpp

    device = _torch_device()
    # Use cached medium.pt (multilingual); fall back to downloading medium.en if needed
    model_name = _openai_whisper_model_name()
    model = whisper.load_model(model_name, device=device)

    raw = whisper.transcribe(
        model,
        audio_arr,
        language=language,
        word_timestamps=True,
        initial_prompt=initial_prompt,
        beam_size=beam_size,
        temperature=temperature,
        verbose=False,
    )

    segments = []
    for seg in raw.get("segments", []):
        words = [
            {
                "word": w.get("word", "").strip(),
                "start": float(w.get("start", 0.0)),
                "end": float(w.get("end", 0.0)),
                "probability": float(w.get("probability", 1.0)),
            }
            for w in seg.get("words", [])
        ]
        segments.append({
            "text": seg.get("text", "").strip(),
            "start": float(seg.get("start", 0.0)),
            "end": float(seg.get("end", 0.0)),
            "words": words,
        })

    return {
        "text": raw.get("text", "").strip(),
        "language": raw.get("language", "en"),
        "segments": segments,
    }


@functools.lru_cache(maxsize=None)
def _openai_whisper_model_name() -> str:
    """Return the model name to use for openai-whisper (prefers already-cached models)."""
    import os
    cache_dir = Path(os.path.expanduser("~/.cache/whisper"))
    # Prefer English-only medium for speed; fall back to multilingual medium if cached
    for name in ("medium.en", "medium"):
        pt = cache_dir / f"{name}.pt"
        if pt.exists():
            return name
    return "medium.en"  # will be downloaded if missing


@functools.lru_cache(maxsize=None)
def _torch_device() -> str:
    # MPS (Apple Silicon) is intentionally skipped: openai-whisper internally
    # creates float64 tensors which MPS does not support, causing a runtime error.
    try:
        import torch
        if torch.cuda.is_available():
            return "cuda"
    except ImportError:
        pass
    return "cpu"


def _run_whisper_cpp(
    audio_arr,
    *,
    language: str | None,
    initial_prompt: str | None,
    beam_size: int,
    temperature: float,
    whisper_progress_callback=None,
) -> dict:
    model_path = _resolve_model_path()
    binary = _resolve_whisper_cpp_binary()

    with tempfile.TemporaryDirectory(prefix="nocap-whisper-cpp-") as tmp_dir:
        tmp_path = Path(tmp_dir)
        wav_path = tmp_path / "input.wav"
        output_base = tmp_path / "transcript"
        _write_wav_16k(wav_path, audio_arr)

        cmd = [
            str(binary),
            "-m", str(model_path),
            "-f", str(wav_path),
            "-l", language or "en",
            "-ojf",
            "-of", str(output_base),
            "-ml", "1",
            "-bs", str(beam_size),
            "-tp", str(temperature),
            "-sns",
        ]
        if initial_prompt:
            cmd.extend(["--prompt", initial_prompt])

        # Add DTW-based word timestamps when the binary supports it.
        # -dtw MODEL enables cross-attention DTW alignment (≈10 ms accuracy vs 20 ms
        # quantized from plain -ml 1), matching what openai/whisper word_timestamps=True does.
        dtw_name = _dtw_model_name(model_path)
        if dtw_name and _check_dtw_support(str(binary)):
            cmd.extend(["-dtw", dtw_name])

        ok, details = _stream_whisper_subprocess(cmd, whisper_progress_callback)
        if not ok and "ggml_metal_buffer_init" in details:
            ok, details = _stream_whisper_subprocess([*cmd, "-ng"], None)
        if not ok:
            raise RuntimeError(msg("audio.whisperCppFailed", error=details))

        json_path = output_base.with_suffix(".json")
        if not json_path.exists():
            raise RuntimeError(msg("audio.whisperCppNoOutput", path=json_path))
        with json_path.open("r", encoding="utf-8") as f:
            return _normalize_whisper_cpp_json(json.load(f))


@functools.lru_cache(maxsize=None)
def _check_dtw_support(binary_str: str) -> bool:
    """Return True if the binary supports the -dtw flag (result cached per binary path)."""
    try:
        result = subprocess.run(
            [binary_str, "--help"],
            capture_output=True, text=True, timeout=10,
        )
        return "dtw" in (result.stdout + result.stderr).lower()
    except Exception:
        return False


def _dtw_model_name(model_path: Path) -> str | None:
    """Derive model name for -dtw flag from a standard ggml filename.

    ``ggml-medium.en.bin`` → ``"medium.en"``
    Returns None for unrecognised filenames so DTW is silently skipped.
    """
    stem = model_path.stem  # e.g. "ggml-medium.en"
    if stem.startswith("ggml-"):
        return stem[5:]
    return None


def _stream_whisper_subprocess(cmd: list[str], progress_callback) -> tuple[bool, str]:
    """Run whisper.cpp and stream progress percentages from stderr in real time."""
    import threading

    proc = subprocess.Popen(
        cmd,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.PIPE,
        text=True,
    )
    stderr_lines: list[str] = []

    def _read_stderr() -> None:
        assert proc.stderr is not None
        for line in proc.stderr:
            stderr_lines.append(line)
            if progress_callback:
                m = re.search(r'progress\s*=\s*(\d+)\s*%', line)
                if m:
                    progress_callback(int(m.group(1)))

    reader = threading.Thread(target=_read_stderr, daemon=True)
    reader.start()
    proc.wait()
    reader.join(timeout=5)
    details = "".join(stderr_lines).strip()
    return proc.returncode == 0, details


def _resolve_model_path() -> Path:
    env_path = os.environ.get("NOCAP_WHISPER_CPP_MODEL")
    if env_path and Path(env_path).expanduser().exists():
        return Path(env_path).expanduser().resolve()

    model_path = DEFAULT_WHISPER_CPP_MODEL_PATH
    if model_path.exists():
        return model_path.resolve()

    raise FileNotFoundError(msg("audio.needWhisperCppModel", path=model_path))


def _resolve_whisper_cpp_binary() -> Path:
    env_path = os.environ.get("NOCAP_WHISPER_CPP_BIN")
    path_binary = shutil.which("whisper-cli") or shutil.which("whisper-cpp") or shutil.which("whispercpp")
    candidates = [
        Path(env_path).expanduser() if env_path else None,
        Path(__file__).resolve().parents[2] / "vendor" / "whisper.cpp" / "build" / "bin" / "whisper-cli",
        Path(path_binary) if path_binary else None,
    ]
    for candidate in candidates:
        if candidate and candidate.exists() and os.access(candidate, os.X_OK):
            return candidate.resolve()
    raise FileNotFoundError(msg("audio.needWhisperCpp"))


def _write_wav_16k(path: Path, audio_arr) -> None:
    import numpy as np

    clipped = np.clip(audio_arr, -1.0, 1.0)
    pcm = (clipped * 32767.0).astype(np.int16)
    with wave.open(str(path), "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(16000)
        wav.writeframes(pcm.tobytes())


def _normalize_whisper_cpp_json(data: dict) -> dict:
    transcription = data.get("transcription", [])
    segments = []
    for item in transcription:
        text = item.get("text", "").strip()
        if _is_special_token_text(text):
            text = ""
        start = _seconds_from_whisper_cpp_item(item, "from")
        end = _seconds_from_whisper_cpp_item(item, "to")
        segment = {"text": text, "start": start, "end": end}
        if _is_word_text(text):
            word = _item_word(item, text, start, end)
            segment["words"] = [word]
        segments.append(segment)

    return {
        "text": " ".join(seg["text"] for seg in segments if seg.get("text")).strip(),
        "language": data.get("result", {}).get("language", "en"),
        "segments": segments,
    }


def _item_word(item: dict, text: str, start: float, end: float) -> dict:
    token = _first_word_token(item)
    probability = float(token.get("p", 1.0)) if token else 1.0

    # Prefer DTW-aligned start when available — it is derived from cross-attention
    # alignment and gives ≈10 ms accuracy vs 20 ms-quantized segment boundaries.
    dtw_start = _token_dtw_start(token) if token else None
    if dtw_start is not None and 0.0 <= dtw_start <= end + 1.0:
        start = dtw_start

    token_end = _token_end(token) if token else None
    if token_end is not None and token_end > start + 0.02:
        end = min(end, token_end)
    return {"word": text, "start": start, "end": end, "probability": probability}


def _first_word_token(item: dict) -> dict | None:
    for token in item.get("tokens", []):
        text = token.get("text", "").strip()
        if _is_word_text(text):
            return token
    return None


def _token_end(token: dict | None) -> float | None:
    if not token:
        return None
    timestamps = token.get("timestamps")
    if not timestamps:
        return None
    return _seconds_from_timestamp(timestamps.get("to", "0"))


def _token_dtw_start(token: dict | None) -> float | None:
    """Return DTW-aligned token start in seconds, or None if unavailable.

    whisper.cpp stores ``t_dtw`` as a raw centisecond integer (10 ms/unit),
    the same internal unit as ``t0`` / ``t1`` before they are scaled to ms in
    the ``offsets`` field.  A negative value (-1) means DTW was not computed.
    """
    if not token:
        return None
    t_dtw = token.get("t_dtw")
    if t_dtw is None:
        return None
    val = int(t_dtw)
    if val < 0:
        return None
    return val / 100.0  # centiseconds → seconds


def _seconds_from_whisper_cpp_item(item: dict, key: str) -> float:
    offsets = item.get("offsets", {})
    if key in offsets:
        return float(offsets[key]) / 1000.0
    timestamps = item.get("timestamps", {})
    return _seconds_from_timestamp(timestamps.get(key, "0"))


def _is_special_token_text(text: str) -> bool:
    return bool(re.fullmatch(r"\[[A-Z0-9_ -]+\]", text))


def _is_word_text(text: str) -> bool:
    return bool(text and not _is_special_token_text(text) and re.search(r"[A-Za-z0-9']", text))


def _seconds_from_timestamp(value: str) -> float:
    value = value.replace(",", ".")
    parts = value.split(":")
    if len(parts) == 3:
        hours, minutes, seconds = parts
        return int(hours) * 3600 + int(minutes) * 60 + float(seconds)
    if len(parts) == 2:
        minutes, seconds = parts
        return int(minutes) * 60 + float(seconds)
    return float(value or 0)


def _extract_words(result: dict) -> list[TranscriptWord]:
    words: list[TranscriptWord] = []
    for seg in result.get("segments", []):
        for w in seg.get("words", []):
            text = w.get("word", "").strip()
            if not text:
                continue
            words.append(TranscriptWord(
                word=text,
                start=float(w.get("start", 0.0)),
                end=float(w.get("end", 0.0)),
                probability=float(w.get("probability", 1.0)),
            ))
    return words


def _filter_words(words: list[TranscriptWord]) -> list[TranscriptWord]:
    """Remove words with very low Whisper confidence scores."""
    return [w for w in words if w.probability >= 0.25]


def _segments_to_timed_lines(result: dict) -> list[TimedLine]:
    lines: list[TimedLine] = []
    for seg in result.get("segments", []):
        text = seg.get("text", "").strip()
        if text:
            lines.append(TimedLine(
                start=round(float(seg.get("start", 0.0)), 3),
                text=text,
            ))
    return lines
