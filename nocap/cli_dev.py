from __future__ import annotations

import os
import signal
import subprocess
import sys
import time
import webbrowser
from pathlib import Path

import click


def run_dev(backend_port: int, frontend_port: int, no_open: bool) -> None:
    root = Path(__file__).resolve().parents[1]
    frontend_dir = root / "frontend"
    if not frontend_dir.exists():
        raise click.ClickException(f"Frontend directory not found: {frontend_dir}")

    npm_cmd = _find_executable("npm")
    vite_cmd = frontend_dir / "node_modules" / ".bin" / "vite"
    if npm_cmd is None:
        raise click.ClickException("npm is required to install frontend dependencies.")
    if not (frontend_dir / "node_modules").exists():
        click.echo("  Installing frontend dependencies...")
        subprocess.run([npm_cmd, "install"], cwd=frontend_dir, check=True)
    if not vite_cmd.exists():
        raise click.ClickException("Vite was not found in frontend/node_modules. Run `npm install` in frontend/.")

    _ensure_port("Backend", backend_port)
    _ensure_port("Frontend", frontend_port)
    backend_proc = _start_backend(root, backend_port)
    frontend_proc = _start_frontend(frontend_dir, frontend_port, backend_port, vite_cmd)
    processes = [backend_proc, frontend_proc]

    try:
        if not no_open:
            time.sleep(1.0)
            _raise_if_any_exited(processes)
            webbrowser.open(f"http://localhost:{frontend_port}")
        click.echo("  noCap dev is running. Press Ctrl+C to stop both servers.")
        while True:
            _raise_if_any_exited(processes)
            time.sleep(0.5)
    except KeyboardInterrupt:
        click.echo("\n  Stopping noCap dev servers...")
    finally:
        _stop(processes)


def _start_backend(root: Path, port: int) -> subprocess.Popen:
    env = os.environ.copy()
    env["PYTHONPATH"] = str(root) + os.pathsep + env.get("PYTHONPATH", "")
    click.echo(f"  Starting backend API on http://localhost:{port} ...")
    return subprocess.Popen([
        sys.executable,
        "-c",
        f"from nocap.web.server import start; start(port={port})",
    ], cwd=root, env=env)


def _start_frontend(frontend_dir: Path, port: int, backend_port: int, vite_cmd: Path) -> subprocess.Popen:
    env = os.environ.copy()
    env["VITE_NOCAP_API_URL"] = f"http://localhost:{backend_port}"
    env.pop("INIT_CWD", None)
    env.pop("NODE_PATH", None)
    click.echo(f"  Starting frontend on http://localhost:{port} ...")
    return subprocess.Popen([str(vite_cmd), "--host", "127.0.0.1", "--port", str(port), "--strictPort"], cwd=frontend_dir, env=env)


def _ensure_port(label: str, port: int) -> None:
    if not _port_available("127.0.0.1", port):
        raise click.ClickException(
            f"{label} port {port} is already in use. Stop the old server or run with --{label.lower()}-port {port + 1}."
        )


def _stop(processes: list[subprocess.Popen]) -> None:
    for proc in processes:
        if proc.poll() is None:
            proc.send_signal(signal.SIGTERM)
    for proc in processes:
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()


def _find_executable(name: str) -> str | None:
    from shutil import which
    return which(name)


def _raise_if_any_exited(processes: list[subprocess.Popen]) -> None:
    for proc in processes:
        code = proc.poll()
        if code is not None:
            raise click.ClickException(f"A dev server exited with code {code}.")


def _port_available(host: str, port: int) -> bool:
    import socket
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            sock.bind((host, port))
        except OSError:
            return False
    return True
