import '@fontsource/inter/400.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/800.css';
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/poppins/600.css';
import '@fontsource/poppins/700.css';
import '@fontsource/space-grotesk/500.css';
import '@fontsource/space-grotesk/700.css';

/** Same palette as the landing page (docs/style.css) and the app. */
export const COLORS = {
  bg: '#0a0a0b',
  surface: '#141417',
  border: 'rgba(255, 255, 255, 0.08)',
  text: '#f2f2f3',
  text2: '#a8a8b0',
  muted: '#74747d',
  accent: '#ff3d00',
  accent2: '#ff6d00',
  pink: '#ff4f9a',
  blue: '#3fb8ff',
  green: '#5ee6a0',
  yellow: '#ffd23f',
  violet: '#8a3dff',
};

export const FONTS = {
  body: "'Inter', sans-serif",
  display: "'Space Grotesk', 'Inter', sans-serif",
  mono: "'JetBrains Mono', ui-monospace, monospace",
  /** Rounded geometric headlines for promo v3. */
  headline: "'Poppins', 'Inter', sans-serif",
};

/** Font faces the first frame needs before it is rendered. */
export const FONT_FACES = [
  `400 20px ${FONTS.body}`,
  `600 20px ${FONTS.body}`,
  `800 20px ${FONTS.body}`,
  `500 20px ${FONTS.mono}`,
  `500 20px ${FONTS.display}`,
  `700 20px ${FONTS.display}`,
  `600 20px ${FONTS.headline}`,
  `700 20px ${FONTS.headline}`,
];
