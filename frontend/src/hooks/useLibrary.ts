import { useState } from 'react';
import { deleteLibraryTrack, fetchLibrary, openLibraryTrack } from '../api/analyze';
import type { FlowMap, LibraryTrack } from '../types';

export function useLibrary() {
  const [library, setLibrary] = useState<LibraryTrack[]>([]);
  const [deleteCandidate, setDeleteCandidate] = useState<LibraryTrack | null>(null);

  async function refreshLibrary() {
    setLibrary(await fetchLibrary());
  }

  async function openTrack(trackId: string): Promise<{ flowmap: FlowMap; hasAudio: boolean; hasVocals: boolean }> {
    const result = await openLibraryTrack(trackId);
    return { flowmap: result.flowmap, hasAudio: result.has_audio, hasVocals: result.has_vocals };
  }

  async function confirmDeleteTrack() {
    if (!deleteCandidate) return;
    await deleteLibraryTrack(deleteCandidate.id);
    setLibrary((current) => current.filter((item) => item.id !== deleteCandidate.id));
    setDeleteCandidate(null);
  }

  return {
    library,
    deleteCandidate,
    setDeleteCandidate,
    refreshLibrary,
    openTrack,
    confirmDeleteTrack,
  };
}
