import { beforeAll, describe, expect, test } from 'vitest';
import { DIAGONAL_PAIR_MILLI, STEP_MILLI, makeWalkable, newState, step, walkCharge, type Bundle, type State, type Tile } from '@game/kernel';

import { loadBundle } from '../../tools/test/helpers/world.js';

let bundle: Bundle;

beforeAll(() => {
  bundle = loadBundle();
});

function started(): State {
  const result = step(bundle, newState(bundle, 17), { t: 'start', starter: 'core/forager', name: 'Tester' }, 0);
  if (!result.ok) throw new Error(result.error);
  return result.state;
}

function tileRequiringMoreThanTwoSteps(state: State): Tile {
  const walkable = makeWalkable(bundle);
  const [x, y] = state.player.at;
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      if (Math.abs(dx) + Math.abs(dy) <= 2) continue;
      if (walkable(x + dx, y + dy, state.player)) return [x + dx, y + dy];
    }
  }
  throw new Error('The forager wake has no walkable tile requiring more than two steps in its local square.');
}

describe('server travel bounds (G56)', () => {
  test('movement uses a four-way path, not only Chebyshev distance', () => {
    const state = started();
    const target = tileRequiringMoreThanTwoSteps(state);
    expect(step(bundle, state, { t: 'move', at: target }, 0, { validateTravel: true })).toEqual({
      ok: false,
      error: 'That is further than a walk goes in that time.',
    });
  });

  test('an action cannot claim a tile beyond the same path bound', () => {
    const state = started();
    const target = tileRequiringMoreThanTwoSteps(state);
    expect(step(bundle, state, { t: 'visit', slot: 'not-a-slot', at: target }, 0, { validateTravel: true })).toEqual({
      ok: false,
      error: 'That is further than a walk goes in that time.',
    });
  });

  test('every tile named by an action is checked against the same path bound', () => {
    const state = started();
    const far: Tile = [state.player.at[0] + 3, state.player.at[1]];
    expect(step(bundle, state, { t: 'kindle', fire: far, at: state.player.at }, 0, { validateTravel: true })).toEqual({
      ok: false,
      error: 'That is further than a walk goes in that time.',
    });
  });

  test('a long idle cannot extend a movement report beyond move_reach_max', () => {
    const state = started();
    const far: Tile = [state.player.at[0] + bundle.params.move_reach_max + 1, state.player.at[1]];
    expect(step(bundle, state, { t: 'move', at: far }, bundle.params.walk_step_ms * 10_000, { validateTravel: true })).toEqual({
      ok: false,
      error: 'That is further than a walk goes in that time.',
    });
  });

  test('movement reports accept a reachable four-way path', () => {
    const state = started();
    const target: Tile = [state.player.at[0] + 2, state.player.at[1]];
    expect(step(bundle, state, { t: 'move', at: target }, bundle.params.walk_step_ms, { validateTravel: true })).toMatchObject({
      ok: true,
      state: { player: { at: target } },
    });
  });

  test('old content receives the bounded default', () => {
    expect(bundle.params.move_reach_max).toBe(32);
  });
});

/** The top-left tile of a square of open ground `side` tiles wide, for the forager. */
function openSquare(state: State, side: number): Tile {
  const walkable = makeWalkable(bundle);
  const { width: w, height: h } = bundle.map;
  for (let y = 0; y + side <= h; y++) {
    for (let x = 0; x + side <= w; x++) {
      let open = true;
      for (let dy = 0; dy < side && open; dy++) for (let dx = 0; dx < side && open; dx++) open = walkable(x + dx, y + dy, state.player);
      if (open) return [x, y];
    }
  }
  throw new Error(`The map has no open square of ${side} tiles.`);
}

describe('the walk charge is the octile length of the path (G56, NEXT 22 c)', () => {
  test('a straight step costs a step, and a step that turns off an unpaired one closes a diagonal pair', () => {
    const state = started();
    const [x, y] = openSquare(state, 4);
    const right = walkCharge(bundle, state, [x, y], [x + 1, y], 2, null);
    expect(right).toEqual({ milli: STEP_MILLI, leg: [1, 0] });
    const down = walkCharge(bundle, state, [x + 1, y], [x + 1, y + 1], 2, right!.leg);
    expect(down).toEqual({ milli: DIAGONAL_PAIR_MILLI - STEP_MILLI, leg: null });
    // the pair is closed: the next step starts a new one, and a straight step after an unpaired one pairs nothing
    expect(walkCharge(bundle, state, [x + 1, y + 1], [x + 2, y + 1], 2, down!.leg)).toEqual({ milli: STEP_MILLI, leg: [1, 0] });
    expect(walkCharge(bundle, state, [x + 1, y], [x + 2, y], 2, [1, 0])).toEqual({ milli: STEP_MILLI, leg: [1, 0] });
    // turning back is no diagonal either
    expect(walkCharge(bundle, state, [x + 1, y], [x, y], 2, [1, 0])).toEqual({ milli: STEP_MILLI, leg: [-1, 0] });
  });

  test('a staircase of n pairs costs n diagonal steps', () => {
    const state = started();
    const [x, y] = openSquare(state, 4);
    let at: Tile = [x, y];
    let leg: Tile | null = null;
    let milli = 0;
    for (let i = 0; i < 3; i++) {
      for (const [dx, dy] of [[1, 0], [0, 1]] as const) {
        const to: Tile = [at[0] + dx, at[1] + dy];
        const charge: { milli: number; leg: Tile | null } = walkCharge(bundle, state, at, to, 2, leg)!;
        milli += charge.milli;
        leg = charge.leg;
        at = to;
      }
    }
    expect(milli).toBe(3 * DIAGONAL_PAIR_MILLI);
  });

  test('a report of several steps pairs as many as its two axes share, and an unreachable one is not charged', () => {
    const state = started();
    const [x, y] = openSquare(state, 4);
    expect(walkCharge(bundle, state, [x, y], [x + 2, y + 1], 3, null)).toEqual({ milli: STEP_MILLI + DIAGONAL_PAIR_MILLI, leg: null });
    expect(walkCharge(bundle, state, [x, y], [x + 2, y + 2], 4, null)).toEqual({ milli: 2 * DIAGONAL_PAIR_MILLI, leg: null });
    expect(walkCharge(bundle, state, [x, y], [x, y], 0, [1, 0])).toEqual({ milli: 0, leg: [1, 0] });
    expect(walkCharge(bundle, state, [x, y], [x + 3, y], 2, null)).toBeUndefined();
  });
});
