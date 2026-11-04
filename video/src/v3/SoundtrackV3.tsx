import { Audio, Sequence, staticFile } from 'remotion';
import { DROPS, GAPS } from './beat';
import marks from '../marks.json';
import { FPS, bars } from '../timeline';
import { REPORT_AT } from './FloatingCards';
import { SENTENCE_FRAMES } from './Hook';
import { LIGHT_BEATS } from './LightSection';
import { OUTRO_V3 } from './OrbitOutro';
import { CLICK_AT, TYPE_FRAMES } from './TypeBox';
import { LYRICS, SCREEN, SECTIONS, frameOfSource } from './timeline';
import { WORD_BARS } from './Words';

type Sound = 'click' | 'whoosh' | 'pop' | 'riser' | 'impact' | 'chime' | 'subdrop' | 'glitch' | 'whip' | 'tick';
type Hit = { at: number; sound: Sound; volume: number };

const RISER_SECONDS = 3.4;

/** Every sound effect of promo v3 with the frame it starts on, over the kontraa cut. */
function hits(): Hit[] {
  const list: Hit[] = [
    { at: bars(SECTIONS.logo), sound: 'impact', volume: 0.3 },
    { at: CLICK_AT, sound: 'click', volume: 0.5 },
    { at: OUTRO_V3.icon, sound: 'chime', volume: 0.3 },
    { at: OUTRO_V3.final, sound: 'subdrop', volume: 0.3 },
  ];
  for (const at of SENTENCE_FRAMES) list.push({ at, sound: 'tick', volume: 0.3 });
  for (const at of TYPE_FRAMES) list.push({ at, sound: 'tick', volume: 0.14 });
  for (const gap of GAPS) list.push({ at: gap - Math.round(RISER_SECONDS * FPS), sound: 'riser', volume: 0.35 });
  for (const at of DROPS) {
    list.push({ at, sound: 'subdrop', volume: 0.15 });
    list.push({ at, sound: 'glitch', volume: 0.25 });
  }
  for (const bar of [SECTIONS.screen, SECTIONS.cards, SECTIONS.light, SECTIONS.outro]) list.push({ at: bars(bar) - 8, sound: 'whoosh', volume: 0.35 });
  list.push({ at: REPORT_AT - 8, sound: 'whip', volume: 0.3 });
  for (const s of SCREEN.slice(1)) list.push({ at: bars(s.bar) + 4, sound: 'pop', volume: 0.2 });
  for (const at of LIGHT_BEATS.slice(1)) list.push({ at, sound: 'pop', volume: 0.3 });
  for (const bar of WORD_BARS.slice(1)) list.push({ at: bars(bar) - 3, sound: 'whip', volume: 0.32 });
  for (const t of marks.clicks) {
    const at = frameOfSource(SCREEN, t) ?? frameOfSource([LYRICS], t);
    if (at !== null) list.push({ at, sound: 'click', volume: 0.4 });
  }
  for (const key of ['name', 'mac', 'windows', 'free', 'url'] as const) list.push({ at: OUTRO_V3[key], sound: 'pop', volume: 0.3 });
  return list.filter((h) => h.at >= 0);
}

export function SoundtrackV3() {
  return (
    <>
      <Audio src={staticFile('audio/music.wav')} volume={0.55} />
      {hits().map((hit, i) => (
        <Sequence key={i} from={hit.at} layout="none">
          <Audio src={staticFile(`audio/${hit.sound}.wav`)} volume={hit.volume} />
        </Sequence>
      ))}
    </>
  );
}
