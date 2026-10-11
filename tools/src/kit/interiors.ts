/**
 * The pieces of the shop interiors, drawn in code in the core palette and
 * written into the core kit (DECISIONS.md, 2026-10-11, the shop interior).
 * Frame C is the compass: worn planks, a woven runner from the door to the
 * counter, the shopkeeper behind it, and the back wall that shows the trade.
 * A kit sprite is 64 pixels at most, so a room is laid out from pieces by the
 * game (game/src/scenes/room.ts); this file only draws them.
 *
 * Run `pnpm exec tsx tools/src/kit/interiors.ts` after changing a piece: it
 * rewrites the PNGs and their entries in content/kit/core/kit.json.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { PNG } from 'pngjs';

import { hexToRgb } from './palette.js';

// the core palette by name, dark to light within a ramp
const OUT = '#1b1a2e';
const NIGHT = '#3a3554';
const DGR = '#5d6177';
const GR = '#8f94a8';
const LGR = '#c6cad6';
const W = '#f5f4ef';
const DG = '#2e6b3b';
const G = '#4c9a3f';
const LG = '#84c450';
const PG = '#c8e88a';
const D = '#3d2618';
const B = '#6e4226';
const M = '#9e6b3c';
const L = '#c99a5e';
const C = '#ebd3a2';
const DB = '#172a52';
const BB = '#275a99';
const BL = '#3f8fd1';
const LB = '#7cc4ec';
const DKR = '#5e1c28';
const DR = '#a8302f';
const R = '#e2533f';
const SAL = '#f6a07f';
const ORG = '#b8661f';
const Y = '#eda83a';
const LY = '#f8de62';
const PK = '#d38c66';
const PU = '#9a5bb0';

/** A small deterministic random stream, so the pieces come out the same on every run. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(r: () => number, xs: readonly T[]): T {
  return xs[Math.floor(r() * xs.length)]!;
}

/** A drawing surface of palette colours; undefined is a clear pixel. */
class Pix {
  readonly px: (string | undefined)[];
  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.px = new Array<string | undefined>(w * h).fill(undefined);
  }

  p(x: number, y: number, c: string): void {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.px[y * this.w + x] = c;
  }

  get(x: number, y: number): string | undefined {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return undefined;
    return this.px[y * this.w + x];
  }

  r(x: number, y: number, w: number, h: number, c: string): void {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.p(i, j, c);
  }

  /** Recolours the pixels inside a rectangle through a ramp map: a patch of light or of shade. */
  remap(x: number, y: number, w: number, h: number, map: Readonly<Record<string, string>>): void {
    for (let j = y; j < y + h; j++) {
      for (let i = x; i < x + w; i++) {
        const c = this.get(i, j);
        if (c && map[c]) this.p(i, j, map[c]);
      }
    }
  }

  /** A text grid: '.' is clear, any other letter a colour of the legend; outline draws the dark edge around it. */
  blit(grid: readonly string[], legend: Readonly<Record<string, string>>, x: number, y: number, outline = true): void {
    const at = (i: number, j: number) => {
      const ch = grid[j]?.[i];
      return ch !== undefined && ch !== '.';
    };
    if (outline) {
      grid.forEach((row, j) => {
        for (let i = 0; i < row.length; i++) {
          if (!at(i, j)) continue;
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
            if (!at(i + dx, j + dy)) this.p(x + i + dx, y + j + dy, OUT);
          }
        }
      });
    }
    grid.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        const ch = row[i]!;
        if (ch === '.') continue;
        const c = legend[ch];
        if (!c) throw new Error(`no colour for "${ch}"`);
        this.p(x + i, y + j, c);
      }
    });
  }

  png(): PNG {
    const img = new PNG({ width: this.w, height: this.h });
    img.data.fill(0);
    this.px.forEach((c, k) => {
      if (!c) return;
      const [r, g, b] = hexToRgb(c);
      img.data[k * 4] = r;
      img.data[k * 4 + 1] = g;
      img.data[k * 4 + 2] = b;
      img.data[k * 4 + 3] = 255;
    });
    return img;
  }
}

// ------------------------------------------------------------------ walls and floor

/** A section of the plank wall, 16 wide and three tiles tall, with the skirting board at its foot. */
function wall(seed: number): Pix {
  const s = new Pix(16, 48);
  const r = rng(seed);
  s.r(0, 0, 16, 48, M);
  for (const x of [0, 8]) {
    s.r(x, 0, 1, 48, B);
    s.r(x + 1, 0, 1, 48, L);
  }
  // grain, a knot now and then, and two nails a plank
  for (let k = 0; k < 18; k++) s.p(2 + Math.floor(r() * 14), 4 + Math.floor(r() * 38), pick(r, [B, L, B]));
  for (const x of [4, 12]) {
    for (const y of [6, 23, 38]) s.p(x + (y === 23 ? 1 : 0), y, D);
  }
  if (r() < 0.6) {
    const kx = 3 + Math.floor(r() * 10);
    const ky = 12 + Math.floor(r() * 20);
    s.r(kx, ky, 2, 3, B);
    s.p(kx, ky + 1, D);
  }
  // the ceiling beam's shade at the top, the skirting board at the foot
  s.r(0, 0, 16, 3, B);
  s.r(0, 3, 16, 1, D);
  s.r(0, 43, 16, 5, B);
  s.r(0, 43, 16, 1, M);
  s.r(0, 46, 16, 1, D);
  s.r(0, 47, 16, 1, OUT);
  return s;
}

/** A floor tile of worn planks: two boards a tile, ends staggered, worn pale where people walk. */
function planks(seed: number): Pix {
  const s = new Pix(16, 16);
  const r = rng(seed);
  for (const j of [0, 8]) {
    s.r(0, j, 16, 8, M);
    s.r(0, j, 16, 1, B);
    const end = 2 + Math.floor(r() * 12);
    s.r(end, j + 1, 1, 7, B);
    s.p(end, j + 7, D);
    for (let k = 0; k < 4; k++) s.p(Math.floor(r() * 16), j + 2 + Math.floor(r() * 5), pick(r, [L, B, L, C]));
    // a worn streak along the grain
    const len = 3 + Math.floor(r() * 3);
    const wx = end > 8 ? end - 2 - len : end + 2;
    s.r(wx, j + 3 + Math.floor(r() * 3), len, 1, L);
    if (r() < 0.35) {
      const nx = 1 + Math.floor(r() * 13);
      s.p(nx, j + 4, D);
      s.p(nx + 1, j + 4, B);
    }
  }
  return s;
}

// ------------------------------------------------------------------ the back wall of the food shop

/**
 * The brick chimney breast around the lit stove: the back wall that shows a
 * kitchen. Frame C's stove filled its alcove; here it is smaller, with a
 * kettle on top, a log stack beside it and a copper pan on the bricks.
 * Three frames: the flame steps through them.
 */
function hearth(frame: number): Pix {
  const s = new Pix(64, 43);
  const r = rng(11);
  s.r(0, 0, 64, 43, D);
  for (let j = 0; j < 43; j += 5) {
    const off = (j / 5) % 2 === 0 ? 0 : 4;
    for (let i = -off; i < 64; i += 9) {
      const x1 = Math.max(0, i + 1);
      const x2 = Math.min(64, i + 9);
      if (x2 <= x1) continue;
      s.r(x1, j + 1, x2 - x1, Math.min(4, 43 - j - 1), pick(r, [DR, DR, DR, DKR]));
      if (r() < 0.5) s.p(x1, j + 1, R);
      if (r() < 0.25) s.p(x1 + Math.floor(r() * (x2 - x1)), j + 3, DKR);
    }
  }
  // the firelight warms the bricks around the opening
  s.remap(6, 10, 52, 33, { [DR]: R, [DKR]: DR, [D]: DKR });
  s.r(0, 0, 1, 43, OUT);
  s.r(63, 0, 1, 43, OUT);
  // the mantel beam
  s.r(0, 4, 64, 5, OUT);
  s.r(1, 5, 62, 3, B);
  s.r(1, 5, 62, 1, M);
  s.r(1, 7, 62, 1, D);
  // the alcove: soot at the top, a stone hearth at the foot
  const ax = 12;
  const ay = 14;
  const aw = 40;
  s.r(ax - 1, ay - 1, aw + 2, 43 - ay + 1, OUT);
  s.r(ax, ay, aw, 43 - ay, NIGHT);
  s.r(ax, ay, aw, 3, OUT);
  s.r(ax, ay + 3, aw, 1, NIGHT);
  s.r(ax, 39, aw, 4, GR);
  s.r(ax, 39, aw, 1, LGR);
  s.r(ax, 42, aw, 1, DGR);
  // the stove: a pipe into the chimney, the body, the fire door and its flame
  const sx = ax + 5;
  const sy = 24;
  s.r(sx + 7, ay, 4, sy - ay + 1, OUT);
  s.r(sx + 8, ay, 2, sy - ay, DGR);
  s.p(sx + 8, ay + 4, GR);
  s.p(sx + 8, ay + 5, GR);
  s.r(sx, sy, 18, 15, OUT);
  s.r(sx + 1, sy + 1, 16, 13, DGR);
  s.r(sx + 1, sy + 1, 16, 1, GR);
  s.r(sx + 1, sy + 13, 16, 1, NIGHT);
  s.r(sx + 3, sy + 4, 7, 7, OUT);
  s.r(sx + 4, sy + 5, 5, 5, OUT);
  const flame = [
    () => { s.r(sx + 4, sy + 8, 5, 2, Y); s.r(sx + 5, sy + 6, 3, 3, R); s.p(sx + 6, sy + 8, LY); },
    () => { s.r(sx + 4, sy + 8, 5, 2, Y); s.r(sx + 4, sy + 7, 2, 2, R); s.r(sx + 6, sy + 6, 2, 3, R); s.p(sx + 5, sy + 8, LY); s.p(sx + 7, sy + 8, LY); },
    () => { s.r(sx + 4, sy + 7, 5, 3, Y); s.r(sx + 5, sy + 5, 3, 3, R); s.p(sx + 6, sy + 7, LY); s.p(sx + 6, sy + 8, LY); },
  ];
  flame[frame % 3]!();
  s.r(sx + 11, sy + 5, 4, 1, GR);
  s.r(sx + 11, sy + 8, 4, 1, GR);
  s.p(sx + 14, sy + 11, LGR);
  // the kettle on the hob
  s.blit(['..oo...', '.oyyo..', 'oyyyyo.', 'oyyyyoo', '.oooo..'].map((row) => row.replace(/o/g, 'k')), { k: ORG, y: Y }, sx + 2, sy - 5);
  s.p(sx + 4, sy - 3, LY);
  // a stack of split logs, ends out
  const logEnd = (x: number, y: number) => {
    s.blit(['.ccc.', 'cmmmc', 'cmbmc', 'cmmmc', '.ccc.'], { c: L, m: M, b: B }, x, y);
  };
  logEnd(ax + 28, 34);
  logEnd(ax + 34, 34);
  logEnd(ax + 31, 29);
  // a copper pan hung on the bricks left of the opening, a bundle of herbs right of it
  s.r(5, 12, 1, 3, OUT);
  s.blit(['.oooo.', 'oyyyyo', 'oyyyyo', '.oooo.'].map((row) => row.replace(/o/g, 'k')), { k: ORG, y: Y }, 3, 15);
  s.r(5, 21, 1, 4, B);
  s.r(56, 9, 1, 3, B);
  s.blit(['gGg', 'GgG', 'gGg', '.g.'], { g: G, G: LG }, 55, 12);
  s.r(55, 12, 3, 1, DR);
  return s;
}

/** A window of four panes with a flower box: day, and night with a star. */
function shopWindow(night: boolean): Pix {
  const s = new Pix(22, 20);
  const x = 2;
  const y = 2;
  const sky = night ? BB : LB;
  const high = night ? DB : '#c4ecf8';
  s.r(x - 2, y - 2, 22, 18, OUT);
  s.r(x - 1, y - 1, 20, 16, B);
  s.r(x - 1, y - 1, 20, 1, M);
  s.r(x + 1, y + 1, 16, 14, OUT);
  s.r(x + 2, y + 2, 14, 12, sky);
  s.r(x + 2, y + 2, 14, 3, high);
  s.r(x + 8, y + 2, 2, 12, B);
  s.r(x + 2, y + 7, 14, 2, B);
  if (night) {
    s.p(x + 4, y + 10, LY);
    s.p(x + 13, y + 4, W);
  } else {
    s.r(x + 3, y + 3, 3, 1, W);
    s.p(x + 4, y + 4, W);
    s.r(x + 11, y + 10, 3, 1, W);
  }
  // the sill and the flower box
  s.r(x - 2, y + 15, 22, 3, OUT);
  s.r(x - 1, y + 15, 20, 2, L);
  s.r(x + 1, y + 12, 16, 3, OUT);
  s.r(x + 2, y + 13, 14, 2, M);
  [R, Y, SAL, R, Y].forEach((c, k) => {
    const i = 2 + k * 3;
    s.p(x + i, y + 11, c);
    s.p(x + i + 1, y + 12, G);
  });
  return s;
}

/** A dark shelf of jars, bottles and pots, two boards high: the medicine side of the shop. */
function jarShelf(): Pix {
  const w = 22;
  const h = 26;
  const s = new Pix(w, h);
  const r = rng(32);
  s.r(0, 0, w, h, OUT);
  s.r(1, 1, w - 2, h - 2, B);
  s.r(1, 1, w - 2, 1, M);
  s.r(2, 2, w - 4, h - 4, D);
  s.r(2, 2, w - 4, 2, OUT);
  const cols: [string, string][] = [[G, LG], [R, SAL], [Y, LY], [BL, LB], [PU, PK], [DG, G], [ORG, Y]];
  const rh = Math.floor((h - 4) / 2);
  for (let k = 0; k < 2; k++) {
    const yy = 2 + (k + 1) * rh;
    let xx = 3 + k;
    for (;;) {
      const kind = pick(r, [0, 1, 2, 0, 1]);
      const jw = kind === 0 ? 5 : kind === 1 ? 4 : 6;
      if (xx + jw > w - 2) break;
      const [c, hi] = pick(r, cols);
      if (kind === 0) {
        // a round jar with a cork
        s.r(xx + 1, yy - 8, 3, 2, OUT);
        s.p(xx + 2, yy - 8, L);
        s.r(xx, yy - 6, 5, 6, OUT);
        s.r(xx + 1, yy - 5, 3, 4, c);
        s.p(xx + 1, yy - 5, hi);
        s.p(xx + 2, yy - 3, W);
      } else if (kind === 1) {
        // a tall bottle
        s.r(xx + 1, yy - 11, 2, 3, OUT);
        s.r(xx, yy - 8, 4, 8, OUT);
        s.r(xx + 1, yy - 7, 2, 6, c);
        s.p(xx + 1, yy - 7, hi);
        s.p(xx + 2, yy - 4, W);
      } else {
        // a wide pot with a cloth tied over it
        s.r(xx, yy - 6, 6, 6, OUT);
        s.r(xx + 1, yy - 5, 4, 4, M);
        s.r(xx + 1, yy - 6, 4, 1, c);
        s.p(xx + 1, yy - 5, hi);
      }
      xx += jw + 1;
    }
    s.r(1, yy, w - 2, 2, M);
    s.r(1, yy, w - 2, 1, L);
    s.r(1, yy + 2, w - 2, 1, OUT);
  }
  return s;
}

// ------------------------------------------------------------------ the counter

/** One tile of the counter: the scrubbed top, the front with a drawer. Ends carry the outline. */
function counter(part: 'left' | 'mid' | 'right'): Pix {
  const s = new Pix(16, 18);
  s.r(0, 0, 16, 1, OUT);
  s.r(0, 1, 16, 1, W);
  s.r(0, 2, 16, 2, C);
  s.r(0, 4, 16, 1, L);
  s.r(0, 5, 16, 1, OUT);
  s.r(0, 6, 16, 10, M);
  s.r(0, 6, 16, 1, B);
  s.r(0, 15, 16, 1, D);
  s.r(0, 16, 16, 1, B);
  s.r(0, 17, 16, 1, OUT);
  // a drawer with its pull
  s.r(3, 8, 10, 6, OUT);
  s.r(4, 9, 8, 4, B);
  s.r(5, 10, 6, 2, M);
  s.p(5, 10, L);
  s.r(7, 11, 2, 1, Y);
  if (part === 'left') {
    s.r(0, 0, 1, 18, OUT);
    s.p(1, 1, C);
  }
  if (part === 'right') {
    s.r(15, 0, 1, 18, OUT);
    s.p(14, 1, C);
  }
  return s;
}

/** A pair of brass scales on the counter. */
function scale(): Pix {
  const s = new Pix(11, 10);
  s.blit(['...ly....', 'yyyyyyyyy', 'y...y...y', 'y...y...y', 'aaa.y.aaa', '.a..y..a.', '....y....', '...yyy...'], { y: Y, l: LY, a: GR }, 1, 1);
  return s;
}

/** The shop's cat, asleep as a loaf at the end of the counter: eyes open, shut, an ear that flicks. */
function cat(frame: number): Pix {
  const s = new Pix(14, 9);
  const ears = frame === 2 ? '..o.....oo..' : '..oo....oo..';
  s.blit([ears, '..oooooooo..', '.oooooooooo.', '.oooooooooo.', 'oooobooooooo', 'oooooooooooo', '.wwwoooooooo'], { o: ORG, b: B, w: C }, 1, 1);
  if (frame === 1) {
    s.r(5, 3, 1, 1, B);
    s.r(8, 3, 1, 1, B);
  } else {
    s.p(5, 3, D);
    s.p(8, 3, D);
  }
  s.p(6, 4, PK);
  s.p(10, 5, Y);
  s.p(11, 6, Y);
  return s;
}

// ------------------------------------------------------------------ the floor

/** The woven runner from the door to the counter, in three pieces: its fringed head, a length, its fringed foot. */
function runner(part: 'top' | 'mid' | 'end'): Pix {
  const w = 24;
  const s = new Pix(w, 16);
  const y0 = part === 'top' ? 2 : 0;
  const y1 = part === 'end' ? 14 : 16;
  for (let j = y0; j < y1; j++) {
    for (let k = 1; k < w - 1; k++) {
      let c = (Math.floor(j / 2) + Math.floor(k / 2)) % 2 === 0 ? BL : k % 6 === 0 ? C : DB;
      if (k < 3 || k > w - 4) c = Math.floor(j / 2) % 2 === 0 ? R : DR;
      s.p(k, j, c);
    }
    s.p(0, j, OUT);
    s.p(w - 1, j, OUT);
  }
  for (let i = 8; i < w - 6; i += 4) {
    s.p(i, y0 + 5, Y);
    s.p(i + 1, y0 + 6, Y);
  }
  if (part === 'top') {
    s.r(0, 1, w, 1, OUT);
    for (let i = 1; i < w - 1; i += 2) s.p(i, 0, C);
  }
  if (part === 'end') {
    s.r(0, 14, w, 1, OUT);
    for (let i = 1; i < w - 1; i += 2) s.p(i, 15, C);
  }
  return s;
}

/** The mat inside the door. */
function doorMat(): Pix {
  const s = new Pix(16, 8);
  s.r(0, 0, 16, 8, OUT);
  s.r(1, 1, 14, 6, DR);
  s.r(1, 1, 14, 1, R);
  s.r(1, 6, 14, 1, DKR);
  for (let i = 2; i < 14; i += 2) s.p(i, 4, Y);
  return s;
}

/** A barrel of pears: staves, two iron hoops, fruit heaped over the rim. */
function barrel(): Pix {
  const s = new Pix(14, 17);
  const x = 1;
  const y = 1;
  s.r(x, y + 3, 12, 13, OUT);
  s.r(x + 1, y + 4, 10, 11, M);
  s.r(x + 1, y + 4, 3, 11, L);
  s.r(x + 9, y + 4, 2, 11, B);
  for (const sx of [x + 4, x + 7]) s.r(sx, y + 5, 1, 9, B);
  for (const hy of [y + 6, y + 12]) {
    s.r(x + 1, hy, 10, 1, DGR);
    s.p(x + 2, hy, GR);
    s.p(x + 3, hy, GR);
  }
  s.r(x + 1, y + 2, 10, 3, OUT);
  s.r(x + 2, y + 3, 8, 1, D);
  for (const [dx, dy] of [[1, 1], [4, 0], [7, 1], [3, 2], [6, 2], [9, 2]] as const) {
    s.r(x + dx, y + dy - 1, 3, 3, OUT);
    s.r(x + dx, y + dy, 2, 2, LG);
    s.p(x + dx, y + dy, PG);
    s.p(x + dx + 1, y + dy - 1, B);
  }
  return s;
}

/** A crate of mushrooms: two slats, corner posts, nails, caps heaped over the top. */
function crate(): Pix {
  const s = new Pix(18, 16);
  const x = 1;
  const y = 3;
  s.r(x, y + 2, 16, 11, OUT);
  s.r(x + 1, y + 3, 14, 9, M);
  s.r(x + 1, y + 3, 14, 1, L);
  s.r(x + 1, y + 7, 14, 1, B);
  s.r(x + 1, y + 8, 14, 1, L);
  s.r(x + 1, y + 11, 14, 1, D);
  s.r(x + 1, y + 3, 2, 9, B);
  s.r(x + 13, y + 3, 2, 9, B);
  for (const [nx, ny] of [[2, 4], [13, 4], [2, 9], [13, 9]] as const) s.p(x + nx, y + ny, LGR);
  s.r(x + 6, y + 9, 4, 1, D);
  // the mushroom caps, pale with spots, and a stem or two between them
  const caps = [[1, 0], [5, -1], [9, 0], [12, -1], [3, 1], [8, 1]] as const;
  for (const [cx, cy] of caps) {
    s.blit(['.cc.', 'cCCc'], { c: L, C: C }, x + cx, y + cy - 1);
  }
  s.p(x + 6, y, W);
  s.p(x + 11, y, W);
  s.p(x + 4, y + 1, W);
  return s;
}

/** A sack of flour: tied at the neck with red cord, a dusting of flour, a wheat mark printed on. */
function sack(): Pix {
  const s = new Pix(13, 15);
  s.blit(
    ['...cc.cc...', '....ccc....', '...rrrrr...', '..ccccccc..', '.ccccccccc.', 'ccCcccccccc', 'cCCcccyccLc', 'cCcccyyycLc', 'cccccyyccLc', 'ccccccyccLc', 'cccccccccLc', '.cccccccLL.', '..LLLLLLL..'],
    { c: C, C: W, r: R, y: Y, L: L },
    1,
    1,
  );
  return s;
}

/** A potted herb by the door. */
function plant(): Pix {
  const s = new Pix(12, 13);
  s.blit(['..g..g...', '.gGg.gG..', 'gGgGgGgg.', '.gGgGgG..', '..gGgg...', '...gG....'], { g: G, G: LG }, 1, 1);
  s.blit(['cccccccc', 'cddddddc', '.cddddc.', '.cddddc.', '..cccc..'], { c: PK, d: M }, 2, 7);
  s.r(3, 8, 6, 1, R);
  s.p(3, 4, PU);
  s.p(7, 2, R);
  return s;
}

// ------------------------------------------------------------------ outside

/** The board hung by a shop's door: a bowl, a leaf and an apple say food and medicine before a word is read. */
function foodSign(): Pix {
  const s = new Pix(16, 16);
  s.r(0, 0, 16, 2, OUT);
  s.r(1, 0, 14, 1, DGR);
  s.r(3, 2, 1, 3, OUT);
  s.r(12, 2, 1, 3, OUT);
  s.r(1, 5, 14, 11, OUT);
  s.r(2, 6, 12, 9, L);
  s.r(2, 6, 12, 1, C);
  s.r(2, 14, 12, 1, M);
  // the bowl
  s.r(3, 10, 7, 3, C);
  s.r(4, 13, 5, 1, C);
  s.r(3, 10, 7, 1, W);
  s.p(3, 12, B);
  s.p(9, 12, B);
  // a leaf over the bowl and an apple beside it
  s.r(5, 8, 2, 2, G);
  s.p(7, 7, LG);
  s.p(6, 8, LG);
  s.r(10, 8, 3, 3, R);
  s.p(10, 8, SAL);
  s.p(11, 7, G);
  return s;
}

// ------------------------------------------------------------------ writing the kit

interface Piece {
  name: string;
  frames: Pix[];
}

export const PIECES: readonly Piece[] = [
  { name: 'tiles/planks', frames: [planks(5)] },
  { name: 'tiles/planks_1', frames: [planks(17)] },
  { name: 'tiles/planks_2', frames: [planks(29)] },
  { name: 'props/room_wall', frames: [wall(3)] },
  { name: 'props/room_wall_1', frames: [wall(8)] },
  { name: 'props/hearth', frames: [hearth(0), hearth(1), hearth(2)] },
  { name: 'props/shop_window', frames: [shopWindow(false), shopWindow(true)] },
  { name: 'props/jar_shelf', frames: [jarShelf()] },
  { name: 'props/counter_left', frames: [counter('left')] },
  { name: 'props/counter', frames: [counter('mid')] },
  { name: 'props/counter_right', frames: [counter('right')] },
  { name: 'props/scale', frames: [scale()] },
  { name: 'props/shop_cat', frames: [cat(0), cat(1), cat(2)] },
  { name: 'props/runner_top', frames: [runner('top')] },
  { name: 'props/runner', frames: [runner('mid')] },
  { name: 'props/runner_end', frames: [runner('end')] },
  { name: 'props/door_mat', frames: [doorMat()] },
  { name: 'props/pear_barrel', frames: [barrel()] },
  { name: 'props/mushroom_crate', frames: [crate()] },
  { name: 'props/flour_sack', frames: [sack()] },
  { name: 'props/potted_herb', frames: [plant()] },
  { name: 'props/shop_sign_food', frames: [foodSign()] },
];

/** Frames side by side, as the kit expects a sheet. */
function sheet(piece: Piece): PNG {
  const { w, h } = piece.frames[0]!;
  const all = new Pix(w * piece.frames.length, h);
  piece.frames.forEach((f, k) => {
    if (f.w !== w || f.h !== h) throw new Error(`${piece.name}: frame ${k} is ${f.w}x${f.h}, not ${w}x${h}`);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) all.px[y * all.w + k * w + x] = f.get(x, y);
  });
  return all.png();
}

export function writeInteriors(kitDir = join(dirname(fileURLToPath(import.meta.url)), '../../../content/kit/core')): string[] {
  const kitPath = join(kitDir, 'kit.json');
  const kit = JSON.parse(readFileSync(kitPath, 'utf8')) as { kit: { sprites: Record<string, { file: string; w: number; h: number; frames?: number }> } };
  const written: string[] = [];
  for (const piece of PIECES) {
    const file = `${piece.name}.png`;
    writeFileSync(join(kitDir, file), PNG.sync.write(sheet(piece)));
    const { w, h } = piece.frames[0]!;
    kit.kit.sprites[piece.name] = piece.frames.length > 1 ? { file, w, h, frames: piece.frames.length } : { file, w, h };
    written.push(file);
  }
  writeFileSync(kitPath, `${JSON.stringify(kit, null, 2)}\n`);
  return written;
}

const invokedPath = process.argv[1];
if (invokedPath !== undefined && import.meta.url === pathToFileURL(invokedPath).href) {
  console.log(`Wrote ${writeInteriors().length} interior pieces into the core kit`);
}
