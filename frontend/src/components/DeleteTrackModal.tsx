import { Trash2 } from 'lucide-react';
import type { LibraryTrack } from '../types';

export function DeleteTrackModal({
  track,
  onCancel,
  onConfirm,
}: {
  track: LibraryTrack;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="analysis-modal-backdrop" role="presentation">
      <section className="confirm-modal" role="dialog" aria-modal="true" aria-label="Delete track confirmation">
        <div className="confirm-icon">
          <Trash2 size={18} />
        </div>
        <h2>Delete Track</h2>
        <p>Remove <b>{track.title}</b> and all saved analysis data from the library.</p>
        <div className="confirm-actions">
          <button className="ghost-btn" onClick={onCancel}>Cancel</button>
          <button className="danger-btn" onClick={onConfirm}>
            <Trash2 size={15} /> Delete
          </button>
        </div>
      </section>
    </div>
  );
}
