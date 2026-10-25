/**
 * Worn items (G44; DECISIONS.md, 2026-10-09: the upgrade): the work layer
 * counts under the power cap, the look layer only shows, and a worn item
 * stays in the bag and comes off when it leaves it.
 */
import { beforeAll, describe, expect, test } from 'vitest';

import type { WearDef } from '@game/schema';
import {
  type Action,
  type Bundle,
  type State,
  type StepResult,
  WEAR_SLOTS,
  type WearSlot,
  effectValue,
  mulDiv,
  newState,
  npcTile,
  setComplete,
  slotsFor,
  step,
  wornValue,
} from '@game/kernel';

import { type Tile, bfsNear, loadBundle, mulberry32 } from '../../tools/test/helpers/world.js';

let b: Bundle;
let trader: string;

beforeAll(() => {
  b = structuredClone(loadBundle());
  const wearable = (id: string, cls: string, wear: WearDef, extra: object = {}) => {
    b.items[id] = { ...structuredClone(b.items['core/branch']!), id, name: id, class: cls, tier: 1, wear, ...extra };
    b.values[id] = b.values['core/branch']! * 4;
  };
  wearable('x/cap', 'garment', { slot: 'head', effects: [{ effect: 'gather_speed_pct', value: 5 }], set: 'x/field' });
  wearable('x/smock', 'garment', { slot: 'top', effects: [{ effect: 'gather_speed_pct', value: 5 }], set: 'x/field' });
  wearable('x/trousers', 'garment', { slot: 'legs' });
  wearable('x/overall', 'garment', { slot: 'outfit', effects: [{ effect: 'dig_speed_pct', value: 5 }] });
  wearable('x/ring', 'jewelry', { slot: 'jewelry', effects: [{ effect: 'craft_chance_pct', value: 5 }] });
  wearable('x/crown', 'garment', { slot: 'head', look: true }, { premium_later: true });
  b.items['core/basket'] = { ...b.items['core/basket']!, wear: { slot: 'hand', effects: [{ effect: 'gather_speed_pct', value: 5 }] } };
  trader = Object.keys(b.npcs)
    .sort()
    .find((id) => {
      const shop = b.npcs[id]!.shop;
      return shop !== undefined && b.shops[shop]?.buys;
    })!;
});

/** A fresh forager with these things added to the starting bag. */
function started(bag: Record<string, number>, seed = 1): State {
  const r = step(b, newState(b, seed), { t: 'start', starter: 'core/forager', name: 'Wearer' }, 0);
  if (!r.ok) throw new Error(r.error);
  // the kit's basket goes on at the start; these tests put on what they test
  r.state.player.worn = {};
  r.state.player.attrs.might = 100;
  r.state.player.restored = ['core/old-bridge'];
  Object.assign(r.state.player.bag, bag);
  return r.state;
}

const act = (s: State, a: Action): StepResult => step(b, s, a, Math.max(s.tick, s.player.busyUntil));
function ok(s: State, a: Action): Extract<StepResult, { ok: true }> {
  const r = act(s, a);
  if (!r.ok) throw new Error(r.error);
  return r;
}
const wear = (s: State, item: string) => ok(s, { t: 'wear', item }).state;

function near(s: State, tile: readonly [number, number]): Tile {
  return bfsNear(b, s.player, s.player.at, { x: tile[0], y: tile[1], w: 1, h: 1 })!.at(-1)!;
}

/** How long one gather of the river stones keeps the character busy. */
function gatherMs(s: State): number {
  const [node, instance] = Object.entries(b.instances)
    .filter(([, i]) => i.source === 'core/river-stones')
    .sort(([x], [y]) => (x < y ? -1 : 1))[0]!;
  const r = ok(s, { t: 'gather', node, grade: 3, at: near(s, [instance.x, instance.y]) });
  const busy = r.events.find((e) => e.e === 'busy');
  if (!busy || busy.e !== 'busy') throw new Error('no busy event');
  return busy.ms;
}

/** Every worn unit is in the bag, fits its place, sits on its own layer, and an outfit stands alone. */
function checkWorn(s: State): void {
  for (const look of [false, true]) {
    const layer = look ? s.player.looks : s.player.worn;
    const count: Record<string, number> = {};
    for (const [slot, id] of Object.entries(layer)) {
      count[id] = (count[id] ?? 0) + 1;
      const w = b.items[id]!.wear!;
      expect(slotsFor(w.slot)).toContain(slot);
      expect(w.look === true).toBe(look);
    }
    for (const [id, n] of Object.entries(count)) expect(n).toBeLessThanOrEqual(s.player.bag[id] ?? 0);
    expect(layer.outfit !== undefined && (layer.top !== undefined || layer.legs !== undefined)).toBe(false);
  }
}

describe('wearing', () => {
  test('only what the bag holds, and it stays in the bag', () => {
    const s = started({});
    expect(act(s, { t: 'wear', item: 'x/cap' })).toEqual({ ok: false, error: 'You do not have that.' });
    expect(act(s, { t: 'wear', item: 'core/branch' })).toEqual({ ok: false, error: 'That is not something to wear.' });
    s.player.bag['x/cap'] = 1;
    const r = ok(s, { t: 'wear', item: 'x/cap' });
    expect(r.state.player.worn).toEqual({ head: 'x/cap' });
    expect(r.state.player.bag['x/cap']).toBe(1);
    expect(r.events).toContainEqual({ e: 'wear', item: 'x/cap', slot: 'head', look: false });
    expect(act(r.state, { t: 'wear', item: 'x/cap' })).toEqual({ ok: false, error: 'You are already wearing that.' });
    expect(act(r.state, { t: 'wear', item: 'x/cap', slot: 'feet' })).toEqual({ ok: false, error: 'It does not go there.' });
  });

  test('two jewelry places, one worn unit each', () => {
    const one = wear(started({ 'x/ring': 1 }), 'x/ring');
    expect(one.player.worn).toEqual({ jewelry1: 'x/ring' });
    expect(act(one, { t: 'wear', item: 'x/ring' })).toEqual({ ok: false, error: 'You are already wearing every one you have.' });
    one.player.bag['x/ring'] = 2;
    expect(wear(one, 'x/ring').player.worn).toEqual({ jewelry1: 'x/ring', jewelry2: 'x/ring' });
  });

  test('an outfit takes the top and the legs, and a top takes the outfit off', () => {
    const dressed = wear(wear(started({ 'x/smock': 1, 'x/trousers': 1, 'x/overall': 1 }), 'x/smock'), 'x/trousers');
    const r = ok(dressed, { t: 'wear', item: 'x/overall' });
    expect(r.state.player.worn).toEqual({ outfit: 'x/overall' });
    expect(r.events.filter((e) => e.e === 'wear' || e.e === 'unwear')).toEqual([
      { e: 'unwear', item: 'x/smock', slot: 'top', look: false },
      { e: 'unwear', item: 'x/trousers', slot: 'legs', look: false },
      { e: 'wear', item: 'x/overall', slot: 'outfit', look: false },
    ]);
    expect(wear(r.state, 'x/smock').player.worn).toEqual({ top: 'x/smock' });
  });

  test('a look shows on its own layer and counts for nothing', () => {
    const capped = wear(started({ 'x/cap': 1, 'x/crown': 1 }), 'x/cap');
    const both = wear(capped, 'x/crown');
    expect(both.player.worn).toEqual({ head: 'x/cap' });
    expect(both.player.looks).toEqual({ head: 'x/crown' });
    expect(wornValue(b, both, 'gather_speed_pct')).toBe(wornValue(b, capped, 'gather_speed_pct'));
    const off = ok(both, { t: 'unwear', slot: 'head', look: true });
    expect(off.state.player.looks).toEqual({});
    expect(off.state.player.worn).toEqual({ head: 'x/cap' });
    expect(off.events).toContainEqual({ e: 'unwear', item: 'x/crown', slot: 'head', look: true });
  });

  test('taking off what is not worn is refused', () => {
    const s = started({});
    expect(act(s, { t: 'unwear', slot: 'head' })).toEqual({ ok: false, error: 'Nothing is worn there.' });
    expect(act(s, { t: 'unwear', slot: 'belt' as WearSlot })).toEqual({ ok: false, error: 'Nothing is worn there.' });
  });

  test('a worn unit that leaves the bag comes off', () => {
    const s = wear(wear(wear(started({ 'x/cap': 1, 'x/ring': 2 }), 'x/cap'), 'x/ring'), 'x/ring');
    const at = near(s, npcTile(b, trader)!);
    const cap = ok(s, { t: 'sell', npc: trader, item: 'x/cap', qty: 1, at });
    expect(cap.state.player.worn).toEqual({ jewelry1: 'x/ring', jewelry2: 'x/ring' });
    expect(cap.events).toContainEqual({ e: 'unwear', item: 'x/cap', slot: 'head', look: false });
    const ring = ok(cap.state, { t: 'sell', npc: trader, item: 'x/ring', qty: 1, at });
    expect(ring.state.player.worn).toEqual({ jewelry1: 'x/ring' });
    expect(ring.state.player.gold + ring.state.player.boundGold).toBe(ring.state.ledger.minted - ring.state.ledger.burned);
  });
});

describe('worn effects', () => {
  test('add up through the one calculator, and a full set adds its bonus', () => {
    const cap = wear(started({ 'x/cap': 1, 'x/smock': 1, 'core/basket': 1 }), 'x/cap');
    expect(wornValue(b, cap, 'gather_speed_pct')).toBe(5);
    expect(setComplete(b, cap, 'x/field')).toBe(false);
    const set = wear(cap, 'x/smock');
    expect(setComplete(b, set, 'x/field')).toBe(true);
    const bonus = mulDiv(10, b.params.wear_set_bonus_pct, 100);
    expect(wornValue(b, set, 'gather_speed_pct')).toBe(10 + bonus);
    const hand = wear(set, 'core/basket');
    expect(hand.player.worn.hand).toBe('core/basket');
    expect(effectValue(b, hand, 'gather_speed_pct')).toBe(15 + bonus);
    expect(effectValue(b, hand, 'craft_chance_pct')).toBe(0);
  });

  test('speed the work only inside the power cap', () => {
    const plain = started({ 'x/cap': 1, 'x/smock': 1 });
    const dressed = wear(wear(plain, 'x/cap'), 'x/smock');
    // character level 1: the cap is 1000 permille, so clothes change nothing yet
    expect(gatherMs(dressed)).toBe(gatherMs(plain));
    const seasoned = (s: State) => {
      const t = structuredClone(s);
      t.player.xp['core/cooking'] = b.professions['core/cooking']!.xp_levels.at(-1)! * 1000;
      return t;
    };
    expect(gatherMs(seasoned(dressed))).toBeLessThan(gatherMs(seasoned(plain)));
  });
});

describe('worn things through random play', () => {
  test('every worn unit stays in the bag and in its place', () => {
    const wearables = Object.keys(b.items)
      .filter((id) => b.items[id]!.wear)
      .sort();
    for (let run = 0; run < 10; run++) {
      const random = mulberry32(0xbeef ^ run);
      const pick = <T>(list: readonly T[]): T => list[Math.floor(random() * list.length)]!;
      let s = started(Object.fromEntries(wearables.map((id) => [id, 1 + Math.floor(random() * 2)])), run + 1);
      const at = near(s, npcTile(b, trader)!);
      for (let i = 0; i < 200; i++) {
        const roll = random();
        const a: Action =
          roll < 0.5
            ? { t: 'wear', item: pick(wearables), ...(random() < 0.3 ? { slot: pick(WEAR_SLOTS) } : {}) }
            : roll < 0.8
              ? { t: 'unwear', slot: pick(WEAR_SLOTS), look: random() < 0.3 }
              : { t: 'sell', npc: trader, item: pick(wearables), qty: 1, at };
        const r = act(s, a);
        if (r.ok) s = r.state;
        checkWorn(s);
      }
    }
  });
});
