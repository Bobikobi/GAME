import { PNG } from 'pngjs';
import { describe, expect, test } from 'vitest';

import { assemble } from '../src/assemble.js';
import { readBoard } from '../src/board.js';
import { checkColors, median, pngColors, spriteColors, tileColorCounts, windowColors } from '../src/colors.js';
import { loadAll } from '../src/load.js';

/**
 * ART_SYSTEM section 3 and the 20.10 finding: a study's water held 8 colours per 64 px tile
 * against a reference's 41 to 44, and nothing in the repository could see the difference.
 * These are the numbers that make it visible, measured on the art itself.
 */
const assembled = () => assemble(loadAll().files, readBoard());

describe('reading colours off the art', () => {
  test('a PNG reports the colours it draws with and ignores the clear pixels', () => {
    const png = { width: 4, height: 1, data: Buffer.from([
      27, 26, 46, 255,
      27, 26, 46, 255,
      245, 244, 239, 255,
      0, 0, 0, 0,
    ]) } as PNG;
    expect([...pngColors(png)]).toEqual(['#1b1a2e', '#f5f4ef']);
  });

  test('the median takes the middle value, and rounds up in an even list', () => {
    expect(median([5, 1, 3])).toBe(3);
    expect(median([4, 1, 3, 9])).toBe(4);
    expect(median([])).toBe(0);
  });
});

describe('the colours today art carries', () => {
  test('every sprite of every kit decodes to a colour set', () => {
    const a = assembled();
    const colors = spriteColors(a);
    expect(colors.size).toBe(Object.values(a.kits).reduce((n, k) => n + Object.keys(k.sprites).length, 0));
    for (const set of colors.values()) expect(set.size).toBeGreaterThan(0);
  });

  test('tile colours are counted per sprite, the shop floor and the valley ground at 64 px', () => {
    const a = assembled();
    const tiles = tileColorCounts(a);
    expect(tiles.length).toBeGreaterThan(0);
    expect(tiles.every((t) => t.colors >= 1)).toBe(true);
    const rich = tiles.filter((t) => t.density === 4).map((t) => t.ref);
    expect(rich).toEqual(expect.arrayContaining(['core/base-kit:tiles/planks', 'core/base-kit:tiles/planks_1', 'core/base-kit:tiles/planks_2', 'core/base-kit:tiles/grass']));
  });

  test('a phone window counts the colours its ground and props carry together', () => {
    const a = assembled();
    const colors = spriteColors(a);
    const windows = windowColors(a.bundle!, colors);
    expect(windows.length).toBeGreaterThan(0);
    for (const w of windows) {
      expect(w.colors).toBeGreaterThan(0);
      expect(w.colors).toBeLessThanOrEqual(colors.size * 40);
    }
  });

  test('the check reports the two measures and never an error', () => {
    const lines = checkColors(assembled());
    expect(lines.map((l) => l.where)).toEqual(['art.tileColors', 'art.windowColors']);
    expect(lines.every((l) => l.level === 'warning')).toBe(true);
    expect(lines[0]!.message).toContain('colours per tile sprite');
    expect(lines[1]!.message).toContain('colours per phone window');
  });
});
