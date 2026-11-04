import { AbsoluteFill, Easing, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { APPLE, PlatformCard, WINDOWS, useLand } from '../components/PlatformCard';
import { COLORS, FONTS } from '../theme';
import { BEAT, bars } from '../timeline';
import { SECTIONS } from './timeline';
import { FILLS, filled, headline } from './type';

const O = SECTIONS.outro;
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/** Moments (absolute frames) where outro elements land, for the sound effects. */
export const OUTRO_V3 = {
  icon: bars(O),
  name: bars(O + 1),
  mac: bars(O + 1.5),
  windows: bars(O + 1.5) + Math.round(BEAT),
  free: bars(O + 2.5),
  url: bars(O + 2.5) + Math.round(BEAT),
  final: bars(28),
};

const ORBITS = [
  { r: 230, speed: 0.9, orbs: [0.2, 2.6] },
  { r: 380, speed: -0.6, orbs: [1.3, 4.1] },
  { r: 540, speed: 0.4, orbs: [0.6, 3.4, 5.2] },
];

function Orb({ size }: { size: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: `radial-gradient(circle at 32% 28%, #fff 0%, #ffd0bd 20%, ${COLORS.pink} 55%, ${COLORS.violet} 100%)`,
        boxShadow: `0 0 ${size}px rgba(255,79,154,0.6)`,
      }}
    />
  );
}

/** Bar 25: glowing orbs circling the icon on thin rings; the rings open up and the icon
 *  slides into the lockup with the name, then the download cards and the site. */
export function OrbitOutro() {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const at = OUTRO_V3.icon;
  const land = spring({ frame: frame - at, fps, config: { damping: 12, mass: 0.7 } });
  const open = interpolate(frame, [OUTRO_V3.name - 6, OUTRO_V3.name + 18], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const name = spring({ frame: frame - OUTRO_V3.name, fps, config: { damping: 18 } });
  const line = useLand(OUTRO_V3.name + Math.round(BEAT * 2));
  const free = useLand(OUTRO_V3.free);
  const url = useLand(OUTRO_V3.url);
  const final = frame >= OUTRO_V3.final ? Math.exp(-(frame - OUTRO_V3.final) / 10) : 0;
  const fadeOut = interpolate(frame, [durationInFrames - 36, durationInFrames - 1], [0, 1], clamp);
  const t = (frame - at) / 30;
  if (frame < at - 2) return null;

  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', opacity: 1 - open, transform: `scale(${0.85 + land * 0.15 + open * 0.9})`, filter: `blur(${open * 12}px)` }}>
        {ORBITS.map((o, i) => (
          <div key={i} style={{ position: 'absolute', width: o.r * 2, height: o.r * 2, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.1)', opacity: land }}>
            {o.orbs.map((phase, j) => {
              const a = phase + t * o.speed;
              return (
                <div key={j} style={{ position: 'absolute', left: o.r + Math.cos(a) * o.r - 22, top: o.r + Math.sin(a) * o.r - 22 }}>
                  <Orb size={28 + ((i + j) % 3) * 10} />
                </div>
              );
            })}
          </div>
        ))}
      </AbsoluteFill>

      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', transform: `translateY(${-open * 190}px) scale(${1 + final * 0.03})` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 34 * name }}>
          <Img
            src={staticFile('app-icon.png')}
            style={{ width: 170 - open * 40, height: 170 - open * 40, opacity: Math.min(1, land * 2), transform: `scale(${1.6 - 0.6 * land})`, filter: `drop-shadow(0 0 ${50 - open * 20}px rgba(255,61,0,0.65))` }}
          />
          <div style={{ overflow: 'hidden', maxWidth: name * 520 }}>
            <div style={{ ...headline(120), color: COLORS.text, letterSpacing: '-0.045em', transform: `translateX(${(1 - name) * -120}px)`, opacity: name, whiteSpace: 'nowrap' }}>
              no<span style={filled(FILLS.hot)}>Cap</span>
            </div>
          </div>
        </div>
        <div style={{ marginTop: 18, fontFamily: FONTS.body, fontSize: 36, color: COLORS.text2, opacity: line, filter: `blur(${(1 - line) * 8}px)` }}>See how a rapper rides the beat.</div>
      </AbsoluteFill>

      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', perspective: 1200, transform: 'translateY(190px)' }}>
        <div style={{ display: 'flex', gap: 32 }}>
          <PlatformCard at={OUTRO_V3.mac} icon={APPLE} name="macOS" detail="Apple Silicon · M1 or later" />
          <PlatformCard at={OUTRO_V3.windows} icon={WINDOWS} name="Windows" detail="Windows 10 & 11 · 64-bit" badge="NEW" />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 22, marginTop: 48 }}>
          <div style={{ padding: '10px 22px', borderRadius: 999, border: `1px solid ${COLORS.accent}`, color: COLORS.accent, fontFamily: FONTS.mono, fontWeight: 500, fontSize: 24, letterSpacing: '0.08em', opacity: free, transform: `scale(${0.8 + 0.2 * free})` }}>
            FREE & OPEN SOURCE
          </div>
          <div style={{ fontFamily: FONTS.mono, fontWeight: 500, fontSize: 30, color: COLORS.text, opacity: url, transform: `translateX(${(1 - url) * -20}px)` }}>fatihserhatturan.github.io/noCap</div>
        </div>
      </AbsoluteFill>

      <AbsoluteFill style={{ background: 'radial-gradient(circle at 50% 40%, rgba(255,120,60,0.5), transparent 60%)', opacity: final * 0.6, mixBlendMode: 'screen' }} />
      <AbsoluteFill style={{ background: '#000', opacity: fadeOut }} />
    </AbsoluteFill>
  );
}
