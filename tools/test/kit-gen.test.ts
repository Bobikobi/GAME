import { mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PNG } from 'pngjs';
import { afterAll, describe, expect, test } from 'vitest';

import {
  type GenEntry, type ManifestLine, buildPrompt, enlargeOnMagenta, findOutput, galleryHtml, gridWarnings,
  importPalette, importRamps, importTile, loadReference, parseArgs, parseSpec, parseTokens,
} from '../src/kit/gen.js';
import { CORE_PALETTE, CORE_RAMPS, hexToRgb } from '../src/kit/palette.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const scratch = mkdtempSync(join(tmpdir(), 'kit-gen-'));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

const elder: GenEntry = {
  name: 'elder', ref: 'chars/elder', what: 'village elder', width: 32, height: 48, detail: 'a belt and boots',
};

function spec(entries: unknown[]): string {
  return JSON.stringify({ entries });
}

describe('the spec', () => {
  test('the trial spec reads', () => {
    const entries = parseSpec(readFileSync(join(root, 'tools/kit-gen/trial-32.json'), 'utf8'));
    expect(entries.map((e) => e.name)).toEqual(['elder', 'tree_oak', 'axe', 'grass']);
    for (const entry of entries) expect(() => loadReference(entry.ref)).not.toThrow();
  });

  test.each([
    [{ ...elder, name: 'Elder' }, /lowercase/],
    [{ ...elder, width: 0 }, /width/],
    [{ ...elder, height: 385 }, /height/],
    [{ ...elder, width: 31.5 }, /width/],
    [{ ...elder, kind: 'wall' }, /kind/],
    [{ ...elder, what: ' ' }, /what/],
  ])('refuses %o', (entry, message) => {
    expect(() => parseSpec(spec([entry]))).toThrow(message);
  });

  test('an outside reference needs what the eye saw, who confirmed it and the palette decision', () => {
    const outside = { ...elder, name: 'tub', ref: 'refs/tub.png', what: 'round wooden tub' };
    const seen = { ...outside, seen: 'a round plum tub with a padded lid', confirmed_by: 'owner' };
    expect(() => parseSpec(spec([outside]))).toThrow(/seen/);
    expect(() => parseSpec(spec([{ ...outside, seen: seen.seen }]))).toThrow(/confirmed_by/);
    expect(() => parseSpec(spec([seen]))).toThrow(/palette/);
    expect(() => parseSpec(spec([{ ...seen, palette: 'maybe' }]))).toThrow(/palette/);
    expect(parseSpec(spec([{ ...seen, palette: 'restyle' }]))).toHaveLength(1);
    expect(() => parseSpec(spec([{ ...elder, ref: 'content/kit/core/props.png' }]))).not.toThrow();
  });

  test('refuses a name twice and an empty spec', () => {
    expect(() => parseSpec(spec([elder, elder]))).toThrow(/twice/);
    expect(() => parseSpec(spec([]))).toThrow(/non-empty/);
  });

  test('the timeout is a positive number of seconds, five minutes when not given', () => {
    expect(parseArgs(['s.json']).timeoutSeconds).toBe(300);
    expect(parseArgs(['s.json', '--timeout', '90']).timeoutSeconds).toBe(90);
    expect(parseArgs(['s.json'], {}).drawer).toBe('codex');
    expect(parseArgs(['s.json', '--drawer', 'gemini'], {}).drawer).toBe('gemini');
    expect(parseArgs(['s.json'], { KIT_DRAWER: 'gemini' }).drawer).toBe('gemini');
    expect(parseArgs(['s.json', '--drawer', 'codex'], { KIT_DRAWER: 'gemini' }).drawer).toBe('codex');
    expect(() => parseArgs(['s.json', '--drawer', 'dalle'], {})).toThrow(/codex or gemini/);
    for (const bad of ['abc', '0', '-5']) expect(() => parseArgs(['s.json', '--timeout', bad])).toThrow(/positive/);
    expect(() => parseArgs(['s.json', '--timeout'])).toThrow(/positive/);
  });
});

describe('the reference', () => {
  test('a sheet gives its first frame, a sprite itself', () => {
    const oak = loadReference('props/tree_oak');
    expect([oak.width, oak.height]).toEqual([32, 32]);
    const sheet = PNG.sync.read(readFileSync(join(root, 'content/kit/core/props/tree_oak.png')));
    expect(oak.data.subarray(0, 32 * 4)).toEqual(sheet.data.subarray(0, 32 * 4));
    expect(() => loadReference('chars/nobody')).toThrow(/No core kit sprite/);
  });

  test('is enlarged with hard edges onto magenta with two art pixels of margin', () => {
    const ref = loadReference('chars/elder');
    const big = enlargeOnMagenta(ref);
    expect([big.width, big.height]).toEqual([20 * 16, 28 * 16]);
    expect([...big.data.subarray(0, 4)]).toEqual([255, 0, 255, 255]);
    // every opaque art pixel becomes a 16x16 block of its own colour
    for (let y = 0; y < ref.height; y += 1) {
      for (let x = 0; x < ref.width; x += 1) {
        const from = (y * ref.width + x) * 4;
        if ((ref.data[from + 3] ?? 0) < 128) continue;
        const to = (((y + 2) * 16 + 15) * big.width + (x + 2) * 16 + 15) * 4;
        expect([...big.data.subarray(to, to + 3)]).toEqual([...ref.data.subarray(from, from + 3)]);
      }
    }
  });
});

describe('the prompt', () => {
  test('carries the grid, the detail, magenta and the file', () => {
    const prompt = buildPrompt(elder, { width: 16, height: 24, data: Buffer.alloc(0) }, 'elder.png');
    expect(prompt).toContain('16x24 pixels');
    expect(prompt).toContain('32 pixels wide and 48 pixels tall');
    expect(prompt).toContain('with a belt and boots');
    expect(prompt).toContain('#FF00FF');
    expect(prompt).toContain('outline');
    expect(prompt).toContain('save it as elder.png');
  });

  test('an outside reference asks for our style, not a copy, and carries what was seen', () => {
    const tub: GenEntry = { ...elder, name: 'tub', ref: 'refs/tub.png', what: 'round wooden tub', seen: 'a round plum tub', confirmed_by: 'owner', palette: 'restyle' };
    const prompt = buildPrompt(tub, { width: 75, height: 69, data: Buffer.alloc(0) }, 'tub.png');
    expect(prompt).toContain('from outside our game');
    expect(prompt).toContain('seen as: a round plum tub');
    expect(prompt).toContain('not a copy');
    expect(prompt).toContain('restyled');
    expect(prompt).not.toContain('same colors');
  });

  test('ramps name the shared ramps a sprite imports in, and rich with none means all of them', () => {
    const tub: GenEntry = { ...elder, name: 'tub', ref: 'refs/tub.png', what: 'round wooden tub', seen: 'a round plum tub', confirmed_by: 'owner', palette: 'ramp-added', ramps: ['plum', 'wood'] };
    expect(importRamps(tub)).toEqual(['plum', 'wood']);
    expect(importPalette(tub)).toHaveLength(32 + 4 + 1);
    expect(importRamps({ style: 'rich' })).toEqual(CORE_RAMPS.map((r) => r.id));
    expect(importPalette({})).toEqual(CORE_PALETTE);
    expect(buildPrompt(tub, { width: 75, height: 69, data: Buffer.alloc(0) }, 'tub.png')).toContain('its plum, wood ramps');
    expect(() => parseSpec(spec([{ ...tub, ramps: ['neon'] }]))).toThrow(/not a shared ramp/);
    expect(() => parseSpec(spec([{ ...tub, ramps: ['plum', 'plum'] }]))).toThrow(/twice/);
    expect(() => parseSpec(spec([{ ...tub, ramps: ['plum', 'wood', 'bark', 'rust', 'moss'] }]))).toThrow(/one to four/);
    expect(() => parseSpec(spec([{ ...tub, palette: 'fits' }]))).toThrow(/ramp-added/);
    expect(parseSpec(spec([tub]))[0]?.ramps).toEqual(['plum', 'wood']);
  });

  test('style rich asks for painterly pixel art and points at the style examples', () => {
    const rich: GenEntry = { ...elder, name: 'tub', ref: 'refs/tub.png', what: 'round wooden tub', seen: 'a round plum tub', confirmed_by: 'owner', palette: 'ramp-added', style: 'rich', style_refs: ['refs/a.png', 'refs/b.png'] };
    const prompt = buildPrompt(rich, { width: 75, height: 69, data: Buffer.alloc(0) }, 'tub.png');
    expect(prompt).toContain('Painterly pixel art');
    expect(prompt).toContain('other attached images show');
    expect(prompt).not.toContain('two-tone');
    expect(buildPrompt(elder, { width: 16, height: 24, data: Buffer.alloc(0) }, 'elder.png')).toContain('two-tone');
    expect(() => parseSpec(spec([{ ...rich, style: 'fancy' }]))).toThrow(/style/);
    expect(() => parseSpec(spec([{ ...rich, style_refs: ['refs/a.jpg'] }]))).toThrow(/style_refs/);
  });

  test('a tile fills its square, repeats and has no outline', () => {
    const prompt = buildPrompt({ ...elder, kind: 'tile', width: 32, height: 32 }, { width: 16, height: 16, data: Buffer.alloc(0) }, 'grass.png');
    expect(prompt).toContain('No outline');
    expect(prompt).toContain('edge to edge');
    expect(prompt).toContain('without a seam');
  });
});

describe('a Codex run', () => {
  test('its tokens are read from the log', () => {
    expect(parseTokens('done\ntokens used\n27,868\n')).toBe(27868);
    expect(parseTokens('no count here')).toBeNull();
  });

  test('a drawing off its grid is flagged both ways', () => {
    expect(gridWarnings([20, 30], elder)[0]).toMatch(/coarser/);
    expect(gridWarnings([44, 66], elder)[0]).toMatch(/between one and two/);
    expect(gridWarnings([32, 72], elder)[0]).toMatch(/between one and two/);
    expect(gridWarnings([109, 191], elder)).toEqual([]);
    expect(gridWarnings([32, 47], elder)).toEqual([]);
  });

  test('its image is the file asked for, else the last one the log links to', () => {
    const work = mkdtempSync(join(scratch, 'work-'));
    const since = Date.now() - 1000;
    expect(findOutput(work, 'a.png', '', since)).toBeNull();
    const elsewhere = join(scratch, 'elsewhere.png');
    writeFileSync(elsewhere, 'x');
    expect(findOutput(work, 'a.png', `Saved to [a.png](${elsewhere}).`, since)).toBe(elsewhere);
    writeFileSync(join(work, 'a.png'), 'x');
    expect(findOutput(work, 'a.png', '', since)).toBe(join(work, 'a.png'));
    // an image older than the run is a leftover, not this run's
    utimesSync(join(work, 'a.png'), new Date(since - 60_000), new Date(since - 60_000));
    utimesSync(elsewhere, new Date(since - 60_000), new Date(since - 60_000));
    expect(findOutput(work, 'a.png', `[a.png](${elsewhere})`, since)).toBeNull();
  });
});

describe('a ground tile', () => {
  const green = [6, 7, 8, 9];

  /** A picture of `cells` drawn `pitch` image pixels each, on magenta, with a little noise. */
  function drawn(cells: readonly number[], size: number, pitch: number): Buffer {
    const picture = new PNG({ width: 440, height: 420 });
    for (let y = 0; y < picture.height; y += 1) {
      for (let x = 0; x < picture.width; x += 1) {
        const cx = Math.floor((x - 50) / pitch);
        const cy = Math.floor((y - 60) / pitch);
        const inside = cx >= 0 && cy >= 0 && cx < size && cy < size;
        const [r, g, b] = inside ? hexToRgb(CORE_PALETTE[cells[cy * size + cx] ?? 0] ?? '#000000') : [255, 0, 255];
        const n = (x * 31 + y * 17) % 9 - 4;
        picture.data.set([r, g, b].map((v) => Math.max(0, Math.min(255, v + n))).concat(255), (y * picture.width + x) * 4);
      }
    }
    return PNG.sync.write(picture);
  }

  function colorsOf(png: Buffer): number[][] {
    const tile = PNG.sync.read(png);
    return Array.from({ length: tile.width * tile.height }, (_, i) => [...tile.data.subarray(i * 4, i * 4 + 4)]);
  }

  const pattern = Array.from({ length: 64 }, (_, i) => green[(i * 7 + Math.floor(i / 8)) % 4] ?? 8);
  const expected = pattern.map((p) => [...hexToRgb(CORE_PALETTE[p] ?? '#000000'), 255]);

  test('is cropped from the magenta and read on its own grid, a pitch of no whole pixels', () => {
    const tile = importTile(drawn(pattern, 8, 37.5), 8, 8);
    expect(tile.logical).toEqual([8, 8]);
    expect(colorsOf(tile.png)).toEqual(expected);
  });

  test('the finest count that fits wins over its half', () => {
    const random = Array.from({ length: 256 }, (_, i) => green[(Math.imul(i + 1, 2654435761) >>> 16) % 4] ?? 8);
    const tile = importTile(drawn(random, 16, 18.75), 16, 16);
    expect(tile.logical).toEqual([16, 16]);
    expect(colorsOf(tile.png)).toEqual(random.map((p) => [...hexToRgb(CORE_PALETTE[p] ?? '#000000'), 255]));
  });

  test('a drawing finer than asked is voted down', () => {
    // each art pixel of the pattern drawn as 2x2, one of the four in another green
    const fine = Array.from({ length: 256 }, (_, i) => {
      const [x, y] = [i % 16, Math.floor(i / 16)];
      const base = pattern[Math.floor(y / 2) * 8 + Math.floor(x / 2)] ?? 8;
      return x % 2 === 1 && y % 2 === 1 ? (base === 9 ? 6 : 9) : base;
    });
    expect(colorsOf(importTile(drawn(fine, 16, 18.75), 8, 8).png)).toEqual(expected);
  });

  test('a transparent ground counts as no drawing, as magenta does', () => {
    const picture = PNG.sync.read(drawn(pattern, 8, 37.5));
    for (let i = 0; i < picture.width * picture.height; i += 1) {
      const o = i * 4;
      if ((picture.data[o] ?? 0) > 200 && (picture.data[o + 1] ?? 0) < 20) picture.data.set([0, 0, 0, 0], o);
    }
    expect(colorsOf(importTile(PNG.sync.write(picture), 8, 8).png)).toEqual(expected);
  });

  test('a picture of nothing but magenta is refused', () => {
    const empty = new PNG({ width: 40, height: 40 });
    for (let i = 0; i < 40 * 40; i += 1) empty.data.set([255, 0, 255, 255], i * 4);
    expect(() => importTile(PNG.sync.write(empty), 8, 8)).toThrow(/nothing/);
  });
});

describe('the gallery', () => {
  const line = (over: Partial<ManifestLine>): ManifestLine => ({
    name: 'elder', spec: 'tools/kit-gen/trial-32.json', ref: 'chars/elder', refSize: [16, 24], kind: 'sprite',
    width: 32, height: 48, prompt: 'p', codex: null, raw: null, out: null, grid: null, logical: null, colors: null,
    warnings: [], error: null, at: '2026-10-18T00:00:00.000Z', ...over,
  });

  test('shows the latest image of each name, its warnings and its failures', () => {
    const html = galleryHtml([
      line({ error: 'Codex saved no image' }),
      line({ raw: 'raw/elder-1.png', out: 'elder.png', logical: [20, 30], grid: 30, colors: 12, warnings: ['drawn on a coarser grid'] }),
      line({ name: 'grass', kind: 'tile', ref: 'tiles/grass', refSize: [16, 16], width: 32, height: 32, error: 'import: <bad>' }),
    ]);
    expect(html).toContain('src="elder.png"');
    expect(html).not.toContain('Codex saved no image');
    expect(html).toContain('drawn on a coarser grid');
    expect(html).toContain('style="width:96px"');
    expect(html).toContain('import: &lt;bad&gt;');
  });
});
