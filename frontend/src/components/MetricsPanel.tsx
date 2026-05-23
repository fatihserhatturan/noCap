import { useMemo, useState } from 'react';
import type { FlowMap } from '../types';
import { buildColorMap, colorToCss } from '../flow/colors';
import { t } from '../i18n';

type CompareMetric = 'density' | 'syncopation_score' | 'stressed_ratio' | 'syllable_count' | 'pocket_offset' | 'timing_variance';

const compareOptions: Array<{ key: CompareMetric; label: string }> = [
  { key: 'density', label: t('metrics.density') },
  { key: 'syncopation_score', label: t('metrics.sync') },
  { key: 'stressed_ratio', label: t('metrics.stress') },
  { key: 'syllable_count', label: t('metrics.count') },
  { key: 'pocket_offset', label: t('metrics.pocket') },
  { key: 'timing_variance', label: t('metrics.timing') },
];

export function FlowStatsPanel({
  flowmap,
  hoveredBar,
}: {
  flowmap: FlowMap;
  hoveredBar: number | null;
}) {
  const [compareMetric, setCompareMetric] = useState<CompareMetric>('density');
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
    { label: t('metrics.avgDensity'), value: `${flowmap.summary.avg_density} syl/beat`, pct: flowmap.summary.avg_density / 8 },
    { label: t('metrics.peakDensity'), value: `${flowmap.summary.peak_density} syl/beat`, pct: flowmap.summary.peak_density / 8 },
    { label: t('metrics.syncopation'), value: `${(flowmap.summary.syncopation_score * 100).toFixed(0)}%`, pct: flowmap.summary.syncopation_score },
    { label: t('metrics.consistency'), value: `${(flowmap.summary.consistency * 100).toFixed(0)}%`, pct: flowmap.summary.consistency },
    { label: t('metrics.rhymeChain'), value: `${flowmap.summary.rhyme_chain_avg.toFixed(1)} avg`, pct: flowmap.summary.rhyme_chain_avg / 6 },
    { label: t('metrics.pocket'), value: `${(flowmap.summary.pocket_score * 100).toFixed(0)}%`, pct: flowmap.summary.pocket_score },
    { label: t('metrics.timingQuality'), value: `${(flowmap.summary.timing_quality_avg * 100).toFixed(0)}%`, pct: flowmap.summary.timing_quality_avg },
    { label: t('metrics.delivery'), value: `${(flowmap.summary.delivery_consistency * 100).toFixed(0)}%`, pct: flowmap.summary.delivery_consistency },
  ];

  return (
    <>
      <section>
        <h3>{t('metrics.flow')}</h3>
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
        <h3>{t('metrics.barCompare')}</h3>
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
              <span className="compare-label">{t('details.bar')} {item.bar_no}</span>
              <div className="compare-track">
                <div style={{ width: `${Math.max(4, pct * 100)}%` }} />
              </div>
              <b>{formatCompareValue(item[compareMetric], compareMetric)}</b>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

export function MetricsPanel({
  flowmap,
  activeRhyme,
  onActiveRhymeChange,
}: {
  flowmap: FlowMap;
  activeRhyme: string | null;
  onActiveRhymeChange: (group: string | null) => void;
}) {
  const colors = buildColorMap(flowmap.rhyme_chains.map((chain) => chain.group));

  return (
    <aside className="sidebar">
      <section>
        <h3>{t('metrics.rhymes')}</h3>
        <div className="rhyme-list">
          {flowmap.rhyme_chains.length === 0 && flowmap.rhyme_groups.length === 0 && <span className="empty">{t('metrics.noRhymes')}</span>}
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
                    <small>{chain.meta}</small>
                  </span>
                  <span className="rh-words" style={{ color }}>{words}</span>
                </span>
              </button>
            );
          })}
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
