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

export function drawRhythmWarningMarker(graphics: Graphics, bars: FlowBar[], index: number, rowY: number) {
  if (!hasRhythmDrift(bars, index)) return;
  const x = FLOW_DIMS.labelW - 31;
  const y = rowY + FLOW_DIMS.barH - 17;
  graphics.poly([x, y + 11, x + 6, y, x + 12, y + 11]).fill({ color: 0xffd166, alpha: 0.78 });
  graphics.moveTo(x + 6, y + 3).lineTo(x + 6, y + 7).stroke({ color: 0x1a1200, width: 1.3, alpha: 0.95 });
  graphics.circle(x + 6, y + 9, 0.9).fill({ color: 0x1a1200, alpha: 0.95 });
}

export function drawPocketMarker(graphics: Graphics, bar: FlowBar, rowY: number) {
  if (bar.pocket_confidence < 0.72 || bar.syllable_count < 4) return;
  const x = FLOW_DIMS.labelW - 18;
  const y = rowY + FLOW_DIMS.barH - 10;
  graphics.circle(x + 4, y, 4).fill({ color: 0x5ff29b, alpha: 0.78 });
  graphics.moveTo(x + 1, y).lineTo(x + 3, y + 2).lineTo(x + 8, y - 3).stroke({ color: 0x062412, width: 1.2, alpha: 0.9 });
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

function hasRhythmDrift(bars: FlowBar[], index: number) {
  const bar = bars[index];
  if (bar.syllable_count < 4) return false;
  const timingLimit = outlierLimit(bars.map((item) => item.timing_variance), 0.16, 2.5);
  const pocketLimit = outlierLimit(bars.map((item) => Math.abs(item.pocket_offset)), 0.34, 2.8);
  const looseTiming = bar.timing_variance >= timingLimit;
  const pocketDrift = Math.abs(bar.pocket_offset) >= pocketLimit;
  const weakBeatStress = bar.stressed_on_beat_ratio < 0.06 && bar.timing_variance >= timingLimit * 0.8;
  return looseTiming || pocketDrift || weakBeatStress;
}

function outlierLimit(values: number[], floor: number, madScale: number) {
  const usable = values.filter((value) => Number.isFinite(value) && value > 0).sort((a, b) => a - b);
  if (usable.length === 0) return floor;
  const med = median(usable);
  const deviations = usable.map((value) => Math.abs(value - med)).sort((a, b) => a - b);
  return Math.max(floor, med + median(deviations) * madScale, quantile(usable, 0.93));
}

function median(values: number[]) {
  const mid = Math.floor(values.length / 2);
  return values.length % 2 ? values[mid] : (values[mid - 1] + values[mid]) / 2;
}

function quantile(values: number[], q: number) {
  return values[Math.min(values.length - 1, Math.floor((values.length - 1) * q))];
}
