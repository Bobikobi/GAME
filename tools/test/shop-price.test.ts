/** A shop offer may leave its price out: the build sets it to the R8 floor, r times the item's value, and refuses an item with no value. */
import { describe, expect, it } from 'vitest';
import { minChargeFor, type Params } from '@game/kernel';
import { SHOP_PRICE_MAX_MG, validateFile } from '@game/schema';
import { assemble, fillShopPrices } from '../src/assemble';
import { loadAll, type Loaded } from '../src/load';

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

/** The real content with Pell's shop given one more offer, its price left out; the file goes through the schema first. */
function withOffer(item: string): { files: Loaded[]; schema: ReturnType<typeof validateFile> } {
  const files = loadAll().files;
  const f = files.find((x) => x.rel.endsWith('shops/trader-shop.json'))!;
  const data = JSON.parse(JSON.stringify(f.data));
  data.shop.sells.push({ item });
  return { files: files.map((x) => (x === f ? { ...f, data } : x)), schema: validateFile(data) };
}

describe('an offer written with no price, through the schema and the build', () => {
  it('passes the schema, and the build sets exactly the floor: r times the solved value', () => {
    const { files, schema } = withOffer('core/hare-fur-hood');
    expect(schema).toEqual([]);
    const { bundle, issues } = assemble(files);
    expect(issues.filter((i) => i.level === 'error')).toEqual([]);
    const offer = bundle!.shops['core/trader-shop']!.sells.find((o) => o.item === 'core/hare-fur-hood')!;
    const v = bundle!.values['core/hare-fur-hood']!;
    expect(v).toBeGreaterThan(0);
    expect(offer.price_mg).toBe(bundle!.params.r_mg_per_value_ms * v);
  });

  it('fails the build when the item has no solved value and the price is left out', () => {
    const { files, schema } = withOffer('core/work-hammer');
    expect(schema).toEqual([]);
    const { bundle, issues } = assemble(files);
    expect(bundle!.values['core/work-hammer']).toBeUndefined();
    const hit = issues.filter((i) => i.level === 'error' && i.message.includes('core/work-hammer has no value'));
    expect(hit).toHaveLength(1);
    expect(hit[0]!.where).toMatch(/^shop\.sells\.\d+\.price_mg$/);
  });
});

describe('the computed price meets the same ceiling as a written one', () => {
  it('is an error naming the offer when r times the value is over the ceiling', () => {
    const issues: { where: string; message: string; level: string }[] = [];
    const big = { r_mg_per_value_ms: SHOP_PRICE_MAX_MG } as unknown as Params;
    const out = fillShopPrices(shop([{ item: 'core/a' }]), { 'core/a': 2 }, big, { 'core/s': 'content/core/shops/s.json' }, issues as never);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.message).toContain('core/a');
    expect(issues[0]!.level).toBe('error');
    expect(out['core/s']!.sells[0]!.price_mg).toBe(SHOP_PRICE_MAX_MG);
  });

  it('is no error at the ceiling itself', () => {
    const issues: never[] = [];
    const edge = { r_mg_per_value_ms: SHOP_PRICE_MAX_MG } as unknown as Params;
    fillShopPrices(shop([{ item: 'core/a' }]), { 'core/a': 1 }, edge, {}, issues);
    expect(issues).toEqual([]);
  });
});
