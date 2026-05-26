import { useState } from 'react';
import { analyzeTrack } from '../api/analyze';
import type { AnalyzeMessage, FlowMap, StepId, StepState } from '../types';

const initialSteps: Record<StepId, StepState> = {
  load: { status: 'idle', msg: '' },
  beat: { status: 'idle', msg: '' },
  transcribe: { status: 'idle', msg: '' },
  align: { status: 'idle', msg: '' },
};

export function useAnalysis(onComplete: (flowmap: FlowMap, hasVocals: boolean) => void) {
  const [steps, setSteps] = useState(initialSteps);
  const [filename, setFilename] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [transcribePct, setTranscribePct] = useState<number | null>(null);

  async function start(file: File) {
    setFilename(file.name);
    setError('');
    setSteps(initialSteps);
    setTranscribePct(null);
    setStatus('running');
    try {
      await analyzeTrack(file, handleMessage);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus('error');
    }
  }

  function close() {
    setError('');
    setStatus('idle');
  }

  function reset() {
    setSteps(initialSteps);
    setFilename('');
    setError('');
    setTranscribePct(null);
    setStatus('idle');
  }

  function handleMessage(message: AnalyzeMessage) {
    if (message.type === 'progress') {
      // pct-only events (whisper progress): update bar but keep last meaningful msg
      if (message.pct !== undefined) {
        setTranscribePct(message.pct);
        setSteps((prev) => ({ ...prev, [message.step]: { ...prev[message.step], status: 'active' } }));
        return;
      }
      setSteps((prev) => ({
        ...prev,
        [message.step]: {
          status: message.done ? 'done' : 'active',
          msg: message.msg || prev[message.step].msg,
        },
      }));
      if (message.step === 'transcribe' && message.done) setTranscribePct(100);
    } else if (message.type === 'complete') {
      onComplete(message.flowmap, message.has_vocals);
      setStatus('done');
    } else {
      setError(message.msg + (message.trace ? `\n\n${message.trace}` : ''));
      setStatus('error');
    }
  }

  return { steps, filename, error, status, transcribePct, start, close, reset };
}
