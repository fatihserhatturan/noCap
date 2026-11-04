import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLORS, FONTS } from '../theme';
import { headline } from './type';

type Props = { kicker: string; title: string; from: number; to: number; index?: number; dark?: boolean };

/** A small headline in the lower left: kicker pill, then the line coming into focus. */
export function Label({ kicker, title, from, to, index, dark = false }: Props) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < from - 1 || frame > to + 1) return null;
  const p = spring({ frame: frame - from, fps, config: { damping: 20 } });
  const line = spring({ frame: frame - from - 4, fps, config: { damping: 20 } });
  const out = interpolate(frame, [to - 8, to], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <div style={{ position: 'absolute', left: 110, bottom: 90, opacity: 1 - out, filter: `blur(${out * 10}px)` }}>
      {!dark && <div style={{ position: 'absolute', left: -260, right: -260, top: -140, bottom: -150, background: 'radial-gradient(closest-side, rgba(6,6,8,0.85), transparent)', opacity: line }} />}
      <div style={{ position: 'relative' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 12,
            padding: '9px 18px',
            borderRadius: 999,
            background: dark ? 'rgba(20,20,23,0.06)' : 'rgba(255,255,255,0.06)',
            border: `1px solid ${dark ? 'rgba(20,20,23,0.12)' : 'rgba(255,255,255,0.14)'}`,
            backdropFilter: 'blur(12px)',
            fontFamily: FONTS.mono,
            fontWeight: 500,
            fontSize: 20,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: COLORS.accent2,
            opacity: p,
            transform: `translateY(${(1 - p) * 16}px)`,
          }}
        >
          <span style={{ width: 8, height: 8, borderRadius: 4, background: COLORS.accent, boxShadow: `0 0 12px ${COLORS.accent}` }} />
          {index !== undefined && <span style={{ color: dark ? '#6b6b73' : COLORS.text2 }}>{String(index).padStart(2, '0')}</span>}
          {kicker}
        </div>
        <div
          style={{
            ...headline(58),
            fontWeight: 600,
            marginTop: 18,
            color: dark ? '#141416' : COLORS.text,
            textShadow: dark ? undefined : '0 4px 30px rgba(0,0,0,0.6)',
            opacity: line,
            filter: `blur(${(1 - line) * 12}px)`,
            transform: `translateY(${(1 - line) * 20}px)`,
          }}
        >
          {title}
        </div>
      </div>
    </div>
  );
}
