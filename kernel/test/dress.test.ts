/**
 * Dressing a taken animal (docs/design/HUNTING.md sections 5-6; DECISIONS.md, "The hunt foundations": the hunt foundations). A
 * carcass gives the goods of its kind at its grade, takes its size in steps, spoils by the game day, and what the bag
 * cannot carry lies on its tile. Nothing takes an animal yet (G35): these tests lay the carcass themselves.
 */
import { beforeAll, describe, expect, test } from 'vitest';

import {
  type Action,
  type Bundle,
  DRESS_PARTS,
  type State,
  type StepResult,
  computeValues,
  dressPartMs,
  gradeItem,
  gradeOfDraw,
  huntGoods,
  loadMax,
  newState,
  npcTile,
  placeCarcass,
  salePrice,
  step,
} from '@game/kernel';

import { type Tile, bfsNear, loadBundle } from '../../tools/test/helpers/world.js';

const HARE = 'test/hare';
const BOAR = 'test/boar';
let b: Bundle;
let trader: string;

beforeAll(() => {
  b = structuredClone(loadBundle());
  const good = (id: string, cls: string, extra: object = {}) => {
    b.items[id] = { ...structuredClone(b.items['core/branch']!), id, name: id, kind: 'material', class: cls, tier: 1, weight: 1, ...extra };
  };
  good('test/hare-meat', 'core/meat', { kind: 'food', food: { satiety: 5 } });
  good('test/hare-hide', 'core/hide');
  good('test/hare-hide-fine', 'core/hide', { grade: { of: 'test/hare-hide', step: 2 } });
  good('test/hare-bone', 'core/bone');
  const creatures = (b.map.creatures ??= { kinds: {}, spots: [] });
  creatures.kinds[HARE] = {
    look: 'rabbit',
    perch: 'ground',
    alert_tiles: 3,
    return_s: 60,
    hunt: {
      size: 'small',
      tier: 1,
      danger: 0,
      take_s: 40,
      drops: [
        { item: 'test/hare-meat', qty: 2, share_pct: 50 },
        { item: 'test/hare-hide', qty: 1, share_pct: 40 },
        { item: 'test/hare-bone', qty: 1, share_pct: 10 },
      ],
      spawn: { cap_per_1000: 12, refill_d: 1 },
    },
  };
  // a medium animal with the hare's goods: two parts to dress
  creatures.kinds[BOAR] = { ...structuredClone(creatures.kinds[HARE]!), look: 'deer', hunt: { ...structuredClone(creatures.kinds[HARE]!.hunt!), size: 'medium', tier: 2 } };
  creatures.spots.push({ kind: HARE, x: 1, y: 1 }, { kind: HARE, x: 2, y: 2 }, { kind: BOAR, x: 3, y: 3 });
  const table = computeValues(b);
  b.values = table.values;
  b.made = table.made;
  trader = Object.keys(b.npcs)
    .sort()
    .find((id) => {
      const shop = b.npcs[id]!.shop;
      return shop !== undefined && b.shops[shop]?.buys;
    })!;
});

/** A fresh human with an empty bag, standing where it woke. */
function started(seed = 1): State {
  const r = step(b, newState(b, seed), { t: 'start', race: 'core/human', name: 'Hunter' }, 0);
  if (!r.ok) throw new Error(r.error);
  r.state.player.worn = {};
  r.state.player.looks = {};
  r.state.player.bag = {};
  // the bridge to the town stands, so the trader can be reached
  r.state.player.restored = ['core/old-bridge'];
  return r.state;
}

const free = (s: State) => Math.max(s.tick, s.player.busyUntil);
const act = (s: State, a: Action, tick = free(s), bundle = b): StepResult => step(bundle, s, a, tick);
function ok(s: State, a: Action, tick = free(s), bundle = b): Extract<StepResult, { ok: true }> {
  const r = act(s, a, tick, bundle);
  if (!r.ok) throw new Error(r.error);
  return r;
}
const here = (s: State): Tile => [s.player.at[0], s.player.at[1]];
/** A hare laid where the player stands, at `grade`, fallen at `since`. */
const laid = (s: State, grade: 1 | 2 | 3 = 1, since = s.tick) => placeCarcass(b, s, HARE, s.player.at, grade, since);

describe('dressing a taken animal', () => {
  test('gives the drops of its kind at the carcass grade: a small animal in one part of six steps', () => {
    const s = started();
    const c = laid(s, 2);
    const tick = free(s);
    const r = ok(s, { t: 'dress', carcass: c.id, at: here(s) }, tick);
    expect(r.state.player.bag).toEqual({ 'test/hare-meat': 2, 'test/hare-hide-fine': 1, 'test/hare-bone': 1 });
    expect(r.state.player.carcasses).toEqual([]);
    const ms = dressPartMs(b.params);
    expect(ms).toBe(6 * b.params.hunt.dress_step_ms);
    expect(ms).toBeLessThanOrEqual(b.params.max_action_ms);
    expect(r.state.player.busyUntil).toBe(tick + ms);
    expect(r.events).toContainEqual({ e: 'busy', verb: 'dress', ms });
    expect(r.events).toContainEqual({
      e: 'dress',
      kind: HARE,
      grade: 2,
      goods: [
        { item: 'test/hare-meat', qty: 2 },
        { item: 'test/hare-hide-fine', qty: 1 },
        { item: 'test/hare-bone', qty: 1 },
      ],
      left: 0,
    });
  });

  test('a medium animal is two parts, each one action inside the cap, and gives its goods with the last', () => {
    expect(DRESS_PARTS).toEqual({ small: 1, medium: 2, large: 4 });
    const s = started();
    const c = placeCarcass(b, s, BOAR, s.player.at, 1, s.tick);
    const t1 = free(s);
    const first = ok(s, { t: 'dress', carcass: c.id, at: here(s) }, t1);
    const ms = dressPartMs(b.params);
    expect(first.state.player.bag).toEqual({});
    expect(first.state.player.busyUntil).toBe(t1 + ms);
    expect(first.state.player.carcasses?.map((x) => ({ id: x.id, dressed: x.dressed }))).toEqual([{ id: c.id, dressed: 1 }]);
    expect(first.events).toContainEqual({ e: 'dress', kind: BOAR, grade: 1, goods: [], left: 1 });
    const t2 = free(first.state);
    const last = ok(first.state, { t: 'dress', carcass: c.id, at: here(first.state) }, t2);
    expect(last.state.player.bag).toEqual({ 'test/hare-meat': 2, 'test/hare-hide': 1, 'test/hare-bone': 1 });
    expect(last.state.player.carcasses).toEqual([]);
    expect(last.state.player.busyUntil).toBe(t2 + ms);
    expect(last.events.filter((e) => e.e === 'dress')).toEqual([
      {
        e: 'dress',
        kind: BOAR,
        grade: 1,
        goods: [
          { item: 'test/hare-meat', qty: 2 },
          { item: 'test/hare-hide', qty: 1 },
          { item: 'test/hare-bone', qty: 1 },
        ],
        left: 0,
      },
    ]);
  });

  test('a plain animal gives the plain good, and a grade nobody drew falls back to it', () => {
    expect(gradeItem(b, 'test/hare-hide', 1)).toBe('test/hare-hide');
    expect(gradeItem(b, 'test/hare-hide', 2)).toBe('test/hare-hide-fine');
    expect(gradeItem(b, 'test/hare-hide', 3)).toBe('test/hare-hide');
    const s = started();
    const c = laid(s, 1);
    expect(ok(s, { t: 'dress', carcass: c.id, at: here(s) }).state.player.bag['test/hare-hide']).toBe(1);
  });

  test('refuses a carcass that is not there, and one too far away', () => {
    const s = started();
    expect(act(s, { t: 'dress', carcass: 99, at: here(s) })).toEqual({ ok: false, error: 'There is nothing to dress here.' });
    const far = placeCarcass(b, s, HARE, [s.player.at[0] + 6, s.player.at[1]], 1, s.tick);
    expect(act(s, { t: 'dress', carcass: far.id, at: here(s) })).toEqual({ ok: false, error: 'That is too far away.' });
  });

  test('spoils: the meat after meat_spoil_d days, everything after hide_spoil_d', () => {
    const day = b.params.day_length_ms;
    const aged = started();
    const c = laid(aged, 1, 0);
    const r = ok(aged, { t: 'dress', carcass: c.id, at: here(aged) }, b.params.hunt.meat_spoil_d * day);
    expect(r.state.player.bag).toEqual({ 'test/hare-hide': 1, 'test/hare-bone': 1 });
    const gone = started();
    const c2 = laid(gone, 1, 0);
    expect(act(gone, { t: 'dress', carcass: c2.id, at: here(gone) }, b.params.hunt.hide_spoil_d * day)).toEqual({
      ok: false,
      error: 'Nothing is left of it.',
    });
  });

  test('lays what the bag cannot carry on the tile the player stands on, and says so once', () => {
    const heavy = structuredClone(b);
    heavy.items['test/hare-meat']!.weight = 20;
    heavy.items['test/anvil'] = { ...structuredClone(b.items['core/branch']!), id: 'test/anvil', name: 'anvil', weight: 20 };
    const s = started();
    // anvils fill the load until one unit of the heavy meat still fits and the second does not
    const max = loadMax(heavy, s);
    expect(max).toBeGreaterThanOrEqual(20);
    s.player.bag['test/anvil'] = Math.floor((max - 20) / 20);
    const c = laid(s, 1);
    const r = ok(s, { t: 'dress', carcass: c.id, at: here(s) }, free(s), heavy);
    // one unit of meat came in; the other, and whatever the full load then refused, lies on the tile
    expect(r.state.player.bag['test/hare-meat']).toBe(1);
    const pile = r.state.player.ground?.[`${c.at[0]},${c.at[1]}`] ?? {};
    expect(pile['test/hare-meat']).toBe(1);
    for (const item of ['test/hare-meat', 'test/hare-hide', 'test/hare-bone']) {
      expect((r.state.player.bag[item] ?? 0) + (pile[item] ?? 0), item).toBe(item === 'test/hare-meat' ? 2 : 1);
    }
    expect(r.events).toContainEqual({ e: 'drop', item: 'test/hare-meat', qty: 1, at: [c.at[0], c.at[1]] });
    // the drop line says where the rest went; no bag_full line for the same units
    expect(r.events.filter((e) => e.e === 'bag_full')).toEqual([]);
    expect(r.state.player.carcasses).toEqual([]);
  });

  test('a hunt prices its drops, and a finer grade is worth the plain one', () => {
    const t = computeValues(b);
    expect(t.values['test/hare-hide']).toBeGreaterThan(0);
    expect(t.values['test/hare-meat']).toBeGreaterThan(0);
    expect(t.values['test/hare-hide-fine']).toBe(t.values['test/hare-hide']);
    expect(t.cheapest['test/hare-meat']).toBe(HARE);
    expect(t.cheapest['test/hare-hide-fine']).toBe(HARE);
    expect(t.issues.filter((i) => i.source === HARE)).toEqual([]);
    expect(t.made).not.toContain('test/hare-hide');
  });

  test('the grade comes from one draw: the finest first, the rest plain', () => {
    const { grade2_bp, grade3_bp } = b.params.hunt;
    expect(gradeOfDraw(b, 0)).toBe(3);
    expect(gradeOfDraw(b, grade3_bp)).toBe(2);
    expect(gradeOfDraw(b, grade3_bp + grade2_bp)).toBe(1);
    expect(gradeOfDraw(b, 9999)).toBe(1);
  });

  test('nobody buys a good of the hunt raw: no price anywhere, and the sale says why', () => {
    // the core's own hunted kinds (the creature schema) drop goods too; these are the test hare's
    expect([...huntGoods(b)].filter((id) => id.startsWith('test/')).sort()).toEqual(['test/hare-bone', 'test/hare-hide', 'test/hare-hide-fine', 'test/hare-meat']);
    expect(huntGoods(b).has('core/roe-hide')).toBe(true);
    const s = started();
    s.player.bag['test/hare-hide'] = 1;
    expect(salePrice(b, s, 'test/hare-hide', 1)).toBeUndefined();
    expect(salePrice(b, s, 'test/hare-hide-fine', 1)).toBeUndefined();
    expect(salePrice(b, s, 'core/branch', 1)).toBeGreaterThan(0);
    const npc = npcTile(b, trader)!;
    const at = bfsNear(b, s.player, s.player.at, { x: npc[0], y: npc[1], w: 1, h: 1 })!.at(-1)!;
    expect(act(s, { t: 'sell', npc: trader, item: 'test/hare-hide', qty: 1, at })).toEqual({
      ok: false,
      error: 'Nobody buys that raw: make something of it.',
    });
  });

  test('only a hunted kind falls, and a spoiled carcass leaves the list when the next one is laid', () => {
    const s = started();
    expect(() => placeCarcass(b, s, 'core/sparrow', s.player.at, 1, 0)).toThrow('is not an animal that can be taken');
    const old = laid(s, 1, 0);
    const fresh = placeCarcass(b, s, HARE, s.player.at, 3, b.params.hunt.hide_spoil_d * b.params.day_length_ms);
    expect(fresh.id).toBe(old.id + 1);
    expect(s.player.carcasses?.map((c) => c.id)).toEqual([fresh.id]);
  });
});
