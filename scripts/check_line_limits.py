from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MAX_LINES = 200
SUFFIXES = {".py", ".ts", ".tsx", ".css"}
SKIP_PARTS = {"node_modules", "dist", "build", ".git", "__pycache__"}


def main() -> int:
    violations: list[tuple[int, Path]] = []
    for path in sorted(ROOT.rglob("*")):
        if not path.is_file() or path.suffix not in SUFFIXES:
            continue
        if any(part in SKIP_PARTS for part in path.parts):
            continue
        count = len(path.read_text(encoding="utf-8").splitlines())
        if count > MAX_LINES:
            violations.append((count, path.relative_to(ROOT)))
    for count, path in violations:
        print(f"{path}: {count} lines")
    return 1 if violations else 0


if __name__ == "__main__":
    raise SystemExit(main())
