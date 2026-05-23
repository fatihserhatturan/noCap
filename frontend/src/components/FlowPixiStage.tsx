import { useEffect, useMemo, useRef, useState } from 'react';
import { Application, Container, Graphics } from 'pixi.js';
import type { FlowMap, FlowSyllable } from '../types';
import { buildColorMap } from '../flow/colors';
import { computeLayout, type FlowLayout, type SyllableRect } from '../flow/layout';
import { drawHover } from '../flow/pixi/hover';
import { getPixiCanvas, resizePixi, safeDestroyPixiApp } from '../flow/pixi/pixiApp';
import { drawPlayhead } from '../flow/pixi/playhead';
import { drawScene } from '../flow/pixi/scene';
import { makeHandlers, type BarTooltipState, type StageCallbacks, type StageHandlers, type TooltipState } from '../flow/pixi/handlers';
import { t } from '../i18n';

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
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<Application | null>(null);
  const sceneRef = useRef<Container | null>(null);
  const hoverRef = useRef<Graphics | null>(null);
  const playheadRef = useRef<Graphics | null>(null);
  const rectsRef = useRef<SyllableRect[]>([]);
  const hoveredRectRef = useRef<SyllableRect | null>(null);
  const hoveredBarRef = useRef<number | null>(null);
  const layoutRef = useRef<FlowLayout | null>(null);
  const flowmapRef = useRef(flowmap);
  const colorMapRef = useRef(new Map<string, number>());
  const callbacks = useRef<StageCallbacks>({ onBarHover, onBarPlay, onWordPlay });
  const [pixiReady, setPixiReady] = useState(false);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [barTooltip, setBarTooltip] = useState<BarTooltipState | null>(null);
  const [containerWidth, setContainerWidth] = useState(900);
  const colorMap = useMemo(() => buildColorMap(flowmap.rhyme_chains.map((chain) => chain.group)), [flowmap]);
  const layout = useMemo(() => computeLayout(flowmap, containerWidth), [flowmap, containerWidth]);

  layoutRef.current = layout;
  flowmapRef.current = flowmap;
  colorMapRef.current = colorMap;
  callbacks.current = { onBarHover, onBarPlay, onWordPlay };

  useEffect(() => observeHost(hostRef.current, setContainerWidth), []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    const app = new Application();
    appRef.current = app;
    const handlers = makeHandlers({
      app,
      flowmapRef,
      colorMapRef,
      layoutRef,
      rectsRef,
      hoveredRectRef,
      hoveredBarRef,
      callbacks,
      setTooltip,
      setBarTooltip,
    });
    void app.init({
      width: layoutRef.current?.width || 900,
      height: layoutRef.current?.height || 600,
      background: '#0d0d0d',
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    }).then(() => {
      if (disposed) return safeDestroyPixiApp(app);
      const canvas = getPixiCanvas(app);
      if (!canvas) return;
      host.replaceChildren(canvas);
      canvas.className = 'flow-canvas';
      addCanvasHandlers(canvas, handlers);
      sceneRef.current = new Container();
      hoverRef.current = new Graphics();
      playheadRef.current = new Graphics();
      app.stage.addChild(sceneRef.current, hoverRef.current, playheadRef.current);
      setPixiReady(true);
    });
    return () => {
      disposed = true;
      const canvas = getPixiCanvas(app);
      if (canvas) removeCanvasHandlers(canvas, handlers);
      safeDestroyPixiApp(app);
      if (canvas && host.contains(canvas)) host.replaceChildren();
      appRef.current = null;
      sceneRef.current = null;
      hoverRef.current = null;
      playheadRef.current = null;
      rectsRef.current = [];
      setPixiReady(false);
    };
  }, []);

  useEffect(() => {
    if (!pixiReady || !sceneRef.current) return;
    resizePixi(appRef.current, layout);
    drawScene(sceneRef.current, { flowmap, layout, activeRhyme, colorMap, rects: rectsRef.current });
    drawHover(hoverRef.current, flowmap, colorMap, hoveredRectRef.current, hoveredBarRef.current);
    drawPlayhead(playheadRef.current, flowmap, layout, currentTime, scrollRef.current);
  }, [flowmap, layout, activeRhyme, colorMap, pixiReady]);

  useEffect(() => {
    if (pixiReady) drawPlayhead(playheadRef.current, flowmap, layout, currentTime, scrollRef.current);
  }, [currentTime, layout, pixiReady]);

  return (
    <div ref={scrollRef} className="flow-stage-wrap">
      <div ref={hostRef} className="flow-stage" />
      {tooltip && <SyllableTooltip tooltip={tooltip} />}
      {barTooltip && <BarTooltip tooltip={barTooltip} />}
    </div>
  );
}

function addCanvasHandlers(canvas: HTMLCanvasElement, handlers: StageHandlers) {
  canvas.addEventListener('mousemove', handlers.mousemove);
  canvas.addEventListener('click', handlers.click);
  canvas.addEventListener('mouseleave', handlers.mouseleave);
}

function removeCanvasHandlers(canvas: HTMLCanvasElement, handlers: StageHandlers) {
  canvas.removeEventListener('mousemove', handlers.mousemove);
  canvas.removeEventListener('click', handlers.click);
  canvas.removeEventListener('mouseleave', handlers.mouseleave);
}

function observeHost(host: HTMLDivElement | null, setContainerWidth: (updater: (current: number) => number) => void) {
  if (!host) return;
  const observer = new ResizeObserver(([entry]) => {
    const nextWidth = Math.max(360, Math.floor(entry.contentRect.width));
    setContainerWidth((current) => (Math.abs(current - nextWidth) > 2 ? nextWidth : current));
  });
  observer.observe(host);
  return () => observer.disconnect();
}

function SyllableTooltip({ tooltip }: { tooltip: TooltipState }) {
  const syl = tooltip.syllable;
  return (
    <div className="tooltip" style={{ left: tooltip.x, top: tooltip.y }}>
      <div className="tt-word">{syl.word}</div>
      <div className="tt-row">{t('tooltip.beat')} <span>{syl.beat_no} + {syl.beat_pos.toFixed(2)}</span></div>
      <div className="tt-row">{t('tooltip.bar')} <span>{syl.bar_no}</span></div>
      <div className="tt-row">{t('tooltip.stress')} <span>{syl.stress ? t('tooltip.stressed') : t('tooltip.unstressed')}</span></div>
      <div className="tt-row">{t('tooltip.grid')} <span>{syl.subdivision} · {syl.is_on_beat ? t('tooltip.onBeat') : t('tooltip.offBeat')}</span></div>
      <div className="tt-row">{t('tooltip.timing')} <span>{(syl.timing_quality * 100).toFixed(0)}%</span></div>
      {syl.rhyme_group && <div className="tt-row">{t('tooltip.rhyme')} <span>{t('tooltip.detected')}</span></div>}
      {syl.center_time >= 0 && <div className="tt-row">{t('tooltip.time')} <span>{syl.center_time.toFixed(2)}s</span></div>}
    </div>
  );
}

function BarTooltip({ tooltip }: { tooltip: BarTooltipState }) {
  const bar = tooltip.bar;
  return (
    <div className="tooltip bar-tooltip" style={{ left: tooltip.x, top: tooltip.y }}>
      <div className="tt-word">{t('tooltip.bar')} {bar.bar_no}</div>
      <div className="tt-row">{t('metrics.density')} <span>{bar.density} syl/beat</span></div>
      <div className="tt-row">{t('metrics.syncopation')} <span>{(bar.syncopation_score * 100).toFixed(0)}%</span></div>
      <div className="tt-row">{t('tooltip.energy')} <span>{(bar.rms_avg * 100).toFixed(0)}%</span></div>
      <div className="tt-row">{t('tooltip.onset')} <span>{(bar.onset_strength_avg * 100).toFixed(0)}%</span></div>
      <div className="tt-row">{t('tooltip.localBpm')} <span>{bar.local_bpm.toFixed(1)}</span></div>
      <div className="tt-row">{t('tooltip.brightness')} <span>{bar.spectral_centroid_avg.toFixed(0)} Hz</span></div>
      <div className="tt-row">{t('tooltip.timing')} <span>{(bar.timing_variance * 100).toFixed(1)}</span></div>
      <div className="tt-row">{t('tooltip.pocket')} <span>{bar.pocket_label} · {(bar.pocket_confidence * 100).toFixed(0)}%</span></div>
      <div className="tt-row">{t('tooltip.stressed')} <span>{(bar.stressed_ratio * 100).toFixed(0)}%</span></div>
      <div className="tt-row">{t('tooltip.syllables')} <span>{bar.syllable_count}</span></div>
    </div>
  );
}
