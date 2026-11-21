/**
 * A living fire (GRUNT CR-110): two fires never step their flames alike, the light's pool moves inside its band
 * every second, the crackle follows the same breath, and nothing of it waits on the sound.
 */
import { beforeAll, describe, expect, test } from 'vitest';

import type { Bundle, Flicker } from '@game/kernel';
import { FireFlicker, FlameClock, breathOf, emberEvery, frameOrders, seedOf, seeded, sparkGap } from '../src/flicker';
import { loadBundle } from '../../tools/test/helpers/world';

/** A frame of the scene, in ms. */
const FRAME = 16;
/** The kit campfire's frame time (world.ts FLAME_MS). */
const FLAME_MS = 120;

let base: Bundle;
let t: Flicker;
/** Every fire id the valley draws: the tended props and the one the player kindles. */
let ids: string[];

beforeAll(() => {
  base = loadBundle();
  const found = base.params.fire.flicker;
  if (!found) throw new Error('the core params carry no fire flicker');
  t = found;
  ids = [...base.map.props.filter((p) => p.fire === true && p.id).map((p) => p.id!), 'own', 'core/a-second-fire', 'x/third'];
});

const frames = (seed: number, from: number, ms: number): number[] => {
  const c = new FlameClock(seed, 3, t, FLAME_MS);
  const out: number[] = [];
  for (let now = from; now <= from + ms; now += FRAME) out.push(c.frame(now));
  return out;
};

describe('the flame frames', () => {
  test('two fires in one view never show the same frame sequence over 2 s', () => {
    expect(ids.length).toBeGreaterThanOrEqual(3);
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        // drawn at the same moment, from the scene's start and from a later bind
        for (const from of [0, 73_000]) expect(frames(seedOf(ids[i]!), from, 2000)).not.toEqual(frames(seedOf(ids[j]!), from, 2000));
      }
    }
  });

  test('a fire keeps its own sequence: the same seed draws the same frames', () => {
    expect(frames(seedOf('core/elder-hearth'), 0, 2000)).toEqual(frames(seedOf('core/elder-hearth'), 0, 2000));
  });

  test('the frames step near their base time and every frame of the sheet shows', () => {
    const seq = frames(seedOf('own'), 0, 4000);
    expect(new Set(seq)).toEqual(new Set([0, 1, 2]));
    let changes = 0;
    for (let i = 1; i < seq.length; i++) if (seq[i] !== seq[i - 1]) changes++;
    const lo = 4000 / (FLAME_MS * (1 + t.frame_jitter_pct / 100)) - 4;
    const hi = 4000 / (FLAME_MS * (1 - t.frame_jitter_pct / 100)) + 1;
    expect(changes).toBeGreaterThanOrEqual(lo);
    expect(changes).toBeLessThanOrEqual(hi);
  });

  test('a sheet has a second order to step in, a hook for more', () => {
    const orders = frameOrders(3);
    expect(orders.length).toBeGreaterThanOrEqual(2);
    expect(orders[0]).not.toEqual(orders[1]);
    for (const o of orders) expect([...o].sort()).toEqual([0, 1, 2]);
    expect(frameOrders(1)).toEqual([[0]]);
  });
});

describe('the light breathes', () => {
  test("the pool's radius moves within its band every second, and so does the strength", () => {
    const f = new FireFlicker(seedOf('core/elder-hearth'), t);
    const band = t.band_pct / 100;
    for (let second = 0; second < 30; second++) {
      let lo = Infinity;
      let hi = -Infinity;
      for (let now = second * 1000; now < (second + 1) * 1000; now += FRAME) {
        const b = f.at(now);
        expect(b.radius).toBeGreaterThanOrEqual(1 - band / 2 - 1e-9);
        expect(b.radius).toBeLessThanOrEqual(1 + band / 2 + 1e-9);
        expect(b.gain).toBeGreaterThanOrEqual(1 - band - 1e-9);
        expect(b.gain).toBeLessThanOrEqual(1 + band + 1e-9);
        lo = Math.min(lo, b.radius);
        hi = Math.max(hi, b.radius);
      }
      expect(hi - lo).toBeGreaterThan(0.002);
    }
  });

  test('it glides: no frame jumps more than an eased step can', () => {
    const f = new FireFlicker(seedOf('own'), t);
    let last = f.at(0).value;
    for (let now = FRAME; now < 10_000; now += FRAME) {
      const v = f.at(now).value;
      // a full swing of 2 over the shortest step, eased: at most pi/2 times the straight slope a frame
      expect(Math.abs(v - last)).toBeLessThanOrEqual(((2 * Math.PI) / 2) * (FRAME / t.step_min_ms) + 1e-9);
      last = v;
    }
  });

  test('the crackle and the light share one breath, and the breath needs no sound', () => {
    // the scene sets the crackle to its level times `gain`, the light's strength to the ladder's times `gain` and
    // its radius by `radius`: one value, so the flicker a muted player sees is the crackle the others hear
    const b = breathOf(t, 0.5);
    expect(b.gain).toBeCloseTo(1 + (t.band_pct / 100) * 0.5);
    expect(b.radius - 1).toBeCloseTo((b.gain - 1) / 2);
    expect(breathOf(t, 3)).toEqual(breathOf(t, 1));
  });

  test('two fires breathe apart', () => {
    const a = new FireFlicker(seedOf('core/elder-hearth'), t);
    const b = new FireFlicker(seedOf('own'), t);
    let apart = 0;
    for (let now = 0; now < 2000; now += 100) if (Math.abs(a.at(now).value - b.at(now).value) > 0.05) apart++;
    expect(apart).toBeGreaterThan(5);
  });
});

describe('embers and sparks', () => {
  test('a spark pops between its two bounds; embers thin as the fire settles', () => {
    const rng = seeded(1);
    for (let i = 0; i < 100; i++) {
      const g = sparkGap(t, rng);
      expect(g).toBeGreaterThanOrEqual(t.spark_gap_min_s * 1000);
      expect(g).toBeLessThanOrEqual(t.spark_gap_max_s * 1000);
    }
    expect(emberEvery(t, 1)).toBe(Math.round(1000 / t.ember_per_s));
    expect(emberEvery(t, 0.5)).toBeGreaterThan(emberEvery(t, 1));
  });

  test("the params' bounds keep a spark's gap and the flicker's step well formed", () => {
    expect(t.spark_gap_min_s).toBeLessThanOrEqual(t.spark_gap_max_s);
    expect(t.step_min_ms).toBeLessThanOrEqual(t.step_max_ms);
    // a new value at least every second, so the pool moves every second at any step inside the bounds
    expect(t.step_max_ms).toBeLessThanOrEqual(1000);
  });
});
