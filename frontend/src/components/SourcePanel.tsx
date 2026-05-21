import { Mic2, Music2 } from 'lucide-react';
import type { FlowMap } from '../types';
import { FlowStatsPanel } from './MetricsPanel';

export function SourcePanel({
  source,
  onSourceChange,
  hasVocals,
  flowmap,
  hoveredBar,
}: {
  source: 'mix' | 'vocals';
  onSourceChange: (source: 'mix' | 'vocals') => void;
  hasVocals: boolean;
  flowmap: FlowMap;
  hoveredBar: number | null;
}) {
  return (
    <aside className="left-panel">
      <section>
        <h3>Audio Source</h3>
        <div className="source-list">
          <button className={`src-btn ${source === 'mix' ? 'src-active' : ''}`} onClick={() => onSourceChange('mix')}>
            <Music2 size={15} />
            <span>Original Mix</span>
          </button>
          <button
            className={`src-btn ${source === 'vocals' ? 'src-active' : ''}`}
            onClick={() => onSourceChange('vocals')}
            disabled={!hasVocals}
          >
            <Mic2 size={15} />
            <span>Vocals Only</span>
          </button>
        </div>
        {!hasVocals && <div className="muted-note">Vocals not available</div>}
      </section>
      <FlowStatsPanel flowmap={flowmap} hoveredBar={hoveredBar} />
    </aside>
  );
}
