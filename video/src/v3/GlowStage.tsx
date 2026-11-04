import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { kick } from '../beat';
import { COLORS } from '../theme';
import { bars } from '../timeline';
import { SECTIONS } from './timeline';

/** How light the stage is (0 dark, 1 white): white for the breakdown section only. */
export function lightness(frame: number): number {
  const on = bars(SECTIONS.light);
  const off = bars(SECTIONS.words - 0.125);
  return interpolate(frame, [on - 6, on + 4, off - 4, off], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
}

/** How strong the glow is per section: full on the hook and the words, dim behind the app. */
function glowLevel(frame: number): number {
  return interpolate(
    frame,
    [0, bars(1), bars(SECTIONS.screen), bars(SECTIONS.screen + 1), bars(SECTIONS.words), bars(SECTIONS.words) + 8, bars(29), bars(30.5)],
    [0.2, 1, 1, 0.55, 0.55, 1, 0.9, 0.15],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );
}

function Blob({ x, y, w, h, color, opacity }: { x: number; y: number; w: number; h: number; color: string; opacity: number }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: `${x - w / 2}%`,
        top: `${y - h / 2}%`,
        width: `${w}%`,
        height: `${h}%`,
        borderRadius: '50%',
        background: `radial-gradient(closest-side, ${color} 0%, transparent 100%)`,
        opacity,
      }}
    />
  );
}

/** The stage: near-black (or white) with soft blurred light rising from the bottom edge,
 *  drifting slowly and breathing with the kick. */
export function GlowStage() {
  const frame = useCurrentFrame();
  const light = lightness(frame);
  const level = glowLevel(frame) * (1 + kick(frame) * 0.12);
  const t = frame / 30;
  const drift = (speed: number, range: number, phase = 0) => Math.sin(t * speed + phase) * range;

  return (
    <AbsoluteFill style={{ background: COLORS.bg }}>
      <AbsoluteFill style={{ background: '#f6f3f1', opacity: light }} />
      <AbsoluteFill style={{ filter: 'blur(70px)', opacity: Math.min(1, level) }}>
        <Blob x={50 + drift(0.35, 8)} y={106} w={90} h={72} color={COLORS.accent} opacity={0.95 - light * 0.35} />
        <Blob x={20 + drift(0.27, 6, 1)} y={110} w={62} h={64} color={COLORS.violet} opacity={0.8 - light * 0.35} />
        <Blob x={80 + drift(0.31, 7, 2)} y={110} w={62} h={64} color={COLORS.pink} opacity={0.7 - light * 0.2} />
        <Blob x={55 + drift(0.22, 10, 3)} y={100} w={50} h={34} color={COLORS.accent2} opacity={0.8 - light * 0.3} />
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)',
          backgroundSize: '6px 6px',
          opacity: 0.35 * (1 - light),
          maskImage: 'linear-gradient(to bottom, black, transparent 70%)',
        }}
      />
    </AbsoluteFill>
  );
}
