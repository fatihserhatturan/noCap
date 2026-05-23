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

  async function start(file: File) {
    setFilename(file.name);
    setError('');
    setSteps(initialSteps);
    setStatus('running');
    try {
      await analyzeTrack(file, 'medium', handleMessage);
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
    setStatus('idle');
  }

  function handleMessage(message: AnalyzeMessage) {
    if (message.type === 'progress') {
      setSteps((prev) => ({ ...prev, [message.step]: { status: message.done ? 'done' : 'active', msg: message.msg || '' } }));
    } else if (message.type === 'complete') {
      onComplete(message.flowmap, message.has_vocals);
      setStatus('done');
    } else {
      setError(message.msg + (message.trace ? `\n\n${message.trace}` : ''));
      setStatus('error');
    }
  }

  return { steps, filename, error, status, start, close, reset };
}
