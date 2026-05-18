from __future__ import annotations

import sys
from pathlib import Path

import click


@click.group()
@click.version_option(package_name="nocap")
def cli() -> None:
    """noCap — hip-hop flow & rhythm analyzer."""


@cli.command()
@click.argument("audio", required=False, type=click.Path(exists=True, path_type=Path))
@click.option("--lyrics",   "-l", type=click.Path(exists=True, path_type=Path),
              help="Lyrics file (.lrc, .srt, or .txt)")
@click.option("--bpm",      type=float, default=None,
              help="Force a BPM value (skips librosa beat detection)")
@click.option("--output",   "-o", type=click.Path(path_type=Path), default=None,
              help="Save FlowMap JSON to this path")
@click.option("--no-serve", is_flag=True, default=False,
              help="Skip opening the browser viewer")
@click.option("--title",    "-t", default=None,
              help="Track title (defaults to filename)")
@click.option("--whisper-model", default="base", show_default=True,
              type=click.Choice(["tiny", "base", "small", "medium", "large"]),
              help="Whisper model size for transcription")
@click.option("--language", default=None,
              help="Language hint for Whisper (e.g. 'en', 'tr')")
@click.option("--separate", is_flag=True, default=False,
              help="Isolate vocals with Demucs before transcribing (requires nocap[separator])")
def analyze(
    audio: Path | None,
    lyrics: Path | None,
    bpm: float | None,
    output: Path | None,
    no_serve: bool,
    title: str | None,
    whisper_model: str,
    language: str | None,
    separate: bool,
) -> None:
    """Analyze a track and generate its flow map.

    \b
    Examples:
      nocap analyze track.mp3                          # auto-transcribe
      nocap analyze track.mp3 --lyrics track.lrc       # use provided lyrics
      nocap analyze --lyrics track.lrc --bpm 90        # no audio needed
      nocap analyze track.mp3 --whisper-model small    # higher accuracy
      nocap analyze track.mp3 --separate               # vocal isolation first
    """
    if audio is None and lyrics is None:
        raise click.UsageError("Provide at least an AUDIO file or --lyrics.")

    click.echo("noCap — analyzing track…")

    # ── 1. Load audio ────────────────────────────────────────────────────────
    audio_data = None
    if audio is not None:
        click.echo(f"  Loading audio: {audio}")
        from nocap.audio.loader import load
        audio_data = load(audio)

        # optional vocal separation
        if separate:
            from nocap.audio.separator import separate as do_separate, is_available
            if not is_available():
                click.echo("  [warn] Demucs not installed — skipping vocal separation.")
            else:
                click.echo("  Isolating vocals with Demucs…")
                audio_data = do_separate(audio_data)
                click.echo("  Vocals extracted.")

    resolved_title = title or (audio.stem if audio else lyrics.stem if lyrics else "untitled")
    audio_path_str = str(audio.resolve()) if audio else None

    # ── 2. Beat grid ─────────────────────────────────────────────────────────
    if audio_data is not None:
        if bpm is not None:
            from nocap.audio.beat_tracker import build_from_bpm
            click.echo(f"  Using forced BPM: {bpm}")
            grid = build_from_bpm(bpm, audio_data.duration)
        else:
            from nocap.audio.beat_tracker import track
            click.echo("  Detecting beats…")
            grid = track(audio_data)
            click.echo(f"  Detected BPM: {grid.bpm:.1f}")
    else:
        # lyrics-only mode
        if bpm is None:
            raise click.UsageError("--bpm is required when no audio file is provided.")
        from nocap.text.parser import parse as _parse
        from nocap.audio.beat_tracker import build_from_bpm
        _temp_lines = _parse(lyrics)
        max_ts  = max((l.start for l in _temp_lines if l.start >= 0), default=-1)
        duration = max_ts + 30.0 if max_ts >= 0 else len(_temp_lines) * 3.0
        grid = build_from_bpm(bpm, duration)

    # ── 3. Lyrics / transcription ─────────────────────────────────────────────
    transcript_words = None   # word-level timestamps from Whisper (optional)

    if lyrics is not None:
        click.echo(f"  Parsing lyrics: {lyrics}")
        from nocap.text.parser import parse as parse_lyrics
        lines = parse_lyrics(lyrics)
        click.echo(f"  {len(lines)} lines parsed.")

    elif audio_data is not None:
        # auto-transcribe with Whisper
        click.echo(f"  Transcribing with Whisper ({whisper_model})…")
        from nocap.audio.transcriber import transcribe, words_to_timed_lines
        try:
            tr = transcribe(
                audio_data,
                model_name=whisper_model,
                language=language,
                progress_callback=lambda msg: click.echo(f"    {msg}"),
            )
        except ImportError as e:
            click.echo(f"  [error] {e}")
            sys.exit(1)

        click.echo(f"  Detected language: {tr.language}")

        if tr.has_word_timestamps:
            click.echo(f"  {len(tr.words)} words with word-level timestamps.")
            transcript_words = tr.words
            lines = words_to_timed_lines(tr.words)
        else:
            click.echo(f"  {len(tr.timed_lines)} segments (no word timestamps).")
            lines = tr.timed_lines

    else:
        lines = []

    if not lines:
        click.echo("  Nothing to analyze — provide a lyrics file or an audio file.")
        sys.exit(1)

    # ── 4. Word analysis + rhyme detection ────────────────────────────────────
    from nocap.text.syllables import analyze_line
    from nocap.text.rhyme import detect as detect_rhymes

    all_words = []
    for line in lines:
        all_words.extend(analyze_line(line.text))

    total_syls = sum(w.syllable_count for w in all_words)
    click.echo(f"  {len(all_words)} words, {total_syls} syllables.")

    rhyme_labels = detect_rhymes(all_words)

    # ── 5. Alignment ──────────────────────────────────────────────────────────
    click.echo("  Aligning syllables to beat grid…")

    if transcript_words is not None:
        from nocap.analysis.aligner import align_words
        aligned = align_words(transcript_words, grid, rhyme_labels=rhyme_labels, word_analyses=all_words)
        click.echo(f"  {len(aligned)} syllable events (word-level precision).")
    else:
        from nocap.analysis.aligner import align
        aligned = align(lines, grid, rhyme_labels=rhyme_labels, word_analyses=all_words)
        click.echo(f"  {len(aligned)} syllable events aligned.")

    # ── 6. Metrics ────────────────────────────────────────────────────────────
    from nocap.analysis.flow_metrics import compute_bar_metrics, compute_summary
    bar_metrics = compute_bar_metrics(aligned, grid)
    summary     = compute_summary(bar_metrics, aligned)

    click.echo(
        f"  Summary: avg_density={summary.avg_density} syl/beat  "
        f"syncopation={summary.syncopation_score}  "
        f"consistency={summary.consistency}"
    )

    # ── 7. Export ─────────────────────────────────────────────────────────────
    from nocap.analysis.exporter import build_flowmap, save

    flowmap = build_flowmap(
        title=resolved_title,
        grid=grid,
        syllables=aligned,
        bar_metrics=bar_metrics,
        summary=summary,
        audio_path=audio_path_str,
    )

    out_path = (output or Path(f"{resolved_title.replace(' ', '_')}_flowmap.json")).resolve()
    save(flowmap, out_path)
    click.echo(f"  FlowMap saved → {out_path}")

    # ── 8. Serve ──────────────────────────────────────────────────────────────
    if not no_serve:
        _serve(out_path, audio_path_str)


@cli.command()
@click.argument("flowmap", required=False, type=click.Path(exists=True, path_type=Path))
@click.option("--port", "-p", default=5757, show_default=True)
def serve(flowmap: Path | None, port: int) -> None:
    """Start the noCap viewer in the browser.

    \b
    Without arguments: opens the upload screen — drop any MP3/WAV.
    With a flowmap:    opens that flow map directly.

    \b
    Examples:
      nocap serve
      nocap serve track_flowmap.json
    """
    import webbrowser
    from nocap.web.server import start

    click.echo(f"  Starting noCap on http://localhost:{port} …")
    webbrowser.open(f"http://localhost:{port}")
    start(flowmap_path=flowmap, audio_path=None, port=port)


# ── server helper ─────────────────────────────────────────────────────────────

def _serve(flowmap_path: Path, audio_path: str | None, port: int = 5757) -> None:
    import webbrowser
    from nocap.web.server import start

    click.echo(f"  Starting viewer on http://localhost:{port} …")
    webbrowser.open(f"http://localhost:{port}")
    start(flowmap_path=flowmap_path, audio_path=audio_path, port=port)

