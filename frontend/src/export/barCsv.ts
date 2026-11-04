import { BAR_METRICS } from '../flow/barStats';
import { vocalBars } from '../flow/emptyBars';
import type { FlowMap } from '../types';
import { downloadBlob, safeName } from './flowExport';

/** The report table's columns, in display order, with unformatted numeric values. */
export function buildBarCsv(flowmap: FlowMap): string {
  const rows: (string | number)[][] = [
    ['bar_no', ...BAR_METRICS, 'pocket_label'],
    ...vocalBars(flowmap).map((bar) => [
      bar.bar_no, ...BAR_METRICS.map((key) => bar[key]), bar.pocket_label,
    ]),
  ];
  return rows.map((row) => row.map(csvField).join(',')).join('\r\n') + '\r\n';
}

export function downloadBarCsv(flowmap: FlowMap): void {
  // A UTF-8 BOM lets spreadsheet apps detect non-ASCII pocket labels reliably.
  const blob = new Blob(['\uFEFF', buildBarCsv(flowmap)], { type: 'text/csv;charset=utf-8' });
  downloadBlob(blob, `${safeName(flowmap.metadata.title)}.bars.csv`);
}

function csvField(value: string | number): string {
  if (typeof value === 'number') return String(value);
  // Neutralize spreadsheet formulas in text only; negative metrics stay numeric.
  const text = /^(?:[\t\r\n]|[\s\u0000-\u001f]*[=+\-@])/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
