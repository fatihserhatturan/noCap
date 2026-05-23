from __future__ import annotations

from typing import Any

from nocap.text.parser import TimedLine
from nocap.text.syllables import WordAnalysis, analyze_line, analyze_word


def analyze_transcript_words(transcript_words: list[Any]) -> list[WordAnalysis]:
    output: list[WordAnalysis] = []
    for timed_word in transcript_words:
        parsed = analyze_line(timed_word.word)
        output.append(parsed[0] if parsed else analyze_word(timed_word.word))
    return output


def analyze_lines(lines: list[TimedLine]) -> list[WordAnalysis]:
    output: list[WordAnalysis] = []
    for line in lines:
        output.extend(analyze_line(line.text))
    return output
