import { Graphics } from 'pixi.js';
import type { FlowMap } from '../../types';
import { FLOW_DIMS, type SyllableRect } from '../layout';
import { barPlayCenterX } from './geometry';

export function drawHover(layer: Graphics | null, flowmap: FlowMap, colorMap: Map<string, number>, rect: SyllableRect | null, barNo: number | null) {
  if (!layer) return;
  layer.clear();
  if (barNo !== null) drawBarPlayButton(layer, flowmap, barNo);
  if (!rect) return;
  const color = rect.syllable.rhyme_group ? (colorMap.get(rect.syllable.rhyme_group) || 0xff3d00) : 0xff3d00;
  layer.roundRect(rect.x - 5, rect.y - 5, rect.width + 10, rect.height + 10, 5)
    .fill({ color, alpha: 0.18 })
    .stroke({ color, width: 2, alpha: 0.95 });
  layer.roundRect(rect.x - 2, rect.y - 2, rect.width + 4, rect.height + 4, 3)
    .stroke({ color: 0xffffff, width: 1, alpha: 0.75 });
}

function drawBarPlayButton(layer: Graphics, flowmap: FlowMap, barNo: number) {
  const rowIndex = flowmap.bars.findIndex((bar) => bar.bar_no === barNo);
  if (rowIndex < 0) return;
  const centerX = barPlayCenterX();
  const centerY = FLOW_DIMS.headerH + rowIndex * FLOW_DIMS.barH + FLOW_DIMS.barH / 2;
  layer.moveTo(centerX - 3, centerY - 5).lineTo(centerX + 4, centerY).lineTo(centerX - 3, centerY + 5).closePath()
    .stroke({ color: 0xffffff, width: 1.4, alpha: 0.9 });
  layer.poly([centerX - 3.4, centerY - 5.4, centerX - 3.4, centerY + 5.4, centerX + 4.3, centerY]).fill({ color: 0xffffff, alpha: 0.18 });
}
