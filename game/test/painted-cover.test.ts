import { describe, expect, test } from 'vitest';

import lightTables from '../src/painted-light.json';
import { CANOPY, COVER, coverAt, coverBake, warpOf, WARP_REACH, RUN_MAX, coverDeep, coverMasks, isMass, isMassPiece, type CoverCfg } from '../src/painted-cover.js';

/** a W x H picture with solid boxes [x0, y0, x1, y1] (inclusive) as cover */
function picture(W: number, H: number, boxes: number[][]): Uint8Array {
  const a = new Uint8Array(W * H);
  for (const [x0, y0, x1, y1] of boxes as [number, number, number, number][]) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) a[y * W + x] = 1;
  return a;
}

const alphaAt = (m: ReturnType<typeof coverMasks>, out: Uint8ClampedArray, ax: number, ay: number): number => out[((Math.floor(ay / m.cfg.half)) * m.w + Math.floor(ax / m.cfg.half)) * 4 + 3]!;

describe('the cover mask of a wood', () => {
  // two trunks 20 px apart under a crown and over a root bed, a clearing 100 px wide to the right of them
  const W = 240;
  const H = 120;
  const cover = picture(W, H, [[40, 0, 59, 119], [80, 0, 99, 119], [40, 0, 99, 19], [40, 100, 99, 119]]);
  const m = coverMasks(cover, W, H);
  const at = (x: number, y: number): number => m.wood[Math.floor(x / 2) + Math.floor(y / 2) * m.w]!;

  test('ground with canopy on all four sides is under a canopy; open ground far from any canopy is not', () => {
    expect(at(70, 60)).toBe(255); // a trunk each side, the crown above and the root bed below
    expect(at(200, 60)).toBe(0);
  });

  test('canopy on one, two or three sides only is not enclosure', () => {
    const three = coverMasks(picture(W, H, [[40, 0, 59, 79], [80, 0, 99, 79], [40, 0, 99, 19]]), W, H);
    expect(three.wood[Math.floor(70 / 2) + Math.floor(60 / 2) * three.w]).toBe(0); // a trunk each side and the crown, open below (the trunks end 20 px under her: a side looks along a fan, so trunks that went on below would be seen from a slant)
    expect(at(105, 60)).toBe(0); // the right trunk on one side only
    const two = coverMasks(picture(W, H, [[40, 0, 59, 79], [80, 0, 99, 79]]), W, H);
    expect(two.wood[Math.floor(70 / 2) + Math.floor(60 / 2) * two.w]).toBe(0); // a trunk each side, nothing above or below
  });

  test('a pixel of cover itself carries no floor shade', () => {
    expect(at(50, 60)).toBe(0);
  });

  test('the gate has no ramp: a cell is 255 or 0', () => {
    expect([...new Set(m.wood)].sort()).toEqual([0, 255]);
  });

  test('canopy beyond `span` does not count', () => {
    // one side is enough here (`sides` 1): the left trunk's edge is 99 px, so ground within 48 px of it counts and ground farther does not
    const one = coverMasks(cover, W, H, { ...COVER, sides: 1 });
    const o = (x: number, y: number): number => one.wood[Math.floor(x / 2) + Math.floor(y / 2) * one.w]!;
    expect(o(140, 60)).toBe(255);
    expect(o(160, 60)).toBe(0);
  });
});

describe('the gate\'s edge follows the canopy, not a row (round 3, the lit glade\'s edge on the column of four)', () => {
  // a lone blob of canopy 8 px wide and two rows high: the one-row scan of the first rule saw it from every row it touched and from no other, which cut the gate straight across `span`
  const W = 200;
  const H = 120;
  const blob = picture(W, H, [[20, 40, 27, 43]]);
  const longest = (fan: number): number => {
    const m = coverMasks(blob, W, H, { ...COVER, sides: 1, fan });
    let best = 0;
    for (let y = 0; y + 1 < m.h; y++) {
      let run = 0;
      for (let x = 0; x < m.w; x++) {
        const cut = m.wood[y * m.w + x]! > 0 && m.wood[(y + 1) * m.w + x] === 0;
        run = cut ? run + 1 : 0;
        best = Math.max(best, run);
      }
    }
    return best * m.cfg.half; // art px
  };
  test('one row: the gate\'s lower edge runs straight for most of `span`', () => {
    expect(longest(0)).toBeGreaterThanOrEqual(40);
  });
  test('the fan: the edge slants, and the straight stretch is at most the blob\'s own width and the cap of the wedge (a third shorter than one row\'s)', () => {
    expect(longest(COVER.fan)).toBeLessThanOrEqual(0.7 * longest(0));
  });
});

describe('the rays of the sun through the cover', () => {
  // everything that is not cover counts as the wood's floor (no gate: `sides` 0), so the rays alone decide
  const cfg: CoverCfg = { ...COVER, sides: 0, z0: 8, z1: 64, step: 4, grow: 1 };
  const W = 200;
  const H = 200;
  // a roof at y 130..140, over x 41..159, with a 32 px gap at x 100..131
  const roof = (gapX0: number, gapX1: number): Uint8Array => picture(W, H, [[41, 130, gapX0 - 1, 140], [gapX1 + 1, 130, 159, 140]]);
  const bake = (m: ReturnType<typeof coverMasks>, sx: number, sy: number): Uint8ClampedArray => {
    const out = new Uint8ClampedArray(m.w * m.h * 4);
    coverBake(m, sx, sy, out, false);
    return out;
  };
  const litX = (m: ReturnType<typeof coverMasks>, sx: number): number[] => {
    const out = bake(m, sx, -0.5);
    const xs: number[] = [];
    for (let x = 30; x < 180; x += 2) if (alphaAt(m, out, x, 170) === 0) xs.push(x);
    return xs;
  };

  test('under a roof with no gap the floor is in the shade', () => {
    const m = coverMasks(roof(100, 99), W, H, cfg); // no gap
    const out = bake(m, 0, -0.5);
    expect(alphaAt(m, out, 100, 170)).toBe(255);
    expect(alphaAt(m, out, 70, 170)).toBe(255);
  });

  test('a gap throws a patch of light on the floor along the sun, and the patch moves with the sun', () => {
    const m = coverMasks(roof(100, 131), W, H, cfg);
    const a = litX(m, 0);
    const b = litX(m, 0.5);
    expect(a.length).toBeGreaterThan(0);
    expect(b.length).toBeGreaterThan(0);
    // the sun leans right (the shadow falls right), so the patch lies to the right of where it lay
    expect(Math.min(...b)).toBeGreaterThan(Math.min(...a));
  });

  test('a gap narrower than the grown cover lets no ray through', () => {
    const m = coverMasks(roof(100, 101), W, H, cfg); // a 2 px slit
    expect(litX(m, 0).filter((x) => x > 60 && x < 150).length).toBe(0);
  });
});

describe('the cover at one art pixel (what the figure\'s shadow weakens by)', () => {
  const cfg: CoverCfg = { ...COVER, sides: 0 };
  const W = 120;
  const H = 120;
  test('under a closed roof it is 1, in the open it is 0', () => {
    const m = coverMasks(picture(W, H, [[0, 40, 119, 60]]), W, H, cfg);
    expect(coverAt(m, 60, 80, 0, -0.5)).toBeGreaterThan(0.95);
    const none = coverMasks(new Uint8Array(W * H), W, H, cfg);
    expect(coverAt(none, 60, 80, 0, -0.5)).toBe(0);
  });
});

describe('the piece that fills the picture', () => {
  test('is the mass when its box covers 0.8 of the scene both ways', () => {
    expect(isMass({ w: 1378, h: 1774 }, { width: 1380, height: 1776 })).toBe(true);
    expect(isMass({ w: 1378, h: 1400 }, { width: 1380, height: 1776 })).toBe(false);
    expect(isMass({ w: 1000, h: 1774 }, { width: 1380, height: 1776 })).toBe(false);
  });

  test('a part of the mass cut by ground line is the mass too, a small piece without the flag is not', () => {
    const scene = { width: 1380, height: 1776 };
    expect(isMassPiece({ w: 60, h: 300, masspart: true }, scene)).toBe(true);
    expect(isMassPiece({ w: 60, h: 300 }, scene)).toBe(false);
    expect(isMassPiece({ w: 60, h: 300, masspart: false }, scene)).toBe(false);
    expect(isMassPiece({ w: 1378, h: 1774 }, scene)).toBe(true);
  });
});

describe('the depth of the cover shade follows the sun', () => {
  test('is deepest under a high sun and takes the floor less far under a low one, by one rule', () => {
    expect(coverDeep(0.88)).toBeCloseTo(1.616, 3);
    expect(coverDeep(0.5)).toBeCloseTo(1.35, 3);
    expect(coverDeep(0.05)).toBeCloseTo(1.035, 3);
    for (let e = 0.05; e < 0.9; e += 0.05) expect(coverDeep(e + 0.05)).toBeGreaterThan(coverDeep(e));
  });
});

describe('the depth of the cover shade at the painted hour (the light round of 16.11)', () => {
  type Row = { minute: number; elev: number; cover?: number };
  const worlds = lightTables.worlds as unknown as Record<string, { rows: Row[] }>;
  const river = worlds['river']!.rows;
  const depthOf = (r: Row): number => r.cover ?? coverDeep(r.elev);
  test('the river names 0.35 at 13:00 (the painted floor between the trunks), keeps the rule at 17:30 and after, and the undead world names none', () => {
    expect(river.find((r) => r.minute === 780)!.cover).toBe(0.35);
    expect(depthOf(river.find((r) => r.minute === 1050)!)).toBeCloseTo(1.35, 3);
    for (const r of river.filter((q) => q.minute >= 1050)) expect(r.cover).toBeUndefined();
    for (const r of worlds['undead']!.rows) expect(r.cover).toBeUndefined();
  });
  test('the day is one line: the depth between two rows is a straight line and no minute jumps by more than 0.03', () => {
    const at = (m: number): number => {
      let i = river.length - 1;
      for (let k = 0; k < river.length; k++) if (river[k]!.minute <= m) i = k;
      const a = river[i]!;
      const b = river[(i + 1) % river.length]!;
      const span = (b.minute - a.minute + 1440) % 1440 || 1440;
      return depthOf(a) + (depthOf(b) - depthOf(a)) * (((m - a.minute + 1440) % 1440) / span);
    };
    let worst = 0;
    for (let m = 0; m < 1440; m++) worst = Math.max(worst, Math.abs(at((m + 1) % 1440) - at(m)));
    expect(worst).toBeLessThan(0.03);
  });
});

describe('the wandering of the shade edge (G1)', () => {
  test('the warp is a function of the cell, within `WARP_REACH` cells either way, and it never stays put from one block of rows to the next', () => {
    for (let y = 0; y < 3000; y += 3) expect(warpOf(0, y)[0]).not.toBe(warpOf(0, y + 3)[0]);
    for (let y = 0; y < 300; y += 7) {
      for (let x = 0; x < 300; x += 5) {
        const [a, b] = warpOf(x, y);
        expect(Math.abs(a)).toBeLessThanOrEqual(WARP_REACH);
        expect(Math.abs(b)).toBeLessThanOrEqual(WARP_REACH);
        expect(warpOf(x, y)).toEqual([a, b]);
      }
    }
  });
  test('a shade whose edge ran straight down the whole picture no longer runs straight for more than 3 cells (6 art px)', () => {
    const cfg: CoverCfg = { ...COVER, sides: 0, grow: 0, z0: 60, z1: 60, step: 4 };
    const W = 400;
    const H = 400;
    const m = coverMasks(picture(W, H, [[0, 0, 199, 399]]), W, H, cfg);
    const run = (warp: boolean): number => {
      const out = new Uint8ClampedArray(m.w * m.h * 4);
      coverBake(m, 1, -0.5, out, warp);
      let best = 0;
      for (let x = 2; x < m.w - 2; x++) {
        let n = 0;
        for (let y = 25; y < m.h - 1; y++) {
          const here = out[(y * m.w + x) * 4 + 3]! > 0;
          const right = out[(y * m.w + x + 1) * 4 + 3]! > 0;
          n = here && !right ? n + 1 : 0;
          best = Math.max(best, n);
        }
      }
      return best;
    };
    expect(run(false)).toBeGreaterThan(100);
    expect(run(true)).toBeLessThanOrEqual(RUN_MAX);
  });
});

describe('the kinds whose crown is a canopy (L8, the dappled wood shadow of the valley look)', () => {
  test('the painted land\'s firs and trees and the split valley\'s oaks and pines are canopy; rocks, snags, bushes and buildings are not', () => {
    for (const k of ['fir', 'tree', 'oak', 'pine']) expect(CANOPY.has(k), k).toBe(true);
    for (const k of ['rock', 'snag', 'bush', 'house', 'ruin', 'wall', 'cliff']) expect(CANOPY.has(k), k).toBe(false);
  });
});
