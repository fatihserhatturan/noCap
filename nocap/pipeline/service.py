from __future__ import annotations

from pathlib import Path

from nocap.i18n import msg

from .audio_context import compute_context_metrics
from .models import AnalysisOptions, AnalysisResult, ProgressEvent, ProgressReporter
from .words import analyze_lines, analyze_transcript_words


def analyze_track(
    audio_path: Path,
    options: AnalysisOptions,
    reporter: ProgressReporter | None = None,
) -> AnalysisResult:
    from nocap.audio.loader import load

    _emit(reporter, "load", msg("pipeline.loadingAudio", path=audio_path))
    audio_data = load(audio_path)
    _emit(reporter, "load", msg("pipeline.loaded", duration=audio_data.duration), True)

    # Beat detection runs on the original mix — no dependency on vocal separation.
    # Must happen before vocal separation so step order matches the UI: load → beat → transcribe.
    grid = _build_grid(audio_data, options, reporter)

    transcription_audio = audio_data
    vocals_audio = None

    if options.separate:
        from nocap.audio.separator import assess_vocal_stem, separate
        _emit(reporter, "transcribe", msg("pipeline.isolating"))
        vocals = separate(audio_data)          # raises ImportError if Demucs missing
        stem_quality = assess_vocal_stem(vocals, audio_data)
        if not stem_quality.usable:
            raise ValueError(msg("pipeline.unusableStem", reason=stem_quality.reason))
        transcription_audio = vocals
        vocals_audio = vocals
    transcript_words = None
    if options.lyrics is not None:
        from nocap.text.parser import parse
        _emit(reporter, "transcribe", msg("pipeline.parsingLyrics", path=options.lyrics))
        lines = parse(options.lyrics)
        _emit(reporter, "transcribe", msg("pipeline.linesParsed", count=len(lines)), True)
    else:
        lines, transcript_words = _transcribe(transcription_audio, options, reporter)

    flowmap = _finish(
        title=options.title or audio_path.stem,
        grid=grid,
        lines=lines,
        audio_path=str(audio_path.resolve()),
        duration=audio_data.duration,
        transcript_words=transcript_words,
        audio_data=audio_data,
        reporter=reporter,
    )
    return AnalysisResult(flowmap, audio_data, transcript_words, vocals_audio)


def analyze_lyrics(
    lyrics_path: Path,
    options: AnalysisOptions,
    reporter: ProgressReporter | None = None,
) -> AnalysisResult:
    if options.bpm is None:
        raise ValueError(msg("pipeline.needBpm"))
    from nocap.audio.beat_tracker import build_from_bpm
    from nocap.text.parser import parse

    _emit(reporter, "transcribe", msg("pipeline.parsingLyrics", path=lyrics_path))
    lines = parse(lyrics_path)
    max_ts = max((line.start for line in lines if line.start >= 0), default=-1)
    duration = max_ts + 30.0 if max_ts >= 0 else len(lines) * 3.0
    grid = build_from_bpm(options.bpm, duration)
    grid = _apply_offsets(grid, options, reporter)
    flowmap = _finish(
        title=options.title or lyrics_path.stem,
        grid=grid,
        lines=lines,
        audio_path=None,
        duration=duration,
        transcript_words=None,
        audio_data=None,
        reporter=reporter,
    )
    return AnalysisResult(flowmap, None, None)


def _build_grid(audio_data, options: AnalysisOptions, reporter: ProgressReporter | None):
    if options.bpm is not None:
        from nocap.audio.beat_tracker import build_from_bpm
        _emit(reporter, "beat", msg("pipeline.forcedBpm", bpm=options.bpm))
        grid = build_from_bpm(options.bpm, audio_data.duration)
    else:
        from nocap.audio.beat_tracker import track
        _emit(reporter, "beat", msg("pipeline.detectingBeats"))
        grid = track(audio_data)
        _emit(reporter, "beat", msg("pipeline.bpm", bpm=grid.bpm), True)
    return _apply_offsets(grid, options, reporter)


def _apply_offsets(grid, options: AnalysisOptions, reporter: ProgressReporter | None):
    if options.downbeat_offset:
        from nocap.audio.beat_tracker import apply_downbeat_offset
        _emit(reporter, "beat", msg("pipeline.downbeatOffset", offset=options.downbeat_offset))
        grid = apply_downbeat_offset(grid, options.downbeat_offset)
    if options.bar_offset:
        from nocap.audio.beat_tracker import apply_bar_offset
        _emit(reporter, "beat", msg("pipeline.barOffset", offset=options.bar_offset))
        grid = apply_bar_offset(grid, options.bar_offset)
    return grid


def _transcribe(audio_data, options: AnalysisOptions, reporter: ProgressReporter | None):
    from nocap.audio.transcriber import require_word_timestamps, transcribe, words_to_timed_lines

    _emit(reporter, "transcribe", msg("pipeline.loadingWhisper"))

    def on_whisper_progress(pct: int) -> None:
        if reporter is not None:
            reporter(ProgressEvent("transcribe", "", done=False, pct=pct))

    tr = transcribe(audio_data, language=options.language, whisper_progress_callback=on_whisper_progress)
    require_word_timestamps(tr)
    _emit(reporter, "transcribe", msg("pipeline.languageWords", count=len(tr.words)), True)
    return words_to_timed_lines(tr.words), tr.words


def _finish(*, title, grid, lines, audio_path, duration, transcript_words, audio_data, reporter):
    if not lines:
        raise ValueError(msg("pipeline.nothing"))
    _emit(reporter, "align", msg("pipeline.analyzingFlow"))
    all_words = analyze_transcript_words(transcript_words) if transcript_words else analyze_lines(lines)
    from nocap.analysis.aligner import align, align_words
    from nocap.analysis.exporter import build_flowmap
    from nocap.analysis.flow_metrics import compute_bar_metrics, compute_summary
    from nocap.text.rhyme import detect

    rhyme_labels = detect(all_words)
    aligned = (
        align_words(transcript_words, grid, rhyme_labels, all_words)
        if transcript_words else align(lines, grid, rhyme_labels, all_words)
    )
    bars = compute_bar_metrics(aligned, grid)
    summary = compute_summary(bars, aligned)
    context = compute_context_metrics(audio_data, grid, bars)
    _emit(reporter, "align", msg("pipeline.syllablesMapped", count=len(aligned)), True)
    return build_flowmap(
        title=title,
        grid=grid,
        syllables=aligned,
        bar_metrics=bars,
        summary=summary,
        audio_path=audio_path,
        duration=duration,
        transcript_words=transcript_words,
        word_analyses=all_words,
        analysis_mode="audio_whisper_word" if transcript_words else "lyrics",
        beat_onsets=context.beat_onsets,
        bar_onsets=context.bar_onsets,
        beat_tempos=context.beat_tempos,
        bar_tempos=context.bar_tempos,
        bar_spectral=context.bar_spectral,
        sections=context.sections,
    )


def _emit(reporter: ProgressReporter | None, step: str, message: str, done: bool = False) -> None:
    if reporter is not None:
        reporter(ProgressEvent(step, message, done))
