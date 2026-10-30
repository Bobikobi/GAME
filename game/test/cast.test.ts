import { describe, expect, test } from 'vitest';

import { SUN_TODAY, downsampleAlpha, footRows, maskOfAlpha, mirrorMask, shadowBox, shadowOf, sunAt, sunKey, sunTableOf } from '../src/cast.js';

/**
 * STYLE section 4, the shadow the owner picked on 18.10: the caster's silhouette laid on
 * the ground and sheared away from the sun, long in the morning and evening, short at noon,
 * and nothing at night. The numbers here are the sun's table, not a formula in the scene.
 */
describe('the sun', () => {
  test('is up from 06:00 to 18:00 and down outside those hours', () => {
    expect(sunAt(SUN_TODAY, 6 * 60).up).toBe(true);
    expect(sunAt(SUN_TODAY, 18 * 60).up).toBe(false);
    expect(sunAt(SUN_TODAY, 19 * 60).up).toBe(false);
    expect(sunAt(SUN_TODAY, 5 * 60).up).toBe(false);
  });

  test('points left in the morning, straight back at noon, right in the evening', () => {
    expect(sunAt(SUN_TODAY, 8 * 60).sx).toBeLessThan(0);
    expect(sunAt(SUN_TODAY, 12 * 60).sx).toBeCloseTo(0, 6);
    expect(sunAt(SUN_TODAY, 16 * 60 + 30).sx).toBeGreaterThan(0);
  });

  test('falls away from the viewer all day: the sun stands south (GK2 B)', () => {
    for (const minute of [6 * 60, 8 * 60, 12 * 60, 16 * 60 + 30, 17 * 60]) {
      expect(sunAt(SUN_TODAY, minute).sy).toBeLessThan(0);
    }
  });

  test('is long at 08:00 and 16:30 and short at noon, within the decided range', () => {
    expect(sunAt(SUN_TODAY, 8 * 60).length).toBeCloseTo(0.936, 3);
    expect(sunAt(SUN_TODAY, 16 * 60 + 30).length).toBeCloseTo(1.099, 3);
    expect(sunAt(SUN_TODAY, 12 * 60).length).toBeCloseTo(0.11, 3);
    expect(sunAt(SUN_TODAY, 8 * 60).length).toBeGreaterThanOrEqual(0.8);
    expect(sunAt(SUN_TODAY, 8 * 60).length).toBeLessThanOrEqual(1.1);
    expect(sunAt(SUN_TODAY, 16 * 60 + 30).length).toBeGreaterThanOrEqual(0.8);
    expect(sunAt(SUN_TODAY, 16 * 60 + 30).length).toBeLessThanOrEqual(1.1);
  });

  test('at noon the shadow reaches no more than 12 art px past the feet at 64', () => {
    // a 96 art px character at 64 px per tile: the shear is the shadow's length
    expect(sunAt(SUN_TODAY, 12 * 60).length * 96).toBeLessThanOrEqual(12);
  });

  test('steps evenly between two keys, the shear away from the viewer throughout', () => {
    const seven = sunAt(SUN_TODAY, 7 * 60);
    expect(seven.sx).toBeCloseTo(-0.945, 3);
    expect(seven.sy).toBeCloseTo(-0.38, 3);
  });

  test('never grows past the cap, and carries the table alpha', () => {
    const long = sunTableOf({
      alpha: 40,
      cap: 100,
      keys: [
        { at: '06:00', right: 200, down: 100 },
        { at: '18:00', right: 200, down: 100 },
      ],
    });
    const sun = sunAt(long, 12 * 60);
    expect(sun.length).toBeCloseTo(1, 6);
    expect(Math.hypot(sun.sx, sun.sy)).toBeCloseTo(1, 6);
    expect(sun.alpha).toBeCloseTo(0.4, 6);
  });

  test('reads the valley params into minutes and fractions, in order', () => {
    const table = sunTableOf({
      alpha: 30,
      cap: 110,
      keys: [
        { at: '16:30', right: 102, down: -41 },
        { at: '08:00', right: -86, down: -37 },
      ],
    });
    expect(table.keys.map((k) => k.at)).toEqual([8 * 60, 16 * 60 + 30]);
    expect(table.alpha).toBeCloseTo(0.3, 6);
    expect(table.cap).toBeCloseTo(1.1, 6);
    expect(sunAt(table, 8 * 60).sx).toBeCloseTo(-0.86, 6);
  });

  test('a key changes only when the shear does', () => {
    expect(sunKey(sunAt(SUN_TODAY, 12 * 60))).toBe(sunKey(sunAt(SUN_TODAY, 12 * 60)));
    expect(sunKey(sunAt(SUN_TODAY, 8 * 60))).not.toBe(sunKey(sunAt(SUN_TODAY, 16 * 60)));
  });
});

describe('the mask', () => {
  const cross = maskOfAlpha(
    Uint8Array.from([
      0, 1, 1, 1, 0,
      0, 1, 1, 1, 0,
      0, 1, 1, 1, 0,
    ]),
    5,
    3,
  );

  test('reads rows into runs and finds the feet', () => {
    expect(cross.feet).toBe(2);
    expect(cross.top).toBe(0);
    expect(cross.rows[0]).toEqual([[1, 3]]);
  });

  test('an empty mask has no feet', () => {
    const empty = maskOfAlpha(new Uint8Array(9), 3, 3);
    expect(empty.feet).toBe(-1);
    expect(empty.top).toBe(-1);
  });
});

describe('the shadow', () => {
  const mask = maskOfAlpha(
    Uint8Array.from([
      0, 1, 1, 1, 0,
      0, 1, 1, 1, 0,
      0, 1, 1, 1, 0,
    ]),
    5,
    3,
  );
  const sun = (sx: number, sy: number) => ({ up: true, sx, sy, length: Math.hypot(sx, sy), alpha: 0.3 });

  test('moves each row by its height, and the feet stay at the feet', () => {
    const shadow = shadowOf(mask, sun(0.5, 0.5));
    expect(shadow.contact).toEqual([[1, 3]]);
    expect(shadow.minX).toBe(1);
    expect(shadow.maxX).toBe(4);
    expect(shadow.height).toBe(2);
    expect(shadow.spans).toContainEqual({ x: 1, y: 0, w: 3 });
    expect(shadow.spans).toContainEqual({ x: 2, y: 1, w: 3 });
  });

  test('mirrors a shear left and right', () => {
    const left = shadowOf(mask, sun(-0.5, 0.5));
    expect(left.minX).toBe(0);
    expect(left.maxX).toBe(3);
    expect(left.spans).toContainEqual({ x: 0, y: 1, w: 3 });
  });

  test('under the valley sun the shadow falls up-screen: up-left at 08:00, up-right at 16:30', () => {
    const morning = shadowOf(mask, sunAt(SUN_TODAY, 8 * 60));
    expect(morning.spans.every((s) => s.y <= 0)).toBe(true);
    expect(morning.spans.some((s) => s.y < 0)).toBe(true);
    expect(morning.minX).toBeLessThan(1);
    expect(morning.contact).toEqual([[1, 3]]);
    const evening = shadowOf(mask, sunAt(SUN_TODAY, 16 * 60 + 30));
    expect(evening.spans.every((s) => s.y <= 0)).toBe(true);
    expect(evening.spans.some((s) => s.y < 0)).toBe(true);
    expect(evening.maxX).toBeGreaterThan(3);
    expect(evening.contact).toEqual([[1, 3]]);
  });

  test('a flat sun keeps the silhouette on one row', () => {
    const flat = shadowOf(mask, sun(0, 0));
    expect(flat.height).toBe(1);
    expect(flat.spans.every((s) => s.y === 0)).toBe(true);
  });

  test('nothing casts when the sun is down, or from an empty mask', () => {
    expect(shadowOf(mask, sunAt(SUN_TODAY, 22 * 60)).spans).toEqual([]);
    expect(shadowOf(maskOfAlpha(new Uint8Array(9), 3, 3), sunAt(SUN_TODAY, 12 * 60)).spans).toEqual([]);
  });
});

/**
 * The owner on 30.10: "the objects look like they are floating above the ground". The shadow's row 0 was laid on the
 * frame's bottom edge, the row under the sprite, so every caster showed a band of its own shadow below its feet.
 * A thing placed on a tile has its origin on the tile's foot; its lowest row, its shadow's row 0 and the tile's last
 * row are one row, and only the contact line lies under it.
 */
describe('a caster stands on its tile', () => {
  const sun = sunAt(SUN_TODAY, 10 * 60);

  test("the sprite's lowest row, the shadow's anchor and the tile's last row meet", () => {
    // a 16-row sprite whose bottom row is solid, its origin (0.5, 1) on the foot of the tile at row 13: y = 224
    const alpha = new Uint8Array(16 * 16);
    for (let y = 2; y < 16; y++) for (let x = 3; x < 13; x++) alpha[y * 16 + x] = 1;
    const shadow = shadowOf(maskOfAlpha(alpha, 16, 16), sun);
    const tileFoot = 14 * 16;
    const rows = footRows(tileFoot, shadow);
    expect(rows.feet).toBe(tileFoot - 1);
    expect(rows.shadow).toBe(rows.feet);
    expect(rows.contact).toBe(tileFoot);
    // nothing of the cast shadow lies below the feet: the sun stands south, so it falls up-screen from there
    expect(Math.max(...shadow.spans.map((s) => rows.shadow + s.y))).toBe(rows.feet);
  });

  test('a sprite with clear rows under its feet casts from its feet, not from its frame', () => {
    const alpha = new Uint8Array(8 * 8);
    for (let y = 1; y < 5; y++) for (let x = 2; x < 6; x++) alpha[y * 8 + x] = 1;
    const shadow = shadowOf(maskOfAlpha(alpha, 8, 8), sun);
    expect(shadow.base).toBe(-4);
    const rows = footRows(64, shadow);
    expect(rows.feet).toBe(64 - 8 + 4);
    expect(rows.shadow).toBe(rows.feet);
    expect(rows.contact).toBe(rows.feet + 1);
  });
});

describe('a mask on the layer grid', () => {
  test('a density-4 sprite is brought down by its blocks: a quarter of a block solid casts, less does not', () => {
    // 8 x 4 art px at 4 per world px: two cells; the left block is 4 of 16 solid, the right 3 of 16
    const alpha = new Uint8Array(32);
    for (const [x, y] of [[0, 3], [1, 3], [2, 3], [3, 3], [4, 3], [5, 3], [6, 3]] as const) alpha[y * 8 + x] = 1;
    const grid = downsampleAlpha(alpha, 8, 4, 4);
    expect([grid.w, grid.h]).toEqual([2, 1]);
    expect([...grid.alpha]).toEqual([1, 0]);
  });

  test('a 64 px prop casts at the 16 px it is drawn, not four times larger', () => {
    const alpha = new Uint8Array(64 * 64);
    for (let y = 32; y < 64; y++) for (let x = 16; x < 48; x++) alpha[y * 64 + x] = 1;
    const grid = downsampleAlpha(alpha, 64, 64, 4);
    const mask = maskOfAlpha(grid.alpha, grid.w, grid.h);
    expect([mask.w, mask.h, mask.top, mask.feet]).toEqual([16, 16, 8, 15]);
    expect(mask.rows[15]).toEqual([[4, 11]]);
    const shadow = shadowOf(mask, sunAt(SUN_TODAY, 16 * 60 + 30));
    // the far edge lies within the cap of the 8 px it stands, not of the 32 art px it was drawn in
    expect(Math.min(...shadow.spans.map((sp) => sp.y))).toBeGreaterThanOrEqual(-Math.ceil(8 * 1.1));
  });

  test('density 1 keeps the alpha as it is', () => {
    const alpha = Uint8Array.from([0, 1, 1, 0]);
    expect(downsampleAlpha(alpha, 2, 2, 1).alpha).toBe(alpha);
  });

  test('a mirrored sprite casts its mirrored silhouette', () => {
    const mask = maskOfAlpha(
      Uint8Array.from([
        1, 0, 0, 0, 0,
        1, 1, 0, 1, 0,
      ]),
      5,
      2,
    );
    const mirrored = mirrorMask(mask);
    expect(mirrored.rows[0]).toEqual([[4, 4]]);
    expect(mirrored.rows[1]).toEqual([[1, 1], [3, 4]]);
    expect([mirrored.feet, mirrored.top]).toEqual([mask.feet, mask.top]);
    const noon = { up: true, sx: 0, sy: -0.5, length: 0.5, alpha: 0.3 };
    expect(shadowOf(mirrored, noon).spans).toContainEqual({ x: 4, y: -1, w: 1 });
  });
});

describe("a moving caster's own texture", () => {
  const sun = (sx: number, sy: number) => ({ up: true, sx, sy, length: Math.hypot(sx, sy), alpha: 0.3 });
  const mask = maskOfAlpha(Uint8Array.from([0, 1, 1, 0, 0, 1, 1, 0, 1, 1, 1, 1]), 4, 3);

  test('is the box of its runs: every run inside it, and each edge touched by one', () => {
    for (const [sx, sy] of [[0.5, 0.5], [-0.7, 0.4], [0, 1.2]] as const) {
      const shadow = shadowOf(mask, sun(sx, sy));
      const box = shadowBox(shadow);
      for (const s of shadow.spans) {
        expect(s.x).toBeGreaterThanOrEqual(box.x);
        expect(s.x + s.w).toBeLessThanOrEqual(box.x + box.w);
        expect(s.y).toBeGreaterThanOrEqual(box.y);
        expect(s.y + 1).toBeLessThanOrEqual(box.y + box.h);
      }
      expect(Math.min(...shadow.spans.map((s) => s.x))).toBe(box.x);
      expect(Math.max(...shadow.spans.map((s) => s.x + s.w))).toBe(box.x + box.w);
      expect(Math.min(...shadow.spans.map((s) => s.y))).toBe(box.y);
      expect(Math.max(...shadow.spans.map((s) => s.y + 1))).toBe(box.y + box.h);
    }
  });

  test('an empty shadow is one clear pixel, never a zero-sized texture', () => {
    expect(shadowBox(shadowOf(maskOfAlpha(new Uint8Array(4), 2, 2), sun(0.5, 0.5)))).toEqual({ x: 0, y: 0, w: 1, h: 1 });
  });
});
