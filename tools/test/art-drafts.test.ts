import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PNG } from 'pngjs';
import { afterAll, describe, expect, test } from 'vitest';

import {
  type Collected, type Draft, DraftIndex, FILE_KINDS, type Gh, annotateWrongDraws, assetName, collectLine, collectPictures, draftId, fetchDrafts,
  foldIndex, gpuSecondsSince, runCli, indexGrewOnly, noteDraft, parseIndex, parseRunLog, pacing, pngDims, pushCollected, sha256Hex, tagFor,
  verifyDrafts, verifyExitCode, verifyText, wrongDrawOrphans, wrongDrawsText,
} from '../src/art/drafts.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const scratch = mkdtempSync(join(tmpdir(), 'art-drafts-'));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

let counter = 0;
function folder(name: string): string {
  const dir = join(scratch, `${name}-${(counter += 1)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** A small PNG whose bytes depend on `seed`, so two seeds are two pictures and one seed is always the same bytes. */
function picture(seed: number, side = 4): Buffer {
  const png = new PNG({ width: side, height: side });
  for (let i = 0; i < side * side; i += 1) {
    png.data[i * 4] = (seed * 37 + i * 11) % 256;
    png.data[i * 4 + 1] = (seed * 53 + i) % 256;
    png.data[i * 4 + 2] = seed % 256;
    png.data[i * 4 + 3] = 255;
  }
  return PNG.sync.write(png);
}

interface RunFixture { dir: string; line: Record<string, unknown>; raw: Buffer }

/** A run folder as `kit:gen` leaves it: raw, out and a log, and for kaggle the kernel's script and manifest. */
function runFolder(opts: { name?: string; seed?: number; drawer?: 'kaggle' | 'local' | 'codex'; kernel?: boolean; at?: string } = {}): RunFixture {
  const name = opts.name ?? 'well_old';
  const drawer = opts.drawer ?? 'kaggle';
  const at = opts.at ?? '2026-10-27T13:40:41.977Z';
  const stamp = at.replace(/[:.]/g, '-');
  const dir = folder('run');
  for (const sub of ['raw', 'out', 'log']) mkdirSync(join(dir, sub), { recursive: true });
  const raw = picture(opts.seed ?? 1);
  writeFileSync(join(dir, `raw/${name}-${stamp}.png`), raw);
  writeFileSync(join(dir, `out/${name}-${stamp}.png`), picture((opts.seed ?? 1) + 100));
  const runId = '2026-10-27T13-24-56-615Z-1';
  const lines = drawer === 'kaggle'
    ? ['kaggle kernel kitgen-drawer run 1, 1 pictures, gpu any', 'recipe qwen, model x', `kernel kaggle/${runId}/kernel`, 'device Tesla T4, start and queue 35 s, model load 81.4 s, kernel 902.9 s, wall 920 s']
    : ['comfyui http://127.0.0.1:8188', 'denoise 0.6 steps 20 size 512 cfg 7', 'seed 9'];
  writeFileSync(join(dir, `log/${name}-${stamp}.txt`), lines.join('\n'));
  if (drawer === 'kaggle' && opts.kernel !== false) {
    const wave = {
      settings: { recipe: 'qwen', negative: 'blurry' },
      requests: [{ name, file: `${name}.png`, seed: opts.seed ?? 1, width: 1024, height: 1536, denoise: 1 }],
    };
    mkdirSync(join(dir, 'kaggle', runId, 'kernel'), { recursive: true });
    mkdirSync(join(dir, 'kaggle', runId, 'output'), { recursive: true });
    writeFileSync(join(dir, 'kaggle', runId, 'kernel/kitgen_wave.py'), `import json\nWAVE_B64 = "${Buffer.from(JSON.stringify(wave)).toString('base64')}"\n`);
    writeFileSync(join(dir, 'kaggle', runId, 'output/kitgen-manifest.json'), JSON.stringify({ device: 'Tesla T4', seconds: 902.9, images: [] }));
    writeFileSync(join(dir, 'kaggle', runId, 'output', `${name}.full.png`), picture(900 + (opts.seed ?? 1), 8));
  }
  const line = {
    name, spec: 'tools/kit-gen/pools/props.json', ref: `props/${name}`, width: 64, height: 128, prompt: 'a well', drawer,
    codex: { version: 'qwen+lora', exit: 0, seconds: 150, tokens: null, log: `log/${name}-${stamp}.txt` },
    raw: `raw/${name}-${stamp}.png`, out: `out/${name}-${stamp}.png`, warnings: ['drawn on a coarser grid: 53x83'], error: null, at, ramps: ['stone'],
  };
  return { dir, line, raw };
}

/** `gh` as a map: releases hold named assets; the four calls the tool makes. */
function fakeGh(): { gh: Gh; store: Map<string, Map<string, Buffer>>; calls: string[][] } {
  const store = new Map<string, Map<string, Buffer>>();
  const calls: string[][] = [];
  const ok = (stdout = ''): { status: number; stdout: string; stderr: string } => ({ status: 0, stdout, stderr: '' });
  const gh: Gh = (args) => {
    calls.push([...args]);
    const [group, verb, tag = ''] = args;
    if (group !== 'release') return { status: 1, stdout: '', stderr: 'unknown' };
    if (verb === 'view') {
      const release = store.get(tag);
      return release === undefined ? { status: 1, stdout: '', stderr: 'release not found' } : ok(JSON.stringify({ assets: [...release.keys()].map((name) => ({ name })) }));
    }
    if (verb === 'create') {
      store.set(tag, store.get(tag) ?? new Map());
      return ok();
    }
    if (verb === 'upload') {
      const release = store.get(tag);
      if (release === undefined) return { status: 1, stdout: '', stderr: 'no release' };
      const files = args.slice(5);
      // GitHub's cap: a release holds at most 1000 assets
      if (release.size + files.filter((file) => !release.has(basename(file))).length > 1000) return { status: 1, stdout: '', stderr: 'HTTP 422: Validation Failed (file_count limited to 1000)' };
      for (const file of files) release.set(basename(file), readFileSync(file));
      return ok();
    }
    if (verb === 'download') {
      const release = store.get(tag);
      const dir = args[args.indexOf('--dir') + 1] ?? '';
      if (release === undefined) return { status: 1, stdout: '', stderr: 'no release' };
      args.forEach((a, i) => {
        if (a !== '-p') return;
        const bytes = release.get(args[i + 1] ?? '');
        if (bytes !== undefined) writeFileSync(join(dir, args[i + 1] ?? ''), bytes);
      });
      return ok();
    }
    return { status: 1, stdout: '', stderr: 'unknown verb' };
  };
  return { gh, store, calls };
}

function collected(fx: RunFixture, label = 'test-run'): Collected {
  const item = collectLine(fx.dir, fx.line as never, { label });
  if (item === null) throw new Error('fixture did not collect');
  return item;
}

describe('draft ids and what a run line becomes', () => {
  test('the id is the first 16 hex of the SHA-256 of the raw PNG', () => {
    const fx = runFolder();
    const item = collected(fx);
    expect(item.record.id).toBe(sha256Hex(fx.raw).slice(0, 16));
    expect(item.record.id).toBe(draftId(fx.raw));
    expect(item.record.files.raw.sha256).toBe(sha256Hex(fx.raw));
    expect(item.record.review).toBe('unreviewed');
  });

  test('a kaggle line carries the kernel run: seed, canvas, recipe, the run id and its GPU seconds, and the full picture', () => {
    const fx = runFolder({ seed: 41 });
    const { record, paths } = collected(fx);
    expect(record).toMatchObject({
      pool: 'props', name: 'well_old', route: 'kaggle', recipe: 'qwen', seed: 41, denoise: 1, canvas: [8, 8], asked: [64, 128],
      run: { id: '2026-10-27T13-24-56-615Z-1', gpu_seconds: 902.9 }, model_version: 'qwen+lora', ramps: ['stone'], negative: null,
    });
    expect(record.files.full).not.toBeNull();
    expect(record.files.imported).not.toBeNull();
    expect(paths.full).toMatch(/well_old\.full\.png$/);
  });

  test('without the kernel files the canvas is the raw picture, the seed unknown, the run still named by the log', () => {
    const fx = runFolder({ kernel: false });
    const { record } = collected(fx);
    expect(record.seed).toBeNull();
    expect(record.canvas).toEqual([4, 4]);
    expect(record.run).toEqual({ id: '2026-10-27T13-24-56-615Z-1', gpu_seconds: 902.9 });
    expect(record.files.full).toBeNull();
  });

  test('the local route reads its seed and denoise from its log', () => {
    const { record } = collected(runFolder({ drawer: 'local' }));
    expect(record).toMatchObject({ route: 'local', recipe: 'local', seed: 9, denoise: 0.6, run: null });
  });

  test('a line with no picture or a missing file is skipped with the reason, never indexed', () => {
    const fx = runFolder();
    const skipped: { name: string; why: string }[] = [];
    expect(collectLine(fx.dir, { ...fx.line, raw: null } as never, { label: 'x', skipped })).toBeNull();
    expect(collectLine(fx.dir, { ...fx.line, raw: 'raw/gone.png' } as never, { label: 'x', skipped })).toBeNull();
    expect(skipped.map((s) => s.why)).toEqual(['no picture was drawn', 'the raw file is not on disk']);
  });

  test('the log parser', () => {
    expect(parseRunLog('kernel kaggle/2026-10-27T13-24-56-615Z-1/kernel\nrecipe sdxl, model m\ndevice T4, kernel 510.7 s, wall 546 s')).toMatchObject({
      runId: '2026-10-27T13-24-56-615Z-1', recipe: 'sdxl', kernelSeconds: 510.7,
    });
  });

  test('loose pictures: the stem is the name, a json beside it gives the prompt and date, the rest stays null', () => {
    const dir = folder('study');
    writeFileSync(join(dir, 'meadow-a.png'), picture(5));
    writeFileSync(join(dir, 'meadow-a.json'), JSON.stringify({ prompt: 'meadow', tool: 'imagegen', date: '2026-10-24' }));
    writeFileSync(join(dir, 'broken.png'), 'not a png');
    const skipped: { name: string; why: string }[] = [];
    const items = collectPictures([join(dir, 'meadow-a.png'), join(dir, 'broken.png')], { label: 'study', provenance: 'uncommitted, 19.10', skipped });
    expect(items).toHaveLength(1);
    expect(items[0]?.record).toMatchObject({ name: 'meadow-a', prompt: 'meadow', recipe: 'imagegen', at: '2026-10-24', seed: null, route: null });
    expect(items[0]?.record.sources[0]?.provenance).toBe('uncommitted, 19.10');
    expect(skipped).toEqual([{ name: 'broken.png', why: 'not a PNG' }]);
  });
});

describe('the index is append-only and identical bytes are one draft', () => {
  test('the same bytes from two runs are one draft with both sources; nothing is rewritten', () => {
    const path = join(folder('index'), 'drafts.jsonl');
    const a = collected(runFolder({ seed: 3, at: '2026-10-27T13:40:41.977Z' }), 'run-a');
    const b = collected(runFolder({ seed: 3, at: '2026-10-28T09:00:00.000Z' }), 'run-b');
    expect(b.record.id).toBe(a.record.id);
    const index = DraftIndex.open(path);
    expect(index.add(a.record)).toBe('added');
    const first = readFileSync(path, 'utf8');
    expect(index.add(a.record)).toBe('same');
    expect(readFileSync(path, 'utf8')).toBe(first);
    expect(index.add(b.record)).toBe('merged');
    const after = readFileSync(path, 'utf8');
    expect(after.startsWith(first)).toBe(true);
    expect(after.split('\n').filter(Boolean)).toHaveLength(2);
    expect(index.drafts.size).toBe(1);
    expect(index.drafts.get(a.record.id)?.sources.map((s) => s.label)).toEqual(['run-a', 'run-b']);
    // reading the file again folds to the same thing
    expect(DraftIndex.open(path).drafts.get(a.record.id)?.sources).toHaveLength(2);
  });

  test('different bytes are different drafts', () => {
    const path = join(folder('index'), 'drafts.jsonl');
    const index = DraftIndex.open(path);
    index.add(collected(runFolder({ seed: 1 })).record);
    index.add(collected(runFolder({ seed: 2 })).record);
    expect(index.drafts.size).toBe(2);
  });

  test('an amendment adds what was learned, a second one that changes nothing writes nothing', () => {
    const path = join(folder('index'), 'drafts.jsonl');
    const index = DraftIndex.open(path);
    const { record } = collected(runFolder());
    index.add(record);
    expect(index.amend({ id: record.id, amend: true, looks_like: 'a stool', review: 'archive' })).toBe(true);
    expect(index.amend({ id: record.id, amend: true, looks_like: 'a stool', review: 'archive' })).toBe(false);
    const folded = DraftIndex.open(path).drafts.get(record.id);
    expect(folded).toMatchObject({ looks_like: 'a stool', review: 'archive', name: 'well_old' });
    expect(() => index.amend({ id: '0000000000000000', amend: true, review: 'keep' })).toThrow(/no draft/);
  });

  test('the file only grows: a later version always starts with the earlier text', () => {
    expect(indexGrewOnly('a\nb\n', 'a\nb\nc\n')).toBe(true);
    expect(indexGrewOnly('a\nb\n', 'a\nB\nc\n')).toBe(false);
    expect(indexGrewOnly('a\nb\n', 'a\n')).toBe(false);
    expect(indexGrewOnly('', 'a\n')).toBe(true);
    expect(indexGrewOnly('a\nb', 'a\nbc\n')).toBe(false);
  });

  test('a line whose id is not its raw hash, or an amendment with no draft, is refused', () => {
    const { record } = collected(runFolder());
    expect(() => parseIndex(JSON.stringify({ ...record, id: '0123456789abcdef' }))).toThrow(/first 16 hex/);
    expect(() => parseIndex('{"id":"zz"}')).toThrow(/16-hex/);
    expect(() => foldIndex(parseIndex(JSON.stringify({ id: '0123456789abcdef', amend: true, review: 'keep' })))).toThrow(/introduced/);
    expect(parseIndex(JSON.stringify(record))).toHaveLength(1);
  });

  test('the GPU meter counts each kernel run once, from the weekly reset on', () => {
    const a = collected(runFolder({ seed: 1 })).record;
    const b = collected(runFolder({ seed: 2 })).record;
    const old = { ...collected(runFolder({ seed: 3 })).record, run: { id: 'older-run', gpu_seconds: 100 }, at: '2026-10-01T00:00:00.000Z' };
    // a and b are two pictures of one run: 902.9 seconds, not twice that
    expect(gpuSecondsSince([a, b, old], new Date('2026-10-25T00:00:00Z'))).toBeCloseTo(902.9);
    expect(gpuSecondsSince([a, b, old], new Date('2026-09-01T00:00:00Z'))).toBeCloseTo(1002.9);
  });
});

describe('the drafts repo: push, fetch, verify', () => {
  test('a push makes one release per kernel run, names assets by draft id, and cites them in the index', () => {
    const { gh, store } = fakeGh();
    const index = DraftIndex.open(join(folder('index'), 'drafts.jsonl'));
    const first = collected(runFolder({ seed: 1, name: 'well_old' }));
    const other = collected(runFolder({ seed: 2, name: 'stone', at: '2026-10-28T09:00:00.000Z' }));
    const report = pushCollected([first, other], index, { gh });
    expect(report.uploaded).toBe(2);
    const tag = tagFor(first.record);
    expect(tag).toMatch(/^run-20261027-[0-9a-f]{6}$/);
    expect(store.get(tag)?.has(assetName(first.record.id, 'raw'))).toBe(true);
    expect(store.get(tag)?.has(assetName(first.record.id, 'full'))).toBe(true);
    expect(store.get(tag)?.has(assetName(first.record.id, 'imported'))).toBe(true);
    expect(index.drafts.get(first.record.id)?.stored).toEqual({
      repo: 'Bobikobi/GAME-art-drafts', tag, assets: { raw: `${first.record.id}.png`, full: `${first.record.id}.full.png`, imported: `${first.record.id}.imported.png` },
    });
    // the second run has the same kernel run id in the fixture, so both share a release
    expect([...store.keys()]).toEqual([tag]);
  });

  test('a jpg and a glb are drafts too: the store keeps their extension, fetch and verify find them', () => {
    const { gh, store } = fakeGh();
    const index = DraftIndex.open(join(folder('index-ext'), 'drafts.jsonl'));
    const dir = folder('ext-pictures');
    writeFileSync(join(dir, 'look.jpg'), Buffer.from('not really a jpeg'));
    writeFileSync(join(dir, 'model.glb'), Buffer.from('glTF fake model'));
    writeFileSync(join(dir, 'notes.txt'), 'skip me');
    const skipped: { name: string; why: string }[] = [];
    const items = collectPictures([join(dir, 'look.jpg'), join(dir, 'model.glb'), join(dir, 'notes.txt')], { label: 'ext', skipped });
    expect(items.map((i) => i.record.files.raw.ext)).toEqual(['.jpg', '.glb']);
    expect(skipped.map((x) => x.name)).toEqual(['notes.txt']);
    const report = pushCollected(items, index, { gh });
    expect(report.uploaded).toBe(2);
    const [jpg, glb] = items;
    expect(index.drafts.get(jpg!.record.id)?.stored?.assets.raw).toBe(`${jpg!.record.id}.jpg`);
    expect(index.drafts.get(glb!.record.id)?.stored?.assets.raw).toBe(`${glb!.record.id}.glb`);
    expect([...(store.get(index.drafts.get(jpg!.record.id)!.stored!.tag)?.keys() ?? [])].sort()).toEqual([`${jpg!.record.id}.jpg`, `${glb!.record.id}.glb`].sort());
    const cache = folder('cache-ext');
    const verified = verifyDrafts(index, null, { gh, cache });
    expect(verified.ok).toBe(2);
    expect(verifyExitCode(verified)).toBe(0);
  });

  test('a run folder pushed with --recursive also gives its sub-folders\' pictures; without it only the manifest\'s', () => {
    const fx = runFolder({ seed: 5, name: 'urn' });
    writeFileSync(join(fx.dir, 'manifest.jsonl'), `${JSON.stringify(fx.line)}\n`);
    mkdirSync(join(fx.dir, 'refinement'), { recursive: true });
    writeFileSync(join(fx.dir, 'refinement', 'urn-v2.png'), picture(77));
    const before = process.env['ART_DRAFTS_INDEX'];
    try {
      const flat = join(folder('idx-flat'), 'drafts.jsonl');
      process.env['ART_DRAFTS_INDEX'] = flat;
      runCli(['push', fx.dir, '--label', 'urn', '--no-upload']);
      const deep = join(folder('idx-deep'), 'drafts.jsonl');
      process.env['ART_DRAFTS_INDEX'] = deep;
      runCli(['push', fx.dir, '--label', 'urn', '--recursive', '--no-upload']);
      expect(DraftIndex.open(flat).drafts.size).toBe(1);
      expect(DraftIndex.open(deep).drafts.size).toBeGreaterThan(1);
      expect([...DraftIndex.open(deep).drafts.values()].some((d) => d.sources.some((x) => x.file === 'urn-v2.png'))).toBe(true);
    } finally {
      if (before === undefined) delete process.env['ART_DRAFTS_INDEX'];
      else process.env['ART_DRAFTS_INDEX'] = before;
    }
  });

  test('a second push uploads nothing, and never overwrites', () => {
    const { gh, calls } = fakeGh();
    const index = DraftIndex.open(join(folder('index'), 'drafts.jsonl'));
    const item = collected(runFolder());
    pushCollected([item], index, { gh });
    const uploads = calls.filter((c) => c[1] === 'upload').length;
    const again = pushCollected([item], index, { gh });
    expect(again.uploaded).toBe(0);
    expect(again.skipped).toBe(1);
    expect(calls.filter((c) => c[1] === 'upload')).toHaveLength(uploads);
    expect(calls.flat()).not.toContain('--clobber');
  });

  test('--tag puts everything in one release (the backfill)', () => {
    const { gh, store } = fakeGh();
    const index = DraftIndex.open(join(folder('index'), 'drafts.jsonl'));
    pushCollected([collected(runFolder({ seed: 1 })), collected(runFolder({ seed: 2, drawer: 'local' }))], index, { gh, tag: 'run-backfill-test' });
    expect([...store.keys()]).toEqual(['run-backfill-test']);
  });

  /** A release that already holds `count` assets from earlier pushes. */
  function filled(store: Map<string, Map<string, Buffer>>, tag: string, count: number): void {
    store.set(tag, new Map(Array.from({ length: count }, (_, i) => [`old-${i}.png`, Buffer.from('x')])));
  }

  test('a release near GitHub\'s 1000 assets is counted: the drafts that fit go in, the rest roll to tag-2', () => {
    const { gh, store } = fakeGh();
    filled(store, 'run-orphans', 994);
    const index = DraftIndex.open(join(folder('index'), 'drafts.jsonl'));
    const items = [1, 2, 3].map((seed) => collected(runFolder({ seed })));
    const report = pushCollected(items, index, { gh, tag: 'run-orphans' });
    expect(report.uploaded).toBe(3);
    expect(report.tags).toEqual(['run-orphans', 'run-orphans-2']);
    expect(store.get('run-orphans')?.size).toBe(1000);
    expect(store.get('run-orphans-2')?.size).toBe(3);
    expect(items.map((i) => index.drafts.get(i.record.id)?.stored?.tag)).toEqual(['run-orphans', 'run-orphans', 'run-orphans-2']);
  });

  test('a full release is never asked to take more, and a later push goes on filling the last one', () => {
    const { gh, store, calls } = fakeGh();
    filled(store, 'run-undated-unknown', 1000);
    filled(store, 'run-undated-unknown-2', 998);
    const index = DraftIndex.open(join(folder('index'), 'drafts.jsonl'));
    const item = collected(runFolder({ seed: 4 }));
    pushCollected([item], index, { gh, tag: 'run-undated-unknown' });
    expect(index.drafts.get(item.record.id)?.stored?.tag).toBe('run-undated-unknown-3');
    expect(calls.filter((c) => c[1] === 'upload').map((c) => c[2])).toEqual(['run-undated-unknown-3']);
    expect(store.get('run-undated-unknown')?.size).toBe(1000);
  });

  test('a draft whose files a release already holds (a push stopped before the index) is cited there, not sent again', () => {
    const { gh, store, calls } = fakeGh();
    const item = collected(runFolder({ seed: 6 }));
    filled(store, 'run-x', 1000);
    store.set('run-x-2', new Map(FILE_KINDS.flatMap((kind) => (item.paths[kind] === null ? [] : [[assetName(item.record.id, kind, item.record.files[kind]?.ext), Buffer.from('y')] as const]))));
    const index = DraftIndex.open(join(folder('index'), 'drafts.jsonl'));
    pushCollected([item], index, { gh, tag: 'run-x' });
    expect(index.drafts.get(item.record.id)?.stored?.tag).toBe('run-x-2');
    expect(calls.filter((c) => c[1] === 'upload')).toHaveLength(0);
  });

  test('fetch fills the cache and verify exits 0 when every hash matches', () => {
    const { gh } = fakeGh();
    const index = DraftIndex.open(join(folder('index'), 'drafts.jsonl'));
    const item = collected(runFolder());
    pushCollected([item], index, { gh });
    const cache = folder('cache');
    const fetched = fetchDrafts(index, null, { gh, cache });
    expect(fetched.fetched).toBe(3);
    expect(existsSync(join(cache, `${item.record.id}.png`))).toBe(true);
    const report = verifyDrafts(index, null, { gh, cache });
    expect(report).toMatchObject({ checked: 3, ok: 3, mismatched: [], missing: [], unpushed: [] });
    expect(verifyExitCode(report)).toBe(0);
    expect(verifyText(report)).toMatch(/3 match, 0 differ, 0 missing/);
  });

  test('verify fetches what the cache lacks, then fails with the mismatch when bytes differ', () => {
    const { gh, store } = fakeGh();
    const index = DraftIndex.open(join(folder('index'), 'drafts.jsonl'));
    const item = collected(runFolder());
    pushCollected([item], index, { gh });
    const tag = tagFor(item.record);
    // the stored copy is corrupted after the push
    store.get(tag)?.set(`${item.record.id}.png`, picture(777));
    const report = verifyDrafts(index, null, { gh, cache: folder('cache') });
    expect(report.fetched).toBe(3);
    expect(report.mismatched).toHaveLength(1);
    expect(report.mismatched[0]).toMatchObject({ id: item.record.id, kind: 'raw', expected: item.record.files.raw.sha256 });
    expect(verifyExitCode(report)).toBe(1);
    expect(verifyText(report)).toMatch(/MISMATCH .* raw/);
  });

  test('a cached file edited on disk is a mismatch; a file the release lost is missing', () => {
    const { gh, store } = fakeGh();
    const index = DraftIndex.open(join(folder('index'), 'drafts.jsonl'));
    const item = collected(runFolder());
    pushCollected([item], index, { gh });
    const cache = folder('cache');
    verifyDrafts(index, null, { gh, cache });
    writeFileSync(join(cache, `${item.record.id}.imported.png`), picture(5));
    expect(verifyDrafts(index, null, { gh, cache, fetch: false }).mismatched.map((m) => m.kind)).toEqual(['imported']);
    store.get(tagFor(item.record))?.delete(`${item.record.id}.full.png`);
    const lost = verifyDrafts(index, null, { gh, cache: folder('cache2') });
    expect(lost.missing.map((m) => m.kind)).toEqual(['full']);
    expect(verifyExitCode(lost)).toBe(1);
  });

  test('a rate-limited download waits for the window instead of burning its retries', () => {
    const { gh, store } = fakeGh();
    const index = DraftIndex.open(join(folder('index'), 'drafts.jsonl'));
    const item = collected(runFolder());
    pushCollected([item], index, { gh });
    expect(store.size).toBe(1);
    let denied = 2;
    const waits: number[] = [];
    const limited: Gh = (args) => {
            if (args[1] === 'download' && denied > 0) {
        denied -= 1;
        return { status: 1, stdout: '', stderr: 'HTTP 403: API rate limit exceeded for user ID 1' };
      }
      return gh(args);
    };
    const real = pacing.sleep;
    pacing.sleep = (seconds) => { waits.push(seconds); };
    try {
      const report = fetchDrafts(index, null, { gh: limited, cache: folder('cache') });
      expect(report.fetched).toBe(3);
      expect(report.missing).toEqual([]);
    } finally {
      pacing.sleep = real;
    }
    expect(waits).toHaveLength(2);
    expect(waits).toEqual([120, 120]);
  });

  test('a draft not pushed yet is listed, and only --strict fails on it', () => {
    const index = DraftIndex.open(join(folder('index'), 'drafts.jsonl'));
    index.add(collected(runFolder()).record);
    const report = verifyDrafts(index, null, { cache: folder('cache'), fetch: false });
    expect(report.unpushed).toHaveLength(1);
    expect(verifyExitCode(report)).toBe(0);
    expect(verifyExitCode(report, true)).toBe(1);
  });
});

describe('kit:gen appends a line per imported draft', () => {
  test('noteDraft writes the draft where the manifest line is written, and a repeat adds nothing', () => {
    const fx = runFolder({ seed: 11 });
    const path = join(folder('index'), 'drafts.jsonl');
    expect(noteDraft(fx.dir, fx.line as never, path)).toBe('added');
    expect(noteDraft(fx.dir, fx.line as never, path)).toBe('same');
    const lines = parseIndex(readFileSync(path, 'utf8'));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ id: draftId(fx.raw), seed: 11, route: 'kaggle', review: 'unreviewed', stored: null });
  });

  test('a failed draw has no picture and writes nothing; a failed import still keeps the raw picture with its error', () => {
    const fx = runFolder();
    const path = join(folder('index'), 'drafts.jsonl');
    expect(noteDraft(fx.dir, { ...fx.line, raw: null, error: 'the kaggle run returned no picture' } as never, path)).toBeNull();
    expect(existsSync(path)).toBe(false);
    expect(noteDraft(fx.dir, { ...fx.line, out: null, error: 'import: the picture is empty' } as never, path)).toBe('added');
    expect(parseIndex(readFileSync(path, 'utf8'))[0]).toMatchObject({ errors: ['import: the picture is empty'] });
  });

  test('gen.ts calls it at the one place a manifest line is written', () => {
    const gen = readFileSync(join(root, 'tools/src/kit/gen.ts'), 'utf8');
    expect(gen).toMatch(/appendFileSync\(manifestPath[^\n]*\n\s*noteDraft\(options\.out, line\)/);
  });
});

describe('the wrong-draws library is a view of the index', () => {
  test('annotation matches each listed PNG by hash, and the view lists the drafts with looks_like', () => {
    const fx = runFolder({ seed: 6 });
    const index = DraftIndex.open(join(folder('index'), 'drafts.jsonl'));
    const { record } = collected(fx);
    index.add(record);
    const dir = folder('wrong');
    writeFileSync(join(dir, 'well_old-qwen.png'), readFileSync(join(fx.dir, fx.line['out'] as string)));
    writeFileSync(join(dir, 'unknown.png'), picture(4242));
    const library = [
      { file: 'well_old-qwen.png', asked: 'well_old', looks_like: 'a stool', model: 'Qwen', kept: '2026-10-23, wrong object' },
      { file: 'unknown.png', asked: 'x', looks_like: 'a cloud' },
    ].map((l) => JSON.stringify(l)).join('\n');
    const result = annotateWrongDraws(index, library, dir);
    expect(result).toEqual({ matched: 1, unmatched: ['unknown.png'] });
    const view = wrongDrawsText(index.drafts.values()).trim().split('\n').map((l) => JSON.parse(l) as Record<string, unknown>);
    expect(view).toHaveLength(1);
    expect(view[0]).toMatchObject({ file: 'well_old-qwen.png', asked: 'well_old', looks_like: 'a stool', model: 'Qwen', kept: '2026-10-23, wrong object', seed: 6, drawer: 'kaggle', draft: record.id });
    expect(index.drafts.get(record.id)?.review).toBe('archive');
  });

  test('a listed PNG that no draft holds becomes a draft of its own, with what the library knows, and then matches', () => {
    const index = DraftIndex.open(join(folder('index'), 'drafts.jsonl'));
    const dir = folder('wrong');
    writeFileSync(join(dir, 'sapling-sdxl.png'), picture(31));
    const library = JSON.stringify({ file: 'sapling-sdxl.png', asked: 'sapling', looks_like: 'a pot plant', model: 'SDXL', seed: 41, round: 4, drawer: 'kaggle', ramps: ['moss'], prompt: 'a sapling', at: '2026-10-23T08:42:41.825Z', kept: '2026-10-23, wrong object' });
    const orphans = wrongDrawOrphans(index, library, dir);
    expect(orphans).toHaveLength(1);
    expect(orphans[0]?.record).toMatchObject({ name: 'sapling', seed: 41, round: 4, route: 'kaggle', model: 'SDXL', prompt: 'a sapling' });
    index.add(orphans[0]?.record as Draft);
    expect(wrongDrawOrphans(index, library, dir)).toHaveLength(0);
    expect(annotateWrongDraws(index, library, dir)).toEqual({ matched: 1, unmatched: [] });
    const text = wrongDrawsText(index.drafts.values());
    expect(JSON.parse(text)).toMatchObject({ file: 'sapling-sdxl.png', asked: 'sapling', looks_like: 'a pot plant', seed: 41, kept: '2026-10-23, wrong object' });
  });
});

describe('the committed index', () => {
  const path = join(root, 'tools/kit-gen/drafts.jsonl');
  const drafts = existsSync(path) ? [...DraftIndex.open(path).drafts.values()] : [];

  test('every line reads, every id is its raw hash, every stored draft names the drafts repo', () => {
    const lines = existsSync(path) ? parseIndex(readFileSync(path, 'utf8')) : [];
    expect(lines.length).toBeGreaterThanOrEqual(drafts.length);
    for (const d of drafts) {
      expect(d.files.raw.sha256.startsWith(d.id)).toBe(true);
      if (d.stored !== null) {
        expect(d.stored.repo).toBe('Bobikobi/GAME-art-drafts');
        expect(d.stored.assets.raw).toBe(`${d.id}${d.files.raw.ext ?? '.png'}`);
      }
    }
  });

  test('no line names a person, a host or a path outside the repo', () => {
    const text = existsSync(path) ? readFileSync(path, 'utf8') : '';
    expect(text).not.toMatch(/\/home\/|\/Users\/|ceos-server|ssh |@[a-z0-9-]+\.(com|dev|io)/i);
  });

  test('the wrong-draws library is exactly the view of the index', () => {
    if (drafts.length === 0) return;
    const library = readFileSync(join(root, 'docs/art/wrong-draws/library.jsonl'), 'utf8');
    expect(library).toBe(wrongDrawsText(drafts));
  });

  test('a Draft record has every field of the plan: pool name spec round route recipe seed denoise canvas asked prompt negative warnings errors run files stored review', () => {
    const sample: Draft = collected(runFolder()).record;
    for (const key of ['id', 'pool', 'name', 'spec', 'round', 'route', 'recipe', 'model_version', 'seed', 'denoise', 'canvas', 'asked', 'prompt', 'negative', 'warnings', 'errors', 'run', 'files', 'stored', 'review']) {
      expect(sample).toHaveProperty(key);
    }
    expect(pngDims(picture(1, 6))).toEqual([6, 6]);
  });
});
