/**
 * The ruin props at 64 px per tile (rich wave 3d), drawn to the heights the scale audit set: `props/ruin_pillar` (1.65
 * characters, 64 x 128), `props/ruin_wall` (1.2, 128 x 128), `props/ruin_arch` (1.6, 128 x 128), `props/statue_head` (1.55,
 * 128 x 128) and `props/totem` (1.65, 64 x 128). A character is 73 art px. Each is a silhouette lit as stone (stoneworks.ts: a
 * lit upper-left rim, a dark lower-right rim, chisel grain, cracks, moss on the upward faces and a wet dark foot) with the
 * piece's own form on top: a column's roundness and drum joints, masonry courses, an arch's voussoirs, a face carved
 * from a height field, a pole's stacked faces. The sprite stands on its bottom centre.
 */
import { type Rgb, hash3, inkEdge, fillPockets, noise, opaqueHeight, put, rampOf, surface } from './foliage.js';
import { chipped, drawStone, maskOf } from './stoneworks.js';
import type { PNG } from 'pngjs';

/** Art px of one character's opaque height (`chars/human_down`, NATURE section 1). */
export const CHARACTER_PX = 73;

export const STONE = rampOf(['#1e2230', '#333b4c', '#4a5668', '#6f7d8c', '#9aa7b0', '#d6ddd8']);
export const MOSS = rampOf(['#1b2a16', '#2f4722', '#4a6a2c', '#6f8d36', '#9cb24c', '#cfd36e']);
const OCHRE: Rgb = [0x9e, 0x6b, 0x3c];
const OCHRE_LIGHT: Rgb = [0xc9, 0x9a, 0x5e];

export interface PropDraw {
  /** The sprite's id in the core kit. */
  id: string;
  w: number;
  h: number;
  frames: number;
  ramps: readonly string[];
  what: string;
  /** The target height in characters, a tenth under passes. */
  floor: number;
  draw: (frame: number) => PNG;
}

/** The pocket fill, then the ink outline: what every kit sprite wears. */
export function finish(png: PNG): PNG {
  fillPockets(png, STONE[1]!);
  inkEdge(png);
  return png;
}

/** A straight line through points, linearly interpolated at x. */
function profile(points: readonly (readonly [number, number])[], x: number): number {
  if (x <= points[0]![0]) return points[0]![1];
  for (let i = 0; i + 1 < points.length; i += 1) {
    const [x0, y0] = points[i]!;
    const [x1, y1] = points[i + 1]!;
    if (x <= x1) return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  }
  return points[points.length - 1]![1];
}

/** A masonry course grid: rows `ch` tall counted up from `floor`, joints staggered, blocks `bw` wide give or take. Returns the joint pixel weight and the block's own tone. */
function courseAt(seed: number, x: number, y: number, floor: number, ch: number, bw: number): { joint: number; tone: number; lit: number } {
  const row = Math.floor((floor - y) / ch);
  const inRow = (floor - y) - row * ch;
  const stagger = hash3(seed, row, 1) * bw;
  const bx = x + stagger;
  const col = Math.floor(bx / bw);
  const wob = Math.round((hash3(seed + 1, row, col) - 0.5) * 6);
  const inCol = bx - col * bw + wob;
  let joint = 0;
  if (inRow === 0) joint = 1;
  else if (inCol === 0 || inCol === bw) joint = 0.8;
  const tone = (hash3(seed + 2, row, col) - 0.5) * 0.9;
  // the upper-left edge of a block catches the light, a row below a joint
  const lit = inRow === ch - 1 || inCol === 1 ? 0.5 : 0;
  return { joint, tone, lit };
}

function pillar(): PNG {
  const W = 64;
  const H = 128;
  const png = surface(W, H);
  const chip = chipped(11, 1.6, 5);
  const cx = 32;
  const shaftHw = (y: number): number => 15 - (y < 50 ? 1 : 0) + (y > 96 ? 0 : 0);
  const drift = (y: number): number => (y < 46 ? 1 : y < 80 ? -1 : 0);
  const topY = (x: number): number => 8 + (x - 14) * 0.5 + (noise(12, x, 3, 4) - 0.5) * 8;
  const mask = maskOf(W, H, (x0, y0) => {
    const [x, y] = chip(x0, y0);
    if (y > H - 1) return false;
    if (y >= 108) {
      // the plinth: wider, its corners cut
      const hw = 22 - Math.max(0, 3 - (H - 1 - y)) * 0;
      return Math.abs(x - cx) <= hw && (y < 112 || Math.abs(x - cx) <= hw - 1);
    }
    if (y < topY(x)) return false;
    return Math.abs(x - (cx + drift(y))) <= shaftHw(y);
  });
  drawStone(png, mask, {
    seed: 21,
    stone: STONE,
    moss: MOSS,
    bevel: 4,
    cracks: 1.2,
    moss_amount: 1.0,
    foot: 12,
    form: (x, y) => {
      if (y >= 108) {
        // the plinth: flat faces, a lit chamfer along its top
        return y < 112 ? 0.9 : -0.2 + (x > 44 ? -0.8 : 0);
      }
      // a round shaft: lit on the left, dark on the right
      const u = (x - (cx + drift(y))) / shaftHw(y);
      let v = -u * 1.9;
      // drum joints
      for (const j of [46, 80]) {
        if (y === j) v -= 1.7;
        else if (y === j + 1) v += 0.5;
      }
      // faint flutes
      for (const f of [-0.45, 0.1, 0.62]) if (Math.abs(u - f) < 0.05) v -= 0.55;
      return v;
    },
  });
  return finish(png);
}

function wall(): PNG {
  const W = 128;
  const H = 128;
  const png = surface(W, H);
  const chip = chipped(31, 1.4, 5);
  const top = [[3, 52], [18, 40], [34, 50], [48, 70], [62, 92], [74, 84], [90, 60], [104, 56], [126, 74]] as const;
  const mask = maskOf(W, H, (x0, y0) => {
    const [x, y] = chip(x0, y0);
    if (x < 3 || x > 125 || y > H - 1) return false;
    return y >= profile(top, x) + (noise(32, x, 5, 5) - 0.5) * 6;
  });
  drawStone(png, mask, {
    seed: 33,
    stone: STONE,
    moss: MOSS,
    bevel: 4,
    cracks: 0.8,
    moss_amount: 1.0,
    foot: 9,
    form: (x, y) => {
      const c = courseAt(34, x, y, H - 1, 18, 30);
      return c.tone + c.lit - c.joint * 1.7;
    },
  });
  return finish(png);
}

function arch(): PNG {
  const W = 128;
  const H = 128;
  const png = surface(W, H);
  const chip = chipped(41, 1.3, 5);
  const cx = 64;
  const cy = 68;
  const outer = 58;
  const inner = 32;
  const ringAngle = (x: number, y: number): number => Math.atan2(cy - y, x - cx);
  const mask = maskOf(W, H, (x0, y0) => {
    const [x, y] = chip(x0, y0);
    if (y > H - 1) return false;
    const d = Math.hypot(x - cx, y - cy);
    const a = ringAngle(x, y);
    // the ring, its right end broken off in a jagged line
    if (y <= cy && d <= outer && d >= inner) {
      const cut = 0.55 + (noise(42, x, y, 6) - 0.5) * 0.5;
      if (a >= cut || a < 0) return true;
    }
    // the left jamb stands whole, the right one is a stump
    if (y > cy - 2 && x >= 6 && x <= 32) return true;
    if (y > 84 + (noise(43, x, 2, 6) - 0.5) * 12 && x >= 96 && x <= 122) return true;
    return false;
  });
  drawStone(png, mask, {
    seed: 44,
    stone: STONE,
    moss: MOSS,
    bevel: 5,
    cracks: 0.9,
    moss_amount: 0.55,
    foot: 9,
    form: (x, y) => {
      const d = Math.hypot(x - cx, y - cy);
      if (y <= cy && d >= inner - 2 && d <= outer + 2) {
        // voussoirs: radial joints every 15 degrees, each stone on its own tone
        const a = ringAngle(x, y);
        const seg = a * (12 / Math.PI);
        const k = Math.floor(seg);
        const joint = Math.abs(seg - Math.round(seg)) * (d / 8) < 0.5 ? 1 : 0;
        const tone = (hash3(45, k, 1) - 0.5) * 0.9;
        // the inside of the ring turns away from the light: darker toward the inner edge
        return tone - joint * 1.7 + (d - (inner + outer) / 2) * 0.012;
      }
      const c = courseAt(46, x, y, H - 1, 16, 26);
      return c.tone + c.lit - c.joint * 1.7;
    },
  });
  return finish(png);
}

/**
 * The head's height field in the head's own frame (the face looks at us, the crown is up): an egg with a brow, sockets,
 * a nose, a mouth and a band of hair, eroded. The fallen head is this field turned onto its side.
 */
function faceHeight(x: number, y: number): number {
  const cx = 64;
  const cy = 68;
  const rx = 50;
  const ry = 59;
  const blob = (bx: number, by: number, sx: number, sy: number): number => Math.exp(-(((x - bx) / sx) ** 2 + ((y - by) / sy) ** 2));
  const v = (y - cy) / ry;
  const u = (x - cx) / (rx * (1 - 0.24 * Math.max(0, v) ** 1.5));
  const r2 = u * u + v * v;
  if (r2 > 1.25) return -1;
  let h = Math.sqrt(Math.max(0, 1 - r2)) * 44;
  // brow ridge, then the sockets under it
  h += blob(cx, cy - 12, 38, 5) * 14;
  h -= blob(cx - 19, cy - 3, 9, 6) * 32;
  h -= blob(cx + 19, cy - 3, 9, 6) * 32;
  // the nose: a ridge down the middle, a shadowed wing
  h += blob(cx, cy + 10, 6, 18) * 17;
  h -= blob(cx + 8, cy + 24, 5, 3.5) * 5;
  h -= blob(cx - 8, cy + 24, 5, 3.5) * 4;
  // cheeks, then the mouth as a groove, the lips either side of it
  h += blob(cx - 27, cy + 18, 11, 9) * 4;
  h += blob(cx + 27, cy + 18, 11, 9) * 4;
  h -= blob(cx, cy + 36, 16, 2.6) * 12;
  h += blob(cx, cy + 31, 12, 2.5) * 2.5;
  h += blob(cx, cy + 41, 11, 3) * 2.5;
  // the hair: a band across the forehead
  h += blob(cx, cy - 40, 42, 8) * 5;
  h += (noise(52, x, y, 9) - 0.5) * 5;
  return h;
}

/** A giant stone head fallen on its side, half sunk in the grass: the face field turned 68 degrees, its crown chipped. */
function statueHead(): PNG {
  const W = 128;
  const H = 128;
  const png = surface(W, H);
  const SCALE = 0.9;
  const turn = (68 * Math.PI) / 180;
  const c = Math.cos(turn);
  const sn = Math.sin(turn);
  const ox = 62;
  const oy = 88;
  const source = (x: number, y: number): readonly [number, number] => {
    const dx = (x - ox) / SCALE;
    const dy = (y - oy) / SCALE;
    return [64 + c * dx + sn * dy, 68 - sn * dx + c * dy];
  };
  const z = new Float32Array(W * H);
  const chip = chipped(51, 1.4, 6);
  const mask = maskOf(W, H, (x0, y0) => {
    const [x, y] = chip(x0, y0);
    if (y > H - 1) return false;
    const [sx, sy] = source(x, y);
    if (faceHeight(sx, sy) < 0) return false;
    const v = (sy - 68) / 59;
    if (((sx - 64) / (50 * (1 - 0.24 * Math.max(0, v) ** 1.5))) ** 2 + v ** 2 > 1) return false;
    // the chipped crown: a slanted bite out of the top of the head, jagged
    if (sy < 30 + (sx - 64) * 0.55 + (noise(56, sx, sy, 5) - 0.5) * 9) return false;
    return true;
  });
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const [sx, sy] = source(x, y);
      z[y * W + x] = faceHeight(sx, sy);
    }
  }
  const light = (x: number, y: number): number => {
    const zz = (xx: number, yy: number): number => Math.max(0, z[Math.max(0, Math.min(H - 1, yy)) * W + Math.max(0, Math.min(W - 1, xx))]!);
    const gx = (zz(x + 1, y) - zz(x - 1, y)) / 2;
    const gy = (zz(x, y + 1) - zz(x, y - 1)) / 2;
    const len = Math.hypot(gx, gy, 1);
    // light from the upper left, a little in front
    return (gx * 0.5 + gy * 0.65 + 0.55) / len;
  };
  drawStone(png, mask, {
    seed: 53,
    stone: STONE,
    moss: MOSS,
    bevel: 3,
    cracks: 1,
    moss_amount: 0.7,
    foot: 12,
    form: (x, y) => (light(x, y) - 0.55) * 4.6 - Math.max(0, (y - 78) / 40) * 1.1,
  });
  // sunk in the grass: a mound of earth and moss over the underside, its top edge worn, higher at the chin end
  for (let y = 80; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const i = (y * W + x) * 4;
      if (png.data[i + 3] !== 255) continue;
      const edge = 104 - Math.max(0, 70 - x) * 0.22 + (noise(54, x, 2, 7) - 0.5) * 12;
      if (y < edge) continue;
      const t = (y - edge) / (H - edge);
      const n = noise(55, x, y, 4);
      const step = Math.max(1, Math.min(4, Math.round(2.3 + (n - 0.5) * 2.4 - t * 0.6 + (y - edge < 3 ? 0.9 : 0))));
      put(png, x, y, MOSS[step]!);
    }
  }
  return finish(png);
}

function totem(): PNG {
  const W = 64;
  const H = 128;
  const png = surface(W, H);
  const chip = chipped(61, 1.1, 5);
  const cx = 32;
  const faces = [96, 62];
  const mask = maskOf(W, H, (x0, y0) => {
    const [x, y] = chip(x0, y0);
    if (y > H - 1) return false;
    if (y >= 112) return Math.abs(x - cx) <= 17;
    if (y < 8) return false;
    if (y < 34) {
      // the crown: a flat cap with two horns
      const dx = Math.abs(x - cx);
      if (dx >= 9 && dx <= 13 && y >= 7 && y < 16) return true;
      return dx <= 13 && y > 14 + (dx / 13) ** 2 * 9;
    }
    return Math.abs(x - cx) <= 13;
  });
  drawStone(png, mask, {
    seed: 62,
    stone: STONE,
    moss: MOSS,
    bevel: 3,
    cracks: 0.9,
    moss_amount: 0.4,
    foot: 9,
    form: (x, y) => {
      if (y >= 112) return y < 116 ? 0.9 : -0.4 + (x > 44 ? -0.8 : 0);
      const u = (x - cx) / 13;
      let v = -u * 1.7;
      // the bands between figures
      for (const b of [47, 80]) {
        if (Math.abs(y - b) <= 1) v -= y === b ? 1.8 : 0.9;
        else if (y === b - 2) v += 0.6;
      }
      // a carved face at each station: two square sockets, a ridge of nose, a barred mouth
      for (const fy of faces) {
        const dx = x - cx;
        const dy = y - fy;
        const socket = (ox: number): boolean => Math.abs(dx - ox) <= 3.5 && dy >= -11 && dy <= -4;
        if (socket(-6) || socket(6)) v -= dy === -4 ? -0.2 : 2.0;
        if (Math.abs(dx) <= 2 && dy >= -6 && dy <= 6) v += dx <= 0 ? 1.1 : -0.9;
        if (Math.abs(dx) <= 8 && dy >= 10 && dy <= 13) v -= dy === 13 ? -0.2 : 1.9;
      }
      // the crown's two eye slits
      if (y >= 22 && y <= 24 && (Math.abs(x - (cx - 6)) <= 2 || Math.abs(x - (cx + 6)) <= 2)) v -= 2;
      return v;
    },
  });
  // faded paint in the carved lines: ochre dabs where the stone was cut
  for (const fy of faces) {
    for (let k = 0; k < 14; k += 1) {
      const dx = Math.round((hash3(63, fy, k) - 0.5) * 22);
      const dy = Math.round((hash3(64, fy, k) - 0.5) * 26);
      const x = cx + dx;
      const y = fy + dy;
      const i = (y * W + x) * 4;
      if (png.data[i + 3] !== 255) continue;
      const dark = png.data[i]! < 0x50;
      if (dark) put(png, x, y, hash3(65, fy, k) > 0.5 ? OCHRE : OCHRE_LIGHT);
    }
  }
  return finish(png);
}

export const RUINS: readonly PropDraw[] = [
  { id: 'props/ruin_pillar', w: 64, h: 128, frames: 1, ramps: ['stone', 'grey', 'moss'], floor: 1.5, what: 'a broken ruin pillar at 64 px, one and two thirds characters tall: a round fluted shaft in drums on a plinth, the top snapped on a slant, moss on its upward faces and a wet dark foot', draw: pillar },
  { id: 'props/ruin_wall', w: 128, h: 128, frames: 1, ramps: ['stone', 'grey', 'moss'], floor: 1.1, what: 'a fallen ruin wall at 64 px, a little over a character tall: courses of stone blocks with staggered joints, the top worn to a ragged skyline, moss on top and at the foot', draw: wall },
  { id: 'props/ruin_arch', w: 128, h: 128, frames: 1, ramps: ['stone', 'grey', 'moss'], floor: 1.5, what: 'a ruin arch at 64 px, one and two thirds characters tall: a ring of voussoirs on a whole jamb, the right end snapped off above a stump, moss on its upward faces', draw: arch },
  { id: 'props/statue_head', w: 128, h: 128, frames: 1, ramps: ['stone', 'grey', 'moss'], floor: 1.0, what: 'a giant stone head fallen on its side at 64 px, half sunk in the grass: brow, sockets, nose ridge and barred mouth turned sideways, a chipped crown, moss on its shaded side, lit from the top left', draw: statueHead },
  { id: 'props/totem', w: 64, h: 128, frames: 1, ramps: ['stone', 'grey', 'moss', 'wood'], floor: 1.5, what: 'a carved totem at 64 px, one and two thirds characters tall: a square-socketed face at two stations under a bird head, faded ochre in the cuts, on a plinth', draw: totem },
];

export { opaqueHeight };
