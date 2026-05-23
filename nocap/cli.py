from __future__ import annotations

import sys
from pathlib import Path

import click

from nocap.pipeline import AnalysisOptions, ProgressEvent, analyze_lyrics, analyze_track


@click.group()
@click.version_option(package_name="nocap")
def cli() -> None:
    """noCap - hip-hop flow & rhythm analyzer."""


@cli.command()
@click.argument("audio", required=False, type=click.Path(exists=True, path_type=Path))
@click.option("--lyrics", "-l", type=click.Path(exists=True, path_type=Path), help="Lyrics file (.lrc, .srt, or .txt)")
@click.option("--bpm", type=float, default=None, help="Force a BPM value (skips librosa beat detection)")
@click.option("--output", "-o", type=click.Path(path_type=Path), default=None, help="Save FlowMap JSON to this path")
@click.option("--no-serve", is_flag=True, default=False, help="Skip opening the browser viewer")
@click.option("--title", "-t", default=None, help="Track title (defaults to filename)")
@click.option("--whisper-model", default="base", show_default=True, type=click.Choice(["tiny", "base", "small", "medium", "large"]))
@click.option("--language", default=None, help="Language hint for Whisper (e.g. 'en', 'tr')")
@click.option("--separate", is_flag=True, default=False, help="Isolate vocals with Demucs before transcribing")
@click.option("--bar-offset", type=int, default=0, show_default=True, help="Shift exported bar numbers by this many bars.")
@click.option("--downbeat-offset", type=int, default=0, show_default=True, help="Manually rotate beat numbering by this many beats.")
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
    bar_offset: int,
    downbeat_offset: int,
) -> None:
    """Analyze a track and generate its flow map."""
    if audio is None and lyrics is None:
        raise click.UsageError("Provide at least an AUDIO file or --lyrics.")
    click.echo("noCap - analyzing track...")
    options = AnalysisOptions(title, lyrics, bpm, whisper_model, language, separate, bar_offset, downbeat_offset)
    try:
        result = analyze_track(audio, options, _report_cli) if audio else analyze_lyrics(lyrics, options, _report_cli)
    except (ImportError, ValueError) as exc:
        click.echo(f"  [error] {exc}")
        sys.exit(1)

    from nocap.analysis.exporter import save
    resolved_title = title or (audio.stem if audio else lyrics.stem if lyrics else "untitled")
    out_path = (output or Path(f"{resolved_title.replace(' ', '_')}_flowmap.json")).resolve()
    save(result.flowmap, out_path)
    click.echo(f"  FlowMap saved -> {out_path}")
    if not no_serve:
        _serve(out_path, result.flowmap.get("metadata", {}).get("audio_path"))


@cli.command()
@click.argument("flowmap", required=False, type=click.Path(exists=True, path_type=Path))
@click.option("--port", "-p", default=5757, show_default=True)
def serve(flowmap: Path | None, port: int) -> None:
    """Start the noCap viewer in the browser."""
    import webbrowser
    from nocap.web.server import start

    click.echo(f"  Starting noCap on http://localhost:{port} ...")
    webbrowser.open(f"http://localhost:{port}")
    start(flowmap_path=flowmap, audio_path=None, port=port)


@cli.command()
@click.option("--backend-port", default=5757, show_default=True, help="Flask API port.")
@click.option("--frontend-port", default=8765, show_default=True, help="Vite frontend port.")
@click.option("--no-open", is_flag=True, default=False, help="Do not open the browser automatically.")
def dev(backend_port: int, frontend_port: int, no_open: bool) -> None:
    """Run the Flask API and Vite frontend together for development."""
    from nocap.cli_dev import run_dev
    run_dev(backend_port, frontend_port, no_open)


def _serve(flowmap_path: Path, audio_path: str | None, port: int = 5757) -> None:
    import webbrowser
    from nocap.web.server import start

    click.echo(f"  Starting viewer on http://localhost:{port} ...")
    webbrowser.open(f"http://localhost:{port}")
    start(flowmap_path=flowmap_path, audio_path=audio_path, port=port)


def _report_cli(event: ProgressEvent) -> None:
    suffix = " done" if event.done else ""
    click.echo(f"  {event.message}{suffix}")


if __name__ == "__main__":
    cli()
