import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLORS } from '../theme';
import { bars } from '../timeline';
import { SECTIONS } from './timeline';
import { headline } from './type';

const TEXT = 'So we put it on a grid.';
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/** Moments for the sound effects (absolute frames). */
export const TYPE_AT = bars(SECTIONS.type + 0.25);
const PER_CHAR = 2;
export const TYPE_FRAMES = Array.from(TEXT, (ch, i) => (ch === ' ' ? -1 : TYPE_AT + i * PER_CHAR)).filter((f) => f >= 0 && f % 4 === 0);
export const CLICK_AT = bars(SECTIONS.type + 1.5);

/** A glossy 3D-ish pointer. */
function Pointer({ press }: { press: number }) {
  return (
    <svg width="120" height="120" viewBox="0 0 48 48" style={{ transform: `scale(${1 - press * 0.15})`, filter: 'drop-shadow(0 14px 24px rgba(0,0,0,0.55))' }}>
      <defs>
        <linearGradient id="ptr" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffd7c6" />
          <stop offset="0.5" stopColor={COLORS.accent2} />
          <stop offset="1" stopColor={COLORS.accent} />
        </linearGradient>
      </defs>
      <path d="M8 4 L40 22 L25 25 L33 41 L27 44 L19 28 L8 38 Z" fill="url(#ptr)" stroke="rgba(255,255,255,0.85)" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  );
}

/** Bars 2–4: a glowing search-style pill types the answer; a pointer flies in and clicks. */
export function TypeBox() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const at = bars(SECTIONS.type);
  if (frame < at - 2 || frame >= bars(SECTIONS.logo)) return null;

  const open = spring({ frame: frame - at, fps, config: { damping: 18, mass: 0.8 } });
  const width = 150 + open * 950;
  const chars = Math.max(0, Math.min(TEXT.length, Math.floor((frame - TYPE_AT) / PER_CHAR) + 1));
  const caret = Math.floor(frame / 8) % 2 === 0 || chars < TEXT.length;
  const sweep = (frame * 4) % 360;

  const fly = interpolate(frame, [CLICK_AT - 22, CLICK_AT - 2], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const press = interpolate(frame, [CLICK_AT - 2, CLICK_AT, CLICK_AT + 5], [0, 1, 0], clamp);
  const flash = interpolate(frame, [CLICK_AT, CLICK_AT + 12], [1, 0], clamp) * (frame >= CLICK_AT ? 1 : 0);
  const pointerX = interpolate(fly, [0, 1], [760, width / 2 - 70]);
  const pointerY = interpolate(fly, [0, 1], [420, 34]);

  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'relative', width, height: 150, transform: `scale(${1 - press * 0.03})`, opacity: Math.min(1, open * 2) }}>
        {/* Glowing rim: a rotating light behind a 2px border. */}
        <div
          style={{
            position: 'absolute',
            inset: -2,
            borderRadius: 999,
            background: `conic-gradient(from ${sweep}deg, transparent 0deg, ${COLORS.accent} 60deg, ${COLORS.pink} 110deg, transparent 170deg, transparent 360deg)`,
            filter: 'blur(1px)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: -30,
            borderRadius: 999,
            background: `conic-gradient(from ${sweep}deg, transparent 0deg, rgba(255,61,0,0.55) 70deg, rgba(255,79,154,0.4) 120deg, transparent 180deg)`,
            filter: 'blur(40px)',
            opacity: 0.8 + flash * 0.2,
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 999,
            background: `linear-gradient(180deg, #121215, #070708)`,
            boxShadow: `inset 0 1px 0 rgba(255,255,255,0.12), 0 0 ${flash * 80}px rgba(255,109,0,${flash * 0.7})`,
            display: 'flex',
            alignItems: 'center',
            padding: '0 64px',
            overflow: 'hidden',
          }}
        >
          <span style={{ ...headline(62), fontWeight: 600, color: COLORS.text, letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>
            {TEXT.slice(0, chars)}
          </span>
          <span style={{ width: 5, height: 70, marginLeft: 6, borderRadius: 3, background: COLORS.accent, opacity: caret && open > 0.6 ? 1 : 0 }} />
        </div>
        {fly > 0 && (
          <div style={{ position: 'absolute', left: '50%', top: '50%', transform: `translate(${pointerX}px, ${pointerY}px)`, opacity: Math.min(1, fly * 3) }}>
            <Pointer press={press} />
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
}
