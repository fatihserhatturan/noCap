import type { ReactNode } from 'react';
import { AbsoluteFill, Easing, Freeze, interpolate, OffthreadVideo, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { kick } from '../beat';
import { COLORS } from '../theme';
import { SOURCE, bars } from '../timeline';
import { Label } from './Label';
import { SCREEN, SECTIONS, footageTime, shotAt, shotTransform, sourceFrame } from './timeline';

export const CLIP = staticFile('clips/walkthrough.mp4');
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/** The recording frozen at `seconds`, framed by `transform` inside an app-sized box. */
export function Footage({ seconds, transform }: { seconds: number; transform?: string }) {
  return (
    <div style={{ position: 'absolute', inset: 0, transformOrigin: '0 0', transform }}>
      <Freeze frame={sourceFrame(seconds)}>
        <OffthreadVideo src={CLIP} muted style={{ position: 'absolute', inset: 0, width: SOURCE.width, height: SOURCE.height }} />
      </Freeze>
    </div>
  );
}

/** An app-sized panel with a glowing, slowly rotating rim of light. */
export function NeonFrame({ children, glow = 1, radius = 22 }: { children: ReactNode; glow?: number; radius?: number }) {
  const frame = useCurrentFrame();
  const sweep = (frame * 1.6) % 360;
  const rim = `conic-gradient(from ${sweep}deg, ${COLORS.accent} 0deg, ${COLORS.pink} 70deg, rgba(255,255,255,0.25) 120deg, ${COLORS.violet} 200deg, rgba(255,255,255,0.12) 260deg, ${COLORS.accent2} 360deg)`;
  return (
    <div style={{ position: 'relative', width: SOURCE.width, height: SOURCE.height }}>
      <div style={{ position: 'absolute', inset: -14, borderRadius: radius + 14, background: rim, filter: 'blur(40px)', opacity: 0.55 * glow }} />
      <div style={{ position: 'absolute', inset: -3, borderRadius: radius + 3, background: rim, opacity: 0.9 }} />
      <div style={{ position: 'absolute', inset: 0, borderRadius: radius, overflow: 'hidden', background: COLORS.bg, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.15)' }}>{children}</div>
    </div>
  );
}

/** Thin guide lines running out from the panel's edges, like a designer's canvas. */
function GuideLines() {
  const line = (style: React.CSSProperties) => <div style={{ position: 'absolute', background: 'rgba(255,255,255,0.12)', ...style }} />;
  const far = 4000;
  return (
    <>
      {[-1, -40].map((d) => line({ left: -far, width: SOURCE.width + far * 2, top: d, height: 1 }))}
      {[SOURCE.height, SOURCE.height + 40].map((d) => line({ left: -far, width: SOURCE.width + far * 2, top: d, height: 1 }))}
      {[-1, -40].map((d) => line({ top: -far, height: SOURCE.height + far * 2, left: d, width: 1 }))}
      {[SOURCE.width, SOURCE.width + 40].map((d) => line({ top: -far, height: SOURCE.height + far * 2, left: d, width: 1 }))}
    </>
  );
}

/** Bars 5–13: the app on a tilted, neon-rimmed screen; the camera inside follows the
 *  recording (zooms keyed by recording time). */
export function NeonScreen() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const start = bars(SECTIONS.screen);
  const end = bars(SECTIONS.cards);
  if (frame < start - 10 || frame > end + 14) return null;

  const enter = spring({ frame: frame - start + 8, fps, config: { damping: 18, mass: 1, stiffness: 80 } });
  const leave = interpolate(frame, [end - 8, end + 12], [0, 1], { ...clamp, easing: Easing.in(Easing.cubic) });
  const p = (frame - start) / (end - start);
  const rotX = (1 - enter) * 58 + 9 - p * 4 + leave * 10;
  const rotY = (1 - enter) * -8 - 14 + p * 16 + leave * 35;
  const depth = (1 - enter) * -900 - leave * 900;
  const lift = (1 - enter) * 520;
  const punch = 1 + kick(frame) * 0.006;
  const t = footageTime(SCREEN, frame);
  const scale = 1.12;

  return (
    <AbsoluteFill style={{ perspective: 2000, opacity: Math.min(1, enter * 2) * (1 - leave), filter: leave > 0 ? `blur(${leave * 14}px)` : undefined }}>
      <div
        style={{
          position: 'absolute',
          left: (1920 - SOURCE.width) / 2,
          top: (1080 - SOURCE.height) / 2 + 30,
          transformStyle: 'preserve-3d',
          transform: `translateY(${lift}px) translateZ(${depth}px) rotateX(${rotX}deg) rotateY(${rotY}deg) scale(${scale * punch})`,
        }}
      >
        <GuideLines />
        <NeonFrame>
          <Footage seconds={t} transform={shotTransform(shotAt(t))} />
        </NeonFrame>
      </div>
      {SCREEN.map((s, i) => (
        <Label key={s.kicker} index={i + 1} kicker={s.kicker} title={s.title} from={bars(s.bar) + 4} to={bars(s.bar + s.bars) - 2} />
      ))}
    </AbsoluteFill>
  );
}
