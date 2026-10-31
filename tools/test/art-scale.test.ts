import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import { describe, expect, test } from 'vitest';

import { runCheck } from '../src/check.js';
import { ADULT_SPRITE, counts, declareScales, distanceOf, drawnHeight, isAdvisory, knownShort, measureKits, opaqueHeight, rangeOf, renderScale, verdictOf } from '../src/art/scale.js';
import { scaleKindOf } from '../src/kit/scale.js';
import { CONTENT_DIR } from '../src/load.js';

/** A sheet of `frames` frames, each `w` wide and `h` tall, with a solid column `rows` tall standing on the bottom of frame f. */
function sheet(w: number, h: number, rows: readonly number[]): PNG {
  const png = new PNG({ width: w * rows.length, height: h });
  rows.forEach((r, f) => {
    for (let y = h - r; y < h; y++) png.data.set([200, 100, 50, 255], (y * png.width + f * w + 1) * 4);
  });
  return png;
}

describe('the drawn height', () => {
  test('is the opaque box of a frame, not the canvas', () => {
    const png = sheet(4, 10, [6, 3]);
    expect(opaqueHeight(png, 4, 0)).toBe(6);
    expect(opaqueHeight(png, 4, 1)).toBe(3);
  });

  test('of a sheet is its tallest frame, and an empty frame does not count', () => {
    expect(drawnHeight(sheet(4, 10, [6, 3, 8, 0]), 4, 4)).toBe(8);
    expect(drawnHeight(sheet(4, 10, [0]), 4, 1)).toBe(0);
  });

  test('half transparent pixels are not solid', () => {
    const png = new PNG({ width: 2, height: 4 });
    png.data.set([1, 2, 3, 127], 0);
    expect(opaqueHeight(png, 2, 0)).toBe(0);
  });
});

describe('the verdict', () => {
  const door = rangeOf(scaleKindOf('props/door_front'));
  const oak = rangeOf(scaleKindOf('props/tree_oak'));

  test('under, in range and over for a kind with a range', () => {
    expect([1.1, 1.2, 1.4, 1.6].map((c) => verdictOf(c, door))).toEqual(['under', 'in range', 'in range', 'over']);
    expect(distanceOf(1.1, door)).toBeCloseTo(0.07);
    expect(distanceOf(1.7, door)).toBeCloseTo(0.2);
    expect(distanceOf(1.4, door)).toBe(0);
  });

  test('a floor with no top is never over', () => {
    expect(verdictOf(12, oak)).toBe('in range');
    expect(verdictOf(2.7, oak)).toBe('in range');
    expect(verdictOf(2.6, oak)).toBe('under');
  });

  test('a kind no page speaks for says no rule and is never out', () => {
    const none = rangeOf(scaleKindOf('props/chest'));
    expect(verdictOf(0.1, none)).toBe('no rule');
    expect(distanceOf(0.1, none)).toBe(0);
  });
});

describe('the shipped kits', () => {
  const { adultPx, rows } = measureKits();

  test('the adult is measured on the human, not assumed', () => {
    expect(ADULT_SPRITE).toBe('chars/human_down');
    expect(adultPx).toBeGreaterThan(60);
    expect(adultPx).toBeLessThan(96);
    expect(rows.find((r) => r.name === ADULT_SPRITE)?.chars).toBe(1);
  });

  test('every world sprite declares its scale, and the declaration is the measure', () => {
    const declared = new Map<string, number | undefined>();
    for (const id of ['core', 'ceosisrael']) {
      const kit = JSON.parse(readFileSync(join(CONTENT_DIR, 'kit', id, 'kit.json'), 'utf8')) as { kit: { sprites: Record<string, { scale?: number }> } };
      for (const [name, s] of Object.entries(kit.kit.sprites)) declared.set(`${id}:${name}`, s.scale);
    }
    for (const r of rows) expect(declared.get(`${r.kit}:${r.name}`), r.name).toBe(r.chars);
  });

  test('ground tiles and inventory icons are not measured', () => {
    expect(rows.some((r) => r.name.startsWith('tiles/') || r.name.startsWith('items/'))).toBe(false);
  });

  test('the rows are worst first and the counts add up', () => {
    const outs = rows.map((r) => r.out);
    expect(outs).toEqual([...outs].sort((a, b) => b - a));
    const c = counts(rows);
    expect(c.under + c.over + c['in range'] + c['no rule']).toBe(rows.length);
  });

  test('the page names the counts and every sprite', () => {
    const page = renderScale(rows, adultPx, adultPx / 4);
    expect(page).toContain(`${rows.length} sprites`);
    expect(page).toContain('| `props/tree_oak` |');
  });
});

describe('declaring', () => {
  test('writes the measure on a sprite with none and leaves a declared one alone', () => {
    const root = mkdtempSync(join(tmpdir(), 'scale-'));
    cpSync(join(CONTENT_DIR, 'kit'), root, { recursive: true });
    const path = join(root, 'core', 'kit.json');
    const kit = JSON.parse(readFileSync(path, 'utf8')) as { kit: { sprites: Record<string, { scale?: number }> } };
    delete kit.kit.sprites['props/chest']!.scale;
    kit.kit.sprites['props/fence']!.scale = 9;
    writeFileSync(path, `${JSON.stringify(kit, null, 2)}\n`);
    const names = declareScales(root);
    expect(names).toEqual(['core:props/chest']);
    const after = JSON.parse(readFileSync(path, 'utf8')) as typeof kit;
    expect(after.kit.sprites['props/chest']!.scale).toBe(measureKits(root).rows.find((r) => r.name === 'props/chest')!.chars);
    expect(after.kit.sprites['props/fence']!.scale).toBe(9);
  });
});

describe('the known-short list', () => {
  const issues = runCheck().issues.filter((i) => i.where.startsWith('art.scale.'));

  test('every sprite the check finds short is on the list, and every sprite on the list is still short', () => {
    expect(issues.map((i) => i.where.slice('art.scale.'.length)).sort()).toEqual(Object.keys(knownShort()).sort());
  });

  test('a short sprite on the list is advisory; one that is not on it fails the content tests', () => {
    expect(isAdvisory({ where: 'art.scale.core/base-kit:chars/skeleton_down' })).toBe(true);
    expect(isAdvisory({ where: 'art.scale.core/base-kit:props/well_old' })).toBe(false);
    expect(isAdvisory({ where: 'art.scale.core/base-kit:props/new_oak' })).toBe(false);
    expect(isAdvisory({ where: 'kit.sprites.props/chest' })).toBe(false);
    expect(isAdvisory({ where: 'art.ink16' })).toBe(true);
  });

  test('every entry names the stream that owns it', () => {
    for (const [name, stream] of Object.entries(knownShort())) expect(stream.length, name).toBeGreaterThan(5);
  });
});
