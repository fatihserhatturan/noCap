from __future__ import annotations

from dataclasses import dataclass, field

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
    # word-level timestamps (populated when word_timestamps=True succeeds)
    words: list[TranscriptWord] = field(default_factory=list)

    @property
    def has_word_timestamps(self) -> bool:
        return len(self.words) > 0


def transcribe(
    audio: AudioData,
    model_name: str = "base",
    language: str | None = None,
    progress_callback=None,
) -> TranscriptResult:
    """Transcribe audio using OpenAI Whisper.

    Attempts word-level timestamps first; falls back to segment-level if the
    installed Whisper version does not support them.
    """
    try:
        import whisper
    except ImportError as e:
        raise ImportError(
            "openai-whisper is required: pip install openai-whisper"
        ) from e

    _patch_ssl()

    if progress_callback:
        progress_callback("Loading Whisper model…")

    model = whisper.load_model(model_name)

    if progress_callback:
        progress_callback("Transcribing audio…")

    # Resample to 16 kHz (Whisper's expected rate) using the already-loaded array.
    # Passing a numpy array bypasses Whisper's ffmpeg requirement entirely.
    import numpy as np
    audio_arr = _resample_to_16k(audio)

    # attempt word-level timestamps
    words: list[TranscriptWord] = []
    try:
        result = model.transcribe(
            audio_arr,
            word_timestamps=True,
            language=language,
            verbose=False,
        )
        words = _extract_words(result)
    except Exception:
        result = model.transcribe(
            audio_arr,
            language=language,
            verbose=False,
        )

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


# ── SSL fix (macOS Python 3.x doesn't bundle CA certs) ───────────────────────

def _patch_ssl() -> None:
    """Point Python's SSL to certifi's CA bundle if system certs are missing."""
    import ssl
    try:
        ssl.create_default_context().load_default_certs()
        # quick smoke-test
        import urllib.request
        urllib.request.urlopen("https://openaipublic.azureedge.net", timeout=3)
    except Exception:
        try:
            import certifi, os
            os.environ.setdefault("SSL_CERT_FILE", certifi.where())
            os.environ.setdefault("REQUESTS_CA_BUNDLE", certifi.where())
            # monkey-patch ssl for urllib
            _orig = ssl.create_default_context
            def _patched(*a, **kw):
                ctx = _orig(*a, **kw)
                ctx.load_verify_locations(certifi.where())
                return ctx
            ssl.create_default_context = _patched
        except ImportError:
            pass  # certifi not available — nothing we can do


# ── Internal helpers ──────────────────────────────────────────────────────────

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
