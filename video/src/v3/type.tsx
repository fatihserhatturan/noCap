import type { CSSProperties, ReactNode } from 'react';
import { Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLORS, FONTS } from '../theme';

/** Fills for headline text: white fading into the brand orange, as in the hero glow. */
export const FILLS = {
  glow: `linear-gradient(180deg, #ffffff 25%, #ffd2bf 60%, ${COLORS.accent2} 100%)`,
  hot: `linear-gradient(90deg, ${COLORS.accent} 0%, ${COLORS.accent2} 45%, ${COLORS.pink} 100%)`,
  ink: 'linear-gradient(180deg, #1b1b1f 30%, #5a5a63 100%)',
};

export function filled(fill: string): CSSProperties {
  return { backgroundImage: fill, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' };
}

export const headline = (size: number): CSSProperties => ({
  fontFamily: FONTS.headline,
  fontWeight: 700,
  fontSize: size,
  letterSpacing: '-0.035em',
  lineHeight: 1.05,
});

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/** Comes into focus: from blurred, slightly large and low, to sharp. `at` is the frame it
 *  starts on, `out` (optional) the frame it starts to leave (blurring up and away). */
export function useFocus(at: number, out?: number, length = 14) {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [at, at + length], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const q = out === undefined ? 0 : interpolate(frame, [out, out + 10], [0, 1], { ...clamp, easing: Easing.in(Easing.cubic) });
  return {
    visible: frame >= at - 1 && (out === undefined || frame < out + 11),
    style: {
      opacity: p * (1 - q),
      filter: `blur(${(1 - p) * 24 + q * 18}px)`,
      transform: `translateY(${(1 - p) * 40 - q * 30}px) scale(${1.08 - 0.08 * p + q * 0.04})`,
    } as CSSProperties,
  };
}

/** Words sliding in from the right one after another, with a horizontal smear while moving. */
export function SlideWords({ words, at, step, size, accent = [], dark = false }: { words: string[]; at: number; step: number; size: number; accent?: number[]; dark?: boolean }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: `0 ${size * 0.26}px` }}>
      {words.map((word, i) => {
        const p = spring({ frame: frame - at - Math.round(i * step), fps, config: { damping: 18, mass: 0.7 } });
        const speed = Math.abs(spring({ frame: frame - at - Math.round(i * step) + 1, fps, config: { damping: 18, mass: 0.7 } }) - p);
        const fill = accent.includes(i) ? FILLS.hot : dark ? FILLS.ink : FILLS.glow;
        return (
          <span
            key={i}
            style={{
              ...headline(size),
              ...filled(fill),
              display: 'inline-block',
              paddingBottom: size * 0.12,
              opacity: Math.min(1, p * 1.4),
              transform: `translateX(${(1 - p) * size * 2.2}px)`,
              filter: `blur(${Math.min(16, speed * 160)}px)`,
            }}
          >
            {word}
          </span>
        );
      })}
    </div>
  );
}

export function Centered({ children, y = 0 }: { children: ReactNode; y?: number }) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', transform: `translateY(${y}px)` }}>
      {children}
    </div>
  );
}
