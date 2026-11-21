/**
 * The parity rows of a craft family (docs/design/SKILL_FAMILIES.md 2.3, the owner's pick of set A, 21.11): every
 * family a craft profession declares has the same shape of tree group (F1), a profession shares one curve (F2), and
 * the pieces of a family stay near the others of its school in work (F3), steps (F4) and count (F5). F6, that a
 * family node reaches only its own family, is a kernel test (kernel/test/recipe-gate.test.ts), not a row here.
 *
 * Work is the sum of `active_ms` down a recipe's inputs, per unit made, the gathering left out. Steps are the
 * longest chain of recipes from gathered goods to the piece. Everything is integer.
 */
import { type Bundle, type RecipeDef, recipeProfession, recipeTier } from '@game/kernel';
import type { Issue } from './load';

/** F3: a family's median work per piece at a tier is at most this many times the median of its school's other families. */
export const WORK_RATIO_MAX = 2;
/** F4: the most recipe steps from gathered goods a family's piece may take. */
export const STEPS_MAX = 3;
/** F5: the fewest recipes an open tier of a family should hold, and the most times the smallest family's count. */
export const PIECES_MIN = 2;
export const PIECES_RATIO_MAX = 3;
/** F1: a family group's two small nodes, in order, and what each does. */
export const SMALLS = [
  { effect: 'craft_speed_pct', value: 5 },
  { effect: 'craft_chance_pct', value: 5 },
] as const;

export interface FamilyRow {
  profession: string;
  family: string;
  tier: number;
  /** the recipes of this family at this tier, by id */
  pieces: string[];
  /** each piece's work per unit, in ms, in the order of `pieces` */
  work: number[];
  /** each piece's steps, in the order of `pieces` */
  steps: number[];
}

/** The recipe that makes an item, the first by id: the item's own chain, or undefined for a gathered good. */
function makerOf(b: Bundle): (item: string) => RecipeDef | undefined {
  const by = new Map<string, RecipeDef>();
  for (const id of Object.keys(b.recipes).sort()) {
    for (const o of b.recipes[id]!.outputs) if (!by.has(o.item)) by.set(o.item, b.recipes[id]!);
  }
  return (item) => by.get(item);
}

/** Work per unit of an item, in ms: its maker's active time and its inputs' work, shared by what the maker yields. */
export function workOf(b: Bundle, item: string): number {
  const maker = makerOf(b);
  const memo = new Map<string, number>();
  const go = (it: string, seen: ReadonlySet<string>): number => {
    const r = maker(it);
    if (!r || seen.has(it)) return 0;
    if (memo.has(it)) return memo.get(it)!;
    const next = new Set(seen).add(it);
    const out = r.outputs.find((o) => o.item === it)!;
    const total = r.active_ms + r.inputs.reduce((n, i) => n + i.qty * go(i.item, next), 0);
    const w = Math.ceil(total / out.qty);
    memo.set(it, w);
    return w;
  };
  return go(item, new Set());
}

/** Steps of an item: the longest chain of recipes under it, 0 for a gathered good. */
export function stepsOf(b: Bundle, item: string): number {
  const maker = makerOf(b);
  const go = (it: string, seen: ReadonlySet<string>): number => {
    const r = maker(it);
    if (!r || seen.has(it)) return 0;
    const next = new Set(seen).add(it);
    return 1 + Math.max(0, ...r.inputs.map((i) => go(i.item, next)));
  };
  return go(item, new Set());
}

/** Every declared family of every craft profession at every tier it holds a recipe, in a stable order. */
export function familyRows(b: Bundle): FamilyRow[] {
  const rows = new Map<string, FamilyRow>();
  for (const id of Object.keys(b.recipes).sort()) {
    const r = b.recipes[id]!;
    if (r.family === undefined) continue;
    const profession = recipeProfession(b, r);
    const tier = recipeTier(b, r);
    const key = `${profession}|${r.family}|${tier}`;
    const row = rows.get(key) ?? { profession, family: r.family, tier, pieces: [], work: [], steps: [] };
    const out = r.outputs[0]!.item;
    row.pieces.push(id);
    row.work.push(workOf(b, out));
    row.steps.push(stepsOf(b, out));
    rows.set(key, row);
  }
  return [...rows.values()].sort((x, y) => x.profession.localeCompare(y.profession) || x.family.localeCompare(y.family) || x.tier - y.tier);
}

/** Twice the median, so an even count needs no fraction. */
export function medianX2(values: readonly number[]): number {
  const s = [...values].sort((x, y) => x - y);
  return s[Math.floor((s.length - 1) / 2)]! + s[Math.floor(s.length / 2)]!;
}

/** F1 to F5 on a bundle, one issue each. `origin` maps an id to the file it came from. */
export function checkFamilies(b: Bundle, origin: Record<string, string>): Issue[] {
  const issues: Issue[] = [];
  const at = (id: string) => origin[id] ?? 'content/core';
  const err = (id: string, where: string, message: string) => issues.push({ file: at(id), where, message, level: 'error' });
  const warn = (id: string, where: string, message: string) => issues.push({ file: at(id), where, message, level: 'warning' });

  // F2: one curve
  const crafts = Object.entries(b.professions).filter(([, p]) => p.verb === 'craft');
  const curve = (id: string) => JSON.stringify(b.professions[id]!.xp_levels);
  const first = crafts[0];
  if (first) {
    for (const [id] of crafts) {
      if (curve(id) !== curve(first[0])) err(id, 'profession.xp_levels', `${id} levels on ${curve(id)}, ${first[0]} on ${curve(first[0])}: every craft profession shares one curve (SKILL_FAMILIES 2.3, F2)`);
    }
  }

  // F1: one shape. Each declared family has its two smalls at 5 (speed, then chance) hanging from the school's first major,
  // and its majors are none yet (they wait) or two techniques; a pair of majors keeps the order of the smalls.
  for (const [sid, sc] of Object.entries(b.schools)) {
    const prof = b.professions[sc.profession];
    const families = prof?.families ?? [];
    if (families.length === 0) continue;
    const firstMajor = sc.nodes.find((n) => n.size === 'major' && n.family === undefined)?.id;
    for (const f of families) {
      const group = sc.nodes.filter((n) => n.family === f);
      if (group.length === 0) {
        err(sid, 'school.nodes', `the family "${f}" has no group of nodes: every craft family has its own (SKILL_FAMILIES 2.2, F1)`);
        continue;
      }
      const smalls = group.filter((n) => n.size === 'small');
      const majors = group.filter((n) => n.size === 'major');
      const here = (n: { id: string }) => `school.nodes.${sc.nodes.findIndex((m) => m.id === n.id)}`;
      if (smalls.length !== 2 || group.length !== smalls.length + majors.length) {
        err(sid, 'school.nodes', `the family "${f}" has ${smalls.length} small nodes and ${majors.length} major ones of ${group.length}: two small nodes, then none or two major ones (SKILL_FAMILIES 2.2, F1)`);
        continue;
      }
      smalls.forEach((n, i) => {
        if (n.effect !== SMALLS[i]!.effect || n.value !== SMALLS[i]!.value) {
          err(sid, here(n), `${n.id} is ${n.effect} ${n.value}: the family's ${i === 0 ? 'first' : 'second'} small node is ${SMALLS[i]!.effect} ${SMALLS[i]!.value} (F1)`);
        }
      });
      const need0 = smalls[0]!.needs ?? [];
      if (firstMajor !== undefined && (need0.length !== 1 || need0[0] !== firstMajor)) {
        err(sid, here(smalls[0]!), `${smalls[0]!.id} hangs from ${need0.join(', ') || 'nothing'}: a family group hangs from the school's first major, ${firstMajor} (F1)`);
      }
      if ((smalls[1]!.needs ?? []).join() !== smalls[0]!.id) err(sid, here(smalls[1]!), `${smalls[1]!.id} hangs from ${(smalls[1]!.needs ?? []).join(', ') || 'nothing'}: the second small node hangs from the first, ${smalls[0]!.id} (F1)`);
      if (majors.length !== 0 && majors.length !== 2) err(sid, 'school.nodes', `the family "${f}" has ${majors.length} major node: two, or none while they wait (F1)`);
      for (const m of majors) if (m.slot !== true) err(sid, here(m), `${m.id} is a major family node and a technique: it carries "slot": true (F1)`);
    }
  }

  // F3 to F5, over the rows
  const rows = familyRows(b);
  const open = b.params.open_tiers;
  const sch = (prof: string) => Object.entries(b.schools).find(([, s]) => s.profession === prof)?.[0] ?? prof;
  for (const prof of new Set(rows.map((r) => r.profession))) {
    const mine = rows.filter((r) => r.profession === prof);
    const id = sch(prof);
    for (let tier = 1; tier <= open; tier++) {
      const here = mine.filter((r) => r.tier === tier);
      // F3
      for (const row of here) {
        const others = here.filter((o) => o !== row).flatMap((o) => o.work);
        if (others.length === 0) continue;
        if (medianX2(row.work) > WORK_RATIO_MAX * medianX2(others)) {
          err(row.pieces[0]!, 'recipe.active_ms', `${row.family} pieces of tier ${tier} take a median ${medianX2(row.work) / 2000} s of work, more than ${WORK_RATIO_MAX} times the ${medianX2(others) / 2000} s of the other families of ${id} (SKILL_FAMILIES 2.3, F3)`);
        }
      }
      // F4
      for (const row of here) {
        row.pieces.forEach((p, i) => {
          if (row.steps[i]! > STEPS_MAX) err(p, 'recipe.inputs', `${p} takes ${row.steps[i]} recipe steps from gathered goods, more than the ${STEPS_MAX} a piece of ${row.family} may (SKILL_FAMILIES 2.3, F4)`);
        });
      }
      // F5: the most any family holds is 3 times the smallest family's count at that tier
      if (here.length > 1) {
        const least = Math.min(...here.map((r) => r.pieces.length));
        for (const row of here) {
          if (row.pieces.length > PIECES_RATIO_MAX * least) err(row.pieces[0]!, 'recipe', `${row.family} holds ${row.pieces.length} recipes at tier ${tier}, more than ${PIECES_RATIO_MAX} times the ${least} of the smallest family of ${id} (F5)`);
        }
      }
    }
    // F5 floor: a family that holds a tier holds at least two there; one alone is a warning, since the family may be filling
    for (const row of mine) {
      if (row.tier <= open && row.pieces.length < PIECES_MIN) warn(row.pieces[0]!, 'families.pieces', `${row.family} holds ${row.pieces.length} recipe at tier ${row.tier}, fewer than the ${PIECES_MIN} an open tier should (F5)`);
    }
  }
  return issues;
}
