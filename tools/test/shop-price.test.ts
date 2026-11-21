/** A shop offer may leave its price out: the build sets it to the R8 floor, r times the item's value, and refuses an item with no value. */
import { describe, expect, it } from 'vitest';
import { minChargeFor, type Params } from '@game/kernel';
import { assemble, fillShopPrices } from '../src/assemble';
import { loadAll } from '../src/load';

const params = { r_mg_per_value_ms: 4 } as unknown as Params;
const shop = (sells: { item: string; price_mg?: number }[]) => ({ 'core/s': { id: 'core/s', sells, buys: true } }) as never;

describe('an unpriced shop offer', () => {
  it('takes the floor r times the value, and a written price stays as written', () => {
    const issues: never[] = [];
    const out = fillShopPrices(shop([{ item: 'core/a' }, { item: 'core/b', price_mg: 99 }]), { 'core/a': 250, 'core/b': 250 }, params, {}, issues);
    expect(out['core/s']!.sells).toEqual([
      { item: 'core/a', price_mg: minChargeFor(params, 250) },
      { item: 'core/b', price_mg: 99 },
    ]);
    expect(issues).toEqual([]);
  });

  it('is an error when the item has no value', () => {
    const issues: { where: string; level: string }[] = [];
    fillShopPrices(shop([{ item: 'core/none' }]), {}, params, { 'core/s': 'content/core/shops/s.json' }, issues as never);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ where: 'shop.sells.0.price_mg', level: 'error' });
  });

  it('leaves the real content as it was: every core offer still carries a price', () => {
    const { bundle, issues } = assemble(loadAll().files);
    expect(issues.filter((i) => i.message.includes('cannot be left out'))).toEqual([]);
    for (const s of Object.values(bundle!.shops)) for (const o of s.sells) expect(o.price_mg).toBeGreaterThan(0);
  });
});
