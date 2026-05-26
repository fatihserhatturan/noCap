import type { StepId, StepState } from '../types';
import { t } from '../i18n';

const STEPS: Array<{ id: StepId; label: string; pct: number }> = [
  { id: 'load',       label: t('progress.load'),       pct: 15  },
  { id: 'beat',       label: t('progress.beat'),       pct: 35  },
  { id: 'transcribe', label: t('progress.transcribe'), pct: 85  },
  { id: 'align',      label: t('progress.align'),      pct: 100 },
];

// Overall bar weights: load+beat+align together = 35 %, transcribe = 65 %
const TRANSCRIBE_START = 35;
const TRANSCRIBE_RANGE = 50; // 35 → 85

export function ProgressPanel({
  filename,
  steps: state,
  error,
  transcribePct,
}: {
  filename: string;
  steps: Record<StepId, StepState>;
  error: string;
  transcribePct: number | null;
}) {
  // Base progress from completed steps
  const donePct = STEPS.reduce((pct, step) => (state[step.id].status === 'done' ? step.pct : pct), 0);

  // While transcribe is active, interpolate within its range using the real whisper %
  let totalPct = donePct;
  if (state.transcribe.status === 'active' && transcribePct !== null) {
    totalPct = TRANSCRIBE_START + (transcribePct / 100) * TRANSCRIBE_RANGE;
  }

  return (
    <section className="progress-panel">
      <div className="steps">
        {STEPS.map((step) => {
          const isTranscribeActive = step.id === 'transcribe' && state[step.id].status === 'active';
          return (
            <div key={step.id} className={`step ${state[step.id].status}`}>
              <div className="step-dot" />
              <div className="step-body">
                <span className="step-label">{step.label}</span>
                {isTranscribeActive && transcribePct !== null ? (
                  <div className="transcribe-sub-bar-wrap">
                    <div className="transcribe-sub-bar-fill" style={{ width: `${transcribePct}%` }} />
                    <span className="transcribe-sub-pct">{transcribePct}%</span>
                  </div>
                ) : (
                  <span className="step-msg">{state[step.id].msg}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="progress-bar-wrap">
        <div className="progress-bar-fill" style={{ width: `${totalPct}%` }} />
      </div>
      {error && <pre className="error-panel">{error}</pre>}
    </section>
  );
}
