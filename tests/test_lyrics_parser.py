from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from nocap.text.parser import TimedLine, parse


def _pairs(lines: list[TimedLine]) -> list[tuple[float, str]]:
    return [(line.start, line.text) for line in lines]


SRT = (
    "1\n00:00:01,000 --> 00:00:03,500\nFirst line\n\n"
    "2\n00:01:02,250 --> 00:01:04,000\nSecond\nline two\n\n"
    "3\n01:00:00,500 --> 01:00:02,000\nlast\n"
)


class LrcTest(unittest.TestCase):
    def test_lines_get_their_time_and_text(self) -> None:
        text = "[00:12.34] first line\n[01:02.500] second line\n"  # 2- and 3-digit fractions
        self.assertEqual([(12.34, "first line"), (62.5, "second line")], _pairs(parse(text)))

    def test_tag_lines_and_empty_lyrics_are_skipped(self) -> None:
        text = "[ar:Someone]\n[ti:Song]\n[00:01.00] hi\n[00:02.00]\n[00:03.00]  there  \n"
        self.assertEqual([(1.0, "hi"), (3.0, "there")], _pairs(parse(text)))

    def test_several_timestamps_on_one_line_repeat_the_lyric(self) -> None:
        text = "[00:12.00][00:48.00] chorus line\n"
        self.assertEqual([(12.0, "chorus line"), (48.0, "chorus line")], _pairs(parse(text)))

    def test_repeated_lines_are_sorted_by_start_time(self) -> None:
        text = "[00:48.00][00:12.00] chorus line\n[00:30.00] verse\n"
        self.assertEqual(
            [(12.0, "chorus line"), (30.0, "verse"), (48.0, "chorus line")],
            _pairs(parse(text)),
        )


class SrtTest(unittest.TestCase):
    def test_cues_get_their_start_time_and_text(self) -> None:
        self.assertEqual(
            [(1.0, "First line"), (62.25, "Second line two"), (3600.5, "last")],
            _pairs(parse(SRT)),  # a multi-line cue is joined; hours are counted
        )

    def test_cue_without_text_is_skipped(self) -> None:
        text = "1\n00:00:01,000 --> 00:00:02,000\nhi\n\n2\n00:00:03,000 --> 00:00:04,000\n\n3\n00:00:05,000 --> 00:00:06,000\nbye\n"
        self.assertEqual([(1.0, "hi"), (5.0, "bye")], _pairs(parse(text)))


class PlainTextTest(unittest.TestCase):
    def test_one_line_per_lyric_with_unknown_time(self) -> None:
        text = "first line\n\n  second line  \nthird\n"
        self.assertEqual(
            [(-1.0, "first line"), (-1.0, "second line"), (-1.0, "third")],
            _pairs(parse(text)),
        )

    def test_a_single_line_without_a_newline_is_text_not_a_path(self) -> None:
        self.assertEqual([(-1.0, "just one line")], _pairs(parse("just one line")))


class EmptyInputTest(unittest.TestCase):
    def test_blank_input_gives_no_lines(self) -> None:
        for text in ("\n", "\n\n", "   \n  \n"):
            with self.subTest(text=text):
                self.assertEqual([], parse(text))

    def test_empty_string_gives_no_lines(self) -> None:
        self.assertEqual([], parse(""))


class FileInputTest(unittest.TestCase):
    def test_files_are_read_and_the_suffix_picks_the_format(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            lrc = Path(tmp) / "song.lrc"
            lrc.write_text("[00:01.00] hi\n", encoding="utf-8")
            srt = Path(tmp) / "song.srt"
            srt.write_text(SRT, encoding="utf-8")
            txt = Path(tmp) / "song.txt"
            txt.write_text("one\ntwo\n", encoding="utf-8")
            self.assertEqual([(1.0, "hi")], _pairs(parse(lrc)))
            self.assertEqual([(1.0, "hi")], _pairs(parse(str(lrc))))  # a path given as a string
            self.assertEqual(3, len(parse(srt)))
            self.assertEqual([(-1.0, "one"), (-1.0, "two")], _pairs(parse(txt)))


if __name__ == "__main__":
    unittest.main()