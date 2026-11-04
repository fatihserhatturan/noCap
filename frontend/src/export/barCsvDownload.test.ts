import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sampleFlowmap } from '../sampleFlowmap';
import { buildBarCsv, downloadBarCsv } from './barCsv';
import { downloadFlowmapSvg } from './flowExport';

test('downloads UTF-8 CSV with a safe filename and leaves SVG downloads working', async (context) => {
  const blobs: Blob[] = [];
  const downloads: string[] = [];
  const revoked: string[] = [];
  let appended = 0;
  let removed = 0;
  const documentDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      body: { appendChild: () => { appended += 1; } },
      createElement: (tag: string) => {
        assert.equal(tag, 'a');
        return {
          href: '', download: '',
          click() { downloads.push(this.download); },
          remove() { removed += 1; },
        };
      },
    },
  });
  context.after(() => {
    if (documentDescriptor) Object.defineProperty(globalThis, 'document', documentDescriptor);
    else Reflect.deleteProperty(globalThis, 'document');
  });
  context.mock.method(URL, 'createObjectURL', (blob: Blob) => {
    blobs.push(blob);
    return `blob:test-${blobs.length}`;
  });
  context.mock.method(URL, 'revokeObjectURL', (url: string) => { revoked.push(url); });

  const flowmap = sampleFlowmap();
  flowmap.metadata.title = ' ../../My "Verse": 01? ';
  flowmap.bars[0].pocket_label = '中心 🎵';
  downloadBarCsv(flowmap);
  assert.equal(downloads[0], 'my-verse-01.bars.csv');
  assert.equal(blobs[0].type, 'text/csv;charset=utf-8');
  const bytes = new Uint8Array(await blobs[0].arrayBuffer());
  assert.deepEqual([...bytes.slice(0, 3)], [0xef, 0xbb, 0xbf]);
  assert.equal(new TextDecoder().decode(bytes.slice(3)), buildBarCsv(flowmap));

  for (const title of ['', '   ', '中心/🎵']) {
    flowmap.metadata.title = title;
    downloadBarCsv(flowmap);
    assert.equal(downloads.at(-1), 'nocap-flowmap.bars.csv');
  }
  flowmap.metadata.title = 'Demo';
  downloadFlowmapSvg(flowmap);
  assert.equal(downloads.at(-1), 'demo.svg');
  assert.equal(blobs.at(-1)?.type, 'image/svg+xml;charset=utf-8');
  assert.match(await blobs[blobs.length - 1].text(), /<svg.*<\/svg>/s);
  assert.equal(appended, downloads.length);
  assert.equal(removed, downloads.length);
  assert.deepEqual(revoked, blobs.map((_, index) => `blob:test-${index + 1}`));
});
