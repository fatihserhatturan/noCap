import type { AnalyzeMessage, FlowMap } from '../types';
import { normalizeFlowMap } from '../flow/normalize';

export async function fetchFlowmap(): Promise<FlowMap | null> {
  const res = await fetch('/api/flowmap.json');
  if (!res.ok) return null;
  return normalizeFlowMap(await res.json()) as FlowMap;
}

export async function hasAudio(): Promise<boolean> {
  try {
    const res = await fetch('/api/audio', { method: 'HEAD' });
    return res.ok;
  } catch {
    return false;
  }
}

export async function analyzeTrack(
  file: File,
  model: string,
  onMessage: (message: AnalyzeMessage) => void,
): Promise<void> {
  const form = new FormData();
  form.append('audio', file);
  form.append('model', model);

  const response = await fetch('/api/analyze', { method: 'POST', body: form });
  if (!response.ok || !response.body) {
    throw new Error(`Analyze failed with HTTP ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const parts = buffer.split('\n\n');
    buffer = parts.pop() || '';
    for (const part of parts) {
      const line = part.trim();
      if (!line.startsWith('data: ')) continue;
      const message = JSON.parse(line.slice(6)) as AnalyzeMessage;
      if (message.type === 'complete') {
        onMessage({ ...message, flowmap: normalizeFlowMap(message.flowmap) });
      } else {
        onMessage(message);
      }
    }
  }
}
