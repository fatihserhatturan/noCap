import type { StepId, StepState } from '../types';

const steps: Array<{ id: StepId; label: string; pct: number }> = [
  { id: 'load', label: 'Loading audio', pct: 15 },
  { id: 'beat', label: 'Detecting beats', pct: 35 },
  { id: 'transcribe', label: 'Transcribing with Whisper', pct: 80 },
  { id: 'align', label: 'Building flow map', pct: 100 },
];

export function ProgressPanel({
  filename,
  steps: state,
  error,
}: {
  filename: string;
  steps: Record<StepId, StepState>;
  error: string;
}) {
  const donePct = steps.reduce((pct, step) => (state[step.id].status === 'done' ? step.pct : pct), 0);

  return (
    <section className="progress-panel">
      <div className="progress-filename">{filename}</div>
      <div className="steps">
        {steps.map((step) => (
          <div key={step.id} className={`step ${state[step.id].status}`}>
            <div className="step-dot" />
            <div className="step-body">
              <span className="step-label">{step.label}</span>
              <span className="step-msg">{state[step.id].msg}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="progress-bar-wrap">
        <div className="progress-bar-fill" style={{ width: `${donePct}%` }} />
      </div>
      {error && <pre className="error-panel">{error}</pre>}
    </section>
  );
}
