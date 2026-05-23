import { useRef } from 'react';
import { Plus, Trash2, Upload } from 'lucide-react';
import type { LibraryTrack } from '../types';

export function LibraryPanel({
  tracks,
  onOpenTrack,
  onDeleteTrack,
  onNewTrack,
}: {
  tracks: LibraryTrack[];
  onOpenTrack: (trackId: string) => void;
  onDeleteTrack: (track: LibraryTrack) => void;
  onNewTrack: (file: File) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function pick(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) return;
    onNewTrack(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  return (
    <section className="library-panel">
      <div className="library-head">
        <div>
          <h1>Library</h1>
          <p>{tracks.length ? `${tracks.length} analyzed tracks` : 'No analyzed tracks yet'}</p>
        </div>
        <button className="add-track-btn" onClick={() => fileInputRef.current?.click()}>
          <Plus size={16} /> Add Track
        </button>
        <input ref={fileInputRef} type="file" accept=".mp3,.wav,.aiff,.aif,.m4a,.ogg,.flac" hidden onChange={(event) => pick(event.currentTarget.files)} />
      </div>
      <div className="library-grid">
        {tracks.map((track) => (
          <TrackCard key={track.id} track={track} onOpenTrack={onOpenTrack} onDeleteTrack={onDeleteTrack} />
        ))}
        {tracks.length === 0 && (
          <div className="empty-library">
            <Upload size={34} />
            <span>Add a track to start building your analysis library.</span>
          </div>
        )}
      </div>
    </section>
  );
}

function TrackCard({ track, onOpenTrack, onDeleteTrack }: {
  track: LibraryTrack;
  onOpenTrack: (trackId: string) => void;
  onDeleteTrack: (track: LibraryTrack) => void;
}) {
  return (
    <article className="track-card">
      <button className="track-card-open" onClick={() => onOpenTrack(track.id)}>
        <span className="track-card-title">{track.title}</span>
        <span className="track-card-meta">{track.bpm.toFixed(1)} BPM · {track.bars} bars · {track.syllables} syllables</span>
        <span className="track-card-row"><span>Density</span><b>{track.summary.avg_density?.toFixed?.(2) ?? '0.00'}</b></span>
        <span className="track-card-row"><span>Sync</span><b>{((track.summary.syncopation_score || 0) * 100).toFixed(0)}%</b></span>
        <span className="track-card-date">{formatDate(track.created_at)}</span>
      </button>
      <button className="track-delete-btn" aria-label={`Delete ${track.title}`} onClick={() => onDeleteTrack(track)}>
        <Trash2 size={15} />
      </button>
    </article>
  );
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}
