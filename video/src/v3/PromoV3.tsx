import { AbsoluteFill, interpolate, Sequence, useCurrentFrame } from 'remotion';
import { DROPS, GAPS } from '../beat';
import { Flash, Grain, Vignette } from '../components/Fx';
import { bars } from '../timeline';
import { FloatingCards } from './FloatingCards';
import { GlowStage, lightness } from './GlowStage';
import { Hook, LogoHit } from './Hook';
import { LightSection } from './LightSection';
import { NeonScreen } from './NeonScreen';
import { OrbitOutro } from './OrbitOutro';
import { SoundtrackV3 } from './SoundtrackV3';
import { TypeBox } from './TypeBox';
import { Words } from './Words';

/** The beat drops out for half a beat before each drop: the picture goes dark with it. */
function Blackouts() {
  const frame = useCurrentFrame();
  const dark = GAPS.reduce((most, gap, i) => Math.max(most, interpolate(frame, [gap - 1, gap, DROPS[i] - 1, DROPS[i]], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })), 0);
  return <AbsoluteFill style={{ background: '#000', opacity: dark, pointerEvents: 'none' }} />;
}

/** Vignette and grain belong to the dark stage; they fade out on the white section. */
function Texture() {
  const light = lightness(useCurrentFrame());
  return (
    <AbsoluteFill style={{ opacity: 1 - light * 0.85, pointerEvents: 'none' }}>
      <Vignette />
      <Grain opacity={0.06} />
    </AbsoluteFill>
  );
}

/** Promo v3, in the style of a premium product launch: glow light, giant type, a neon
 *  screen, floating cards, a white breakdown and an orbit outro. Every section starts on
 *  a bar line of the v2 beat (see `timeline.ts`). Components use absolute frames. */
export function PromoV3() {
  return (
    <AbsoluteFill>
      <GlowStage />
      <Hook />
      <TypeBox />
      <LogoHit />
      <NeonScreen />
      <FloatingCards />
      <LightSection />
      <Words />
      <OrbitOutro />
      {[...DROPS, bars(28)].map((at) => (
        <Sequence key={at} from={at} durationInFrames={16}>
          <Flash />
        </Sequence>
      ))}
      <Blackouts />
      <Texture />
      <SoundtrackV3 />
    </AbsoluteFill>
  );
}
