/**
 * A save keeps its place when the authored ground moves inside a larger map (EXPERIENCE_AUDIT.md gap M5, DECISIONS.md
 * 2026-10-31 "The server brings a stored state to new content"): the map declares its `frame` and `moved`, and
 * `adaptState` shifts a state of the frame before, once, ahead of the reach check.
 */
import { describe, expect, test } from 'vitest';

import { adaptState, newState, step, type Bundle, type State, type Tile } from '../src';
import { loadBundle } from '../../tools/test/helpers/world.js';

const base: Bundle = loadBundle();

const SIZE = 40;
const MOVED = { dx: 6, dy: 8 };

/**
 * A flat 40 by 40 world of the real content's rules with a mountain block (level 7, x10-16, y15-19) that no foot
 * crosses: the old block of the map, as the mountain ring of the larger map lies over where the valley was.
 */
function world(frame?: number): Bundle {
  const levels = Array.from({ length: SIZE }, (_, y) =>
    Array.from({ length: SIZE }, (_, x) => (x >= 10 && x <= 16 && y >= 15 && y <= 19 ? '7' : '0')).join(''),
  );
  const map = {
    ...base.map,
    width: SIZE,
    height: SIZE,
    ground: Array.from({ length: SIZE }, () => '.'.repeat(SIZE)),
    levels,
    props: [],
    slots: [],
    spawn: { x: 0, y: 0 },
    ...(frame ? { frame, moved: MOVED } : {}),
  };
  return { ...base, map, instances: {}, npcs: {}, restores: {}, pockets: {}, tag: `frame-${frame ?? 1}` } as Bundle;
}

/** A started player of frame 1 (no `frame` field, as every save so far) standing on `at`. */
function saveAt(at: Tile): State {
  const r = step(base, newState(base, 7), { t: 'start', starter: 'core/forager', name: 'Tess' }, 0);
  if (!r.ok) throw new Error(r.error);
  const saved = structuredClone(r.state);
  saved.player.at = [at[0], at[1]];
  saved.content = 'the-map-before-the-move';
  return saved;
}

describe('adaptState across a moved block', () => {
  test('a save on the bridge of today wakes on the bridge after the move', () => {
    const adapted = adaptState(world(2), saveAt([13, 17]))!;
    expect(adapted.player.at).toEqual([13 + MOVED.dx, 17 + MOVED.dy]);
    expect(adapted.frame).toBe(2);
    // without the offset the same tile is inside the mountain and the reach check drops the character beside it
    const unshifted = adaptState({ ...world(2), map: { ...world(2).map, moved: { dx: 0, dy: 0 } } }, saveAt([13, 17]))!;
    expect(unshifted.player.at).not.toEqual([13, 17]);
  });

  test('a tile unreachable after the offset still falls to the nearest reachable one', () => {
    // (4, 8) moves to (10, 16), the mountain's west edge: the nearest foot-reachable tile is (9, 16)
    const adapted = adaptState(world(2), saveAt([4, 8]))!;
    expect(adapted.player.at).toEqual([9, 16]);
  });

  test('the offset is added once: a later change of content leaves a state of the new frame where it stands', () => {
    const once = adaptState(world(2), saveAt([13, 17]))!;
    const later = { ...world(2), tag: 'frame-2-and-more' } as Bundle;
    expect(adaptState(later, once)!.player.at).toEqual(once.player.at);
  });

  test('a new game on the new map is not shifted, and a save of frame 1 on a frame 1 map is not either', () => {
    const fresh = newState(world(2), 3);
    expect(fresh.frame).toBe(2);
    const adapted = adaptState(world(2), { ...fresh, content: 'older' })!;
    expect(adapted.player.at).toEqual(fresh.player.at);
    const plain = adaptState(world(), saveAt([13, 17]))!;
    expect(plain.frame).toBeUndefined();
  });

  test('the tiles a state keeps move with the player: the kindled fire, a carcass, what lies dropped', () => {
    const saved = saveAt([1, 1]);
    saved.player.own = { at: [2, 3], lit: 0, until: 1, log: 1 };
    saved.player.carcasses = [{ id: 1, kind: 'core/roe', at: [4, 5], grade: 1, since: 0 }];
    saved.player.ground = { '6,7': { 'core/berry': 2 } };
    const p = adaptState(world(2), saved)!.player;
    expect(p.own!.at).toEqual([8, 11]);
    expect(p.carcasses![0]!.at).toEqual([10, 13]);
    expect(p.ground).toEqual({ '12,15': { 'core/berry': 2 } });
  });

  test('is pure: the saved state is left as it was', () => {
    const saved = saveAt([13, 17]);
    const before = JSON.stringify(saved);
    adaptState(world(2), saved);
    expect(JSON.stringify(saved)).toBe(before);
  });
});
