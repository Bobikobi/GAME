/**
 * The client's jump (DECISIONS 2026-11-22, the jump and the fall): the key aims one tile ahead, or two across a gap of water, by
 * the kernel's own `jumpRule`; the phone's button has its place on the ability arc; a landing that hurts has its words.
 */
import { beforeAll, describe, expect, test } from 'vitest';

import { type Bundle, type State, type Tile, makeWalkable, newState, step } from '@game/kernel';
import type { Facing, GameSession } from '../src/session-surface';
import { jumpTarget } from '../src/walking';
import { describe as eventText } from '../src/text';
import { loadBundle } from '../../tools/test/helpers/world';

let base: Bundle;
beforeAll(() => {
  base = loadBundle();
});

function started(): State {
  const r = step(base, newState(base, 7), { t: 'start', starter: 'core/forager', name: 'Tess' }, 0);
  if (!r.ok) throw new Error(r.error);
  return r.state;
}

function world(ground: string[], levels?: string[]): Bundle {
  const map = { ...base.map, width: ground[0]!.length, height: ground.length, ground, props: [], slots: [], spawn: { x: 0, y: 0 }, ...(levels ? { levels } : {}) };
  if (!levels) delete (map as { levels?: unknown }).levels;
  return { ...base, map, instances: {}, npcs: {}, restores: {}, pockets: {} } as Bundle;
}

/** What the key asks, with the player on `at` facing `facing`. */
function aim(b: Bundle, at: Tile, facing: Facing): Tile | undefined {
  const s: Pick<GameSession, 'pos' | 'tick' | 'state' | 'facing'> = { pos: [at[0], at[1]], tick: 0, state: started(), facing };
  return jumpTarget(b, makeWalkable(b), new Map(), s);
}

describe('the jump key aims', () => {
  test('one tile ahead where a foot can stand, in the way the player faces', () => {
    const b = world(['...', '...', '...']);
    expect(aim(b, [1, 1], 'right')).toEqual([2, 1]);
    expect(aim(b, [1, 1], 'up')).toEqual([1, 0]);
    expect(aim(b, [1, 1], 'left')).toEqual([0, 1]);
    expect(aim(b, [1, 1], 'down')).toEqual([1, 2]);
  });

  test('two tiles across a gap of water, and nothing across two tiles of it or across a tree', () => {
    expect(aim(world(['.~.']), [0, 0], 'right')).toEqual([2, 0]);
    expect(aim(world(['.~~.']), [0, 0], 'right')).toBeUndefined();
    expect(aim(world(['.T.']), [0, 0], 'right')).toBeUndefined();
  });

  test('up one level, down any, never up two; the edge of the map is nothing to land on', () => {
    expect(aim(world(['..'], ['01']), [0, 0], 'right')).toEqual([1, 0]);
    expect(aim(world(['..'], ['02']), [0, 0], 'right')).toBeUndefined();
    expect(aim(world(['..'], ['90']), [0, 0], 'right')).toEqual([1, 0]);
    expect(aim(world(['..']), [1, 0], 'right')).toBeUndefined();
  });
});

describe('a landing that hurts', () => {
  test('says so in the hurt cue\'s own words', () => {
    const text = eventText(base, started(), { e: 'hurt', by: 'fall', hp: 1000 });
    expect(text).toMatchObject({ text: 'You hit the ground hard', tone: 'bad' });
  });
});
