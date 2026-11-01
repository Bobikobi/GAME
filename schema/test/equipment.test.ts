/**
 * The equipment foundation fields (EQUIPMENT 3.3, 3.6; CLOTHING 7.4, 7.5, 7.6, 11): `bind` on an item, and on a
 * worn piece a soft requirement `req`, worn attributes `attrs` and one garment `trait`. Each accepted shape first,
 * then the refusals with the path at the field. The check, not the schema, refuses attrs and traits in content.
 */
import { describe, expect, it } from 'vitest';
import { FORMAT_VERSION, TRAITS, validateFile } from '../src/index';

const items = (...list: object[]) => ({ format: FORMAT_VERSION, type: 'items', id: 'tester/items', title: 'Items', creator: 'tester', items: list });
const piece = (wear: object, extra: object = {}) => ({
  id: 'tester/cap',
  name: 'Cap',
  kind: 'material',
  rarity: 'common',
  class: 'garment',
  tier: 1,
  sprite: 'core/base-kit:items/herb',
  weight: 1,
  wear,
  ...extra,
});
const check = (wear: object, extra: object = {}) => validateFile(items(piece(wear, extra)));
const pathsOf = (wear: object, extra: object = {}) => check(wear, extra).map((i) => i.path);
const under = (paths: string[], prefix: string) => paths.length > 0 && paths.every((p) => p.startsWith(prefix));

describe('the equipment foundation fields', () => {
  it('takes bind none, account and character, and refuses another', () => {
    for (const bind of ['none', 'account', 'character']) expect(check({ slot: 'head', look: true }, { bind })).toEqual([]);
    expect(pathsOf({ slot: 'head', look: true }, { bind: 'guild' })).toContain('/items/0/bind');
  });

  it('takes worn attributes as optional keys', () => {
    expect(check({ slot: 'head', attrs: { might: 2 } })).toEqual([]);
    expect(check({ slot: 'head', attrs: { senses: 1, stamina: 3 } })).toEqual([]);
    expect(under(pathsOf({ slot: 'head', attrs: {} }), '/items/0/wear/attrs')).toBe(true);
    expect(pathsOf({ slot: 'head', attrs: { might: 0 } })).toContain('/items/0/wear/attrs/might');
    expect(under(pathsOf({ slot: 'head', attrs: { charm: 1 } }), '/items/0/wear/attrs')).toBe(true);
  });

  it('takes a wear requirement of a profession and a level', () => {
    expect(check({ slot: 'head', req: { school: 'core/digging', level: 6 } })).toEqual([]);
    expect(check({ slot: 'head', req: { school: 'core/digging', level: 6, attr: { might: 4 } } })).toEqual([]);
    expect(pathsOf({ slot: 'head', req: { school: 'core/digging', level: 0 } })).toContain('/items/0/wear/req/level');
    expect(pathsOf({ slot: 'head', req: { school: 'digging', level: 6 } })).toContain('/items/0/wear/req/school');
    expect(under(pathsOf({ slot: 'head', req: { school: 'core/digging', level: 6, tier: 2 } }), '/items/0/wear/req')).toBe(true);
    expect(under(pathsOf({ slot: 'head', req: { level: 6 } }), '/items/0/wear/req')).toBe(true);
  });

  it('takes the five garment traits and no other', () => {
    expect(TRAITS).toEqual(['cold_proof', 'snow_shod', 'storm_proof', 'ice_grip', 'heat_ward']);
    for (const trait of TRAITS) expect(check({ slot: 'top', trait })).toEqual([]);
    expect(pathsOf({ slot: 'top', trait: 'fire_proof' })).toContain('/items/0/wear/trait');
  });

  it('a core-shaped item without the new fields still validates (regression guard, passes before by design)', () => {
    expect(check({ slot: 'top', effects: [{ effect: 'gather_speed_pct', value: 5 }], set: 'tester/field' })).toEqual([]);
    expect(check({ slot: 'feet', look: true }, { premium_later: true })).toEqual([]);
    expect(check({ slot: 'back', places: 24 })).toEqual([]);
  });
});
