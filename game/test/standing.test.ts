import { describe, expect, it } from 'vitest';

import { FACE_SHARE, clusterRects, bayerAt, facingShare, facingStep, standingOf, standingRegionSteps, standingReach, standingSteps, type Rect, type Standing } from '../src/standing.js';

/** a mask of `w` x `h` with one filled rectangle */
function rect(w: number, h: number, x0: number, y0: number, x1: number, y1: number): Uint8Array {
  const m = new Uint8Array(w * h);
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) m[y * w + x] = 1;
  return m;
}

describe('the facing field of what stands (order 2)', () => {
  const W = 200;
  const H = 120;
  const s = standingOf(rect(W, H, 70, 20, 130, 100), W, H);
  const at = (x: number, y: number) => y * W + x;

  it('points out of each side of a trunk, with the full weight at the edge', () => {
    expect(s.nx[at(71, 60)]!).toBeLessThan(-100);
    expect(s.nx[at(128, 60)]!).toBeGreaterThan(100);
    expect(s.ny[at(100, 21)]!).toBeLessThan(-100);
    expect(s.ny[at(100, 98)]!).toBeGreaterThan(100);
  });

  it('is neutral in the middle of a thick stand and outside it', () => {
    expect(Math.hypot(s.nx[at(100, 60)]!, s.ny[at(100, 60)]!)).toBeLessThan(10);
    expect(s.nx[at(10, 10)]).toBe(0);
    expect(s.ny[at(10, 10)]).toBe(0);
  });

  it('is deterministic', () => {
    const t = standingOf(rect(W, H, 70, 20, 130, 100), W, H);
    expect(Array.from(t.nx)).toEqual(Array.from(s.nx));
  });
});

describe('the facing step', () => {
  it('is 2 facing the light, 0 facing away, 1 side on, at any threshold of the dither', () => {
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        const b = bayerAt(x, y);
        expect(facingStep(127, 0, 1, 0, b)).toBe(2);
        expect(facingStep(-127, 0, 1, 0, b)).toBe(0);
        expect(facingStep(0, 127, 1, 0, b)).toBe(1);
        expect(facingStep(0, 0, 1, 0, b)).toBe(1);
      }
    }
  });

  it('dithers between two steps in between', () => {
    const seen = new Set<number>();
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) seen.add(facingStep(60, 0, 1, 0, bayerAt(x, y)));
    expect(seen).toEqual(new Set([1, 2]));
  });

  it('keeps more of the light the more it faces it; the side-on step is the ground\'s own share', () => {
    expect(facingShare(0)).toBe(FACE_SHARE[0]);
    expect(facingShare(1)).toBe(1);
    expect(facingShare(2)).toBeGreaterThan(1);
    expect(facingShare(0)).toBeLessThan(facingShare(1));
    expect(facingShare(1)).toBeLessThan(facingShare(2));
  });
});

describe('the facing field made in slices', () => {
  it('is the same field as made whole, in many slices, with the result only at the end', () => {
    const W = 200;
    const H = 120;
    const mask = rect(W, H, 70, 20, 130, 100);
    const whole = standingOf(mask, W, H);
    const out: { result?: Standing } = {};
    let slices = 0;
    for (const _ of standingSteps(mask, W, H, out, undefined, 8)) {
      void _;
      slices++;
      expect(out.result).toBeUndefined();
    }
    expect(slices).toBeGreaterThan(40);
    expect(Array.from(out.result!.nx)).toEqual(Array.from(whole.nx));
    expect(Array.from(out.result!.ny)).toEqual(Array.from(whole.ny));
  });
});

describe('the facing field made again only where a change reaches', () => {
  const W = 150;
  const H = 110;
  /** a field of blobs (a seeded scatter of small rectangles), and the same with one more blob added in `add` */
  function scatter(seed: number, n: number): Uint8Array {
    const m = new Uint8Array(W * H);
    let a = seed;
    const rnd = (): number => ((a = (Math.imul(a, 1664525) + 1013904223) >>> 0) / 4294967296);
    for (let i = 0; i < n; i++) {
      const x0 = Math.floor(rnd() * (W - 12));
      const y0 = Math.floor(rnd() * (H - 12));
      const w = 3 + Math.floor(rnd() * 9);
      const h = 3 + Math.floor(rnd() * 9);
      for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) m[y * W + x] = 1;
    }
    return m;
  }

  /** the field from the old mask, patched over `dirty` for the new mask: how many pixels differ from the whole pass, and by how much at most */
  function compare(dirty: Rect, add: Rect, seed = 7): { differ: number; worst: number; slices: number } {
    const before = scatter(seed, 25);
    const after = before.slice();
    for (let y = add.y0; y < add.y1; y++) for (let x = add.x0; x < add.x1; x++) after[y * W + x] = 1;
    const was = standingOf(before, W, H);
    const whole = standingOf(after, W, H);
    const dst = { nx: new Int8Array(W * H), ny: new Int8Array(W * H) };
    let slices = 0;
    for (const _ of standingRegionSteps(after, W, H, dirty, { nx: was.nx, ny: was.ny }, dst, undefined, 8)) {
      void _;
      slices++;
    }
    let differ = 0;
    let worst = 0;
    for (let i = 0; i < W * H; i++) {
      const dx = Math.abs(dst.nx[i]! - whole.nx[i]!);
      const dy = Math.abs(dst.ny[i]! - whole.ny[i]!);
      if (dx || dy) differ++;
      worst = Math.max(worst, dx, dy);
    }
    return { differ, worst, slices };
  }

  const add: Rect = { x0: 60, y0: 40, x1: 78, y1: 66 };

  it('matches the whole pass to within a step of the 127 scale, over a patch of many slices', () => {
    const r = compare(add, add);
    expect(r.worst).toBeLessThanOrEqual(1);
    expect(r.slices).toBeGreaterThan(5);
  });

  it('matches for a change at the land edge and for one that touches the corner', () => {
    for (const rc of [{ x0: 0, y0: 0, x1: 9, y1: 9 }, { x0: W - 10, y0: H - 7, x1: W, y1: H }, { x0: 0, y0: 50, x1: 6, y1: 70 }]) {
      expect(compare(rc, rc, 11).worst).toBeLessThanOrEqual(1);
    }
  });

  it('is the whole pass when the rectangle is the whole mask', () => {
    const all: Rect = { x0: 0, y0: 0, x1: W, y1: H };
    expect(compare(all, add).worst).toBeLessThanOrEqual(1);
  });

  it('differs when the rectangle is smaller than the change (so the bound above can fail)', () => {
    const small: Rect = { x0: add.x0 + 6, y0: add.y0 + 6, x1: add.x1 - 6, y1: add.y1 - 6 };
    expect(compare(small, add).worst).toBeGreaterThan(20);
  });

  it('differs when the reach is left out of the patch', () => {
    // the field of the new mask patched only over the change itself, not over what it reaches
    const r = compare({ x0: add.x0 + standingReach() + 1, y0: add.y0 + standingReach() + 1, x1: add.x1 - standingReach() - 1, y1: add.y1 - standingReach() - 1 }, add);
    expect(r.differ).toBeGreaterThan(0);
  });

  it('clusters rectangles that touch and keeps far ones apart, and the patches of two far changes match the whole pass', () => {
    const a: Rect = { x0: 5, y0: 5, x1: 15, y1: 15 };
    const b: Rect = { x0: 20, y0: 8, x1: 30, y1: 20 };
    const far: Rect = { x0: 120, y0: 80, x1: 135, y1: 100 };
    const cl = clusterRects([a, far, b], W, H);
    expect(cl).toHaveLength(2);
    const before = scatter(5, 20);
    const after = before.slice();
    for (const r of [a, b, far]) for (let y = r.y0; y < r.y1; y++) for (let x = r.x0; x < r.x1; x++) after[y * W + x] = 1;
    const was = standingOf(before, W, H);
    const whole = standingOf(after, W, H);
    const dst = { nx: new Int8Array(W * H), ny: new Int8Array(W * H) };
    cl.forEach((r, k) => { for (const _ of standingRegionSteps(after, W, H, r, k === 0 ? { nx: was.nx, ny: was.ny } : undefined, dst, undefined, 8)) void _; });
    let worst = 0;
    for (let i = 0; i < W * H; i++) worst = Math.max(worst, Math.abs(dst.nx[i]! - whole.nx[i]!), Math.abs(dst.ny[i]! - whole.ny[i]!));
    expect(worst).toBeLessThanOrEqual(1);
  });
});
