/**
 * The light, as numbers rather than as drawing calls (ART_SYSTEM section 2): the hour's night and
 * dusk, what the shade and the dapple are worth at that hour, the frame's look, the lantern's pool,
 * and the lighting ladder the owner picked on 30.10 (LIGHTING.md, C): the pools of lamps, windows and
 * fires and the hour they paint from, the body light, the night's cut and the rule that keeps the
 * night readable. Pure, so a test can pin every number the valley shows and the 3D door can read the
 * same ones instead of writing its own.
 */
import { BANK_NIGHT_LIFT } from './sky';

/** A minute of the day, 0 to 1439. */
export type Minute = number;
/** Minutes in a day: a table of hours is read as a ring of this length. */
const MINUTES = 1440;

/** The lantern's pool at night, in world px: clear inside, a short edge in whole-pixel steps, the dark outside. */
export const LIGHT_POOL = { r: 34, edge: 2, dark: 0.7, tint: 0xf0dcc0 } as const;

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
  // hours after the last one, and the two ends are the same stretch as any pair in between
  const ring = [...table, { ...first, at: first.at + MINUTES }];
  const m = minute < first.at ? minute + MINUTES : minute;
  for (let i = 0; i < ring.length - 1; i += 1) {
    const a = ring[i]!;
    const b = ring[i + 1]!;
    if (m < a.at || m > b.at) continue;
    const span = b.at - a.at;
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
  const length = 0.3 + 0.8 * (d / radius);
  // a body right on the light's foot casts straight back, as under a noon sun
  const ux = d === 0 ? 0 : dx / d;
  const uy = d === 0 ? -1 : dy / d;
  return { up: true, sx: ux * length, sy: uy * length, length, alpha: alpha * gate };
}
