/**
 * The value side of the crafting core (DECISIONS.md, 2026-10-09): the
 * derived effort tier (kernel review 8.1) and the world's rarity budget
 * (kernel review 8.2).
 */
import { beforeAll, describe, expect, test } from 'vitest';

import { type Bundle, activitiesOf, computeValues, effortTier, rarityBudget } from '@game/kernel';

import { loadBundle } from '../../tools/test/helpers/world.js';

let bundle: Bundle;

beforeAll(() => {
  bundle = loadBundle();
});

describe('effort tier', () => {
  test('a tier-1 activity keeps the weight its verb always had', () => {
    expect(effortTier('gather', 1)).toBe('easy');
    expect(effortTier('dig', 1)).toBe('medium');
    expect(effortTier('craft', 1)).toBe('craft');
  });

  test('each tier above 1 moves one step up, to hard at most', () => {
    expect(effortTier('gather', 2)).toBe('medium');
    expect(effortTier('gather', 3)).toBe('craft');
    expect(effortTier('dig', 2)).toBe('craft');
    expect(effortTier('craft', 2)).toBe('hard');
    expect(effortTier('craft', 20)).toBe('hard');
    expect(effortTier('gather', 20)).toBe('hard');
  });

  test('every activity carries its derived tier, and its weight is that tier\'s', () => {
    for (const a of activitiesOf(bundle)) {
      expect(a.w).toBe(bundle.params.effort_permille[a.effort]);
    }
  });

  test('a higher tier output raises the value of the same work', () => {
    const recipe = bundle.recipes['core/berry-mash']!;
    const output = recipe.outputs[0]!.item;
    const tier1 = computeValues(bundle).values[output]!;
    const items = { ...bundle.items, [output]: { ...bundle.items[output]!, tier: 2 } };
    const tier2 = computeValues({ ...bundle, items }).values[output]!;
    expect(tier2).toBeGreaterThan(tier1);
  });
});

describe('rarity budget', () => {
  test('the core world sits inside its budget', () => {
    const b = rarityBudget(bundle);
    expect(b.limit_ppm).toBe(bundle.params.rarity_budget_permille * 1000);
    expect(b.used_ppm).toBeGreaterThan(0);
    expect(b.used_ppm).toBeLessThanOrEqual(b.limit_ppm);
    expect(b.used_ppm).toBe(b.parts.reduce((n, p) => n + p.ppm, 0));
    for (let i = 1; i < b.parts.length; i++) expect(b.parts[i - 1]!.ppm).toBeGreaterThanOrEqual(b.parts[i]!.ppm);
  });

  test('counts nodes over respawn times the bonus, rounded up', () => {
    const a = activitiesOf(bundle).find((x) => x.b > 0 && x.capacity)!;
    const part = rarityBudget(bundle).parts.find((p) => p.id === a.id)!;
    const exact = (a.capacity!.count * a.b * 1_000_000) / a.capacity!.respawn_ms;
    expect(part.ppm).toBe(Math.ceil(exact));
  });

  test('more nodes of a rare source use more of it', () => {
    const a = activitiesOf(bundle).find((x) => x.verb === 'gather' && x.b > 0)!;
    const before = rarityBudget(bundle).used_ppm;
    const res = bundle.resources[a.id]!;
    const resources = { ...bundle.resources, [a.id]: { ...res, count: res.count * 2 } };
    expect(rarityBudget({ ...bundle, resources }).used_ppm).toBeGreaterThan(before);
  });

  test('a source with no respawn carries no bonus and no part', () => {
    const a = activitiesOf(bundle).find((x) => x.verb === 'gather' && x.b > 0)!;
    const resources = { ...bundle.resources, [a.id]: { ...bundle.resources[a.id]!, respawn_ms: 0 } };
    const again = activitiesOf({ ...bundle, resources }).find((x) => x.id === a.id)!;
    expect(again.b).toBe(0);
    expect(again.capacity).toBeUndefined();
    expect(rarityBudget({ ...bundle, resources }).parts.some((p) => p.id === a.id)).toBe(false);
  });
});
