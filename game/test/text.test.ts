import { beforeAll, describe, expect, test } from 'vitest';

import { type Bundle, type State, mulDiv, newState, payFor, step } from '@game/kernel';
import { ATTRIBUTE_LABEL, attributeEffects, describe as describeEvent, hudUnlocks, itemBenefit, nodeAction, questSteps, restoreHint, sellable, stationUpgrades, toolOpens, wornAt } from '../src/text';
import { loadBundle } from '../../tools/test/helpers/world';

let bundle: Bundle;

beforeAll(() => {
  bundle = loadBundle();
});

describe('tool benefits', () => {
  test('derives resource and dig-site lists from the bundle', () => {
    expect(itemBenefit(bundle, 'core/basket')).toBe('Tier 1 basket · gathers bell bushes & forest mushrooms & sun herbs & wild herbs · 60 uses');
    expect(itemBenefit(bundle, 'core/trowel')).toBe('Tier 1 trowel · digs deep ruins & gate rubble & under the hill lantern · 40 uses');

    const withReeds: Bundle = {
      ...bundle,
      resources: {
        ...bundle.resources,
        'test/reeds': { ...bundle.resources['core/wild-herbs']!, id: 'test/reeds', title: 'Reeds' },
      },
    };
    expect(itemBenefit(withReeds, 'core/basket')).toContain('gathers bell bushes & forest mushrooms & reeds & sun herbs & wild herbs');
  });
});

describe('the opening recut B', () => {
  /** A fresh state past the town: the bridge, the fire and the walk to town are done. */
  const inTown = () => {
    const s = newState(bundle, 1);
    for (const id of ['core/fix-the-bridge', 'core/first-fire', 'core/into-town']) s.player.quests[id] = 'done';
    return s;
  };

  test('the stall names the roads each tool opens, open or ready to take', () => {
    const s = inTown();
    // whom to help first is the player's: both neighbours' roads are open at once
    expect(toolOpens(bundle, s, 'basket')).toEqual(['Herbs for Pell', 'Where the bells rang']);
    // a start's own task is not a road for anyone else
    expect(toolOpens(bundle, s, 'trowel')).toEqual(['The coin under the lantern']);
    s.player.quests['core/three-fruits'] = 'done';
    expect(toolOpens(bundle, s, 'basket')).toEqual(['Herbs for Pell']);
    s.player.quests['core/a-coin-for-maru'] = 'active';
    expect(toolOpens(bundle, s, 'trowel')).toEqual(['The coin under the lantern']);
    s.player.quests['core/a-coin-for-maru'] = 'done';
    expect(toolOpens(bundle, s, 'trowel')).toEqual([]);
  });

  test('a find with no giver is found once it is in the journal, even after it is used up', () => {
    const s = newState(bundle, 1);
    s.player.starter = 'core/explorer';
    s.player.quests['core/glint-by-the-bridge'] = 'active';
    expect(questSteps(bundle, s, 'core/glint-by-the-bridge')[0]!.done).toBe(false);
    s.player.journal = ['core/axe'];
    expect(questSteps(bundle, s, 'core/glint-by-the-bridge')[0]).toMatchObject({ done: true, text: 'Axe: found' });
  });

  test('a way no hand opens points at the quest that opens it, and opens as a way', () => {
    const s = inTown();
    expect(restoreHint(bundle, s, 'core/arch-way')).toBe('It does not open by hand.');
    s.player.quests['core/the-night-arch'] = 'active';
    expect(restoreHint(bundle, s, 'core/arch-way')).toBe(
      'It does not open by hand. The broken arch at the north edge of the ruins is choked with rubble. The stone beside it says when to come back.',
    );
    expect(describeEvent(bundle, s, { e: 'restore', restore: 'core/arch-way' }).text).toBe('Broken arch: the way is open');
    expect(describeEvent(bundle, s, { e: 'restore', restore: 'core/old-bridge' }).text).toMatch(/ restored$/);
  });

  test('a tool with no uses lasts', () => {
    expect(itemBenefit(bundle, 'core/fine-basket')).toBe('Tier 3 basket · gathers bell bushes & forest mushrooms & sun herbs & wild herbs · lasts · +30% gathering speed');
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
    s.player.bag = { 'core/basket': 1, 'core/flint-trowel': 1, 'core/stone-flakes': 3, 'core/stone-trowel': 1 };
    s.player.wear = { 'core/basket': 5, 'core/flint-trowel': 20 };
    const each = (id: string) => payFor(bundle.params, bundle.values[id]!);
    // the shop basket has no value and is never bought back; the lasting trowel pays in full
    expect(sellable(bundle, s)).toEqual([
      { item: 'core/flint-trowel', each: mulDiv(each('core/flint-trowel'), 80 - 20, 80) },
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

describe('skills in plain words (the owner, 10.10)', () => {
  test('the start cards name every attribute in plain words, and a level-up reads as one sentence', () => {
    expect(Object.keys(ATTRIBUTE_LABEL).sort()).toEqual(['agility', 'carry', 'luck', 'senses', 'stamina']);
    const s = newState(bundle, 1);
    const carry = attributeEffects(bundle, s).find((fx) => fx.attr === 'carry')!;
    expect(`${carry.what} ${carry.now} -> ${carry.next}`).toMatch(/^Your bag holds \d+ -> \d+ things$/);
    const stamina = attributeEffects(bundle, s).find((fx) => fx.attr === 'stamina')!;
    expect(stamina.next).toMatch(/^\d+ minutes$/);
  });
});
