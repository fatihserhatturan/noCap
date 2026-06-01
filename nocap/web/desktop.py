"""Headless server entry used by the Electron desktop wrapper.

Starts Flask on the given port without opening a browser window.
Usage: python -m nocap.web.desktop [--port PORT]
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser(description="noCap desktop server")
    parser.add_argument("--port", type=int, default=5757)
    args = parser.parse_args()

    try:
        from nocap.web.server import start
    except ImportError as exc:
        print(f"[nocap-server] Import error: {exc}", file=sys.stderr)
        sys.exit(1)

    start(port=args.port)


if __name__ == "__main__":
    main()
