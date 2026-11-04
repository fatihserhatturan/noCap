import { AbsoluteFill, Easing, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLORS } from '../theme';
import { BEAT, bars } from '../timeline';
import { SECTIONS } from './timeline';
import { Centered, FILLS, SlideWords, filled, headline, useFocus } from './type';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/** Frames where the sentence's words land (tick sounds). */
export const SENTENCE_AT = bars(1.5);
export const SENTENCE_WORDS = ['Flow', 'is', 'hard', 'to', 'explain.'];
export const SENTENCE_FRAMES = SENTENCE_WORDS.map((_, i) => SENTENCE_AT + Math.round((i * BEAT) / 2));

/** Bar 0: one giant word fills the frame, then pulls back into a sentence. */
function GiantWord() {
  const frame = useCurrentFrame();
  const focus = useFocus(4, undefined, 26);
  const leave = interpolate(frame, [SENTENCE_AT - 8, SENTENCE_AT + 2], [0, 1], { ...clamp, easing: Easing.in(Easing.cubic) });
  if (leave >= 1) return null;
  const drift = interpolate(frame, [0, SENTENCE_AT], [1.06, 1]);
  return (
    <Centered y={-20}>
      <div style={focus.style}>
        <div
          style={{
            ...headline(470),
            ...filled(FILLS.glow),
            letterSpacing: '-0.05em',
            paddingBottom: 60,
            transform: `scale(${drift * (1 - leave * 0.75)})`,
            filter: `blur(${leave * 20}px)`,
            opacity: 1 - leave,
          }}
        >
          Flow
        </div>
      </div>
    </Centered>
  );
}

function Sentence() {
  const frame = useCurrentFrame();
  if (frame < SENTENCE_AT - 2 || frame > bars(SECTIONS.type) + 10) return null;
  const out = interpolate(frame, [bars(SECTIONS.type) - 4, bars(SECTIONS.type) + 6], [0, 1], clamp);
  return (
    <Centered>
      <div style={{ opacity: 1 - out, filter: `blur(${out * 16}px)`, transform: `scale(${1 - out * 0.1})` }}>
        <SlideWords words={SENTENCE_WORDS} at={SENTENCE_AT} step={BEAT / 2} size={104} accent={[0]} />
      </div>
    </Centered>
  );
}

/** Bar 4, the drop: the logo slams in over a giant ghost word. */
export function LogoHit() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const at = bars(SECTIONS.logo);
  const end = bars(SECTIONS.screen) + 2;
  if (frame < at - 1 || frame > end + 12) return null;
  const land = spring({ frame: frame - at, fps, config: { damping: 11, mass: 0.6 } });
  const ghost = interpolate(frame, [at, end + 10], [1.15, 1]);
  const out = interpolate(frame, [end - 6, end + 10], [0, 1], { ...clamp, easing: Easing.in(Easing.cubic) });
  return (
    <AbsoluteFill style={{ opacity: 1 - out, filter: `blur(${out * 20}px)` }}>
      <Centered>
        <div
          style={{
            ...headline(560),
            letterSpacing: '-0.04em',
            color: 'transparent',
            WebkitTextStroke: '2px rgba(255,255,255,0.07)',
            transform: `scale(${ghost})`,
            opacity: Math.min(1, land * 1.5),
          }}
        >
          FLOW
        </div>
      </Centered>
      <Centered>
        <div style={{ display: 'flex', alignItems: 'center', gap: 40, opacity: Math.min(1, land * 2), transform: `scale(${(1.5 - 0.5 * land) * (1 - out * 0.15)})` }}>
          <Img src={staticFile('app-icon.png')} style={{ width: 190, height: 190, filter: `drop-shadow(0 0 ${30 + (1 - land) * 60}px rgba(255,61,0,0.6))` }} />
          <div style={{ ...headline(180), color: COLORS.text, letterSpacing: '-0.045em' }}>
            no<span style={filled(FILLS.hot)}>Cap</span>
          </div>
        </div>
      </Centered>
    </AbsoluteFill>
  );
}

export function Hook() {
  return (
    <AbsoluteFill>
      <GiantWord />
      <Sentence />
    </AbsoluteFill>
  );
}
