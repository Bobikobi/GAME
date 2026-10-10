import { beforeAll, describe, expect, test } from 'vitest';

import { type Bundle, type State, mulDiv, newState, payFor, step } from '@game/kernel';
import {
  bagGroups,
  classLine,
  className,
  hudUnlocks,
  itemBenefit,
  journalGroups,
  nodeAction,
  sellable,
  stationGate,
  stationText,
  stationUpgrades,
  wornAt,
} from '../src/text';
import { loadBundle } from '../../tools/test/helpers/world';

let bundle: Bundle;

beforeAll(() => {
  bundle = loadBundle();
});

describe('tool benefits', () => {
  test('derives resource and dig-site lists from the bundle', () => {
    expect(itemBenefit(bundle, 'core/basket')).toBe('Tier 1 basket · gathers forest mushrooms & sun herbs & wild herbs · 60 uses');
    expect(itemBenefit(bundle, 'core/trowel')).toBe('Tier 1 trowel · digs deep ruins & gate rubble & under the hill lantern · 40 uses');

    const withReeds: Bundle = {
      ...bundle,
      resources: {
        ...bundle.resources,
        'test/reeds': { ...bundle.resources['core/wild-herbs']!, id: 'test/reeds', title: 'Reeds' },
      },
    };
    expect(itemBenefit(withReeds, 'core/basket')).toContain('gathers forest mushrooms & reeds & sun herbs & wild herbs');
  });

  test('a tool with no uses lasts', () => {
    expect(itemBenefit(bundle, 'core/fine-basket')).toBe('Tier 3 basket · gathers forest mushrooms & sun herbs & wild herbs · lasts · +30% gathering speed');
    expect(itemBenefit(bundle, 'core/stone-trowel')).toBe('Tier 3 trowel · digs deep ruins & gate rubble & under the hill lantern · lasts · +30% gathering speed');
    expect(itemBenefit(bundle, 'core/flint-trowel')).toContain(' · 80 uses · ');
  });
});

describe('what a node asks of the player', () => {
  test('a tree is felled and everything else is gathered', () => {
    expect(nodeAction(bundle, bundle.resources['core/oak-trees']!)).toBe('Fell tree');
    for (const r of Object.values(bundle.resources).filter((x) => x.tool !== 'axe')) {
      expect(nodeAction(bundle, r), r.id).toMatch(/^Gather /);
    }
    expect(nodeAction(bundle, bundle.resources['core/berry-bushes']!)).toBe('Gather Redberry');
  });

  test('the axe says it fells, and what', () => {
    expect(itemBenefit(bundle, 'core/axe')).toBe('Tier 1 axe · fells oak trees · 50 uses');
  });
});

describe('food benefits', () => {
  test('speak in food meter points and minutes of work', () => {
    expect(itemBenefit(bundle, 'core/berry')).toBe('+4 food · about 34 s of work');
    expect(itemBenefit(bundle, 'core/berry-mash')).toBe('+15 food · about 2 min of work');
  });
});

describe('hud unlocks', () => {
  test('the bag after a pickup, the log after an entry, a finished task or a waiting point', () => {
    const s = newState(bundle, 1);
    expect(hudUnlocks(s)).toEqual({ bag: false, log: false });
    s.player.bag['core/river-stone'] = 1;
    expect(hudUnlocks(s)).toEqual({ bag: true, log: false });
    s.player.bag = {};
    expect(hudUnlocks(s)).toEqual({ bag: false, log: false });
    s.player.journal.push('Mended by Test');
    expect(hudUnlocks(s)).toEqual({ bag: true, log: true });

    const t = newState(bundle, 1);
    t.player.quests['core/mend-the-bridge'] = 'done';
    expect(hudUnlocks(t)).toEqual({ bag: true, log: true });
    expect(hudUnlocks(newState(bundle, 1), 1)).toEqual({ bag: true, log: true });
  });
});

describe('the sell list', () => {
  test('prices one unit as the kernel does: a worn tool that is the last unit pays for the uses it has left', () => {
    const s = newState(bundle, 1);
    s.player.bag = { 'core/basket': 1, 'core/flint-trowel': 1, 'core/reed': 2, 'core/stone-flakes': 3, 'core/stone-trowel': 1 };
    s.player.wear = { 'core/basket': 5, 'core/flint-trowel': 20 };
    const each = (id: string) => payFor(bundle.params, bundle.values[id]!, bundle.made.includes(id));
    // made goods pay the made share and the gathered reed the raw share (CR-18)
    expect(bundle.made).toEqual(expect.arrayContaining(['core/flint-trowel', 'core/stone-flakes', 'core/stone-trowel']));
    expect(each('core/reed')).toBe(payFor(bundle.params, bundle.values['core/reed']!));
    expect(each('core/stone-flakes')).toBe(payFor(bundle.params, bundle.values['core/stone-flakes']!, true));
    // the shop basket has no value and is never bought back; the lasting trowel pays in full
    expect(sellable(bundle, s)).toEqual([
      { item: 'core/flint-trowel', each: mulDiv(each('core/flint-trowel'), 80 - 20, 80) },
      { item: 'core/reed', each: each('core/reed') },
      { item: 'core/stone-flakes', each: each('core/stone-flakes') },
      { item: 'core/stone-trowel', each: each('core/stone-trowel') },
    ]);
    expect(sellable(bundle, s)[0]!.each).toBeLessThan(each('core/flint-trowel'));
    // with a second one in the bag, the worn one goes last: one unit sells in full
    s.player.bag['core/flint-trowel'] = 2;
    expect(sellable(bundle, s)[0]).toEqual({ item: 'core/flint-trowel', each: each('core/flint-trowel') });
  });
});

describe('worn things', () => {
  test('names the place the kernel put an item, and taking it off from there is accepted', () => {
    const r = step(bundle, newState(bundle, 1), { t: 'start', starter: 'core/forager', name: 'Wearer' }, 0);
    if (!r.ok) throw new Error(r.error);
    const put = (s: State, item: string): State => {
      const next = step(bundle, s, { t: 'wear', item }, s.tick);
      if (!next.ok) throw new Error(next.error);
      return next.state;
    };
    let s = r.state;
    s.player.bag['core/reed-hat'] = 1;
    s.player.bag['core/lucky-charm'] = 2;
    expect(wornAt(bundle, s, 'core/reed-hat')).toBeUndefined();
    s = put(put(s, 'core/reed-hat'), 'core/lucky-charm');
    expect(wornAt(bundle, s, 'core/reed-hat')).toEqual({ slot: 'head', look: false });
    expect(wornAt(bundle, s, 'core/lucky-charm')).toEqual({ slot: 'jewelry1', look: false });
    expect(wornAt(bundle, s, 'core/stone-flakes')).toBeUndefined();
    const off = step(bundle, s, { t: 'unwear', ...wornAt(bundle, s, 'core/reed-hat')! }, s.tick);
    if (!off.ok) throw new Error(off.error);
    expect(wornAt(bundle, off.state, 'core/reed-hat')).toBeUndefined();
    expect(wornAt(bundle, off.state, 'core/lucky-charm')).toEqual({ slot: 'jewelry1', look: false });
  });

  test('a look is found on the look layer only', () => {
    const withLook: Bundle = {
      ...bundle,
      items: { ...bundle.items, 'test/crown': { ...bundle.items['core/reed-hat']!, id: 'test/crown', wear: { slot: 'head', look: true } } },
    };
    const s = newState(withLook, 1);
    s.player.bag['test/crown'] = 1;
    s.player.worn.head = 'test/crown';
    expect(wornAt(withLook, s, 'test/crown')).toBeUndefined();
    s.player.worn = {};
    s.player.looks.head = 'test/crown';
    expect(wornAt(withLook, s, 'test/crown')).toEqual({ slot: 'head', look: true });
  });
});

describe('station upgrades', () => {
  test('the part built over the one standing, and nothing past the top or at the fire', () => {
    const s = newState(bundle, 1);
    expect(stationUpgrades(bundle, s, 'workshop')).toEqual([]);
    s.player.camp = ['core/campfire', 'core/work-stone'];
    expect(stationUpgrades(bundle, s, 'workshop')).toEqual(['core/workbench']);
    expect(stationUpgrades(bundle, s, 'fire')).toEqual([]);
    s.player.camp = ['core/campfire', 'core/workbench'];
    expect(stationUpgrades(bundle, s, 'workshop')).toEqual(['core/workshop']);
    s.player.camp = ['core/campfire', 'core/workshop'];
    expect(stationUpgrades(bundle, s, 'workshop')).toEqual([]);
  });
});

describe('class and tier (crafting wave 4)', () => {
  test('a base class by its word, a family in brackets, the tier after it', () => {
    expect(classLine(bundle, 'core/berry')).toBe('Plant (berry), tier 1');
    expect(classLine(bundle, 'core/woven-mat')).toBe('Fibre, tier 2');
    expect(classLine(bundle, 'core/fine-basket')).toBe('Tool, tier 3');
    expect(className(bundle, undefined)).toBe('Other');
  });

  test("an extension's own class reads by its name, and an item with no class shows its tier alone", () => {
    const withDye: Bundle = {
      ...bundle,
      classes: { 'test/dye': { id: 'test/dye', name: 'Dye', base: 'plant', creator: 'test', file: 'test.json' } },
      items: {
        ...bundle.items,
        'test/indigo': { ...bundle.items['core/berry']!, id: 'test/indigo', name: 'Indigo', class: 'test/dye', family: undefined, tier: 2 },
        'test/plain': { ...bundle.items['core/stone']!, id: 'test/plain', name: 'Plain', class: undefined },
      },
    };
    expect(classLine(withDye, 'test/indigo')).toBe('Dye, tier 2');
    expect(classLine(withDye, 'test/plain')).toBe('Tier 1');
    expect(journalGroups(withDye).map((g) => g.label)).toEqual(['Clay', 'Dye', 'Fibre', 'Garment', 'Jewelry', 'Meal', 'Other', 'Plant', 'Relic', 'Stone', 'Tool', 'Wood']);
  });

  test('where a recipe is made names the tier past the first', () => {
    expect(stationText(bundle, bundle.recipes['core/herb-tea']!)).toBe('the fire');
    expect(stationText(bundle, bundle.recipes['core/reed-cord']!)).toBe('the workshop');
    expect(stationText(bundle, bundle.recipes['core/woven-mat']!)).toBe('a workshop of tier 2');
    expect(stationText(bundle, bundle.recipes['core/fine-basket']!)).toBe('a workshop of tier 3');
  });

  test("the station's tier is the gate, and it names the part that fits", () => {
    const s = newState(bundle, 1);
    const gate = (recipe: string) => stationGate(bundle, s, bundle.recipes[recipe]!);
    expect(gate('core/woven-mat')).toBeUndefined();
    s.player.camp = ['core/campfire', 'core/work-stone'];
    expect(gate('core/reed-cord')).toBeUndefined();
    expect(gate('core/herb-tea')).toBeUndefined();
    expect(gate('core/woven-mat')).toBe('Needs a workshop of tier 2: the workbench.');
    expect(gate('core/fine-basket')).toBe('Needs a workshop of tier 3: the workshop.');
    s.player.camp = ['core/campfire', 'core/workbench'];
    expect(gate('core/woven-mat')).toBeUndefined();
    expect(gate('core/fine-basket')).toBe('Needs a workshop of tier 3: the workshop.');
    s.player.camp = ['core/campfire', 'core/workshop'];
    expect(gate('core/fine-basket')).toBeUndefined();
  });

  test('the gate says what the kernel refuses', () => {
    const r = step(bundle, newState(bundle, 1), { t: 'start', starter: 'core/forager', name: 'Maker' }, 0);
    if (!r.ok) throw new Error(r.error);
    const s = r.state;
    s.player.camp = ['core/campfire', 'core/work-stone'];
    s.player.recipes = [...s.player.recipes, 'core/woven-mat'];
    s.player.bag['core/reed-cord'] = 3;
    const recipe = bundle.recipes['core/woven-mat']!;
    expect(stationGate(bundle, s, recipe)).toBe('Needs a workshop of tier 2: the workbench.');
    const at: [number, number] = [0, 0];
    const refused = step(bundle, s, { t: 'craft', recipe: 'core/woven-mat', at }, s.tick);
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.error).toBe('This needs a workshop of tier 2.');
  });
});

describe('bag categories (CR-11)', () => {
  test('by kind in a fixed order, worn things apart, each sorted by name', () => {
    const ids = [
      'core/stone',
      'core/berry',
      'core/reed-hat',
      'core/basket',
      'core/old-coin',
      'core/stew-scrap',
      'core/lucky-charm',
      'core/herb',
      'core/stone-trowel',
      'core/herb-tea',
    ];
    expect(bagGroups(bundle, ids)).toEqual([
      { label: 'Food', ids: ['core/herb-tea', 'core/berry'] },
      { label: 'Materials', ids: ['core/stone', 'core/herb'] },
      { label: 'Tools', ids: ['core/basket', 'core/stone-trowel'] },
      { label: 'To wear', ids: ['core/lucky-charm', 'core/reed-hat'] },
      { label: 'Treasures', ids: ['core/old-coin'] },
      { label: 'Recipe scraps', ids: ['core/stew-scrap'] },
    ]);
  });

  test('an empty category is left out, a tool held in the hand stays a tool, and nothing is lost', () => {
    expect(bagGroups(bundle, ['core/berry'])).toEqual([{ label: 'Food', ids: ['core/berry'] }]);
    expect(bagGroups(bundle, [])).toEqual([]);
    const withHand: Bundle = {
      ...bundle,
      items: { ...bundle.items, 'test/hammer': { ...bundle.items['core/trowel']!, id: 'test/hammer', name: 'Hammer', wear: { slot: 'hand' } } },
    };
    expect(bagGroups(withHand, ['test/hammer', 'test/gone'])).toEqual([
      { label: 'Materials', ids: ['test/gone'] },
      { label: 'Tools', ids: ['test/hammer'] },
    ]);
  });
});

describe('the journal by class and family (C12)', () => {
  test('one group per class by name, the items of no family first, then a row per family', () => {
    const groups = journalGroups(bundle);
    expect(groups.map((g) => g.label)).toEqual(['Clay', 'Fibre', 'Garment', 'Jewelry', 'Meal', 'Plant', 'Relic', 'Stone', 'Tool', 'Wood']);
    expect(groups.find((g) => g.label === 'Plant')!.rows).toEqual([
      { family: 'berry', ids: ['core/bellberry', 'core/berry'] },
      { family: 'herb', ids: ['core/sunleaf', 'core/herb'] },
      { family: 'mushroom', ids: ['core/mushroom'] },
    ]);
    expect(groups.find((g) => g.label === 'Relic')!.rows).toEqual([
      { ids: ['core/stone-idol'] },
      { family: 'coin', ids: ['core/maru-coin', 'core/old-coin'] },
      { family: 'scrap', ids: ['core/stew-scrap'] },
    ]);
    // every item is in exactly one row
    const all = groups.flatMap((g) => g.rows.flatMap((r) => r.ids)).sort();
    expect(all).toEqual(Object.keys(bundle.items).sort());
  });
});
