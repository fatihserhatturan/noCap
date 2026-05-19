import type { FlowBar, FlowMap, FlowSyllable } from '../types';

export const FLOW_DIMS = {
  labelW: 72,
  beatW: 112,
  barH: 52,
  headerH: 30,
  sylH: 28,
  sylBlockW: 12,
  densW: 40,
  subdivs: 4,
};

export interface FlowLayout {
  width: number;
  height: number;
  beatW: number;
  signature: number;
}

export interface SyllableRect {
  x: number;
  y: number;
  width: number;
  height: number;
  syllable: FlowSyllable;
}

export function computeLayout(flowmap: FlowMap, containerWidth: number): FlowLayout {
  const signature = flowmap.metadata.time_signature || 4;
  const minGrid = signature * FLOW_DIMS.beatW + FLOW_DIMS.labelW + FLOW_DIMS.densW;
  const available = Math.max(containerWidth - 28, minGrid);
  const beatW = Math.max(FLOW_DIMS.beatW, Math.floor((available - FLOW_DIMS.labelW - FLOW_DIMS.densW) / signature));
  return {
    width: FLOW_DIMS.labelW + signature * beatW + FLOW_DIMS.densW,
    height: FLOW_DIMS.headerH + flowmap.bars.length * FLOW_DIMS.barH + 4,
    beatW,
    signature,
  };
}

export function syllableRect(syllable: FlowSyllable, rowIndex: number, beatW: number): SyllableRect {
  const x = FLOW_DIMS.labelW + (syllable.beat_no - 1 + syllable.beat_pos) * beatW;
  const height = syllable.stress ? FLOW_DIMS.sylH : Math.round(FLOW_DIMS.sylH * 0.55);
  const y = FLOW_DIMS.headerH + rowIndex * FLOW_DIMS.barH + Math.round((FLOW_DIMS.barH - height) / 2);
  return {
    x: Math.round(x - FLOW_DIMS.sylBlockW / 2),
    y,
    width: FLOW_DIMS.sylBlockW,
    height,
    syllable,
  };
}

export function groupSyllablesByBar(syllables: FlowSyllable[]): Map<number, FlowSyllable[]> {
  const byBar = new Map<number, FlowSyllable[]>();
  for (const syllable of syllables) {
    const group = byBar.get(syllable.bar_no);
    if (group) group.push(syllable);
    else byBar.set(syllable.bar_no, [syllable]);
  }
  return byBar;
}

export function barIndexMap(bars: FlowBar[]): Map<number, number> {
  const map = new Map<number, number>();
  bars.forEach((bar, index) => map.set(bar.bar_no, index));
  return map;
}
