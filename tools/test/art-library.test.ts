import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, describe, expect, test } from 'vitest';

import { type Draft, DraftIndex, type Gh, INDEX_PATH, foldIndex, parseIndex, sha256Hex } from '../src/art/drafts.js';
import { buildLibrary, ensureThumbs, thumbPath } from '../src/art/library-cli.js';
import { type Row, dateOf, dateReport, dayInFileName, renderLibrary, sortRows, toolOf } from '../src/art/library.js';

const scratch = mkdtempSync(join(tmpdir(), 'art-library-test-'));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

function draft(seed: string, over: Partial<Draft> = {}): Draft {
  const sha = sha256Hex(Buffer.from(seed));
  return {
    id: sha.slice(0, 16), pool: null, name: seed, spec: null, round: null, route: 'codex', recipe: 'codex', model: null, model_version: null, seed: null,
    denoise: null, canvas: null, asked: null, ramps: null, prompt: 'a prompt', negative: null, warnings: [], errors: [], run: null,
    files: { raw: { sha256: sha, bytes: 10 }, full: null, imported: null },
    stored: { repo: 'x/y', tag: 'run-20261030-abcdef', assets: { raw: `${sha.slice(0, 16)}.png` } },
    review: 'unreviewed', at: null, sources: [], ...over,
  };
}

function indexOf(lines: object[]): DraftIndex {
  const path = join(scratch, `idx-${Math.random().toString(16).slice(2)}.jsonl`);
  writeFileSync(path, lines.map((l) => JSON.stringify(l)).join('\n') + '\n');
  return DraftIndex.open(path);
}

function rowsOf(html: string): Row[] {
  const m = /<script type="application\/json" id="data">(.*?)<\/script>/s.exec(html);
  return JSON.parse(m?.[1] ?? '[]') as Row[];
}

describe('the library page', () => {
  test('an amendment overrides the first line, and every draft is on the page', () => {
    const a = draft('a');
    const b = draft('b', { route: 'pixellab', recipe: 'pixellab /vfx {}' });
    const index = indexOf([a, b, { id: a.id, amend: true, review: 'keep', review_by: 'owner', review_note: 'the good one' }]);
    const out = join(scratch, 'out1');
    const result = buildLibrary(index, out, { fetch: false, builtAt: '2026-11-02T10:00:00.000Z' });
    const rows = rowsOf(readFileSync(join(out, 'index.html'), 'utf8'));
    expect(result.total).toBe(index.drafts.size);
    expect(rows).toHaveLength(index.drafts.size);
    const first = rows.find((r) => r.id === a.id);
    expect(first?.r).toBe('keep');
    expect(first?.note).toBe('the good one');
    expect(first?.by).toBe('owner');
    expect(rows.find((r) => r.id === b.id)?.t).toBe('pixellab');
  });

  test('the page holds as many drafts as the real index', () => {
    const index = DraftIndex.open(INDEX_PATH);
    const out = join(scratch, 'real');
    const result = buildLibrary(index, out, { fetch: false });
    const html = readFileSync(join(out, 'index.html'), 'utf8');
    expect(result.total).toBe(index.drafts.size);
    expect(rowsOf(html)).toHaveLength(index.drafts.size);
    expect(/data-total="(\d+)"/.exec(html)?.[1]).toBe(String(index.drafts.size));
  });

  test('a prompt cannot close the script element', () => {
    const html = renderLibrary([{ ...rowsOfOne(draft('x', { prompt: '</script><b>' })) }], { builtAt: '2026-11-02T10:00:00.000Z' });
    expect(html).not.toContain('</script><b>');
    expect(rowsOf(html)[0]?.p).toBe('</script><b>');
  });
});

function rowsOfOne(d: Draft): Row {
  const out = join(scratch, `one-${d.id}`);
  const html = buildLibrary(foldedIndex(d), out, { fetch: false }).html;
  return rowsOf(html)[0] as Row;
}

function foldedIndex(d: Draft): DraftIndex {
  return indexOf([d]);
}

describe('the date of a draft', () => {
  test('the order is at, a source at, a timestamp in a source file, the store tag; the rest is undated', () => {
    const src = (over: object) => ({ label: 'l', spec: null, run: null, file: null, at: null, provenance: null, ...over });
    expect(dateOf(draft('1', { at: '2026-10-27T13:40:41.977Z', sources: [src({ at: '2026-01-01T00:00:00Z' })] }))).toEqual({ date: '2026-10-27', from: 'at' });
    expect(dateOf(draft('2', { sources: [src({ at: '2026-10-05T01:00:00Z', file: 'x-20260101.png' })] }))).toEqual({ date: '2026-10-05', from: 'source-at' });
    expect(dateOf(draft('3', { sources: [src({ file: 'shot-20261012-153000.png' })] }))).toEqual({ date: '2026-10-12', from: 'source-file' });
    expect(dateOf(draft('4'))).toEqual({ date: '2026-10-30', from: 'tag' });
    expect(dateOf(draft('5', { stored: { repo: 'x/y', tag: 'run-backfill-codex', assets: {} } }))).toBeNull();
    expect(dateOf(draft('6', { stored: null }))).toBeNull();
  });

  test('file name timestamps', () => {
    expect(dayInFileName('a_2026-10-30_b.png')).toBe('2026-10-30');
    expect(dayInFileName('1761830000.png')).toBe('2025-10-30');
    expect(dayInFileName('hash0123456789abcdef20261340.png')).toBeNull();
    expect(dayInFileName('tree_64.png')).toBeNull();
  });

  test('sorted newest first, undated last; the report counts each fallback', () => {
    const mk = (d: string, ds: Row['ds']): Row => ({ ...rowsOfOne(draft(`s${d}${ds}`)), d, ds });
    const rows = [mk('', ''), mk('2026-10-01', 'at'), mk('2026-11-01', 'tag'), mk('2026-10-15', 'source-at')];
    expect(sortRows(rows).map((r) => r.d)).toEqual(['2026-11-01', '2026-10-15', '2026-10-01', '']);
    expect(dateReport(rows)).toEqual({ total: 4, byFallback: { at: 1, 'source-at': 1, 'source-file': 0, tag: 1 }, undated: 1 });
  });
});

describe('the tools', () => {
  test('routes map to sections; the new two exist', () => {
    expect(toolOf({ route: 'pixellab', recipe: 'x' })).toBe('pixellab');
    expect(toolOf({ route: 'blender', recipe: 'x' })).toBe('blender');
    expect(toolOf({ route: 'kaggle', recipe: 'flux' })).toBe('kaggle-flux');
    expect(toolOf({ route: 'gemini-web', recipe: null })).toBe('gemini');
    expect(toolOf({ route: null, recipe: null })).toBe('unknown');
  });
});

describe('the thumbnails', () => {
  test('fetched once; a model file and a failed fetch get a placeholder and never stop the build', () => {
    const png = draft('png');
    const glb = draft('glb', { files: { raw: { sha256: sha256Hex(Buffer.from('glb')), bytes: 5, ext: '.glb' }, full: null, imported: null } });
    const lost = draft('lost');
    const dir = join(scratch, 'thumbs');
    const downloads: string[] = [];
    const gh: Gh = (args) => {
      const dest = args[args.indexOf('--dir') + 1] as string;
      for (let i = 0; i < args.length; i += 1) {
        if (args[i] !== '-p') continue;
        const asset = args[i + 1] as string;
        downloads.push(asset);
        if (asset === png.stored?.assets.raw) { mkdirSync(dest, { recursive: true }); writeFileSync(join(dest, asset), Buffer.alloc(40)); }
      }
      return { status: 0, stdout: '', stderr: '' };
    };
    const convert = (_from: string, to: string): boolean => { writeFileSync(to, 'webp'); return true; };
    const lines: string[] = [];
    const first = ensureThumbs([png, glb, lost], dir, { gh, convert, say: (l) => lines.push(l) });
    expect(first).toMatchObject({ made: 1, placeholders: 1, present: 0 });
    expect(first.failed.map((f) => f.id)).toEqual([lost.id]);
    expect(lines.some((l) => l.includes('placeholder') && l.includes(glb.id))).toBe(true);
    expect(existsSync(thumbPath(dir, png.id))).toBe(true);
    const before = downloads.length;
    const second = ensureThumbs([png], dir, { gh, convert });
    expect(second.present).toBe(1);
    expect(downloads.length).toBe(before);
  });

  test('the older folder seeds what it has', () => {
    const d = draft('seeded');
    const old = join(scratch, 'old');
    mkdirSync(old, { recursive: true });
    writeFileSync(thumbPath(old, d.id), 'webp');
    const gh: Gh = () => { throw new Error('no network for a seeded thumbnail'); };
    const report = ensureThumbs([d], join(scratch, 'new'), { gh, seedFrom: old });
    expect(report.seeded).toBe(1);
  });
});

test('the folded view the page reads is DraftIndex.drafts', () => {
  const a = draft('fold');
  const folded = foldIndex(parseIndex([JSON.stringify(a), JSON.stringify({ id: a.id, amend: true, review: 'archive' })].join('\n')));
  expect(folded.get(a.id)?.review).toBe('archive');
});
