/**
 * The tools' walk reads the kernel's step rule (NEXT 19 c, G68): the difficulty reckoning's `walkFrom` gives the
 * distance `walkDistance` gives, across a rock face and a ramp, and no distance where the face has no crossing.
 */
import { describe, expect, it } from 'vitest';
import { type Bundle, type Tile, newState, step, walkDistance } from '@game/kernel';
import { walkFrom } from '../src/balance/reckon';
import { walkBitmap } from '../src/reach';
import { loadBundle } from './helpers/world';

const base = loadBundle();

/** x 0-4 at level 0, x 5-9 at level 1: a face between x=4 and x=5, and a ramp at (4,4) when asked. */
function world(ramp: boolean): Bundle {
  const props = ramp ? [{ id: 'test/ramp', sprite: 'core/base-kit:props/rock', x: 4, y: 4, w: 1, h: 1, solid: false, crossing: true as const }] : [];
  const map = {
    ...base.map,
    width: 10,
    height: 6,
    ground: Array.from({ length: 6 }, () => '.'.repeat(10)),
    levels: Array.from({ length: 6 }, () => '0000011111'),
    props,
    slots: [],
    spawn: { x: 0, y: 0 },
  };
  return { ...base, map, instances: {}, npcs: {}, restores: {}, pockets: {} } as Bundle;
}

describe('the tools walk across the height layer as the kernel does', () => {
  it('has no way across a face without a crossing', () => {
    const b = world(false);
    const dist = walkFrom(b, walkBitmap(b), [1, 1]);
    expect(dist[1 * 10 + 4]).toBe(3);
    expect(dist[1 * 10 + 5]).toBe(-1);
    expect(dist[1 * 10 + 8]).toBe(-1);
  });

  it('goes round by the ramp, and every distance equals the kernel\'s walkDistance', () => {
    const b = world(true);
    const started = step(base, newState(base, 3), { t: 'start', starter: 'core/forager', name: 'Tess' }, 0);
    if (!started.ok) throw new Error(started.error);
    const state = started.state;
    const dist = walkFrom(b, walkBitmap(b), [1, 1]);
    expect(dist[1 * 10 + 8]).toBe(13);
    for (let y = 0; y < 6; y++) {
      for (let x = 0; x < 10; x++) {
        const target: Tile = [x, y];
        expect(walkDistance(b, state, [1, 1], target, 40), `to ${target}`).toBe(dist[y * 10 + x]! >= 0 ? dist[y * 10 + x] : undefined);
      }
    }
  });
});
