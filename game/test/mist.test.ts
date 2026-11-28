/**
 * B2's mist (NEXT 16 a, OPENING_REVIEW section 5): criteria 1 and 2 on the raster the game itself
 * draws (src/mist.ts), for each of the three wake pockets, read pixel by pixel and not by eye.
 */
import { beforeAll, describe, expect, test } from 'vitest';

import { type Bundle, type State, findSlot, newState, step } from '@game/kernel';

import { T } from '../src/config';
import { MIST, MIST_MEND_PER_S, MIST_RGB, type Clear, firstTaskDone, mistChanged, mistClears, mistDensity, mistFill, mistPixels, mistRadius, mistStep, moteAt } from '../src/mist';
import { loadBundle, seedFor } from '../../tools/test/helpers/world';

let b: Bundle;
beforeAll(() => {
  b = loadBundle();
});

const POCKETS = ['core/west-bank', 'core/slid-bank', 'core/north-meadow'];

/** A fresh save woken in a pocket: the seed draws the pocket, the race does not matter to the mist. */
function started(pocket: string): State {
  const r = step(b, newState(b, seedFor(b, pocket)), { t: 'start', race: 'core/human', name: 'Tess' }, 0);
  if (!r.ok) throw new Error(r.error);
  return r.state;
}

/** The mist raster for a pocket's fresh save, and the clear places it was drawn from. */
function frame(pocket: string): { clears: Clear[]; px: Uint8ClampedArray; w: number; h: number } {
  const s = started(pocket);
  const clears = mistClears(b, s);
  const { width, height } = b.map;
  return { clears, px: mistPixels(clears, width, height, T), w: width * T, h: height * T };
}

const alpha = (f: { px: Uint8ClampedArray; w: number }, x: number, y: number): number => f.px[4 * (y * f.w + x) + 3]!;

describe('B2 at wake, for each pocket', () => {
  test.each(POCKETS)('%s: the wake tile is the clear places centre, 5 tiles wide', (id) => {
    const wake = b.pockets[id]!.wake;
    const { clears } = frame(id);
    expect(clears).toEqual([{ x: wake.x, y: wake.y, r: MIST.clear }]);
  });

  test.each(POCKETS)('%s (criterion 1): no mist inside the 5-tile circle around the character', (id) => {
    const f = frame(id);
    const c = f.clears[0]!;
    const cx = (c.x + 0.5) * T;
    const cy = (c.y + 0.5) * T;
    let inside = 0;
    for (let y = T * MIST.band; y < f.h - T * MIST.band; y++) {
      for (let x = T * MIST.band; x < f.w - T * MIST.band; x++) {
        if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) > c.r * T) continue;
        inside++;
        if (alpha(f, x, y) !== 0) throw new Error(`${id}: mist at pixel ${x},${y}, ${(Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / T).toFixed(2)} tiles from the wake`);
      }
    }
    expect(inside).toBeGreaterThan(Math.PI * (c.r * T) ** 2 * 0.6);
  });

  test.each(POCKETS)('%s (criterion 2): at least 90%% of the border pixels are mist', (id) => {
    const f = frame(id);
    let mist = 0;
    let total = 0;
    for (let y = 0; y < f.h; y++) {
      for (let x = 0; x < f.w; x++) {
        if (x > 0 && y > 0 && x < f.w - 1 && y < f.h - 1) continue;
        total++;
        if (alpha(f, x, y) === 255) mist++;
      }
    }
    expect(mist / total).toBeGreaterThanOrEqual(0.96);
  });

  test.each(POCKETS)('%s (criterion 2): from the character outward the mist only thickens', (id) => {
    const { clears } = frame(id);
    const c = clears[0]!;
    const { width, height } = b.map;
    for (let a = 0; a < 64; a++) {
      const ang = (a / 64) * 2 * Math.PI;
      let last = 0;
      for (let step = 0; step < 400; step++) {
        const d = step * 0.05;
        const tx = c.x + 0.5 + Math.cos(ang) * d;
        const ty = c.y + 0.5 + Math.sin(ang) * d;
        if (tx < 0 || ty < 0 || tx > width || ty > height) break;
        const v = mistDensity(clears, width, height, tx, ty);
        expect(v, `${id} at ${(ang * 180) / Math.PI} deg, ${d.toFixed(2)} tiles`).toBeGreaterThanOrEqual(last - 1e-9);
        last = v;
      }
    }
  });

  test.each(POCKETS)('%s: 6 tiles of thickening, and a share of dots that grows with the ring', (id) => {
    const f = frame(id);
    const c = f.clears[0]!;
    const share = (from: number, to: number): number => {
      let n = 0;
      let m = 0;
      for (let y = 0; y < f.h; y++) {
        for (let x = 0; x < f.w; x++) {
          const d = Math.hypot(x + 0.5 - (c.x + 0.5) * T, y + 0.5 - (c.y + 0.5) * T) / T - c.r;
          if (d < from || d >= to || Math.min(x, y, f.w - 1 - x, f.h - 1 - y) < T * 5) continue;
          n++;
          if (alpha(f, x, y) === 255) m++;
        }
      }
      return n === 0 ? NaN : m / n;
    };
    const bands = [share(0, 2), share(2, 4), share(4, 6), share(6, 9)].filter((v) => !Number.isNaN(v));
    for (let i = 1; i < bands.length; i++) expect(bands[i]!).toBeGreaterThan(bands[i - 1]!);
    expect(bands[bands.length - 1]!).toBeGreaterThanOrEqual(0.96);
  });
});

describe('B2 is dots in three colours, nothing in between', () => {
  test('every pixel is clear or fully solid, in the three colours only', () => {
    const f = frame('core/west-bank');
    const allowed = new Set(Object.values(MIST_RGB).map((c) => c.join(',')));
    const seen = new Set<string>();
    for (let i = 0; i < f.px.length; i += 4) {
      const a = f.px[i + 3]!;
      expect(a === 0 || a === 255).toBe(true);
      if (a === 255) seen.add(`${f.px[i]},${f.px[i + 1]},${f.px[i + 2]}`);
    }
    expect([...seen].every((c) => allowed.has(c))).toBe(true);
    expect(seen.size).toBe(3);
  });

  test('a half-thick ring shows the 4x4 dither: half the pixels of every 4x4 cell', () => {
    const half = mistPixels([{ x: 24, y: 24, r: 0 }], 48, 49, T);
    // 5 tiles out of a 0-radius place is density 5/6 only; read a point at exactly density 1/2 instead
    let found = 0;
    for (let y = 0; y < 49 * T; y += 4) {
      for (let x = 0; x < 48 * T; x += 4) {
        const d = mistDensity([{ x: 24, y: 24, r: 0 }], 48, 49, (x + 2) / T, (y + 2) / T);
        if (Math.abs(d - 0.5) > 0.002) continue;
        let n = 0;
        for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) if (half[4 * ((y + j) * 48 * T + x + i) + 3] === 255) n++;
        expect(n).toBeGreaterThanOrEqual(6);
        expect(n).toBeLessThanOrEqual(10);
        found++;
      }
    }
    expect(found).toBeGreaterThan(3);
  });
});

/** Each pocket's own first task. */
const FIRST = { 'core/west-bank': 'core/first-pickings', 'core/slid-bank': 'core/buried-axe', 'core/north-meadow': 'core/glint-by-the-bridge' } as const;

describe('the pocket and its first push (criterion 3)', () => {
  test.each(POCKETS)('%s: 5 tiles at wake, 7 once the first task is done, from the save alone', (id) => {
    const fresh = started(id);
    expect(firstTaskDone(b, fresh)).toBe(false);
    expect(mistClears(b, fresh)[0]!.r).toBe(5);
    const done: State = { ...fresh, player: { ...fresh.player, quests: { ...fresh.player.quests, [FIRST[id as keyof typeof FIRST]]: 'done' } } };
    expect(firstTaskDone(b, done)).toBe(true);
    expect(mistClears(b, done)[0]!.r).toBe(7);
    // a reload is the same save read again: the same pocket
    expect(mistClears(b, JSON.parse(JSON.stringify(done)) as State)).toEqual(mistClears(b, done));
  });

  test("another pocket's first task does not open this pocket", () => {
    const fresh = started('core/west-bank');
    const other: State = { ...fresh, player: { ...fresh.player, quests: { ...fresh.player.quests, 'core/buried-axe': 'done' } } };
    expect(mistClears(b, other)[0]!.r).toBe(5);
  });

  test('the pocket reaches 7 tiles within 1 s of frames at 60, 20 and 10 per second', () => {
    for (const dt of [1000 / 60, 50, 100]) {
      let shown = 5;
      let t = 0;
      while (t < 1000 + dt && shown < 7) {
        shown = mistRadius(shown, 7, dt);
        t += dt;
      }
      expect(shown).toBe(7);
      expect(t).toBeLessThanOrEqual(1000 + dt + 1e-6);
    }
  });

  test('the radius never overshoots or shrinks while growing, and is rasterised in quarter-tile steps', () => {
    let shown = 5;
    for (let i = 0; i < 80; i++) {
      const next = mistRadius(shown, 7, 1000 / 60);
      expect(next).toBeGreaterThanOrEqual(shown);
      expect(next).toBeLessThanOrEqual(7);
      expect((mistStep(next) * 4) % 1).toBe(0);
      shown = next;
    }
  });
});

describe("the north meadow's mote", () => {
  test('at the wake it stands at the pocket edge, on the line to the glint (11,19)', () => {
    const wake = b.pockets['core/north-meadow']!.wake;
    const m = moteAt([wake.x, wake.y], [11, 19], 5);
    expect(Math.hypot(m.x - (wake.x + 0.5), m.y - (wake.y + 0.5))).toBeCloseTo(5, 6);
    const ang = (p: { x: number; y: number }) => Math.atan2(p.y - (wake.y + 0.5), p.x - (wake.x + 0.5));
    expect(ang(m)).toBeCloseTo(ang({ x: 11.5, y: 19.5 }), 6);
  });

  test('it goes with the character and rests on the find once it is within reach', () => {
    expect(moteAt([9, 14], [11, 19], 5)).not.toEqual({ x: 11.5, y: 19.5 });
    expect(moteAt([10, 17], [11, 19], 5)).toEqual({ x: 11.5, y: 19.5 });
  });

  test('the glint hides in solid mist at wake, so the mote is its only sign', () => {
    const f = frame('core/north-meadow');
    const { width, height } = b.map;
    expect(mistDensity(f.clears, width, height, 11.5, 19.5)).toBe(1);
  });
});

describe('the bridge draws the mist back (criterion 4)', () => {
  const mended = (pocket: string): State => {
    const fresh = started(pocket);
    return { ...fresh, player: { ...fresh.player, restored: ['core/old-bridge'] } };
  };

  test.each(POCKETS)('%s: a mended bridge clears at least 13 tiles around the middle of its slot, all three wake tiles inside', (id) => {
    const clears = mistClears(b, mended(id));
    // the bridge's slot read from the map (the painted valley moved it, public #919): its middle tile, as mistClears takes it
    const slot = findSlot(b.map, b.restores['core/old-bridge']!.place.slot)!;
    const bridge = clears.find((c) => c.x === slot.x + Math.floor(slot.w / 2) && c.y === slot.y + Math.floor(slot.h / 2))!;
    expect(bridge, 'no clear place at the bridge').toBeDefined();
    expect(bridge.r).toBeGreaterThanOrEqual(13);
    const { width, height } = b.map;
    for (const w of POCKETS) {
      const wake = b.pockets[w]!.wake;
      expect(mistDensity(clears, width, height, wake.x + 0.5, wake.y + 0.5)).toBe(0);
      expect(Math.hypot(wake.x - bridge.x, wake.y - bridge.y)).toBeLessThanOrEqual(bridge.r);
    }
  });

  test('the clearing opens within 3 s of frames at 60, 20 and 10 per second, from nothing', () => {
    for (const dt of [1000 / 60, 50, 100]) {
      let shown = 0;
      let t = 0;
      while (shown < 14) {
        shown = mistRadius(shown, 14, dt, MIST_MEND_PER_S);
        t += dt;
      }
      expect(t).toBeLessThanOrEqual(3000);
    }
  });

  test('a reload keeps it: the same save gives the same clears; an unmended save has none of it', () => {
    const m = mended('core/west-bank');
    expect(mistClears(b, JSON.parse(JSON.stringify(m)) as State)).toEqual(mistClears(b, m));
    expect(mistClears(b, started('core/west-bank'))).toHaveLength(1);
  });
});

describe('a change of the clear places makes again only the box it reaches', () => {
  const W = 40;
  const H = 36;
  /** the steps of a game's mist: the pocket opening a quarter tile at a time, a mend opening beside it, then a mend that closes and a pocket that moves */
  const steps: Clear[][] = [];
  for (let r = 5; r <= 7; r += 0.25) steps.push([{ x: 12, y: 18, r }]);
  for (let r = 0; r <= 9; r += 0.25) steps.push([{ x: 12, y: 18, r: 7 }, { x: 27, y: 20, r }]);
  steps.push([{ x: 12, y: 18, r: 7 }], [{ x: 14, y: 17, r: 7 }, { x: 36, y: 33, r: 6 }], [{ x: 36, y: 33, r: 6 }, { x: 14, y: 17, r: 7 }]);

  test('every step: the patched raster is the whole raster, byte for byte', () => {
    const kept = new Uint8ClampedArray(new ArrayBuffer(W * T * H * T * 4));
    let before: Clear[] | undefined;
    let pixels = 0;
    for (const clears of steps) {
      const box = before ? mistChanged(before, clears, W, H, T) : undefined;
      if (!before || box) mistFill(kept, clears, W, H, T, box);
      if (box) pixels += (box.x1 - box.x0) * (box.y1 - box.y0);
      before = clears;
      expect(Buffer.from(kept.buffer).equals(Buffer.from(mistPixels(clears, W, H, T).buffer))).toBe(true);
    }
    // and it is the box that was made, not the map: on this small map the boxes still add up to under 0.6 of a map a step (on the game's 1024 x 1024 a pocket's box is about a sixth)
    expect(pixels).toBeLessThan(0.6 * (steps.length - 1) * W * T * H * T);
  });

  test('a box smaller than the places reach differs from the whole raster', () => {
    const was: Clear[] = [{ x: 20, y: 18, r: 5 }];
    const now: Clear[] = [{ x: 20, y: 18, r: 6 }];
    const kept = mistPixels(was, W, H, T);
    const box = mistChanged(was, now, W, H, T)!;
    mistFill(kept, now, W, H, T, { x0: box.x0 + 40, y0: box.y0 + 40, x1: box.x1 - 40, y1: box.y1 - 40 });
    expect(Buffer.from(kept.buffer).equals(Buffer.from(mistPixels(now, W, H, T).buffer))).toBe(false);
  });

  test('nothing changed, no box; a place that stays is not in it', () => {
    const a: Clear[] = [{ x: 12, y: 18, r: 7 }, { x: 27, y: 20, r: 3 }];
    expect(mistChanged(a, [...a], W, H, T)).toBeUndefined();
    const box = mistChanged(a, [a[0]!, { x: 27, y: 20, r: 4 }], W, H, T)!;
    expect(box.x0).toBeGreaterThan(12 * T);
  });
});
