import type { FlowMap } from '../types';
import { buildColorMap, colorToCss } from '../flow/colors';
import { FLOW_DIMS, computeLayout, syllableRect } from '../flow/layout';

export function downloadFlowmapSvg(flowmap: FlowMap): void {
  const svg = buildFlowmapSvg(flowmap);
  downloadBlob(
    new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }),
    `${safeName(flowmap.metadata.title || 'nocap-flowmap')}.svg`,
  );
}

export async function downloadFlowmapPng(flowmap: FlowMap): Promise<void> {
  const svg = buildFlowmapSvg(flowmap);
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const image = await loadImage(url);
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas export is not available in this browser.');
    ctx.drawImage(image, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('PNG export failed.');
    downloadBlob(blob, `${safeName(flowmap.metadata.title || 'nocap-flowmap')}.png`);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function buildFlowmapSvg(flowmap: FlowMap): string {
  const layout = computeLayout(flowmap, 1200);
  const colorMap = buildColorMap(flowmap.rhyme_chains.map((chain) => chain.group));
  const signature = layout.signature;
  const gridW = signature * layout.beatW;
  const maxDensity = Math.max(...flowmap.bars.map((bar) => bar.density), 0.01);
  const title = flowmap.metadata.title || 'noCap Flow Map';
  const meta = `${flowmap.metadata.bpm.toFixed(1)} BPM · ${flowmap.bars.length} bars · ${flowmap.syllables.length} syllables`;

  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${layout.width}" height="${layout.height + 54}" viewBox="0 0 ${layout.width} ${layout.height + 54}">`,
    '<rect width="100%" height="100%" fill="#0a0a0a"/>',
    `<text x="18" y="24" fill="#eeeeee" font-family="monospace" font-size="15" font-weight="700">${esc(title)}</text>`,
    `<text x="18" y="42" fill="#666666" font-family="monospace" font-size="10">${esc(meta)}</text>`,
    `<g transform="translate(0 54)">`,
    `<rect x="0" y="0" width="${layout.width}" height="${FLOW_DIMS.headerH}" fill="#0f0f0f"/>`,
  ];

  for (let beat = 0; beat < signature; beat += 1) {
    const x = FLOW_DIMS.labelW + beat * layout.beatW;
    parts.push(line(x, 0, x, FLOW_DIMS.headerH, '#1f1f1f'));
    for (let sub = 1; sub < FLOW_DIMS.subdivs; sub += 1) {
      const sx = x + (sub / FLOW_DIMS.subdivs) * layout.beatW;
      parts.push(line(sx, FLOW_DIMS.headerH - 10, sx, FLOW_DIMS.headerH, '#181818'));
    }
    parts.push(`<text x="${x + layout.beatW / 2}" y="21" fill="#777777" text-anchor="middle" font-family="monospace" font-size="11">${beat + 1}</text>`);
  }

  flowmap.bars.forEach((bar, index) => {
    const rowY = FLOW_DIMS.headerH + index * FLOW_DIMS.barH;
    parts.push(`<rect x="${FLOW_DIMS.labelW}" y="${rowY}" width="${gridW}" height="${FLOW_DIMS.barH}" fill="${index % 2 === 0 ? '#0e0e0e' : '#111111'}"/>`);
    parts.push(line(0, rowY + FLOW_DIMS.barH, FLOW_DIMS.labelW + gridW + FLOW_DIMS.densW, rowY + FLOW_DIMS.barH, '#171717'));
    parts.push(`<text x="${FLOW_DIMS.labelW - 8}" y="${rowY + FLOW_DIMS.barH / 2 + 4}" fill="#555555" text-anchor="end" font-family="monospace" font-size="10">Bar ${bar.bar_no}</text>`);

    for (let beat = 0; beat < signature; beat += 1) {
      const x = FLOW_DIMS.labelW + beat * layout.beatW;
      parts.push(line(x, rowY, x, rowY + FLOW_DIMS.barH, '#191919'));
      for (let sub = 1; sub < FLOW_DIMS.subdivs; sub += 1) {
        const sx = x + (sub / FLOW_DIMS.subdivs) * layout.beatW;
        parts.push(line(sx, rowY + FLOW_DIMS.barH * 0.35, sx, rowY + FLOW_DIMS.barH, '#151515'));
      }
    }

    const densityX = FLOW_DIMS.labelW + gridW + 4;
    const densityW = FLOW_DIMS.densW - 8;
    const fillH = (FLOW_DIMS.barH - 12) * (bar.density / maxDensity);
    parts.push(`<rect x="${densityX}" y="${rowY + 6}" width="${densityW}" height="${FLOW_DIMS.barH - 12}" fill="#161616"/>`);
    parts.push(`<rect x="${densityX}" y="${rowY + 6 + (FLOW_DIMS.barH - 12) - fillH}" width="${densityW}" height="${fillH}" fill="#ff3d00" opacity="0.65"/>`);
  });

  for (const syllable of flowmap.syllables) {
    const rowIndex = flowmap.bars.findIndex((bar) => bar.bar_no === syllable.bar_no);
    if (rowIndex < 0) continue;
    const rect = syllableRect(syllable, rowIndex, layout.beatW);
    const color = syllable.rhyme_group ? colorToCss(colorMap.get(syllable.rhyme_group) || 0x444444) : '#2e2e2e';
    parts.push(`<rect x="${rect.x}" y="${rect.y}" width="${rect.width}" height="${rect.height}" rx="2" fill="${color}" opacity="${syllable.stress ? '1' : '0.42'}"/>`);
  }

  parts.push('</g></svg>');
  return parts.join('');
}

function line(x1: number, y1: number, x2: number, y2: number, color: string): string {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="1"/>`;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Could not render export image.'));
    image.src = src;
  });
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function safeName(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'nocap-flowmap';
}

function esc(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      default: return '&apos;';
    }
  });
}
