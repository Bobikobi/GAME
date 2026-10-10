/**
 * `tsx tools/src/site/scene.ts`, a step of `pnpm site`: draws the home page's living window from the core kit
 * (DECISIONS.md, 2026-10-10) into web/public/scene/, which git ignores. It writes the ground of the river
 * crossing as four frames side by side (water, banks and the swaying plants baked in, the way the game bakes its
 * ground frames) and copies, as they are, the sprites the stylesheet animates on top (web/src/styles/scene.css).
 * When the kit art changes, the window follows on the next build.
 */
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { PNG } from 'pngjs';
import { REPO_ROOT } from '../load';

const KIT = join(REPO_ROOT, 'content/kit/core');
const OUT = join(REPO_ROOT, 'web/public/scene');
const T = 16;
const FRAMES = 4;

// 32 x 9 tiles. T forest, G grass, P path, S sand, W water, B bridge, X the broken plank (slot core/old-bridge).
// The path runs along row 5 and crosses the river (columns 15-17) on the bridge.
const MAP = [
  'TTTTTTGGGGGGGGSWWWSGGGGGGGGGGTTT',
  'TTTTGGGGGGGGGGSWWWSGGGGGGGGGGGTT',
  'TTGGGGGGGGGGGGSWWWSGGGGGGGGGGGGG',
  'GGGGGGGGGGGGGGSWWWSGGGGGGGGGGGGG',
  'GGGGGGGGGGGGGGSWWWSGGGGGGGGGGGGG',
  'PPPPPPPPPPPPPPPBXBPPPPPPPPPPPPPP',
  'GGGGGGGGGGGGGGSWWWSGGGGGGGGGGGGG',
  'GGGGGGGGGGGGGGSWWWSGGGGGGGGGGGGG',
  'GGGGGGGGGGGGGGSWWWSGGGGGGGGGGGGG',
];
const W = MAP[0]!.length;
const H = MAP.length;

// standing props baked into the ground: name, tile x, tile y of the bottom row, frame width, x offset in pixels
const STAND: readonly [string, number, number, number, number][] = [
  ['tree_oak', 2, 3, 32, 0], ['tree_oak', 26, 3, 32, 4],
  ['standing_stone', 7, 4, 16, 0],
  ['sign', 14, 4, 16, 0],
  ['house_small', 20, 3, 48, 2],
  ['reeds', 14, 7, 16, 0], ['reeds', 18, 2, 16, 0], ['reeds', 14, 1, 16, 2], ['reeds', 18, 8, 16, 0],
  ['flowers', 5, 7, 16, 0], ['flowers_white', 11, 8, 16, 0], ['flowers_blue', 3, 6, 16, 4],
  ['flowers', 23, 7, 16, 0], ['flowers_white', 28, 6, 16, 0], ['flowers_blue', 12, 3, 16, 0],
  ['grass_tall', 9, 7, 16, 0], ['grass_tall', 20, 7, 16, 0], ['grass_tall', 1, 8, 16, 0], ['grass_tall', 26, 8, 16, 0],
  ['grass_tall', 5, 3, 16, 0], ['grass_tall', 29, 4, 16, 0],
  ['rock_mossy', 12, 7, 16, 0], ['rock_small', 22, 8, 16, 0], ['mushrooms_small', 7, 8, 16, 0],
  ['stump', 0, 4, 16, 0], ['bush_berry', 30, 7, 16, 0], ['pebbles', 19, 6, 16, 0], ['log_mossy', 16, 8, 16, -40],
];
// canopy crowns over the forest corners, in tiles
const CANOPIES: readonly [number, number][] = [[0, 0], [2, 0], [4, 0], [0, 2], [29, 0]];
// the sprites the stylesheet animates, copied as they are
const SPRITES = [
  'chars/player_left.png', 'chars/player_work_left.png', 'chars/player_idle_down.png', 'chars/elder_blink.png',
  'props/campfire_lit.png', 'props/tree_oak.png', 'props/lantern_post.png', 'tiles/bridge.png',
];

interface Img {
  width: number;
  height: number;
  data: Buffer;
}

const cache = new Map<string, Img>();
function read(rel: string): Img {
  let im = cache.get(rel);
  if (!im) {
    const png = PNG.sync.read(readFileSync(join(KIT, rel)));
    im = { width: png.width, height: png.height, data: png.data };
    cache.set(rel, im);
  }
  return im;
}

function blank(width: number, height: number): Img {
  return { width, height, data: Buffer.alloc(width * height * 4) };
}

/** Frame i of a strip of frames fw pixels wide, wrapping around as the game cycles them. */
function frame(im: Img, i: number, fw: number): Img {
  const x = (i % Math.floor(im.width / fw)) * fw;
  const out = blank(fw, im.height);
  for (let y = 0; y < im.height; y++) im.data.copy(out.data, y * fw * 4, (y * im.width + x) * 4, (y * im.width + x + fw) * 4);
  return out;
}

/** Draws src over dst with its top left at (dx, dy), clipped to dst: straight alpha, source over. */
function over(dst: Img, src: Img, dx: number, dy: number): void {
  for (let y = 0; y < src.height; y++) {
    const ty = y + dy;
    if (ty < 0 || ty >= dst.height) continue;
    for (let x = 0; x < src.width; x++) {
      const tx = x + dx;
      if (tx < 0 || tx >= dst.width) continue;
      const s = (y * src.width + x) * 4;
      const d = (ty * dst.width + tx) * 4;
      const sa = src.data[s + 3]!;
      if (sa === 0) continue;
      const da = (dst.data[d + 3]! * (255 - sa)) / 255;
      const oa = sa + da;
      for (let c = 0; c < 3; c++) dst.data[d + c] = Math.round((src.data[s + c]! * sa + dst.data[d + c]! * da) / oa);
      dst.data[d + 3] = Math.round(oa);
    }
  }
}

/** A small seeded generator (mulberry32), so every build draws the same ground. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const tile = (name: string): Img => read(`tiles/${name}.png`);
const prop = (name: string): Img => read(`props/${name}.png`);
const at = (x: number, y: number): string | undefined => MAP[y]?.[x];
const isWater = (c: string): boolean => 'WBX'.includes(c);
const SIDES: readonly [string, number, number][] = [['n', 0, -1], ['s', 0, 1], ['e', 1, 0], ['w', -1, 0]];

function pick(c: string, v: number, f: number, x: number, y: number): Img | undefined {
  if (c === 'G') {
    if (v > 0.97) return frame(tile('grass_flowers'), Math.floor(f / 2), T);
    return tile(v < 0.55 ? 'grass' : v < 0.75 ? 'grass_1' : v < 0.9 ? 'grass_2' : 'grass_3');
  }
  if (c === 'T') return tile(v < 0.5 ? 'forest' : v < 0.8 ? 'forest_1' : 'forest_2');
  if (c === 'P') return tile(v < 0.6 ? 'path' : v < 0.85 ? 'path_1' : 'path_2');
  if (c === 'S') return tile(v < 0.6 ? 'sand' : v < 0.85 ? 'sand_1' : 'sand_2');
  if (c === 'W' || c === 'X') return frame(tile('water'), f + ((x + y) % 4), T);
  if (c === 'B') return tile('bridge');
  return undefined;
}

/** The edge a tile draws toward one neighbour, read the way the game's drawEdges reads it. */
function edge(c: string, n: string, side: string): string | undefined {
  if (c === 'W' && !isWater(n)) return `bank_${side}`;
  if (c === 'P' && 'GT'.includes(n)) return `fringe_${side}`;
  if (c === 'S' && isWater(n)) return `shore_${side}`;
  return undefined;
}

// the broken plank without the water baked into it, so the river runs under it
const water = tile('water');
const waterColours = new Set<number>();
for (let i = 0; i < water.data.length; i += 4) if (water.data[i + 3]) waterColours.add(water.data.readUIntBE(i, 3));
const plank = tile('bridge_broken');
const broken: Img = { ...plank, data: Buffer.from(plank.data) };
for (let i = 0; i < broken.data.length; i += 4) if (waterColours.has(broken.data.readUIntBE(i, 3))) broken.data[i + 3] = 0;

const rnd = seeded(7);
const variant = MAP.map((row) => [...row].map(() => rnd()));
const stand = [...STAND].sort((a, b) => a[2] - b[2]);

const strip = blank(W * T * FRAMES, H * T);
for (let f = 0; f < FRAMES; f++) {
  const img = blank(W * T, H * T);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const c = at(x, y)!;
      const t = pick(c, variant[y]![x]!, f, x, y);
      if (t) over(img, t, x * T, y * T);
      if (c === 'X') over(img, broken, x * T, y * T);
      for (const [side, dx, dy] of SIDES) {
        const n = at(x + dx, y + dy);
        const ref = n === undefined ? undefined : edge(c, n, side);
        if (!ref) continue;
        const e = tile(ref);
        over(img, e.width > T ? frame(e, f, T) : e, x * T, y * T);
      }
    }
  }
  CANOPIES.forEach(([cx, cy], i) => over(img, prop(`canopy_${(i % 3) + 1}`), cx * T, cy * T - 6));
  for (const [name, tx, ty, fw, ox] of stand) {
    const sheet = prop(name);
    const im = frame(sheet, sheet.width > fw ? Math.floor(f / 2) : 0, fw);
    const x = fw <= 32 ? tx * T + Math.floor((T - fw) / 2) + ox : tx * T + ox;
    over(img, im, x, (ty + 1) * T - im.height);
  }
  over(strip, img, f * W * T, 0);
}

mkdirSync(OUT, { recursive: true });
const png = new PNG({ width: strip.width, height: strip.height });
strip.data.copy(png.data);
// the ground is opaque, and tiles repeat: RGB, no filter and the default deflate strategy write it smallest
const bytes = PNG.sync.write(png, { colorType: 2, filterType: 0, deflateLevel: 9, deflateStrategy: 0 });
writeFileSync(join(OUT, 'ground.png'), bytes);
for (const rel of SPRITES) copyFileSync(join(KIT, rel), join(OUT, basename(rel)));
console.log(`scene: ground ${strip.width}x${strip.height} in ${FRAMES} frames (${bytes.length} bytes) and ${SPRITES.length} sprites in web/public/scene/`);
