/**
 * The arithmetic of a fight that content is held to (docs/design/COMBAT.md sections 4.1 and 4.9), pure and integer-only.
 * The check, the fight and the cost-gate test all read these, so they cannot drift apart. Damage is exact (G79): no
 * chance decides a hit, so a tier is a count of hits and a pattern's harm is a sum.
 */
import type { Bundle, Params } from './bundle';
import { idiv, idivUp } from './num';

export type CreatureKindDef = NonNullable<Bundle['map']['creatures']>['kinds'][string];
export type FightDef = NonNullable<CreatureKindDef['fight']>;
export type MoveDef = FightDef['moves'][number];

/** Hits of a starter hand that fell a foe: its health over the bare hand's points. */
export function hitsToFell(params: Params, fight: FightDef): number {
  return idivUp(fight.hp, params.combat.bare_base);
}

/** The health a move takes from a player whose bar tops at `cap` milli-points: the cap over the move's divisor. */
export function moveHarm(params: Params, cap: number, move: MoveDef): number {
  return idiv(cap, move.harm_div ?? params.combat.bite_div);
}

/** Ticks a move holds the foe: wind-up, the active window, then the open recovery. */
export function moveTicks(params: Params, move: MoveDef): number {
  return move.windup_t + params.combat.active_t + move.recover_t;
}

/** Whether a bare-handed strike started in a move's recovery can land inside it. */
export function opensWindow(params: Params, move: MoveDef): boolean {
  return move.recover_t >= params.combat.bare_windup_t;
}

/** The moves a pattern names, in order; an unknown name is skipped (the check names it). */
export function patternMoves(fight: FightDef, pattern: readonly string[]): MoveDef[] {
  const byId = new Map(fight.moves.map((m) => [m.id, m]));
  return pattern.flatMap((id) => {
    const m = byId.get(id);
    return m ? [m] : [];
  });
}

/** Ticks one run through a pattern takes. */
export function cycleTicks(params: Params, fight: FightDef, pattern: readonly string[]): number {
  return patternMoves(fight, pattern).reduce((n, m) => n + moveTicks(params, m), 0);
}

/** Milli-points of health one run through a pattern takes if nothing is answered. */
export function cycleHarm(params: Params, cap: number, fight: FightDef, pattern: readonly string[]): number {
  return patternMoves(fight, pattern).reduce((n, m) => n + moveHarm(params, cap, m), 0);
}

/** Strikes of a bare hand that can land in one run through a pattern: one for each recovery that is long enough. */
export function windowsPerCycle(params: Params, fight: FightDef, pattern: readonly string[]): number {
  return patternMoves(fight, pattern).filter((m) => opensWindow(params, m)).length;
}

/**
 * Game milliseconds the pattern needs for a player at band level with bare hands to fell the foe, reading it: whole
 * runs through the pattern until the hits are landed. Infinity when no window opens.
 */
export function feltMs(params: Params, fight: FightDef, pattern: readonly string[]): number {
  const windows = windowsPerCycle(params, fight, pattern);
  if (windows === 0) return Number.POSITIVE_INFINITY;
  return idivUp(hitsToFell(params, fight), windows) * cycleTicks(params, fight, pattern) * params.wild.tick_ms;
}
