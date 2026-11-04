# noCap promo video

Two 54-second promos (1920×1080, 30 fps), edited in code with [Remotion](https://www.remotion.dev): `Promo` and `PromoV3` (in `src/v3/`).
The footage is a scripted walkthrough: a track is analyzed, explored, its lyrics fixed
and exported. The API is faked during the recording (`capture/mocks.mjs`), so nothing
waits on Whisper and only the demo verse is shown. The soundtrack is a 140 BPM trap
beat with sound effects, all synthesized by the scripts here, so it is royalty-free.

## Rebuild

From the repository root:

```bash
cd frontend && npx vite build && cd ..                        # the UI the recording uses
PYTHONPATH=. .venv/bin/python -m nocap.cli serve --port 5758  # leave running
```

In a second terminal:

```bash
cd video && npm install
node capture/record.mjs                                       # frames + src/marks.json
swift capture/encode.swift capture/frames capture/frames.json public/clips/walkthrough.mp4
../.venv/bin/python audio/make_beat.py && ../.venv/bin/python audio/make_sfx.py
npm run render                                                # out/nocap-promo.mp4
```

`npm run studio` opens the timeline for previewing.

### Promo v3

`PromoV3` reuses the same footage and sound effects, over "Hype | Drill Music" by
kontraa ([Pixabay Content License](https://pixabay.com/service/license-summary/)). The track
is not committed: download it from
[Pixabay](https://pixabay.com/music/trap-hype-drill-music-438398/), then

```bash
../.venv/bin/python audio/cut_music.py path/to/kontraa-hype-drill-music-438398.mp3
npm run render:v3                                             # out/nocap-promo-v3.mp4
```

`cut_music.py` cuts whole bars of the track into the edit's 30-bar shape (both are
140 BPM) and writes `public/audio/music.wav` and `src/v3/beatmap.json`.

## Layout

- `src/timeline.ts`: tempo, scene list, captions and footage timing (with a speed ramp per scene). Scenes start on bar lines.
- `src/beat.ts`: kick, clap and drop envelopes from `src/beatmap.json` (written by `make_beat.py`); the visual hits read from these.
- `src/camera.ts`: camera keyframes (in bars) over the app window.
- `src/Soundtrack.tsx`: the beat, plus each sound effect at its frame. Clicks follow `marks.json`.
- `src/scenes/Hook.tsx`, `src/scenes/Outro.tsx`: the opening type and the closing card with the macOS and Windows downloads.
- `audio/`: beat and sound-effect synthesis (numpy/scipy).
- `capture/`: recording at 2x through the Chrome DevTools screencast (needs `npx tsx` for the demo data), and the H.264 encoder.

The generated footage, audio and renders (`public/clips`, `public/audio`, `out`) are not committed.
