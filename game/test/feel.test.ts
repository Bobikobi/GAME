import { describe, expect, test } from 'vitest';

import {
  AT_REST,
  FEEL,
  SWINGS,
  blinking,
  bob,
  breath,
  chain,
  feel,
  flashFrames,
  hitstopMs,
  lean,
  seed,
  shake,
  squash,
  swingPhase,
  walkBob,
} from '../src/feel';

const STRIDE = 94;

describe('bob', () => {
  test('is zero at rest and under reduced motion', () => {
    expect(bob(true, false, 500, STRIDE)).toBe(0);
    expect(bob(false, true, 500, STRIDE)).toBe(0);
  });

  test('never goes below the sheet and swings through the whole amplitude each step', () => {
    const values = Array.from({ length: STRIDE * 2 }, (_, i) => bob(true, true, i, STRIDE));
    expect(Math.max(...values)).toBe(0);
    expect(Math.min(...values)).toBe(-FEEL.bob);
    expect(values.every(Number.isInteger)).toBe(true);
  });

  test('is at the peak as the foot lands and again a whole step later', () => {
    expect(bob(true, true, 0, STRIDE)).toBe(-FEEL.bob);
    expect(bob(true, true, STRIDE * 3, STRIDE)).toBe(-FEEL.bob);
  });

  test('rises faster than it falls', () => {
    const values = Array.from({ length: STRIDE }, (_, i) => bob(true, true, i, STRIDE));
    // from the peak at the landing the body is lowest by its last zero, then rises the whole way back
    const lowest = values.lastIndexOf(0);
    expect(STRIDE - lowest).toBeLessThan(lowest / 2);
  });
});

describe('walkBob', () => {
  const TILE = 64;
  const LANDED = 0.7;

  test('peaks as the sheet lands the foot, one step a tile, and is zero at rest and under reduced motion', () => {
    const landing = Math.round(TILE * LANDED);
    for (const step of [0, 1, 5]) expect(walkBob(true, true, step * TILE + landing, TILE, LANDED)).toBe(-FEEL.bob);
    expect(walkBob(false, true, landing, TILE, LANDED)).toBe(0);
    expect(walkBob(true, false, landing, TILE, LANDED)).toBe(0);
  });

  test('over a walk it only ever lifts, never below the ground, in whole art px, and is back at the ground each step', () => {
    const values = Array.from({ length: TILE * 4 }, (_, w) => walkBob(true, true, w, TILE, LANDED));
    expect(Math.max(...values)).toBe(0);
    expect(Math.min(...values)).toBe(-FEEL.bob);
    expect(values.every(Number.isInteger)).toBe(true);
    expect(values.filter((v) => v === 0).length).toBeGreaterThan(0);
  });

  test('at the start of a walk from rest the body is lifted by at most the amplitude, then the world px is a quarter of it', () => {
    expect(Math.abs(walkBob(true, true, 0, TILE, LANDED))).toBeLessThanOrEqual(FEEL.bob);
    expect((FEEL.bob * 16) / TILE).toBe(1);
  });
});

describe('breath and blink', () => {
  test('breath starts at zero and lifts one px for half a period', () => {
    expect(breath(true, 'elder', 0)).toBe(0);
    const seen = new Set(Array.from({ length: 3000 }, (_, t) => breath(true, 'elder', t)));
    expect([...seen].sort()).toEqual([0, FEEL.breath.px]);
    expect(breath(false, 'elder', 1200)).toBe(0);
  });

  test('the period comes from the id and stays between 1.0 and 1.5 s', () => {
    for (const id of ['a', 'miller', 'wolf-3', 'x'.repeat(12)]) {
      const rises = Array.from({ length: 4000 }, (_, t) => t).filter((t) => breath(true, id, t) === 1 && breath(true, id, t - 1) === 0);
      const gap = rises[1]! - rises[0]!;
      expect(gap).toBeGreaterThanOrEqual(FEEL.breath.minMs);
      expect(gap).toBeLessThanOrEqual(FEEL.breath.maxMs);
    }
  });

  test('a blink lasts 100 ms, comes once every 3 to 5 s and is seeded by the id', () => {
    const starts: number[] = [];
    let closed = 0;
    for (let t = 0; t < 60000; t++) {
      const now = blinking(true, 'smith', t);
      if (now) closed++;
      if (now && !blinking(true, 'smith', t - 1)) starts.push(t);
    }
    expect(closed / starts.length).toBe(FEEL.blink.ms);
    for (let i = 1; i < starts.length; i++) {
      expect(starts[i]! - starts[i - 1]!).toBeGreaterThanOrEqual(3000);
      expect(starts[i]! - starts[i - 1]!).toBeLessThanOrEqual(5000);
    }
    expect(blinking(false, 'smith', starts[0]!)).toBe(false);
    expect(seed('smith', 1)).toBe(seed('smith', 1));
    expect(seed('smith', 1)).not.toBe(seed('baker', 1));
  });
});

describe('squash, lean and chain', () => {
  test('squash keeps its volume and lasts one or two frames', () => {
    expect(squash(true, 0, 2)).toEqual({ dw: 2, dh: -2 });
    expect(squash(true, 60, 2)).toEqual({ dw: -1, dh: 1 });
    expect(squash(true, 100, 2)).toEqual({ dw: 0, dh: 0 });
    expect(squash(true, 60, 1)).toEqual({ dw: 0, dh: 0 });
    expect(squash(false, 0, 2)).toEqual({ dw: 0, dh: 0 });
  });

  test('lean eases in over three frames to one px along the motion, and only while running', () => {
    expect(lean(true, true, 1, 0)).toBe(0);
    expect(lean(true, true, 1, 150)).toBe(1);
    expect(lean(true, true, -1, 150)).toBe(-1);
    expect(lean(true, false, 1, 150)).toBe(0);
    expect(lean(false, true, 1, 150)).toBe(0);
  });

  test('a chain shows where the body was, and rests at zero', () => {
    const trail = [{ dx: 0, dy: 0 }, { dx: 0, dy: 2 }, { dx: 0, dy: 4 }];
    expect(chain(true, trail, 2)).toEqual([{ dx: 0, dy: 2 }, { dx: 0, dy: 4 }]);
    expect(chain(false, trail, 2)).toEqual([{ dx: 0, dy: 0 }, { dx: 0, dy: 0 }]);
    expect(chain(true, [], 3)).toEqual([{ dx: 0, dy: 0 }, { dx: 0, dy: 0 }, { dx: 0, dy: 0 }]);
  });
});

describe('swing and hit', () => {
  test('a swing walks anticipate, strike, follow-through, recover, done', () => {
    const s = SWINGS.light;
    expect(swingPhase(s, 0)).toEqual({ stage: 'anticipate', progress: 0 });
    expect(swingPhase(s, s.anticipate).stage).toBe('strike');
    expect(swingPhase(s, s.anticipate + s.strike).stage).toBe('follow');
    expect(swingPhase(s, s.anticipate + s.strike + s.follow).stage).toBe('recover');
    expect(swingPhase(s, s.anticipate + s.strike + s.follow + s.recover).stage).toBe('done');
  });

  test('the swing timings sit in the ranges of the page', () => {
    for (const s of Object.values(SWINGS)) {
      expect(s.anticipate).toBeGreaterThanOrEqual(100);
      expect(s.anticipate).toBeLessThanOrEqual(250);
      expect(s.strike).toBe(50);
      expect(s.follow).toBeGreaterThanOrEqual(100);
      expect(s.follow).toBeLessThanOrEqual(300);
      expect(s.recover).toBeGreaterThanOrEqual(50);
      expect(s.recover).toBeLessThanOrEqual(100);
    }
  });

  test('flash and shake are off under reduced motion, hitstop is halved', () => {
    expect(flashFrames(true)).toBe(2);
    expect(flashFrames(false)).toBe(0);
    expect(hitstopMs(true, false)).toBe(50);
    expect(hitstopMs(true, true)).toBe(100);
    expect(hitstopMs(false, false)).toBe(25);
    expect(hitstopMs(false, true)).toBe(50);
    expect(shake(true, 0)).toEqual({ dx: 2, dy: 0 });
    expect(shake(true, 30)).toEqual({ dx: -2, dy: 0 });
    expect(shake(true, 50)).toEqual({ dx: 0, dy: 0 });
    expect(shake(false, 0)).toEqual({ dx: 0, dy: 0 });
  });
});

describe('feel', () => {
  const body = { id: 'miller', time: 0, moving: false, walked: 0, stride: STRIDE, height: 96 };

  test('a body at the start of its clock is the sheet and nothing else', () => {
    expect(feel(true, body)).toEqual(AT_REST);
  });

  test('reduced motion is zero for every body and every moment', () => {
    for (let t = 0; t < 8000; t += 37) {
      expect(feel(false, { ...body, time: t })).toEqual(AT_REST);
      expect(feel(false, { ...body, time: t, moving: true, walked: t })).toEqual(AT_REST);
    }
  });

  test('a walking body bobs and a standing one breathes', () => {
    expect(feel(true, { ...body, moving: true, walked: 0 }).dy).toBe(-FEEL.bob);
    const lifted = Array.from({ length: 1500 }, (_, t) => feel(true, { ...body, time: t }).dh);
    expect(Math.max(...lifted)).toBe(FEEL.breath.px);
    expect(Math.min(...lifted)).toBe(0);
  });

  test('50 figures cost well under 0.3 ms a frame', () => {
    const figures = Array.from({ length: 50 }, (_, i) => ({ ...body, id: `fig-${i}`, moving: i % 2 === 0 }));
    const frames = 2000;
    for (let t = 0; t < 200; t++) for (const f of figures) feel(true, { ...f, time: t * 16, walked: t * 5 });
    const start = performance.now();
    let sink = 0;
    for (let t = 0; t < frames; t++) for (const f of figures) sink += feel(true, { ...f, time: t * 16, walked: t * 5 }).dy;
    const perFrame = (performance.now() - start) / frames;
    expect(Number.isFinite(sink)).toBe(true);
    expect(perFrame).toBeLessThan(0.3);
  });
});
