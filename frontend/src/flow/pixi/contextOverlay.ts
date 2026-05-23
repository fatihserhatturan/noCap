import { Graphics } from 'pixi.js';
import type { FlowBar, FlowBeat, FlowMap } from '../../types';
import { FLOW_DIMS, type FlowLayout } from '../layout';

export function drawEnergyBackground(graphics: Graphics, bar: FlowBar, layout: FlowLayout, rowY: number) {
  const alpha = Math.min(0.16, Math.max(0, bar.rms_avg) * 0.16);
  if (alpha <= 0) return;
  graphics.rect(FLOW_DIMS.labelW, rowY, layout.signature * layout.beatW, FLOW_DIMS.barH).fill({ color: 0xffb000, alpha });
}

export function drawOnsetBeats(graphics: Graphics, flowmap: FlowMap, layout: FlowLayout, rowY: number, barNo: number) {
  for (const beat of flowmap.beats.filter((item) => item.bar_no === barNo)) {
    drawOnsetBeat(graphics, beat, layout, rowY);
  }
}

export function drawBeatEventMarker(graphics: Graphics, bars: FlowBar[], index: number, rowY: number) {
  const event = beatEvent(bars, index);
  if (!event) return;
  const x = FLOW_DIMS.labelW - 18;
  const y = rowY + 8;
  if (event === 'switch') {
    graphics.moveTo(x, y).lineTo(x + 9, y + 5).lineTo(x, y + 10).stroke({ color: 0x65d8ff, width: 2, alpha: 0.9 });
    return;
  }
  graphics.rect(x, y + 1, 9, 8).fill({ color: 0xff3d00, alpha: 0.72 });
}

function drawOnsetBeat(graphics: Graphics, beat: FlowBeat, layout: FlowLayout, rowY: number) {
  const strength = Math.min(1, Math.max(0, beat.onset_strength));
  if (strength <= 0.15) return;
  const x = FLOW_DIMS.labelW + (beat.beat_no - 1) * layout.beatW;
  graphics
    .moveTo(x, rowY + 4)
    .lineTo(x, rowY + FLOW_DIMS.barH - 4)
    .stroke({ color: 0xfff1a8, width: 1 + strength * 2, alpha: 0.18 + strength * 0.46 });
}

function beatEvent(bars: FlowBar[], index: number): 'switch' | 'cut' | null {
  if (index <= 0) return null;
  const prev = bars[index - 1];
  const bar = bars[index];
  if (isBeatCut(prev, bar)) return 'cut';
  if (isBeatSwitch(prev, bar)) return 'switch';
  return null;
}

function isBeatSwitch(prev: FlowBar, bar: FlowBar) {
  if (prev.local_bpm <= 0 || bar.local_bpm <= 0) return false;
  return Math.abs(prev.local_bpm - bar.local_bpm) >= 4;
}

function isBeatCut(prev: FlowBar, bar: FlowBar) {
  const energyDrop = prev.rms_avg > 0.35 && bar.rms_avg < prev.rms_avg * 0.58;
  const onsetDrop = prev.onset_strength_avg > 0.25 && bar.onset_strength_avg < prev.onset_strength_avg * 0.5;
  return energyDrop || onsetDrop;
}
