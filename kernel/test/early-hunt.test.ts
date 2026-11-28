import { beforeAll, describe, expect, test } from 'vitest';

import {
  type Action,
  type State,
  type StepOptions,
  FULL_POWER,
  campTile,
  lastDawn,
  newState,
  serialize,
  step,
  tagAt,
  walkableFor,
} from '@game/kernel';

import { loadPixelBundle } from '../../tools/test/helpers/world.js';

const STONE = 'core/stone';
const SNARE = 'core/snare';
const MEAT = 'core/hare-meat';
const HIDE = 'core/hare-hide';
let bundle: ReturnType<typeof loadPixelBundle>;
beforeAll(() => { bundle = loadPixelBundle(); });

function trial() {
  const b = structuredClone(bundle);
  const initial = newState(b, 819);
  const started = step(b, initial, { t: 'start', race: 'core/human', name: 'Hunter' }, 0);
  if (!started.ok) throw new Error(started.error);
  const s = started.state;
  s.player.bag = {};
  s.player.worn = {};
  s.player.looks = {};
  const walkable = walkableFor(b);
  const { x, y } = b.map.creatures!.spots.find(({ kind, x, y }) =>
    kind === 'core/hare' && tagAt(b.map, x, y) === 'meadow' && walkable(x, y, s.player))!;
  const at: [number, number] = [x, y];
  s.player.at = at;
  b.map.creatures!.spots = [
    { kind: 'core/hare', x, y }, { kind: 'core/roe', x, y }, { kind: 'core/wolf', x, y },
    { kind: 'core/sparrow', x, y }, { kind: 'core/hare', x: x + 4, y },
  ];
  const run = (s: State, a: Action, tick = s.player.busyUntil > s.tick ? s.player.busyUntil : s.tick, options?: StepOptions) =>
    step(b, s, a, tick, options);
  const ok = (s: State, a: Action, tick?: number, options?: StepOptions) => {
    const r = run(s, a, tick, options);
    if (!r.ok) throw new Error(r.error);
    return r.state;
  };
  // the tile the figure throws from: two tiles off the hare on open meadow, nothing between (a thrown stone takes it, #923)
  const from = ([[-2, 0], [2, 0], [0, -2], [0, 2]] as const)
    .map(([dx, dy]) => [x + dx, y + dy] as [number, number])
    .find(([fx, fy]) => walkable(fx, fy, s.player) && [[Math.sign(x - fx) + fx, Math.sign(y - fy) + fy]].every(([mx, my]) => walkable(mx!, my!, s.player)))!;
  /** a throw from `from` at the hare of spot `prey`, at `power` (a thousandth of full) */
  const shot = (prey = 0, power = FULL_POWER): Extract<Action, { t: 'throw' }> => ({ t: 'throw', at: from, aim: at, kind: STONE, power, prey });
  return { b, s, at, from, shot, run, ok, day: b.params.day_length_ms };
}

describe('early hunting', () => {
  test('takes a real small prey with one stone before combat and cannot take it twice', () => {
    const { b, s, at, from, shot, run, ok } = trial();
    s.player.at = from;
    const take = shot();
    expect(b.params.combat.enabled).toBe(0);
    expect(run(s, take).ok).toBe(false);
    s.player.bag[STONE] = 2;
    // the roe, the wolf, the sparrow and a spot that is not there are no small game for a stone
    for (const prey of [1, 2, 3, 99]) expect(run(s, { ...take, prey }).ok).toBe(false);
    // another hare four tiles on is not struck by a stone flying at this one: the stone lands and nothing is taken
    const wide = ok(structuredClone(s), shot(4));
    expect(wide.player.carcasses ?? []).toHaveLength(0);
    expect(s.player.bag[STONE]).toBe(2);
    const taken = ok(s, take);
    expect(taken.player.bag[STONE]).toBe(1);
    expect(run(taken, take).ok).toBe(false);
    expect(run(taken, take, b.params.day_length_ms).ok).toBe(true);
    const carcass = taken.player.carcasses![0]!;
    expect(carcass).toMatchObject({ kind: 'core/hare', at });
    taken.player.at = at;
    const dressed = ok(taken, { t: 'dress', carcass: carcass.id, at });
    expect(dressed.player.bag).toMatchObject({ [MEAT]: 1, [HIDE]: 1 });
  });

  test('makes a snare from exactly two reed cords and a branch at the work stone', () => {
    const { b, s, ok } = trial();
    const recipe = b.recipes[SNARE]!;
    expect(recipe.station).toBe('workshop');
    expect(recipe.inputs).toEqual([{ item: 'core/reed-cord', qty: 2 }, { item: 'core/branch', qty: 1 }]);
    const camp = b.camps['core/work-stone']!;
    const [x, y] = campTile(b, camp.slot)!;
    const walkable = walkableFor(b);
    const tiles: [number, number][] = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]];
    const at = tiles.find(([x, y]) => walkable(x, y, s.player))!;
    s.player.at = at;
    s.player.camp = [camp.id];
    s.player.bag = { 'core/reed-cord': 2, 'core/branch': 1 };
    expect(ok(s, { t: 'craft', recipe: SNARE, at }).player.bag).toEqual({ [SNARE]: 1 });
  });

  test('sets only on meadow, allows one check per valley day and rearms after a catch', () => {
    const { s, at, b, day, ok, run } = trial();
    const set: Action = { t: 'set_snare', tile: at, at };
    const check: Action = { t: 'check_snare', tile: at, at };
    s.player.bag[SNARE] = 2;
    const glyph = b.map.ground[at[1]]![at[0]]!;
    const tag = b.map.legend[glyph]!.tag;
    b.map.legend[glyph]!.tag = 'path';
    expect(run(s, set).ok).toBe(false);
    b.map.legend[glyph]!.tag = tag;
    const placed = ok(s, set);
    expect(placed.player.bag[SNARE]).toBe(1);
    expect(run(placed, set).ok).toBe(false);
    const empty = ok(placed, check);
    expect(empty.player.carcasses ?? []).toHaveLength(0);
    const dawn = lastDawn(b, day);
    expect(run(empty, check, dawn - 1).ok).toBe(false);
    const caught = ok(empty, check, dawn);
    expect(caught.player.carcasses).toHaveLength(1);
    expect(run(caught, check).ok).toBe(false);
    expect(ok(caught, check, 2 * day).player.carcasses).toHaveLength(2);
  });

  test('only awake time before dressing makes a carcass lose its meat or hide', () => {
    const { b, s, at, from, shot, day, run, ok } = trial();
    s.player.bag[STONE] = 1;
    s.player.at = from;
    const taken = ok(s, shot());
    taken.player.at = at;
    const dress: Action = { t: 'dress', carcass: taken.player.carcasses![0]!.id, at };
    const skip = 2 * day;
    const rested = ok(taken, { t: 'move', at }, skip, { inactiveMs: skip });
    const meatAt = skip + b.params.hunt.meat_spoil_d * day;
    const hideAt = skip + b.params.hunt.hide_spoil_d * day;
    expect(ok(rested, dress, meatAt - 1).player.bag[MEAT]).toBe(1);
    const afterMeat = ok(rested, dress, meatAt);
    expect(afterMeat.player.bag[MEAT]).toBeUndefined();
    expect(afterMeat.player.bag[HIDE]).toBe(1);
    expect(run(rested, dress, hideAt)).toEqual({ ok: false, error: 'Nothing is left of it.' });
  });

  test('a ready catch survives a skipped interval and a saved return, and starts fresh at collection', () => {
    const { b, s, at, day, ok } = trial();
    s.player.bag[SNARE] = 1;
    const placed = ok(s, { t: 'set_snare', tile: at, at });
    const ready = ok(placed, { t: 'move', at }, day);
    const skip = (b.params.hunt.hide_spoil_d + 2) * day;
    const slept = ok(ready, { t: 'move', at }, ready.tick + skip, { inactiveMs: skip });
    const resumed = JSON.parse(serialize(slept)) as State;
    const caught = ok(resumed, { t: 'check_snare', tile: at, at }, resumed.tick);
    const dressed = ok(caught, { t: 'dress', carcass: caught.player.carcasses![0]!.id, at });
    expect(dressed.player.bag).toMatchObject({ [MEAT]: 1, [HIDE]: 1 });
  });

  test('spoilage counts awake time, preserves ages through ground transfers and expires meat before hide', () => {
    const { b, s, at, from, shot, day, ok } = trial();
    s.player.bag[STONE] = 1;
    s.player.at = from;
    const taken = ok(s, shot());
    taken.player.at = at;
    const skip = (b.params.hunt.hide_spoil_d + 2) * day;
    const slept = ok(taken, { t: 'move', at }, skip, { inactiveMs: skip });
    const dressed = ok(slept, { t: 'dress', carcass: taken.player.carcasses![0]!.id, at });
    expect(dressed.player.bag).toMatchObject({ [MEAT]: 1, [HIDE]: 1 });
    const meatAge = b.params.hunt.meat_spoil_d * day;
    const hideAge = b.params.hunt.hide_spoil_d * day;
    const dropped = ok(dressed, { t: 'drop', item: HIDE, qty: 1, at }, dressed.tick + day);
    const returned = JSON.parse(serialize(dropped)) as State;
    const picked = ok(returned, { t: 'pickup', item: HIDE, at }, returned.tick + skip, { inactiveMs: skip });
    const meatGone = ok(picked, { t: 'move', at }, dressed.tick + skip + meatAge);
    expect(meatGone.player.bag[MEAT]).toBeUndefined();
    expect(meatGone.player.bag[HIDE]).toBe(1);
    const hideGone = ok(meatGone, { t: 'move', at }, dressed.tick + skip + hideAge);
    expect(hideGone.player.bag[HIDE]).toBeUndefined();
  });
});
