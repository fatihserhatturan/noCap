export type StepId = 'load' | 'beat' | 'transcribe' | 'align';

export interface FlowBeat {
  time: number;
  beat_no: number;
  bar_no: number;
  beat_index: number;
  confidence: number;
  downbeat_confidence: number;
  source: 'detected' | 'synthetic' | 'manual';
}

export interface FlowWord {
  id: number;
  word: string;
  start: number;
  end: number;
  probability: number;
  syllable_count: number;
  stress_pattern: number[];
  timing_quality: number;
}

export interface FlowSyllable {
  word: string;
  word_id: number;
  syllable_index: number;
  time: number;
  start: number;
  end: number;
  center_time: number;
  beat_pos: number;
  beat_no: number;
  bar_no: number;
  global_beat_idx: number;
  beat_index: number;
  subdivision: string;
  is_on_beat: boolean;
  stress: boolean;
  rhyme_group: string;
  timing_quality: number;
}

export interface FlowBar {
  bar_no: number;
  syllable_count: number;
  density: number;
  syncopation: number;
  syncopation_score: number;
  pocket_offset: number;
  timing_variance: number;
  stressed_on_beat_ratio: number;
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

export interface RhymeGroup {
  id: string;
  type: 'perfect' | 'multi_syllable' | 'slant' | 'assonance' | 'internal' | string;
  placement?: 'end' | 'internal' | string;
  phonetic_key: string;
  strength: number;
  occurrences: Array<{
    word_id: number;
    syllable_start: number;
    syllable_end: number;
    start: number;
    end: number;
    time: number;
    bar_no: number;
    word: string;
  }>;
}

export interface FlowMap {
  schema_version: number;
  metadata: {
    title: string;
    bpm: number;
    duration: number;
    time_signature: number;
    audio_path: string | null;
    analysis_mode?: string;
  };
  beats: FlowBeat[];
  words: FlowWord[];
  syllables: FlowSyllable[];
  bars: FlowBar[];
  rhyme_groups: RhymeGroup[];
  rhyme_chains: RhymeChain[];
  summary: {
    avg_density: number;
    peak_density: number;
    syncopation_score: number;
    consistency: number;
    rhyme_chain_avg: number;
    pocket_score: number;
    timing_quality_avg: number;
    density_variation: number;
    delivery_consistency: number;
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
