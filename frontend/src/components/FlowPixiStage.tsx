import { useEffect, useMemo, useRef, useState } from 'react';
import { Application, Container, Graphics, Text } from 'pixi.js';
import type { FlowMap, FlowSyllable } from '../types';
import { buildColorMap } from '../flow/colors';
import {
  FLOW_DIMS,
  barIndexMap,
  computeLayout,
  groupSyllablesByBar,
  syllableRect,
  type FlowLayout,
  type SyllableRect,
} from '../flow/layout';
import { hitTest } from '../flow/hitTesting';

interface TooltipState {
  x: number;
  y: number;
  syllable: FlowSyllable;
}

interface Props {
  flowmap: FlowMap;
  currentTime: number;
  activeRhyme: string | null;
  onBarHover: (barNo: number | null) => void;
  onBarPlay: (barNo: number) => void;
  onWordPlay: (syllable: FlowSyllable) => void;
}

export function FlowPixiStage({ flowmap, currentTime, activeRhyme, onBarHover, onBarPlay, onWordPlay }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<Application | null>(null);
  const sceneRef = useRef<Container | null>(null);
  const hoverRef = useRef<Graphics | null>(null);
  const playheadRef = useRef<Graphics | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const rectsRef = useRef<SyllableRect[]>([]);
  const hoveredRectRef = useRef<SyllableRect | null>(null);
  const hoveredBarRef = useRef<number | null>(null);
  const layoutRef = useRef<FlowLayout | null>(null);
  const onBarHoverRef = useRef(onBarHover);
  const onBarPlayRef = useRef(onBarPlay);
  const onWordPlayRef = useRef(onWordPlay);
  const [pixiReady, setPixiReady] = useState(false);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [containerWidth, setContainerWidth] = useState(900);

  const colorMap = useMemo(
    () => buildColorMap(flowmap.rhyme_chains.map((chain) => chain.group)),
    [flowmap],
  );
  const layout = useMemo(() => computeLayout(flowmap, containerWidth), [flowmap, containerWidth]);

  layoutRef.current = layout;
  onBarHoverRef.current = onBarHover;
  onBarPlayRef.current = onBarPlay;
  onWordPlayRef.current = onWordPlay;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const observer = new ResizeObserver(([entry]) => {
      const nextWidth = Math.max(360, Math.floor(entry.contentRect.width));
      setContainerWidth((current) => (Math.abs(current - nextWidth) > 2 ? nextWidth : current));
    });
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let disposed = false;
    const app = new Application();
    appRef.current = app;

    const handleMouseMove = (event: MouseEvent) => {
      const activeLayout = layoutRef.current;
      const canvas = getPixiCanvas(app);
      if (!activeLayout || !canvas) return;

      const bounds = canvas.getBoundingClientRect();
      const scaleX = activeLayout.width / bounds.width;
      const scaleY = activeLayout.height / bounds.height;
      const x = (event.clientX - bounds.left) * scaleX;
      const y = (event.clientY - bounds.top) * scaleY;
      const hit = hitTest(rectsRef.current, x, y);
      const barNo = findBarAtY(flowmap, y);

      hoveredRectRef.current = hit;
      hoveredBarRef.current = barNo;
      drawHover(hoverRef.current, hit, barNo);
      setTooltip(hit ? { x: event.clientX + 14, y: event.clientY - 12, syllable: hit.syllable } : null);
      onBarHoverRef.current(barNo);
      canvas.classList.toggle('flow-canvas-playable', hitPlayButton(x, y, barNo));
    };

    const handleClick = (event: MouseEvent) => {
      const activeLayout = layoutRef.current;
      const canvas = getPixiCanvas(app);
      if (!activeLayout || !canvas) return;

      const bounds = canvas.getBoundingClientRect();
      const x = (event.clientX - bounds.left) * (activeLayout.width / bounds.width);
      const y = (event.clientY - bounds.top) * (activeLayout.height / bounds.height);
      const barNo = findBarAtY(flowmap, y);
      if (hitPlayButton(x, y, barNo) && barNo !== null) {
        event.preventDefault();
        onBarPlayRef.current(barNo);
        return;
      }

      const hit = hitTest(rectsRef.current, x, y);
      if (hit) {
        event.preventDefault();
        onWordPlayRef.current(hit.syllable);
      }
    };

    const handleMouseLeave = () => {
      hoveredRectRef.current = null;
      hoveredBarRef.current = null;
      drawHover(hoverRef.current, null, null);
      setTooltip(null);
      onBarHoverRef.current(null);
      getPixiCanvas(app)?.classList.remove('flow-canvas-playable');
    };

    void app.init({
      width: layoutRef.current?.width || 900,
      height: layoutRef.current?.height || 600,
      background: '#0d0d0d',
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    }).then(() => {
      if (disposed) {
        safeDestroyPixiApp(app);
        return;
      }

      const canvas = getPixiCanvas(app);
      if (!canvas) return;

      host.replaceChildren(canvas);
      canvas.className = 'flow-canvas';
      canvas.addEventListener('mousemove', handleMouseMove);
      canvas.addEventListener('click', handleClick);
      canvas.addEventListener('mouseleave', handleMouseLeave);

      const scene = new Container();
      const hover = new Graphics();
      const playhead = new Graphics();
      sceneRef.current = scene;
      hoverRef.current = hover;
      playheadRef.current = playhead;
      app.stage.addChild(scene);
      app.stage.addChild(hover);
      app.stage.addChild(playhead);

      setPixiReady(true);
      resizePixi(app, layoutRef.current);
      drawScene(scene);
      drawHover(hover, hoveredRectRef.current, hoveredBarRef.current);
      drawPlayhead(playhead);
    }).catch((error: unknown) => {
      console.error(error);
    });

    return () => {
      disposed = true;
      const canvas = getPixiCanvas(app);
      canvas?.removeEventListener('mousemove', handleMouseMove);
      canvas?.removeEventListener('click', handleClick);
      canvas?.removeEventListener('mouseleave', handleMouseLeave);
      safeDestroyPixiApp(app);
      if (host.contains(canvas)) host.replaceChildren();
      appRef.current = null;
      sceneRef.current = null;
      hoverRef.current = null;
      playheadRef.current = null;
      setPixiReady(false);
      rectsRef.current = [];
      hoveredRectRef.current = null;
      hoveredBarRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!pixiReady) return;
    resizePixi(appRef.current, layout);
    if (sceneRef.current) drawScene(sceneRef.current);
    drawHover(hoverRef.current, hoveredRectRef.current, hoveredBarRef.current);
    drawPlayhead(playheadRef.current);
  }, [flowmap, layout, activeRhyme, colorMap, pixiReady]);

  useEffect(() => {
    if (!pixiReady) return;
    drawPlayhead(playheadRef.current);
  }, [currentTime, layout, pixiReady]);

  function drawScene(scene: Container) {
    scene.removeChildren();
    rectsRef.current = [];

    const graphics = new Graphics();
    scene.addChild(graphics);
    drawHeader(graphics, scene);
    drawBars(graphics, scene);
  }

  function drawHeader(graphics: Graphics, scene: Container) {
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

  function drawBars(graphics: Graphics, scene: Container) {
    const byBar = groupSyllablesByBar(flowmap.syllables);
    const indexByBar = barIndexMap(flowmap.bars);
    const maxDensity = Math.max(...flowmap.bars.map((bar) => bar.density), 0.01);
    const gridW = layout.signature * layout.beatW;

    flowmap.bars.forEach((bar, index) => {
      const rowY = FLOW_DIMS.headerH + index * FLOW_DIMS.barH;
      graphics.rect(FLOW_DIMS.labelW, rowY, gridW, FLOW_DIMS.barH).fill(index % 2 === 0 ? 0x0e0e0e : 0x111111);
      graphics.moveTo(0, rowY + FLOW_DIMS.barH).lineTo(FLOW_DIMS.labelW + gridW + FLOW_DIMS.densW, rowY + FLOW_DIMS.barH)
        .stroke({ color: 0x171717, width: 1 });

      for (let beat = 0; beat < layout.signature; beat += 1) {
        const x = FLOW_DIMS.labelW + beat * layout.beatW;
        graphics.moveTo(x, rowY).lineTo(x, rowY + FLOW_DIMS.barH).stroke({ color: 0x191919, width: 1 });
        for (let sub = 1; sub < FLOW_DIMS.subdivs; sub += 1) {
          const sx = x + (sub / FLOW_DIMS.subdivs) * layout.beatW;
          graphics.moveTo(sx, rowY + FLOW_DIMS.barH * 0.35).lineTo(sx, rowY + FLOW_DIMS.barH).stroke({ color: 0x151515, width: 1 });
        }
      }

      const label = new Text({ text: `Bar ${bar.bar_no}`, style: { fill: 0x555555, fontFamily: 'monospace', fontSize: 10 } });
      label.anchor.set(1, 0.5);
      label.position.set(FLOW_DIMS.labelW - 8, rowY + FLOW_DIMS.barH / 2);
      scene.addChild(label);

      const densityX = FLOW_DIMS.labelW + gridW + 4;
      const densityW = FLOW_DIMS.densW - 8;
      graphics.rect(densityX, rowY + 6, densityW, FLOW_DIMS.barH - 12).fill(0x161616);
      const pct = bar.density / maxDensity;
      const fillH = (FLOW_DIMS.barH - 12) * pct;
      graphics.rect(densityX, rowY + 6 + (FLOW_DIMS.barH - 12) - fillH, densityW, fillH).fill({ color: 0xff3d00, alpha: 0.25 + pct * 0.65 });

      const syllables = byBar.get(bar.bar_no) || [];
      for (const syllable of syllables) {
        const rowIndex = indexByBar.get(syllable.bar_no);
        if (rowIndex === undefined) continue;
        drawSyllable(graphics, syllable, rowIndex);
      }
    });
  }

  function drawSyllable(graphics: Graphics, syllable: FlowSyllable, rowIndex: number) {
    const rect = syllableRect(syllable, rowIndex, layout.beatW);
    const dimmed = activeRhyme && syllable.rhyme_group !== activeRhyme;
    const color = syllable.rhyme_group ? (colorMap.get(syllable.rhyme_group) || 0x444444) : 0x2e2e2e;
    rectsRef.current.push(rect);
    graphics.roundRect(rect.x, rect.y, rect.width, rect.height, 2).fill({
      color: dimmed ? 0x282828 : color,
      alpha: dimmed ? 0.35 : syllable.stress ? 1 : 0.42,
    });
  }

  function drawHover(layer: Graphics | null, rect: SyllableRect | null, barNo: number | null) {
    if (!layer) return;
    layer.clear();
    if (barNo !== null) drawBarPlayButton(layer, barNo);
    if (rect) {
      const color = rect.syllable.rhyme_group ? (colorMap.get(rect.syllable.rhyme_group) || 0xff3d00) : 0xff3d00;
      layer.roundRect(rect.x - 5, rect.y - 5, rect.width + 10, rect.height + 10, 5)
        .fill({ color, alpha: 0.18 })
        .stroke({ color, width: 2, alpha: 0.95 });
      layer.roundRect(rect.x - 2, rect.y - 2, rect.width + 4, rect.height + 4, 3)
        .stroke({ color: 0xffffff, width: 1, alpha: 0.75 });
    }
  }

  function drawBarPlayButton(layer: Graphics, barNo: number) {
    const rowIndex = flowmap.bars.findIndex((bar) => bar.bar_no === barNo);
    if (rowIndex < 0) return;
    const centerX = barPlayCenterX();
    const centerY = FLOW_DIMS.headerH + rowIndex * FLOW_DIMS.barH + FLOW_DIMS.barH / 2;
    layer.circle(centerX, centerY, 13)
      .fill({ color: 0xff3d00, alpha: 0.08 })
      .stroke({ color: 0xff3d00, width: 1.2, alpha: 0.82 });
    layer.circle(centerX, centerY, 8.5)
      .stroke({ color: 0xffffff, width: 0.8, alpha: 0.28 });
    layer.moveTo(centerX - 3, centerY - 5)
      .lineTo(centerX + 4, centerY)
      .lineTo(centerX - 3, centerY + 5)
      .closePath()
      .stroke({ color: 0xffffff, width: 1.4, alpha: 0.9 });
    layer.poly([
      centerX - 3.4, centerY - 5.4,
      centerX - 3.4, centerY + 5.4,
      centerX + 4.3, centerY,
    ]).fill({ color: 0xffffff, alpha: 0.035 });
  }

  function drawPlayhead(playhead: Graphics | null) {
    if (!playhead || flowmap.beats.length === 0) return;
    playhead.clear();
    playhead.removeChildren();
    const beatIndex = findBeatIndex(flowmap, currentTime);
    const beat = flowmap.beats[beatIndex];
    const rowIndex = flowmap.bars.findIndex((bar) => bar.bar_no === beat.bar_no);
    if (rowIndex < 0) return;

    const nextTime = beatIndex + 1 < flowmap.beats.length
      ? flowmap.beats[beatIndex + 1].time
      : beat.time + 60 / flowmap.metadata.bpm;
    const frac = nextTime > beat.time ? Math.min((currentTime - beat.time) / (nextTime - beat.time), 1) : 0;
    const x = FLOW_DIMS.labelW + (beat.beat_no - 1 + frac) * layout.beatW;
    const rowY = FLOW_DIMS.headerH + rowIndex * FLOW_DIMS.barH;
    playhead.rect(FLOW_DIMS.labelW, rowY, layout.signature * layout.beatW, FLOW_DIMS.barH).fill({ color: 0xff3d00, alpha: 0.06 });
    playhead.moveTo(x, rowY).lineTo(x, rowY + FLOW_DIMS.barH).stroke({ color: 0xffffff, width: 1.5, alpha: 0.75 });
    keepActiveBarInView(rowY);

    const active = findActiveSyllable(flowmap, currentTime);
    if (!active || active.bar_no !== beat.bar_no) return;
    const activeRowIndex = flowmap.bars.findIndex((bar) => bar.bar_no === active.bar_no);
    if (activeRowIndex < 0) return;

    const rect = syllableRect(active, activeRowIndex, layout.beatW);
    const color = active.rhyme_group ? (colorMap.get(active.rhyme_group) || 0xff3d00) : 0xff3d00;
    playhead.roundRect(rect.x - 6, rect.y - 6, rect.width + 12, rect.height + 12, 6)
      .fill({ color, alpha: 0.2 })
      .stroke({ color, width: 2, alpha: 1 });
    playhead.roundRect(rect.x - 2, rect.y - 2, rect.width + 4, rect.height + 4, 3)
      .stroke({ color: 0xffffff, width: 1, alpha: 0.85 });

    const label = active.word || '';
    if (label) {
      const labelText = new Text({
        text: label,
        style: {
          fill: color,
          fontFamily: 'monospace',
          fontSize: 11,
          fontWeight: '700',
        },
      });
      const padX = 6;
      const padY = 3;
      const labelW = labelText.width + padX * 2;
      const labelH = labelText.height + padY * 2;
      const labelX = Math.max(FLOW_DIMS.labelW + 4, Math.min(rect.x - labelW / 2 + rect.width / 2, layout.width - labelW - 8));
      const labelY = Math.max(4, rect.y - labelH - 5);
      playhead.roundRect(labelX, labelY, labelW, labelH, 4)
        .fill({ color: 0x0a0a0a, alpha: 0.88 })
        .stroke({ color, width: 1, alpha: 0.9 });
      labelText.position.set(labelX + padX, labelY + padY);
      playhead.addChild(labelText);
    }
  }

  function keepActiveBarInView(rowY: number) {
    const scrollEl = scrollRef.current;
    if (!scrollEl) return;
    const paddingTop = Number.parseFloat(window.getComputedStyle(scrollEl).paddingTop) || 0;
    const top = paddingTop + rowY;
    const bottom = top + FLOW_DIMS.barH;
    const margin = 20;
    const viewTop = scrollEl.scrollTop;
    const viewBottom = viewTop + scrollEl.clientHeight;
    if (top < viewTop + margin || bottom > viewBottom - margin) {
      scrollEl.scrollTop = Math.max(0, top - 80);
    }
  }

  function hitPlayButton(x: number, y: number, barNo: number | null): boolean {
    if (barNo === null) return false;
    const rowIndex = flowmap.bars.findIndex((bar) => bar.bar_no === barNo);
    if (rowIndex < 0) return false;
    const centerX = barPlayCenterX();
    const centerY = FLOW_DIMS.headerH + rowIndex * FLOW_DIMS.barH + FLOW_DIMS.barH / 2;
    return Math.hypot(x - centerX, y - centerY) <= 15;
  }

  return (
    <div ref={scrollRef} className="flow-stage-wrap">
      <div ref={hostRef} className="flow-stage" />
      {tooltip && (
        <div className="tooltip" style={{ left: tooltip.x, top: tooltip.y }}>
          <div className="tt-word">{tooltip.syllable.word}</div>
          <div className="tt-row">Beat <span>{tooltip.syllable.beat_no} + {tooltip.syllable.beat_pos.toFixed(2)}</span></div>
          <div className="tt-row">Bar <span>{tooltip.syllable.bar_no}</span></div>
          <div className="tt-row">Stress <span>{tooltip.syllable.stress ? 'stressed' : 'unstressed'}</span></div>
          <div className="tt-row">Grid <span>{tooltip.syllable.subdivision} · {tooltip.syllable.is_on_beat ? 'on beat' : 'off beat'}</span></div>
          <div className="tt-row">Timing <span>{(tooltip.syllable.timing_quality * 100).toFixed(0)}%</span></div>
          {tooltip.syllable.rhyme_group && <div className="tt-row">Rhyme <span>Group {tooltip.syllable.rhyme_group}</span></div>}
          {tooltip.syllable.center_time >= 0 && <div className="tt-row">Time <span>{tooltip.syllable.center_time.toFixed(2)}s</span></div>}
        </div>
      )}
    </div>
  );
}

function barPlayCenterX(): number {
  return FLOW_DIMS.labelW - 60;
}

function findBarAtY(flowmap: FlowMap, y: number): number | null {
  const rowIndex = Math.floor((y - FLOW_DIMS.headerH) / FLOW_DIMS.barH);
  if (rowIndex < 0 || rowIndex >= flowmap.bars.length) return null;
  return flowmap.bars[rowIndex].bar_no;
}

function resizePixi(app: Application | null, layout: FlowLayout | null) {
  if (!app || !layout || !app.renderer) return;
  if (typeof app.renderer.resize === 'function') {
    app.renderer.resize(layout.width, layout.height);
  }
  const canvas = getPixiCanvas(app);
  if (!canvas) return;
  canvas.style.width = `${layout.width}px`;
  canvas.style.height = `${layout.height}px`;
}

function findBeatIndex(flowmap: FlowMap, time: number): number {
  let low = 0;
  let high = flowmap.beats.length - 1;
  while (low < high) {
    const mid = (low + high + 1) >> 1;
    if (flowmap.beats[mid].time <= time) low = mid;
    else high = mid - 1;
  }
  return low;
}

function findActiveSyllable(flowmap: FlowMap, time: number): FlowSyllable | null {
  if (flowmap.syllables.length === 0) return null;

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

function getPixiCanvas(app: Application): HTMLCanvasElement | null {
  const candidate = (app.renderer as unknown as { canvas?: HTMLCanvasElement; view?: HTMLCanvasElement } | undefined);
  return candidate?.canvas || candidate?.view || null;
}

function safeDestroyPixiApp(app: Application): void {
  const candidate = app as unknown as {
    _cancelResize?: () => void;
    stop?: () => void;
    destroy?: (removeView?: boolean) => void;
  };
  if (typeof candidate._cancelResize !== 'function') {
    candidate._cancelResize = () => {};
  }
  try {
    candidate.stop?.();
    candidate.destroy?.(true);
  } catch {
    // Pixi may already be partially torn down during rapid React transitions.
  }
}
