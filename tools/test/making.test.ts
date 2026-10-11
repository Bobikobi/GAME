/**
 * Gold per hour of making (CR-22): the report `pnpm values` prints, a row for
 * gathering and one for each tier of recipes, in milli-gold per hour of
 * active time, each item at the trader's price for it (CR-18).
 */
import { type Bundle, payFor } from '@game/kernel';
import { beforeAll, describe, expect, it } from 'vitest';
import { type MakingRow, formatMaking, makingReport } from '../src/making';
import { loadBundle } from './helpers/world.js';

let b: Bundle;
let rows: MakingRow[];

beforeAll(() => {
  b = loadBundle();
  rows = makingReport(b);
});

describe('makingReport', () => {
  it('has gathering first, then each tier in order', () => {
    expect(rows.map((r) => r.what)).toEqual(['gathering', 1, 2, 3]);
  });

  it('counts every gathering source and every recipe once', () => {
    expect(rows[0]!.count).toBe(Object.keys(b.resources).length);
    expect(rows.slice(1).reduce((n, r) => n + r.count, 0)).toBe(Object.keys(b.recipes).length);
  });

  it('keeps each row in order: low, median, high', () => {
    for (const r of rows) {
      expect(r.low).toBeLessThanOrEqual(r.median);
      expect(r.median).toBeLessThanOrEqual(r.high);
    }
  });

  it('prices a tier-1 craft by hand: the cord at the made share, the reeds at the raw share', () => {
    const pay = (item: string) => payFor(b.params, b.values[item]!, b.made.includes(item));
    expect(b.made).toContain('core/reed-cord');
    expect(b.made).not.toContain('core/reed');
    // a tier-1 craft at its level never misses: two reeds become a cord in 3000 ms
    const cord = b.recipes['core/reed-cord']!;
    expect(cord.active_ms).toBe(3000);
    const rate = Math.floor(((pay('core/reed-cord') - 2 * pay('core/reed')) * 3_600_000) / 3000);
    const tier1 = rows.find((r) => r.what === 1)!;
    expect(rate).toBeGreaterThanOrEqual(tier1.low);
    expect(rate).toBeLessThanOrEqual(tier1.high);
    // the made share pays for the craft work and lifts the reeds that went in, so making beats the craft weight's raw pay
    const raw = (b.params.k_permille * b.params.r_mg_per_value_ms * b.params.effort_permille.craft * 3600) / 1000;
    expect(rate).toBeGreaterThan(raw);
  });

  it('prices gathering by hand: what a node yields sells for, over its active time', () => {
    const reeds = b.resources['core/reed-bank']!;
    const rate = Math.floor((payFor(b.params, b.values[reeds.output]!) * reeds.yield * 3_600_000) / reeds.active_ms);
    const gathering = rows[0]!;
    expect(rate).toBeGreaterThanOrEqual(gathering.low);
    expect(rate).toBeLessThanOrEqual(gathering.high);
  });
});

describe('formatMaking', () => {
  it('prints one line a row, in gold an hour', () => {
    const lines = formatMaking(rows).split('\n');
    expect(lines).toHaveLength(rows.length);
    expect(lines[0]).toMatch(/^gathering +\d+ sources +\d+\.\d to \d+\.\d gold an hour, median \d+\.\d$/);
    rows.slice(1).forEach((r, i) => {
      expect(lines[i + 1]).toMatch(new RegExp(`^tier ${r.what} +${r.count} recipes? `));
      const g = (mg: number) => (mg / 1000).toFixed(1);
      expect(lines[i + 1]).toContain(`${g(r.low)} to ${g(r.high)} gold an hour, median ${g(r.median)}`);
    });
  });
});
