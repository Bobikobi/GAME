/**
 * The equipment foundations in the kernel (EQUIPMENT 3.1; PROGRESSION 5.6; CLOTHING 7.4, 7.5): the derived
 * category, and the pure readers of the soft wear requirement and the worn attribute bonuses. No step calls the
 * readers yet, so on the core every attribute reads as it did.
 */
import { beforeAll, describe, expect, it } from 'vitest';

import type { ItemDef } from '@game/schema';
import {
  ATTRIBUTES,
  type Bundle,
  ITEM_CATEGORIES,
  type ItemInfo,
  type State,
  activeAttr,
  attrAt,
  attrBonusMax,
  attrTotal,
  itemCategory,
  newState,
  slotsFor,
  wearOwnTier,
  wearReqLevel,
} from '@game/kernel';

import { loadBundle } from '../../tools/test/helpers/world.js';

let core: Bundle;
let b: Bundle;

beforeAll(() => {
  core = loadBundle();
  b = structuredClone(core);
  // a digging ladder of 21 levels, so a tier-3 requirement (level 11) can be met
  b.professions['core/digging']!.xp_levels = Array.from({ length: 20 }, (_, i) => i + 1);
  const add = (id: string, extra: Partial<ItemDef>) => {
    b.items[id] = { ...structuredClone(b.items['core/work-clothes']!), id, name: id, ...extra } as ItemInfo;
  };
  add('x/coat', { tier: 3, wear: { slot: 'top', req: { school: 'core/digging', level: 11 }, attrs: { might: 3 } } });
  add('x/strong-coat', { tier: 3, wear: { slot: 'top', req: { school: 'core/digging', level: 11, attr: { might: 9 } }, attrs: { might: 3 } } });
  add('x/odd-coat', { tier: 3, wear: { slot: 'top', req: { school: 'x/nowhere', level: 11 } } });
  add('x/look-cap', { tier: 1, wear: { slot: 'head', look: true, attrs: { might: 4 } } });
  add('x/band', { tier: 1, wear: { slot: 'head', attrs: { might: 2 }, set: 'x/pair' } });
  add('x/band-boots', { tier: 1, wear: { slot: 'feet', attrs: { might: 1 }, set: 'x/pair' } });
});

/** A fresh player at a digging level, wearing the given pieces on the work layer. */
function wearer(level: number, ...worn: string[]): State {
  const s = newState(b, 1);
  s.player.xp['core/digging'] = (level - 1) * 1000;
  for (const id of worn) {
    s.player.bag[id] = (s.player.bag[id] ?? 0) + 1;
    s.player.worn[slotsFor(b.items[id]!.wear!.slot)[0]!] = id;
  }
  return s;
}

describe('itemCategory', () => {
  it('every item of the world has exactly one category, and none is a weapon', () => {
    for (const it of Object.values(core.items)) {
      const cat = itemCategory(it);
      expect(ITEM_CATEGORIES).toContain(cat);
      expect(cat === 'look').toBe(it.wear?.look === true);
      expect(cat === 'tool').toBe(it.tool !== undefined && it.wear?.look !== true);
      expect(cat === 'quest').toBe(it.kind === 'fragment' || it.kind === 'treasure');
      expect(cat).not.toBe('weapon');
    }
  });

  it('names the walking staff, rust pick and work hammer tools, the satchel wear and the two feet looks looks (WEAPONS appendix)', () => {
    const cat = (id: string) => itemCategory(core.items[id]!);
    expect(cat('core/walking-staff')).toBe('tool');
    expect(cat('core/rust-pick')).toBe('tool');
    expect(cat('core/work-hammer')).toBe('tool');
    expect(cat('core/satchel')).toBe('wear');
    expect(cat('core/sandals')).toBe('look');
    expect(cat('core/work-boots')).toBe('look');
  });

  it('reads a look before a weapon and a weapon before a tool', () => {
    const weapon = { tempo: 'standard' as const, windup_t: 4, reach: 1, harm: 100 };
    const tool = { kind: 'staff' as const, tier: 1 };
    expect(itemCategory({ kind: 'tool', weapon })).toBe('weapon');
    expect(itemCategory({ kind: 'tool', tool, weapon })).toBe('weapon');
    expect(itemCategory({ kind: 'tool', weapon, wear: { slot: 'hand', look: true } })).toBe('look');
    expect(itemCategory({ kind: 'tool', tool, wear: { slot: 'hand' } })).toBe('tool');
    expect(itemCategory({ kind: 'material', wear: { slot: 'top' } })).toBe('wear');
    expect(itemCategory({ kind: 'food' })).toBe('consumable');
    expect(itemCategory({ kind: 'treasure' })).toBe('quest');
    expect(itemCategory({ kind: 'material' })).toBe('material');
  });
});

describe('the wear requirement and the attribute bonuses (PROGRESSION 5.6)', () => {
  it('wearReqLevel follows the table and holds its last entry past it', () => {
    expect([1, 2, 3, 4, 5, 6].map((t) => wearReqLevel(b, t))).toEqual([1, 6, 11, 16, 21, 21]);
  });

  it('attrBonusMax adds attr_bonus_step a tier past the table', () => {
    expect(b.params.attr_bonus_step).toBe(2);
    expect([1, 2, 3, 4, 5, 6, 7].map((t) => attrBonusMax(b, t))).toEqual([1, 2, 3, 4, 6, 8, 10]);
  });

  it("a piece above the wearer works at the wearer's own tier", () => {
    const coat = b.items['x/coat']!;
    const at = (level: number) => {
      const s = wearer(level);
      return [wearOwnTier(b, s, coat), activeAttr(b, s, coat, 3)];
    };
    expect(at(1)).toEqual([1, 2]);
    expect(at(6)).toEqual([2, 3]);
    expect(at(11)).toEqual([3, 3]);
    // a requirement in a school that does not exist is never met
    expect(wearOwnTier(b, wearer(11), b.items['x/odd-coat']!)).toBe(1);
    // the attribute threshold reads the base, never a worn bonus: might 9 is out of reach even at level 11
    const strong = b.items['x/strong-coat']!;
    const s = wearer(11, 'x/coat');
    expect(attrAt(b, s, 'might')).toBeLessThan(9);
    expect(wearOwnTier(b, s, strong)).toBe(2);
    // a piece with no requirement is at its own tier
    expect(wearOwnTier(b, wearer(1), b.items['core/work-clothes']!)).toBe(b.items['core/work-clothes']!.tier ?? 1);
  });

  it('attrTotal is attrAt on the core, so no play changes', () => {
    const coreWork = Object.values(core.items).filter((it) => it.wear && !it.wear.look);
    expect(coreWork.length).toBeGreaterThan(0);
    for (const attr of ATTRIBUTES) {
      const fresh = newState(core, 1);
      expect(attrTotal(core, fresh, attr)).toBe(attrAt(core, fresh, attr));
      for (const it of coreWork) {
        const s = newState(core, 1);
        s.player.bag[it.id] = 1;
        s.player.worn[slotsFor(it.wear!.slot)[0]!] = it.id;
        const total = attrTotal(core, s, attr);
        expect(total).toBe(attrAt(core, s, attr));
        expect(Number.isInteger(total)).toBe(true);
      }
    }
    // a look counts for nothing, even with attributes on it
    const look = wearer(1);
    look.player.looks.head = 'x/look-cap';
    look.player.worn.head = 'x/look-cap';
    expect(attrTotal(b, look, 'might')).toBe(attrAt(b, look, 'might'));
    // a tier-1 work piece adds its bonus whole; two pieces of one set add no set bonus
    const one = wearer(1, 'x/band');
    expect(attrTotal(b, one, 'might')).toBe(attrAt(b, one, 'might') + 2);
    const pair = wearer(1, 'x/band', 'x/band-boots');
    const total = attrTotal(b, pair, 'might');
    expect(total).toBe(attrAt(b, pair, 'might') + 3);
    expect(Number.isInteger(total)).toBe(true);
  });
});
