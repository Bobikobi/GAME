import { PNG } from 'pngjs';
import { describe, expect, test } from 'vitest';

import { INK_HEX, applyInk, inkShare, inkSprites } from '../src/kit/ink.js';
import { CORE_PALETTE, hexToRgb } from '../src/kit/palette.js';
import { INK_MIN_SHARE, checkInk } from '../src/ink-check.js';
import type { Assembled } from '../src/assemble.js';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const GREEN: readonly number[] = [76, 154, 63, 255];
const INK = hexToRgb(INK_HEX);

/** Two frames of 5x5: a 3x3 block in the first, a block touching both frame borders in the second. */
function sprite(): Buffer {
  const png = new PNG({ width: 10, height: 5 });
  // frame 0: a 3x3 green block at (1,1); frame 1: green from x=5..9 (touches both frame borders), rows 1..3
  for (let y = 0; y < 5; y++) {
    for (let x = 0; x < 10; x++) {
      const inA = x >= 1 && x <= 3 && y >= 1 && y <= 3;
      const inB = x >= 5 && y >= 1 && y <= 3;
      const i = (y * 10 + x) * 4;
      if (inA || inB) png.data.set(GREEN, i);
    }
  }
  return PNG.sync.write(png);
}
const px = (buf: Buffer, x: number, y: number) => {
  const p = PNG.sync.read(buf);
  const i = (y * p.width + x) * 4;
  return [...p.data.subarray(i, i + 4)];
};

describe('the ink edge', () => {
  test('the ink is the core palette outline colour', () => {
    expect(INK_HEX).toBe('#1b1a2e');
    expect(INK_HEX).toBe(CORE_PALETTE[0]);
  });

  test('edge pixels turn ink, the interior and the clear pixels stay', () => {
    const out = applyInk(sprite(), 5);
    expect(px(out, 1, 1)).toEqual([...INK, 255]);
    expect(px(out, 2, 1)).toEqual([...INK, 255]);
    expect(px(out, 2, 2)).toEqual([...GREEN]);
    expect(px(out, 0, 0)).toEqual([0, 0, 0, 0]);
    expect(PNG.sync.read(out).width).toBe(10);
  });

  test('a frame border counts as outside, and a neighbour frame does not fill it', () => {
    const out = applyInk(sprite(), 5);
    // frame 1 starts at x=5: its left column and its right border column are edge, the middle row interior stays
    expect(px(out, 5, 2)).toEqual([...INK, 255]);
    expect(px(out, 9, 2)).toEqual([...INK, 255]);
    expect(px(out, 7, 2)).toEqual([...GREEN]);
  });

  test('it is idempotent', () => {
    const once = applyInk(sprite(), 5);
    expect(PNG.sync.read(applyInk(once, 5)).data.equals(PNG.sync.read(once).data)).toBe(true);
  });

  test('the measure is the share of edge pixels that are ink', () => {
    expect(inkShare(sprite(), 5)).toBe(0);
    expect(inkShare(applyInk(sprite(), 5), 5)).toBe(1);
    expect(inkShare(PNG.sync.write(new PNG({ width: 4, height: 4 })), 4)).toBe(1);
  });

  test('a frame width that does not divide the image is refused', () => {
    expect(() => applyInk(sprite(), 3)).toThrow();
  });
});

describe('the ink check', () => {
  const kitWith = (file: Buffer, density: 1 | 4, name = 'props/x'): Assembled => {
    const dir = mkdtempSync(join(tmpdir(), 'ink-'));
    writeFileSync(join(dir, 'x.png'), file);
    return { kits: { core: { dir, rel: '', sprites: { [name]: { file: 'x.png', w: 5, h: 5, frames: 2, density } } } } } as unknown as Assembled;
  };

  test('a 64 px sprite with a non-ink edge is an error naming it and its share, and passes after the pass', () => {
    const bad = checkInk(kitWith(sprite(), 4));
    expect(bad).toHaveLength(1);
    expect(bad[0]!.level).toBe('error');
    expect(bad[0]!.where).toContain('props/x');
    expect(bad[0]!.message).toContain('0%');
    expect(INK_MIN_SHARE).toBe(0.95);
    expect(checkInk(kitWith(applyInk(sprite(), 5), 4))).toEqual([]);
  });

  test('animals wear no outline: the creatures group is not measured, and kit:ink leaves it alone', () => {
    expect(checkInk(kitWith(sprite(), 4, 'creatures/roe'))).toEqual([]);
    expect(inkSprites({ 'creatures/roe': { file: 'x.png', w: 5, density: 4 }, 'props/x': { file: 'y.png', w: 5, density: 4 } }).map(([n]) => n)).toEqual(['props/x']);
  });

  test('ground tiles are not measured, and 16 px sprites give one warning', () => {
    expect(checkInk(kitWith(sprite(), 4, 'tiles/grass'))).toEqual([]);
    const thin = checkInk(kitWith(sprite(), 1));
    expect(thin).toHaveLength(1);
    expect(thin[0]!.level).toBe('warning');
  });
});
