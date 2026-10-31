/**
 * The two small props of rich wave 3d at 64 px per tile: `props/flowers_blue` (a leafy mound with blue bluebells on stems,
 * 0.6 characters, 64 x 64, two frames that sway) and `props/hazard_wolf` (an alert grey wolf at a hazard, 0.65 characters,
 * 64 x 64, two frames: head up, head down sniffing). The flowers are the wave 2b cluster's kin (a leaf mass in the green ramp
 * under blooms with a dark ring); the wolf is tubes in the grey ramp lit from the left, a yellow eye, an ink outline.
 */
import type { PNG } from 'pngjs';

import { type Lobe, type Rgb, type Tube, drawMass, drawTubes, fillPockets, hash3, inkEdge, put, rampOf, surface } from './foliage.js';
import { type PropDraw } from './ruins.js';

const GREEN = rampOf(['#15301f', '#1f3d2b', '#2e6b3b', '#4c9a3f', '#84c450', '#c8e88a']);
const BLUE = rampOf(['#172a52', '#275a99', '#3f8fd1', '#7cc4ec', '#c4ecf8', '#f5f4ef']);
const GREY = rampOf(['#1b1a2e', '#3a3554', '#5d6177', '#8f94a8', '#c6cad6', '#f5f4ef']);
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
  const W = 64;
  const H = 64;
  const png = surface(W, H);
  const lobes: Lobe[] = [
    { x: 14, y: 22, r: 11 },
    { x: 28, y: 18, r: 13 },
    { x: 46, y: 21, r: 11 },
    { x: 22, y: 12, r: 9 },
    { x: 38, y: 11, r: 9 },
    { x: 53, y: 25, r: 8 },
    { x: 8, y: 27, r: 7 },
  ];
  // the leaf mass sits at the foot of the canvas: its box is the lowest 40 rows
  drawMass(png, { ox: 0, oy: 30, w: W, h: 34, seed: 81, lobes: lobes.map((l) => ({ ...l, y: l.y + 14 })), ramp: GREEN, clump: 8, shift: [frame * 2, frame] });
  // stems and blooms: the second frame leans each bloom a pixel
  const sway = frame;
  const blooms: [number, number, number, number][] = [
    [16, 31, 5, 0.2],
    [30, 24, 5.5, 0.7],
    [45, 30, 5, 0.4],
    [23, 41, 4.5, 0.1],
    [38, 40, 4.5, 0.9],
    [54, 40, 4, 0.3],
  ];
  const stems: Tube[] = [];
  for (const [bx, by] of blooms) stems.push({ x0: bx - 1, y0: 52, r0: 1.1, x1: bx + sway * 0.6, y1: by + 4, r1: 1 });
  drawTubes(png, stems, { seed: 82, ramp: GREEN, grain: 0, tone: -0.3 });
  for (const [bx, by, r, turn] of blooms) bloom(png, Math.round(bx + sway * 0.6), by, Math.round(r), turn);
  fillPockets(png, GREEN[1]!);
  inkEdge(png);
  return png;
}

function wolf(frame: number): PNG {
  const W = 64;
  const H = 64;
  const png = surface(W, H);
  const down = frame === 1 ? 3 : 0;
  const tail = frame === 1 ? 2 : 0;
  const tubes: Tube[] = [
    // the body and the chest
    { x0: 20, y0: 41, r0: 9.5, x1: 38, y1: 41, r1: 9 },
    { x0: 38, y0: 41, r0: 9, x1: 42, y1: 42, r1: 8.5 },
    // hind legs, near and far
    { x0: 20, y0: 47, r0: 5, x1: 18, y1: 55, r1: 3.2 },
    { x0: 18, y0: 55, r0: 3.2, x1: 19, y1: 63, r1: 2.6 },
    { x0: 27, y0: 49, r0: 3.8, x1: 27, y1: 63, r1: 2.5 },
    // forelegs
    { x0: 37, y0: 49, r0: 3.8, x1: 37, y1: 63, r1: 2.5 },
    { x0: 43, y0: 48, r0: 3.8, x1: 45, y1: 63, r1: 2.6 },
    // the neck, the head and the muzzle: the head lowers and noses forward in frame 2
    { x0: 42, y0: 38, r0: 6.5, x1: 48, y1: 32 + down, r1: 5.4 },
    { x0: 48, y0: 31 + down, r0: 5.8, x1: 51, y1: 30 + down * 1.4, r1: 5.2 },
    { x0: 54, y0: 33 + down * 1.6, r0: 3.2, x1: 60, y1: 35 + down * 1.9, r1: 2.3 },
    // the ears
    { x0: 48, y0: 27 + down, r0: 2.6, x1: 47, y1: 21 + down, r1: 1 },
    { x0: 52, y0: 27 + down, r0: 2.4, x1: 54, y1: 22 + down, r1: 1 },
    // the tail hangs, and flicks in the second frame
    { x0: 14, y0: 38, r0: 4, x1: 8 - tail, y1: 44, r1: 3 },
    { x0: 8 - tail, y0: 44, r0: 3, x1: 6 - tail * 1.5, y1: 54, r1: 1.6 },
  ];
  drawTubes(png, tubes, { seed: 91, ramp: GREY, grain: 0.8, tone: -0.1 });
  // the pale chest and muzzle, then the eye and the nose
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const i = (y * W + x) * 4;
      if (png.data[i + 3] !== 255) continue;
      const chest = Math.hypot(x - 43, y - 46) < 6 && x > 40;
      const underbelly = y > 47 && y < 51 && x > 24 && x < 40;
      if ((chest || underbelly) && hash3(92, x, y) > 0.2) put(png, x, y, GREY[4]!);
    }
  }
  put(png, 53, 30 + down, GOLD);
  put(png, 54, 30 + down, GOLD);
  put(png, 53, 31 + down, [0x1b, 0x1a, 0x2e]);
  put(png, 60, 35 + Math.round(down * 1.9), [0x1b, 0x1a, 0x2e]);
  put(png, 59, 35 + Math.round(down * 1.9), [0x1b, 0x1a, 0x2e]);
  fillPockets(png, GREY[2]!);
  inkEdge(png);
  return png;
}

export const SMALLS: readonly PropDraw[] = [
  { id: 'props/flowers_blue', w: 64, h: 64, frames: 2, ramps: ['green'], floor: 0.5, what: 'a leafy mound of blue bluebells at 64 px, about half a character tall: six star blooms on stems over a clumped green leaf mass, the blooms leaning a pixel in the second frame', draw: flowersBlue },
  { id: 'props/hazard_wolf', w: 64, h: 64, frames: 2, ramps: ['grey'], floor: 0.6, what: 'an alert grey wolf at 64 px, two thirds of a character tall: a tube body in the grey ramp lit from the left, pale chest, yellow eye, ears up; the second frame lowers the head to sniff and flicks the tail', draw: wolf },
];
