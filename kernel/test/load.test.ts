/**
 * Weight, pace, bags and the races' body facts (DECISIONS.md, 2026-10-23: races, weight and bags).
 * Places say how many things the player holds and come from what is on the back; weight says how fast
 * they walk, against a limit of `load.base` plus `per_point.might` a point of might.
 */
import { beforeAll, describe, expect, test } from 'vitest';

import {
  type Action,
  type Bundle,
  type State,
  type StepResult,
  attrAt,
  bagCapacity,
  bagUsed,
  breathRefillPermille,
  foodFillPermille,
  itemWeight,
  loadBand,
  loadLimit,
  loadMax,
  loadWeight,
  newState,
  npcTile,
  paceWeight,
  placeRoom,
  restMendPermille,
  step,
  walkStepMs,
  weightRoom,
} from '@game/kernel';

import { type Tile, bfsNear, loadBundle } from '../../tools/test/helpers/world.js';

let b: Bundle;

beforeAll(() => {
  b = structuredClone(loadBundle());
  // a thing that weighs exactly 1, so a test fills the load to the unit
  b.items['x/pebble'] = { ...structuredClone(b.items['core/branch']!), id: 'x/pebble', name: 'pebble', weight: 1 };
  b.values['x/pebble'] = b.values['core/branch']!;
  b.items['x/anvil'] = { ...structuredClone(b.items['core/branch']!), id: 'x/anvil', name: 'anvil', weight: 20 };
  b.values['x/anvil'] = b.values['core/branch']!;
});

/** A fresh character of a race, nothing worn and nothing in the bag. */
function started(race: string, seed = 1): State {
  const r = step(b, newState(b, seed), { t: 'start', race, name: 'Carrier' }, 0);
  if (!r.ok) throw new Error(r.error);
  r.state.player.worn = {};
  r.state.player.looks = {};
  r.state.player.bag = {};
  r.state.player.restored = ['core/old-bridge'];
  return r.state;
}

/** The weight that sits exactly on a share of the limit, against 1000. */
const share = (s: State, permille: number) => Math.floor((loadLimit(b, s) * permille) / 1000);

const act = (s: State, a: Action): StepResult => step(b, s, a, Math.max(s.tick, s.player.busyUntil));
function ok(s: State, a: Action): State {
  const r = act(s, a);
  if (!r.ok) throw new Error(r.error);
  return r.state;
}

function near(s: State, x: number, y: number): Tile {
  return bfsNear(b, s.player, s.player.at, { x, y, w: 1, h: 1 })!.at(-1)!;
}

function gatherStones(s: State): StepResult {
  const [node, instance] = Object.entries(b.instances).find(([, i]) => i.source === 'core/river-stones')!;
  return act(s, { t: 'gather', node, grade: 3, at: near(s, instance.x, instance.y) });
}

describe('weight', () => {
  test('every item of the core world names a whole weight', () => {
    for (const item of Object.values(b.items)) {
      expect(Number.isSafeInteger(item.weight), item.id).toBe(true);
      expect(item.weight, item.id).toBeGreaterThanOrEqual(0);
    }
    expect(itemWeight(b, 'core/log')).toBe(3);
    expect(itemWeight(b, 'core/stone')).toBe(3);
    expect(itemWeight(b, 'core/herb')).toBe(0);
  });

  test('the limit is 30 and 10 a point of might, a frame pack adding 10', () => {
    expect(b.params.load.base).toBe(30);
    expect(b.params.per_point.might).toBe(10);
    const s = started('core/human');
    expect(loadLimit(b, s)).toBe(30 + 10 * attrAt(b, s, 'might'));
    s.player.bag['core/frame-pack'] = 1;
    s.player.worn.back = 'core/frame-pack';
    expect(loadLimit(b, s)).toBe(40 + 10 * attrAt(b, s, 'might'));
  });

  test('every unit weighs, worn ones too', () => {
    const s = started('core/human');
    s.player.bag = { 'core/stone': 2, 'core/herb': 5, 'core/satchel': 1 };
    s.player.worn.back = 'core/satchel';
    expect(loadWeight(b, s)).toBe(2 * 3 + 0 + itemWeight(b, 'core/satchel'));
  });
});

describe('the three paces', () => {
  test('light up to three fifths of the limit, steady up to the limit, heavy above it, at 170, 190 and 230 ms a tile', () => {
    const s = started('core/human');
    expect(loadBand(b, s)).toBe('light');
    expect(walkStepMs(b, s)).toBe(170);
    s.player.bag['x/pebble'] = share(s, 600);
    expect(loadBand(b, s)).toBe('light');
    s.player.bag['x/pebble'] += 1;
    expect(loadBand(b, s)).toBe('steady');
    expect(walkStepMs(b, s)).toBe(190);
    s.player.bag['x/pebble'] = loadLimit(b, s);
    expect(loadBand(b, s)).toBe('steady');
    s.player.bag['x/pebble'] += 1;
    expect(loadBand(b, s)).toBe('heavy');
    expect(walkStepMs(b, s)).toBe(230);
  });

  test('the steady pace is the walk the world was measured at', () => {
    expect(b.params.walk_step_ms).toBe(190);
  });

  test('an elf carries the same load four fifths as heavy for pace', () => {
    const human = started('core/human');
    const elf = started('core/elf');
    elf.player.attrs.might = human.player.attrs.might;
    const over = loadLimit(b, elf) + 1;
    human.player.bag['x/pebble'] = over;
    elf.player.bag['x/pebble'] = over;
    expect(loadWeight(b, elf)).toBe(over);
    expect(paceWeight(b, elf)).toBe(Math.floor((over * 800) / 1000));
    expect(loadBand(b, human)).toBe('heavy');
    expect(loadBand(b, elf)).toBe('steady');
  });

  test('a heavy load in a fight brings breath back at half speed', () => {
    const s = started('core/human');
    expect(breathRefillPermille(b, s)).toBe(1000);
    s.player.bag['x/pebble'] = loadLimit(b, s) + 1;
    expect(breathRefillPermille(b, s)).toBe(500);
  });

  test('a walk reported faster than the load allows is refused', () => {
    const light = started('core/human');
    const far = npcTile(b, 'core/trader')!;
    const path = bfsNear(b, light.player, light.player.at, { x: far[0], y: far[1], w: 1, h: 1 })!;
    const walked = path.filter((t) => t[0] !== light.player.at[0] || t[1] !== light.player.at[1]);
    expect(walked.length).toBeGreaterThan(4);
    // four tiles in the time of two light steps: 2 + 2 at the light pace reaches them, 2 + 1 at the heavy pace does not
    const tick = light.player.movedAt + 2 * b.params.load.light_step_ms;
    expect(step(b, light, { t: 'move', at: walked[3]! }, tick, { validateTravel: true }).ok).toBe(true);
    const heavy = started('core/human');
    heavy.player.bag['x/pebble'] = loadLimit(b, heavy) + 1;
    expect(walkStepMs(b, heavy)).toBe(230);
    expect(step(b, heavy, { t: 'move', at: walked[3]! }, tick, { validateTravel: true }).ok).toBe(false);
  });
});

describe('the edge of the load', () => {
  test('nothing more is picked up past one and a half times the limit', () => {
    const s = started('core/human');
    expect(loadMax(b, s)).toBe(Math.floor((loadLimit(b, s) * 1500) / 1000));
    // a frame pack, so the places never run out before the weight does
    s.player.bag = { 'core/frame-pack': 1 };
    s.player.worn.back = 'core/frame-pack';
    const rest = loadMax(b, s) - loadWeight(b, s);
    s.player.bag['x/anvil'] = Math.floor(rest / 20);
    s.player.bag['x/pebble'] = (rest % 20) - 1;
    expect(bagUsed(b, s)).toBeLessThan(bagCapacity(b, s));
    expect(weightRoom(b, s, 'core/stone')).toBe(0);
    expect(weightRoom(b, s, 'x/pebble')).toBe(1);
    expect(weightRoom(b, s, 'core/herb')).toBe(Number.MAX_SAFE_INTEGER);
    s.player.bag['x/pebble'] += 1;
    expect(loadWeight(b, s)).toBe(loadMax(b, s));
    const r = gatherStones(s);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/Too heavy/);
  });
});

describe('bags', () => {
  test('no bag holds 12, a satchel 24, a frame pack 36', () => {
    const s = started('core/elf');
    expect(bagCapacity(b, s)).toBe(12);
    s.player.bag = { 'core/satchel': 1, 'core/frame-pack': 1 };
    s.player.worn.back = 'core/satchel';
    expect(bagCapacity(b, s)).toBe(24);
    s.player.worn.back = 'core/frame-pack';
    expect(bagCapacity(b, s)).toBe(36);
  });

  test('the bag on the back takes no place of its own', () => {
    const s = started('core/elf');
    s.player.bag = { 'core/satchel': 1, 'x/pebble': 3 };
    expect(bagUsed(b, s)).toBe(2);
    s.player.worn.back = 'core/satchel';
    expect(bagUsed(b, s)).toBe(1);
  });

  test('things of one kind share a place, ten to a stack, and every unit still weighs', () => {
    const s = started('core/elf');
    s.player.bag = { 'x/pebble': 10 };
    expect(bagUsed(b, s)).toBe(1);
    expect(placeRoom(b, s, 'x/pebble')).toBe(110);
    s.player.bag['x/pebble'] = 11;
    expect(bagUsed(b, s)).toBe(2);
    expect(placeRoom(b, s, 'x/pebble')).toBe(109);
    expect(placeRoom(b, s, 'core/herb')).toBe(100);
    expect(loadWeight(b, s)).toBe(11);
    // a full bag still takes more of a kind whose last stack has room
    for (let i = 0; i < 10; i++) s.player.bag[`x/kind-${i}`] = 1;
    expect(bagUsed(b, s)).toBe(12);
    expect(placeRoom(b, s, 'x/pebble')).toBe(9);
    expect(placeRoom(b, s, 'core/herb')).toBe(0);
  });

  test('one tool in the hand and one at the belt take no place: every other tool does, and all weigh', () => {
    const s = started('core/elf');
    s.player.worn = {};
    s.player.bag = { 'core/axe': 1, 'core/trowel': 1, 'x/pebble': 2 };
    expect(bagUsed(b, s)).toBe(1);
    s.player.bag['core/basket'] = 1;
    expect(bagUsed(b, s)).toBe(2);
    // a tool worn in the hand is that hand's tool: the belt still holds just one more
    s.player.worn.hand = 'core/trowel';
    expect(bagUsed(b, s)).toBe(2);
    expect(placeRoom(b, s, 'core/axe')).toBe(109);
    expect(loadWeight(b, s)).toBe(itemWeight(b, 'core/axe') + itemWeight(b, 'core/trowel') + itemWeight(b, 'core/basket') + 2);
  });

  test('a thing put down stays on its tile, saved, and comes back with a pick-up', () => {
    let s = started('core/elf');
    s.player.bag = { 'x/pebble': 5 };
    const at: [number, number] = [s.player.at[0], s.player.at[1]];
    const r = step(b, s, { t: 'drop', item: 'x/pebble', qty: 3, at }, s.tick);
    if (!r.ok) throw new Error(r.error);
    s = r.state;
    expect(s.player.bag['x/pebble']).toBe(2);
    expect(s.player.ground).toEqual({ [`${at[0]},${at[1]}`]: { 'x/pebble': 3 } });
    expect(r.events).toContainEqual({ e: 'drop', item: 'x/pebble', qty: 3, at });
    s = JSON.parse(JSON.stringify(s)) as State;
    // a step away, the pile is not under the player
    expect(act(s, { t: 'pickup', item: 'x/pebble', at: [at[0] + 1, at[1]] })).toEqual({ ok: false, error: 'There is nothing like that here.' });
    s = ok(s, { t: 'pickup', item: 'x/pebble', at });
    expect(s.player.bag['x/pebble']).toBe(5);
    expect(s.player.ground).toEqual({});
    expect(act(s, { t: 'pickup', item: 'x/pebble', at })).toEqual({ ok: false, error: 'There is nothing like that here.' });
  });

  test('a worn thing is taken off before it is put down', () => {
    const s = started('core/elf');
    s.player.bag = { 'core/satchel': 1 };
    s.player.worn.back = 'core/satchel';
    expect(act(s, { t: 'drop', item: 'core/satchel', qty: 1, at: s.player.at })).toEqual({ ok: false, error: 'Take it off before you put it down.' });
  });

  test('a satchel goes on the back, and comes off only when the rest still fits', () => {
    let s = started('core/elf');
    s.player.bag = { 'core/satchel': 1 };
    s = ok(s, { t: 'wear', item: 'core/satchel' });
    expect(s.player.worn.back).toBe('core/satchel');
    s.player.bag['core/herb'] = 200;
    const r = act(s, { t: 'unwear', slot: 'back' });
    expect(r).toEqual({ ok: false, error: 'Your bag has no room for that. Make room first.' });
    s.player.bag['core/herb'] = 110;
    expect(act(s, { t: 'unwear', slot: 'back' }).ok).toBe(true);
  });

  test('the back holds one thing: today a satchel or a frame pack', () => {
    expect(Object.keys(b.items).filter((id) => b.items[id]!.wear?.slot === 'back').sort()).toEqual(['core/frame-pack', 'core/satchel']);
  });

  test('the first bag is made at the valley workshop, and Pell sells it too', () => {
    const recipe = Object.values(b.recipes).find((r) => r.outputs.some((o) => o.item === 'core/satchel'))!;
    expect(recipe.station).toBe('workshop');
    const offer = b.shops['core/trader-shop']!.sells.find((o) => o.item === 'core/satchel');
    expect(offer).toBeDefined();
    // a shop never sells below the value (R8)
    expect(offer!.price_mg).toBeGreaterThanOrEqual(b.params.r_mg_per_value_ms * b.values['core/satchel']!);
  });
});

describe('the body facts', () => {
  test('a human packs any bag two places fuller, never bare hands', () => {
    const s = started('core/human');
    expect(bagCapacity(b, s)).toBe(12);
    s.player.bag = { 'core/satchel': 1, 'core/frame-pack': 1 };
    s.player.worn.back = 'core/satchel';
    expect(bagCapacity(b, s)).toBe(26);
    s.player.worn.back = 'core/frame-pack';
    expect(bagCapacity(b, s)).toBe(38);
  });

  test('a skeleton has stamina 4 and might 1, mends double at a fire and gets half from food', () => {
    expect(b.races['core/skeleton']!.attributes.stamina).toBe(4);
    expect(b.races['core/skeleton']!.attributes.might).toBe(1);
    const bones = started('core/skeleton');
    const human = started('core/human');
    expect(restMendPermille(b, bones)).toBe(2000);
    expect(restMendPermille(b, human)).toBe(1000);
    expect(foodFillPermille(b, bones)).toBe(500);
    expect(foodFillPermille(b, human)).toBe(1000);

    const food = Object.values(b.items)
      .filter((i) => i.kind === 'food' && i.food !== undefined && (i.food.hurt ?? 0) === 0 && i.food.satiety >= 2)
      .sort((x, y) => x.id.localeCompare(y.id))[0]!;
    const fed = (s: State) => {
      s.player.bag = { [food.id]: 1 };
      s.player.satiety = 0;
      return ok(s, { t: 'eat', item: food.id }).player.satiety;
    };
    expect(fed(bones) * 2).toBe(fed(human));
  });

  test('a race names each body effect once at most', () => {
    for (const race of Object.values(b.races)) {
      const names = (race.body?.effects ?? []).map((e) => e.effect);
      expect(new Set(names).size, race.id).toBe(names.length);
    }
  });
});
