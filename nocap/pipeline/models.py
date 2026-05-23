from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable

from nocap.audio.loader import AudioData


@dataclass
class ProgressEvent:
    step: str
    message: str
    done: bool = False


ProgressReporter = Callable[[ProgressEvent], None]


@dataclass
class AnalysisOptions:
    title: str | None = None
    lyrics: Path | None = None
    bpm: float | None = None
    whisper_model: str = "base"
    language: str | None = None
    separate: bool = False
    bar_offset: int = 0
    downbeat_offset: int = 0


@dataclass
class AnalysisResult:
    flowmap: dict[str, Any]
    audio_data: AudioData | None
    transcript_words: list[Any] | None
    vocals_audio: AudioData | None = None
