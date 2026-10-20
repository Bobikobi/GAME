import { beforeAll, describe, expect, test } from 'vitest';
import { makeWalkable, newState, step, type Bundle, type State, type Tile } from '@game/kernel';

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
