/** Promo v3 reads its hits from the kontraa cut (`audio/cut_music.py`), not the v2 beat. */
import beatmap from './beatmap.json';
import { FPS } from '../timeline';

const KICKS = beatmap.kicks.map((s) => s * FPS);
const CLAPS = beatmap.claps.map((s) => s * FPS);
export const DROPS = beatmap.drops.map((s) => Math.round(s * FPS));
export const GAPS = beatmap.gaps.map((s) => Math.round(s * FPS));

/** 1 on a hit, decaying over `decay` frames until the next one; 0 before the first. */
function envelope(hits: number[], frame: number, decay: number): number {
  let last = -Infinity;
  for (const at of hits) {
    if (at > frame) break;
    last = at;
  }
  return last === -Infinity ? 0 : Math.exp(-(frame - last) / decay);
}

/** Every visual beat reaction reads from these, so the picture moves with the music. */
export const kick = (frame: number) => envelope(KICKS, frame, 5);
export const clap = (frame: number) => envelope(CLAPS, frame, 6);
export const drop = (frame: number) => envelope(DROPS, frame, 9);

/** A small, deterministic shake after kicks and drops (px). */
export function shake(frame: number): { x: number; y: number } {
  const amount = kick(frame) * 3 + drop(frame) * 16;
  return { x: Math.sin(frame * 12.9898) * amount, y: Math.cos(frame * 78.233) * amount };
}
