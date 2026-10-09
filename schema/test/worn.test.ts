/** Worn items, the miss and the premium marker validate within their limits (DECISIONS.md, 2026-10-09). */
import { describe, expect, it } from 'vitest';
import { EFFECTS, FORMAT_VERSION, WORN_EFFECTS, validateFile } from '../src/index';

const items = (...list: object[]) => ({ format: FORMAT_VERSION, type: 'items', id: 'tester/items', title: 'Items', creator: 'tester', items: list });
const piece = (wear: object, extra: object = {}) => ({
  id: 'tester/cap',
  name: 'Cap',
  kind: 'material',
  rarity: 'common',
  class: 'garment',
  tier: 1,
  sprite: 'core/base-kit:items/herb',
  wear,
  ...extra,
});
const recipe = (miss: object) => ({
  format: FORMAT_VERSION,
  type: 'recipe',
  id: 'tester/plank',
  title: 'Plank',
  creator: 'tester',
  recipe: {
    station: 'workshop',
    active_ms: 4000,
    level: 3,
    known: 'start',
    inputs: [{ item: 'core/branch', qty: 4 }],
    outputs: [{ item: 'tester/plank', qty: 1, share_pct: 100 }],
    miss,
  },
});

describe('worn items', () => {
  it('every worn effect is an effect the kernel knows', () => {
    for (const e of WORN_EFFECTS) expect(EFFECTS).toContain(e);
  });

  it('accept a work piece of a set, a look with the premium marker, and a tool in the hand', () => {
    expect(validateFile(items(piece({ slot: 'head', effects: [{ effect: 'gather_speed_pct', value: 5 }], set: 'tester/field' })))).toEqual([]);
    expect(validateFile(items(piece({ slot: 'head', look: true }, { premium_later: true })))).toEqual([]);
    expect(validateFile(items(piece({ slot: 'hand', effects: [{ effect: 'dig_speed_pct', value: 3 }] }, { kind: 'tool', class: 'tool' })))).toEqual([]);
  });

  it('refuse a slot or an effect outside the lists, and a third effect', () => {
    expect(validateFile(items(piece({ slot: 'belt' })))).not.toEqual([]);
    expect(validateFile(items(piece({ slot: 'head', effects: [{ effect: 'meal_fill_pct', value: 5 }] })))).not.toEqual([]);
    const three = ['gather_speed_pct', 'dig_speed_pct', 'craft_speed_pct'].map((effect) => ({ effect, value: 1 }));
    expect(validateFile(items(piece({ slot: 'head', effects: three })))).not.toEqual([]);
  });
});

describe('the miss', () => {
  it('accepts a share of the inputs', () => {
    expect(validateFile(recipe({ keep_pct: 25 }))).toEqual([]);
  });

  it('refuses a miss that makes something: it only keeps part of the inputs', () => {
    expect(validateFile(recipe({ keep_pct: 25, output: { item: 'tester/shavings', qty: 1 } }))).not.toEqual([]);
  });

  it('refuses a miss that keeps every input', () => {
    expect(validateFile(recipe({ keep_pct: 100 }))).not.toEqual([]);
  });
});
