import type { FlowSection } from '../types';
import { t } from '../i18n';

export function SectionPanel({ sections }: { sections: FlowSection[] }) {
  if (sections.length === 0) return null;
  return (
    <div className="details-panel details-panel-wide section-panel">
      <h3>{t('sections.title')}</h3>
      <div className="bar-data-table">
        <div className="bar-data-row bar-data-head">
          <span>{t('sections.section')}</span>
          <span>{t('sections.range')}</span>
          <span>{t('metrics.density')}</span>
          <span>{t('metrics.sync')}</span>
          <span>{t('sections.onset')}</span>
          <span>{t('sections.tempo')}</span>
          <span>{t('sections.confidence')}</span>
        </div>
        {sections.map((section) => (
          <div key={section.id} className="bar-data-row">
            <span>{section.label}</span>
            <span>{section.start_bar}-{section.end_bar}</span>
            <span>{section.avg_density.toFixed(2)}</span>
            <span>{(section.syncopation_score * 100).toFixed(0)}%</span>
            <span>{(section.onset_strength_avg * 100).toFixed(0)}%</span>
            <span>{section.local_bpm.toFixed(1)}</span>
            <span>{(section.tempo_confidence * 100).toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
