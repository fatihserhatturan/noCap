import { Container, Graphics, Text } from 'pixi.js';
import type { FlowMap, FlowSyllable } from '../../types';
import { FLOW_DIMS, barIndexMap, groupSyllablesByBar, syllableRect, type FlowLayout, type SyllableRect } from '../layout';
import { drawBeatEventMarker, drawEnergyBackground, drawOnsetBeats } from './contextOverlay';

export interface SceneContext {
  flowmap: FlowMap;
  layout: FlowLayout;
  activeRhyme: string | null;
  colorMap: Map<string, number>;
  rects: SyllableRect[];
}

export function drawScene(scene: Container, ctx: SceneContext) {
  scene.removeChildren();
  ctx.rects.length = 0;
  const graphics = new Graphics();
  scene.addChild(graphics);
  drawHeader(graphics, scene, ctx.layout);
  drawBars(graphics, scene, ctx);
}

function drawHeader(graphics: Graphics, scene: Container, layout: FlowLayout) {
  graphics.rect(0, 0, layout.width, FLOW_DIMS.headerH).fill(0x0f0f0f);
  for (let beat = 0; beat < layout.signature; beat += 1) {
    const x = FLOW_DIMS.labelW + beat * layout.beatW;
    graphics.moveTo(x, 0).lineTo(x, FLOW_DIMS.headerH).stroke({ color: 0x1f1f1f, width: 1 });
    for (let sub = 1; sub < FLOW_DIMS.subdivs; sub += 1) {
      const sx = x + (sub / FLOW_DIMS.subdivs) * layout.beatW;
      graphics.moveTo(sx, FLOW_DIMS.headerH - 10).lineTo(sx, FLOW_DIMS.headerH).stroke({ color: 0x181818, width: 1 });
    }
    const label = new Text({ text: String(beat + 1), style: { fill: 0x777777, fontFamily: 'monospace', fontSize: 11 } });
    label.anchor.set(0.5, 0);
    label.position.set(x + layout.beatW / 2, 10);
    scene.addChild(label);
  }
}

function drawBars(graphics: Graphics, scene: Container, ctx: SceneContext) {
  const byBar = groupSyllablesByBar(ctx.flowmap.syllables);
  const indexByBar = barIndexMap(ctx.flowmap.bars);
  const maxDensity = Math.max(...ctx.flowmap.bars.map((bar) => bar.density), 0.01);
  const gridW = ctx.layout.signature * ctx.layout.beatW;
  ctx.flowmap.bars.forEach((bar, index) => {
    const rowY = FLOW_DIMS.headerH + index * FLOW_DIMS.barH;
    drawGridRow(graphics, scene, ctx.layout, rowY, gridW, index, bar.bar_no);
    drawEnergyBackground(graphics, bar, ctx.layout, rowY);
    drawOnsetBeats(graphics, ctx.flowmap, ctx.layout, rowY, bar.bar_no);
    drawBeatEventMarker(graphics, ctx.flowmap.bars, index, rowY);
    drawDensity(graphics, ctx.layout, rowY, bar.density / maxDensity);
    for (const syllable of byBar.get(bar.bar_no) || []) {
      const rowIndex = indexByBar.get(syllable.bar_no);
      if (rowIndex !== undefined) drawSyllable(graphics, syllable, rowIndex, ctx);
    }
  });
}

function drawGridRow(graphics: Graphics, scene: Container, layout: FlowLayout, rowY: number, gridW: number, index: number, barNo: number) {
  graphics.rect(FLOW_DIMS.labelW, rowY, gridW, FLOW_DIMS.barH).fill(index % 2 === 0 ? 0x0e0e0e : 0x111111);
  graphics.moveTo(0, rowY + FLOW_DIMS.barH).lineTo(FLOW_DIMS.labelW + gridW + FLOW_DIMS.densW, rowY + FLOW_DIMS.barH).stroke({ color: 0x171717, width: 1 });
  for (let beat = 0; beat < layout.signature; beat += 1) {
    const x = FLOW_DIMS.labelW + beat * layout.beatW;
    graphics.moveTo(x, rowY).lineTo(x, rowY + FLOW_DIMS.barH).stroke({ color: 0x191919, width: 1 });
    for (let sub = 1; sub < FLOW_DIMS.subdivs; sub += 1) {
      const sx = x + (sub / FLOW_DIMS.subdivs) * layout.beatW;
      graphics.moveTo(sx, rowY + FLOW_DIMS.barH * 0.35).lineTo(sx, rowY + FLOW_DIMS.barH).stroke({ color: 0x151515, width: 1 });
    }
  }
  const label = new Text({ text: String(barNo), style: { fill: 0x555555, fontFamily: 'monospace', fontSize: 10 } });
  label.anchor.set(0.5, 0.5);
  label.position.set(FLOW_DIMS.labelW / 2 - 6, rowY + FLOW_DIMS.barH / 2);
  scene.addChild(label);
}

function drawDensity(graphics: Graphics, layout: FlowLayout, rowY: number, pct: number) {
  const densityX = FLOW_DIMS.labelW + layout.signature * layout.beatW + 4;
  const densityW = FLOW_DIMS.densW - 8;
  graphics.rect(densityX, rowY + 6, densityW, FLOW_DIMS.barH - 12).fill(0x161616);
  const fillH = (FLOW_DIMS.barH - 12) * pct;
  graphics.rect(densityX, rowY + 6 + (FLOW_DIMS.barH - 12) - fillH, densityW, fillH).fill({ color: 0xff3d00, alpha: 0.25 + pct * 0.65 });
}

function drawSyllable(graphics: Graphics, syllable: FlowSyllable, rowIndex: number, ctx: SceneContext) {
  const rect = syllableRect(syllable, rowIndex, ctx.layout.beatW);
  const dimmed = ctx.activeRhyme && syllable.rhyme_group !== ctx.activeRhyme;
  const color = syllable.rhyme_group ? (ctx.colorMap.get(syllable.rhyme_group) || 0x444444) : 0x2e2e2e;
  ctx.rects.push(rect);
  graphics.roundRect(rect.x, rect.y, rect.width, rect.height, 2).fill({ color: dimmed ? 0x282828 : color, alpha: dimmed ? 0.35 : syllable.stress ? 1 : 0.42 });
}
