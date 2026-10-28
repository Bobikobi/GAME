/**
 * The inn's bed (G16, G32): from 19:00 a keeper's bed takes the player to the night's 05:00, health in
 * full. Sleeping spends the night rather than skipping it: a fire burns out unattended, so a vigil is
 * never kept asleep (G48), and nothing outside the town is safer for it (G71). And Maru walks his round
 * by day (decision 27 of 22.10): a talk finds him where he stands, and his hearth burns from dusk while
 * he is home.
 */
import { beforeAll, describe, expect, test } from 'vitest';

import {
  BED_FROM_HOUR,
  type Bundle,
  type State,
  type Tile,
  hourOf,
  keptFireLit,
  makeWalkable,
  npcAtHome,
  npcHome,
  npcTile,
  newState,
  roundWalk,
  hpCap,
  serialize,
  sleepPlace,
  sleepUntil,
  step,
} from '@game/kernel';

import { loadBundle } from '../../tools/test/helpers/world.js';

let b: Bundle;

beforeAll(() => {
  b = loadBundle();
});

const INN = 'core/innkeeper';
const ELDER = 'core/elder';
const HOUR = 50_000;
/** The tick of an hour of the first day after the noon start, or of the next morning for hours before noon. */
const at = (hour: number): number => (hour >= 12 ? hour - 12 : hour + 12) * HOUR;
/** The tick of an hour of the second day, from its 05:00 (5) to the next night's 04:00 (28). */
const next = (hour: number): number => (hour + 12) * HOUR;

function beside(npc: string, tick?: number): Tile {
  const home = npcTile(b, npc, tick)!;
  const walkable = makeWalkable(b);
  const view = { camp: [], restored: [] };
  for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1], [1, 1], [-1, 1]] as const) {
    const t: Tile = [home[0] + dx, home[1] + dy];
    if (walkable(t[0], t[1], view)) return t;
  }
  throw new Error(`nowhere to stand beside ${npc}`);
}

function begin(): State {
  const result = step(b, newState(b, 7), { t: 'start', starter: 'core/forager', name: 'Tester' }, 0);
  if (!result.ok) throw new Error(result.error);
  const state = structuredClone(result.state);
  state.player.at = beside(INN);
  state.player.movedAt = 0;
  return state;
}

describe('the bed at the inn', () => {
  test('the inn sells the food and the first-aid kit, and Pell no longer does', () => {
    const inn = b.shops['core/inn']!;
    expect(inn.bed).toBe(true);
    const sells = inn.sells.map((offer) => offer.item);
    expect(sells).toContain('core/first-aid-kit');
    const pell = b.shops['core/trader-shop']!.sells.map((offer) => offer.item);
    for (const item of sells) expect(pell).not.toContain(item);
  });

  test('by day there is no bed; from 19:00 there is, to the next 05:00', () => {
    expect(BED_FROM_HOUR).toBe(19);
    expect(sleepUntil(b, at(18))).toBeUndefined();
    expect(sleepUntil(b, at(19) - 1)).toBeUndefined();
    expect(sleepUntil(b, at(19))).toBe(at(5));
    expect(sleepUntil(b, at(23))).toBe(at(5));
    expect(sleepUntil(b, at(4))).toBe(at(5));
    expect(hourOf(b, at(5))).toBe(5);
  });

  test('a day sleep is refused and changes nothing', () => {
    const state = begin();
    const result = step(b, state, { t: 'sleep', place: INN, at: state.player.at }, at(14));
    expect(result).toEqual({ ok: false, error: 'The beds are for the night. Come back at dusk.' });
  });

  test('a sleep place is any keeper with a bed, found where the keeper stands; Pell and Maru are none', () => {
    const [x, y] = npcTile(b, INN)!;
    expect(sleepPlace(b, INN)).toEqual({ x, y, w: 1, h: 1 });
    expect(sleepPlace(b, 'core/trader')).toBeUndefined();
    expect(sleepPlace(b, ELDER)).toBeUndefined();
    expect(sleepPlace(b, 'core/no-such-place')).toBeUndefined();
  });

  test('a keeper with no bed has none to give', () => {
    const state = begin();
    state.player.at = beside('core/trader');
    const result = step(b, state, { t: 'sleep', place: 'core/trader', at: state.player.at }, at(21));
    expect(result).toEqual({ ok: false, error: 'There is no bed here.' });
  });

  test('the bed is only reached beside the keeper', () => {
    const state = begin();
    state.player.at = beside('core/trader');
    const result = step(b, state, { t: 'sleep', place: INN, at: state.player.at }, at(21));
    expect(result).toEqual({ ok: false, error: 'That is too far away.' });
  });

  test('a night in the bed wakes the player at 05:00, health in full', () => {
    const state = begin();
    state.player.hp = 1000;
    const result = step(b, state, { t: 'sleep', place: INN, at: state.player.at }, at(20));
    if (!result.ok) throw new Error(result.error);
    expect(result.events).toEqual([{ e: 'sleep', place: INN, until: at(5) }]);
    expect(result.state.player.busyUntil).toBe(at(5));
    expect(result.state.player.hp).toBe(hpCap(b, result.state));

    const early = step(b, result.state, { t: 'sleep', place: INN, at: result.state.player.at }, at(2));
    expect(early).toEqual({ ok: false, error: 'You are still busy.' });
  });

  test('a fire fed to the cap at dusk is out by the morning the sleeper wakes to', () => {
    const { cap, log_ms } = b.params.fire;
    expect(cap * log_ms).toBeLessThan(at(5) - at(20));
  });

  test('a night slept is the same night twice from the same state', () => {
    const s = begin();
    const once = step(b, s, { t: 'sleep', place: INN, at: s.player.at }, at(21));
    const twice = step(b, s, { t: 'sleep', place: INN, at: s.player.at }, at(21));
    if (!once.ok || !twice.ok) throw new Error('sleep refused');
    expect(serialize(once.state)).toBe(serialize(twice.state));
  });
});

describe("Maru's round", () => {
  test('the day the player wakes he keeps to his post; from the first dawn he is out 07:00 to 15:00', () => {
    const home = npcHome(b, ELDER)!;
    for (const hour of [12, 13, 14, 15, 20, 23, 26, 28]) expect(npcTile(b, ELDER, at(hour >= 24 ? hour - 24 : hour))).toEqual(home);
    for (const hour of [15, 18, 20, 23, 26, 28]) {
      expect(npcAtHome(b, ELDER, next(hour))).toBe(true);
      expect(npcTile(b, ELDER, next(hour))).toEqual(home);
    }
    for (const hour of [5, 6]) expect(npcTile(b, ELDER, next(hour))).toEqual(home); // he sees the dawn in at home
    for (const hour of [8, 10, 12, 14]) expect(npcAtHome(b, ELDER, next(hour))).toBe(false);
    expect(npcTile(b, ELDER, next(7))).toEqual(home); // the first step of the round is at his door
    expect(npcTile(b, ELDER)).toEqual(home);
  });

  test('each leg leaves home and comes back to it, a tile at a time', () => {
    const home = npcHome(b, ELDER)!;
    const legs = b.npcs[ELDER]!.round!;
    expect(legs.length).toBeGreaterThan(0);
    for (let leg = 0; leg < legs.length; leg++) {
      const walk = roundWalk(b, ELDER, leg);
      expect(walk[0]).toEqual(home);
      expect(walk[walk.length - 1]).toEqual(home);
      for (let i = 1; i < walk.length; i++) {
        const [ax, ay] = walk[i - 1]!;
        const [bx, by] = walk[i]!;
        expect(Math.abs(ax - bx) + Math.abs(ay - by)).toBeLessThanOrEqual(1);
      }
      for (const via of legs[leg]!.via) expect(walk).toContainEqual(via);
    }
  });

  test('a task is taken from him where he stands, not at his empty door', () => {
    const b2 = structuredClone(b);
    const q = { ...b2.quests['core/a-coin-for-maru']!, id: 'test/met-on-the-road', giver: ELDER, requires: [] };
    b2.quests[q.id] = q;
    const tick = next(15); // home again
    const out = next(13); // out west
    const result = step(b2, newState(b2, 7), { t: 'start', starter: 'core/forager', name: 'Tester' }, 0);
    if (!result.ok) throw new Error(result.error);
    const state = structuredClone(result.state);
    state.player.movedAt = 0;

    const door = structuredClone(state);
    door.player.at = beside(ELDER);
    expect(step(b2, door, { t: 'accept', quest: q.id, at: door.player.at }, out)).toEqual({
      ok: false,
      error: 'That is too far away.',
    });
    expect(step(b2, door, { t: 'accept', quest: q.id, at: door.player.at }, tick).ok).toBe(true);
    const road = structuredClone(state);
    road.player.at = beside(ELDER, out);
    expect(step(b2, road, { t: 'accept', quest: q.id, at: road.player.at }, out).ok).toBe(true);
  });

  test('his hearth burns from 19:00 to dawn while he is home, and is cold by day', () => {
    const hearth = b.map.props.find((p) => p.kept?.by === ELDER);
    expect(hearth?.id).toBe('core/elder-hearth');
    const id = hearth!.id!;
    // the first night: lit from 19:00, as every night he is home
    expect(keptFireLit(b, id, at(18))).toBe(false);
    expect(keptFireLit(b, id, at(19))).toBe(true);
    expect(keptFireLit(b, id, at(4))).toBe(true);
    for (const hour of [19, 23, 26, 28]) expect(keptFireLit(b, id, next(hour))).toBe(true);
    // out on his round, or home by day: nobody keeps it lit
    for (const hour of [7, 13, 16, 18]) expect(keptFireLit(b, id, next(hour))).toBe(false);
    expect(keptFireLit(b, 'core/no-such-fire', at(21))).toBe(false);
  });
});
