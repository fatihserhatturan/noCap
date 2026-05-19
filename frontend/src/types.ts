export type StepId = 'load' | 'beat' | 'transcribe' | 'align';

export interface FlowBeat {
  time: number;
  beat_no: number;
  bar_no: number;
}

export interface FlowSyllable {
  word: string;
  syllable_index: number;
  time: number;
  beat_pos: number;
  beat_no: number;
  bar_no: number;
  global_beat_idx: number;
  stress: boolean;
  rhyme_group: string;
}

export interface FlowBar {
  bar_no: number;
  syllable_count: number;
  density: number;
  syncopation: number;
  stressed_ratio: number;
}

export interface RhymeChain {
  group: string;
  count: number;
  occurrences: Array<{
    syllable_idx: number;
    word: string;
    time: number;
    bar_no: number;
  }>;
}

export interface FlowMap {
  metadata: {
    title: string;
    bpm: number;
    duration: number;
    time_signature: number;
    audio_path: string | null;
  };
  beats: FlowBeat[];
  syllables: FlowSyllable[];
  bars: FlowBar[];
  rhyme_chains: RhymeChain[];
  summary: {
    avg_density: number;
    peak_density: number;
    syncopation_score: number;
    consistency: number;
    rhyme_chain_avg: number;
  };
}

export type AnalyzeMessage =
  | { type: 'progress'; step: StepId; msg?: string; done?: boolean }
  | { type: 'complete'; flowmap: FlowMap; has_vocals: boolean }
  | { type: 'error'; msg: string; trace?: string };

export interface StepState {
  status: 'idle' | 'active' | 'done';
  msg: string;
}
