import type { MouseEvent } from 'react';
import { ChevronDown, Download, FileCode2, FileImage } from 'lucide-react';
import { downloadFlowmapPng, downloadFlowmapSvg } from '../export/flowExport';
import { t } from '../i18n';
import type { FlowMap } from '../types';

export function ExportMenu({ flowmap }: { flowmap: FlowMap }) {
  function closeMenu(event: MouseEvent<HTMLButtonElement>) {
    event.currentTarget.closest('details')?.removeAttribute('open');
  }

  return (
    <details className="export-menu">
      <summary className="ghost-btn export-trigger">
        <Download size={15} />
        {t('export.action')}
        <ChevronDown className="export-chevron" size={14} />
      </summary>
      <div className="export-popover">
        <button
          className="export-option"
          onClick={(event) => {
            closeMenu(event);
            void downloadFlowmapPng(flowmap);
          }}
        >
          <FileImage className="export-option-icon" size={15} />
          <span>{t('export.png')}</span>
        </button>
        <button
          className="export-option"
          onClick={(event) => {
            closeMenu(event);
            downloadFlowmapSvg(flowmap);
          }}
        >
          <FileCode2 className="export-option-icon" size={15} />
          <span>{t('export.svg')}</span>
        </button>
      </div>
    </details>
  );
}
