import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { SOURCE, bars } from '../timeline';
import { Label } from './Label';
import { Footage, NeonFrame } from './NeonScreen';
import { LYRICS, SECTIONS, footageTime } from './timeline';
import { headline } from './type';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/** When the camera turns from the Lyrics card to the Report card. */
export const REPORT_AT = bars(15.75);

type Card = { id: string; x: number; y: number; z: number; rotY: number; scale: number; delay: number; seconds: (frame: number) => number; zoom?: string };

const CARDS: Card[] = [
  // Inspector, frozen on a bar with its lyrics shown.
  { id: 'inspector', x: -760, y: -170, z: -520, rotY: 16, scale: 0.55, delay: 4, seconds: () => 28.2 },
  // Report, frozen once it has drawn.
  { id: 'report', x: 820, y: 120, z: -380, rotY: -14, scale: 0.6, delay: 8, seconds: () => 53.5 },
  // Lyrics, playing: edit a word, save, export.
  { id: 'lyrics', x: 0, y: 0, z: 0, rotY: 0, scale: 0.78, delay: 0, seconds: (frame) => footageTime([LYRICS], frame) },
];

function FloatingCard({ card, focus }: { card: Card; focus: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const start = bars(SECTIONS.cards);
  const rise = spring({ frame: frame - start - card.delay, fps, config: { damping: 18, mass: 1.1, stiffness: 70 } });
  const bob = Math.sin((frame + card.delay * 20) / 40) * 10;
  // The Report card comes forward when the camera turns to it.
  const forward = card.id === 'report' ? focus * 420 : card.id === 'lyrics' ? -focus * 200 : 0;
  return (
    <div
      style={{
        position: 'absolute',
        left: -SOURCE.width / 2,
        top: -SOURCE.height / 2,
        transformStyle: 'preserve-3d',
        transform: `translate3d(${card.x}px, ${card.y + bob + (1 - rise) * 600}px, ${card.z + forward}px) rotateY(${card.rotY * (1 - focus * 0.5)}deg) rotateX(${(1 - rise) * 40}deg) scale(${card.scale})`,
        opacity: Math.min(1, rise * 1.8),
      }}
    >
      <NeonFrame glow={card.id === 'lyrics' ? 1 - focus * 0.6 : 0.5 + focus * 0.5}>
        <Footage seconds={card.seconds(frame)} />
      </NeonFrame>
    </div>
  );
}

/** Bars 13–18: app screens floating at different depths over a giant ghost word. The
 *  camera drifts across them, then turns from Lyrics to Report. */
export function FloatingCards() {
  const frame = useCurrentFrame();
  const start = bars(SECTIONS.cards);
  const end = bars(SECTIONS.light);
  if (frame < start - 4 || frame > end + 10) return null;

  const enter = interpolate(frame, [start - 4, start + 10], [0, 1], clamp);
  const leave = interpolate(frame, [end - 6, end + 8], [0, 1], { ...clamp, easing: Easing.in(Easing.cubic) });
  const focus = interpolate(frame, [REPORT_AT - 10, REPORT_AT + 10], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const drift = (frame - start) / (end - start);
  const panX = -focus * 640 + (0.5 - drift) * 60;
  const turn = -6 + drift * 6 + focus * -10;
  const ghost = focus < 0.5 ? 'LYRICS' : 'REPORT';
  const ghostSwap = Math.abs(focus - 0.5) * 2;

  return (
    <AbsoluteFill style={{ opacity: enter * (1 - leave), filter: leave > 0 ? `blur(${leave * 16}px)` : undefined }}>
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div
          style={{
            ...headline(400),
            letterSpacing: '-0.04em',
            color: 'rgba(255,255,255,0.045)',
            transform: `translateX(${(0.5 - drift) * 160}px)`,
            opacity: ghostSwap,
            filter: `blur(${(1 - ghostSwap) * 20}px)`,
          }}
        >
          {ghost}
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ perspective: 1800 }}>
        <div style={{ position: 'absolute', left: 960, top: 520, transformStyle: 'preserve-3d', transform: `translateX(${panX}px) rotateY(${turn}deg) rotateX(4deg)` }}>
          {CARDS.map((card) => (
            <FloatingCard key={card.id} card={card} focus={focus} />
          ))}
        </div>
      </AbsoluteFill>
      <Label index={5} kicker={LYRICS.kicker} title={LYRICS.title} from={start + 8} to={REPORT_AT - 4} />
      <Label index={6} kicker="Report" title="The whole flow, at a glance." from={REPORT_AT + 6} to={end - 2} />
    </AbsoluteFill>
  );
}
