/**
 * The light table, pure (no Phaser, no browser): the rows of a world's day (painted-light.json), the rows a land takes from its world, and the light at a minute between two rows.
 * Moved out of painted.ts (round 5, 21.11) so a test can run the rules of the figure's presence on a generated map without a renderer. The row types stay in painted.ts (tools/art/scene/format.py reads them from its text) and come in here as types only.
 */
import lightTables from './painted-light.json';
import { coverDeep } from './painted-cover';
import type { LightRow, Lit } from './painted';
import { WIND_SEASON, windBetween, type Wind } from './wind';

export const mix = (a: number, b: number, t: number): number => a + (b - a) * t;
export const mix3 = (a: readonly number[], b: readonly number[], t: number): [number, number, number] => [mix(a[0]!, b[0]!, t), mix(a[1]!, b[1]!, t), mix(a[2]!, b[2]!, t)];

const NO_WARM: readonly number[] = [1, 1, 1];

/** What a shadow leaves of the light on a flat surface, per channel: what the standard's `albedo x (ambient + sun x visible)` gives. */
export function shadeTint(l: Lit, v: number): [number, number, number] {
  const n = l.elev;
  // the evening's warmth rides on the share of the sun a shadow takes away (none where v = 1), never on the light the ground is lit by
  const s = Math.min(1, Math.max(0, 1 - v));
  const f = (c: 0 | 1 | 2): number => ((l.amb[c] + l.sun[c] * n * v) / (l.amb[c] + l.sun[c] * n)) * (1 + (l.warm[c] - 1) * s);
  return [f(0), f(1), f(2)];
}

/** The world a land belongs to (its hourset through the aliases): the key of its table in painted-light.json */
export function worldOf(scene: { hourset?: string }): string {
  return (lightTables.aliases as Record<string, string>)[scene.hourset ?? 'river'] ?? scene.hourset ?? 'river';
}

/** The wind of a world at a minute of the day (its table's field, wind.ts): what the classic door reads, which has no land of its own to take rows from. */
export function windOfWorld(world: string, minute: number, season: string = WIND_SEASON): Wind {
  const worlds = lightTables.worlds as unknown as Record<string, { rows: LightRow[] }>;
  return litAt((worlds[world] ?? worlds['river']!).rows, minute, false, season).wind;
}

/** The rows of a land's light: its world's table, with the fields the land overrides (painted-light.json `overrides`, by land id). */
export function lightRowsOf(scene: { id: string; hourset?: string }): LightRow[] {
  const worlds = lightTables.worlds as unknown as Record<string, { rows: LightRow[] }>;
  const alias = (lightTables.aliases as Record<string, string>)[scene.hourset ?? 'river'] ?? scene.hourset ?? 'river';
  const rows = (worlds[alias] ?? worlds['river']!).rows;
  const over = (lightTables.overrides as Record<string, Partial<LightRow> | string>)[scene.id];
  return over && typeof over === 'object' ? rows.map((r) => ({ ...r, ...over })) : rows;
}

/** The world's light at a minute of the day: a straight line between the two rows around it, round the clock (the last row to the first over midnight). `hold` keeps the first and last row outside them instead (the standard's old two hours, a measure's lever). */
export function litAt(rows: readonly LightRow[], minute: number, hold = false, season: string = WIND_SEASON): Lit {
  const n = rows.length;
  let i = n - 1;
  for (let k = 0; k < n; k++) if (rows[k]!.minute <= minute) i = k;
  const a = rows[i]!;
  const b = rows[(i + 1) % n]!;
  let t: number;
  if (hold) t = n < 2 || b.minute === a.minute ? 0 : Math.max(0, Math.min(1, (minute - a.minute) / (b.minute - a.minute)));
  else {
    const span = (b.minute - a.minute + 1440) % 1440 || 1440;
    t = (((minute - a.minute) % 1440 + 1440) % 1440) / span;
  }
  const lx = mix(a.L[0] / Math.hypot(...a.L), b.L[0] / Math.hypot(...b.L), t);
  const ly = mix(a.L[1] / Math.hypot(...a.L), b.L[1] / Math.hypot(...b.L), t);
  const m = Math.hypot(lx, ly) || 1;
  const elev = mix(a.elev, b.elev, t);
  const hc = Math.sqrt(1 - elev * elev);
  return {
    amb: mix3(a.amb, b.amb, t),
    sun: mix3(a.sun, b.sun, t),
    L3: [(lx / m) * hc, (ly / m) * hc, elev],
    elev,
    sl: mix(a.sl, b.sl, t),
    sq: mix(a.sq, b.sq, t),
    al: mix(a.al, b.al, t),
    wall: mix(a.wall, b.wall, t),
    spec: mix(a.spec, b.spec, t),
    fill: mix(a.fill, b.fill, t),
    shift: mix(a.shift, b.shift, t),
    // a row with no number takes the rule's at its own height, so a line between a named row and an unnamed one is a line between two numbers
    cover: a.cover === undefined && b.cover === undefined ? undefined : mix(a.cover ?? coverDeep(a.elev), b.cover ?? coverDeep(b.elev), t),
    warm: mix3(a.warm ?? NO_WARM, b.warm ?? NO_WARM, t),
    wind: windBetween(a.wind, b.wind, t, season),
    fog: a.fog && b.fog ? { bottom: mix(a.fog.bottom, b.fog.bottom, t), top: mix(a.fog.top, b.fog.top, t) } : undefined,
  };
}
