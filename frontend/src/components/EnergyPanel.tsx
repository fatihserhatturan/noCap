import type { FlowBar, FlowSection } from '../types';
import { t } from '../i18n';

export function EnergyPanel({ bars, sections }: { bars: FlowBar[]; sections: FlowSection[] }) {
  const energyBars = [...bars]
    .sort((left, right) => right.rms_avg - left.rms_avg)
    .slice(0, 8);
  if (sections.length === 0 && energyBars.length === 0) return null;
  return (
    <div className="details-panel details-panel-wide energy-panel">
      <h3>{t('energy.title')}</h3>
      {sections.length > 0 && (
        <div className="bar-data-table energy-section-table">
          <div className="bar-data-row energy-row bar-data-head">
            <span>{t('sections.section')}</span>
            <span>{t('energy.energy')}</span>
            <span>{t('energy.brightness')}</span>
            <span>{t('energy.width')}</span>
            <span>{t('energy.noise')}</span>
          </div>
          {sections.map((section) => (
            <div key={section.id} className="bar-data-row energy-row">
              <span>{section.label}</span>
              <span>{formatPct(section.rms_avg)}</span>
              <span>{formatHz(section.spectral_centroid_avg)}</span>
              <span>{formatHz(section.spectral_bandwidth_avg)}</span>
              <span>{formatPct(section.zero_crossing_rate_avg)}</span>
            </div>
          ))}
        </div>
      )}
      {energyBars.length > 0 && (
        <div className="energy-bars">
          {energyBars.map((bar) => (
            <div key={bar.bar_no} className="bar-compare-line energy-bar-line">
              <span>{t('details.bar')} {bar.bar_no}</span>
              <div className="bar-compare-track">
                <div style={{ width: `${Math.max(3, Math.min(100, bar.rms_avg * 100))}%` }} />
              </div>
              <b>{formatPct(bar.rms_avg)}</b>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatPct(value: number) {
  return `${(value * 100).toFixed(0)}%`;
}

function formatHz(value: number) {
  return value > 0 ? `${value.toFixed(0)} Hz` : '0';
}
