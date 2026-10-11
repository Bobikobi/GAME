import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';

import type { Bundle } from '@game/kernel';
import { Session } from '../src/session';
import { STRIDE, SWING_MS, WIND_UP, autoKind, beatAt, resourceKind, strideFrame, swingsFor, treasureKind } from '../src/work';
import { loadBundle } from '../../tools/test/helpers/world';

describe('which work runs by itself', () => {
  test('a tool makes it so: the axe fells, the trowel digs, the pick mines', () => {
    expect(autoKind('axe')).toBe('fell');
    expect(autoKind('trowel')).toBe('dig');
    expect(autoKind('pick')).toBe('mine');
  });

  test('herbs, stones and finds by hand keep their own way', () => {
    expect(autoKind(undefined)).toBeUndefined();
    expect(autoKind('basket')).toBeUndefined();
  });

  test('in the core content: the oaks and logs are felled, the stones are struck, the herbs are picked', () => {
    const b = loadBundle();
    expect(resourceKind(b.resources['core/oak-trees']!)).toBe('fell');
    expect(resourceKind(b.resources['core/fallen-logs']!)).toBe('fell');
    expect(resourceKind(b.resources['core/keystone']!)).toBeUndefined();
    expect(resourceKind(b.resources['core/river-stones']!)).toBeUndefined();
    expect(resourceKind(b.resources['core/wild-herbs']!)).toBeUndefined();
    expect(treasureKind(b.treasures['core/ruins-gate']!)).toBe('dig');
    expect(treasureKind(b.treasures['core/bridge-glint']!)).toBeUndefined();
  });
});

describe('the rhythm of the swings', () => {
  test('a work is a whole number of equal swings that fills its time', () => {
    for (const ms of [1000, 2000, 3000, 5000, 7000]) {
      const { count, period } = swingsFor(ms);
      expect(Number.isInteger(count)).toBe(true);
      expect(count * period).toBeCloseTo(ms, 6);
      expect(Math.abs(period - SWING_MS)).toBeLessThan(SWING_MS * 0.5);
    }
    expect(swingsFor(3000).count).toBe(6);
    expect(swingsFor(100).count).toBe(2);
  });

  test('the arm is up for the wind-up and down for the blow, swing after swing', () => {
    const ms = 3000;
    const { period } = swingsFor(ms);
    expect(beatAt(0, ms)).toMatchObject({ index: 0, down: false, progress: 0 });
    expect(beatAt(period * (WIND_UP - 0.01), ms).down).toBe(false);
    expect(beatAt(period * (WIND_UP + 0.01), ms).down).toBe(true);
    expect(beatAt(period * 1.1, ms)).toMatchObject({ index: 1, down: false });
    expect(beatAt(ms, ms)).toMatchObject({ index: 5, progress: 1 });
    expect(beatAt(ms * 2, ms).progress).toBe(1);
  });

  test('every swing lands exactly one blow before the work ends', () => {
    const ms = 3000;
    const blows = new Set<number>();
    for (let t = 0; t <= ms; t += 16) {
      const beat = beatAt(t, ms);
      if (beat.down) blows.add(beat.index);
    }
    expect([...blows]).toHaveLength(swingsFor(ms).count);
  });
});

describe('the walk cycle', () => {
  test('a leg shows for most of a step and the feet are together as it lands', () => {
    expect(strideFrame(0, 0, 3)).toBe(0);
    expect(strideFrame(STRIDE - 0.01, 0, 3)).toBe(0);
    expect(strideFrame(STRIDE, 0, 3)).toBe(1);
    expect(strideFrame(1, 0, 3)).toBe(1);
  });

  test('the other leg leads on the next step', () => {
    expect(strideFrame(0.2, 1, 3)).toBe(2);
    expect(strideFrame(0.2, 2, 3)).toBe(0);
  });

  test('a sheet with fewer than three frames shows its first', () => {
    expect(strideFrame(0.2, 1, 2)).toBe(0);
    expect(strideFrame(0.2, 1, 1)).toBe(0);
  });
});

describe('walking away from work', () => {
  let bundle: Bundle;
  beforeAll(() => {
    bundle = loadBundle();
  });
  beforeEach(() => {
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => values.get(k) ?? null,
      setItem: (k: string, v: string) => void values.set(k, v),
      removeItem: (k: string) => void values.delete(k),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  function fellingSession(): { s: Session; node: string; at: [number, number] } {
    const s = Session.fresh(bundle);
    expect(s.act({ t: 'start', starter: 'core/forager', name: 'Tester' }).ok).toBe(true);
    const node = Object.entries(bundle.instances).find(([, i]) => i.kind === 'resource' && i.source === 'core/oak-trees')!;
    const at: [number, number] = [node[1].x, node[1].y + 1];
    s.pos = at;
    s.state.player.at = at;
    s.advance(250);
    return { s, node: node[0], at };
  }

  test('the action stands while the work lasts, and taking it back leaves nothing behind', () => {
    const { s, node, at } = fellingSession();
    const logs = s.state.player.bag['core/log'] ?? 0;
    const before = JSON.stringify(s.state);
    const res = s.act({ t: 'gather', node, grade: 3, at });
    expect(res.ok).toBe(true);
    expect(s.busy).toBe(true);
    expect(s.state.player.bag['core/log']).toBe(logs + 3);
    expect(s.state.nodes[node]!.readyAt).toBeGreaterThan(s.tick);

    expect(s.cancelWork()).toBe(true);
    expect(s.busy).toBe(false);
    expect(JSON.stringify(s.state)).toBe(before);
    expect(s.state.player.bag['core/log'] ?? 0).toBe(logs);
    expect(s.tail.some((e) => e.a.t === 'gather')).toBe(false);
    // the tree can be felled again at once
    expect(s.check({ t: 'gather', node, grade: 3, at })).toBeUndefined();
  });

  test('once the work has run its time there is nothing to take back', () => {
    const { s, node, at } = fellingSession();
    s.act({ t: 'gather', node, grade: 3, at });
    s.advance(250);
    for (let i = 0; i < 20; i++) s.advance(250);
    expect(s.busy).toBe(false);
    expect(s.cancelWork()).toBe(false);
    expect(s.state.player.bag['core/log']).toBeGreaterThanOrEqual(3);
  });
});
