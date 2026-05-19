import type { SyllableRect } from './layout';

export function hitTest(rects: SyllableRect[], x: number, y: number): SyllableRect | null {
  for (let index = rects.length - 1; index >= 0; index -= 1) {
    const rect = rects[index];
    if (
      x >= rect.x &&
      x <= rect.x + rect.width &&
      y >= rect.y &&
      y <= rect.y + rect.height
    ) {
      return rect;
    }
  }
  return null;
}
