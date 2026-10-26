/**
 * Search (docs/design/SEARCH.md): a searchable's contents are drawn once a day, kept, and refilled at dawn; luck tilts
 * only the rare rows; a take moves one row or all rows into the bag; an old save without the field reads as empty.
 */
import { beforeAll, describe, expect, test } from 'vitest';

import {
  type Bundle,
  type Rect,
  type State,
  type StepResult,
  bagCapacity,
  bagUsed,
  idiv,
  idivUp,
  itemWeight,
  loadMax,
  migrateState,
  newState,
  rareFindPermille,
  rarityRank,
  searchDawn,
  step,
  weightRoom,
} from '@game/kernel';

import { bfsNear, loadBundle } from '../../tools/test/helpers/world.js';

let b: Bundle;
const LOG = 'core/hollow-log';

beforeAll(() => {
  b = loadBundle();
});

let beside: [number, number];

/** A started character of this seed; `at` is a walkable tile beside the log. */
function started(seed: number): { s: State; at: [number, number] } {
  const r = step(b, newState(b, seed), { t: 'start', race: 'core/human', name: 'Seeker' }, 0);
  if (!r.ok) throw new Error(r.error);
  if (!beside) {
    const prop = b.map.props.find((p) => p.id === b.searchables[LOG]!.place.prop)!;
    beside = bfsNear(b, { restored: Object.values(b.restores).filter((x) => x.passable).map((x) => x.id), camp: [] }, r.state.player.at, prop as Rect)!.at(-1)! as [number, number];
  }
  return { s: r.state, at: beside };
}

const ok = (r: StepResult): Extract<StepResult, { ok: true }> => {
  if (!r.ok) throw new Error(r.error);
  return r;
};
const search = (s: State, at: [number, number], tick: number, spot = LOG) => step(b, s, { t: 'search', spot, at }, tick);
const rowsOf = (r: StepResult): string[] => {
  const ev = ok(r).events.find((e) => e.e === 'search');
  if (ev?.e !== 'search') throw new Error('no search event');
  return ev.rows;
};
/** The tick of the n-th dawn (tick 0 is noon). */
const dawnTick = (n: number) => {
  const d = b.params.day_length_ms;
  return n * d - idiv(d, 2) + idivUp(5 * d, 24);
};
const COMMON = ['core/pottery-shard', 'core/berry', 'core/old-coin', 'core/herb'];
/** No searchable holds a rare row until a rare item of its own exists, so the luck test hangs this one on the log itself. */
const RARE = 'core/stone-idol';

/** A seed whose first search of the log holds at least `min` rows. */
function seedWith(min: number, tick = 0): number {
  for (let seed = 1; seed < 2000; seed++) {
    const { s, at } = started(seed);
    if (rowsOf(search(s, at, tick)).length >= min) return seed;
  }
  throw new Error('no seed');
}

describe('the schema and the bundle', () => {
  test('the three searchables are core content apart from the dig spots, each on a plain prop with no rare row yet', () => {
    expect(Object.keys(b.searchables).sort()).toEqual(['core/branch-heap', 'core/hollow-log', 'core/hollow-tree']);
    for (const sr of Object.values(b.searchables)) {
      expect(b.treasures[sr.id]).toBeUndefined();
      // the whole bowl stays the collapsed hall's prize and the stone idol the tangle's keepsake
      expect(sr.rows.filter((r) => rarityRank(b.items[r.item]!.rarity) >= 2)).toHaveLength(0);
      expect(sr.rows.every((r) => b.values[r.item] !== undefined)).toBe(true);
    }
  });
});

describe('the daily draw', () => {
  test('a search draws the same rows for the same seed and day, and a second search the same day shows them again', () => {
    const { s, at } = started(seedWith(1));
    const first = ok(search(s, at, 0));
    const again = ok(search(first.state, at, 5000));
    expect(rowsOf(again)).toEqual(rowsOf(first));
    expect(again.state.searched).toEqual(first.state.searched);
    // the same draw from a fresh state of the same seed
    expect(rowsOf(search(s, at, 777))).toEqual(rowsOf(first));
    expect(first.state.searched[LOG]!.dawn).toBe(searchDawn(b, 0));
  });

  test('the rows are the table in order, each at most once, every one an item of the table', () => {
    for (let seed = 1; seed < 60; seed++) {
      const { s, at } = started(seed);
      const rows = rowsOf(search(s, at, 0));
      const table = b.searchables[LOG]!.rows.map((r) => r.item);
      expect(rows.every((r) => table.includes(r))).toBe(true);
      expect(rows).toEqual(table.filter((t) => rows.includes(t)));
    }
  });

  test('some seeds find nothing, and then the event says so with an empty list', () => {
    const empty = Array.from({ length: 200 }, (_, i) => i + 1).filter((seed) => {
      const { s, at } = started(seed);
      return rowsOf(search(s, at, 0)).length === 0;
    });
    expect(empty.length).toBeGreaterThan(0);
  });

  test('it refills at dawn: the contents are drawn fresh when the dawn count moves, not before', () => {
    const before = dawnTick(1) - 1;
    const after = dawnTick(1);
    expect(searchDawn(b, before)).toBe(0);
    expect(searchDawn(b, after)).toBe(1);
    expect(searchDawn(b, dawnTick(2) - 1)).toBe(1);
    expect(searchDawn(b, 0)).toBe(0);
    let differed = 0;
    for (let seed = 1; seed < 80; seed++) {
      const { s, at } = started(seed);
      const one = ok(search(s, at, 10));
      const same = ok(search(one.state, at, before));
      expect(same.state.searched[LOG]).toEqual(one.state.searched[LOG]);
      const next = ok(search(one.state, at, after));
      expect(next.state.searched[LOG]!.dawn).toBe(1);
      if (rowsOf(next).join() !== rowsOf(one).join()) differed++;
    }
    expect(differed).toBeGreaterThan(0);
  });

  test('a searchable emptied by taking stays empty until the next dawn, then refills', () => {
    const seed = seedWith(1);
    const { s, at } = started(seed);
    const taken = ok(step(b, ok(search(s, at, 0)).state, { t: 'take', spot: LOG, at }, 100));
    expect(taken.state.searched[LOG]!.rows).toEqual([]);
    expect(rowsOf(search(taken.state, at, 200))).toEqual([]);
    const next = rowsOf(search(taken.state, at, dawnTick(1)));
    const fresh = rowsOf(search(s, at, dawnTick(1)));
    expect(next).toEqual(fresh);
  });
});

describe('luck', () => {
  /** A character of high level and luck, so the rare tilt is above 1000 inside the power cap. */
  function lucky(seed: number): { s: State; at: [number, number] } {
    const { s, at } = started(seed);
    for (const id of Object.keys(b.professions)) s.player.xp[id] = 50_000_000;
    s.player.attrs.luck = 10;
    return { s, at };
  }

  test('luck tilts only the rare row: common rows draw the same, and a rare row that came without luck comes with it', () => {
    const withRare = structuredClone(b);
    withRare.searchables[LOG]!.rows.push({ item: RARE, chance_pct: 2 });
    const look = (s: State, at: [number, number]) => rowsOf(step(withRare, s, { t: 'search', spot: LOG, at }, 0));
    expect(rareFindPermille(b, lucky(1).s)).toBeGreaterThan(1000);
    expect(rareFindPermille(b, started(1).s)).toBe(1000);
    let onlyLucky = 0;
    for (let seed = 1; seed < 3000; seed++) {
      const plain = started(seed);
      const luck = lucky(seed);
      const a = look(plain.s, plain.at);
      const l = look(luck.s, luck.at);
      for (const item of COMMON) expect(l.includes(item)).toBe(a.includes(item));
      if (a.includes(RARE)) expect(l).toContain(RARE);
      else if (l.includes(RARE)) onlyLucky++;
    }
    expect(onlyLucky).toBeGreaterThan(0);
  });
});

describe('taking', () => {
  test('take one moves that row into the bag and leaves the others; take all moves the rest', () => {
    const seed = seedWith(2);
    const { s, at } = started(seed);
    const found = ok(search(s, at, 0));
    const rows = found.state.searched[LOG]!.rows;
    const bag0 = { ...found.state.player.bag };
    const one = ok(step(b, found.state, { t: 'take', spot: LOG, row: 1, at }, 10));
    const item = rows[1]!;
    expect(one.state.searched[LOG]!.rows).toEqual(rows.filter((_, i) => i !== 1));
    expect(one.state.player.bag[item]).toBe((bag0[item] ?? 0) + 1);
    expect(one.events.some((e) => e.e === 'gain' && e.item === item && e.qty === 1)).toBe(true);
    const all = ok(step(b, one.state, { t: 'take', spot: LOG, at }, 20));
    expect(all.state.searched[LOG]!.rows).toEqual([]);
    for (const row of rows) expect(all.state.player.bag[row]).toBeGreaterThanOrEqual(1);
    expect(all.events.filter((e) => e.e === 'gain')).toHaveLength(rows.length - 1);
  });

  test('what is taken counts on the outing like a dig find, and a searchable cannot be taken from before it is searched', () => {
    const seed = seedWith(1);
    const { s, at } = started(seed);
    expect(step(b, s, { t: 'take', spot: LOG, at }, 0)).toMatchObject({ ok: false });
    const found = ok(search(s, at, 0)).state;
    found.player.outing = { gained: {}, solved: [], visited: [] };
    const r = ok(step(b, found, { t: 'take', spot: LOG, at }, 5));
    const total = Object.values(r.state.player.outing!.gained).reduce((n, q) => n + q, 0);
    expect(total).toBe(found.searched[LOG]!.rows.length);
  });

  test('a full bag answers as the dig does and keeps every row; a bag with one place left takes one and says the rest is full', () => {
    // one unit per place, so a place left is exactly one row: the stacking itself is tested in load.test.ts
    const single = structuredClone(b);
    single.params.place_stack = 1;
    const seed = seedWith(2);
    const { s, at } = started(seed);
    const found = ok(search(s, at, 0)).state;
    const rows = found.searched[LOG]!.rows;
    const full = structuredClone(found);
    full.player.bag = { 'core/log': bagCapacity(single, full) };
    expect(bagUsed(single, full)).toBe(bagCapacity(single, full));
    const refused = step(single, full, { t: 'take', spot: LOG, at }, 5);
    expect(refused).toEqual({ ok: false, error: 'Your bag is full.' });

    const one = structuredClone(found);
    one.player.bag = { 'core/log': bagCapacity(single, one) - 1 };
    const r = ok(step(single, one, { t: 'take', spot: LOG, at }, 5));
    expect(r.state.searched[LOG]!.rows).toEqual(rows.slice(1));
    expect(r.events.filter((e) => e.e === 'gain')).toHaveLength(1);
    expect(r.events.filter((e) => e.e === 'bag_full')).toHaveLength(new Set(rows.slice(1)).size);
    expect(bagUsed(single, r.state)).toBe(bagCapacity(single, r.state));
  });

  test('a bag at the most it can carry takes only the rows that weigh nothing', () => {
    const { s, at } = started(seedWith(2));
    const found = ok(search(s, at, 0)).state;
    const rows = found.searched[LOG]!.rows;
    const heavy = structuredClone(found);
    heavy.player.bag = { 'core/stone': idiv(loadMax(b, heavy), itemWeight(b, 'core/stone')) };
    expect(weightRoom(b, heavy, 'core/berry')).toBe(0);
    const light = rows.filter((item) => itemWeight(b, item) === 0);
    const r = step(b, heavy, { t: 'take', spot: LOG, at }, 5);
    if (light.length === 0) return void expect(r).toEqual({ ok: false, error: 'Your bag is full.' });
    expect(ok(r).state.searched[LOG]!.rows).toEqual(rows.filter((item) => itemWeight(b, item) > 0));
  });

  test('a row that is not there, a searchable that is not there and a tile too far away are refused', () => {
    const { s, at } = started(seedWith(1));
    const found = ok(search(s, at, 0)).state;
    expect(step(b, found, { t: 'take', spot: LOG, row: 9, at }, 5)).toMatchObject({ ok: false });
    expect(step(b, found, { t: 'take', spot: LOG, row: -1, at }, 5)).toMatchObject({ ok: false });
    expect(step(b, s, { t: 'search', spot: 'core/nowhere', at }, 5)).toMatchObject({ ok: false });
    expect(step(b, s, { t: 'search', spot: LOG, at: [at[0] + 6, at[1]] }, 5)).toMatchObject({ ok: false });
  });
});

describe('an old save', () => {
  test('a save without the field reads as empty, and the first search or take works on it', () => {
    const { s, at } = started(seedWith(1));
    const old = structuredClone(s) as Partial<State>;
    delete old.searched;
    expect(migrateState(old as State).searched).toEqual({});
    // the step itself also reads a missing field as empty
    const r = ok(step(b, old as State, { t: 'search', spot: LOG, at }, 0));
    expect(Object.keys(r.state.searched)).toEqual([LOG]);
    const none = step(b, old as State, { t: 'take', spot: LOG, at }, 0);
    expect(none).toEqual({ ok: false, error: 'There is nothing to take.' });
  });
});
