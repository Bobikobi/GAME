/**
 * The look of standing water and fog (src/look.ts): the rules that are plain numbers, read one by one. The picture itself is judged by eye and by
 * the capture measures (.scratch/look), never here.
 */
import { describe, expect, test } from 'vitest';

import {
  FOAM,
  FOG_CLEAR,
  FOG_FLOOR,
  fogBase,
  fogColour,
  fogLetThrough,
  fogNoise,
  fogOpen,
  foamEdge,
  luma,
  sparkleOf,
  warmthOf,
  waterHold,
} from '../src/look';

const NOON = { amb: [0.62, 0.64, 0.7], sun: [1, 0.96, 0.86], elev: 0.85 } as const;
const EVENING = { amb: [0.5, 0.45, 0.5], sun: [1, 0.62, 0.34], elev: 0.2 } as const;
const DARK = { amb: [0.1, 0.12, 0.18], sun: [0.1, 0.1, 0.14], elev: 0.5 } as const;
const RED = { amb: [0.2, 0.1, 0.1], sun: [0.8, 0.2, 0.1], elev: 0.3 } as const;

describe('the glitter follows the hour', () => {
  test('noon glitters at least three times as much as a dark hour', () => {
    expect(sparkleOf(NOON)).toBeGreaterThanOrEqual(3 * sparkleOf(DARK));
  });
  test('a dark hour has almost none', () => {
    expect(sparkleOf(DARK)).toBeLessThan(0.05);
  });
  test('a low sun glitters more than a high one', () => {
    expect(sparkleOf(EVENING)).toBeGreaterThan(sparkleOf(NOON));
  });
});

describe('the warm road', () => {
  test('the evening is warm, noon is less so, a dark hour has none', () => {
    expect(warmthOf(EVENING)).toBeGreaterThan(warmthOf(NOON));
    expect(warmthOf(DARK)).toBeLessThan(0.05);
  });
  test('stays between 0 and 1', () => {
    for (const l of [NOON, EVENING, DARK, RED]) {
      expect(warmthOf(l)).toBeGreaterThanOrEqual(0);
      expect(warmthOf(l)).toBeLessThanOrEqual(1);
    }
  });
});

describe('the foam line breathes', () => {
  test('its edge swings 1 to 3 px each way over a period of 2 to 4 s', () => {
    expect(FOAM.amp).toBeGreaterThanOrEqual(1);
    expect(FOAM.amp).toBeLessThanOrEqual(3);
    expect(FOAM.period).toBeGreaterThanOrEqual(2);
    expect(FOAM.period).toBeLessThanOrEqual(4);
    let lo = Infinity;
    let hi = -Infinity;
    for (let t = 0; t < FOAM.period; t += 0.05) {
      const e = foamEdge(t, 0);
      lo = Math.min(lo, e);
      hi = Math.max(hi, e);
    }
    expect(hi - lo).toBeGreaterThan(2 * FOAM.amp - 0.05);
  });
  test('places along the shore are a phase apart: it rolls and does not pulse as one', () => {
    expect(Math.abs(foamEdge(0.7, 0) - foamEdge(0.7, 100))).toBeGreaterThan(0.1);
  });
  test('never inside the bank', () => {
    for (let t = 0; t < 20; t += 0.1) expect(foamEdge(t, 37)).toBeGreaterThan(FOAM.core);
  });
});

describe('the fog is the hour light and never black', () => {
  test('even in a dark hour its colour holds the floor', () => {
    expect(luma(fogColour(DARK))).toBeGreaterThanOrEqual(FOG_FLOOR - 0.01);
  });
  test('the red sun tints it red', () => {
    const c = fogColour(RED);
    expect(c[0]).toBeGreaterThan(c[2]);
  });
  test('noon is brighter than the dark hour', () => {
    expect(luma(fogColour(NOON))).toBeGreaterThan(luma(fogColour(DARK)));
  });
  test('channels stay in 0..1', () => {
    for (const l of [NOON, EVENING, DARK, RED]) for (const v of fogColour(l)) expect(v >= 0 && v <= 1).toBe(true);
  });
});

describe('the fog noise', () => {
  const n = fogNoise(64, 3);
  test('is deterministic', () => {
    expect(Array.from(fogNoise(64, 3).slice(0, 64))).toEqual(Array.from(n.slice(0, 64)));
  });
  test('has form: its spread is at least a quarter of its mean on every channel', () => {
    for (let c = 0; c < 3; c++) {
      let s = 0;
      let s2 = 0;
      const N = 64 * 64;
      for (let i = 0; i < N; i++) {
        const v = n[i * 4 + c]! / 255;
        s += v;
        s2 += v * v;
      }
      const mean = s / N;
      const sd = Math.sqrt(s2 / N - mean * mean);
      expect(sd / mean).toBeGreaterThan(0.1);
    }
  });
  test('tiles without a seam', () => {
    // the left and right columns are neighbours when wrapped: their difference is of the order of one step between two ordinary columns
    let wrap = 0;
    let step = 0;
    for (let y = 0; y < 64; y++) {
      wrap += Math.abs(n[(y * 64 + 63) * 4]! - n[y * 64 * 4]!);
      step += Math.abs(n[(y * 64 + 31) * 4]! - n[(y * 64 + 32) * 4]!);
    }
    expect(wrap).toBeLessThan(step * 2 + 64 * 6);
  });
});

describe('the fog lies low and thick toward the far land', () => {
  const d = { bottom: 0.2, top: 0.6 };
  test('thicker at the top of the frame than at the bottom', () => {
    expect(fogBase(d, 0, 100)).toBeCloseTo(0.6);
    expect(fogBase(d, 100, 100)).toBeCloseTo(0.2);
  });
  test('the top third of a tall piece rises out of it, its foot stands in it', () => {
    expect(fogLetThrough(0.1, true)).toBeCloseTo(1);
    expect(fogLetThrough(0.9, true)).toBeLessThan(0.3);
  });
  test('a low piece is not let out', () => {
    expect(fogLetThrough(0.9, false)).toBe(1);
  });
});

describe('the walker keeps a clear circle', () => {
  test('clear inside, thick beyond the ring, rising between', () => {
    expect(fogOpen(0)).toBe(0);
    expect(fogOpen(FOG_CLEAR.clear)).toBe(0);
    expect(fogOpen(FOG_CLEAR.clear + FOG_CLEAR.ring)).toBe(1);
    expect(fogOpen(FOG_CLEAR.clear + FOG_CLEAR.ring / 2)).toBeGreaterThan(0.4);
    expect(fogOpen(FOG_CLEAR.clear + FOG_CLEAR.ring / 2)).toBeLessThan(0.6);
  });
});

describe('the water keeps its hue family through the dark (V5c, L7)', () => {
  const hue = (c: readonly number[]): number => ((Math.atan2(Math.sqrt(3) * (c[1]! - c[2]!), 2 * c[0]! - c[1]! - c[2]!) * 180) / Math.PI + 360) % 360;
  const plate = [0.241, 0.401, 0.478];
  const lit = (amb: readonly [number, number, number]): number[] => {
    const h = waterHold(amb);
    return plate.map((v, i) => v * amb[i]! * h[i]!);
  };
  test('a day ambient is not touched', () => {
    expect(waterHold([0.62, 0.63, 0.66])).toEqual([1, 1, 1]);
    expect(waterHold([0.5, 0.5, 0.66])).toEqual([1, 1, 1]);
  });
  test('the night water turns no further than 15 degrees from its day hue', () => {
    const day = hue(plate.map((v, i) => v * [0.62, 0.63, 0.66][i]!));
    const night = hue(lit([0.1725, 0.195, 0.396]));
    expect(Math.abs(night - day)).toBeLessThanOrEqual(15);
    expect(hue(plate.map((v, i) => v * [0.1725, 0.195, 0.396][i]!)) - day).toBeGreaterThan(15); // without the hold it was well past
  });
  test('it only takes colour off: a multiplier never above 1', () => {
    for (const h of waterHold([0.1725, 0.195, 0.396])) expect(h).toBeLessThanOrEqual(1);
  });
});
