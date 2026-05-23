from __future__ import annotations

import json


def sse(event_type: str, **payload) -> str:
    payload["type"] = event_type
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


def safe_suffix(filename: str | None) -> str:
    from pathlib import Path
    suffix = Path(filename or "").suffix.lower()
    return suffix if suffix else ".mp3"
