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

/** One duration in game milliseconds, rounded up to the pulse that can finish it (COMBAT 4.9). */
export function durationTicks(ms: number, tickMs: number): number {
  return idivUp(ms, tickMs);
}

/**
 * The one pulse dial. Content and the bundle keep durations in milliseconds; the fight and the animal scheduler
 * read their pulse counts from this conversion and nowhere else.
 */
export function pulseDurations(params: Params) {
  const t = (ms: number): number => durationTicks(ms, params.wild.tick_ms);
  const c = params.combat;
  return {
    wild: { ...params.wild, think_t: t(params.wild.think_ms) },
    combat: {
      ...c,
      swing_quick_t: t(c.swing_quick_ms),
      swing_standard_t: t(c.swing_standard_ms),
      swing_heavy_t: t(c.swing_heavy_ms),
      swing_floor_t: t(c.swing_floor_ms),
      bare_windup_t: t(c.bare_windup_ms),
      windup_min_t: t(c.windup_min_ms),
      windup_max_t: t(c.windup_max_ms),
      active_t: t(c.active_ms),
      rehit_t: t(c.rehit_ms),
      mercy_t: t(c.mercy_ms),
      stun_t: t(c.stun_ms),
      dodge_t: t(c.dodge_ms),
      dodge_cooldown_t: t(c.dodge_cooldown_ms),
      breath_hold_t: t(c.breath_hold_ms),
      breath_stagger_t: t(c.breath_stagger_ms),
      guard_stagger_t: t(c.guard_stagger_ms),
      give_up_t: t(c.give_up_ms),
      claim_lock_t: t(c.claim_lock_ms),
    },
  };
}

/** A foe move's millisecond content resolved on the same pulse dial. */
export function movePulseDurations(params: Params, move: MoveDef) {
  return {
    ...move,
    windup_t: durationTicks(move.windup_ms, params.wild.tick_ms),
    recover_t: durationTicks(move.recover_ms, params.wild.tick_ms),
    cooldown_t: durationTicks(move.cooldown_ms, params.wild.tick_ms),
  };
}

/** Phase boundaries from one move start; cumulative rounding prevents three phase ceilings from stacking. */
export function movePulseTimeline(params: Params, move: MoveDef) {
  return {
    active_since_t: durationTicks(move.windup_ms, params.wild.tick_ms),
    recovery_since_t: durationTicks(move.windup_ms + params.combat.active_ms, params.wild.tick_ms),
    idle_since_t: durationTicks(move.windup_ms + params.combat.active_ms + move.recover_ms, params.wild.tick_ms),
  };
}

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
  return movePulseTimeline(params, move).idle_since_t;
}

/** Whether a bare-handed strike started in a move's recovery can land inside it. */
export function opensWindow(params: Params, move: MoveDef): boolean {
  return move.recover_ms >= params.combat.bare_windup_ms;
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
