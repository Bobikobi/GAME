/**
 * The races' walk sheets in content/kit/core/chars (pnpm anim sheets): the clothed-width rule on the committed pictures,
 * the stride rule of the kit check, and the pieces the sheets are made of.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import { describe, expect, test } from 'vitest';

import { readSettings } from '../src/anim/clip';
import { plantSlide, widestRow } from '../src/anim/measure';
import { characterCredits, SHEET_DIR, sheetWidth, widthProblems } from '../src/anim/sheets';
import { strideProblem } from '../src/check';

const settings = readSettings();
const sheets = Object.values(settings.targets).flatMap((t) => (t.ships ? [t.ships.sheet] : []));

describe('the clothed width of the races', () => {
  test('every shipped sheet is committed, 128x128 frames with the standing frame last', () => {
    for (const sheet of sheets) {
      for (const view of ['down', 'up', 'left']) {
        const path = join(SHEET_DIR, `${sheet}_${view}.png`);
        expect(existsSync(path), path).toBe(true);
        const png = PNG.sync.read(readFileSync(path));
        expect(png.height).toBe(settings.frame.size[1]);
        expect(png.width % settings.frame.size[0]).toBe(0);
        expect(png.width / settings.frame.size[0]).toBeLessThanOrEqual(16);
      }
    }
  });

  test('the elf, man and woman, is at most 80 percent as wide as the human man through the walk', () => {
    const widths: Record<string, number> = {};
    for (const sheet of sheets) widths[`${sheet}_down`] = sheetWidth(join(SHEET_DIR, `${sheet}_down.png`), settings.frame.size[0]);
    expect(settings.clothed_width.pairs.length).toBeGreaterThan(0);
    expect(widthProblems(widths, settings.clothed_width)).toEqual([]);
    // the skeleton is the smallest of the three
    expect(widths.skeleton_down).toBeLessThan(widths.elf_down as number);
  });

  test('the rule names the failing pair', () => {
    const rule = { max_pct: 80, pairs: [['elf', 'human']] as [string, string][] };
    expect(widthProblems({ elf_down: 30, human_down: 36 }, rule)).toHaveLength(1);
    expect(widthProblems({ elf_down: 28, human_down: 36 }, rule)).toEqual([]);
  });

  test('the widest row counts from the first to the last solid pixel of a row', () => {
    const data = new Uint8Array(8 * 3 * 4);
    for (const [x, y] of [[1, 0], [4, 0], [2, 1], [3, 1]] as const) data[(y * 8 + x) * 4 + 3] = 255;
    expect(widestRow({ width: 8, height: 3, data })).toBe(4);
  });
});

describe('the stride of a sheet', () => {
  const ok = { w: 128, h: 128, frames: 16, stride: { travel_mpx: 14000, anchor: [64, 90] } };
  test('holds a ground point at the middle of the frame and inside it, and at least two poses and the standing frame', () => {
    expect(strideProblem(ok)).toBeUndefined();
    expect(strideProblem({ ...ok, frames: 2 })).toContain('3 frames');
    expect(strideProblem({ ...ok, stride: { travel_mpx: 14000, anchor: [60, 90] } })).toContain('middle');
    expect(strideProblem({ ...ok, stride: { travel_mpx: 14000, anchor: [64, 200] } })).toContain('anchor y');
    expect(strideProblem({ w: 64, h: 64, frames: 1 })).toBeUndefined();
  });

  test('a planted foot is on the ground at the pose instants and a half pose off between them', () => {
    // one foot planted in poses 14, 0 and 1 (a run across the end of the cycle) walking 10 px a pose, the foot moving -10 px a pose
    const plants = [{ foot: 'Left', poses: [14, 0, 1], ys: [100, 90, 80], icpt: 100 }];
    expect(plantSlide(plants, -10, 15, 14, 14)).toBe(0);
    expect(plantSlide(plants, -10, 15, 0, 15)).toBe(0);
    expect(plantSlide(plants, -10, 15, 1, 16)).toBe(0);
    expect(plantSlide(plants, -10, 15, 0, 15.4)).toBeCloseTo(4, 5);
    expect(plantSlide(plants, -10, 15, 5, 5)).toBeUndefined();
  });
});

describe('the credits of the characters', () => {
  test('every race that ships has its credit line, with the licence of the model it starts from', () => {
    const lines = characterCredits(settings);
    expect(lines.join('\n')).toContain('CC BY 4.0');
    expect(lines.join('\n')).toContain('CC BY 3.0');
    expect(lines.filter((l) => l.startsWith('- Skeleton')).length).toBe(1);
    expect(lines.filter((l) => l.startsWith('- Human')).length).toBe(2);
    expect(lines.filter((l) => l.startsWith('- Elf')).length).toBe(1);
  });
});
