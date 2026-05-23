import type { FlowBar, FlowMap, FlowSyllable } from '../../types';
import { FLOW_DIMS, type FlowLayout } from '../layout';

export function barPlayCenterX(): number {
  return FLOW_DIMS.labelW - 60;
}

export function findBarAtY(flowmap: FlowMap, y: number): number | null {
  const rowIndex = Math.floor((y - FLOW_DIMS.headerH) / FLOW_DIMS.barH);
  if (rowIndex < 0 || rowIndex >= flowmap.bars.length) return null;
  return flowmap.bars[rowIndex].bar_no;
}

export function findDensityBarAtPoint(flowmap: FlowMap, layout: FlowLayout, x: number, y: number): FlowBar | null {
  const rowIndex = Math.floor((y - FLOW_DIMS.headerH) / FLOW_DIMS.barH);
  if (rowIndex < 0 || rowIndex >= flowmap.bars.length) return null;
  const densityX = FLOW_DIMS.labelW + layout.signature * layout.beatW + 4;
  const densityY = FLOW_DIMS.headerH + rowIndex * FLOW_DIMS.barH + 6;
  const densityW = FLOW_DIMS.densW - 8;
  const densityH = FLOW_DIMS.barH - 12;
  if (x < densityX || x > densityX + densityW || y < densityY || y > densityY + densityH) return null;
  return flowmap.bars[rowIndex];
}

export function hitPlayButton(flowmap: FlowMap, x: number, y: number, barNo: number | null): boolean {
  if (barNo === null) return false;
  const rowIndex = flowmap.bars.findIndex((bar) => bar.bar_no === barNo);
  if (rowIndex < 0) return false;
  const centerX = barPlayCenterX();
  const centerY = FLOW_DIMS.headerH + rowIndex * FLOW_DIMS.barH + FLOW_DIMS.barH / 2;
  return Math.hypot(x - centerX, y - centerY) <= 15;
}

export function findBeatIndex(flowmap: FlowMap, time: number): number {
  let low = 0;
  let high = flowmap.beats.length - 1;
  while (low < high) {
    const mid = (low + high + 1) >> 1;
    if (flowmap.beats[mid].time <= time) low = mid;
    else high = mid - 1;
  }
  return low;
}

export function findActiveSyllable(flowmap: FlowMap, time: number): FlowSyllable | null {
  let best: FlowSyllable | null = null;
  let bestDiff = Number.POSITIVE_INFINITY;
  for (const syllable of flowmap.syllables) {
    const center = syllable.center_time ?? syllable.time;
    if (center < 0) continue;
    const diff = Math.abs(center - time);
    if (diff < bestDiff) {
      best = syllable;
      bestDiff = diff;
    }
  }
  const beatWindow = flowmap.metadata.bpm > 0 ? 60 / flowmap.metadata.bpm : 0.75;
  return best && bestDiff <= Math.max(0.45, beatWindow * 0.75) ? best : null;
}
