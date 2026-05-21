import type { FlowMap, FlowSyllable } from '../types';

type LegacyFlowMap = {
  schema_version?: number;
  metadata: FlowMap['metadata'];
  beats?: Array<Record<string, any>>;
  words?: FlowMap['words'];
  syllables?: Array<Record<string, any>>;
  bars?: Array<Record<string, any>>;
  rhyme_groups?: FlowMap['rhyme_groups'];
  rhyme_chains?: FlowMap['rhyme_chains'];
  summary?: Partial<FlowMap['summary']>;
};

export function normalizeFlowMap(input: LegacyFlowMap): FlowMap {
  const beats = (input.beats || []).map((beat, index) => ({
    time: beat.time,
    beat_no: beat.beat_no,
    bar_no: beat.bar_no,
    beat_index: beat.beat_index ?? index,
    confidence: beat.confidence ?? 1,
    downbeat_confidence: beat.downbeat_confidence ?? (beat.beat_no === 1 ? 0.5 : 0),
    source: beat.source ?? 'detected',
  }));

  const syllables = (input.syllables || []).map((syllable, index) => ({
    word: syllable.word,
    word_id: syllable.word_id ?? index,
    syllable_index: syllable.syllable_index,
    time: syllable.time,
    start: syllable.start ?? syllable.time,
    end: syllable.end ?? syllable.time,
    center_time: syllable.center_time ?? syllable.time,
    beat_pos: syllable.beat_pos,
    beat_no: syllable.beat_no,
    bar_no: syllable.bar_no,
    global_beat_idx: syllable.global_beat_idx,
    beat_index: syllable.beat_index ?? syllable.global_beat_idx,
    subdivision: syllable.subdivision ?? '1/4',
    is_on_beat: syllable.is_on_beat ?? (syllable.beat_pos <= 0.08 || syllable.beat_pos >= 0.92),
    stress: syllable.stress,
    rhyme_group: syllable.rhyme_group,
    timing_quality: syllable.timing_quality ?? 1,
  }));

  const bars = (input.bars || []).map((bar) => ({
    bar_no: bar.bar_no,
    syllable_count: bar.syllable_count,
    density: bar.density,
    syncopation: bar.syncopation,
    syncopation_score: bar.syncopation_score ?? bar.syncopation,
    pocket_offset: bar.pocket_offset ?? 0,
    timing_variance: bar.timing_variance ?? 0,
    stressed_on_beat_ratio: bar.stressed_on_beat_ratio ?? bar.stressed_ratio,
    stressed_ratio: bar.stressed_ratio,
  }));

  return {
    schema_version: input.schema_version ?? 1,
    metadata: {
      ...input.metadata,
      analysis_mode: input.metadata.analysis_mode ?? 'legacy',
    },
    beats,
    words: input.words || [],
    syllables,
    bars,
    rhyme_groups: input.rhyme_groups || [],
    rhyme_chains: input.rhyme_chains || [],
    summary: {
      avg_density: input.summary?.avg_density ?? 0,
      peak_density: input.summary?.peak_density ?? 0,
      syncopation_score: input.summary?.syncopation_score ?? 0,
      consistency: input.summary?.consistency ?? 0,
      rhyme_chain_avg: input.summary?.rhyme_chain_avg ?? 0,
      pocket_score: input.summary?.pocket_score ?? 0,
      timing_quality_avg: input.summary?.timing_quality_avg ?? 1,
      density_variation: input.summary?.density_variation ?? 0,
      delivery_consistency: input.summary?.delivery_consistency ?? input.summary?.consistency ?? 0,
    },
  };
}
