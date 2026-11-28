/**
 * The look of standing water and of fog on a painted land (DECISIONS 2026-11-10): the rules that are plain numbers, kept apart from the
 * renderer so a test can read them. No setting per land: every number here is read off the hour's light (`amb`, `sun`, `elev`) or is one
 * constant for every land.
 */

export interface HourLight {
  amb: readonly [number, number, number];
  sun: readonly [number, number, number];
  elev: number;
}

/** An hour's light with the evening's two small numbers: the share of the sun moved into the ambient and the lamp's loss. */
export interface GroundLight extends HourLight {
  fill: number;
  shift: number;
}

const clamp = (v: number, lo = 0, hi = 1): number => Math.min(hi, Math.max(lo, v));
const smooth = (a: number, b: number, v: number): number => {
  const t = clamp((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
export const luma = (c: readonly number[]): number => 0.3 * c[0]! + 0.59 * c[1]! + 0.11 * c[2]!;

/**
 * The water keeps its hue family through the dark (V5c, L7). The night ambient is a deep blue, and a teal water under it turns blue (hue 224 against 176-183 by day). The water's own
 * multiplier takes the excess blue back off: each channel by (the weakest ambient channel / its own) to the power `pull`, so the water lit by the hour's ambient has the ambient's
 * brightness and not its colour. It runs by how far the ambient has fallen (nothing from a mean of `to`, full below `from`), so a day's water is not touched. Only the water layer
 * reads it; the ground keeps the night's blue.
 */
export const WATER_HOLD = { from: 0.25, to: 0.4, pull: 1.1 } as const;
export function waterHold(amb: readonly [number, number, number]): [number, number, number] {
  const mean = (amb[0] + amb[1] + amb[2]) / 3;
  const w = 1 - smooth(WATER_HOLD.from, WATER_HOLD.to, mean);
  const low = Math.max(Math.min(amb[0], amb[1], amb[2]), 0.001);
  return [0, 1, 2].map((i) => Math.pow(low / Math.max(amb[i]!, 0.001), WATER_HOLD.pull * w)) as [number, number, number];
}

/**
 * The water keeps its hue family through the twilights too (private #44 step B, L7 at every hour). By the flat ground light's red the valley's water read 160 at 18:30 and 93 at 19:30 against 182
 * at noon (a teal turned yellow-green), and by the sky's blue 205 at 06:00 while the sun is still weak and the night's ambient is giving way. The water's multiplier takes the excess back off:
 * each channel by (the light's mean / its own) to the power `pull`. Red: the flat ground light's red over its blue (nothing under `from`, full from `to`). Blue: the ambient's blue over its red,
 * only where the sun is weak (its strength x elevation under `sun`, so the evening's cool shade under a strong sun is left as it was) and where the night's own hold (`waterHold`) has let go.
 * Noon's light is neutral and the night's is the night hold's, so the day's and the night's water are as they were.
 */
export const WATER_TWILIGHT = { from: 0.1, to: 0.35, pull: 1.5, bluePull: 0.95, blueFrom: 0.1, blueTo: 0.25, sun: [0.15, 0.4] } as const;
export function waterHoldTwilight(l: GroundLight): [number, number, number] {
  const c = groundLightOf(l).flat;
  const mean = Math.max((c[0] + c[1] + c[2]) / 3, 0.001);
  const red = smooth(WATER_TWILIGHT.from, WATER_TWILIGHT.to, (c[0] - c[2]) / mean);
  const am = Math.max((l.amb[0] + l.amb[1] + l.amb[2]) / 3, 0.001);
  const weak = 1 - smooth(WATER_TWILIGHT.sun[0], WATER_TWILIGHT.sun[1], ((l.sun[0] + l.sun[1] + l.sun[2]) / 3) * l.elev);
  const blue = smooth(WATER_TWILIGHT.blueFrom, WATER_TWILIGHT.blueTo, (l.amb[2] - l.amb[0]) / am) * smooth(WATER_HOLD.from, WATER_HOLD.to, am) * weak;
  return [0, 1, 2].map((i) => Math.pow(mean / Math.max(c[i]!, 0.001), WATER_TWILIGHT.pull * red) * Math.pow(am / Math.max(l.amb[i]!, 0.001), WATER_TWILIGHT.bluePull * blue)) as [number, number, number];
}

/**
 * How much the surface glitters at this hour, 0 to 1: the sun's own strength on it, more the lower the sun stands (a glitter road is a low
 * sun's), and none when the sun is a dim thing (a dark fog, night). Noon about 0.4, the low evening sun about 0.7, a dark fog hour under 0.05.
 */
export function sparkleOf(l: HourLight): number {
  const sun = luma(l.sun);
  return smooth(0.08, 0.5, sun) * (0.35 + 0.65 * (1 - clamp(l.elev)));
}

/** How warm the sun's road lies on the water, 0 to 1: the sun's red over its blue, in the proportion it carries, and nothing when the sun is dim. */
export function warmthOf(l: HourLight): number {
  const s = l.sun;
  const sum = s[0] + s[1] + s[2];
  if (sum <= 0) return 0;
  return clamp(((s[0] - s[2]) / sum) * 1.6) * smooth(0.08, 0.5, luma(s));
}

/** The gust's swing at one moment is the sum of three waves: [share, period s, phase] (the front's direction, speed and strength are the table's wind, wind.ts; the pieces' lean, the ground cover and the meadow's pass read these three waves, and the classic door's sway one of them). */
export const GUST_WAVES = [[0.55, 5.3, 0], [0.3, 2.9, 1.1], [0.15, 1.7, 4.2]] as const;

/** A gust that passes: a slow swell with quicker shivers on it, -1 to 1, the same for the whole scene at its own moment. */
export function gust(t: number): number {
  return GUST_WAVES.reduce((sum, [share, period, shift]) => sum + share * Math.sin((2 * Math.PI * t) / period + shift), 0);
}

/** The shore's foam: its outer edge in scene px from the bank and how it breathes. One constant set for every land. */
export const FOAM = { base: 3.5, amp: 1.7, period: 3.2, wave: 0.0013, core: 1.1 } as const;

/**
 * Where the foam's outer edge lies, in scene px from the shore, `t` seconds in, at a place `along` (the shore's own coordinate, px): a swell that
 * comes in and goes out on a period of a few seconds, the places along the shore a few hundred px apart a phase apart, so it rolls and does not
 * pulse as one.
 */
export function foamEdge(t: number, along: number): number {
  return FOAM.base + FOAM.amp * Math.sin((2 * Math.PI * t) / FOAM.period + along * FOAM.wave * 2 * Math.PI);
}

/**
 * The fog's colour at this hour, 0..1 per channel: the light that falls on it (the sky's ambient and a share of the sun, in the sun's own colour),
 * never darker than a floor, so a dark hour's fog is a pale haze with the hour's hue and not a black veil (the owner's "just looks dark", 10.11).
 */
export const FOG_FLOOR = 0.3;
export function fogColour(l: HourLight): [number, number, number] {
  const k = 0.45 * l.elev;
  const c: [number, number, number] = [l.amb[0] * 0.55 + l.sun[0] * k, l.amb[1] * 0.55 + l.sun[1] * k, l.amb[2] * 0.55 + l.sun[2] * k];
  const y = luma(c);
  const gain = y < FOG_FLOOR ? FOG_FLOOR / Math.max(y, 1e-3) : 1;
  return [clamp(c[0] * gain), clamp(c[1] * gain), clamp(c[2] * gain)];
}

/** What a land says about its fog in an hour: how thick it lies at the bottom of the frame and at the top (0..1). Nothing says none: no fog. */
export interface FogData {
  bottom: number;
  top: number;
}

/**
 * The fog's three layers: a bank (large, slow), a wisp (middle) and a fine drift (small, quick), all carried along the gust's direction, the faster
 * ones a little across it, so they slide over one another. Sizes in scene px (a feature's width), speeds in scene px a second (a bank crosses a
 * quarter of the 1370 px frame in 10 to 20 s), shares of the density they make.
 */
export const FOG_LAYERS = [
  { size: 420, speed: 19, across: 0, share: 0.55, channel: 0 },
  { size: 190, speed: 27, across: 0.18, share: 0.3, channel: 1 },
  { size: 90, speed: 36, across: -0.22, share: 0.15, channel: 2 },
] as const;

/** The fog's one noise tile, the same for every land: its side in px and its seed (the exporter bakes it as tiles/fog-noise.png, the mount makes it itself for a land without that file). */
export const FOG_NOISE = { size: 256, seed: 11 } as const;

/** The fog's own noise: three channels of smooth value noise (octaves), `size` px square, deterministic. */
export function fogNoise(size: number, seed: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(size * size * 4);
  for (const _ of fogNoiseSteps(size, seed, out)) void _;
  return out;
}

/** fogNoise in slices into `out`: the same work in the same order, a yield every 32 rows of a channel (the first fog frame took 41 ms of one). */
export function* fogNoiseSteps(size: number, seed: number, out: Uint8ClampedArray): Generator<void, void, void> {
  const hash = (x: number, y: number, c: number): number => {
    let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(c + seed * 7919, 2147483647)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  };
  for (let c = 0; c < 3; c++) {
    // three octaves of cell noise, each cell wrapped at the tile's edge so the tile has no seam
    const octs = [
      { cells: 4, w: 0.55 },
      { cells: 8, w: 0.3 },
      { cells: 16, w: 0.15 },
    ];
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        let v = 0;
        for (const o of octs) {
          const fx = (x / size) * o.cells;
          const fy = (y / size) * o.cells;
          const ix = Math.floor(fx);
          const iy = Math.floor(fy);
          const tx = fx - ix;
          const ty = fy - iy;
          const sx = tx * tx * (3 - 2 * tx);
          const sy = ty * ty * (3 - 2 * ty);
          const at = (dx: number, dy: number): number => hash((ix + dx) % o.cells, (iy + dy) % o.cells, c);
          v += o.w * (at(0, 0) * (1 - sx) * (1 - sy) + at(1, 0) * sx * (1 - sy) + at(0, 1) * (1 - sx) * sy + at(1, 1) * sx * sy);
        }
        out[(y * size + x) * 4 + c] = Math.round(clamp(v) * 255);
      }
      if (y % 32 === 31) yield;
    }
  }
  for (let i = 3; i < out.length; i += 4) out[i] = 255;
}

/** The fog's thickness in a frame of height `h` at a row `y` (0 top): the land's own gradient, thick at the top where the far land lies (the placer's rule). */
export function fogBase(data: FogData, y: number, h: number): number {
  return data.bottom + (data.top - data.bottom) * (1 - y / h);
}

/**
 * The share of the fog that is let through where tall things stand: a piece's top third rises out of the fog (fog lies low), the rest stands in it.
 * `up` is the pixel's height above the piece's foot as a share of the piece's height (0 foot, 1 top); `tall` whether the piece is tall enough to rise out.
 */
export function fogLetThrough(up: number, tall: boolean): number {
  if (!tall) return 1;
  return 1 - 0.85 * smooth(0.55, 0.72, up);
}

/** A circle round the walker the fog leaves clear, then thickens over a ring (the lighting's ring of three tiles, one to one with the mist's clear disc). */
export const FOG_CLEAR = { clear: 3, ring: 3 } as const;
export function fogOpen(distTiles: number): number {
  return smooth(FOG_CLEAR.clear, FOG_CLEAR.clear + FOG_CLEAR.ring, distTiles);
}

/** The ambient the lights get at an hour (the table's, with the evening's fill moved in from the sun) and the light on a flat patch of ground (that ambient and the sun's flat share). */
export function groundLightOf(l: GroundLight): { ambient: [number, number, number]; flat: [number, number, number] } {
  const mean = (l.sun[0] + l.sun[1] + l.sun[2]) / 3;
  const add = l.fill;
  const ambient: [number, number, number] = [l.amb[0] + (add * l.sun[0]) / mean, l.amb[1] + (add * l.sun[1]) / mean, l.amb[2] + (add * l.sun[2]) / mean];
  const flat: [number, number, number] = [ambient[0] + l.sun[0] * (1 - l.shift) * l.elev, ambient[1] + l.sun[1] * (1 - l.shift) * l.elev, ambient[2] + l.sun[2] * (1 - l.shift) * l.elev];
  return { ambient, flat };
}

/**
 * The water's colour factors at an hour (bar W1, W2 of the 13.11 brief): its look at the world's 13:00 row (what the layer was tuned on) times the flat ground's light now over the flat ground's
 * light at 13:00, per channel, so the water keeps its world's hue and follows the day as the ground beside it does; at 13:00 the factor is 1 and the old look is untouched.
 */
export function waterLook(l: GroundLight, noon: GroundLight): { tint: [number, number, number]; refl: [number, number, number] } {
  const f = groundLightOf(l).flat;
  const g = groundLightOf(noon).flat;
  const c = (i: 0 | 1 | 2): [number, number, number] => {
    const k = f[i] / g[i];
    return [(0.5 + 0.5 * (noon.amb[i] + noon.sun[i] * noon.elev)) * k, (noon.amb[i] + noon.sun[i] * noon.elev * 0.8) * k, k];
  };
  const r = c(0);
  const gr = c(1);
  const b = c(2);
  return { tint: [r[0], gr[0], b[0]], refl: [r[1], gr[1], b[1]] };
}
