/**
 * The whole game is rich (DECISIONS.md, 2026-10-23): every sprite is drawn at 64 art pixels per tile
 * (`density` 4) in kit:gen's rich style, in the core palette and the shared ramps it names. `pnpm check`
 * holds it: a sprite at 16 px (`density` 1) is refused unless the core kit still waits to redraw it, and
 * those sprites are listed here by name. A wave that lands takes its names off; nothing is added.
 */

/** The core kit, the only kit that still holds 16 px sprites. */
export const CORE_KIT = 'core/base-kit';

/** The core kit's sprites still at 16 px per tile, each waiting for the wave that redraws it. */
export const SIXTEEN_PX_LEFT: readonly string[] = [
  'chars/elder',
  'chars/elder_blink',
  'chars/player_idle_down',
  'chars/player_left',
  'chars/player_work_left',
  'chars/trader',
  'chars/trader_blink',
  'chars/woman_idle_down',
  'props/canopy_1',
  'props/canopy_2',
  'props/canopy_3',
  'props/fog',
  'props/hazard_wolf',
  'tiles/bank_e',
  'tiles/bank_n',
  'tiles/bank_s',
  'tiles/bank_w',
  'tiles/shore_e',
  'tiles/shore_n',
  'tiles/shore_s',
  'tiles/shore_w',
];

const LEFT = new Set(SIXTEEN_PX_LEFT);

/** What breaks the rule for one sprite of a kit, or nothing. A density of neither grid is the size rule's to name. */
export function richProblem(kitId: string, name: string, s: { density?: number; ramps?: readonly string[] }): string | undefined {
  const density = s.density ?? 1;
  const waiting = kitId === CORE_KIT && LEFT.has(name);
  if (density === 1) {
    return waiting ? undefined : 'is drawn at 16 px per tile, and new art is drawn rich at 64 (density 4) through kit:gen (DECISIONS.md, 2026-10-23: the whole game is rich)';
  }
  if (density !== 4) return undefined;
  if (waiting) return 'is drawn at 64 px per tile now: take it off SIXTEEN_PX_LEFT in tools/src/kit/rich.ts';
  if (kitId === CORE_KIT && (s.ramps ?? []).length === 0) {
    return 'names no ramps: a rich sprite of the core kit names the shared ramps it draws in, as its kit:gen manifest line gives them';
  }
  return undefined;
}

/** The names on the list that the core kit does not hold (a sprite renamed or removed). */
export function staleLeft(sprites: Readonly<Record<string, unknown>>): string[] {
  return SIXTEEN_PX_LEFT.filter((name) => !(name in sprites));
}
