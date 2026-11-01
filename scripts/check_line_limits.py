from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MAX_LINES = 200
SUFFIXES = {".py", ".ts", ".tsx", ".css"}
SKIP_PARTS = {"node_modules", "dist", "build", ".git", "__pycache__", ".venv"}


def is_skipped(relative: Path) -> bool:
    """Skip vendored/build folders and any hidden folder (.claude/worktrees, .venv-linux, ...)."""
    return any(part in SKIP_PARTS or part.startswith(".") for part in relative.parts)


def main() -> int:
    violations: list[tuple[int, Path]] = []
    for path in sorted(ROOT.rglob("*")):
        if not path.is_file() or path.suffix not in SUFFIXES:
            continue
        relative = path.relative_to(ROOT)
        if is_skipped(relative):
            continue
        count = len(path.read_text(encoding="utf-8").splitlines())
        if count > MAX_LINES:
            violations.append((count, relative))
    for count, path in violations:
        print(f"{path}: {count} lines")
    return 1 if violations else 0


if __name__ == "__main__":
    raise SystemExit(main())
