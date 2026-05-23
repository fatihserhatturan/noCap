import { Graphics, Text } from 'pixi.js';
import type { FlowMap } from '../../types';
import { buildColorMap } from '../colors';
import { FLOW_DIMS, syllableRect, type FlowLayout } from '../layout';
import { findActiveSyllable, findBeatIndex } from './geometry';

export function drawPlayhead(playhead: Graphics | null, flowmap: FlowMap, layout: FlowLayout, currentTime: number, scrollEl: HTMLDivElement | null) {
  if (!playhead || flowmap.beats.length === 0) return;
  playhead.clear();
  playhead.removeChildren();
  const beatIndex = findBeatIndex(flowmap, currentTime);
  const beat = flowmap.beats[beatIndex];
  const rowIndex = flowmap.bars.findIndex((bar) => bar.bar_no === beat.bar_no);
  if (rowIndex < 0) return;
  const rowY = FLOW_DIMS.headerH + rowIndex * FLOW_DIMS.barH;
  drawBeatLine(playhead, flowmap, layout, currentTime, beatIndex, rowY);
  keepActiveBarInView(scrollEl, rowY);
  drawActiveSyllable(playhead, flowmap, layout, currentTime, beat.bar_no);
}

function drawBeatLine(playhead: Graphics, flowmap: FlowMap, layout: FlowLayout, currentTime: number, beatIndex: number, rowY: number) {
  const beat = flowmap.beats[beatIndex];
  const nextTime = beatIndex + 1 < flowmap.beats.length ? flowmap.beats[beatIndex + 1].time : beat.time + 60 / flowmap.metadata.bpm;
  const frac = nextTime > beat.time ? Math.min((currentTime - beat.time) / (nextTime - beat.time), 1) : 0;
  const x = FLOW_DIMS.labelW + (beat.beat_no - 1 + frac) * layout.beatW;
  playhead.rect(FLOW_DIMS.labelW, rowY, layout.signature * layout.beatW, FLOW_DIMS.barH).fill({ color: 0xff3d00, alpha: 0.06 });
  playhead.moveTo(x, rowY).lineTo(x, rowY + FLOW_DIMS.barH).stroke({ color: 0xffffff, width: 1.5, alpha: 0.75 });
}

function drawActiveSyllable(playhead: Graphics, flowmap: FlowMap, layout: FlowLayout, currentTime: number, beatBarNo: number) {
  const active = findActiveSyllable(flowmap, currentTime);
  if (!active || active.bar_no !== beatBarNo) return;
  const rowIndex = flowmap.bars.findIndex((bar) => bar.bar_no === active.bar_no);
  if (rowIndex < 0) return;
  const rect = syllableRect(active, rowIndex, layout.beatW);
  const colorMap = buildColorMap(flowmap.rhyme_chains.map((chain) => chain.group));
  const color = active.rhyme_group ? (colorMap.get(active.rhyme_group) || 0xff3d00) : 0xff3d00;
  playhead.roundRect(rect.x - 6, rect.y - 6, rect.width + 12, rect.height + 12, 6).fill({ color, alpha: 0.2 }).stroke({ color, width: 2, alpha: 1 });
  playhead.roundRect(rect.x - 2, rect.y - 2, rect.width + 4, rect.height + 4, 3).stroke({ color: 0xffffff, width: 1, alpha: 0.85 });
  drawWordLabel(playhead, active.word || '', rect, color, layout);
}

function drawWordLabel(playhead: Graphics, label: string, rect: { x: number; y: number; width: number }, color: number, layout: FlowLayout) {
  if (!label) return;
  const labelText = new Text({ text: label, style: { fill: color, fontFamily: 'monospace', fontSize: 11, fontWeight: '700' } });
  const padX = 6;
  const padY = 3;
  const labelW = labelText.width + padX * 2;
  const labelH = labelText.height + padY * 2;
  const labelX = Math.max(FLOW_DIMS.labelW + 4, Math.min(rect.x - labelW / 2 + rect.width / 2, layout.width - labelW - 8));
  const labelY = Math.max(4, rect.y - labelH - 5);
  playhead.roundRect(labelX, labelY, labelW, labelH, 4).fill({ color: 0x0a0a0a, alpha: 0.88 }).stroke({ color, width: 1, alpha: 0.9 });
  labelText.position.set(labelX + padX, labelY + padY);
  playhead.addChild(labelText);
}

function keepActiveBarInView(scrollEl: HTMLDivElement | null, rowY: number) {
  if (!scrollEl) return;
  const paddingTop = Number.parseFloat(window.getComputedStyle(scrollEl).paddingTop) || 0;
  const top = paddingTop + rowY;
  const bottom = top + FLOW_DIMS.barH;
  const viewTop = scrollEl.scrollTop;
  const viewBottom = viewTop + scrollEl.clientHeight;
  if (top < viewTop + 20 || bottom > viewBottom - 20) scrollEl.scrollTop = Math.max(0, top - 80);
}
