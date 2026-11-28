/**
 * Trunk discs (private #44 step H1w, the owner of 24.11: the figure on its free walk passes between the trees as it wants, not into a trunk). The walk's tiles are 64 art px, too coarse to hold a trunk: a refused
 * tile under every foot closes a wood (open share 24 to 52% in the valley's woods, three of them uncrossable), an open tile lets the body through the trunk. A painted land carries one small disc per trunk foot
 * (`feet` in scene.json); the Walker pushes its box out of every disc it overlaps, so crowns stay open and trunks block at pixel precision. Pure: no renderer, no bundle.
 */
import { describe, expect, test } from 'vitest';

import { STEP_MS } from '../src/config';
import { ART_PX, BODY_BOX, type Disc, FOOT_DRAWN, Walker, pushOutOfDiscs, trunkDiscsOf } from '../src/walking';

const FRAME = 16;
const REACH = (ART_PX * FRAME) / STEP_MS;
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
    // On first contact from the south, the drawn feet are a body box's half and the radius from the painted trunk's foot.
    const [d] = trunkDiscsOf([[700, 700, R]], 0, 0) as [Disc];
    const w = new Walker();
    w.x = 700;
    w.y = d.y + R + BODY_BOX.h / 2 + REACH / 2;
    walk(w, [0, -1], FRAME, [d]);
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

  test('a walk that aims straight at each of 20 random trunks reaches the disc without overlapping it', () => {
    const next = rng(7);
    for (let n = 0; n < 20; n++) {
      const d: Disc = { x: 640 + Math.floor(next() * 400), y: 640 + Math.floor(next() * 400), r: R };
      const w = new Walker();
      // start 60 px to the left of the trunk and aim dead at it, within a few px either way
      w.x = d.x - 60;
      w.y = d.y + Math.floor(next() * 9) - 4;
      let worst = Infinity;
      let contactX: number | undefined;
      walk(w, [1, 0], 1500, [d], () => {
        const distance = gap(w, d);
        worst = Math.min(worst, distance);
        if (distance <= R + 1e-6) contactX ??= w.x;
      });
      expect(worst, `trunk ${n}`).toBeGreaterThanOrEqual(R - 1e-6);
      expect(contactX, `trunk ${n}`).toBeCloseTo(d.x - R - BODY_BOX.w / 2, 6);
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

  // Start at contact. The collision diameter along the input includes the length of the body box.
  test.each([
    { direction: 'up', dx: 0, dy: -1 },
    { direction: 'down', dx: 0, dy: 1 },
    { direction: 'left', dx: -1, dy: 0 },
    { direction: 'right', dx: 1, dy: 0 },
  ])('B1: a head-on walk $direction clears the trunk on the clockwise side', ({ dx, dy }) => {
    const d: Disc = { x: 640, y: 640, r: R };
    const half = dx ? BODY_BOX.w / 2 : BODY_BOX.h / 2;
    const frames = Math.ceil((1.5 * 2 * (R + half)) / REACH);
    const w = new Walker();
    w.x = d.x - dx * (R + half);
    w.y = d.y - dy * (R + half);
    let last = w.tile();
    for (let i = 0; i < frames; i++) {
      const { x, y } = w;
      for (const tile of w.frame([dx, dy], FRAME, STEP_MS, open, [d])) {
        expect(Math.abs(tile[0] - last[0]) + Math.abs(tile[1] - last[1])).toBe(1);
        last = tile;
      }
      expect(last).toEqual(w.tile());
      expect(gap(w, d)).toBeGreaterThanOrEqual(R - 1e-6);
      // The new sideways step at the flat face spends at most one frame's reach.
      if (i === 0) expect(Math.hypot(w.x - x, w.y - y)).toBeLessThanOrEqual(REACH + 1e-6);
    }
    expect(dx * (w.x - d.x) + dy * (w.y - d.y), `forward after ${frames} frames`).toBeGreaterThan(R);
    expect(-dy * (w.x - d.x) + dx * (w.y - d.y)).toBeGreaterThan(0);
  });

  test.each([{ side: 'right', offset: 2 }, { side: 'left', offset: -2 }])('B2: a 2 px offset sends the body around the $side side', ({ offset }) => {
    const d: Disc = { x: 640, y: 640, r: R };
    const w = new Walker();
    w.x = d.x + offset;
    w.y = d.y + R + BODY_BOX.h / 2;
    walk(w, [0, -1], 10 * FRAME, [d], () => {
      expect(Math.sign(w.x - d.x)).toBe(Math.sign(offset));
      expect(gap(w, d)).toBeGreaterThanOrEqual(R - 1e-6);
    });
    expect(w.y).toBeLessThan(d.y - R);
  });

  test('B3: a refused tile blocks the clockwise slide without the box entering it, and the body goes round by the other side', () => {
    const wallX = 10;
    const d: Disc = { x: wallX * ART_PX - BODY_BOX.w / 2, y: 10 * ART_PX + 32, r: R };
    const wall = (x: number, y: number) => x !== wallX || y !== 10;
    const startY = d.y + R + BODY_BOX.h / 2;
    const w = new Walker();
    w.x = d.x;
    w.y = startY;
    for (let i = 0; i < 40; i++) {
      w.frame([0, -1], FRAME, STEP_MS, wall, [d]);
      expect(w.x + BODY_BOX.w / 2).toBeLessThanOrEqual(wallX * ART_PX);
      expect(w.x).toBeLessThanOrEqual(d.x);
      expect(gap(w, d)).toBeGreaterThanOrEqual(R - 1e-6);
    }
    expect(w.y).toBeLessThan(d.y - R);
    // The same first step on open ground would put the box across the refused tile's edge.
    const free = new Walker();
    free.x = d.x;
    free.y = startY;
    free.frame([0, -1], FRAME, STEP_MS, open, [d]);
    expect(free.x + BODY_BOX.w / 2).toBeGreaterThan(wallX * ART_PX);
  });

  test('B3b: a refused tile on the clockwise side and a trunk on the other: the body stops, inside neither', () => {
    const wallX = 10;
    const d: Disc = { x: wallX * ART_PX - BODY_BOX.w / 2, y: 10 * ART_PX + 32, r: R };
    const beside: Disc = { x: d.x - BODY_BOX.w / 2 - R - 1, y: d.y + R + BODY_BOX.h / 2, r: R };
    const wall = (x: number, y: number) => x !== wallX || y !== 10;
    const startY = d.y + R + BODY_BOX.h / 2;
    const w = new Walker();
    w.x = d.x;
    w.y = startY;
    for (let i = 0; i < 20; i++) {
      expect(w.frame([0, -1], FRAME, STEP_MS, wall, [d, beside])).toEqual([]);
      expect(w.x + BODY_BOX.w / 2).toBeLessThanOrEqual(wallX * ART_PX);
      expect(w.y).toBeCloseTo(startY, 6);
      expect(w.moving).toBe(false);
      expect(gap(w, d)).toBeGreaterThanOrEqual(R - 1e-6);
      expect(gap(w, beside)).toBeGreaterThanOrEqual(R - 1e-6);
    }
  });

  test('a diagonal sideways step reports both tile entries in order', () => {
    const w = new Walker();
    w.x = 10 * ART_PX + 1;
    w.y = 10 * ART_PX - 1;
    const corner = R * Math.SQRT1_2;
    const d: Disc = { x: w.x + BODY_BOX.w / 2 + corner, y: w.y + BODY_BOX.h / 2 + corner, r: R };
    expect(w.frame([1, 1], FRAME, STEP_MS, open, [d])).toEqual([[9, 9], [9, 10]]);
    expect(w.tile()).toEqual([9, 10]);
    expect(gap(w, d)).toBeGreaterThanOrEqual(R - 1e-6);
  });

  test.each([
    { d: { x: 656, y: 688, r: R }, dx: 1, dy: 0 },
    { d: { x: 658, y: 656, r: R }, dx: 0, dy: 1 },
  ])('a walk around a trunk near a tile corner reports only adjacent entries', ({ d, dx, dy }) => {
    const w = new Walker();
    w.x = d.x - dx * (R + BODY_BOX.w / 2);
    w.y = d.y - dy * (R + BODY_BOX.h / 2);
    let last = w.tile();
    for (let i = 0; i < 13; i++) {
      for (const tile of w.frame([dx, dy], FRAME, STEP_MS, open, [d])) {
        expect(Math.abs(tile[0] - last[0]) + Math.abs(tile[1] - last[1])).toBe(1);
        last = tile;
      }
      expect(last).toEqual(w.tile());
      expect(gap(w, d)).toBeGreaterThanOrEqual(R - 1e-6);
    }
    expect(dx * (w.x - d.x) + dy * (w.y - d.y)).toBeGreaterThan(R);
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

  test('a head-on trunk with a second trunk on the offset side: the body goes round by the other side (the painted grove at 3,14, public #919)', () => {
    // the load walk on the painted valley (GPU run of 28.11): left along row 14, the body 1 px above the trunk ahead's centre, so the
    // offset side is up, where a second trunk stands; the walk stopped there for 400 frames while the side below was clear
    const ahead: Disc = { x: 225, y: 934, r: R };
    const above: Disc = { x: 250, y: 916, r: R };
    const w = new Walker();
    w.x = 248;
    w.y = 933;
    for (let i = 0; i < 200; i++) {
      // the frame and the tile time of that run: 25 ms a frame, a tile in 175 ms
      w.frame([-1, 0], 25, 175, open, [ahead, above]);
      expect(gap(w, ahead)).toBeGreaterThanOrEqual(R - 1e-6);
      expect(gap(w, above)).toBeGreaterThanOrEqual(R - 1e-6);
    }
    expect(w.x).toBeLessThan(ahead.x - R - BODY_BOX.w / 2);
    expect(w.y).toBeGreaterThan(ahead.y - BODY_BOX.h / 2);
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
