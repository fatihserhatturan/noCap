import type { ReactNode } from 'react';
import { spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLORS, FONTS } from '../theme';

export function useLand(at: number, damping = 15) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - at, fps, config: { damping } });
}

export const APPLE = (
  <svg width="44" height="44" viewBox="0 0 24 24" fill="#fff">
    <path d="M16.37 12.6c-.02-2.3 1.88-3.4 1.96-3.46-1.07-1.56-2.73-1.78-3.32-1.8-1.41-.14-2.76.83-3.47.83-.72 0-1.82-.81-3-.79-1.54.02-2.96.9-3.76 2.28-1.6 2.78-.41 6.9 1.15 9.16.76 1.1 1.67 2.34 2.86 2.3 1.15-.05 1.58-.74 2.97-.74 1.38 0 1.77.74 2.98.72 1.23-.02 2.01-1.12 2.76-2.23.87-1.28 1.23-2.52 1.25-2.58-.03-.01-2.4-.92-2.38-3.69zM14.1 5.86c.63-.77 1.06-1.83.94-2.89-.91.04-2.01.61-2.66 1.37-.58.67-1.09 1.75-.96 2.79 1.02.08 2.05-.52 2.68-1.27z" />
  </svg>
);
export const WINDOWS = (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="#fff">
    <path d="M3 5.1 10.4 4v7.2H3zM11.3 3.9 21 2.5v8.7h-9.7zM3 12.1h7.4v7.2L3 18.2zM11.3 12.1H21v8.7l-9.7-1.4z" />
  </svg>
);

export function PlatformCard({ at, icon, name, detail, badge }: { at: number; icon: ReactNode; name: string; detail: string; badge?: string }) {
  const p = useLand(at, 13);
  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: 22,
        width: 520,
        padding: '26px 32px',
        borderRadius: 22,
        background: 'linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03))',
        border: '1px solid rgba(255,255,255,0.14)',
        boxShadow: '0 30px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.12)',
        opacity: p,
        transform: `translateY(${(1 - p) * 60}px) rotateX(${(1 - p) * 40}deg)`,
      }}
    >
      <div style={{ width: 76, height: 76, borderRadius: 18, display: 'grid', placeItems: 'center', background: `linear-gradient(180deg, ${COLORS.accent2}, ${COLORS.accent})`, boxShadow: '0 12px 40px rgba(255,61,0,0.45)' }}>
        {icon}
      </div>
      <div>
        <div style={{ fontFamily: FONTS.display, fontWeight: 700, fontSize: 44, color: COLORS.text, letterSpacing: '-0.02em', lineHeight: 1.1 }}>{name}</div>
        <div style={{ fontFamily: FONTS.body, fontSize: 25, color: COLORS.text2, marginTop: 6 }}>{detail}</div>
      </div>
      {badge && (
        <div style={{ position: 'absolute', top: -16, right: 22, padding: '6px 14px', borderRadius: 999, background: COLORS.accent, fontFamily: FONTS.mono, fontWeight: 500, fontSize: 18, letterSpacing: '0.1em', color: '#fff' }}>
          {badge}
        </div>
      )}
    </div>
  );
}
