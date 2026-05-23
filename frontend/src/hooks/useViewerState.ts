import { useState } from 'react';
import type { FlowMap, FlowSyllable } from '../types';
import { getBarTimeRange, getWordTimeRange, type PlayRange } from '../flow/playbackRanges';

export function useViewerState() {
  const [currentTime, setCurrentTime] = useState(0);
  const [source, setSource] = useState<'mix' | 'vocals'>('mix');
  const [activeRhyme, setActiveRhyme] = useState<string | null>(null);
  const [hoveredBar, setHoveredBar] = useState<number | null>(null);
  const [playRange, setPlayRange] = useState<PlayRange | null>(null);

  function reset() {
    setSource('mix');
    setCurrentTime(0);
    setActiveRhyme(null);
    setHoveredBar(null);
    setPlayRange(null);
  }

  function playBar(flowmap: FlowMap, barNo: number) {
    const range = getBarTimeRange(flowmap, barNo);
    if (range) setPlayRange({ id: Date.now(), ...range });
  }

  function playWord(flowmap: FlowMap, syllable: FlowSyllable) {
    const range = getWordTimeRange(flowmap, syllable);
    if (range) setPlayRange({ id: Date.now(), ...range });
  }

  return {
    currentTime,
    source,
    activeRhyme,
    hoveredBar,
    playRange,
    setCurrentTime,
    setSource,
    setActiveRhyme,
    setHoveredBar,
    reset,
    playBar,
    playWord,
  };
}
