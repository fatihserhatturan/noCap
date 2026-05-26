import type { AnalyzeMessage, FlowMap, LibraryTrack } from '../types';
import { normalizeFlowMap } from '../flow/normalize';
import { t } from '../i18n';

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

export async function fetchLibrary(): Promise<LibraryTrack[]> {
  const res = await fetch('/api/library');
  if (!res.ok) return [];
  const data = await res.json() as { tracks?: LibraryTrack[] };
  return data.tracks || [];
}

export async function openLibraryTrack(trackId: string): Promise<{
  flowmap: FlowMap;
  track: LibraryTrack;
  has_audio: boolean;
  has_vocals: boolean;
}> {
  const res = await fetch(`/api/library/${encodeURIComponent(trackId)}/open`);
  if (!res.ok) throw new Error(t('api.openTrackFailed', { status: res.status }));
  const data = await res.json() as {
    flowmap: FlowMap;
    track: LibraryTrack;
    has_audio: boolean;
    has_vocals: boolean;
  };
  return {
    ...data,
    flowmap: normalizeFlowMap(data.flowmap),
  };
}

export async function deleteLibraryTrack(trackId: string): Promise<void> {
  const res = await fetch(`/api/library/${encodeURIComponent(trackId)}/delete`, { method: 'POST' });
  if (!res.ok) throw new Error(t('api.deleteTrackFailed', { status: res.status }));
}

export async function analyzeTrack(
  file: File,
  onMessage: (message: AnalyzeMessage) => void,
): Promise<void> {
  const form = new FormData();
  form.append('audio', file);

  const response = await fetch('/api/analyze', { method: 'POST', body: form });
  if (!response.ok || !response.body) {
    throw new Error(t('api.analyzeFailed', { status: response.status }));
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
