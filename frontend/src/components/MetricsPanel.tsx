import type { FlowMap } from '../types';
import { buildColorMap, colorToCss } from '../flow/colors';

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
  const bar = hoveredBar ? flowmap.bars.find((item) => item.bar_no === hoveredBar) : null;
  const metrics = [
    { label: 'Avg Density', value: `${flowmap.summary.avg_density} syl/beat`, pct: flowmap.summary.avg_density / 8 },
    { label: 'Peak Density', value: `${flowmap.summary.peak_density} syl/beat`, pct: flowmap.summary.peak_density / 8 },
    { label: 'Syncopation', value: `${(flowmap.summary.syncopation_score * 100).toFixed(0)}%`, pct: flowmap.summary.syncopation_score },
    { label: 'Consistency', value: `${(flowmap.summary.consistency * 100).toFixed(0)}%`, pct: flowmap.summary.consistency },
    { label: 'Rhyme Chain', value: `${flowmap.summary.rhyme_chain_avg.toFixed(1)} avg`, pct: flowmap.summary.rhyme_chain_avg / 6 },
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
        <h3>Rhyme Groups</h3>
        <div className="rhyme-list">
          {flowmap.rhyme_chains.length === 0 && <span className="empty">No rhymes detected</span>}
          {flowmap.rhyme_chains.map((chain) => {
            const color = colorToCss(colors.get(chain.group) || 0x333333);
            const words = [...new Set(chain.occurrences.map((item) => item.word.toLowerCase()))].slice(0, 6).join(' · ');
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
                    <small>{chain.count}x</small>
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
              Syncopation: {(bar.syncopation * 100).toFixed(0)}%<br />
              Stressed: {(bar.stressed_ratio * 100).toFixed(0)}%<br />
              Syllables: {bar.syllable_count}
            </>
          ) : 'Hover over a bar'}
        </div>
      </section>
    </aside>
  );
}
