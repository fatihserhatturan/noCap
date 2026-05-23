import { Application } from 'pixi.js';
import type { FlowLayout } from '../layout';

export function getPixiCanvas(app: Application): HTMLCanvasElement | null {
  const candidate = app.renderer as unknown as { canvas?: HTMLCanvasElement; view?: HTMLCanvasElement } | undefined;
  return candidate?.canvas || candidate?.view || null;
}

export function resizePixi(app: Application | null, layout: FlowLayout | null) {
  if (!app || !layout || !app.renderer) return;
  if (typeof app.renderer.resize === 'function') app.renderer.resize(layout.width, layout.height);
  const canvas = getPixiCanvas(app);
  if (!canvas) return;
  canvas.style.width = `${layout.width}px`;
  canvas.style.height = `${layout.height}px`;
}

export function safeDestroyPixiApp(app: Application): void {
  const candidate = app as unknown as { _cancelResize?: () => void; stop?: () => void; destroy?: (removeView?: boolean) => void };
  if (typeof candidate._cancelResize !== 'function') candidate._cancelResize = () => {};
  try {
    candidate.stop?.();
    candidate.destroy?.(true);
  } catch {
    // Pixi may already be partially torn down during rapid React transitions.
  }
}
