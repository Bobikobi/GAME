import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'vitest';

import { entryMatches, parseSpec } from '../src/kit/gen.js';
import {
  type Motif, type Scatter, bandShare, fieldTiles, hash, motifPrompt, motifWarnings, parseMotif, place, render, renderMotif,
  repeatedTiles, rowWarnings, scatterProblem, scatterTile, tileWarnings, variantsOf, wrapsExactly,
} from '../src/kit/scatter.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const tuft: Motif = {
  name: 'tuft', weight: 6,
  grid: ['....e....', '...e.e...', '..ef.fe..', '.ee.f.ee.', '.e.efe.e.', '...bbb...'],
};
const flower: Motif = { name: 'flower', weight: 1, grid: ['.WW.', 'WIIW', '.Wb.', '..b.'] };
const pebble: Motif = { name: 'pebble', weight: 2, grid: ['.xx.', 'xwww', 'uuuu'] };

const meadow = (seed = 'meadow'): Scatter => ({
  base: 'c', cell: 16, chance: 0.85, tile: 64, seed, motifs: [tuft, flower, pebble],
  speckles: [{ letter: 'b', per_tile: 30 }, { letter: 'e', per_tile: 12 }],
});

describe('a motif', () => {
  test('is read through fences, with dots for clear pixels', () => {
    const grid = parseMotif('```\n.ee.\ne..e\n```\n', 4, 2);
    expect(grid).toEqual(['.ee.', 'e..e']);
    const png = renderMotif(grid);
    expect([...png.data.slice(0, 4)]).toEqual([0, 0, 0, 0]);
    expect(png.data[7]).toBe(255);
  });

  test('a wrong size, a stray word, a letter outside the palette or an empty frame is refused', () => {
    expect(() => parseMotif('.e.\n', 3, 2)).toThrow('1 rows, not 2');
    expect(() => parseMotif('.e.\n.ee.', 3, 2)).toThrow('row 1 has 4');
    expect(() => parseMotif('Done!\n.e.', 3, 2)).toThrow('row 0 has 5');
    expect(() => parseMotif('.p.\n...', 3, 2)).toThrow('"p" is neither');
    expect(() => parseMotif('...\n...', 3, 2)).toThrow('empty');
  });

  test('a blob or a flat one is a warning', () => {
    expect(motifWarnings(['ee', 'ee']).join()).toContain('blob');
    expect(motifWarnings(['.e.', '...', '...', '...']).join()).toContain('one colour');
    expect(motifWarnings(tuft.grid)).toEqual([]);
  });

  test('the prompt asks for text with dots, spells the size and the ground it lies on', () => {
    const p = motifPrompt({ what: 'a tuft of grass', width: 9, height: 11, detail: 'blades', base: 'c', file: 'meadow_tuft.txt' });
    expect(p).toContain('Do not generate an image');
    expect(p).toContain('exactly 11 lines of exactly 9 characters');
    expect(p).toContain('A dot (.) is a clear pixel');
    expect(p).toContain('ground under it is c #4c9a3f');
    expect(p).toContain('It has blades.');
  });
});

describe('the field', () => {
  test('is the same for the same seed and different for another', () => {
    expect(scatterTile(meadow())).toEqual(scatterTile(meadow()));
    expect(scatterTile(meadow('a'))).not.toEqual(scatterTile(meadow('b')));
    expect(hash(1, 2, 3, 4)).toBe(hash(1, 2, 3, 4));
    expect(hash(1, 2, 3, 4)).not.toBe(hash(1, 2, 3, 5));
  });

  test('a tile wraps: motifs cross its edges and no seam shows', () => {
    const s = meadow();
    const placed = place(s, 0, 0, 64, 64, 64);
    expect(placed.some((p) => p.x < 0 || p.y < 0 || p.x + (p.motif.grid[0]?.length ?? 0) > 64 || p.y + p.motif.grid.length > 64)).toBe(true);
    expect(wrapsExactly(s)).toBe(true);
    expect(wrapsExactly({ ...s, tile: 64, seed: 'other' })).toBe(true);
  });

  test('a tile is the same field as the infinite one shifted by its period', () => {
    const s = meadow();
    const tile = render(s, 0, 0, 64, 64, 64);
    // the open field differs from the tile only where the wrap folds a motif back or a motif near the edge is cut
    const open = render(s, 0, 0, 64, 64, null);
    let same = 0;
    tile.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === open[y]?.[x]) same += 1; }));
    expect(same / 4096).toBeGreaterThan(0.9);
  });

  test('has about the asked number of motifs and they are not in rows', () => {
    const s = meadow();
    for (const seed of ['a', 'b', 'c', 'd', 'e', 'f']) {
      const placed = place({ ...s, seed }, 0, 0, 64, 64, 64);
      expect(placed.length).toBeGreaterThanOrEqual(8);
      expect(placed.length).toBeLessThanOrEqual(16);
      expect(rowWarnings(placed, 64)).toEqual([]);
    }
  });

  test('a row of motifs is caught', () => {
    const rowed = Array.from({ length: 8 }, (_, i) => ({ x: i * 8, y: 20 + (i % 2), motif: tuft, flip: false }));
    expect(rowWarnings(rowed, 64).join()).toContain('in rows');
    expect(bandShare([5, 6, 40], 64, 2)).toBeCloseTo(2 / 3);
    expect(bandShare([63, 0, 30], 64, 2)).toBeCloseTo(2 / 3);
  });

  test('a tile uses at least five colours and the variants differ', () => {
    const s = meadow();
    expect(repeatedTiles(variantsOf(s, 4).map(scatterTile))).toBe(0);
    expect(tileWarnings(s, 4, null)).toEqual([]);
    const flat = tileWarnings({ ...s, motifs: [{ ...tuft, grid: ['ee', 'ce'] }], speckles: [], chance: 0.01 }, 1, null);
    expect(flat.join()).toContain('colours');
  });

  test('no two tiles of a phone frame are pixel-identical', () => {
    const tiles = fieldTiles(meadow(), 23, 49);
    expect(tiles).toHaveLength(23 * 49);
    expect(repeatedTiles(tiles)).toBe(0);
    expect(repeatedTiles([tiles[0] ?? [], tiles[0] ?? []])).toBe(1);
  });
});

describe('the spec', () => {
  const ground = { name: 'meadow', ref: 'tiles/grass', what: 'meadow', kind: 'tile', route: 'scatter', width: 64, height: 64, base: 'c', motifs: [{ name: 'tuft', what: 't', width: 9, height: 11 }] };

  test('the 64 px ground spec reads, and its grounds are scatter tiles with references in the kit', () => {
    const entries = parseSpec(readFileSync(join(root, 'tools/kit-gen/ground-64.json'), 'utf8'));
    expect(entries.map((e) => e.name)).toEqual(['meadow', 'meadow_dry', 'meadow_lush', 'flowers', 'sand', 'path', 'cobble', 'ruin_floor', 'forest', 'grove']);
    expect(entries.every((e) => e.route === 'scatter' && e.kind === 'tile' && e.width === 64)).toBe(true);
  });

  test.each([
    [{ ...ground, kind: 'sprite' }, /is for tiles/],
    [{ ...ground, base: 'p' }, /base must be a palette letter/],
    [{ ...ground, motifs: [] }, /non-empty/],
    [{ ...ground, motifs: [{ name: 'a', what: 't', width: 17, height: 4 }] }, /16 px cell/],
    [{ ...ground, motifs: [ground.motifs[0], ground.motifs[0]] }, /twice/],
    [{ ...ground, cell: 10 }, /must divide/],
    [{ ...ground, chance: 0 }, /chance/],
    [{ ...ground, variants: 0 }, /variants/],
    [{ ...ground, speckles: [{ letter: 'p', per_tile: 3 }] }, /speckle needs a palette letter/],
    [{ ...ground, height: 32 }, /square/],
  ])('refuses a wrong entry %#', (entry, message) => {
    expect(() => parseSpec(JSON.stringify({ entries: [entry] }))).toThrow(message);
  });

  test('a good entry has no problem, and --only names an entry or one of its motifs', () => {
    expect(scatterProblem(ground)).toBeNull();
    const [entry] = parseSpec(JSON.stringify({ entries: [ground] }));
    if (entry === undefined) throw new Error('no entry');
    expect(entryMatches(entry, null)).toBe(true);
    expect(entryMatches(entry, new Set(['meadow']))).toBe(true);
    expect(entryMatches(entry, new Set(['meadow_tuft']))).toBe(true);
    expect(entryMatches(entry, new Set(['sand']))).toBe(false);
  });
});
