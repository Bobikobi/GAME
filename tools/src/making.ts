/**
 * Gold per hour of making, per tier (CR-22). A try at a recipe sells at the
 * trader for its outputs, or on a miss for what it keeps, less what its
 * inputs would have sold for, over its active time. The try is priced at the
 * recipe's own level and before luck, the same average try the check holds
 * to (CR-16). Gathering is the line to compare with: the market's steps are
 * tuned from these numbers, not guessed.
 */
import { type Bundle, missOutcome, payFor, recipeTier } from '@game/kernel';

const HOUR_MS = 3_600_000;

export interface MakingRow {
  /** 'gathering' or the tier of the recipes, from 1 */
  what: 'gathering' | number;
  /** how many recipes or gathering sources the row covers */
  count: number;
  /** milli-gold per hour of active time */
  low: number;
  median: number;
  high: number;
}

function row(what: MakingRow['what'], rates: number[]): MakingRow {
  const sorted = [...rates].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 1 ? sorted[mid]! : Math.round((sorted[mid - 1]! + sorted[mid]!) / 2);
  return { what, count: sorted.length, low: sorted[0]!, median, high: sorted[sorted.length - 1]! };
}

export function makingReport(b: Bundle): MakingRow[] {
  const sale = (stacks: readonly { item: string; qty: number }[]) =>
    stacks.reduce((n, s) => n + payFor(b.params, b.values[s.item] ?? 0) * s.qty, 0);
  const chances = b.params.craft_chance_bp;
  const rows: MakingRow[] = [];

  const gathered = Object.values(b.resources).map((r) => Math.floor((sale([{ item: r.output, qty: r.yield }]) * HOUR_MS) / r.active_ms));
  if (gathered.length > 0) rows.push(row('gathering', gathered));

  const byTier = new Map<number, number[]>();
  for (const id of Object.keys(b.recipes).sort()) {
    const c = b.recipes[id]!;
    const tier = recipeTier(b, c);
    const p = chances[Math.min(tier, chances.length) - 1] ?? 10_000;
    const tried = p * sale(c.outputs) + (10_000 - p) * sale(missOutcome(b, c).keep) - 10_000 * sale(c.inputs);
    const rate = Math.floor((tried * (HOUR_MS / 10_000)) / c.active_ms);
    byTier.set(tier, [...(byTier.get(tier) ?? []), rate]);
  }
  for (const tier of [...byTier.keys()].sort((a, b) => a - b)) rows.push(row(tier, byTier.get(tier)!));
  return rows;
}

/** One line a row: "tier 2   5 recipes   12.3 to 45.6 gold an hour, median 30.1". */
export function formatMaking(rows: readonly MakingRow[]): string {
  const g = (mg: number) => (mg / 1000).toFixed(1);
  return rows
    .map((r) => {
      const what = r.what === 'gathering' ? 'gathering' : `tier ${r.what}`;
      const many = r.what === 'gathering' ? `${r.count} source${r.count === 1 ? '' : 's'}` : `${r.count} recipe${r.count === 1 ? '' : 's'}`;
      return `${what.padEnd(10)} ${many.padEnd(11)} ${g(r.low)} to ${g(r.high)} gold an hour, median ${g(r.median)}`;
    })
    .join('\n');
}
