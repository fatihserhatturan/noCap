import { Easing, interpolate } from 'remotion';
import { FPS, SOURCE, bars } from '../timeline';

/** Promo v3 runs on the same 30-bar beat as v2 (drops on bars 4 and 22, breakdown on
 *  bars 18–21). Each section starts on a bar line. */
export const SECTIONS = {
  hook: 0,
  type: 2,
  logo: 4,
  screen: 5,
  cards: 13,
  light: 18,
  words: 22,
  outro: 25,
} as const;

/** A stretch of the recording (seconds) played across a run of bars. */
export type Segment = { bar: number; bars: number; from: number; to: number; kicker: string; title: string };

/** The app on the neon screen: analysis, flow map, rhymes, pocket, inspector, zoom. */
export const SCREEN: Segment[] = [
  { bar: 5, bars: 2, from: 0.395, to: 10.627, kicker: 'Analyze', title: 'Drop a track. Watch it listen.' },
  { bar: 7, bars: 2, from: 10.627, to: 21.235, kicker: 'Flow map', title: 'Every syllable, on the beat.' },
  { bar: 9, bars: 2, from: 21.235, to: 30.552, kicker: 'Pocket', title: 'Ahead of the beat, or behind it.' },
  { bar: 11, bars: 2, from: 30.552, to: 35.473, kicker: 'Smart zoom', title: 'One syllable, or the whole verse.' },
];

/** The Lyrics card among the floating cards: edit a word, save, export. */
export const LYRICS: Segment = { bar: 13.3, bars: 4.2, from: 35.473, to: 49.827, kicker: 'Lyrics', title: 'Read it. Fix it. Export it.' };

const RAMP = 0.3;

/** Speed ramp: eases out of the cut, rushes through the middle, eases into the next. */
const ramp = (p: number) => p - (RAMP / (2 * Math.PI)) * Math.sin(2 * Math.PI * p);

/** Moment of the recording (seconds) shown at a frame, held at the ends of the segments. */
export function footageTime(segments: Segment[], frame: number): number {
  for (const s of segments) {
    const start = bars(s.bar);
    const end = bars(s.bar + s.bars);
    if (frame < start) return s.from;
    if (frame < end) return s.from + (s.to - s.from) * ramp((frame - start) / (end - start));
  }
  return segments[segments.length - 1].to;
}

/** Recording frame for `Freeze` (the recording is played back at the composition's fps). */
export const sourceFrame = (seconds: number) => Math.round(seconds * FPS);

/** Composition frame at which a moment of the recording appears, or null if it is skipped. */
export function frameOfSource(segments: Segment[], seconds: number): number | null {
  const first = bars(segments[0].bar);
  const last = bars(segments[segments.length - 1].bar + segments[segments.length - 1].bars);
  for (let frame = first; frame < last; frame++) {
    if (footageTime(segments, frame) >= seconds) return frame;
  }
  return null;
}

/** Camera inside the screen: the point of the app (CSS px) at the centre, and the zoom. */
export type Shot = { x: number; y: number; zoom: number };
type Key = Shot & { t: number };

const WHOLE: Shot = { x: SOURCE.width / 2, y: SOURCE.height / 2, zoom: 1 };

/** Keys by recording time, so the camera follows what is on screen at any speed. */
const KEYS: Key[] = [
  { t: 0.4, ...WHOLE },
  { t: 1.7, ...WHOLE },
  { t: 2.8, x: 430, y: 330, zoom: 1.6 },
  { t: 9.2, x: 430, y: 330, zoom: 1.6 },
  { t: 10.4, x: 720, y: 740, zoom: 1.4 },
  { t: 11.7, x: 720, y: 740, zoom: 1.4 },
  { t: 13.2, ...WHOLE },
  { t: 15.3, x: 520, y: 300, zoom: 1.7 },
  { t: 19.5, x: 640, y: 300, zoom: 1.7 },
  { t: 21.6, x: 470, y: 470, zoom: 2 },
  { t: 24.8, x: 640, y: 470, zoom: 2 },
  { t: 25.8, x: 520, y: 440, zoom: 1.45 },
  { t: 27.4, x: 1060, y: 340, zoom: 1.8 },
  { t: 30.4, x: 1060, y: 340, zoom: 1.8 },
  { t: 31.4, x: 760, y: 260, zoom: 1.55 },
  { t: 33.6, x: 560, y: 260, zoom: 1.55 },
  { t: 35.4, ...WHOLE },
];

const ease = Easing.bezier(0.65, 0, 0.35, 1);

/** Keeps the zoomed view inside the app, so no empty edge shows. */
function clamp(shot: Shot): Shot {
  const fit = (v: number, half: number, size: number) => Math.min(size - half, Math.max(half, v));
  return { zoom: shot.zoom, x: fit(shot.x, SOURCE.width / 2 / shot.zoom, SOURCE.width), y: fit(shot.y, SOURCE.height / 2 / shot.zoom, SOURCE.height) };
}

export function shotAt(t: number): Shot {
  if (t <= KEYS[0].t) return clamp(KEYS[0]);
  for (let i = 1; i < KEYS.length; i++) {
    const a = KEYS[i - 1];
    const b = KEYS[i];
    if (t <= b.t) {
      const p = interpolate(t, [a.t, b.t], [0, 1], { easing: ease });
      const mix = (u: number, v: number) => u + (v - u) * p;
      return clamp({ x: mix(a.x, b.x), y: mix(a.y, b.y), zoom: Math.exp(mix(Math.log(a.zoom), Math.log(b.zoom))) });
    }
  }
  return clamp(KEYS[KEYS.length - 1]);
}

/** CSS transform that puts `shot` at the centre of an app-sized box. */
export function shotTransform(shot: Shot): string {
  const x = SOURCE.width / 2 - shot.x * shot.zoom;
  const y = SOURCE.height / 2 - shot.y * shot.zoom;
  return `translate(${x}px, ${y}px) scale(${shot.zoom})`;
}
