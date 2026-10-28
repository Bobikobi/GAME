import { beforeAll, describe, expect, test } from 'vitest';

import type { Bundle } from '@game/kernel';
import { SHOP_GROUPS, shopGroupOf, shopGroups } from '../src/shopstock';
import { loadBundle } from '../../tools/test/helpers/world';

let bundle: Bundle;

beforeAll(() => {
  bundle = loadBundle();
});

type Offer = { item: string; price_mg: number };
const names = (b: Bundle, offers: readonly Offer[]) =>
  shopGroups(b, offers, (o) => o.item).map((g) => [g.label, g.entries.map((o) => o.item)] as const);

/** A keeper that is not in the content yet (the workshop stall): a shop built from today's items plus a scrap. */
function withKeepers(b: Bundle): Bundle {
  const recipe = Object.keys(b.recipes).sort()[0]!;
  const scrap = { ...b.items['core/berry']!, id: 'test/rope-scrap', name: 'How to twist rope', kind: 'fragment' as const, food: undefined, fragment: { unlocks: recipe } };
  const meta = { creator: 'test', file: 'test.json' };
  return {
    ...b,
    items: { ...b.items, [scrap.id]: scrap },
    shops: {
      ...b.shops,
      'test/workshop': {
        ...meta,
        id: 'test/workshop',
        title: 'The workshop stall',
        buys: false,
        sells: [{ item: scrap.id, price_mg: 20000 }],
      },
    },
    npcs: {
      ...b.npcs,
      'test/workshop-keeper': { ...b.npcs['core/trader']!, id: 'test/workshop-keeper', name: 'Ketil', shop: 'test/workshop' },
    },
  };
}

describe('a shop in named groups (decision 51)', () => {
  test("Pell's stall: the tools apart from the satchel, each group named; the food and the medicine are the inn's", () => {
    const groups = names(bundle, bundle.shops['core/trader-shop']!.sells);
    expect(groups.map(([label]) => label)).toEqual(['Tools', 'To wear']);
    expect(groups[0]![1]).toEqual(['core/basket', 'core/trowel', 'core/axe', 'core/walking-staff']);
    expect(groups[1]![1]).toEqual(['core/satchel']);
  });

  test("Wenna's counter: the food and the first-aid kit, in two groups", () => {
    expect(names(bundle, bundle.shops['core/inn']!.sells)).toEqual([
      ['Food and drink', ['core/berry', 'core/herb-tea', 'core/berry-mash']],
      ['Medicine', ['core/first-aid-kit']],
    ]);
  });

  test('every item lands in exactly one group, in the order of the counter', () => {
    const offers = Object.keys(bundle.items).map((item) => ({ item, price_mg: 1000 }));
    const groups = shopGroups(bundle, offers, (o) => o.item);
    expect(groups.flatMap((g) => g.entries).length).toBe(offers.length);
    const order = SHOP_GROUPS.map(([key]) => key);
    expect(groups.map((g) => order.indexOf(g.key))).toEqual([...groups.map((g) => order.indexOf(g.key))].sort((x, y) => x - y));
  });

  test('a keeper added later is grouped with no code: the workshop stall', () => {
    const b = withKeepers(bundle);
    expect(names(b, b.shops['test/workshop']!.sells)).toEqual([['Recipes', ['test/rope-scrap']]]);
  });

  test('the first-aid kit is medicine by its tag, not food', () => {
    expect(shopGroupOf(bundle, 'core/first-aid-kit')).toBe('medicine');
    expect(shopGroupOf(bundle, 'core/berry')).toBe('food');
    expect(shopGroupOf(bundle, 'core/axe')).toBe('tool');
    expect(shopGroupOf(bundle, 'nobody/unknown')).toBe('material');
  });

  test('an empty counter has no groups', () => {
    expect(shopGroups(bundle, [] as Offer[], (o) => o.item)).toEqual([]);
  });
});
