import { Trash2 } from 'lucide-react';
import { t } from '../i18n';
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
      <section className="confirm-modal" role="dialog" aria-modal="true" aria-label={t('delete.confirmAria')}>
        <div className="confirm-icon">
          <Trash2 size={18} />
        </div>
        <h2>{t('delete.title')}</h2>
        <p>{t('delete.body', { title: track.title })}</p>
        <div className="confirm-actions">
          <button className="ghost-btn" onClick={onCancel}>{t('delete.cancel')}</button>
          <button className="danger-btn" onClick={onConfirm}>
            <Trash2 size={15} /> {t('delete.confirm')}
          </button>
        </div>
      </section>
    </div>
  );
}
