/**
 * The one work rule (QUARRYING 10; DECISIONS.md, 2026-11-20): every work action is a click and a repeating
 * animation, taken one unit at a time. This reads the animation each node plays and the units a node gives.
 */
import { beforeAll, describe, expect, test } from 'vitest';

import { type Bundle, type State, type StepResult, makeWalkable, newState, resourceKind, step, treasureKind, unitShare } from '@game/kernel';

import { loadBundle } from '../../tools/test/helpers/world.js';

let b: Bundle;

beforeAll(() => {
  b = loadBundle();
});

describe('what a node or a spot plays', () => {
  test('a mined node, a felled tree, a trowel spot, a river and a bush each have their own loop', () => {
    expect(resourceKind(b.resources['core/river-stones']!)).toBe('mine');
    expect(resourceKind(b.resources['core/oak-trees']!)).toBe('fell');
    expect(resourceKind(b.resources['core/river-fish']!)).toBe('fish');
    expect(resourceKind(b.resources['core/berry-bushes']!)).toBe('pick');
    expect(resourceKind(b.resources['core/reed-bank']!)).toBe('pick');
    expect(resourceKind(b.resources['core/keystone']!)).toBe('pick');
    expect(treasureKind(b.treasures['core/ruins-hall']!)).toBe('dig');
    expect(treasureKind(b.treasures['core/bridge-glint']!)).toBe('pick');
  });

  test('a pick names mine, a hammer on a mined node and a bare hand are picking, and a tool with no loop of its own is picking', () => {
    expect(resourceKind({ tool: 'pick' })).toBe('mine');
    expect(resourceKind({ tool: 'pick', work: 'mine' })).toBe('mine');
    expect(resourceKind({ work: 'mine' })).toBe('mine');
    expect(resourceKind({ tool: 'hammer', work: 'mine' })).toBe('pick');
    expect(resourceKind({ tool: 'basket' })).toBe('pick');
    expect(resourceKind({})).toBe('pick');
    expect(treasureKind({ tool: 'basket' })).toBe('pick');
  });
});

describe('a node worked a unit at a time', () => {
  const OAKS = 'core/oak-trees';

  function started(seed: number): State {
    const r = step(b, newState(b, seed), { t: 'start', starter: 'core/forager', name: 'Tester' }, 0);
    if (!r.ok) throw new Error(r.error);
    r.state.player.bag['core/axe'] = 1;
    return r.state;
  }

  function target(state: State, source: string): { id: string; at: [number, number] } {
    const [id, inst] = Object.entries(b.instances).find(([, i]) => i.source === source)!;
    const walkable = makeWalkable(b);
    const at = ([[0, 1], [1, 0], [0, -1], [-1, 0]] as const).map(([dx, dy]): [number, number] => [inst.x + dx, inst.y + dy]).find(([x, y]) => walkable(x, y, state.player))!;
    return { id, at };
  }

  function ok(r: StepResult): Extract<StepResult, { ok: true }> {
    if (!r.ok) throw new Error(r.error);
    return r;
  }

  /** One gather the moment the last unit ends, as the client asks for it. */
  function unit(state: State, source: string, grade?: number): Extract<StepResult, { ok: true }> {
    const { id, at } = target(state, source);
    return ok(step(b, state, { t: 'gather', node: id, grade, at }, state.player.busyUntil));
  }

  test('an oak gives one log a unit, on the unit shares of its time, and is out after its yield', () => {
    const def = b.resources[OAKS]!;
    let state = started(5);
    const { id } = target(state, OAKS);
    const lengths: number[] = [];
    for (let i = 1; i <= def.yield; i += 1) {
      const before = state.player.busyUntil;
      const r = unit(state, OAKS);
      state = r.state;
      lengths.push(state.player.busyUntil - before);
      expect(state.player.bag['core/log']).toBe(i);
      // the node stays ready until its last unit
      expect(state.nodes[id]!.readyAt > state.player.busyUntil - 1).toBe(i === def.yield);
    }
    // worked to the end it costs what it always did, and trains the same
    expect(lengths.reduce((a, c) => a + c, 0)).toBe(def.active_ms);
    expect(lengths).toEqual(Array.from({ length: def.yield }, (_, i) => unitShare(def.active_ms, def.yield, i)));
    expect(state.player.xp[b.verbs.fell]).toBe(def.active_ms);
    // and the node is out: the next unit is refused until it has grown back
    const { id: nodeId, at } = target(state, OAKS);
    expect(step(b, state, { t: 'gather', node: nodeId, at }, state.player.busyUntil).ok).toBe(false);
  });

  test('stopping keeps every unit taken and the node keeps the rest of its stock', () => {
    const def = b.resources[OAKS]!;
    let state = started(5);
    const { id } = target(state, OAKS);
    state = unit(state, OAKS).state;
    state = unit(state, OAKS).state;
    // the player walks away here: nothing is asked, nothing is taken back
    expect(state.player.bag['core/log']).toBe(2);
    expect(state.nodes[id]!.taken).toBe(2);
    expect(state.nodes[id]!.readyAt).toBe(0);
    // later the work goes on from where it stood and ends the node
    state = unit(state, OAKS).state;
    expect(state.player.bag['core/log']).toBe(def.yield);
    expect(state.nodes[id]!.taken).toBeUndefined();
  });

  test('a grade an old log carries is set aside: every grade reads as the same unit, none is refused', () => {
    for (const source of ['core/reed-bank', 'core/river-stones', OAKS]) {
      const plain = unit(started(3), source);
      for (const grade of [0, 1, 2, 3, 4, 9]) {
        const claimed = unit(started(3), source, grade);
        expect(claimed.state).toEqual(plain.state);
        expect(claimed.events).toEqual(plain.events);
      }
    }
  });

  test('a dig is one unit and never misses: a find the spot is sure of comes whatever the old grade said', () => {
    for (let seed = 1; seed <= 20; seed += 1) {
      const state = started(seed);
      state.player.bag['core/trowel'] = 1;
      const { id, at } = target(state, 'core/ruins-hall');
      const plain = ok(step(b, structuredClone(state), { t: 'dig', spot: id, at }, 0));
      const careless = ok(step(b, structuredClone(state), { t: 'dig', spot: id, grade: 0, at } as never, 0));
      expect(careless.state).toEqual(plain.state);
    }
  });

  test('agility makes the unit shorter, inside the power cap, and nothing else changes', () => {
    const slow = started(5);
    const quick = started(5);
    // a high level lifts the cap, so the points can show
    slow.player.xp[b.verbs.gather] = quick.player.xp[b.verbs.gather] = 10 ** 7;
    quick.player.attrs.agility = 4;
    const a = unit(slow, 'core/reed-bank').state;
    const c = unit(quick, 'core/reed-bank').state;
    expect(c.player.busyUntil).toBeLessThanOrEqual(a.player.busyUntil);
    expect(c.player.bag).toEqual(a.player.bag);
  });
});
