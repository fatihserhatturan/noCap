from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path


@dataclass
class TimedLine:
    start: float        # seconds; -1.0 means unknown
    text: str


def parse(source: str | Path) -> list[TimedLine]:
    """Parse lyrics from a file path or raw string.

    Accepts:
      - .lrc files  (standard [mm:ss.xx] format)
      - .srt files  (SubRip subtitle format)
      - plain text  (one line per lyric, no timestamps)
    """
    if isinstance(source, Path) or (isinstance(source, str) and "\n" not in source and Path(source).exists()):
        path = Path(source)
        text = path.read_text(encoding="utf-8")
        suffix = path.suffix.lower()
    else:
        text = source
        suffix = _detect_format(text)

    if suffix == ".lrc":
        return _parse_lrc(text)
    if suffix == ".srt":
        return _parse_srt(text)
    return _parse_plain(text)


# ── format detection ──────────────────────────────────────────────────────────

_LRC_RE = re.compile(r"^\[\d{2}:\d{2}")
_SRT_TIMING_RE = re.compile(r"\d{2}:\d{2}:\d{2},\d{3} --> \d{2}:\d{2}:\d{2},\d{3}")


def _detect_format(text: str) -> str:
    for line in text.splitlines():
        if _LRC_RE.match(line.strip()):
            return ".lrc"
        if _SRT_TIMING_RE.search(line):
            return ".srt"
    return ".txt"


# ── LRC parser ────────────────────────────────────────────────────────────────

_LRC_TAG_RE = re.compile(r"\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)")


def _parse_lrc(text: str) -> list[TimedLine]:
    lines: list[TimedLine] = []
    for raw in text.splitlines():
        raw = raw.strip()
        m = _LRC_TAG_RE.match(raw)
        if not m:
            continue
        minutes, seconds, centis, lyric = m.groups()
        # centis may be 2 or 3 digits
        frac = int(centis) / (100 if len(centis) == 2 else 1000)
        start = int(minutes) * 60 + int(seconds) + frac
        lyric = lyric.strip()
        if lyric:
            lines.append(TimedLine(start=round(start, 3), text=lyric))
    return lines


# ── SRT parser ────────────────────────────────────────────────────────────────

_SRT_TIME_RE = re.compile(
    r"(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}),(\d{3})"
)


def _parse_srt(text: str) -> list[TimedLine]:
    lines: list[TimedLine] = []
    blocks = re.split(r"\n\s*\n", text.strip())
    for block in blocks:
        block_lines = block.strip().splitlines()
        if len(block_lines) < 2:
            continue
        m = _SRT_TIME_RE.search(block)
        if not m:
            continue
        h, mn, s, ms = int(m.group(1)), int(m.group(2)), int(m.group(3)), int(m.group(4))
        start = h * 3600 + mn * 60 + s + ms / 1000
        # collect text lines (skip sequence number and timing line)
        text_lines = [l for l in block_lines if not l.strip().isdigit() and not _SRT_TIME_RE.search(l)]
        lyric = " ".join(text_lines).strip()
        if lyric:
            lines.append(TimedLine(start=round(start, 3), text=lyric))
    return lines


# ── plain text parser ─────────────────────────────────────────────────────────

def _parse_plain(text: str) -> list[TimedLine]:
    return [
        TimedLine(start=-1.0, text=line.strip())
        for line in text.splitlines()
        if line.strip()
    ]
