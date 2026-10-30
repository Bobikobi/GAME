import { deflateSync } from 'node:zlib';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { afterAll, describe, expect, test } from 'vitest';

import { DraftIndex } from '../src/art/drafts.js';
import { galleryCards, galleryHtml } from '../src/art/gallery.js';
import { applyPicks, parsePicksFile, pickCli, planPicks } from '../src/art/pick.js';

const scratch = mkdtempSync(join(tmpdir(), 'art-pick-'));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

/** A PNG header with the given size and no real pixels: enough for `pngDims` and a copy. */
function png(w: number, h: number): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const chunk = (type: string, data: Buffer): Buffer => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    return Buffer.concat([len, Buffer.from(type), data, Buffer.alloc(4)]);
  };
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(Buffer.alloc(0))), chunk('IEND', Buffer.alloc(0))]);
}

const ID = (n: number): string => n.toString(16).padStart(16, '0');

function draftLine(name: string, n: number): object {
  return {
    id: ID(n), pool: 'ground', name, spec: '.scratch/x/spec.json', round: 1, route: 'kaggle', recipe: 'qwen', model: null, model_version: null, seed: 7, denoise: 1,
    canvas: null, asked: [64, 64], ramps: ['grey'], prompt: 'a tile', negative: null, warnings: [], errors: [], run: { id: 'r', gpu_seconds: 600 },
    files: { raw: { sha256: ID(n).repeat(4), bytes: 1 }, full: null, imported: { sha256: ID(n).repeat(4), bytes: 1 } }, stored: null, review: 'unreviewed', at: '2026-10-29T10:00:00.000Z', sources: [],
  };
}

function fixture(): { dir: string; cache: string } {
  const dir = mkdtempSync(join(scratch, 'root-'));
  const write = (path: string, text: string | Buffer): void => {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), text);
  };
  const entry = (name: string): object => ({ name, ref: 'tiles/grass', kit_id: `tiles/${name}`, new: true, kind: 'tile', width: 64, height: 64, ramps: ['grey'], what: 'snow tile', detail: 'white drifts' });
  write('tools/kit-gen/pools/ground.json', JSON.stringify({ entries: [entry('snow'), entry('ice')] }));
  write('tools/kit-gen/pickers/owner.json', JSON.stringify({ pickers: ['elad'] }));
  write('content/kit/core/kit.json', `${JSON.stringify({ kit: { sprites: { 'tiles/grass': { file: 'tiles/grass.png', w: 16, h: 16 } } } }, null, 2)}\n`);
  write('tools/kit-gen/rich-wave.manifest.jsonl', '{"name":"old","picked":"x"}\n');
  write('tools/kit-gen/drafts.jsonl', [draftLine('snow', 1), draftLine('snow', 2), draftLine('ice', 3)].map((l) => JSON.stringify(l)).join('\n') + '\n');
  const cache = join(dir, 'cache');
  for (const n of [1, 2, 3]) write(`cache/${ID(n)}.imported.png`, png(64, 64));
  return { dir, cache };
}

describe('art:pick', () => {
  test('a pick lands the picture, the kit entry, a manifest line and keep; the other actions only amend the index', () => {
    const { dir, cache } = fixture();
    const file = parsePicksFile(JSON.stringify({ picked_by: 'elad', picks: [
      { draft: ID(1), action: 'pick' }, { draft: ID(2), action: 'again', note: 'less blue' }, { draft: ID(3), action: 'wrong', note: 'a plate' },
    ] }));
    const steps = planPicks(file, { root: dir, cacheDir: cache });
    expect(steps).toHaveLength(3);
    applyPicks(file, steps, { root: dir, cacheDir: cache, today: '2026-10-30' });
    expect(existsSync(join(dir, 'content/kit/core/tiles/snow.png'))).toBe(true);
    const kit = JSON.parse(readFileSync(join(dir, 'content/kit/core/kit.json'), 'utf8')) as { kit: { sprites: Record<string, Record<string, unknown>> } };
    expect(kit.kit.sprites['tiles/snow']).toMatchObject({ file: 'tiles/snow.png', w: 64, h: 64, density: 4, ramps: ['grey'], source: { spec: 'tools/kit-gen/pools/ground.json', manifest: 'tools/kit-gen/rich-wave.manifest.jsonl:2' } });
    const lines = readFileSync(join(dir, 'tools/kit-gen/rich-wave.manifest.jsonl'), 'utf8').trim().split('\n');
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[1] ?? '')).toMatchObject({ sprite: 'tiles/snow', draft: ID(1), picked_by: 'elad', seed: 7 });
    const drafts = DraftIndex.open(join(dir, 'tools/kit-gen/drafts.jsonl')).drafts;
    expect(drafts.get(ID(1))?.review).toBe('keep');
    expect(drafts.get(ID(2))).toMatchObject({ review: 'rework', review_note: 'less blue' });
    expect(drafts.get(ID(3))).toMatchObject({ review: 'archive', looks_like: 'a plate' });
  });

  test('only a listed picker, one pick an entry, a real draft of the right size, and a wrong object says what it is', () => {
    const { dir, cache } = fixture();
    const ctx = { root: dir, cacheDir: cache };
    const pick = (picked_by: string, picks: object[]): ReturnType<typeof planPicks> => planPicks(parsePicksFile(JSON.stringify({ picked_by, picks })), ctx);
    expect(() => pick('codex', [{ draft: ID(1), action: 'pick' }])).toThrow(/not in tools\/kit-gen\/pickers\/owner.json/);
    expect(() => pick('elad', [{ draft: ID(1), action: 'pick' }, { draft: ID(2), action: 'pick' }])).toThrow(/one pick an entry/);
    expect(() => pick('elad', [{ draft: ID(9), action: 'pick' }])).toThrow(/no draft/);
    expect(() => parsePicksFile(JSON.stringify({ picked_by: 'elad', picks: [{ draft: ID(1), action: 'wrong' }] }))).toThrow(/looks like/);
    writeFileSync(join(cache, `${ID(1)}.imported.png`), png(32, 32));
    expect(() => pick('elad', [{ draft: ID(1), action: 'pick' }])).toThrow(/asks 64x64/);
  });

  test('--dry prints the changes and writes nothing; the one-draft form checks the name', () => {
    const { dir, cache } = fixture();
    const ctx = { root: dir, cacheDir: cache };
    const out = pickCli(['ground', 'snow', ID(1), '--dry'], ctx);
    expect(out.text).toContain('dry run');
    expect(out.text).toContain('content/kit/core/tiles/snow.png');
    expect(existsSync(join(dir, 'content/kit/core/tiles/snow.png'))).toBe(false);
    expect(() => pickCli(['ground', 'ice', ID(1), '--dry'], ctx)).toThrow(/draw of snow/);
    pickCli(['ground', 'snow', ID(1)], { ...ctx, today: '2026-10-30' });
    expect(existsSync(join(dir, 'content/kit/core/tiles/snow.png'))).toBe(true);
  });
});

describe('the pick page', () => {
  test('every draft of an entry is a card with the three buttons and one Send, pictures inside the page', () => {
    const { dir, cache } = fixture();
    const groups = galleryCards({ pools: ['ground'], root: dir, cacheDir: cache });
    expect(groups.map((g) => [g.name, g.cards.length])).toEqual([['snow', 2], ['ice', 1]]);
    const html = galleryHtml({ pools: ['ground'], root: dir, cacheDir: cache });
    expect(html.match(/class="card"/gu)).toHaveLength(3);
    expect(html).toContain('data:image/png;base64,');
    for (const word of ['Like', 'Again', 'Wrong object', 'id="send"', '"elad"']) expect(html).toContain(word);
  });
});
