import { useMemo, useState } from 'react';
import type { FlowMap } from '../types';
import { buildColorMap, colorToCss } from '../flow/colors';

type CompareMetric = 'density' | 'syncopation_score' | 'stressed_ratio' | 'syllable_count' | 'pocket_offset' | 'timing_variance';

const compareOptions: Array<{ key: CompareMetric; label: string }> = [
  { key: 'density', label: 'Density' },
  { key: 'syncopation_score', label: 'Sync' },
  { key: 'stressed_ratio', label: 'Stress' },
  { key: 'syllable_count', label: 'Count' },
  { key: 'pocket_offset', label: 'Pocket' },
  { key: 'timing_variance', label: 'Timing' },
];

export function MetricsPanel({
  flowmap,
  activeRhyme,
  onActiveRhymeChange,
  hoveredBar,
}: {
  flowmap: FlowMap;
  activeRhyme: string | null;
  onActiveRhymeChange: (group: string | null) => void;
  hoveredBar: number | null;
}) {
  const colors = buildColorMap(flowmap.rhyme_chains.map((chain) => chain.group));
  const [compareMetric, setCompareMetric] = useState<CompareMetric>('density');
  const bar = hoveredBar ? flowmap.bars.find((item) => item.bar_no === hoveredBar) : null;
  const comparedBars = useMemo(() => {
    const max = Math.max(...flowmap.bars.map((item) => item[compareMetric]), 0.01);
    return [...flowmap.bars]
      .sort((left, right) => right[compareMetric] - left[compareMetric])
      .slice(0, 10)
      .map((item) => ({
        bar: item,
        pct: Math.min(1, item[compareMetric] / max),
      }));
  }, [flowmap, compareMetric]);
  const metrics = [
    { label: 'Avg Density', value: `${flowmap.summary.avg_density} syl/beat`, pct: flowmap.summary.avg_density / 8 },
    { label: 'Peak Density', value: `${flowmap.summary.peak_density} syl/beat`, pct: flowmap.summary.peak_density / 8 },
    { label: 'Syncopation', value: `${(flowmap.summary.syncopation_score * 100).toFixed(0)}%`, pct: flowmap.summary.syncopation_score },
    { label: 'Consistency', value: `${(flowmap.summary.consistency * 100).toFixed(0)}%`, pct: flowmap.summary.consistency },
    { label: 'Rhyme Chain', value: `${flowmap.summary.rhyme_chain_avg.toFixed(1)} avg`, pct: flowmap.summary.rhyme_chain_avg / 6 },
    { label: 'Pocket', value: `${(flowmap.summary.pocket_score * 100).toFixed(0)}%`, pct: flowmap.summary.pocket_score },
    { label: 'Timing Quality', value: `${(flowmap.summary.timing_quality_avg * 100).toFixed(0)}%`, pct: flowmap.summary.timing_quality_avg },
    { label: 'Delivery', value: `${(flowmap.summary.delivery_consistency * 100).toFixed(0)}%`, pct: flowmap.summary.delivery_consistency },
  ];

  return (
    <aside className="sidebar">
      <section>
        <h3>Flow Metrics</h3>
        <div className="metrics-list">
          {metrics.map((metric) => (
            <div key={metric.label}>
              <div className="m-row">
                <span>{metric.label}</span>
                <b>{metric.value}</b>
              </div>
              <div className="m-bar">
                <div style={{ width: `${Math.min(100, metric.pct * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      </section>
      <section>
        <h3>Bar Compare</h3>
        <div className="segmented">
          {compareOptions.map((option) => (
            <button
              key={option.key}
              className={compareMetric === option.key ? 'seg-active' : ''}
              onClick={() => setCompareMetric(option.key)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="compare-list">
          {comparedBars.map(({ bar: item, pct }) => (
            <div key={item.bar_no} className={`compare-row ${hoveredBar === item.bar_no ? 'compare-active' : ''}`}>
              <span className="compare-label">Bar {item.bar_no}</span>
              <div className="compare-track">
                <div style={{ width: `${Math.max(4, pct * 100)}%` }} />
              </div>
              <b>{formatCompareValue(item[compareMetric], compareMetric)}</b>
            </div>
          ))}
        </div>
      </section>
      <section>
        <h3>Rhyme Groups</h3>
        <div className="rhyme-list">
          {flowmap.rhyme_chains.length === 0 && flowmap.rhyme_groups.length === 0 && <span className="empty">No rhymes detected</span>}
          {(flowmap.rhyme_groups.length ? flowmap.rhyme_groups.map((group) => ({
            group: group.id,
            count: group.occurrences.length,
            words: group.occurrences.map((item) => item.word),
            meta: `${group.placement || 'end'} · ${group.type} · ${(group.strength * 100).toFixed(0)}%`,
          })) : flowmap.rhyme_chains.map((chain) => ({
            group: chain.group,
            count: chain.count,
            words: chain.occurrences.map((item) => item.word),
            meta: `${chain.count}x`,
          }))).map((chain) => {
            const color = colorToCss(colors.get(chain.group) || 0x333333);
            const words = [...new Set(chain.words.map((word) => word.toLowerCase()))].slice(0, 6).join(' · ');
            return (
              <button
                key={chain.group}
                className={`rh-item ${activeRhyme === chain.group ? 'rh-active' : ''}`}
                onClick={() => onActiveRhymeChange(activeRhyme === chain.group ? null : chain.group)}
              >
                <span className="rh-swatch" style={{ backgroundColor: color }} />
                <span className="rh-body">
                  <span className="rh-top">
                    <b>{chain.group}</b>
                    <small>{chain.meta}</small>
                  </span>
                  <span className="rh-words" style={{ color }}>{words}</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>
      <section>
        <h3>Bar Detail</h3>
        <div className="bar-detail">
          {bar ? (
            <>
              Bar {bar.bar_no}<br />
              Density: {bar.density} syl/beat<br />
              Syncopation: {(bar.syncopation_score * 100).toFixed(0)}%<br />
              Timing: {(bar.timing_variance * 100).toFixed(1)}<br />
              Pocket: {bar.pocket_offset.toFixed(3)}<br />
              Stressed: {(bar.stressed_ratio * 100).toFixed(0)}%<br />
              Syllables: {bar.syllable_count}
            </>
          ) : 'Hover over a bar'}
        </div>
      </section>
    </aside>
  );
}

function formatCompareValue(value: number, metric: CompareMetric): string {
  if (metric === 'syncopation_score' || metric === 'stressed_ratio') {
    return `${(value * 100).toFixed(0)}%`;
  }
  if (metric === 'pocket_offset') return value.toFixed(3);
  if (metric === 'timing_variance') return (value * 100).toFixed(1);
  return value.toFixed(metric === 'syllable_count' ? 0 : 1);
}
