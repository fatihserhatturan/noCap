import type { FlowMap, FlowSyllable } from '../types';

export interface PlayRange {
  id: number;
  start: number;
  end: number;
}

export function getBarTimeRange(flowmap: FlowMap, barNo: number): Omit<PlayRange, 'id'> | null {
  const barBeats = flowmap.beats.filter((beat) => beat.bar_no === barNo);
  if (barBeats.length === 0) return null;
  const start = barBeats[0].time;
  const nextBarBeat = flowmap.beats.find((beat) => beat.bar_no > barNo);
  const lastBeat = barBeats[barBeats.length - 1];
  const beatLength = flowmap.metadata.bpm > 0 ? 60 / flowmap.metadata.bpm : 0.75;
  const end = nextBarBeat?.time ?? Math.min(flowmap.metadata.duration || lastBeat.time + beatLength, lastBeat.time + beatLength);
  return end > start ? { start, end } : null;
}

export function getWordTimeRange(flowmap: FlowMap, target: FlowSyllable): Omit<PlayRange, 'id'> | null {
  if (target.center_time < 0) return null;
  const index = flowmap.syllables.findIndex((syllable) => sameSyllable(syllable, target));
  if (index < 0) return null;
  const first = firstWordSyllable(flowmap, target, index);
  const last = lastWordSyllable(flowmap, target, index);
  const beatLength = flowmap.metadata.bpm > 0 ? 60 / flowmap.metadata.bpm : 0.75;
  const start = Math.max(0, flowmap.syllables[first].start - 0.04);
  const next = flowmap.syllables[last + 1];
  const estimatedEnd = flowmap.syllables[last].end + Math.min(0.2, beatLength * 0.25);
  const end = Math.min(
    flowmap.metadata.duration || estimatedEnd,
    Math.max(start + 0.28, next?.start ? next.start - 0.03 : estimatedEnd),
  );
  return end > start ? { start, end } : null;
}

function sameSyllable(left: FlowSyllable, right: FlowSyllable): boolean {
  return left.word === right.word
    && left.bar_no === right.bar_no
    && left.beat_no === right.beat_no
    && left.syllable_index === right.syllable_index
    && Math.abs(left.center_time - right.center_time) < 0.001;
}

function firstWordSyllable(flowmap: FlowMap, target: FlowSyllable, index: number): number {
  let first = index;
  while (first > 0 && flowmap.syllables[first - 1].word === target.word && flowmap.syllables[first - 1].bar_no === target.bar_no) {
    first -= 1;
  }
  return first;
}

function lastWordSyllable(flowmap: FlowMap, target: FlowSyllable, index: number): number {
  let last = index;
  while (
    last + 1 < flowmap.syllables.length
    && flowmap.syllables[last + 1].word === target.word
    && flowmap.syllables[last + 1].bar_no === target.bar_no
  ) {
    last += 1;
  }
  return last;
}
