/**
 * The value table (rules R6, R7). Every source of an item is an activity
 * record: an effort weight w, active time t, a rarity bonus b,
 * inputs and outputs with cost shares. An item's value V is the cheapest way
 * to make it, in value-ms (weighted milliseconds of active play):
 *
 *     yield * V(out) <= share * (w*t + b + sum(qty * V(in)))
 *
 * V is computed from the data and never declared, rounded down so the
 * inequality holds in integers, and then checked again independently.
 * Waiting (respawn) is never paid: it does not appear in the cost.
 */
import type { Bundle, Params } from './bundle';
import { idiv, mulDiv } from './num';

export interface Activity {
  id: string;
  verb: 'gather' | 'dig' | 'craft';
  /** effort weight, permille */
  w: number;
  /** active time, ms */
  t: number;
  /** rarity bonus, value-ms */
  b: number;
  inputs: { item: string; qty: number }[];
  /** expected units per execution = num / den (a dig find is chance/100) */
  outputs: { item: string; num: number; den: number; share: number }[];
}

export interface ValueIssue {
  source: string;
  message: string;
}

export interface ValueTable {
  values: Record<string, number>;
  /** the activity that sets each item's value */
  cheapest: Record<string, string>;
  issues: ValueIssue[];
}

type ContentForValues = Pick<Bundle, 'items' | 'resources' | 'treasures' | 'recipes' | 'params'>;

/** Rarity bonus: only on capacity-limited sources, never above beta of the base cost. */
function rarityBonus(params: Params, rarity: keyof Params['rarity_bonus_ms'], w: number, t: number, limited: boolean): number {
  if (!limited) return 0;
  const cap = mulDiv(params.rarity_budget_permille, w * t, 1_000_000);
  return Math.min(params.rarity_bonus_ms[rarity], cap);
}

export function activitiesOf(content: ContentForValues): Activity[] {
  const { params, items } = content;
  const rarityOf = (id: string) => items[id]?.rarity ?? 'common';
  const out: Activity[] = [];
  for (const id of Object.keys(content.resources).sort()) {
    const r = content.resources[id]!;
    const w = params.effort_permille.easy;
    out.push({
      id,
      verb: 'gather',
      w,
      t: r.active_ms,
      b: rarityBonus(params, rarityOf(r.output), w, r.active_ms, r.respawn_ms > 0),
      inputs: [],
      outputs: [{ item: r.output, num: r.yield, den: 1, share: 100 }],
    });
  }
  for (const id of Object.keys(content.treasures).sort()) {
    const d = content.treasures[id]!;
    const w = params.effort_permille.medium;
    const rarest = d.finds
      .map((f) => rarityOf(f.item))
      .sort((a, b) => rarityRank(b) - rarityRank(a))[0] ?? 'common';
    out.push({
      id,
      verb: 'dig',
      w,
      t: d.active_ms,
      b: rarityBonus(params, rarest, w, d.active_ms, d.respawn_ms > 0),
      inputs: [],
      outputs: d.finds.map((f) => ({ item: f.item, num: f.chance_pct, den: 100, share: f.share_pct })),
    });
  }
  for (const id of Object.keys(content.recipes).sort()) {
    const c = content.recipes[id]!;
    out.push({
      id,
      verb: 'craft',
      w: params.effort_permille.craft,
      t: c.active_ms,
      b: 0,
      inputs: c.inputs.map((s) => ({ item: s.item, qty: s.qty })),
      outputs: c.outputs.map((o) => ({ item: o.item, num: o.qty, den: 1, share: o.share_pct })),
    });
  }
  return out;
}

const RANKS = { common: 0, uncommon: 1, rare: 2, legendary: 3 } as const;
export function rarityRank(r: keyof typeof RANKS): number {
  return RANKS[r];
}

/** cost of one execution, times 1000 so w*t stays an integer */
function cost1000(a: Activity, values: Record<string, number>): number | undefined {
  let sum = a.w * a.t + 1000 * a.b;
  for (const input of a.inputs) {
    const v = values[input.item];
    if (v === undefined) return undefined;
    sum += 1000 * input.qty * v;
  }
  return sum;
}

/** floor(share * cost1000 * den / (100 * 1000 * num)) */
function valueOf(out: Activity['outputs'][number], c1000: number): number {
  return idiv(mulDiv(out.share * out.den, c1000, 1), 100_000 * out.num);
}

export function computeValues(content: ContentForValues): ValueTable {
  const activities = activitiesOf(content);
  const values: Record<string, number> = {};
  const cheapest: Record<string, string> = {};
  const issues: ValueIssue[] = [];

  // Cheapest-source relaxation. Costs are positive, so values only fall and
  // settle within one round per item; still falling after that means a loop
  // that makes an item out of less of itself.
  const rounds = Object.keys(content.items).length + 2;
  let changed = true;
  for (let round = 0; round < rounds && changed; round++) {
    changed = false;
    for (const a of activities) {
      const c = cost1000(a, values);
      if (c === undefined) continue;
      for (const out of a.outputs) {
        const v = valueOf(out, c);
        const current = values[out.item];
        if (current === undefined || v < current) {
          values[out.item] = v;
          cheapest[out.item] = a.id;
          changed = true;
        }
      }
    }
  }
  if (changed) {
    issues.push({ source: 'values', message: 'a recipe loop makes an item out of less of itself' });
  }

  for (const a of activities) {
    const c = cost1000(a, values);
    if (c === undefined) {
      const missing = a.inputs.filter((i) => values[i.item] === undefined).map((i) => i.item);
      issues.push({ source: a.id, message: `inputs with no way to get them: ${missing.join(', ')}` });
      continue;
    }
    const shares = a.outputs.reduce((s, o) => s + o.share, 0);
    if (shares !== 100) issues.push({ source: a.id, message: `output shares sum to ${shares}, they must sum to 100` });
    for (const out of a.outputs) {
      const v = values[out.item] ?? 0;
      // R7, in integers: 100000 * num * V <= share * den * cost1000
      if (100_000 * out.num * v > out.share * out.den * c) {
        issues.push({ source: a.id, message: `${out.item} is worth more than the effort that makes it` });
      }
      if (v < 1) issues.push({ source: a.id, message: `${out.item} carries too little of the cost to have a value` });
    }
  }
  return { values, cheapest, issues };
}

/** What a shop pays for one unit (rule R8): rounded down. */
export function payFor(params: Params, value: number): number {
  return mulDiv(params.k_permille * params.r_mg_per_value_ms, value, 1000);
}

/** The lowest a shop may charge for one unit of a valued item: rounded up. */
export function minChargeFor(params: Params, value: number): number {
  return params.r_mg_per_value_ms * value;
}
