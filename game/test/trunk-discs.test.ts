/**
 * Trunk discs (private #44 step H1w, the owner of 24.11: the figure on its free walk passes between the trees as it wants, not into a trunk). The walk's tiles are 64 art px, too coarse to hold a trunk: a refused
 * tile under every foot closes a wood (open share 24 to 52% in the valley's woods, three of them uncrossable), an open tile lets the body through the trunk. A painted land carries one small disc per trunk foot
 * (`feet` in scene.json); the Walker pushes its box out of every disc it overlaps, so crowns stay open and trunks block at pixel precision. Pure: no renderer, no bundle.
 */
import { describe, expect, test } from 'vitest';

import { STEP_MS } from '../src/config';
import { ART_PX, BODY_BOX, type Disc, FOOT_DRAWN, Walker, pushOutOfDiscs, trunkDiscsOf } from '../src/walking';

const FRAME = 16;
const open = () => true;
const R = 9;

/** The distance from the body box to a disc's centre: under r means the box is inside the disc. */
function gap(w: Walker, d: Disc): number {
  const nx = Math.min(w.x + BODY_BOX.w / 2, Math.max(w.x - BODY_BOX.w / 2, d.x));
  const ny = Math.min(w.y + BODY_BOX.h / 2, Math.max(w.y - BODY_BOX.h / 2, d.y));
  return Math.hypot(nx - d.x, ny - d.y);
}

function walk(w: Walker, input: readonly [number, number], ms: number, discs: readonly Disc[], each?: () => void): void {
  for (let t = 0; t < ms; t += FRAME) {
    w.frame(input, FRAME, STEP_MS, open, discs);
    each?.();
  }
}

/** A seeded run of numbers, so the twenty trunks are the same every time. */
function rng(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a * 1664525 + 1013904223) >>> 0;
    return a / 4294967296;
  };
}

describe('trunk discs', () => {
  test("a land's feet become discs at the body's point: the drawn feet, half a tile under it, meet the painted trunk's foot", () => {
    expect(FOOT_DRAWN).toBe(ART_PX / 2);
    expect(trunkDiscsOf([[100, 300, 9]], 2, 3)).toEqual([{ x: 2 * ART_PX + 100, y: 3 * ART_PX + 300 - FOOT_DRAWN, r: 9 }]);
    // a walk north at a trunk: the body stops under its disc, and the drawn feet stand a body box's half and the radius south of the painted trunk's foot, not half a tile short of it
    const [d] = trunkDiscsOf([[700, 700, R]], 0, 0) as [Disc];
    const w = new Walker();
    w.x = 700;
    w.y = 700 + 90;
    walk(w, [0, -1], 2500, [d]);
    const drawnFoot = w.y + FOOT_DRAWN;
    expect(drawnFoot - 700).toBeGreaterThanOrEqual(R);
    expect(drawnFoot - 700).toBeLessThanOrEqual(R + BODY_BOX.h / 2 + 1);
  });

  test('a box clear of every disc is left where it is, and one inside a disc leaves it by the shortest way', () => {
    const d: Disc = { x: 200, y: 200, r: R };
    expect(pushOutOfDiscs(100, 100, [d])).toEqual([100, 100]);
    const [x, y] = pushOutOfDiscs(200 - 14 + 3, 200, [d]);
    expect(x).toBeLessThan(200 - 14 + 3);
    expect(y).toBe(200);
    const w = new Walker();
    w.x = x;
    w.y = y;
    expect(gap(w, d)).toBeGreaterThanOrEqual(R - 1e-6);
  });

  test('a walk that aims straight at each of 20 random trunks stops at the disc and never overlaps it', () => {
    const next = rng(7);
    for (let n = 0; n < 20; n++) {
      const d: Disc = { x: 640 + Math.floor(next() * 400), y: 640 + Math.floor(next() * 400), r: R };
      const w = new Walker();
      // start 60 px to the left of the trunk and aim dead at it, within a few px either way
      w.x = d.x - 60;
      w.y = d.y + Math.floor(next() * 9) - 4;
      let worst = Infinity;
      walk(w, [1, 0], 1500, [d], () => {
        worst = Math.min(worst, gap(w, d));
      });
      expect(worst, `trunk ${n}`).toBeGreaterThanOrEqual(R - 1e-6);
      expect(w.x, `trunk ${n}`).toBeLessThan(d.x - R + 1);
      expect(w.x, `trunk ${n}`).toBeGreaterThan(d.x - R - BODY_BOX.w / 2 - 2); // it came right up to the disc
    }
  });

  test('a walk that aims off the centre slides round the trunk and goes on', () => {
    const d: Disc = { x: 700, y: 700, r: R };
    const w = new Walker();
    w.x = 640;
    w.y = 700 + 10;
    walk(w, [1, 0], 2500, [d]);
    expect(w.x).toBeGreaterThan(d.x + R + BODY_BOX.w / 2 - 1);
  });

  test('the body passes between two trunks a figure apart and a wood stays crossable', () => {
    const discs: Disc[] = [];
    // a grid of trunks 50 px apart across, 50 down: a lane of 50 - 2 x 9 = 32 px between discs, wider than the 28 px box
    for (let gx = 0; gx < 6; gx++) for (let gy = 0; gy < 6; gy++) discs.push({ x: 640 + gx * 50, y: 640 + gy * 50, r: R });
    const w = new Walker();
    w.x = 665;
    w.y = 600;
    walk(w, [0, 1], 4000, discs);
    expect(w.y).toBeGreaterThan(640 + 5 * 50 + R);
    for (const d of discs) expect(gap(w, d)).toBeGreaterThanOrEqual(R - 1e-6);
  });

  test('a refused tile still wins over a disc: the body is not pushed into a wall', () => {
    const wall = (x: number, y: number) => !(x === 10 && y === 10);
    const w = new Walker();
    w.x = 10 * 64 - 14;
    w.y = 10 * 64 + 32;
    const d: Disc = { x: 10 * 64 - 14 + 14 + 1, y: 10 * 64 + 32, r: R };
    for (let i = 0; i < 20; i++) w.frame([0, 0], FRAME, STEP_MS, wall, [d]);
    expect(w.x + BODY_BOX.w / 2).toBeLessThanOrEqual(10 * 64 + 28);
    // the box never enters tile 10, 10 whatever the disc asked for
    expect(Math.floor((w.x + BODY_BOX.w / 2 - 1e-6) / 64) <= 10).toBe(true);
  });
});
