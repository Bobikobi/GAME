/**
 * The jump and the fall (DECISIONS.md, 2026-11-22). A jump goes up one level (`jump.up_levels`) anywhere a step
 * between levels is otherwise refused (G68), down from any height, and across a gap of water one tile wide. It
 * costs a little breath and is refused in the first minute after the first wake. A fall hurts by the levels it
 * drops: one costs nothing, two a share of the health cap, three a larger share, and `jump.death_levels` or more
 * is death (G33). Pure and integer-only, like the rest of the kernel.
 *
 * Outside a fight the player had no breath at all (the fight keeps its own, `fight.ts`), so the jump keeps the
 * smallest one: `player.breath`, absent until the first jump, refilled lazily from the tick against the same cap a
 * fight uses, so an old save and an old log read as before.
 */
import type { Bundle } from './bundle';
import { idiv, mulDiv } from './num';
import { attrAt, hpCap, type PublicState } from './state';
import type { Tile } from './step';
import { levelAt, tagAt } from './world';

/** The four directions a jump goes in; a jump never cuts a corner. */
export const JUMP_DIRS: readonly Tile[] = [[0, -1], [1, 0], [0, 1], [-1, 0]];

/** The ground tag of a gap a jump crosses: water, a stream or a ditch one tile wide. Never a wall, a tree, rubble or a gate. */
export const GAP_TAG = 'water';

/** A tile of ground a jump may cross: water by its ground tag, whatever stands on it. */
export function isGap(bundle: Bundle, x: number, y: number): boolean {
  const m = bundle.map;
  if (x < 0 || y < 0 || x >= m.width || y >= m.height) return false;
  return tagAt(m, x, y) === GAP_TAG;
}

export type Hop = { ok: true; drop: number; across: boolean } | { ok: false; why: string };

/**
 * The one rule of where a jump may land, read by `step`, by G71's walk (tools/src/mapplan.ts) and by the client's
 * jump key, so reach, the first-night measure and play cannot disagree. It judges the line and the heights only;
 * whether the landing can be stood on is `makeWalkable`'s, breath and time are the kernel's.
 *
 * `to` is one tile away in a straight line, or two with a gap between. The climb is at most `up` levels, the drop
 * is not limited; `drop` is the levels fallen (0 or less: level or climbing).
 */
export function jumpRule(bundle: Bundle): (from: Tile, to: Tile) => Hop {
  const m = bundle.map;
  const up = bundle.params.jump.up_levels;
  return (from, to) => {
    const dx = to[0] - from[0];
    const dy = to[1] - from[1];
    const len = Math.abs(dx) + Math.abs(dy);
    if (len < 1 || len > 2 || (dx !== 0 && dy !== 0)) return { ok: false, why: 'You can only jump straight ahead, one tile or across a gap.' };
    if (to[0] < 0 || to[1] < 0 || to[0] >= m.width || to[1] >= m.height) return { ok: false, why: 'There is nothing to land on.' };
    const across = len === 2;
    if (across && !isGap(bundle, from[0] + Math.sign(dx), from[1] + Math.sign(dy))) return { ok: false, why: 'There is nothing to jump over.' };
    const drop = levelAt(m, from[0], from[1]) - levelAt(m, to[0], to[1]);
    if (-drop > up) return { ok: false, why: 'That is too high to jump up.' };
    return { ok: true, drop, across };
  };
}

/** The rule's tiles from `from`: every landing a jump could reach from there by line and height, walkable or not. */
export function jumpTargets(bundle: Bundle, from: Tile): { to: Tile; drop: number; across: boolean }[] {
  const rule = jumpRule(bundle);
  const out: { to: Tile; drop: number; across: boolean }[] = [];
  for (const [dx, dy] of JUMP_DIRS) {
    for (const len of [1, 2]) {
      const to: Tile = [from[0] + dx * len, from[1] + dy * len];
      const hop = rule(from, to);
      if (hop.ok) out.push({ to, drop: hop.drop, across: hop.across });
    }
  }
  return out;
}

/** The most breath a player holds: the fight's cap (`combat.breath_base` and `breath_per_stamina` for each point of stamina). */
export function breathCap(bundle: Bundle, state: PublicState): number {
  const c = bundle.params.combat;
  return c.breath_base + c.breath_per_stamina * attrAt(bundle, state, 'stamina');
}

/** The breath left at `tick`: what the last jump left plus what a second won back since, up to the cap. A player who has not jumped holds the cap. */
export function breathLeft(bundle: Bundle, state: PublicState, tick: number): number {
  const cap = breathCap(bundle, state);
  const b = state.player.breath;
  if (b === undefined) return cap;
  const won = idiv(Math.max(0, tick - b.at) * bundle.params.jump.breath_refill_per_s, 1000);
  return Math.min(cap, b.left + won);
}

/** The health a fall of `levels` takes, in milli-points: nothing for one level or none, then the share of the cap each height names, and all the health at `death_levels` or more. */
export function fallHarm(bundle: Bundle, state: PublicState, levels: number): number {
  const j = bundle.params.jump;
  if (levels >= j.death_levels) return state.player.hp;
  if (levels <= 1) return 0;
  return mulDiv(hpCap(bundle, state), levels === 2 ? j.fall_two_bp : j.fall_three_bp, 10_000);
}
