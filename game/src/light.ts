/**
 * The light, as numbers rather than as drawing calls (ART_SYSTEM section 2): the hour's night and
 * dusk, what the shade and the dapple are worth at that hour, the frame's look, the lantern's pool,
 * and the lighting ladder the owner picked on 30.10 (LIGHTING.md, C): the pools of lamps, windows and
 * fires and the hour they paint from, the body light, the night's cut and the rule that keeps the
 * night readable. Pure, so a test can pin every number the valley shows and the 3D door can read the
 * same ones instead of writing its own.
 */
import { FIGURE_ART_H } from './contact';
import { BANK_NIGHT_LIFT } from './sky';

/** A minute of the day, 0 to 1439. */
export type Minute = number;
/** Minutes in a day: a table of hours is read as a ring of this length. */
const MINUTES = 1440;

/** The lantern's pool at night, in world px: clear inside, a short edge in whole-pixel steps, the dark outside. */
export const LIGHT_POOL = { r: 34, edge: 2, dark: 0.7, tint: 0xf0dcc0 } as const;

/**
 * The lantern's pool on a painted land (13.11, round three: the pool is light, not paint).
 * Round two added one flat warm colour over the painting, which read as a sticker; light does not add a colour, it shows the ground's own colours.
 * The light on a flat patch of ground is `base` (the table's ambient plus the sun's flat share, per channel); a lamp adds its own warm `lamp` to it, so
 * the ground inside the pool shows `albedo x (base + lamp x f)`, which is the night's picture times `1 + lamp x f / base`: a gain per channel, the same on every
 * ground, never a colour of its own. The gain is drawn as a multiply-and-add over the scene (dst x (1 + k), see painted-pool.ts), `passes` times because one pass
 * reaches only x2. `f` falls in `steps` whole-art-pixel steps from the core to nothing (never a smooth gradient), and two steps meet in an ordered dither (a 4 x 4
 * Bayer cell) `band` art px wide, so no edge is a circle. The full radius is `reach` figure heights (P6: between 2.2 and 3); the figure stands whole in the core.
 * One texel is one art pixel (`grain` to the world pixel), so the pattern is the texture's own and travels with the figure to the texel.
 */
export const PAINTED_POOL = {
  grain: 4,
  reach: 2.5,
  /**
   * step edges as shares of the full radius, and the share of the core's light each step keeps. Round four (13.11): seven steps of 0.14 to 0.18 of the core instead of six of
   * up to 0.23, a dither band of 8 art px, and every boundary wanders: its radius is the nominal one plus `jitter` (a sum of three smooth waves of the angle, a phase of its
   * own per boundary), so no step is a circle; the outermost nominal edge leaves room for the wanderings inside the full radius.
   */
  edges: [0.44, 0.523, 0.607, 0.69, 0.773, 0.857, 0.94],
  levels: [1, 0.82, 0.67, 0.53, 0.39, 0.24, 0.09],
  band: 8,
  /** the wanderings of each boundary: amplitudes in art px of the 2nd, 3rd and 4th wave of the angle (their sum never passes the room the outer edge leaves) */
  jitter: [3.5, 2.5, 1.5],
  /** the lamp's own light added to the ground's, per channel (the flat ground's full light at noon is about 1) */
  lamp: [0.72, 0.5, 0.19],
  passes: 3,
  /** the night's flat light the step table is shaped for (any hour's tint is scaled from it) */
  nominalBase: [0.172, 0.195, 0.396],
} as const;

/** The pool's full radius in art pixels: `reach` figure heights. */
export function poolRadiusArt(): number {
  return Math.round(PAINTED_POOL.reach * FIGURE_ART_H);
}

const BAYER4 = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]] as const;

/** The wandering of boundary `i` at the angle `th`, art px: a sum of three smooth waves, the phase of each fixed by the boundary and the wave (the same on every machine). */
export function poolJitter(i: number, th: number): number {
  let sum = 0;
  for (let k = 0; k < PAINTED_POOL.jitter.length; k++) sum += PAINTED_POOL.jitter[k]! * Math.sin((k + 2) * th + (((i * 37 + k * 91 + 13) % 628) / 100));
  return sum;
}

/**
 * The step a texel (x, y) of a square centred on texel `c` holds (a texel is an art pixel): 0 outside, else 1 + the index into `levels` (the dither band included). Each boundary lies at its
 * nominal radius plus its own wandering (poolJitter) at the texel's angle, and the dither band lies on the inside of it. `R` is the full radius of the pool, art px (a flickering light's stamp is
 * a little larger or smaller than the table's).
 */
export function paintedPoolStep(x: number, y: number, c: number, R: number = poolRadiusArt()): number {
  const dx = x + 0.5 - c;
  const dy = y + 0.5 - c;
  const d = Math.hypot(dx, dy);
  const { edges, levels, band } = PAINTED_POOL;
  if (d > R) return 0;
  const th = Math.atan2(dy, dx);
  for (let i = 0; i < edges.length; i++) {
    const edge = edges[i]! * R + poolJitter(i, th);
    if (d > edge) continue;
    const next = i + 1 < levels.length;
    const p = (d - (edge - band)) / band;
    if (p <= 0) return i + 1;
    return BAYER4[y & 3]![x & 3]! / 16 + 1 / 32 < p ? (next ? i + 2 : 0) : i + 1;
  }
  return 0;
}

/** The share of the core's light the pool holds at texel (x, y): the step's level (paintedPoolStep), 0 outside. */
export function paintedPoolTexel(x: number, y: number, c: number, R: number = poolRadiusArt()): number {
  const k = paintedPoolStep(x, y, c, R);
  return k === 0 ? 0 : PAINTED_POOL.levels[k - 1]!;
}

/**
 * The gain one pass gives per channel (0 to 1, the tint of each pass) for a flat ground of light `base` and a lamp at `strength` (0 to 1, the night's depth):
 * the pool's core takes the ground from `base` to `base + lamp x strength`, so the whole stack of `passes` passes must make that ratio: (1 + t)^passes.
 */
export function poolGain(base: readonly number[], strength: number, lamp: readonly number[] = PAINTED_POOL.lamp): [number, number, number] {
  const out: [number, number, number] = [0, 0, 0];
  for (let c = 0; c < 3; c++) {
    const b = Math.max(0.02, base[c]!);
    const ratio = (b + lamp[c]! * strength) / b;
    out[c] = Math.min(1, ratio ** (1 / PAINTED_POOL.passes) - 1);
  }
  return out;
}

/**
 * The 0..1 value the pool's texture holds for a step of share `f` of the core's light, shaped so the stack's lift (the lift of the picture's light over the night's)
 * keeps `f` of the core's lift on the green channel at the night's own light: ((1 + f x (F - 1))^(1/passes) - 1) / ((F)^(1/passes) - 1), F the core's ratio there.
 */
export function poolTexelValue(f: number, cap = true): number {
  const g = poolGain(PAINTED_POOL.nominalBase, 1)[1];
  const F = (1 + g) ** PAINTED_POOL.passes;
  const t = ((1 + f * (F - 1)) ** (1 / PAINTED_POOL.passes) - 1) / g;
  return cap ? Math.min(1, Math.max(0, t)) : Math.max(0, t);
}

/**
 * The kinds of light a painted land carries (13.11, round four, order 3): ONE table, and every light on a painted land reads its row, the lantern she holds, a torch (held or standing on the
 * ground), a lamp, and the dev test light. A row is the light's own `lamp` colour (what it adds to the ground's flat light, per channel: the lantern's warm, the torch's redder and the lamp's
 * paler), its `reach` (a share of the table's full radius), its `strength` (a share of the night's depth) and its `flicker`: `strength` and `radius` the shares the flame moves them by, together,
 * and `every` the milliseconds of the game clock one step of the flame lasts (0 = steady). There is no second code path per kind.
 */
export type PaintedLightKind = 'lantern' | 'torch' | 'lamp';
export interface PaintedLightRow {
  lamp: readonly [number, number, number];
  reach: number;
  strength: number;
  flicker: { strength: number; radius: number; every: number };
}
export const PAINTED_LIGHTS: Readonly<Record<PaintedLightKind, PaintedLightRow>> = {
  lantern: { lamp: PAINTED_POOL.lamp, reach: 1, strength: 1, flicker: { strength: 0, radius: 0, every: 0 } },
  torch: { lamp: [0.95, 0.46, 0.1], reach: 1, strength: 1.1, flicker: { strength: 0.06, radius: 0.05, every: 120 } },
  lamp: { lamp: [0.78, 0.58, 0.3], reach: 0.9, strength: 0.9, flicker: { strength: 0, radius: 0, every: 0 } },
};

/** The five levels a flame stands at, from -2 (low) to 2 (high); a steady light stands at 0. */
export const FLAME_LEVELS = 2;

const hash32 = (n: number): number => {
  let h = Math.imul(n | 0, 0x9e3779b1) ^ 0x85ebca6b;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  return (h ^ (h >>> 15)) >>> 0;
};

/**
 * The flame's level now, -2 to 2, a whole number, one value per step of the game clock: a slow wander (value noise, a random value on every fourth step, eased between them) and a quick one (a random
 * value of its own on every step), cut to five levels, so the flame moves on most steps and never by more than two levels at a time. Deterministic: the clock `ms` and the light's `seed` decide,
 * nothing is drawn at random per frame. A steady row stands at 0.
 */
export function flameLevel(row: PaintedLightRow, ms: number, seed: number = 0): number {
  const every = row.flicker.every;
  if (!every) return 0;
  const step = Math.floor(ms / every);
  const u = step / 4;
  const i = Math.floor(u);
  const f = u - i;
  const a = hash32(i * 2 + seed * 7919) / 0xffffffff;
  const b = hash32((i + 1) * 2 + seed * 7919) / 0xffffffff;
  const e = f * f * (3 - 2 * f);
  const slow = (a + (b - a) * e) * 2 - 1;
  const quick = (hash32(step * 5 + seed * 104729 + 1) / 0xffffffff) * 2 - 1;
  return Math.max(-FLAME_LEVELS, Math.min(FLAME_LEVELS, Math.round((0.5 * slow + 0.5 * quick) * 1.1 * FLAME_LEVELS)));
}

/** A light's radius (art px) and strength (a share of the lamp's colour at the night's full depth) at a flame level: the table's reach and strength, moved together by the flicker. */
export function lightNow(row: PaintedLightRow, level: number): { radius: number; strength: number } {
  const q = level / FLAME_LEVELS;
  return { radius: Math.round(poolRadiusArt() * row.reach * (1 + row.flicker.radius * q)), strength: row.strength * (1 + row.flicker.strength * q) };
}

/** The square the pool's hole takes, edge included. */
export const HOLE = 2 * (LIGHT_POOL.r + LIGHT_POOL.edge + 1);

/** Dark from 21:00 to 04:00, fading over two hours on each side (STYLE section 5). */
export const NIGHT = { from: 21, to: 4, fade: 2 } as const;

/** The two hours the gold wash comes up, and how strong it is at its peak. */
export const DUSK = { hours: [20, 5.5] as readonly number[], peak: 0.4, halfWidth: 0.75, shoulder: 0.5 } as const;

/** What the night's shade is multiplied in at, and what the dapple is worth by day. */
export const SHADE = { night: 0.5, dapple: 0.08 } as const;

/** How far the frame tightens at night, with and without the light layer. */
export const FRAME = { strengthDay: 0.3, strengthNight: 0.45, strengthPlain: 0.3, radiusDay: 0.8, radiusNight: 0.15 } as const;

/** How dark it is at a minute of the day, 0 by day to 1 at full night. */
export function nightAt(minute: Minute): number {
  const hour = minute / 60;
  if (hour >= NIGHT.from || hour < NIGHT.to) return 1;
  if (hour >= NIGHT.from - NIGHT.fade) return (hour - (NIGHT.from - NIGHT.fade)) / NIGHT.fade;
  if (hour < NIGHT.to + NIGHT.fade) return ((NIGHT.to + NIGHT.fade) - hour) / NIGHT.fade;
  return 0;
}

/** One key of the hour table: the wash's colour and strength at an hour of the day. */
export interface LightKey {
  /** minutes of the day, 0 to 1439 */
  at: number;
  tint: number;
  /** strength at that hour, in whole percent */
  pct: number;
}

/** Reads `params.light.keys` into minutes of the day, sorted, so the scene needs no parsing. */
export function tableOf(keys: readonly { at: string; tint: string; pct: number }[]): LightKey[] {
  return keys
    .map((k) => {
      const [h, m] = k.at.split(':').map(Number) as [number, number];
      return { at: h * 60 + m, tint: Number.parseInt(k.tint.slice(1), 16), pct: k.pct };
    })
    .sort((a, b) => a.at - b.at);
}

/**
 * The wash at a minute of the day: the strength steps evenly between the two keys around the hour, and the
 * colour is the next key's (LIGHTING section 6), so every minute's wash is a palette colour and never a mix
 * of two. Before the first key and after the last, the table is read as a ring across midnight.
 */
export function washAt(table: readonly LightKey[], minute: Minute): { tint: number; alpha: number } {
  if (table.length === 0) return { tint: 0, alpha: 0 };
  const first = table[0]!;
  if (table.length === 1) return { tint: first.tint, alpha: first.pct / 100 };
  const last = table[table.length - 1]!;
  // the table is a ring: a stretch may cross midnight, so the minutes before the first key are read as the
  // hours after the last one, and the two ends are the same stretch as any pair in between (the first key again, a day on, closes it)
  const m = minute < first.at ? minute + MINUTES : minute;
  for (let i = 0; i < table.length; i += 1) {
    const a = table[i]!;
    const b = i + 1 < table.length ? table[i + 1]! : first;
    const bAt = i + 1 < table.length ? b.at : first.at + MINUTES;
    if (m < a.at || m > bAt) continue;
    const span = bAt - a.at;
    const t = span === 0 ? 0 : (m - a.at) / span;
    // on a key the key's own colour; past it, the colour the stretch is heading to
    return { tint: m === a.at ? a.tint : b.tint, alpha: Math.round(a.pct + (b.pct - a.pct) * t) / 100 };
  }
  return { tint: last.tint, alpha: last.pct / 100 };
}

/** How close an hour is to one of the dusk's two, 0 to 1: flat within half an hour of the centre, then falling away over the shoulder. */
export function warmth(hour: number, centre: number): number {
  return Math.max(0, Math.min(1, 1 - Math.max(0, Math.abs(hour - centre) - DUSK.shoulder) / DUSK.halfWidth));
}

/** How strong the gold wash is at a minute of the day, before its peak. */
export function duskAt(minute: Minute): number {
  const hour = minute / 60;
  return DUSK.peak * Math.max(...DUSK.hours.map((centre) => warmth(hour, centre)));
}

/** The night shade's alpha. */
export function shadeAt(night: number): number {
  return SHADE.night * night;
}

/** The leaf dapple's alpha: it fades out as the night comes in. */
export function dappleAt(night: number): number {
  return SHADE.dapple * (1 - night);
}

/** The frame's vignette at an hour, the same numbers world.ts drew by hand. */
export function frameAt(night: number, rich: boolean): { strength: number; radius: number } {
  return {
    strength: FRAME.strengthDay + (rich ? FRAME.strengthNight : FRAME.strengthPlain) * night,
    radius: FRAME.radiusDay - FRAME.radiusNight * night,
  };
}

/**
 * The frame's ink alpha (0..1) at a distance `d` from the middle of the screen, in screen widths and heights (0.5 is
 * the middle of an edge). The curve is the vignette's own, a sine of the distance toward ink. By night it is whole,
 * the dark the owner asked for; by day it is held at nothing until the outer ~15% of the way to the edge, so the frame
 * is an edge and not a veil over the whole phone (the grass at 40% of the way out keeps its own colour).
 */
export function frameAlpha(d: number, look: { strength: number; radius: number }, night: number): number {
  const curve = d <= look.radius ? Math.max(0, Math.sin((d / look.radius) * 3.14 * look.strength)) : 1;
  const t = Math.min(1, Math.max(0, (d - FRAME_EDGE.from) / (FRAME_EDGE.to - FRAME_EDGE.from)));
  const edge = t * t * (3 - 2 * t);
  return curve * (night + (1 - night) * edge);
}

/** Where the day's frame begins and is whole, as a distance from the middle (the middle of an edge is 0.5). */
const FRAME_EDGE = { from: 0.36, to: 0.48 };

/** The hour a minute of the day falls in, 0 to 23. */
export function hourAt(minute: Minute): number {
  return Math.floor(minute / 60);
}

// ------------------------------------------------------------ the lighting ladder (LIGHTING.md, the owner's C of 30.10)

/** One step of a light's pool: up to this share of the radius, this colour added at this strength (whole percent). */
export interface PoolStep {
  edge: number;
  tint: number;
  pct: number;
}

/** A pool's four steps from the centre out, added light (LIGHTING section 3 B). Where pools meet, the brightest step wins. */
export const POOL_STEPS: readonly PoolStep[] = [
  { edge: 0.25, tint: 0xf8de62, pct: 24 },
  { edge: 0.5, tint: 0xeda83a, pct: 18 },
  { edge: 0.75, tint: 0xeda83a, pct: 12 },
  { edge: 1, tint: 0xb8661f, pct: 8 },
];

/** The checker at a step's edge, as a share of the radius on each side (STYLE 2: dither only where two steps meet). */
export const POOL_DITHER = 0.03;

/** What gives light, and so how big its pool is and the hour it paints from. */
export type LightKind = 'lamp' | 'window' | 'fire';

/** A pool's radii in tiles, across and down: a lamp 1.5, a fire 2, a lit window an ellipse on the ground in front of its wall. */
export const POOL_RADIUS: Readonly<Record<LightKind, readonly [number, number]>> = { lamp: [1.5, 1.5], fire: [2, 2], window: [1, 0.625] };

/** A lamp's head: two steps of `#f8de62` added, in art px from the head: 50% within 6, 25% within 12. */
export const HEAD_GLOW = { tint: 0xf8de62, steps: [{ r: 6, pct: 50 }, { r: 12, pct: 25 }] } as const;

/** A lit window: the glass pixels of the building's own sprite in the fire ramp, the light pane the brighter (STYLE 5). */
export const WINDOW = { glass: [0x8f94a8, 0xc6cad6], lit: [0xeda83a, 0xf8de62] } as const;

/**
 * When a kind of light paints (the owner, 30.10, question 2): lamps and lit windows from 17:00 at half strength,
 * full by 19:00, none by day; a burning fire from 16:30. The morning is the evening backwards: full until `fade`,
 * down to half by `off`, then out. Minutes of the day.
 */
export const GATES: Readonly<Record<LightKind, { on: number; full: number; fade: number; off: number; from: number }>> = {
  lamp: { on: 17 * 60, full: 19 * 60, fade: 5 * 60, off: 7 * 60, from: 0.5 },
  window: { on: 17 * 60, full: 19 * 60, fade: 5 * 60, off: 7 * 60, from: 0.5 },
  fire: { on: 16 * 60 + 30, full: 18 * 60 + 30, fade: 5 * 60 + 30, off: 7 * 60 + 30, from: 0.5 },
};

/** How strongly a kind of light paints its pool at a minute of the day, 0 by day to 1 at night. */
export function poolAt(minute: Minute, kind: LightKind): number {
  const g = GATES[kind];
  const m = ((minute % MINUTES) + MINUTES) % MINUTES;
  if (m >= g.full || m < g.fade) return 1;
  if (m >= g.on) return g.from + ((1 - g.from) * (m - g.on)) / (g.full - g.on);
  if (m < g.off) return 1 - ((1 - g.from) * (m - g.fade)) / (g.off - g.fade);
  return 0;
}

/**
 * The step of a pool a point falls in: `d` is its distance from the centre as a share of the radius, `odd` the
 * checker's parity at that pixel, so a step's edge is a dither `POOL_DITHER` wide. -1 outside the pool.
 */
export function poolStep(d: number, odd: boolean, steps: readonly { edge: number }[] = POOL_STEPS): number {
  const e = d + (odd ? 1 : -1) * POOL_DITHER;
  for (let i = 0; i < steps.length; i += 1) if (e <= steps[i]!.edge) return i;
  return -1;
}

/**
 * One step's disc as a whole-pixel mask, `rx` by `ry` art px of radius: 1 where the pool's step is this one or
 * brighter, so the steps drawn from the outside in leave each pixel at the brightest step that reaches it.
 */
export function poolDisc(rx: number, ry: number, step: number, steps: readonly { edge: number }[] = POOL_STEPS): { w: number; h: number; mask: Uint8Array } {
  const w = 2 * Math.ceil(rx) + 1;
  const h = 2 * Math.ceil(ry) + 1;
  const cx = (w - 1) / 2;
  const cy = (h - 1) / 2;
  const mask = new Uint8Array(w * h);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const s = poolStep(Math.hypot((x - cx) / rx, (y - cy) / ry), (x + y) % 2 === 1, steps);
      if (s >= 0 && s <= step) mask[y * w + x] = 1;
    }
  }
  return { w, h, mask };
}

/** A step's added light as the bytes a layer stores: the colour times its strength times the hour's gate. */
export function poolColour(step: PoolStep, gate: number): number {
  const k = (step.pct / 100) * Math.max(0, Math.min(1, gate));
  const ch = (shift: number) => Math.round(((step.tint >> shift) & 0xff) * k);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

/**
 * STYLE 5: every light cuts its pool out of the night's shade in two hard steps, no tint inside and half the tint
 * in a ring around it. `inner` is the share of the radius cut clean; to the rim the shade is kept at `ring`.
 */
export const CUT = { inner: 0.5, ring: 0.5 } as const;

/** How much of the hour's shade a pixel keeps at `d` (a share of the radius) from a light, before the hour's gate. */
export function cutAt(d: number, odd: boolean): number {
  const s = poolStep(d, odd, [{ edge: CUT.inner }, { edge: 1 }]);
  return s === 0 ? 0 : s === 1 ? CUT.ring : 1;
}

/** The shade kept inside a cut once the hour's gate is read: a half-lit lamp cuts half as deep. */
export function cutKeep(keep: number, gate: number): number {
  return 1 - (1 - keep) * Math.max(0, Math.min(1, gate));
}

/** Luma, Rec. 709 on the encoded channels, 0 to 1: what the readability floor is measured in. */
export function lumaOf(rgb: number): number {
  return (0.2126 * ((rgb >> 16) & 0xff) + 0.7152 * ((rgb >> 8) & 0xff) + 0.0722 * (rgb & 0xff)) / 255;
}

/**
 * The night kept readable (the owner, 30.10, on question 3): inside a light's pool, and in the ring around the
 * player, the ground keeps at least `floor` luma. `READ.ring` is the ring's radius in tiles; `READ.ground` is
 * the ground the floor is held for, the meadow's middle green; the floor itself and the fog's cap are numbers
 * in `params.light.read`, so the owner can judge them on the live preview.
 */
export const READ = { ring: 3, ground: 0x4c9a3f, floor: 22, fog: 40 } as const;

/**
 * The most a multiply shade of colour `ink` may cover before a ground of luma `ground` falls under `floor`:
 * ground x (1 - a + a x ink) >= floor. 1 when the ground is already at or under the floor's need.
 */
export function readableAlpha(floor: number, ground: number, ink: number): number {
  if (ground <= 0 || floor >= ground) return 0;
  return Math.max(0, Math.min(1, (1 - floor / ground) / (1 - ink)));
}

/** The cloud shade by day, faded with the night: half the night's fade and it is gone (by 20:00, from 05:00). */
export function cloudAt(night: number): number {
  return Math.max(0, 1 - 2 * night);
}

/**
 * A fog bank's alpha: the sky's own curve and the night's lift (sky.ts), and at night no more than `nightCap`,
 * so a bank cannot stack on the night's shade past what the floor allows. By day the lift's own cap holds.
 */
export function bankAt(fog: number, weight: number, night: number, nightCap: number): number {
  const lifted = Math.min(BANK_NIGHT_LIFT.cap, fog * weight * (1 + BANK_NIGHT_LIFT.gain * night));
  const cap = BANK_NIGHT_LIFT.cap + (Math.min(BANK_NIGHT_LIFT.cap, nightCap) - BANK_NIGHT_LIFT.cap) * Math.max(0, Math.min(1, night));
  return Math.min(lifted, cap);
}

// ------------------------------------------------------------ body light (STYLE 4)

/** The shared ramps a sprite is drawn in, dark to light (STYLE 2): a step of body light moves a pixel along its ramp. */
export const RAMPS: readonly (readonly number[])[] = [
  [0x1b1a2e, 0x3a3554, 0x5d6177, 0x8f94a8, 0xc6cad6, 0xf5f4ef],
  [0x1f3d2b, 0x2e6b3b, 0x4c9a3f, 0x84c450, 0xc8e88a],
  [0x3d2618, 0x6e4226, 0x9e6b3c, 0xc99a5e, 0xebd3a2],
  [0x172a52, 0x275a99, 0x3f8fd1, 0x7cc4ec, 0xc4ecf8],
  [0x5e1c28, 0xa8302f, 0xe2533f, 0xf6a07f],
  [0xb8661f, 0xeda83a, 0xf8de62],
  [0xd38c66, 0xf3c7a0],
  [0x5b3373, 0x9a5bb0],
];

/** STYLE 4: 4 art px on each side of a body; none when the sun stands within this share of a height of noon. */
export const BODY = { px: 4, noon: 0.15, ink: 0x1b1a2e, dark: 0.85, light: 1.12 } as const;

/** The side of a body the light comes from: the sun's shear leans the shadow away from it. */
export function litSide(sx: number): 'left' | 'right' | undefined {
  if (Math.abs(sx) < BODY.noon) return undefined;
  return sx > 0 ? 'left' : 'right';
}

/**
 * A pixel one step lighter (`+1`) or darker (`-1`) on its ramp. The ink outline stays ink. A colour no ramp holds
 * (a drawn rich sprite's own shade) is scaled by `BODY.dark` or `BODY.light` instead, the nearest to a step.
 */
export function bodyStep(rgb: number, step: 1 | -1): number {
  if (rgb === BODY.ink) return rgb;
  for (const ramp of RAMPS) {
    const i = ramp.indexOf(rgb);
    if (i < 0) continue;
    return ramp[Math.max(0, Math.min(ramp.length - 1, i + step))]!;
  }
  const k = step > 0 ? BODY.light : BODY.dark;
  const ch = (shift: number) => Math.min(255, Math.round(((rgb >> shift) & 0xff) * k));
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

/**
 * The body light over one frame's pixels (RGBA bytes, `w` wide): in every row, the `BODY.px` solid pixels on the lit
 * side one step lighter and as many on the far side one step darker. Writes into `out`, which starts clear: the
 * result is an overlay of only the pixels that changed.
 */
export function bodyLight(src: Uint8ClampedArray | Uint8Array, w: number, h: number, side: 'left' | 'right', out: Uint8ClampedArray | Uint8Array, px: number = BODY.px): void {
  for (let y = 0; y < h; y += 1) {
    const solid: number[] = [];
    for (let x = 0; x < w; x += 1) if ((src[4 * (y * w + x) + 3] ?? 0) >= 128) solid.push(x);
    if (solid.length === 0) continue;
    const n = Math.min(px, Math.floor(solid.length / 2));
    const lead = solid.slice(0, n);
    const tail = solid.slice(solid.length - n);
    const lit = side === 'left' ? lead : tail;
    const dim = side === 'left' ? tail : lead;
    for (const [xs, step] of [[lit, 1], [dim, -1]] as const) {
      for (const x of xs) {
        const i = 4 * (y * w + x);
        const rgb = ((src[i] ?? 0) << 16) | ((src[i + 1] ?? 0) << 8) | (src[i + 2] ?? 0);
        const c = bodyStep(rgb, step);
        if (c === rgb) continue;
        out[i] = (c >> 16) & 0xff;
        out[i + 1] = (c >> 8) & 0xff;
        out[i + 2] = c & 0xff;
        out[i + 3] = 255;
      }
    }
  }
}

/**
 * A light's sun by night (STYLE 4 "Night"): a body standing in a pool casts away from the light's foot, longer the
 * farther it stands, at the shadow's own alpha times the pool's gate. Undefined outside the pool: nothing casts.
 */
export function poolSun(dx: number, dy: number, radius: number, alpha: number, gate: number): { up: true; sx: number; sy: number; length: number; alpha: number } | undefined {
  const d = Math.hypot(dx, dy);
  if (gate <= 0 || d > radius || radius <= 0) return undefined;
  // in whole steps (a sixteenth of a turn, a tenth of a height), so a body walking in a pool reuses a few shadows
  const length = Math.round(10 * (0.3 + 0.8 * (d / radius))) / 10;
  // a body right on the light's foot casts straight back, as under a noon sun
  const turn = d === 0 ? -Math.PI / 2 : Math.round((Math.atan2(dy, dx) / (2 * Math.PI)) * 16) * ((2 * Math.PI) / 16);
  const sx = Math.round(Math.cos(turn) * length * 1000) / 1000;
  const sy = Math.round(Math.sin(turn) * length * 1000) / 1000;
  return { up: true, sx, sy, length, alpha: alpha * gate };
}

/**
 * The sun shaft (LIGHTING section 3 C): one band a tile wide along the sun's line, `#f8de62` added at 6%, in the low
 * sun of the late afternoon and only on a day with cloud, where the light comes through between clouds. Dust motes
 * drift in it (with motion on). Its strength rises from `from` to full by `full`.
 */
export const SHAFT = { tint: 0xf8de62, pct: 6, width: 1, from: 15 * 60 + 30, full: 16 * 60 + 30 } as const;

/** The shaft's alpha at a minute: nothing with the sun down, on a clear day, or before the late afternoon. */
export function shaftAt(minute: Minute, sunUp: boolean, cloudy: boolean): number {
  if (!sunUp || !cloudy || minute < SHAFT.from) return 0;
  return (SHAFT.pct / 100) * Math.min(1, (minute - SHAFT.from) / (SHAFT.full - SHAFT.from));
}
