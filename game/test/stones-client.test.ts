/**
 * The client's loose stones (DECISIONS 2026-11-22, #831): the throw's aim by the drawn facing, a pile's pictures by its count, and the
 * motion of a thrown stone, which is never flat. Pure numbers: no renderer.
 */
import { beforeAll, describe, expect, test } from 'vitest';

import { type Bundle, type State, type Tile, newState, step, throwFlight } from '@game/kernel';
import type { Facing, GameSession } from '../src/session-surface';
import { THROW_AIM_TILES, type Facing8, throwAim } from '../src/walking';
import { HEAP_SCALE, SMALL_STONE_SCALE, STONE_SCALE, drawnCount, pileLayout, pileLook, stoneMotion } from '../src/stone-art';
import { loadBundle } from '../../tools/test/helpers/world';

let base: Bundle;
beforeAll(() => {
  base = loadBundle();
});

/** A started player standing on `at`. */
function standing(at: Tile): State {
  const r = step(base, newState(base, 7), { t: 'start', starter: 'core/forager', name: 'Tess' }, 0);
  if (!r.ok) throw new Error(r.error);
  return { ...r.state, player: { ...r.state.player, at: [at[0], at[1]] } };
}

function aim(at: Tile, facing: Facing, look?: Facing8): Tile | undefined {
  const s: Pick<GameSession, 'pos' | 'facing'> = { pos: [at[0], at[1]], facing };
  return throwAim(base, s, look);
}

describe('the throw aims where the figure faces', () => {
  test('along an axis, out to the aim distance', () => {
    expect(aim([20, 20], 'right')).toEqual([20 + THROW_AIM_TILES, 20]);
    expect(aim([20, 20], 'up')).toEqual([20, 20 - THROW_AIM_TILES]);
    expect(aim([20, 20], 'left')).toEqual([20 - THROW_AIM_TILES, 20]);
    expect(aim([20, 20], 'down')).toEqual([20, 20 + THROW_AIM_TILES]);
  });

  test('along a diagonal when the figure is drawn facing one', () => {
    expect(aim([20, 20], 'right', 'down_right')).toEqual([20 + THROW_AIM_TILES, 20 + THROW_AIM_TILES]);
    expect(aim([20, 20], 'left', 'up_left')).toEqual([20 - THROW_AIM_TILES, 20 - THROW_AIM_TILES]);
  });

  test('stops at the map\'s edge, and is nothing at all facing out from it', () => {
    expect(aim([base.map.width - 3, 10], 'right')).toEqual([base.map.width - 1, 10]);
    expect(aim([0, 10], 'left')).toBeUndefined();
    expect(aim([10, 0], 'up')).toBeUndefined();
  });

  test('the kernel takes every aim the client makes (a real throw from open ground in each of the eight ways)', () => {
    const state = standing([20, 20]);
    const looks: Facing8[] = ['up', 'down', 'left', 'right', 'up_left', 'up_right', 'down_left', 'down_right'];
    for (const look of looks) {
      const to = aim([20, 20], 'down', look)!;
      const f = throwFlight(base, state, 'small', to);
      expect('error' in f ? f.error : '').toBe('');
    }
  });
});

describe('a pile shows by its count', () => {
  test('a lone stone, two or three, and a heap of four or more are three looks', () => {
    expect(pileLook(0)).toBe('none');
    expect(pileLook(1)).toBe('one');
    expect(pileLook(2)).toBe('few');
    expect(pileLook(3)).toBe('few');
    expect(pileLook(4)).toBe('heap');
    expect(pileLook(9)).toBe('heap');
  });

  test('the pictures drawn: the count up to three, one rubble heap for four or more small stones, five when a large stone lies among them', () => {
    expect([0, 1, 2, 3, 4, 5, 8].map((n) => drawnCount(n))).toEqual([0, 1, 2, 3, 1, 1, 1]);
    expect([4, 5, 8].map((n) => drawnCount(n, 1))).toEqual([5, 5, 5]);
    for (const n of [0, 1, 2, 3, 4, 7]) expect(pileLayout(n).length).toBe(drawnCount(n));
    for (const n of [4, 7]) expect(pileLayout(n, 1).length).toBe(drawnCount(n, 1));
  });

  test('the pictures by kind: a small stone is its own drawing, a large one the item picture, four small ones the rubble heap', () => {
    expect(pileLayout(1, 0).map((s) => s.picture)).toEqual(['small']);
    expect(pileLayout(1, 1).map((s) => s.picture)).toEqual(['large']);
    expect(pileLayout(3, 0).map((s) => s.picture)).toEqual(['small', 'small', 'small']);
    expect(pileLayout(6, 0)).toEqual([{ dx: 0, dy: 0, size: 'small', scale: HEAP_SCALE, picture: 'heap' }]);
    expect(pileLayout(4, 1).filter((s) => s.picture === 'large')).toHaveLength(1);
    expect(pileLayout(4, 1).filter((s) => s.picture === 'heap')).toHaveLength(0);
  });

  test('no two pictures of a pile stand on one spot, and all stay inside the tile', () => {
    for (const n of [2, 3, 4]) {
      const slots = pileLayout(n);
      const spots = new Set(slots.map((s) => `${s.dx},${s.dy}`));
      expect(spots.size).toBe(slots.length);
      for (const s of slots) {
        expect(Math.abs(s.dx)).toBeLessThanOrEqual(0.4);
        expect(s.dy).toBeGreaterThanOrEqual(0);
        expect(s.dy).toBeLessThanOrEqual(0.4);
      }
    }
  });

  test('a large stone is drawn larger than a small one: about 60 x 50 art pixels against about 28 x 24', () => {
    // the small drawing is 28 x 24 at its own size; the item picture is 60 x 49 and shows at 70 percent (#874): 42 px against 28, the large one 1.4 times and more
    expect(60 * STONE_SCALE.large).toBeGreaterThanOrEqual(28 * SMALL_STONE_SCALE * 1.4);
    expect(pileLayout(1, 1)[0]).toMatchObject({ size: 'large', scale: STONE_SCALE.large });
    expect(pileLayout(1, 0)[0]).toMatchObject({ size: 'small', scale: SMALL_STONE_SCALE });
    const mixed = pileLayout(3, 1);
    expect(mixed.filter((s) => s.size === 'large')).toHaveLength(1);
    // drawn widths, the large picture being 60 art pixels wide and the small one 28
    const large = mixed.find((s) => s.size === 'large')!;
    const small = mixed.find((s) => s.size === 'small')!;
    expect(60 * large.scale).toBeGreaterThan(28 * small.scale);
  });
});

describe('a thrown stone is never flat', () => {
  const MS = 700;
  const run = (size: 'small' | 'large', from: Tile, touch: Tile, at: Tile | null) => stoneMotion({ size, from, touch, at, ms: MS });
  const samples = (m: ReturnType<typeof stoneMotion>, n = 200) => Array.from({ length: n + 1 }, (_, i) => m.at((m.ms * i) / n));

  test('leaves the hand above the ground at the thrower, comes down at the touch, and stops at its rest', () => {
    const m = run('small', [5, 5], [8, 5], [10, 5]);
    const start = m.at(0);
    expect(start.x).toBeCloseTo(5.5);
    expect(start.y).toBeCloseTo(5.5);
    expect(start.lift).toBeGreaterThan(0.3);
    const touch = m.at(m.touchMs);
    expect(touch.x).toBeCloseTo(8.5);
    expect(touch.lift).toBeCloseTo(0);
    expect(touch.touched).toBe(true);
    const end = m.at(MS);
    expect(end.x).toBeCloseTo(10.5);
    expect(end.y).toBeCloseTo(5.5);
    expect(end.lift).toBe(0);
    expect(end.done).toBe(true);
    expect(m.at(MS - 1).done).toBe(false);
  });

  test('rises on an arc in the air, never goes under the ground, and bounces after the touch', () => {
    for (const size of ['small', 'large'] as const) {
      const m = run(size, [5, 5], [8, 5], [9, 5]);
      const all = samples(m);
      expect(Math.min(...all.map((p) => p.lift))).toBeGreaterThanOrEqual(0);
      const air = all.filter((p) => !p.touched);
      expect(Math.max(...air.map((p) => p.lift))).toBeGreaterThan(0.5);
      // after the touch the stone leaves the ground again, twice, with a gap of ground between: bounces, then it slides
      const landing = all.filter((p) => p.touched);
      const bounced = [1, 2].map((phase) => Math.max(...landing.filter((p) => p.phase === phase).map((p) => p.lift)));
      expect(bounced[0]).toBeGreaterThan(0.05);
      expect(bounced[1]).toBeGreaterThan(0.01);
      expect(bounced[0]).toBeGreaterThan(bounced[1]!);
      expect(landing.filter((p) => p.phase === 3).every((p) => p.lift === 0)).toBe(true);
    }
  });

  test('a stone that rests where it touched still bounces in place', () => {
    const m = run('small', [5, 5], [8, 5], [8, 5]);
    const landing = samples(m).filter((p) => p.touched);
    expect(Math.max(...landing.map((p) => p.lift))).toBeGreaterThan(0.05);
    expect(new Set(landing.map((p) => p.x.toFixed(3))).size).toBe(1);
  });

  test('a small stone hops higher than a large one, which thuds and slides', () => {
    const small = Math.max(...samples(run('small', [5, 5], [8, 5], [10, 5])).filter((p) => p.touched).map((p) => p.lift));
    const large = Math.max(...samples(run('large', [5, 5], [7, 5], [8, 5])).filter((p) => p.touched).map((p) => p.lift));
    expect(small).toBeGreaterThan(large * 1.5);
  });

  test('slides on along the line, forward only, and slows as it goes', () => {
    const m = run('small', [5, 5], [8, 5], [10, 5]);
    const slide = samples(m, 300).filter((p) => p.touched);
    for (let i = 1; i < slide.length; i++) expect(slide[i]!.x).toBeGreaterThanOrEqual(slide[i - 1]!.x - 1e-9);
    const first = slide[1]!.x - slide[0]!.x;
    const last = slide[slide.length - 1]!.x - slide[slide.length - 2]!.x;
    expect(first).toBeGreaterThan(last);
    expect(slide.every((p) => Math.abs(p.y - 5.5) < 1e-9)).toBe(true);
  });

  test('turns as it goes: a small stone tumbles more than a large one', () => {
    const turn = (size: 'small' | 'large') => run(size, [5, 5], [8, 5], [10, 5]).at(MS).spin;
    expect(turn('small')).toBeGreaterThan(turn('large'));
    expect(turn('large')).toBeGreaterThan(0);
  });

  test('a stone that sinks goes under at the touch: fainter and smaller, and comes to rest nowhere', () => {
    const m = run('small', [5, 5], [8, 5], null);
    const end = m.at(MS);
    expect(end.alpha).toBeCloseTo(0);
    expect(end.shrink).toBeLessThan(1);
    expect(end.done).toBe(true);
    expect(end.x).toBeCloseTo(8.5);
    expect(m.at(m.touchMs).alpha).toBe(1);
  });

  test('is fixed by the throw: the same throw is the same motion every time, on every client', () => {
    const a = samples(run('small', [5, 5], [8, 6], [9, 6]));
    const b = samples(run('small', [5, 5], [8, 6], [9, 6]));
    expect(a).toEqual(b);
  });

  test('a throw as the kernel flies it plays through: from its tiles to the rest it names', () => {
    const state = standing([20, 20]);
    const f = throwFlight(base, state, 'small', [28, 20]);
    if ('error' in f) throw new Error(f.error);
    const m = stoneMotion({ size: 'small', from: f.from, touch: f.touch, at: f.rest ?? null, ms: base.params.stones.throw_ms });
    expect(m.at(0).x).toBeCloseTo(20.5);
    expect(m.at(m.ms).x).toBeCloseTo((f.rest ?? f.touch)[0] + 0.5);
  });
});
