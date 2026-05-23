import type { RefObject } from 'react';
import { Application, Graphics } from 'pixi.js';
import type { FlowBar, FlowMap, FlowSyllable } from '../../types';
import { hitTest } from '../hitTesting';
import type { FlowLayout, SyllableRect } from '../layout';
import { findBarAtY, findDensityBarAtPoint, hitPlayButton } from './geometry';
import { drawHover } from './hover';
import { getPixiCanvas } from './pixiApp';

export interface TooltipState { x: number; y: number; syllable: FlowSyllable }
export interface BarTooltipState { x: number; y: number; bar: FlowBar }
export interface StageCallbacks {
  onBarHover: (barNo: number | null) => void;
  onBarPlay: (barNo: number) => void;
  onWordPlay: (syllable: FlowSyllable) => void;
}

export function makeHandlers(args: {
  app: Application;
  flowmapRef: RefObject<FlowMap>;
  colorMapRef: RefObject<Map<string, number>>;
  layoutRef: RefObject<FlowLayout | null>;
  rectsRef: RefObject<SyllableRect[]>;
  hoveredRectRef: RefObject<SyllableRect | null>;
  hoveredBarRef: RefObject<number | null>;
  callbacks: RefObject<StageCallbacks>;
  setTooltip: (value: TooltipState | null) => void;
  setBarTooltip: (value: BarTooltipState | null) => void;
}) {
  const toPoint = (event: MouseEvent) => stagePoint(args.app, args.layoutRef.current, event);
  return {
    mousemove(event: MouseEvent) {
      const point = toPoint(event);
      if (!point) return;
      const flowmap = args.flowmapRef.current;
      const hit = hitTest(args.rectsRef.current, point.x, point.y);
      const barNo = findBarAtY(flowmap, point.y);
      const densityBar = findDensityBarAtPoint(flowmap, point.layout, point.x, point.y);
      args.hoveredRectRef.current = hit;
      args.hoveredBarRef.current = barNo;
      drawHover(hoverLayer(args.app), flowmap, args.colorMapRef.current, hit, barNo);
      args.setTooltip(hit ? { x: event.clientX + 14, y: event.clientY - 12, syllable: hit.syllable } : null);
      args.setBarTooltip(!hit && densityBar ? { x: event.clientX + 14, y: event.clientY - 12, bar: densityBar } : null);
      args.callbacks.current.onBarHover(barNo);
      point.canvas.classList.toggle('flow-canvas-playable', hitPlayButton(flowmap, point.x, point.y, barNo));
    },
    click(event: MouseEvent) {
      const point = toPoint(event);
      if (!point) return;
      const flowmap = args.flowmapRef.current;
      const barNo = findBarAtY(flowmap, point.y);
      if (hitPlayButton(flowmap, point.x, point.y, barNo) && barNo !== null) {
        event.preventDefault();
        args.callbacks.current.onBarPlay(barNo);
        return;
      }
      const hit = hitTest(args.rectsRef.current, point.x, point.y);
      if (hit) {
        event.preventDefault();
        args.callbacks.current.onWordPlay(hit.syllable);
      }
    },
    mouseleave() {
      args.hoveredRectRef.current = null;
      args.hoveredBarRef.current = null;
      drawHover(hoverLayer(args.app), args.flowmapRef.current, args.colorMapRef.current, null, null);
      args.setTooltip(null);
      args.setBarTooltip(null);
      args.callbacks.current.onBarHover(null);
      getPixiCanvas(args.app)?.classList.remove('flow-canvas-playable');
    },
  };
}

function stagePoint(app: Application, layout: FlowLayout | null, event: MouseEvent) {
  const canvas = getPixiCanvas(app);
  if (!layout || !canvas) return null;
  const bounds = canvas.getBoundingClientRect();
  return {
    layout,
    canvas,
    x: (event.clientX - bounds.left) * (layout.width / bounds.width),
    y: (event.clientY - bounds.top) * (layout.height / bounds.height),
  };
}

function hoverLayer(app: Application): Graphics | null {
  return app.stage.children[1] instanceof Graphics ? app.stage.children[1] : null;
}

export type StageHandlers = ReturnType<typeof makeHandlers>;
