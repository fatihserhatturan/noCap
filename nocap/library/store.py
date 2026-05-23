from __future__ import annotations

import json
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


class LibraryStore:
    def __init__(self, root: Path) -> None:
        self.root = root

    def list_tracks(self) -> list[dict[str, Any]]:
        if not self.root.exists():
            return []
        tracks = [meta for item in self.root.iterdir() if item.is_dir() for meta in [self.read_metadata(item.name)] if meta]
        return sorted(tracks, key=lambda item: item.get("created_at", ""), reverse=True)

    def read_metadata(self, track_id: str) -> dict[str, Any] | None:
        path = self._metadata_path(track_id)
        if not path.exists():
            return None
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            return None
        data["id"] = track_id
        return data

    def save_track(self, *, track_id: str, title: str, flowmap: dict[str, Any], tmp_audio: Path, audio_suffix: str, vocals_audio=None):
        track_dir = self.track_dir(track_id)
        track_dir.mkdir(parents=True, exist_ok=True)
        audio_path = track_dir / f"audio{audio_suffix}"
        tmp_audio.replace(audio_path)
        vocals_path = self._write_vocals(track_dir, vocals_audio)
        flowmap["metadata"]["audio_path"] = str(audio_path)
        self._flowmap_path(track_id).write_text(json.dumps(flowmap, ensure_ascii=False, indent=2), encoding="utf-8")
        metadata = self._metadata(track_id, title, flowmap, vocals_path)
        self._metadata_path(track_id).write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8")
        return metadata, audio_path, vocals_path

    def load_track(self, track_id: str):
        metadata = self.read_metadata(track_id)
        flowmap_path = self._flowmap_path(track_id)
        if metadata is None or not flowmap_path.exists():
            raise FileNotFoundError(track_id)
        flowmap = json.loads(flowmap_path.read_text(encoding="utf-8"))
        audio_path = Path(flowmap.get("metadata", {}).get("audio_path", ""))
        vocals_path = self.track_dir(track_id) / "vocals.wav"
        return flowmap, audio_path, vocals_path if vocals_path.exists() else None, metadata

    def delete_track(self, track_id: str) -> None:
        track_dir = self.track_dir(track_id)
        if not track_dir.exists() or not track_dir.is_dir():
            raise FileNotFoundError(track_id)
        shutil.rmtree(track_dir)

    def track_dir(self, track_id: str) -> Path:
        return self.root / track_id

    def _metadata_path(self, track_id: str) -> Path:
        return self.track_dir(track_id) / "metadata.json"

    def _flowmap_path(self, track_id: str) -> Path:
        return self.track_dir(track_id) / "flowmap.json"

    def _write_vocals(self, track_dir: Path, vocals_audio) -> Path | None:
        if vocals_audio is None:
            return None
        import soundfile as sf
        vocals_path = track_dir / "vocals.wav"
        sf.write(vocals_path, vocals_audio.y, vocals_audio.sr)
        return vocals_path

    def _metadata(self, track_id: str, title: str, flowmap: dict[str, Any], vocals_path: Path | None) -> dict[str, Any]:
        return {
            "id": track_id,
            "title": title,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "bpm": flowmap.get("metadata", {}).get("bpm", 0),
            "duration": flowmap.get("metadata", {}).get("duration", 0),
            "bars": len(flowmap.get("bars", [])),
            "syllables": len(flowmap.get("syllables", [])),
            "summary": flowmap.get("summary", {}),
            "has_audio": True,
            "has_vocals": vocals_path is not None,
        }
