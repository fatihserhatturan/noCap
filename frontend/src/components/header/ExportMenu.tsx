import { ChevronDown, Download, FileCode2, FileImage, FileSpreadsheet, FileText } from 'lucide-react';
import { downloadBarCsv } from '../../export/barCsv';
import { downloadFlowmapPng, downloadFlowmapSvg } from '../../export/flowExport';
import { downloadReportPng } from '../../export/reportExport';
import { downloadReportPdf } from '../../export/reportPdf';
import { usePopover } from '../../hooks/usePopover';
import { t } from '../../i18n';
import type { FlowMap } from '../../types';

export function ExportMenu({ flowmap, isReport }: { flowmap: FlowMap; isReport: boolean }) {
  const popover = usePopover();

  function run(action: () => void | Promise<void>) {
    popover.setOpen(false);
    void action();
  }

  return (
    <div className="menu" ref={popover.rootRef}>
      <button
        ref={popover.triggerRef}
        className={`btn btn-ghost btn-sm ${popover.open ? 'is-open' : ''}`}
        onClick={popover.toggle}
        aria-haspopup="menu"
        aria-expanded={popover.open}
        title={t('export.action')}
      >
        <Download size={14} /> <span className="btn-label">{t('export.action')}</span> <ChevronDown size={13} className="menu-chevron" />
      </button>
      {popover.open && (
        <div className="menu-popover menu-popover-sm" role="menu">
          {isReport && (
            <>
              <button role="menuitem" className="menu-item" onClick={() => run(() => downloadReportPng(flowmap.metadata.title))}>
                <FileImage size={15} /> <span>{t('export.reportPng')}</span>
              </button>
              <button role="menuitem" className="menu-item" onClick={() => run(() => downloadReportPdf(flowmap.metadata.title))}>
                <FileText size={15} /> <span>{t('export.reportPdf')}</span>
              </button>
              <button role="menuitem" className="menu-item" onClick={() => run(() => downloadBarCsv(flowmap))}>
                <FileSpreadsheet size={15} /> <span>{t('export.barCsv')}</span>
              </button>
            </>
          )}
          <button role="menuitem" className="menu-item" onClick={() => run(() => downloadFlowmapPng(flowmap))}>
            <FileImage size={15} /> <span>{t('export.png')}</span>
          </button>
          <button role="menuitem" className="menu-item" onClick={() => run(() => downloadFlowmapSvg(flowmap))}>
            <FileCode2 size={15} /> <span>{t('export.svg')}</span>
          </button>
        </div>
      )}
    </div>
  );
}
