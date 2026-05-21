import type { FlowMap } from './types';
import { normalizeFlowMap } from './flow/normalize';

export function sampleFlowmap(): FlowMap {
  const bpm = 92;
  const beatInterval = 60 / bpm;
  const beats = Array.from({ length: 48 }, (_, index) => ({
    time: index * beatInterval,
    beat_no: (index % 4) + 1,
    bar_no: Math.floor(index / 4) + 1,
  }));
  const words = ['kick', 'snare', 'rhyme', 'time', 'late', 'line', 'flow', 'glow'];
  const syllables = Array.from({ length: 46 }, (_, index) => {
    const barNo = Math.floor(index / 4) + 1;
    const beatNo = (index % 4) + 1;
    const beatPos = ((index * 0.37) % 0.74) + 0.06;
    return {
      word: words[index % words.length],
      syllable_index: 0,
      time: ((barNo - 1) * 4 + beatNo - 1 + beatPos) * beatInterval,
      beat_pos: beatPos,
      beat_no: beatNo,
      bar_no: barNo,
      global_beat_idx: (barNo - 1) * 4 + beatNo - 1,
      stress: index % 3 !== 0,
      rhyme_group: index % 2 === 0 ? 'A' : index % 5 === 0 ? 'B' : '',
    };
  });
  const bars = Array.from({ length: 12 }, (_, index) => {
    const count = syllables.filter((syllable) => syllable.bar_no === index + 1).length;
    return {
      bar_no: index + 1,
      syllable_count: count,
      density: count / 4,
      syncopation: 0.35 + (index % 4) * 0.1,
      stressed_ratio: 0.55,
    };
  });
  return normalizeFlowMap({
    metadata: {
      title: 'Sample Flow',
      bpm,
      duration: beats[beats.length - 1]?.time || 0,
      time_signature: 4,
      audio_path: null,
    },
    beats,
    syllables,
    bars,
    rhyme_chains: [
      {
        group: 'A',
        count: syllables.filter((syllable) => syllable.rhyme_group === 'A').length,
        occurrences: syllables
          .map((syllable, index) => ({ syllable, index }))
          .filter(({ syllable }) => syllable.rhyme_group === 'A')
          .map(({ syllable, index }) => ({
            syllable_idx: index,
            word: syllable.word,
            time: syllable.time,
            bar_no: syllable.bar_no,
          })),
      },
      {
        group: 'B',
        count: syllables.filter((syllable) => syllable.rhyme_group === 'B').length,
        occurrences: syllables
          .map((syllable, index) => ({ syllable, index }))
          .filter(({ syllable }) => syllable.rhyme_group === 'B')
          .map(({ syllable, index }) => ({
            syllable_idx: index,
            word: syllable.word,
            time: syllable.time,
            bar_no: syllable.bar_no,
          })),
      },
    ],
    summary: {
      avg_density: 0.95,
      peak_density: 1.25,
      syncopation_score: 0.48,
      consistency: 0.82,
      rhyme_chain_avg: 3.2,
    },
  });
}
