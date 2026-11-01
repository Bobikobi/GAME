/**
 * The rubble at 64 px (rich wave 3b): a heap of broken stone, four variants. Angular chunks of the grey ramp lie over
 * a dark ground, lit from the upper left (a pale top edge, a mid face, a shaded foot), each with a pixel of ink all
 * round, a cast shadow to the lower right, and now and then a crack or a touch of moss. The chunks on the tile's edges
 * are the same in every variant (and wrap), the ones inside are the variant's own, so the four variants meet with no
 * stone cut at an edge. `pnpm art:rubble` writes the PNGs.
 */
import { TILE, blank, hash3, writeScripted } from './scripted.js';

interface Chunk {
  x: number;
  y: number;
  r: number;
  poly: [number, number][];
  crack: boolean;
  moss: boolean;
  key: number;
}

function make(seed: number, key: number, x: number, y: number, r: number): Chunk {
  const n = 5 + Math.floor(hash3(seed + 4, key, 0) * 3);
  const poly: [number, number][] = [];
  for (let v = 0; v < n; v += 1) {
    const a = ((v + hash3(seed + 5, key, v) * 0.5) / n) * Math.PI * 2;
    const rad = r * (0.7 + hash3(seed + 6, key, v) * 0.35);
    poly.push([Math.cos(a) * rad, Math.sin(a) * rad * 0.78]);
  }
  return { x, y, r, poly, crack: hash3(seed + 7, key, 0) < 0.45, moss: hash3(seed + 8, key, 0) < 0.22, key };
}

/** The same in every variant: chunks sitting on the top and left edges (drawn again a tile over), so any two variants meet on the same stones. */
const SHARED = 3;
function sharedChunks(): Chunk[] {
  const out: Chunk[] = [];
  for (let t = 0; t < 5; t += 1) out.push(make(SHARED, t, (t + 0.1 + hash3(SHARED, t, 20) * 0.8) * (TILE / 5), (hash3(SHARED, t, 21) - 0.5) * 6, 9 + hash3(SHARED, t, 22) * 5));
  for (let t = 0; t < 5; t += 1) out.push(make(SHARED, 10 + t, (hash3(SHARED, t, 23) - 0.5) * 6, (t + 0.1 + hash3(SHARED, t, 24) * 0.8) * (TILE / 5), 9 + hash3(SHARED, t, 25) * 5));
  return out;
}

/** The variant's own chunks, wholly inside the tile and clear of its edge band, so they differ from variant to variant. */
function ownChunks(seed: number): Chunk[] {
  const out: Chunk[] = [];
  for (let j = 0; j < 3; j += 1) {
    for (let i = 0; i < 3; i += 1) {
      for (let k = 0; k < 2; k += 1) {
        const key = 100 + (j * 3 + i) * 2 + k;
        if (k === 1 && hash3(seed + 16, key, 0) > 0.55) continue;
        const r = k === 0 ? 8.5 + hash3(seed + 1, key, 0) * 4.5 : 5 + hash3(seed + 1, key, 0) * 3;
        const c = make(seed, key, 11 + (i + hash3(seed + 2, key, 0)) * 14, 11 + (j + hash3(seed + 3, key, 0)) * 14, r);
        const ex = Math.max(...c.poly.map(([px]) => Math.abs(px))) + 2;
        const ey = Math.max(...c.poly.map(([, py]) => Math.abs(py))) + 2;
        out.push({ ...c, x: Math.min(TILE - 7 - ex, Math.max(7 + ex, c.x)), y: Math.min(TILE - 7 - ey, Math.max(7 + ey, c.y)) });
      }
    }
  }
  return out;
}

function inside(poly: readonly [number, number][], px: number, py: number): boolean {
  let hit = false;
  for (let a = 0, b = poly.length - 1; a < poly.length; b = a++) {
    const [ax, ay] = poly[a]!;
    const [bx, by] = poly[b]!;
    if (ay > py !== by > py && px < ((bx - ax) * (py - ay)) / (by - ay) + ax) hit = !hit;
  }
  return hit;
}

/** One variant as rows of palette letters. */
export function rubbleRows(seed: number): string[] {
  const g = blank('d');
  // the ground between the chunks: dark, a few ink and mid specks
  for (let y = 0; y < TILE; y += 1) {
    for (let x = 0; x < TILE; x += 1) {
      const v = hash3(seed + 9, x, y);
      g[y]![x] = v < 0.07 ? 'o' : v > 0.97 ? 'g' : 'd';
    }
  }
  // the shared edge chunks in nine copies a tile apart, the variant's own once; all painted from the top down
  const copies: { c: Chunk; ox: number; oy: number }[] = ownChunks(seed).map((c) => ({ c, ox: 0, oy: 0 }));
  for (const c of sharedChunks()) for (let oy = -TILE; oy <= TILE; oy += TILE) for (let ox = -TILE; ox <= TILE; ox += TILE) copies.push({ c, ox, oy });
  copies.sort((a, b) => a.c.y + a.oy - (b.c.y + b.oy) || a.c.key - b.c.key);
  const set = (x: number, y: number, ch: string): void => {
    if (x >= 0 && y >= 0 && x < TILE && y < TILE) g[y]![x] = ch;
  };
  for (const { c, ox, oy } of copies) {
    const cx = c.x + ox;
    const cy = c.y + oy;
    if (cx < -c.r * 2 || cy < -c.r * 2 || cx > TILE + c.r * 2 || cy > TILE + c.r * 2) continue;
    const x0 = Math.floor(cx - c.r * 1.3);
    const y0 = Math.floor(cy - c.r);
    const hit = (x: number, y: number): boolean => inside(c.poly, x + 0.5 - cx, y + 0.5 - cy);
    // the cast shadow, two pixels to the lower right, only on the ground
    for (let y = y0; y <= y0 + c.r * 2 + 3; y += 1) {
      for (let x = x0; x <= x0 + c.r * 2.6 + 3; x += 1) {
        if (!hit(x, y) && (hit(x - 1, y - 1) || hit(x - 2, y - 1) || hit(x - 1, y - 2))) {
          const row = g[y];
          if (row && row[x] !== undefined && (row[x] === 'd' || row[x] === 'g')) row[x] = 'o';
        }
      }
    }
    for (let y = y0; y <= y0 + c.r * 2 + 1; y += 1) {
      for (let x = x0; x <= x0 + c.r * 2.6 + 1; x += 1) {
        if (!hit(x, y)) continue;
        const edge = !hit(x - 1, y) || !hit(x + 1, y) || !hit(x, y - 1) || !hit(x, y + 1);
        if (edge) {
          set(x, y, 'o');
          continue;
        }
        const u = (x + 0.5 - cx) / c.r;
        const v = (y + 0.5 - cy) / (c.r * 0.78);
        const lit = u + v;
        // a top face above a front face: the top is a step lighter
        const top = v < -0.15 + (hash3(c.key + seed, x >> 2, y >> 2) - 0.5) * 0.3;
        let ch = lit < -0.9 ? 'H' : lit < -0.15 ? 'G' : lit < 0.55 ? 'g' : 'd';
        if (top && ch === 'g') ch = 'G';
        if (!top && ch === 'H') ch = 'G';
        // the foot of the face dithers into the shade
        if (v > 0.45 && (x + y) % 2 === 0 && ch === 'g') ch = 'd';
        if (hash3(seed + 11, x, y) < 0.05 && ch !== 'H') ch = ch === 'G' ? 'g' : ch === 'g' ? 'd' : ch;
        set(x, y, ch);
      }
    }
    if (c.crack) {
      let px = cx - c.r * 0.2 + hash3(seed + 12, c.key, 1) * c.r * 0.4;
      let py = cy - c.r * 0.5;
      for (let s = 0; s < c.r * 1.1; s += 1) {
        px += (hash3(seed + 13, c.key, s) - 0.45) * 1.6;
        py += 0.8;
        if (hit(Math.round(px), Math.round(py)) && hit(Math.round(px), Math.round(py + 1))) set(Math.round(px), Math.round(py), 'd');
      }
    }
    if (c.moss) {
      for (let s = 0; s < 7; s += 1) {
        const mx = Math.round(cx - c.r * 0.5 + hash3(seed + 14, c.key, s) * c.r * 0.9);
        const my = Math.round(cy - c.r * 0.55 + hash3(seed + 15, c.key, s) * c.r * 0.35);
        if (hit(mx, my) && hit(mx - 1, my) && hit(mx, my - 1)) set(mx, my, s % 3 === 0 ? 'c' : 'b');
      }
    }
  }
  return g.map((r) => r.join(''));
}

const NAMES = ['rubble', 'rubble_1', 'rubble_2', 'rubble_3'] as const;

/** Writes the four PNGs, their kit.json entries and one manifest line each. */
export function writeRubble(): string[] {
  return writeScripted(
    'tools/src/art/rubble.ts',
    'a heap of broken stone at 64 px, wrapping',
    ['grey'],
    NAMES.map((name, i) => ({ name, frames: [rubbleRows(211 + i * 29)] })),
  );
}
