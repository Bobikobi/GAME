import { SOFTWARE_GPU } from './device';
import { frontArrival, type Wind } from './wind';

/**
 * The ground's rich detail, worked out without Phaser so it can be tested: the
 * tile hash, smooth value noise over tile coordinates, the tone field that groups
 * the meadow into shaded, plain and sunlit patches, the 2x2 forest blocks a canopy
 * covers, and the colour remap that makes a toned copy of a grass tile. All of it
 * is fixed by the map: the same valley on every machine, every time.
 */

/** A fixed, well-mixed number for a tile or prop position: the same tile always picks the same variant and phase. */
export function hash(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

/** 0 plain, 1 shaded, 2 sunlit. */
export type Tone = 0 | 1 | 2;

/** Lattice spacing of the tone noise, in tiles: the patches come out three to eight tiles across. */
const LATTICE = 3;
const TONE_SEED = 7;
/** Below the first threshold a meadow tile is shaded, above the second it is sunlit. */
const SHADE_BELOW = 0.38;
const SUN_ABOVE = 0.62;

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

/**
 * Smooth 2D value noise over tile coordinates, 0 to 1: the lattice values come from
 * the hash, and a tile between lattice points blends its four corners with a smoothstep.
 */
export function valueNoise(x: number, y: number, seed: number, lattice = LATTICE): number {
  const ix = Math.floor(x / lattice);
  const iy = Math.floor(y / lattice);
  const sx = smoothstep((x - ix * lattice) / lattice);
  const sy = smoothstep((y - iy * lattice) / lattice);
  const at = (a: number, b: number) => hash(a * 31 + seed, b * 17 + seed * 3) / 4294967296;
  const top = at(ix, iy) + (at(ix + 1, iy) - at(ix, iy)) * sx;
  const bottom = at(ix, iy + 1) + (at(ix + 1, iy + 1) - at(ix, iy + 1)) * sx;
  return top + (bottom - top) * sy;
}

/**
 * `valueNoise(x, y, seed, lattice)` over a rectangle of whole-number points (x0..x1, y0..y1 inclusive), with the lattice
 * corners it needs hashed once and not at every point: the same numbers, by the same arithmetic, for any (x, y) inside.
 * The caller says the rectangle; a point outside it is a mistake of the caller's and reads the noise the slow way.
 */
export function noiseRect(x0: number, y0: number, x1: number, y1: number, seed: number, lattice = LATTICE): (x: number, y: number) => number {
  const ix0 = Math.floor(x0 / lattice);
  const iy0 = Math.floor(y0 / lattice);
  const w = Math.floor(x1 / lattice) - ix0 + 2;
  const h = Math.floor(y1 / lattice) - iy0 + 2;
  const corner = new Float64Array(w * h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) corner[j * w + i] = hash((ix0 + i) * 31 + seed, (iy0 + j) * 17 + seed * 3) / 4294967296;
  return (x, y) => {
    const ix = Math.floor(x / lattice);
    const iy = Math.floor(y / lattice);
    const i = ix - ix0;
    const j = iy - iy0;
    if (i < 0 || j < 0 || i + 1 >= w || j + 1 >= h) return valueNoise(x, y, seed, lattice);
    const sx = smoothstep((x - ix * lattice) / lattice);
    const sy = smoothstep((y - iy * lattice) / lattice);
    const a = corner[j * w + i]!;
    const b = corner[j * w + i + 1]!;
    const c = corner[(j + 1) * w + i]!;
    const d = corner[(j + 1) * w + i + 1]!;
    const top = a + (b - a) * sx;
    const bottom = c + (d - c) * sx;
    return top + (bottom - top) * sy;
  };
}

/**
 * The tone of every tile of a field, row by row: the noise thresholds pick it, then
 * two rounds smooth the slivers away - a tile whose meadow neighbours all have other
 * tones takes the one most of them have. Tiles the predicate refuses stay plain.
 */
export function toneField(width: number, height: number, isMeadow: (x: number, y: number) => boolean, seed = TONE_SEED): Uint8Array {
  const meadow = new Uint8Array(width * height);
  let field = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!isMeadow(x, y)) continue;
      const i = y * width + x;
      meadow[i] = 1;
      const n = valueNoise(x, y, seed);
      field[i] = n < SHADE_BELOW ? 1 : n > SUN_ABOVE ? 2 : 0;
    }
  }
  const SIDES: readonly [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (let round = 0; round < 2; round++) {
    const next = field.slice();
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        if (meadow[i] !== 1) continue;
        const counts = [0, 0, 0];
        let seen = 0;
        for (const [dx, dy] of SIDES) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height || meadow[ny * width + nx] !== 1) continue;
          const t = field[ny * width + nx] ?? 0;
          counts[t] = (counts[t] ?? 0) + 1;
          seen += 1;
        }
        if (seen > 0 && counts[field[i] ?? 0] === 0) next[i] = counts.indexOf(Math.max(...counts));
      }
    }
    field = next;
  }
  return field;
}

/** A 2x2 block of forest tiles and the canopy variant drawn over it. */
export interface Canopy {
  x: number;
  y: number;
  i: number;
}

/**
 * The 2x2 blocks of forest tiles a canopy covers, none overlapping: a greedy scan in
 * reading order, with rows starting one tile in when their hash says so, then a plain
 * second scan that takes whatever the stagger left, so no square of four free forest
 * tiles remains. The variant comes from the hash of the block's corner.
 */
export function canopyGroups(width: number, height: number, isForest: (x: number, y: number) => boolean, variants = 3): Canopy[] {
  const forest = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) forest[y * width + x] = isForest(x, y) ? 1 : 0;
  const taken = new Uint8Array(width * height);
  const free = (x: number, y: number) => forest[y * width + x] === 1 && taken[y * width + x] === 0;
  const groups: Canopy[] = [];
  const scan = (stagger: boolean) => {
    for (let y = 0; y + 1 < height; y++) {
      let x = stagger ? hash(0, y) % 2 : 0;
      while (x + 1 < width) {
        if (free(x, y) && free(x + 1, y) && free(x, y + 1) && free(x + 1, y + 1)) {
          taken[y * width + x] = taken[y * width + x + 1] = taken[(y + 1) * width + x] = taken[(y + 1) * width + x + 1] = 1;
          groups.push({ x, y, i: Math.floor(hash(x, y) / 1000) % variants });
          x += 2;
        } else {
          x += 1;
        }
      }
    }
  };
  scan(true);
  scan(false);
  return groups;
}

/** The grass ramp, dark to light: the five palette greens the tones step between. */
export const GREENS: readonly number[] = [0x1f3d2b, 0x2e6b3b, 0x4c9a3f, 0x84c450, 0xc8e88a];

/** 0..1, stable per pixel place, and twice as likely to come low on the even diagonals: a hatch rather than snow. */
function hatch(x: number, y: number): number {
  const r = hash(x, y) / 4294967296;
  return (x + y) % 2 === 0 ? r * 0.7 : r * 1.3;
}

/**
 * Remaps the pixels of a grass tile in place for one tone. Shade: the grass base steps
 * down to the mid green on a stable stipple of about a third of its pixels, and the
 * light specks step down to the base. Sun: about a quarter of the base steps up to the
 * light green, and the specks to the pale one. Only these greens change, only opaque
 * pixels, and every colour written is a palette colour. `data` is RGBA with `width`
 * pixels per row; the stipple is keyed by the pixel's place in its frame, so the frames
 * of a sheet share it and nothing twinkles.
 */
export function remapTone(data: Uint8ClampedArray, width: number, tone: Tone, frameWidth = width): void {
  if (tone === 0) return;
  const base = GREENS[2]!;
  const light = GREENS[3]!;
  for (let i = 0; i + 3 < data.length; i += 4) {
    if (data[i + 3] !== 255) continue;
    const rgb = ((data[i]! << 16) | (data[i + 1]! << 8) | data[i + 2]!) >>> 0;
    if (rgb !== base && rgb !== light) continue;
    const p = i / 4;
    const px = (p % width) % frameWidth;
    const py = Math.floor(p / width);
    let out: number | undefined;
    if (tone === 1) {
      if (rgb === light) {
        // a field of the light green (wave 3's flat meadow) shades as a hatch, not a block: a checker-biased seventh steps down; the base steps as a hatch too
        if (hatch(px + 101, py + 211) < 0.14) out = base;
      } else if (hatch(px + 101, py + 211) < 0.12) out = GREENS[1];
    } else if (rgb === light) {
      if (hatch(px + 307, py + 401) < 0.09) out = GREENS[4];
    } else if (hatch(px + 307, py + 401) < 0.12) {
      out = light;
    }
    if (out === undefined) continue;
    data[i] = (out >>> 16) & 255;
    data[i + 1] = (out >>> 8) & 255;
    data[i + 2] = out & 255;
  }
}

/**
 * The pixels that may move (LIGHTING.md section 3 C, the owner's C of 30.10): the meadow's two lightest greens, which
 * lean with the gust wherever they are drawn (a tile, a tall grass, a canopy's highlights), and the water's two light
 * dashes, which drift along the stream. Every other colour holds still, so a trunk, a path or a body never moves
 * (tools/test/anim-sheets.test.ts holds every shipped character and creature sheet to it: none draws a colour within
 * `GUST.tolerance` of these).
 */
export const MOVES = { meadow: [0x84c450, 0xc8e88a], water: [0x7cc4ec, 0xc4ecf8] } as const;

/**
 * The classic door's own gust, as it always was: how close a screen colour must be to a moving one (a share of a channel, so a colour the camera's grade nudged still counts), how fast the
 * gust runs, and how wide its bands are a pixel. A page without a painted ground sways by this, unchanged (the painted door ships dark: nothing a player sees moves until it is switched on).
 */
export const GUST = { tolerance: 0.035, speed: 1.3, scale: 0.035 } as const;

/**
 * The sway by the table's wind (wind.ts), read only where a wind is given (the painted door): the same tolerance, and the swing's own period (s) along the front. A period of 5.3 s is the
 * painted gust's slow swell: a tile's lean changes four times a period, and three changes take a quarter of a period, 1.3 s, so no tile changes lean more than twice in any second (a test counts it).
 */
export const SWAY = { tolerance: GUST.tolerance, period: 5.3 } as const;

/** 0 still, 1 a meadow green that leans, 2 a water dash that drifts: the mask the sway shader applies by colour. */
export function movesAs(rgb: number): 0 | 1 | 2 {
  if ((MOVES.meadow as readonly number[]).includes(rgb)) return 1;
  if ((MOVES.water as readonly number[]).includes(rgb)) return 2;
  return 0;
}

/** The mask of a picture's pixels that may move (RGBA bytes): one entry a pixel, as `movesAs`; clear pixels hold still. */
export function groundMask(data: Uint8ClampedArray | Uint8Array, width: number, height: number): Uint8Array {
  const out = new Uint8Array(width * height);
  for (let p = 0; p < width * height; p++) {
    if ((data[4 * p + 3] ?? 0) < 128) continue;
    out[p] = movesAs(((data[4 * p] ?? 0) << 16) | ((data[4 * p + 1] ?? 0) << 8) | (data[4 * p + 2] ?? 0));
  }
  return out;
}

/**
 * How far the gust leans a meadow pixel at art pixel (x, y) at `time` seconds, in whole art px: 2 at its heart, 1 at
 * its edge, 0 between gusts, and a row band every 6 px a step less. The shader runs the same sum.
 */
export function leanAt(x: number, y: number, time: number, wind?: Wind): 0 | 1 | 2 {
  const lean = gustAt(x, y, time, wind);
  return (Math.floor(y / 6) % 2 === 1 ? Math.max(0, lean - 1) : lean) as 0 | 1 | 2;
}

/** The swing at art pixel (x, y) at `time` s: a sine along the wind's front, one period `SWAY.period` long, as hard as the wind leans. The shader runs the same sum. */
export function swing(x: number, y: number, time: number, wind: Wind): number {
  const phase = frontArrival(wind, x, y) / SWAY.period - ((time / SWAY.period) % 1);
  return Math.sin(2 * Math.PI * phase) * wind.k;
}

/** The gust alone at art pixel (x, y), before the row band: 2 at its heart, 1 at its edge, 0 between gusts. A whole tree leans by this, at its top. Without a wind: the classic door's own gust (`GUST`). */
export function gustAt(x: number, y: number, time: number, wind?: Wind): 0 | 1 | 2 {
  const g = wind ? swing(x, y, time, wind) : Math.sin(x * GUST.scale + y * GUST.scale * 0.6 - time * GUST.speed);
  return g > 0.85 ? 2 : g > 0.55 ? 1 : 0;
}

/**
 * Whether the sway runs on this browser: everywhere WebGL has a graphics chip, phones of every tier included (the owner,
 * 30.10: not gated on the weak phone); not where WebGL is drawn in software (SwiftShader, llvmpipe: a machine without
 * a graphics chip, or a test runner), where its full-screen pass cost a third of a frame. `?sway=on` or `?sway=off`
 * in the address decides for a still, a clip or a measurement.
 */
export function swayOn(gpu: string, query: string): boolean {
  const asked = new URLSearchParams(query).get('sway');
  if (asked === 'on') return true;
  if (asked === 'off') return false;
  return !SOFTWARE_GPU.test(gpu);
}
