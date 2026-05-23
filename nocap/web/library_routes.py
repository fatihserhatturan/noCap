from __future__ import annotations

from nocap.library import LibraryStore

from .state import SessionState


def register_library_routes(app, store: LibraryStore, state: SessionState) -> None:
    from flask import abort

    @app.route("/api/library")
    def library_api():
        return {"tracks": store.list_tracks()}

    @app.route("/api/library/<track_id>/open")
    def library_open_api(track_id: str):
        try:
            flowmap, audio_path, vocals_path, metadata = store.load_track(track_id)
        except FileNotFoundError:
            abort(404)
        state.flowmap = flowmap
        state.set_files(audio_path if audio_path.exists() else None, vocals_path)
        return {
            "flowmap": flowmap,
            "track": metadata,
            "has_audio": audio_path.exists(),
            "has_vocals": vocals_path is not None and vocals_path.exists(),
        }

    @app.route("/api/library/<track_id>", methods=["DELETE"])
    def library_delete_api(track_id: str):
        return _delete(track_id)

    @app.route("/api/library/<track_id>/delete", methods=["POST"])
    def library_delete_post_api(track_id: str):
        return _delete(track_id)

    def _delete(track_id: str):
        try:
            state.clear_if_inside(store.track_dir(track_id))
            store.delete_track(track_id)
        except FileNotFoundError:
            abort(404)
        return {"ok": True}
