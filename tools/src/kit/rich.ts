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
  'chars/digger_down',
  'chars/digger_idle_down',
  'chars/digger_idle_left',
  'chars/digger_idle_up',
  'chars/digger_left',
  'chars/digger_up',
  'chars/digger_w_down',
  'chars/digger_w_idle_down',
  'chars/digger_w_idle_left',
  'chars/digger_w_idle_up',
  'chars/digger_w_left',
  'chars/digger_w_up',
  'chars/digger_w_work_down',
  'chars/digger_w_work_left',
  'chars/digger_w_work_up',
  'chars/digger_work_down',
  'chars/digger_work_left',
  'chars/digger_work_up',
  'chars/elder',
  'chars/elder_blink',
  'chars/explorer_down',
  'chars/explorer_idle_down',
  'chars/explorer_idle_left',
  'chars/explorer_idle_up',
  'chars/explorer_left',
  'chars/explorer_up',
  'chars/explorer_w_down',
  'chars/explorer_w_idle_down',
  'chars/explorer_w_idle_left',
  'chars/explorer_w_idle_up',
  'chars/explorer_w_left',
  'chars/explorer_w_up',
  'chars/explorer_w_work_down',
  'chars/explorer_w_work_left',
  'chars/explorer_w_work_up',
  'chars/explorer_work_down',
  'chars/explorer_work_left',
  'chars/explorer_work_up',
  'chars/forager_down',
  'chars/forager_idle_down',
  'chars/forager_idle_left',
  'chars/forager_idle_up',
  'chars/forager_left',
  'chars/forager_up',
  'chars/forager_w_down',
  'chars/forager_w_idle_down',
  'chars/forager_w_idle_left',
  'chars/forager_w_idle_up',
  'chars/forager_w_left',
  'chars/forager_w_up',
  'chars/forager_w_work_down',
  'chars/forager_w_work_left',
  'chars/forager_w_work_up',
  'chars/forager_work_down',
  'chars/forager_work_left',
  'chars/forager_work_up',
  'chars/player_down',
  'chars/player_idle_down',
  'chars/player_idle_left',
  'chars/player_idle_up',
  'chars/player_left',
  'chars/player_up',
  'chars/player_work_down',
  'chars/player_work_left',
  'chars/player_work_up',
  'chars/trader',
  'chars/trader_blink',
  'chars/woman_down',
  'chars/woman_idle_down',
  'chars/woman_idle_left',
  'chars/woman_idle_up',
  'chars/woman_left',
  'chars/woman_up',
  'chars/woman_work_down',
  'props/bush_empty',
  'props/canopy_1',
  'props/canopy_2',
  'props/canopy_3',
  'props/dead_tree',
  'props/flowers_blue',
  'props/fog',
  'props/hazard_wolf',
  'props/house_small',
  'props/rubble',
  'props/ruin_arch',
  'props/ruin_pillar',
  'props/ruin_wall',
  'props/statue_head',
  'props/totem',
  'props/tree_oak',
  'props/young_tree',
  'tiles/bank_e',
  'tiles/bank_n',
  'tiles/bank_s',
  'tiles/bank_w',
  'tiles/bridge',
  'tiles/bridge_broken',
  'tiles/rubble',
  'tiles/shore_e',
  'tiles/shore_n',
  'tiles/shore_s',
  'tiles/shore_w',
  'tiles/water',
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
