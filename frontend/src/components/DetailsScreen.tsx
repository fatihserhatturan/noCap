import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { FlowBar, FlowMap } from '../types';

type CompareMetric = 'density' | 'syncopation_score' | 'stressed_ratio' | 'syllable_count' | 'pocket_offset' | 'timing_variance';

const compareOptions: Array<{ key: CompareMetric; label: string; format: (value: number) => string }> = [
  { key: 'density', label: 'Density', format: (value) => value.toFixed(2) },
  { key: 'syncopation_score', label: 'Syncopation', format: (value) => `${(value * 100).toFixed(0)}%` },
  { key: 'stressed_ratio', label: 'Stress', format: (value) => `${(value * 100).toFixed(0)}%` },
  { key: 'syllable_count', label: 'Syllables', format: (value) => value.toFixed(0) },
  { key: 'pocket_offset', label: 'Pocket', format: (value) => value.toFixed(3) },
  { key: 'timing_variance', label: 'Timing', format: (value) => (value * 100).toFixed(1) },
];

export function DetailsScreen({
  flowmap,
  actions,
}: {
  flowmap: FlowMap;
  actions?: ReactNode;
}) {
  const [compareMetric, setCompareMetric] = useState<CompareMetric>('density');
  const option = compareOptions.find((item) => item.key === compareMetric) || compareOptions[0];
  const barStats = useMemo(() => buildBarStats(flowmap.bars), [flowmap]);
  const comparedBars = useMemo(() => {
    const values = flowmap.bars.map((bar) => bar[compareMetric]);
    const max = Math.max(...values, 0.01);
    return [...flowmap.bars]
      .sort((left, right) => right[compareMetric] - left[compareMetric])
      .map((bar) => ({ bar, pct: Math.min(1, Math.abs(bar[compareMetric]) / max) }));
  }, [flowmap, compareMetric]);
  const metricCards = [
    {
      label: 'Density',
      value: `${flowmap.summary.avg_density.toFixed(2)} syl/beat`,
      detail: `peak ${flowmap.summary.peak_density.toFixed(2)} · variation ${(flowmap.summary.density_variation * 100).toFixed(0)}%`,
      pct: flowmap.summary.avg_density / Math.max(flowmap.summary.peak_density, 1),
    },
    {
      label: 'Syncopation',
      value: `${(flowmap.summary.syncopation_score * 100).toFixed(0)}%`,
      detail: `bar avg ${(barStats.syncAvg * 100).toFixed(0)}% · max ${(barStats.syncMax * 100).toFixed(0)}%`,
      pct: flowmap.summary.syncopation_score,
    },
    {
      label: 'Pocket',
      value: `${(flowmap.summary.pocket_score * 100).toFixed(0)}%`,
      detail: `avg offset ${barStats.pocketAvg.toFixed(3)} · range ${barStats.pocketMin.toFixed(3)} / ${barStats.pocketMax.toFixed(3)}`,
      pct: flowmap.summary.pocket_score,
    },
    {
      label: 'Timing Quality',
      value: `${(flowmap.summary.timing_quality_avg * 100).toFixed(0)}%`,
      detail: `variance avg ${(barStats.timingAvg * 100).toFixed(1)} · max ${(barStats.timingMax * 100).toFixed(1)}`,
      pct: flowmap.summary.timing_quality_avg,
    },
    {
      label: 'Delivery',
      value: `${(flowmap.summary.delivery_consistency * 100).toFixed(0)}%`,
      detail: `consistency ${(flowmap.summary.consistency * 100).toFixed(0)}% · ${flowmap.bars.length} bars`,
      pct: flowmap.summary.delivery_consistency,
    },
    {
      label: 'Stress Placement',
      value: `${(barStats.stressedOnBeatAvg * 100).toFixed(0)}%`,
      detail: `stressed ratio avg ${(barStats.stressAvg * 100).toFixed(0)}%`,
      pct: barStats.stressedOnBeatAvg,
    },
  ];

  return (
    <main className="details-screen">
      <section className="details-head">
        <div>
          <h1>Details</h1>
          <p>{flowmap.metadata.title} · {flowmap.metadata.bpm.toFixed(1)} BPM · {flowmap.bars.length} bars</p>
        </div>
        <div className="details-head-right">
          {actions && <div className="details-actions">{actions}</div>}
          <div className="details-kpis">
            <span><b>{flowmap.syllables.length}</b> syllables</span>
            <span><b>{flowmap.words.length}</b> words</span>
            <span><b>{flowmap.rhyme_groups.length || flowmap.rhyme_chains.length}</b> rhyme groups</span>
          </div>
        </div>
      </section>

      <section className="details-metric-grid">
        {metricCards.map((metric) => (
          <article key={metric.label} className="detail-metric">
            <span>{metric.label}</span>
            <b>{metric.value}</b>
            <small>{metric.detail}</small>
            <div className="detail-meter">
              <div style={{ width: `${Math.min(100, Math.max(2, metric.pct * 100))}%` }} />
            </div>
          </article>
        ))}
      </section>

      <section className="details-grid">
        <div className="details-panel details-panel-wide">
          <div className="details-panel-head">
            <h3>Bar Compare</h3>
            <div className="details-segmented">
              {compareOptions.map((item) => (
                <button
                  key={item.key}
                  className={compareMetric === item.key ? 'seg-active' : ''}
                  onClick={() => setCompareMetric(item.key)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <div className="bar-compare-table">
            {comparedBars.slice(0, 24).map(({ bar, pct }) => (
              <div key={bar.bar_no} className="bar-compare-line">
                <span>Bar {bar.bar_no}</span>
                <div className="bar-compare-track">
                  <div style={{ width: `${Math.max(3, pct * 100)}%` }} />
                </div>
                <b>{option.format(bar[compareMetric])}</b>
              </div>
            ))}
          </div>
        </div>

        <div className="details-panel">
          <h3>Flow Metrics</h3>
          <dl className="details-list">
            <div><dt>Avg Density</dt><dd>{flowmap.summary.avg_density.toFixed(2)}</dd></div>
            <div><dt>Peak Density</dt><dd>{flowmap.summary.peak_density.toFixed(2)}</dd></div>
            <div><dt>Density Variation</dt><dd>{(flowmap.summary.density_variation * 100).toFixed(0)}%</dd></div>
            <div><dt>Consistency</dt><dd>{(flowmap.summary.consistency * 100).toFixed(0)}%</dd></div>
            <div><dt>Delivery</dt><dd>{(flowmap.summary.delivery_consistency * 100).toFixed(0)}%</dd></div>
            <div><dt>Rhyme Chain Avg</dt><dd>{flowmap.summary.rhyme_chain_avg.toFixed(1)}</dd></div>
          </dl>
        </div>

        <div className="details-panel details-panel-wide">
          <h3>Bar Data</h3>
          <div className="bar-data-table">
            <div className="bar-data-row bar-data-head">
              <span>Bar</span>
              <span>Density</span>
              <span>Sync</span>
              <span>Pocket</span>
              <span>Timing</span>
              <span>Stress</span>
              <span>Syllables</span>
            </div>
            {flowmap.bars.map((bar) => (
              <div key={bar.bar_no} className="bar-data-row">
                <span>Bar {bar.bar_no}</span>
                <span>{bar.density.toFixed(2)}</span>
                <span>{(bar.syncopation_score * 100).toFixed(0)}%</span>
                <span>{bar.pocket_offset.toFixed(3)}</span>
                <span>{(bar.timing_variance * 100).toFixed(1)}</span>
                <span>{(bar.stressed_ratio * 100).toFixed(0)}%</span>
                <span>{bar.syllable_count}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

function buildBarStats(bars: FlowBar[]) {
  const count = Math.max(1, bars.length);
  const avg = (selector: (bar: FlowBar) => number) => bars.reduce((sum, bar) => sum + selector(bar), 0) / count;
  const values = (selector: (bar: FlowBar) => number) => bars.map(selector);
  const pocketValues = values((bar) => bar.pocket_offset);
  const syncValues = values((bar) => bar.syncopation_score);
  const timingValues = values((bar) => bar.timing_variance);
  return {
    syncAvg: avg((bar) => bar.syncopation_score),
    syncMax: Math.max(...syncValues, 0),
    pocketAvg: avg((bar) => bar.pocket_offset),
    pocketMin: Math.min(...pocketValues, 0),
    pocketMax: Math.max(...pocketValues, 0),
    timingAvg: avg((bar) => bar.timing_variance),
    timingMax: Math.max(...timingValues, 0),
    stressAvg: avg((bar) => bar.stressed_ratio),
    stressedOnBeatAvg: avg((bar) => bar.stressed_on_beat_ratio),
  };
}
