import { beforeAll, describe, expect, test } from 'vitest';

import { type Bundle, type State, mulDiv, newState, payFor, step } from '@game/kernel';
import { ATTRIBUTE_LABEL, attributeEffects, describe as describeEvent, bagGroups, classLine, className, eatLabel, hudUnlocks, itemBenefit, journalGroups, lanternNight, nightCountdown, nodeAction, questSteps, restoreHint, sellable, stationGate, stationText, stationUpgrades, toolOpens, wornAt } from '../src/text';
import { loadBundle } from '../../tools/test/helpers/world';

let bundle: Bundle;

beforeAll(() => {
  bundle = loadBundle();
});

describe('tool benefits', () => {
  test('derives resource and dig-site lists from the bundle', () => {
    expect(itemBenefit(bundle, 'core/basket')).toBe('Tier 1 basket · gathers bell bushes & forest mushrooms & sun herbs & wild herbs · 60 uses');
    expect(itemBenefit(bundle, 'core/trowel')).toBe('Tier 1 trowel · digs deep ruins & gate rubble & hall rubble & under the hill lantern · 40 uses');

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
    // a start's own task is not a road for anyone else, and Maru's coin waits for his bells
    expect(toolOpens(bundle, s, 'trowel')).toEqual([]);
    s.player.quests['core/three-fruits'] = 'done';
    expect(toolOpens(bundle, s, 'basket')).toEqual(['Herbs for Pell']);
    expect(toolOpens(bundle, s, 'trowel')).toEqual(['The coin under the lantern']);
    s.player.quests['core/a-coin-for-maru'] = 'active';
    expect(toolOpens(bundle, s, 'trowel')).toEqual(['The coin under the lantern']);
    s.player.quests['core/a-coin-for-maru'] = 'done';
    expect(toolOpens(bundle, s, 'trowel')).toEqual([]);
  });

  test('a find with no giver is found once it is in the journal, even after it is used up', () => {
    const s = newState(bundle, 1);
    s.player.race = 'core/human';
    s.player.pocket = 'core/north-meadow';
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
    expect(itemBenefit(bundle, 'core/stone-trowel')).toBe('Tier 3 trowel · digs deep ruins & gate rubble & hall rubble & under the hill lantern · lasts · +30% gathering speed');
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
    expect(itemBenefit(bundle, 'core/axe')).toBe('Tier 1 axe · fells fallen logs & oak trees · 50 uses');
  });
});

describe('food benefits', () => {
  test('speak in health points and, while hunger drains, minutes of work', () => {
    // the shipped valley drains nothing since P-5c; a world that still does says how long a food lasts
    expect(itemBenefit(bundle, 'core/berry')).toBe('+4 health');
    const b = structuredClone(bundle);
    b.params.satiety_drain_per_min = 7000;
    expect(itemBenefit(b, 'core/berry')).toBe('+4 health · about 34 s of work');
    expect(itemBenefit(b, 'core/berry-mash')).toBe('+15 health · about 2 min of work');
  });

  test('with no hunger clock nothing divides by it, and a food that hurts says so on its Eat button', () => {
    const b = structuredClone(bundle);
    b.params.satiety_drain_per_min = 0;
    expect(itemBenefit(b, 'core/berry')).toBe('+4 health');
    const stamina = attributeEffects(b, newState(b, 1)).find((fx) => fx.attr === 'stamina')!;
    expect(stamina.next).toMatch(/^\d+ points$/);

    b.items['core/berry'] = { ...b.items['core/berry']!, food: { satiety: 2, hurt: 10 } };
    expect(itemBenefit(b, 'core/berry')).toBe('+2 health · hurts: -10 health');
    expect(eatLabel(b, 'core/berry')).toBe('Eat (+2, -10)');
    b.items['core/berry'] = { ...b.items['core/berry']!, food: { satiety: 0, hurt: 10 } };
    expect(eatLabel(b, 'core/berry')).toBe('Eat (-10)');
    expect(eatLabel(bundle, 'core/berry')).toBe('Eat (+4)');
    // what heals without being food is used, not eaten
    expect(eatLabel(bundle, 'core/bandage')).toBe('Use (+20)');
    expect(eatLabel(bundle, 'core/first-aid-kit')).toBe('Use (+50)');
    expect(describeEvent(bundle, newState(bundle, 1), { e: 'eat', item: 'core/bandage', satiety: 50_000 })!.text).toBe('You used Bandage');
  });
});

describe('the night (G31)', () => {
  /** A world with one wolf far from anything, so the shipped valley can be asked about the dark. */
  function hunted(): Bundle {
    const b = structuredClone(bundle);
    b.map.props = [...b.map.props, { id: 'test/wolf', sprite: 'core/base-kit:props/hazard_wolf', x: 0, y: 0, w: 1, h: 1, solid: false, hazard: { kind: 'predator', window: ['night'] } }];
    return b;
  }
  /** The valley with every hazard taken out: nothing there hunts. */
  function calm(): Bundle {
    const b = structuredClone(bundle);
    b.map.props = b.map.props.filter((p) => !p.hazard);
    return b;
  }
  const town = (b: Bundle): [number, number] => {
    const slot = b.map.slots.find((sl) => sl.kind === 'area' && sl.tag === 'town')!;
    return [slot.x + Math.floor(slot.w / 2), slot.y + Math.floor(slot.h / 2)];
  };

  test('counts down to dark outside a safe place, only in a world with hazards', () => {
    const b = hunted();
    const s = newState(b, 1);
    const out: [number, number] = [b.map.spawn.x, b.map.spawn.y];
    // tick 0 is noon and dark falls at 20:00, 400000 ticks later
    expect(nightCountdown(b, s, out, 0)).toEqual({ text: 'Dark in 6:40', soon: false });
    expect(nightCountdown(b, s, out, 345_000)).toEqual({ text: 'Dark in 0:55', soon: true });
    expect(nightCountdown(b, s, out, 500_000)).toBeUndefined();
    expect(nightCountdown(b, s, town(b), 0)).toBeUndefined();
    expect(nightCountdown(calm(), newState(calm(), 1), out, 0)).toBeUndefined();
  });

  test('the lantern warning belongs to one night, outside a safe place', () => {
    const b = hunted();
    const s = newState(b, 1);
    const out: [number, number] = [b.map.spawn.x, b.map.spawn.y];
    expect(lanternNight(b, s, out, 100_000)).toBeUndefined();
    expect(lanternNight(b, s, out, 500_000)).toBe(850_000);
    expect(lanternNight(b, s, out, 800_000)).toBe(850_000);
    expect(lanternNight(b, s, out, 1_700_000)).toBe(2_050_000);
    expect(lanternNight(b, s, town(b), 500_000)).toBeUndefined();
    expect(lanternNight(calm(), newState(calm(), 1), out, 500_000)).toBeUndefined();
  });

  test('a hurt says what did it', () => {
    const s = newState(bundle, 1);
    expect(describeEvent(bundle, s, { e: 'hurt', by: 'predator', id: 'x/wolf', hp: 1 })).toEqual({ text: 'Bitten! Run for a safe place', tone: 'bad' });
    expect(describeEvent(bundle, s, { e: 'hurt', by: 'food', hp: 1 })?.tone).toBe('bad');
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
    const r = step(bundle, newState(bundle, 1), { t: 'start', race: 'core/human', name: 'Wearer' }, 0);
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
    expect(Object.keys(ATTRIBUTE_LABEL).sort()).toEqual(['agility', 'luck', 'might', 'senses', 'spirit', 'stamina']);
    const s = newState(bundle, 1);
    expect(attributeEffects(bundle, s).map((fx) => fx.attr).sort()).toEqual(Object.keys(ATTRIBUTE_LABEL).sort());
    const might = attributeEffects(bundle, s).find((fx) => fx.attr === 'might')!;
    expect(`${might.what} ${might.now} -> ${might.next}`).toMatch(/^Your load limit \d+ -> \d+$/);
    // spirit has no rule that reads it yet: the row says so instead of promising a number
    const spirit = attributeEffects(bundle, s).find((fx) => fx.attr === 'spirit')!;
    expect(spirit.note).toMatch(/nothing yet/);
    const stamina = attributeEffects(bundle, s).find((fx) => fx.attr === 'stamina')!;
    expect(stamina.next).toMatch(/^\d+ points$/);
    const draining = structuredClone(bundle);
    draining.params.satiety_drain_per_min = 7000;
    expect(attributeEffects(draining, s).find((fx) => fx.attr === 'stamina')!.next).toMatch(/^\d+ minutes$/);
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
    // the core's rows only: a creator's items join these groups (or add a class) without touching this test
    const core = (label: string) =>
      groups
        .find((g) => g.label === label)!
        .rows.map((r) => ({ ...r, ids: r.ids.filter((id) => id.startsWith('core/')) }))
        .filter((r) => r.ids.length > 0);
    const labels = groups.map((g) => g.label);
    expect(labels).toEqual([...labels].sort());
    expect(labels).toEqual(expect.arrayContaining(['Clay', 'Fibre', 'Garment', 'Jewelry', 'Meal', 'Plant', 'Relic', 'Stone', 'Tool', 'Wood']));
    expect(core('Plant')).toEqual([
      { family: 'berry', ids: ['core/bellberry', 'core/berry'] },
      { family: 'herb', ids: ['core/sunleaf', 'core/herb'] },
      { family: 'mushroom', ids: ['core/mushroom'] },
    ]);
    expect(core('Relic')).toEqual([
      { ids: ['core/stone-idol'] },
      { family: 'coin', ids: ['core/maru-coin', 'core/old-coin'] },
      { family: 'scrap', ids: ['core/stew-scrap'] },
    ]);
    // every item is in exactly one row
    const all = groups.flatMap((g) => g.rows.flatMap((r) => r.ids)).sort();
    expect(all).toEqual(Object.keys(bundle.items).sort());
  });
});
