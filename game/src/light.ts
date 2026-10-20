/**
 * The light, as numbers rather than as drawing calls (ART_SYSTEM section 2): the hour's night and
 * dusk, what the shade and the dapple are worth at that hour, the frame's look, and the lantern's
 * pool. Pure, so a test can pin every number the valley shows and the 3D door can read the same
 * ones instead of writing its own.
 *
 * This module holds today's numbers exactly. Nothing here changes the look: it moves the light out
 * of world.ts so that the hour table, the pool's steps and the 3D door have one place to land in.
 */

/** A minute of the day, 0 to 1439. */
export type Minute = number;

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

/**
 * How close an hour is to one of the dusk's two, 0 to 1: flat within half an hour of the centre,
 * then falling away over the shoulder.
 */
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
 * The wash at a minute of the day: the tint and its alpha, stepping evenly between the two keys
 * around the hour. Before the first key and after the last, that key holds.
 */
export function washAt(table: readonly LightKey[], minute: Minute): { tint: number; alpha: number } {
  if (table.length === 0) return { tint: 0, alpha: 0 };
  const first = table[0]!;
  const last = table[table.length - 1]!;
  if (minute <= first.at) return { tint: first.tint, alpha: first.pct / 100 };
  if (minute >= last.at) return { tint: last.tint, alpha: last.pct / 100 };
  for (let i = 0; i < table.length - 1; i += 1) {
    const a = table[i]!;
    const b = table[i + 1]!;
    if (minute < a.at || minute > b.at) continue;
    const span = b.at - a.at;
    const t = span === 0 ? 0 : (minute - a.at) / span;
    const chan = (shift: number) => {
      const ca = (a.tint >> shift) & 0xff;
      const cb = (b.tint >> shift) & 0xff;
      return Math.round(ca + (cb - ca) * t);
    };
    return { tint: (chan(16) << 16) | (chan(8) << 8) | chan(0), alpha: Math.round(a.pct + (b.pct - a.pct) * t) / 100 };
  }
  return { tint: last.tint, alpha: last.pct / 100 };
}

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
