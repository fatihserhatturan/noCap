import { useState } from 'react';
import type { FlowMap, FlowSyllable } from '../types';
import { getBarTimeRange, getWordTimeRange, type PlayRange } from '../flow/playbackRanges';

export function useViewerState() {
  const [currentTime, setCurrentTime] = useState(0);
  const [source, setSource] = useState<'mix' | 'vocals'>('mix');
  const [activeRhyme, setActiveRhyme] = useState<string | null>(null);
  const [hoveredBar, setHoveredBar] = useState<number | null>(null);
  const [playRange, setPlayRange] = useState<PlayRange | null>(null);
  const [syncOffset, setSyncOffset] = useState(0);

  function reset() {
    setSource('mix');
    setCurrentTime(0);
    setActiveRhyme(null);
    setHoveredBar(null);
    setPlayRange(null);
    setSyncOffset(0);
  }

  function playBar(flowmap: FlowMap, barNo: number) {
    const range = getBarTimeRange(flowmap, barNo);
    if (range) setPlayRange({ id: Date.now(), ...shiftRange(range, syncOffset, flowmap.metadata.duration) });
  }

  function playWord(flowmap: FlowMap, syllable: FlowSyllable) {
    const range = getWordTimeRange(flowmap, syllable);
    if (range) setPlayRange({ id: Date.now(), ...shiftRange(range, syncOffset, flowmap.metadata.duration) });
  }

  function adjustSyncOffset(delta: number) {
    setSyncOffset((value) => Math.max(-2, Math.min(2, Number((value + delta).toFixed(3)))));
  }

  return {
    currentTime,
    syncOffset,
    source,
    activeRhyme,
    hoveredBar,
    playRange,
    setCurrentTime,
    setSyncOffset,
    adjustSyncOffset,
    setSource,
    setActiveRhyme,
    setHoveredBar,
    reset,
    playBar,
    playWord,
  };
}

function shiftRange(range: Omit<PlayRange, 'id'>, syncOffset: number, duration: number): Omit<PlayRange, 'id'> {
  const start = Math.max(0, range.start - syncOffset);
  const end = Math.min(duration || range.end, Math.max(start + 0.05, range.end - syncOffset));
  return { start, end };
}
