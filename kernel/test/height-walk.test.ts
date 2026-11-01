/**
 * The height layer enters the walk (NEXT 19 c, G68, DECISIONS.md 2026-10-28): a step between levels is refused
 * both ways unless one end is a crossing, a change of more than three levels is never walked, G56's BFS and
 * `step` read the same rule, and an old save walled off by a face is stood on the nearest reachable tile.
 */
import { describe, expect, test } from 'vitest';

import {
  type Bundle,
  type State,
  type Tile,
  KERNEL_VERSION,
  MAX_LEVEL_STEP,
  levelAt,
  makeStepRule,
  newState,
  relocationOf,
  step,
  walkDistance,
} from '@game/kernel';

import { loadBundle } from '../../tools/test/helpers/world.js';

const base: Bundle = loadBundle();

interface Layout {
  width: number;
  height: number;
  levels?: string[];
  crossings?: Tile[];
  slots?: { id: string; kind: 'area'; x: number; y: number; w: number; h: number }[];
}

/** A small flat-ground world of the real content's rules, with the given height layer and crossing props. */
function world({ width, height, levels, crossings = [], slots = [] }: Layout): Bundle {
  const props = crossings.map(([x, y], i) => ({ id: `test/ramp-${i}`, sprite: 'core/base-kit:props/rock', x, y, w: 1, h: 1, solid: false, crossing: true as const }));
  const map = {
    ...base.map,
    width,
    height,
    ground: Array.from({ length: height }, () => '.'.repeat(width)),
    props,
    slots,
    spawn: { x: 0, y: 0 },
    ...(levels ? { levels } : { levels: undefined }),
  };
  if (!levels) delete (map as { levels?: unknown }).levels;
  return { ...base, map, instances: {}, npcs: {}, restores: {}, pockets: {} } as Bundle;
}

/** A started player standing on `at`, a long time after the start so that a hop of any size has had the time. */
function standing(_b: Bundle, at: Tile): State {
  // started on the real content (its pockets), then set down in the small world
  const r = step(base, newState(base, 7), { t: 'start', starter: 'core/forager', name: 'Tess' }, 0);
  if (!r.ok) throw new Error(r.error);
  return { ...r.state, player: { ...r.state.player, at: [at[0], at[1]], movedAt: r.state.tick } };
}

/** A left block of level `a` and a right block of level `b`, a face between x=2 and x=3. */
const split = (a: number, b: number): string[] => Array.from({ length: 5 }, () => `${String(a).repeat(3)}${String(b).repeat(5)}`);

/** A reported hop of the player, checked as the server checks it (`validateTravel`, G56): the path decides. */
const hop = (b: Bundle, from: Tile, to: Tile) => step(b, standing(b, from), { t: 'move', at: to }, b.params.walk_step_ms * 2, { validateTravel: true });

describe('the kernel version', () => {
  test('rose to 0.21.0 with the height rule (0.21.1 since the gaits, 0.22.0 since the dress verb, 0.23.0 since the jackpot pays no extra experience)', () => {
    expect(KERNEL_VERSION).toBe('0.23.0');
  });
});

describe('a tile with no digit, and a map with no layer', () => {
  test('a missing digit or row is level 0, and a flat map answers every step', () => {
    const b = world({ width: 8, height: 5, levels: ['3', '', '0000000'] });
    expect(levelAt(b.map, 0, 0)).toBe(3);
    expect(levelAt(b.map, 5, 0)).toBe(0);
    expect(levelAt(b.map, 0, 1)).toBe(0);
    const flat = world({ width: 8, height: 5 });
    expect(makeStepRule(flat)(0, 0, 1, 0)).toBe(true);
    expect(hop(flat, [2, 2], [3, 2]).ok).toBe(true);
  });
});

describe('a face blocks both ways', () => {
  test('every pair of levels 0 to 9: a step between different levels is refused, in both directions', () => {
    for (let a = 0; a <= 9; a++) {
      for (let c = 0; c <= 9; c++) {
        const b = world({ width: 8, height: 5, levels: split(a, c) });
        const forward = hop(b, [2, 2], [3, 2]);
        const back = hop(b, [3, 2], [2, 2]);
        expect({ a, c, forward: forward.ok, back: back.ok }).toEqual({ a, c, forward: a === c, back: a === c });
        expect(makeStepRule(b)(2, 2, 3, 2)).toBe(a === c);
        expect(makeStepRule(b)(3, 2, 2, 2)).toBe(a === c);
      }
    }
  });

  test('a refused step says it is further than a walk goes, and the local session, which trusts a hop, still lets it through', () => {
    const b = world({ width: 8, height: 5, levels: split(0, 1) });
    expect(hop(b, [2, 2], [3, 2])).toEqual({ ok: false, error: 'That is further than a walk goes in that time.' });
    expect(step(b, standing(b, [2, 2]), { t: 'move', at: [3, 2] }, b.params.walk_step_ms * 2).ok).toBe(true);
  });
});

describe('a crossing opens the way', () => {
  test('on the lower tile it is open going up and going down, for 1 to 3 levels', () => {
    for (let high = 1; high <= MAX_LEVEL_STEP; high++) {
      const b = world({ width: 8, height: 5, levels: split(0, high), crossings: [[2, 2]] });
      expect(hop(b, [2, 2], [3, 2]).ok).toBe(true);
      expect(hop(b, [3, 2], [2, 2]).ok).toBe(true);
      // only the crossing's own tile: its neighbours along the face stay shut
      expect(makeStepRule(b)(2, 1, 3, 1)).toBe(false);
    }
  });

  test('a crossing on the upper tile opens it too, the rule counts either end', () => {
    const b = world({ width: 8, height: 5, levels: split(0, 2), crossings: [[3, 2]] });
    expect(hop(b, [2, 2], [3, 2]).ok).toBe(true);
    expect(hop(b, [3, 2], [2, 2]).ok).toBe(true);
  });

  test('a crossing across no change of level changes nothing, and a ramp covers every tile of its footprint', () => {
    const b = world({ width: 8, height: 5, levels: split(1, 1), crossings: [[2, 2]] });
    expect(hop(b, [2, 2], [3, 2]).ok).toBe(true);
    const wide = world({ width: 8, height: 5, levels: split(0, 1), crossings: [[2, 2]] });
    const props = [{ ...wide.map.props[0]!, y: 1, h: 2 }];
    const tall = { ...wide, map: { ...wide.map, props } } as Bundle;
    expect(hop(tall, [2, 1], [3, 1]).ok).toBe(true);
    expect(hop(tall, [2, 2], [3, 2]).ok).toBe(true);
    expect(makeStepRule(tall)(2, 3, 3, 3)).toBe(false);
  });
});

describe('the band rule', () => {
  test('more than 3 levels is a mountain band: refused through a crossing too, both ways', () => {
    for (const [a, c] of [[0, 4], [0, 9], [2, 6], [5, 9]] as const) {
      const b = world({ width: 8, height: 5, levels: split(a, c), crossings: [[2, 2], [3, 2]] });
      expect(hop(b, [2, 2], [3, 2]).ok).toBe(false);
      expect(hop(b, [3, 2], [2, 2]).ok).toBe(false);
    }
    const edge = world({ width: 8, height: 5, levels: split(3, 6), crossings: [[2, 2]] });
    expect(hop(edge, [2, 2], [3, 2]).ok).toBe(true);
  });
});

describe('the BFS of G56 and step read one rule', () => {
  // x 0-4 at level 0, x 5-9 at level 1; a face between x=4 and x=5, a ramp at (4,4) the only way
  const levels = Array.from({ length: 6 }, () => '0000011111');
  const ramp = world({ width: 10, height: 6, levels, crossings: [[4, 4]] });
  const noRamp = world({ width: 10, height: 6, levels });

  test('with no crossing the far side is out of the BFS and the near hop is refused', () => {
    expect(walkDistance(noRamp, standing(noRamp, [1, 1]), [1, 1], [8, 1], 30)).toBeUndefined();
    expect(hop(noRamp, [4, 1], [5, 1]).ok).toBe(false);
  });

  test('the BFS finds the way round to the ramp, and walking its answer tile by tile is accepted at every step', () => {
    const goal: Tile = [8, 1];
    let state = standing(ramp, [1, 1]);
    const total = walkDistance(ramp, state, state.player.at, goal, 30);
    // 6 steps to the ramp at (4,4), 1 across the face to (5,4), 6 on to (8,1)
    expect(total).toBe(13);
    let tick = state.tick;
    for (let left = total!; left > 0; left--) {
      const here = state.player.at as Tile;
      const next = ([[0, -1], [1, 0], [0, 1], [-1, 0]] as const)
        .map(([dx, dy]) => [here[0] + dx, here[1] + dy] as Tile)
        .find((t) => walkDistance(ramp, state, t, goal, 30) === left - 1)!;
      tick += ramp.params.walk_step_ms;
      const r = step(ramp, state, { t: 'move', at: next }, tick, { validateTravel: true });
      expect(r.ok, `step ${total! - left + 1} to ${next}`).toBe(true);
      if (r.ok) state = r.state;
    }
    expect(state.player.at).toEqual(goal);
  });
});

describe('an old save walled off by the height layer', () => {
  // a plateau of level 2 on x 6-9, y 0-2, no crossing; the rest at 0; the spawn at (0,0)
  const levels = Array.from({ length: 6 }, (_, y) => (y <= 2 ? '000000' + '2222' : '0'.repeat(10)));

  test('is stood on the nearest tile a foot can reach, and nothing else changes', () => {
    const b = world({ width: 10, height: 6, levels });
    const s = standing(b, [7, 1]);
    s.player.bag = { 'core/berry': 3 };
    s.player.hp = 12_345;
    const to = relocationOf(b, s);
    expect(to).toEqual([5, 1]);
    // applied the way the session does: only the tile differs
    const moved = { ...s, player: { ...s.player, at: to! } };
    expect({ ...moved, player: { ...moved.player, at: s.player.at } }).toEqual(s);
    expect(moved.player.bag).toEqual({ 'core/berry': 3 });
    expect(moved.player.hp).toBe(12_345);
    expect(moved.tick).toBe(s.tick);
  });

  test('is the same tile on every call, a tie going to the smaller row then the smaller column', () => {
    const b = world({ width: 10, height: 6, levels });
    const s = standing(b, [8, 1]);
    expect(relocationOf(b, s)).toEqual(relocationOf(b, structuredClone(s)));
    // from (8,1) the plateau's edge (5,1) is 3 away and the row below it, (8,3), 2: nearest wins
    expect(relocationOf(b, s)).toEqual([8, 3]);
  });

  test('prefers a tile of the slot the player stood in, even when one outside lies as near', () => {
    const slots = [{ id: 'test/yard', kind: 'area' as const, x: 6, y: 0, w: 4, h: 5 }];
    const b = world({ width: 10, height: 6, levels, slots });
    // the slot holds the plateau and level-0 rows 3 and 4; (5,1) outside is 2 away as is (7,3), which wins by slot
    expect(relocationOf(b, standing(b, [7, 1]))).toEqual([7, 3]);
  });

  test('moves no one who is already on reachable ground, or on a map with no layer', () => {
    const b = world({ width: 10, height: 6, levels });
    expect(relocationOf(b, standing(b, [2, 2]))).toBeUndefined();
    expect(relocationOf(world({ width: 10, height: 6 }), standing(world({ width: 10, height: 6 }), [7, 1]))).toBeUndefined();
  });

  test('a crossing onto the plateau makes it reachable and the save stays where it is', () => {
    const b = world({ width: 10, height: 6, levels: Array.from({ length: 6 }, (_, y) => (y <= 2 ? '000000' + '1111' : '0'.repeat(10))), crossings: [[5, 1]] });
    expect(relocationOf(b, standing(b, [7, 1]))).toBeUndefined();
  });
});
