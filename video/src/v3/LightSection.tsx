import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLORS } from '../theme';
import { BEAT, bars } from '../timeline';
import { SECTIONS } from './timeline';
import { Centered, FILLS, SlideWords, filled, headline, useFocus } from './type';

const L = SECTIONS.light;
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/** Bars where each part of the white section starts (pop sounds). */
export const LIGHT_BEATS = [bars(L), bars(L + 1), bars(L + 1.5), bars(L + 2), bars(L + 3)];
const ORBIT = ['Rhymes', 'Pocket', 'Density', 'Syncopation', 'Tempo'];
export const LIST = ['Flow map', 'Rhyme groups', 'Pocket timing', 'Lyrics export', 'Report'];

/** Bar 18: the line, dark on white, with the payoff in the hot gradient. */
function Line() {
  const focus = useFocus(bars(L) - 2, bars(L + 1) - 6);
  if (!focus.visible) return null;
  return (
    <Centered>
      <div style={focus.style}>
        <SlideWords words={['Every', 'syllable,', 'on', 'the', 'beat.']} at={bars(L)} step={BEAT / 2} size={112} accent={[2, 3, 4]} dark />
      </div>
    </Centered>
  );
}

/** Bar 19: a pill in nested rings; its text flips halfway through. */
function RingPill() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const at = bars(L + 1);
  const focus = useFocus(at - 2, bars(L + 2) - 6);
  if (!focus.visible) return null;
  const grow = spring({ frame: frame - at, fps, config: { damping: 16 } });
  const flip = interpolate(frame, [bars(L + 1.5) - 4, bars(L + 1.5) + 4], [0, 1], clamp);
  const rings = [
    { pad: 150, alpha: 0.18 },
    { pad: 90, alpha: 0.3 },
    { pad: 40, alpha: 0.55 },
  ];
  const text = (label: string, shown: number, dir: number) => (
    <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', opacity: shown, transform: `translateY(${(1 - shown) * 60 * dir}px)`, filter: `blur(${(1 - shown) * 10}px)` }}>
      <span style={{ ...headline(92), ...filled(FILLS.hot), paddingBottom: 10 }}>{label}</span>
    </div>
  );
  return (
    <Centered>
      <div style={{ ...focus.style, position: 'relative', width: 820, height: 220 }}>
        {rings.map((r, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              inset: -r.pad * grow,
              borderRadius: 999,
              background: `rgba(255, 109, 0, ${r.alpha * 0.35})`,
              border: `1px solid rgba(255, 61, 0, ${r.alpha * 0.5})`,
            }}
          />
        ))}
        <div style={{ position: 'absolute', inset: 0, borderRadius: 999, background: 'linear-gradient(180deg, #fff, #ffe9de)', boxShadow: '0 30px 80px rgba(255,61,0,0.35), inset 0 2px 0 #fff' }} />
        {text('16th-note grid', 1 - flip, -1)}
        {text('Pocket in ms', flip, 1)}
      </div>
    </Centered>
  );
}

/** Bar 20: a glass sphere with the metrics orbiting it. */
function Sphere() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const at = bars(L + 2);
  const focus = useFocus(at - 2, bars(L + 3) - 6);
  if (!focus.visible) return null;
  const grow = spring({ frame: frame - at, fps, config: { damping: 14 } });
  const spin = (frame - at) / 34;
  return (
    <Centered>
      <div style={{ ...focus.style, position: 'relative', width: 1400, height: 600 }}>
        {ORBIT.map((word, i) => {
          const a = spin + (i / ORBIT.length) * Math.PI * 2;
          const z = Math.sin(a);
          return (
            <div
              key={word}
              style={{
                position: 'absolute',
                left: 700 + Math.cos(a) * 520 * grow,
                top: 300 + z * 70,
                transform: `translate(-50%, -50%) scale(${0.75 + (z + 1) * 0.2})`,
                zIndex: z > 0 ? 3 : 1,
                opacity: 0.35 + (z + 1) * 0.32,
                filter: `blur(${z < 0 ? -z * 3 : 0}px)`,
                ...headline(60),
                fontWeight: 600,
                color: z > 0.2 ? '#18181b' : '#7a7a83',
              }}
            >
              {word}
            </div>
          );
        })}
        <div
          style={{
            position: 'absolute',
            left: 700 - 150,
            top: 300 - 150,
            width: 300,
            height: 300,
            zIndex: 2,
            borderRadius: '50%',
            transform: `scale(${grow})`,
            background: `radial-gradient(circle at 35% 30%, #fff 0%, #ffd9c7 18%, ${COLORS.accent2} 48%, ${COLORS.accent} 70%, ${COLORS.violet} 100%)`,
            boxShadow: `0 0 0 26px rgba(255,109,0,0.12), 0 0 0 60px rgba(255,109,0,0.06), 0 40px 120px rgba(255,61,0,0.45)`,
          }}
        />
      </div>
    </Centered>
  );
}

/** Bar 21: a list stepping up one item per beat; the middle one is lit. */
function List() {
  const frame = useCurrentFrame();
  const at = bars(L + 3);
  const focus = useFocus(at - 2);
  if (!focus.visible || frame > bars(SECTIONS.words)) return null;
  const step = interpolate(frame, [at, at + BEAT * 3.4], [0, LIST.length - 1], clamp);
  return (
    <Centered>
      <div style={{ ...focus.style, position: 'relative', width: 1000, height: 500 }}>
        {LIST.map((item, i) => {
          const d = i - step;
          const near = Math.max(0, 1 - Math.abs(d));
          return (
            <div
              key={item}
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: 250 + d * 92,
                transform: `translateY(-50%) scale(${0.62 + near * 0.38})`,
                textAlign: 'center',
                opacity: Math.max(0, 1 - Math.abs(d) * 0.42),
                filter: `blur(${Math.abs(d) * 1.6}px)`,
                ...headline(84),
                ...(near > 0.5 ? filled(FILLS.hot) : { color: '#9a9aa2' }),
                paddingBottom: 8,
              }}
            >
              {item}
            </div>
          );
        })}
      </div>
    </Centered>
  );
}

export function LightSection() {
  return (
    <AbsoluteFill>
      <Line />
      <RingPill />
      <Sphere />
      <List />
    </AbsoluteFill>
  );
}
