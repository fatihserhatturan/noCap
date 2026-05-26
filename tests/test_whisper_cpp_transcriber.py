from __future__ import annotations

import unittest

from nocap.audio.transcriber import _extract_words, _normalize_whisper_cpp_json


class WhisperCppTranscriberTest(unittest.TestCase):
    def test_word_offsets_prefer_whisper_cpp_items_over_token_timestamps(self) -> None:
        data = {
            "result": {"language": "en"},
            "transcription": [
                {
                    "text": " And",
                    "timestamps": {"from": "00:00:00,220", "to": "00:00:00,330"},
                    "offsets": {"from": 220, "to": 330},
                    "tokens": [
                        {
                            "text": " And",
                            "timestamps": {"from": "00:00:00,220", "to": "00:00:00,220"},
                            "p": 0.9,
                        }
                    ],
                },
                {
                    "text": ",",
                    "timestamps": {"from": "00:00:00,330", "to": "00:00:00,500"},
                    "offsets": {"from": 330, "to": 500},
                    "tokens": [],
                },
            ],
        }

        result = _normalize_whisper_cpp_json(data)
        words = _extract_words(result)

        self.assertEqual(1, len(words))
        self.assertEqual("And", words[0].word)
        self.assertEqual(0.22, words[0].start)
        self.assertEqual(0.33, words[0].end)

    def test_word_end_uses_token_end_when_item_includes_following_pause(self) -> None:
        data = {
            "result": {"language": "en"},
            "transcription": [
                {
                    "text": " not",
                    "timestamps": {"from": "00:00:04,010", "to": "00:00:05,410"},
                    "offsets": {"from": 4010, "to": 5410},
                    "tokens": [
                        {
                            "text": " not",
                            "timestamps": {"from": "00:00:04,010", "to": "00:00:04,290"},
                            "p": 0.91,
                        }
                    ],
                },
            ],
        }

        result = _normalize_whisper_cpp_json(data)
        words = _extract_words(result)

        self.assertEqual(1, len(words))
        self.assertEqual("not", words[0].word)
        self.assertEqual(4.01, words[0].start)
        self.assertEqual(4.29, words[0].end)


if __name__ == "__main__":
    unittest.main()
