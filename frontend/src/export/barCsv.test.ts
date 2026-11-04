import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BAR_METRICS } from '../flow/barStats';
import { sampleFlowmap } from '../sampleFlowmap';
import { buildBarCsv } from './barCsv';

const HEADER = 'bar_no,density,syncopation_score,pocket_offset,timing_variance,stressed_ratio,syllable_count,pocket_label\r\n';

test('uses the report columns and raw values for every demo vocal bar', () => {
  const flowmap = sampleFlowmap();
  const rows = buildBarCsv(flowmap).trimEnd().split('\r\n');
  assert.equal(rows[0] + '\r\n', HEADER);
  assert.equal(rows.length, flowmap.bars.length + 1);
  flowmap.bars.forEach((bar, index) => {
    const cells = rows[index + 1].split(',');
    assert.equal(cells[0], String(bar.bar_no));
    BAR_METRICS.forEach((key, column) => assert.equal(Number(cells[column + 1]), bar[key]));
    assert.equal(cells.at(-1), bar.pocket_label);
  });
});

test('filters instrumental bars, keeps input order and does not mutate the FlowMap', () => {
  const flowmap = sampleFlowmap();
  flowmap.bars = [
    { ...flowmap.bars[2], empty: false },
    { ...flowmap.bars[1], empty: true },
    flowmap.bars[0],
  ];
  const before = structuredClone(flowmap);
  flowmap.bars.forEach(Object.freeze);
  Object.freeze(flowmap.bars);
  Object.freeze(flowmap);
  const rows = buildBarCsv(flowmap).trimEnd().split('\r\n');
  assert.deepEqual(rows.slice(1).map((row) => Number(row.split(',')[0])), [3, 1]);
  assert.deepEqual(flowmap, before);
});

test('exports only a header for empty or instrumental-only data', () => {
  const flowmap = sampleFlowmap();
  flowmap.bars = flowmap.bars.map((bar) => ({ ...bar, empty: true }));
  assert.equal(buildBarCsv(flowmap), HEADER);
  flowmap.bars = [];
  assert.equal(buildBarCsv(flowmap), HEADER);
});

test('preserves zero, negative and fractional numbers without display formatting', () => {
  const flowmap = sampleFlowmap();
  flowmap.bars = [{
    ...flowmap.bars[0], density: 0, syncopation_score: 0.123456789,
    pocket_offset: -0.0123456789, timing_variance: 0.000001,
    stressed_ratio: 0.625, syllable_count: 0, pocket_label: '',
  }];
  assert.equal(buildBarCsv(flowmap), HEADER + '1,0,0.123456789,-0.0123456789,0.000001,0.625,0,\r\n');
});

test('quotes commas, quotes and all newline styles while preserving Unicode', () => {
  const flowmap = sampleFlowmap();
  const cases = [
    ['ahead, behind', '"ahead, behind"'],
    ['say "center"', '"say ""center"""'],
    ['line\nbreak', '"line\nbreak"'],
    ['line\rbreak', '"line\rbreak"'],
    ['line\r\nbreak', '"line\r\nbreak"'],
    ['中心 🎵', '中心 🎵'],
  ];
  for (const [label, expected] of cases) {
    flowmap.bars = [{ ...flowmap.bars[0], pocket_label: label }];
    assert.ok(buildBarCsv(flowmap).endsWith(`,${expected}\r\n`), label);
  }
});

test('neutralizes formula-like text, including whitespace prefixes, without changing metrics', () => {
  const flowmap = sampleFlowmap();
  for (const label of ['=1+1', '+1+1', '-1+1', '@SUM(A1)', '  =1+1', '\t=1', '\r=1', '\n=1', '\u0000=1']) {
    flowmap.bars = [{ ...flowmap.bars[0], pocket_offset: -0.25, pocket_label: label }];
    const csv = buildBarCsv(flowmap);
    assert.ok(csv.includes(',-0.25,'));
    const escaped = `'${label}`;
    const expected = /[\r\n]/.test(label) ? `"${escaped}"` : escaped;
    assert.ok(csv.endsWith(`,${expected}\r\n`), JSON.stringify(label));
  }
});
