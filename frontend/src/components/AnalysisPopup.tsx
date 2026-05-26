import { ProgressPanel } from './ProgressPanel';
import { t } from '../i18n';
import type { StepId, StepState } from '../types';

export function AnalysisPopup({
  filename,
  steps,
  error,
  status,
  transcribePct,
  onClose,
}: {
  filename: string;
  steps: Record<StepId, StepState>;
  error: string;
  status: 'running' | 'done' | 'error';
  transcribePct: number | null;
  onClose: () => void;
}) {
  return (
    <div className="analysis-modal-backdrop" role="presentation">
      <section className="analysis-modal" role="dialog" aria-modal="true" aria-label={t('analysis.progressAria')}>
        <div className="analysis-modal-head">
          <div>
            <h2>{status === 'done' ? t('analysis.complete') : status === 'error' ? t('analysis.failed') : t('analysis.running')}</h2>
            {filename && <p className="analysis-filename">{filename}</p>}
          </div>
          {status !== 'running' && (
            <button className="ghost-btn" onClick={onClose}>{t('analysis.close')}</button>
          )}
        </div>
        <ProgressPanel filename={filename} steps={steps} error={error} transcribePct={transcribePct} />
      </section>
    </div>
  );
}
