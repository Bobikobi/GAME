/**
 * The fight's content rows (docs/design/COMBAT.md sections 4.1 and 4.9): every rule about a kind's `fight` block, and
 * the combat params, that reads only the content. A kind without `fight` cannot fight and none of these rows reads it.
 * The arithmetic is the kernel's (fightmath.ts), so the check, the fight and the cost-gate test cannot drift apart.
 */
import { FIGHT_TIER_HITS } from '@game/schema';
import { type Bundle, cycleHarm, feltMs, hitsToFell, idiv, mulDiv, payFor, windowsPerCycle } from '@game/kernel';
import type { Issue } from './load';

const byId = <T>(entries: [string, T][]) => entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

/** Milli-gold the goods a fallen foe leaves are worth at the trader's price (HUNTING 9). */
export function dropsPay(b: Bundle, kind: string): number {
  const hunt = b.map.creatures?.kinds[kind]?.hunt;
  if (!hunt) return 0;
  return hunt.drops.reduce((sum, d) => sum + d.qty * payFor(b.params, b.values[d.item] ?? 0), 0);
}

export function checkFight(b: Bundle, origin: Record<string, string>): Issue[] {
  const issues: Issue[] = [];
  const file = origin[b.map.id] ?? 'content';
  const err = (where: string, message: string) => issues.push({ file, where, message, level: 'error' });
  const c = b.params.combat;
  const paramsFile = 'content/core/params.json';
  const warn = (where: string, message: string) => issues.push({ file, where, message, level: 'warning' });
  const perr = (where: string, message: string) => issues.push({ file: paramsFile, where: `params.combat.${where}`, message, level: 'error' });

  if (c.windup_min_t > c.windup_max_t) perr('windup_min_t', 'a wind-up runs from windup_min_t to windup_max_t: keep the first at or under the second (COMBAT 4.9)');
  if (!(c.swing_floor_t <= c.swing_quick_t && c.swing_quick_t <= c.swing_standard_t && c.swing_standard_t <= c.swing_heavy_t)) {
    perr('swing_floor_t', 'a quick hand swings no slower than a standard one and a heavy one slower than both, none under the floor: swing_floor_t <= quick <= standard <= heavy (COMBAT 4.9, memo 4)');
  }
  if (c.bare_windup_t > c.swing_quick_t) perr('bare_windup_t', 'a strike lands inside its own swing: keep bare_windup_t at or under swing_quick_t (COMBAT 4.9)');

  const cap = b.params.hp_cap * 1000;
  for (const [id, k] of byId(Object.entries(b.map.creatures?.kinds ?? {}))) {
    const f = k.fight;
    if (!f) continue;
    const at = `map.creatures.kinds.${id}.fight`;
    if (!k.hunt) err(at, 'a foe leaves its drops as a carcass: a kind that fights carries hunt fields (COMBAT 4.1, HUNTING 6)');
    if (k.protected) err(at, 'a young animal or a pet is never struck: a protected kind carries no fight (HUNTING 10)');
    const names = new Set<string>();
    for (const [i, m] of f.moves.entries()) {
      if (names.has(m.id)) err(`${at}.moves.${i}.id`, `a second move named "${m.id}"`);
      names.add(m.id);
      if (m.windup_t < c.windup_min_t || m.windup_t > c.windup_max_t) {
        err(`${at}.moves.${i}.windup_t`, `${m.id} winds up ${m.windup_t} ticks: nobody falls unwarned and no telegraph is so slow that hard is easy, so ${c.windup_min_t} to ${c.windup_max_t} (COMBAT 4.9, G31)`);
      }
      if (m.breath > f.breath) err(`${at}.moves.${i}.breath`, `${m.id} costs ${m.breath} breath and the foe has ${f.breath}: it could never start it`);
    }
    f.patterns.forEach((pattern, i) => {
      for (const name of pattern) {
        if (!names.has(name)) err(`${at}.patterns.${i}`, `names the move "${name}" that the foe does not have`);
      }
      if (!pattern.every((n) => names.has(n))) return;
      if (windowsPerCycle(b.params, f, pattern) === 0) {
        err(`${at}.patterns.${i}`, 'no move of this pattern leaves the foe open long enough for a bare-handed strike to land: a fight is read, so every cycle opens a window (COMBAT 4.9)');
      }
      const harm = cycleHarm(b.params, cap, f, pattern);
      if (harm >= cap) {
        err(`${at}.patterns.${i}`, `one run through the pattern takes ${idiv(harm, 1000)} points of a ${idiv(cap, 1000)}-point bar: a player at level with bare hands must be able to win by reading it (COMBAT 4.9, G34)`);
      }
    });
    if (f.weak && !names.has(f.weak.after)) err(`${at}.weak.after`, `the weak move "${f.weak.after}" is not one of the foe's moves`);
    const hits = hitsToFell(b.params, f);
    const [lo, hi] = FIGHT_TIER_HITS[f.tier];
    if (hits < lo || hits > hi) {
      err(`${at}.tier`, `tier ${f.tier} falls in ${lo} to ${hi} hits of a starter hand; ${f.hp} health at ${c.bare_base} a hit is ${hits} (COMBAT 4.9)`);
    }
    const walk = b.params.walk_step_ms;
    if (f.pace_ms < walk) err(`${at}.pace_ms`, `it walks a tile in ${f.pace_ms} ms, quicker than the player's ${walk} ms: a hunter is escaped by walking (HUNTING 2)`);
    // the cost gate (HUNTING 9, G85) as written: what it leaves never passes pay_per_s_mg for each second its slowest
    // pattern needs. A warning, not an error: the hunt ladder (balance/hunt-ladder.ts payCap) shows the param in mg is
    // hundreds of times too small to cap payFor for any kind, the hare included, so the unit is the owner's call.
    // Silent while combat.enabled is 0: the unit of pay_per_s_mg waits on the owner (issue #600), so the shipped content stays quiet.
    if (c.enabled && k.hunt && f.patterns.every((p) => p.every((n) => names.has(n)))) {
      const slowest = Math.max(...f.patterns.map((p) => feltMs(b.params, f, p)));
      if (Number.isFinite(slowest)) {
        const capMg = mulDiv(c.pay_per_s_mg, slowest, 1000);
        const pay = dropsPay(b, id);
        if (pay > capMg) warn(`${at}`, `its drops are worth ${pay} mg at the trader's price and its pattern needs ${idiv(slowest, 1000)} s, a cap of ${capMg} mg at ${c.pay_per_s_mg} mg a second (HUNTING 9, G85)`);
      }
    }
  }
  return issues;
}
