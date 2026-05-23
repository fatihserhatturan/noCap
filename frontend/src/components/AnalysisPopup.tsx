import { ProgressPanel } from './ProgressPanel';
import type { StepId, StepState } from '../types';

export function AnalysisPopup({
  filename,
  steps,
  error,
  status,
  onClose,
}: {
  filename: string;
  steps: Record<StepId, StepState>;
  error: string;
  status: 'running' | 'done' | 'error';
  onClose: () => void;
}) {
  return (
    <div className="analysis-modal-backdrop" role="presentation">
      <section className="analysis-modal" role="dialog" aria-modal="true" aria-label="Track analysis progress">
        <div className="analysis-modal-head">
          <div>
            <h2>{status === 'done' ? 'Analysis Complete' : status === 'error' ? 'Analysis Failed' : 'Analyzing Track'}</h2>
            <p>Medium model · {filename}</p>
          </div>
          {status !== 'running' && (
            <button className="ghost-btn" onClick={onClose}>Close</button>
          )}
        </div>
        <ProgressPanel filename={filename} steps={steps} error={error} />
      </section>
    </div>
  );
}
