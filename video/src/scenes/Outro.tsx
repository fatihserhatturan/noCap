import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { APPLE, PlatformCard, WINDOWS, useLand } from '../components/PlatformCard';
import { COLORS, FONTS } from '../theme';
import { BEAT, OUTRO_BAR, bars } from '../timeline';

/** Moments (frames from the outro start) where elements land, for the sound effects. */
export const OUTRO_BEATS = {
  logo: 0,
  line: Math.round(BEAT * 2),
  mac: bars(1),
  windows: bars(1) + Math.round(BEAT * 2),
  free: bars(2),
  url: bars(2) + Math.round(BEAT * 2),
  final: bars(28 - OUTRO_BAR),
};

/** Closing card over the receding app: logo, line, a download card per platform, the site. */
export function Outro() {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const logo = useLand(OUTRO_BEATS.logo, 11);
  const line = useLand(OUTRO_BEATS.line);
  const free = useLand(OUTRO_BEATS.free);
  const url = useLand(OUTRO_BEATS.url);
  const final = frame >= OUTRO_BEATS.final ? Math.exp(-(frame - OUTRO_BEATS.final) / 8) : 0;
  const dim = interpolate(frame, [0, 16], [0, 1], { extrapolateRight: 'clamp' });
  const fadeOut = interpolate(frame, [durationInFrames - 30, durationInFrames - 1], [0, 1], { extrapolateLeft: 'clamp' });

  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse 65% 60% at 50% 50%, rgba(10,10,11,0.86) 0%, rgba(10,10,11,0.6) 100%)', opacity: dim }} />
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', perspective: 1200, transform: `scale(${1 + final * 0.03})` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 28, opacity: Math.min(1, logo * 2), transform: `scale(${1.6 - 0.6 * logo})` }}>
          <Img src={staticFile('app-icon.png')} style={{ width: 132, height: 132 }} />
          <div style={{ fontFamily: FONTS.display, fontWeight: 700, fontSize: 116, letterSpacing: '-0.04em', color: COLORS.text, lineHeight: 1 }}>
            no<span style={{ color: COLORS.accent }}>Cap</span>
          </div>
        </div>
        <div style={{ marginTop: 22, fontFamily: FONTS.body, fontSize: 38, color: COLORS.text2, opacity: line, transform: `translateY(${(1 - line) * 20}px)` }}>
          See how a rapper rides the beat.
        </div>
        <div style={{ display: 'flex', gap: 32, marginTop: 64 }}>
          <PlatformCard at={OUTRO_BEATS.mac} icon={APPLE} name="macOS" detail="Apple Silicon · M1 or later" />
          <PlatformCard at={OUTRO_BEATS.windows} icon={WINDOWS} name="Windows" detail="Windows 10 & 11 · 64-bit" badge="NEW" />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 22, marginTop: 52 }}>
          <div style={{ padding: '10px 22px', borderRadius: 999, border: `1px solid ${COLORS.accent}`, color: COLORS.accent, fontFamily: FONTS.mono, fontWeight: 500, fontSize: 24, letterSpacing: '0.08em', opacity: free, transform: `scale(${0.8 + 0.2 * free})` }}>
            FREE & OPEN SOURCE
          </div>
          <div style={{ fontFamily: FONTS.mono, fontWeight: 500, fontSize: 30, color: COLORS.text, opacity: url, transform: `translateX(${(1 - url) * -20}px)` }}>
            fatihserhatturan.github.io/noCap
          </div>
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ background: 'radial-gradient(circle at 50% 50%, rgba(255,120,60,0.5), transparent 60%)', opacity: final * 0.6, mixBlendMode: 'screen' }} />
      <AbsoluteFill style={{ background: '#000', opacity: fadeOut }} />
    </AbsoluteFill>
  );
}
