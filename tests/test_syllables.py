from __future__ import annotations

import unittest

from nocap.text.syllables import analyze_line, analyze_word


class DictionaryWordTest(unittest.TestCase):
    def test_syllable_count_and_stress_come_from_the_cmu_dictionary(self) -> None:
        cases = {
            "cat": (1, [1]),
            "water": (2, [1, 0]),
            "hello": (2, [0, 1]),
            "beautiful": (3, [1, 0, 0]),
            "understand": (3, [2, 0, 1]),  # secondary stress on the first syllable
        }
        for word, (count, stress) in cases.items():
            with self.subTest(word=word):
                result = analyze_word(word)
                self.assertEqual(count, result.syllable_count)
                self.assertEqual(stress, result.stress_pattern)
                self.assertTrue(result.phones)


class HeuristicFallbackTest(unittest.TestCase):
    def test_unknown_words_are_counted_by_vowel_groups(self) -> None:
        cases = {"blorptastic": 3, "flonkle": 2}  # "flonkle": the final consonant + "le" is a syllable
        for word, count in cases.items():
            with self.subTest(word=word):
                result = analyze_word(word)
                self.assertEqual([], result.phones)
                self.assertEqual(count, result.syllable_count)
                self.assertEqual([1] + [0] * (count - 1), result.stress_pattern)

    def test_a_word_without_vowels_still_has_one_syllable(self) -> None:
        result = analyze_word("qzxv")
        self.assertEqual(1, result.syllable_count)
        self.assertEqual([1], result.stress_pattern)

    def test_stress_pattern_always_matches_the_syllable_count(self) -> None:
        for word in ("syllables", "rhythm", "international", "blorptastic", "qzxv"):
            with self.subTest(word=word):
                result = analyze_word(word)
                self.assertEqual(result.syllable_count, len(result.stress_pattern))
                self.assertTrue(set(result.stress_pattern) <= {0, 1, 2})


class CleaningTest(unittest.TestCase):
    def test_punctuation_and_case_do_not_change_the_result(self) -> None:
        plain = analyze_word("water")
        for variant in ("Water", "WATER", "water!", "(water),", '"Water."'):
            with self.subTest(variant=variant):
                result = analyze_word(variant)
                self.assertEqual("water", result.clean)
                self.assertEqual(variant, result.word)  # the original spelling is kept
                self.assertEqual(plain.syllable_count, result.syllable_count)
                self.assertEqual(plain.stress_pattern, result.stress_pattern)

    def test_apostrophes_are_kept(self) -> None:
        result = analyze_word("Don't")
        self.assertEqual("don't", result.clean)
        self.assertEqual(1, result.syllable_count)


class AnalyzeLineTest(unittest.TestCase):
    def test_every_word_of_the_line_is_analyzed(self) -> None:
        result = analyze_line("late night city lights")
        self.assertEqual(["late", "night", "city", "lights"], [w.word for w in result])
        self.assertEqual([1, 1, 2, 1], [w.syllable_count for w in result])

    def test_punctuation_is_stripped_from_each_word(self) -> None:
        result = analyze_line("Late, night!")
        self.assertEqual(["Late,", "night!"], [w.word for w in result])
        self.assertEqual(["late", "night"], [w.clean for w in result])

    def test_tokens_without_letters_are_skipped(self) -> None:
        self.assertEqual(["go"], [w.word for w in analyze_line("123 - go !!!")])
        self.assertEqual([], analyze_line(""))
        self.assertEqual([], analyze_line("... !!!"))


if __name__ == "__main__":
    unittest.main()