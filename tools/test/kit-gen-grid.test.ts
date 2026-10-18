import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'vitest';

import { parseSpec } from '../src/kit/gen.js';
import { colourCount, gridPrompt, parseGrid, pngToGrid, renderGrid, seamWarnings } from '../src/kit/gengrid.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const plain = (w: number, h: number): string[] => Array.from({ length: h }, () => 'c'.repeat(w));

describe('the text-grid route', () => {
  test('a grid parses through fences and prose, and renders in the palette', () => {
    const rows = plain(8, 8);
    rows[3] = 'ccceccce';
    const text = `Here it is:\n\`\`\`\n${rows.join('\n')}\n\`\`\`\n`;
    const grid = parseGrid(text, 8, 8);
    expect(grid).toEqual(rows);
    const png = renderGrid(grid);
    expect([png.width, png.height]).toEqual([8, 8]);
    expect([...png.data.slice(0, 4)]).toEqual([0x4c, 0x9a, 0x3f, 255]);
  });

  test('a wrong size or a letter outside the palette is refused with where', () => {
    expect(() => parseGrid(plain(8, 7).join('\n'), 8, 8)).toThrow('7 rows, not 8');
    expect(() => parseGrid([...plain(10, 7), 'ccccccccc'].join('\n'), 10, 8)).toThrow('row 7 has 9 letters');
    expect(() => parseGrid([...plain(10, 7), 'cccccccccp'].join('\n'), 10, 8)).toThrow('"p" is not a palette letter');
  });

  test('a flat tile has no seam', () => {
    expect(seamWarnings(plain(16, 16))).toEqual([]);
  });

  test('a hard seam across the wrap is a warning', () => {
    // left column all one colour, right column all another, the inside smooth
    const rows = Array.from({ length: 16 }, () => `e${'c'.repeat(14)}b`);
    expect(seamWarnings(rows).some((w) => w.includes('left and right'))).toBe(true);
  });

  test('colours are counted, and the kit tile reads back as letters', () => {
    expect(colourCount(['cce', 'bcc'])).toBe(3);
    const png = renderGrid(['cceb', 'bccc']);
    expect(pngToGrid(png)).toEqual(['cceb', 'bccc']);
  });

  test('the prompt asks for text, spells the size, the palette and the wrap, and shows the style', () => {
    const p = gridPrompt({ what: 'sand ground tile', width: 32, height: 32, detail: 'ripples', reference: ['yy', 'yx'], file: 'sand_1.txt' });
    expect(p).toContain('Do not generate an image');
    expect(p).toContain('exactly 32 lines of exactly 32 letters');
    expect(p).toContain('y #ebd3a2');
    expect(p).toContain('left column continues its right column');
    expect(p).toContain('yy\nyx');
  });

  test('the ground spec reads, every entry is a grid tile', () => {
    const entries = parseSpec(readFileSync(join(root, 'tools/kit-gen/ground-32.json'), 'utf8'));
    expect(entries).toHaveLength(12);
    expect(entries.every((e) => e.route === 'grid' && e.kind === 'tile' && e.width === 32 && e.height === 32)).toBe(true);
  });

  test('a grid route needs a tile', () => {
    const bad = JSON.stringify({ entries: [{ name: 'a', ref: 'tiles/grass', what: 'x', width: 32, height: 32, route: 'grid' }] });
    expect(() => parseSpec(bad)).toThrow('route grid is for tiles');
  });
});
