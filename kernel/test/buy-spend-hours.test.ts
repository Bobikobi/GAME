/**
 * Three behaviours the kernel had no focused tests for: a buy that moves exact gold and burns
 * the same amount in the ledger, the skill point of each character level, and the hours window
 * of a timed gather. Every number is read from the content or the params it comes from, or
 * computed through the kernel's own functions, never typed from memory.
 */
import { beforeAll, describe, expect, test } from 'vitest';

import {
  ATTRIBUTES,
  type Attribute,
  type Bundle,
  type State,
  type StepResult,
  canonical,
  hourOf,
  makeWalkable,
  newState,
  npcTile,
  placeRoom,
  skillPoints,
  step,
} from '@game/kernel';

import { loadBundle } from '../../tools/test/helpers/world.js';

let b: Bundle;

beforeAll(() => {
  b = loadBundle();
});

/** A fresh character of the legacy forager start (race core/elf, pocket core/west-bank). */
function started(): State {
  const r = step(b, newState(b, 1), { t: 'start', starter: 'core/forager', name: 'Tester' }, 0);
  if (!r.ok) throw new Error(r.error);
  return r.state;
}

/** A tile beside `tile` where the player may stand; the first walkable of the four sides. */
function beside(tile: readonly [number, number], state: State): [number, number] {
  const walkable = makeWalkable(b);
  for (const [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0]] as const) {
    if (walkable(tile[0] + dx, tile[1] + dy, state.player)) return [tile[0] + dx, tile[1] + dy];
  }
  throw new Error(`No standing place next to ${tile[0]},${tile[1]}.`);
}

const act = (s: State, a: Parameters<typeof step>[2], tick = s.tick): StepResult => step(b, s, a, tick);
function ok(s: State, a: Parameters<typeof step>[2], tick = s.tick): Extract<StepResult, { ok: true }> {
  const r = act(s, a, tick);
  if (!r.ok) throw new Error(r.error);
  return r;
}

/** A tick in the middle of an in-game hour (tick 0 is noon, so earlier hours fall in day 1). */
function tickAtHour(hour: number): number {
  const day = b.params.day_length_ms; // content/core/params.json
  return Math.round(hour * (day / 24) + day / 48 - day / 2 + day);
}

/** A tick with the hour the test needs, verified through the kernel's own clock. */
function hourTick(hour: number): number {
  const tick = tickAtHour(hour);
  expect(hourOf(b, tick)).toBe(hour);
  return tick;
}

/** Grants the player foraging level 2 through the profession's own xp ladder. */
function grantForagingLv2(s: State): void {
  s.player.xp['core/foraging'] = b.professions['core/foraging']!.xp_levels[0]! * 1000; // level 2 needs xp_levels[0] seconds
}

/** The first placed node of a resource source. */
function nodeOf(source: string): string {
  const id = Object.keys(b.instances).find((n) => b.instances[n]!.source === source);
  if (id === undefined) throw new Error(`No node for ${source}`);
  return id;
}

/** A gather attempt of `source` at `hour`, from a fresh character. */
function gatherAt(source: string, hour: number): StepResult {
  const s = started();
  const node = nodeOf(source);
  return step(b, s, { t: 'gather', node, grade: 3, at: beside([b.instances[node]!.x, b.instances[node]!.y], s) }, hourTick(hour));
}

// ------------------------------------------------------------------ buy

describe('buying at the inn', () => {
  const trader = 'core/innkeeper'; // content/core/npcs/innkeeper.json
  // an item the shop sells that stacks in the bag: core/berry, content/core/shops/inn.json
  const item = 'core/berry';

  function buyState(gold: number, bag: Record<string, number> = {}): { s: State; at: [number, number] } {
    const s = started();
    s.player.gold = gold;
    Object.assign(s.player.bag, bag);
    return { s, at: beside(npcTile(b, trader)!, s) };
  }

  test('takes the exact price from the gold, burns the same amount, and the bag grows', () => {
    const offer = b.shops['core/inn']!.sells.find((o) => o.item === item)!; // content/core/shops/trader-shop.json
    const { s, at } = buyState(100_000);
    const before = s.player.bag[item] ?? 0;
    const r = ok(s, { t: 'buy', npc: trader, item, qty: 2, at });
    expect(r.state.player.gold).toBe(s.player.gold - offer.price_mg * 2);
    expect(r.state.ledger.burned - s.ledger.burned).toBe(offer.price_mg * 2);
    expect((r.state.player.bag[item] ?? 0) - before).toBe(2);
    expect(r.events).toContainEqual({ e: 'gold', delta: -offer.price_mg * 2 });
  });

  test.each([
    ['qty 0', 0],
    ['qty over the limit', 100], // checkQty accepts 1 to 99
  ])('refuses %s, and the state does not change', (_name, qty) => {
    const { s, at } = buyState(100_000);
    const before = canonical(s);
    const r = act(s, { t: 'buy', npc: trader, item, qty, at });
    expect(r.ok).toBe(false);
    expect(r).toMatchObject({ error: 'Pick between 1 and 99.' });
    expect(canonical(s)).toBe(before);
  });

  test('refuses short gold, and the state does not change', () => {
    const offer = b.shops['core/inn']!.sells.find((o) => o.item === item)!;
    const { s, at } = buyState(offer.price_mg - 1);
    const before = canonical(s);
    const r = act(s, { t: 'buy', npc: trader, item, qty: 1, at });
    expect(r.ok).toBe(false);
    expect(r).toMatchObject({ error: 'You do not have enough gold.' });
    expect(canonical(s)).toBe(before);
  });

  test('refuses a full bag, and the state does not change', () => {
    const { s, at } = buyState(100_000);
    // fill the bag's places with the item itself: as many more as the kernel says still fit
    s.player.bag[item] = placeRoom(b, s, item) + (s.player.bag[item] ?? 0);
    const before = canonical(s);
    const r = act(s, { t: 'buy', npc: trader, item, qty: 1, at });
    expect(r.ok).toBe(false);
    expect(r).toMatchObject({ error: 'Your bag is too full.' });
    expect(canonical(s)).toBe(before);
  });

  test('refuses an item the shop does not sell, and the state does not change', () => {
    const { s, at } = buyState(100_000);
    const before = canonical(s);
    const r = act(s, { t: 'buy', npc: trader, item: 'core/stone', qty: 1, at });
    expect(r.ok).toBe(false);
    expect(r).toMatchObject({ error: 'That is not for sale here.' });
    expect(canonical(s)).toBe(before);
  });
});

// ------------------------------------------------------------------ spend

describe('spending a skill point', () => {
  test('one point per character level: spend it, then the next spend is refused', () => {
    const s = started();
    expect(skillPoints(b, s)).toBe(0);
    grantForagingLv2(s);
    expect(skillPoints(b, s)).toBe(1);
    const r = ok(s, { t: 'spend', attr: 'luck' });
    expect(r.state.player.attrs.luck).toBe(s.player.attrs.luck + 1);
    expect(r.state.player.spent).toBe(s.player.spent + 1);
    expect(skillPoints(b, r.state)).toBe(0);
    const again = act(r.state, { t: 'spend', attr: 'luck' });
    expect(again.ok).toBe(false);
    expect(again).toMatchObject({ error: 'No skill points left.' });
  });

  test('an attribute at its cap of 10 is refused', () => {
    const s = started();
    grantForagingLv2(s);
    s.player.attrs.luck = 10;
    const r = act(s, { t: 'spend', attr: 'luck' });
    expect(r.ok).toBe(false);
    expect(r).toMatchObject({ error: 'That attribute is at its limit.' });
  });

  test('an attribute the kernel does not know is refused', () => {
    const s = started();
    grantForagingLv2(s);
    expect(ATTRIBUTES).not.toContain('carry');
    const r = act(s, { t: 'spend', attr: 'carry' as Attribute });
    expect(r.ok).toBe(false);
    expect(r).toMatchObject({ error: 'Unknown attribute.' });
  });
});

// ------------------------------------------------------------------ hours

describe('a gather follows its hours window', () => {
  /** The window's first and last hour succeed, one hour outside each side refuses. */
  function windowEdges(source: string) {
    const hours = b.resources[source]!.hours!; // content/core/resources/*.json
    expect(hours).toBeDefined();
    const [first, last] = hours; // last is the hour the window closes; a wrap runs through 24
    const onePast = (last + 1) % 24;
    const oneBefore = (first + 23) % 24;
    const output = b.resources[source]!.output;

    const inFirst = gatherAt(source, first);
    expect(inFirst.ok, `hour ${first}`).toBe(true);
    if (inFirst.ok) expect(inFirst.state.player.bag[output]).toBe(b.resources[source]!.yield);

    const inLast = gatherAt(source, last === 0 ? 23 : last - 1); // the last full hour inside the window
    expect(inLast.ok, `hour ${last === 0 ? 23 : last - 1}`).toBe(true);
    if (inLast.ok) expect(inLast.state.player.bag[output]).toBe(b.resources[source]!.yield);

    const before = gatherAt(source, oneBefore);
    expect(before.ok, `hour ${oneBefore}`).toBe(false);
    const after = gatherAt(source, onePast);
    expect(after.ok, `hour ${onePast}`).toBe(false);
  }

  test('sunleaf opens at noon and closes at dark', () => {
    const source = 'core/sun-herbs'; // hours [12,20], content/core/resources/sun-herbs.json
    windowEdges(source);
    // the refusal words name the window
    const r = gatherAt(source, 11);
    expect(r).toMatchObject({ error: 'It can only be gathered between 12:00 and 20:00.' });
  });

  test('moonreeds open at dusk and close at midnight', () => {
    const source = 'core/moon-reeds'; // hours [20,24], content/core/resources/moon-reeds.json
    windowEdges(source);
    const r = gatherAt(source, 19);
    expect(r).toMatchObject({ error: 'It can only be gathered between 20:00 and 24:00.' });
  });

  test('mushrooms come up from evening, across midnight, to mid-morning', () => {
    const source = 'core/forest-mushrooms'; // hours [17,10], content/core/resources/forest-mushrooms.json
    // level 2 (content/core/resources/forest-mushrooms.json): grant it from the profession's own ladder
    const grant = (hour: number): StepResult => {
      const s = started();
      grantForagingLv2(s);
      const node = nodeOf(source);
      return step(b, s, { t: 'gather', node, grade: 3, at: beside([b.instances[node]!.x, b.instances[node]!.y], s) }, hourTick(hour));
    };
    for (const hour of [17, 9]) {
      const r = grant(hour);
      expect(r.ok, `hour ${hour}`).toBe(true);
    }
    for (const hour of [16, 10]) {
      const r = grant(hour);
      expect(r.ok, `hour ${hour}`).toBe(false);
      expect(r).toMatchObject({ error: 'It can only be gathered between 17:00 and 10:00.' });
    }
  });

  test('bellberries open at dawn and close at dusk', () => {
    const source = 'core/bell-bushes'; // hours [5,20], content/core/resources/bell-bushes.json
    windowEdges(source);
    const r = gatherAt(source, 4);
    expect(r).toMatchObject({ error: 'It can only be gathered between 5:00 and 20:00.' });
  });
});
