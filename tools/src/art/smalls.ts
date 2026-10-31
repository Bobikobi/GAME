/**
 * The small prop of rich wave 3d at 64 px per tile: `props/flowers_blue`, a knee-high cluster of blue bluebells on a green
 * mound (32 x 32 like flowers_white, 0.3 characters, two frames that sway). Kin of the wave 2b clusters: a leaf mass in the
 * green ramp under blooms with a dark ring.
 */
import type { PNG } from 'pngjs';

import { type Lobe, type Rgb, type Tube, drawMass, drawTubes, fillPockets, inkEdge, put, rampOf, surface } from './foliage.js';
import { type PropDraw } from './ruins.js';

const GREEN = rampOf(['#15301f', '#1f3d2b', '#2e6b3b', '#4c9a3f', '#84c450', '#c8e88a']);
const BLUE = rampOf(['#172a52', '#275a99', '#3f8fd1', '#7cc4ec', '#c4ecf8', '#f5f4ef']);
const INK_RING: Rgb = [0x1b, 0x1a, 0x2e];
const GOLD: Rgb = [0xf8, 0xde, 0x62];

/** One bluebell, a six-petal star with a pale heart, ringed in ink: `r` is the star's reach in px. */
function bloom(png: PNG, cx: number, cy: number, r: number, turn: number): void {
  const petals = 6;
  // the ring first, so neighbours and leaves do not run into the petals
  for (let dy = -r - 2; dy <= r + 2; dy += 1) {
    for (let dx = -r - 2; dx <= r + 2; dx += 1) {
      if (Math.hypot(dx, dy) <= r + 1.1) put(png, cx + dx, cy + dy, INK_RING);
    }
  }
  for (let dy = -r; dy <= r; dy += 1) {
    for (let dx = -r; dx <= r; dx += 1) {
      const d = Math.hypot(dx, dy);
      if (d > r + 0.4) continue;
      const a = Math.atan2(dy, dx) - turn;
      // petals reach farther at their middle than between
      const reach = r * (0.72 + 0.28 * Math.cos(a * petals));
      if (d > reach + 0.3) continue;
      const lit = (-dx * 0.6 - dy * 0.8) / Math.max(1, r);
      let step = d < r * 0.3 ? 5 : Math.round(3 + lit * 1.4 + (d / r) * -0.5);
      step = Math.max(2, Math.min(5, step));
      put(png, cx + dx, cy + dy, BLUE[step]!);
    }
  }
  // the heart
  put(png, cx, cy, GOLD);
  put(png, cx + 1, cy, GOLD);
}

function flowersBlue(frame: number): PNG {
  const W = 32;
  const H = 32;
  const png = surface(W, H);
  // the leaf mass sits on the foot of the canvas, 12 rows tall: the whole cluster stands as high as flowers_white (0.3 characters)
  const lobes: Lobe[] = [
    { x: 8, y: 8, r: 8 },
    { x: 16, y: 6, r: 9 },
    { x: 24, y: 8, r: 8 },
    { x: 29, y: 10, r: 5 },
    { x: 3, y: 10, r: 5 },
  ];
  drawMass(png, { ox: 0, oy: 18, w: W, h: 14, seed: 81, lobes, ramp: GREEN, clump: 5, shift: [frame, 0] });
  const sway = frame;
  const blooms: [number, number, number, number][] = [
    [8, 19, 3, 0.2],
    [16, 15, 3.5, 0.7],
    [24, 20, 3, 0.4],
    [12, 24, 2.5, 0.1],
    [21, 25, 2.5, 0.9],
  ];
  const stems: Tube[] = [];
  for (const [bx, by] of blooms) stems.push({ x0: bx - 1, y0: 28, r0: 0.7, x1: bx + sway * 0.5, y1: by + 2, r1: 0.6 });
  drawTubes(png, stems, { seed: 82, ramp: GREEN, grain: 0, tone: -0.3 });
  for (const [bx, by, r, turn] of blooms) bloom(png, Math.round(bx + sway * 0.5), by, Math.round(r), turn);
  fillPockets(png, GREEN[1]!);
  inkEdge(png);
  return png;
}

export const SMALLS: readonly PropDraw[] = [
  { id: 'props/flowers_blue', w: 32, h: 32, frames: 2, ramps: ['green'], floor: 0.25, what: 'a knee-high cluster of blue bluebells at 64 px per tile, as tall as flowers_white: five star blooms on stems over a clumped green leaf mass, the blooms leaning a pixel in the second frame', draw: flowersBlue },
];
