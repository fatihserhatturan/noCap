import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { COLORS, FONTS } from '../theme';
import { bars } from '../timeline';
import { SECTIONS } from './timeline';
import { Centered, FILLS, filled, headline, useFocus } from './type';

/** Bars 22–25, after the second drop: one giant word per bar. */
export const WORDS = [
  { word: 'Local.', note: 'Runs 100% on your machine' },
  { word: 'Free.', note: 'No account. No upload.' },
  { word: 'Open.', note: 'MIT licensed, on GitHub' },
];
export const WORD_BARS = WORDS.map((_, i) => SECTIONS.words + i);

function Word({ word, note, bar, last }: { word: string; note: string; bar: number; last: boolean }) {
  const frame = useCurrentFrame();
  const at = bars(bar);
  const focus = useFocus(at - 1, bars(bar + 1) - (last ? 8 : 4), 10);
  const sub = useFocus(at + 6);
  if (!focus.visible) return null;
  const push = 1 + (frame - at) * 0.0012;
  return (
    <Centered y={-30}>
      <div style={{ ...focus.style }}>
        <div style={{ ...headline(330), ...filled(FILLS.glow), letterSpacing: '-0.05em', paddingBottom: 40, transform: `scale(${push})` }}>{word}</div>
      </div>
      <div style={{ ...sub.style, opacity: (sub.style.opacity as number) * (focus.style.opacity as number), fontFamily: FONTS.mono, fontWeight: 500, fontSize: 28, letterSpacing: '0.14em', textTransform: 'uppercase', color: COLORS.text2, marginTop: -10 }}>
        {note}
      </div>
    </Centered>
  );
}

export function Words() {
  return (
    <AbsoluteFill>
      {WORDS.map((w, i) => (
        <Word key={w.word} word={w.word} note={w.note} bar={WORD_BARS[i]} last={i === WORDS.length - 1} />
      ))}
    </AbsoluteFill>
  );
}
