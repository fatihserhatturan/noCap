import { useEffect, useState } from 'react';
import { Composition, continueRender, delayRender } from 'remotion';
import { Promo } from './Promo';
import { FONT_FACES } from './theme';
import { DURATION, FPS, HEIGHT, WIDTH } from './timeline';
import { PromoV3 } from './v3/PromoV3';

/** Holds the render until the web fonts are loaded, so no frame uses a fallback font. */
function WithFonts({ version }: { version?: 'v3' }) {
  const [handle] = useState(() => delayRender('Loading fonts'));
  useEffect(() => {
    Promise.all(FONT_FACES.map((face) => document.fonts.load(face))).then(() => continueRender(handle));
  }, [handle]);
  return version === 'v3' ? <PromoV3 /> : <Promo />;
}

export function Root() {
  return (
    <>
      <Composition id="Promo" component={WithFonts} durationInFrames={DURATION} fps={FPS} width={WIDTH} height={HEIGHT} />
      <Composition id="PromoV3" component={WithFonts} defaultProps={{ version: 'v3' as const }} durationInFrames={DURATION} fps={FPS} width={WIDTH} height={HEIGHT} />
    </>
  );
}
