import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';

import type { Bundle } from '@game/kernel';
import { Session } from '../src/session';
import { STRIDE, SWING_MS, WIND_UP, beatAt, blowsDue, nextUnit, resourceKind, strideFrame, swingsFor, treasureKind, type WorkHands } from '../src/work';
import { loadBundle } from '../../tools/test/helpers/world';

describe('which animation a work plays', () => {
  test('a tool names it: the axe fells, the trowel digs, the pick mines, the rod fishes', () => {
    expect(resourceKind({ tool: 'axe' })).toBe('fell');
    expect(resourceKind({ tool: 'pick' })).toBe('mine');
    expect(resourceKind({ tool: 'rod' })).toBe('fish');
    expect(treasureKind({ tool: 'trowel' })).toBe('dig');
  });

  test('herbs and finds by hand are picked: every work has an animation, none has a timing cue', () => {
    expect(resourceKind({})).toBe('pick');
    expect(resourceKind({ tool: 'basket' })).toBe('pick');
    expect(treasureKind({})).toBe('pick');
  });

  test('in the core content: the oaks and logs are felled, the stones are struck, the herbs are picked', () => {
    const b = loadBundle();
    expect(resourceKind(b.resources['core/oak-trees']!)).toBe('fell');
    expect(resourceKind(b.resources['core/fallen-logs']!)).toBe('fell');
    expect(resourceKind(b.resources['core/keystone']!)).toBe('pick');
    // stone is mined: it works with no tool (DECISIONS.md, 2026-10-25)
    expect(resourceKind(b.resources['core/river-stones']!)).toBe('mine');
    expect(resourceKind({ work: 'mine', tool: undefined })).toBe('mine');
    expect(resourceKind(b.resources['core/wild-herbs']!)).toBe('pick');
    expect(treasureKind(b.treasures['core/ruins-gate']!)).toBe('dig');
    expect(treasureKind(b.treasures['core/bridge-glint']!)).toBe('pick');
  });
});

describe('the work that runs on by itself (QUARRYING 10)', () => {
  /** A node of `stock` units: each act takes one and reports its time, as the kernel does. */
  function node(stock: number, over: Partial<{ error: string; events: string[] }> = {}): WorkHands & { taken: number; acts: number } {
    const hands = {
      taken: 0,
      acts: 0,
      ready: () => hands.taken < stock,
      act: (): ReturnType<WorkHands['act']> => {
        hands.acts += 1;
        if (over.error !== undefined) return { ok: false, error: over.error };
        hands.taken += 1;
        return { ok: true, events: [{ e: 'busy', ms: 900 }, ...(over.events ?? []).map((e) => ({ e }))] } as never;
      },
    };
    return hands;
  }
  const action = { t: 'gather', node: 'n', at: [0, 0] } as const;

  test('with no input it asks for the next unit again and again until the thing runs out, and every unit stays', async () => {
    const hands = node(3);
    const log: string[] = [];
    for (;;) {
      const next = await nextUnit(hands, action, false);
      log.push(next.kind);
      if (next.kind !== 'go') break;
      expect(next.ms).toBe(900);
    }
    expect(log).toEqual(['go', 'go', 'go', 'out']);
    expect(hands.taken).toBe(3);
  });

  test('the player leaving stops it before the next unit, and what was taken stays taken', async () => {
    const hands = node(3);
    expect((await nextUnit(hands, action, false)).kind).toBe('go');
    expect((await nextUnit(hands, action, true)).kind).toBe('left');
    expect(hands.taken).toBe(1);
    expect(hands.acts).toBe(1);
  });

  test('a full bag, a level or the hour stops it with the kernel\'s words', async () => {
    expect(await nextUnit(node(3, { error: 'Your bag is full.' }), action, false)).toEqual({ kind: 'stopped', error: 'Your bag is full.' });
  });

  test('danger stops it: a bite, a fall, a predator that sees you', async () => {
    for (const e of ['hurt', 'fall', 'seen']) {
      const hands = node(3, { events: [e] });
      expect(await nextUnit(hands, action, false)).toEqual({ kind: 'stopped' });
      // the unit that was taken before the danger is still taken
      expect(hands.taken).toBe(1);
    }
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

  test('a unit is taken at once and stays: the next unit is asked for when it has ended, and nothing is taken back', () => {
    const { s, node, at } = fellingSession();
    const logs = s.state.player.bag['core/log'] ?? 0;
    const res = s.act({ t: 'gather', node, at });
    expect(res.ok).toBe(true);
    expect(s.busy).toBe(true);
    // one log a unit, not the whole tree
    expect(s.state.player.bag['core/log']).toBe(logs + 1);
    expect(s.state.nodes[node]!.taken).toBe(1);
    // the player stops: the log taken is theirs, and the tree keeps the rest of its stock
    s.report(at, false);
    for (let i = 0; i < 20; i++) s.advance(250);
    expect(s.busy).toBe(false);
    expect(s.state.player.bag['core/log']).toBe(logs + 1);
    expect(s.state.nodes[node]!.taken).toBe(1);
    // and the work goes on from where it stood
    expect(s.check({ t: 'gather', node, at })).toBeUndefined();
  });

  test('worked to its end the tree gives its whole yield and grows back after its own time', () => {
    const { s, node, at } = fellingSession();
    const logs = s.state.player.bag['core/log'] ?? 0;
    const yieldOf = bundle.resources['core/oak-trees']!.yield;
    for (let i = 0; i < yieldOf; i++) {
      expect(s.act({ t: 'gather', node, at })).toMatchObject({ ok: true });
      for (let k = 0; k < 40; k++) s.advance(250);
    }
    expect(s.state.player.bag['core/log']).toBe(logs + yieldOf);
    expect(s.state.nodes[node]!.taken).toBeUndefined();
    expect(s.state.nodes[node]!.readyAt).toBeGreaterThan(s.tick);
  });

  test('a hunt heard during the work does not take back what was taken', () => {
    const { s, node, at } = fellingSession();
    const logs = s.state.player.bag['core/log'] ?? 0;
    s.act({ t: 'gather', node, at });
    s.report(at, true);
    expect(s.busy).toBe(true);
    expect(s.state.player.bag['core/log']).toBe(logs + 1);
  });
});

describe('blows', () => {
  test('every swing blows once even when frames skip over its down-phase', () => {
    const ms = 3000;
    const { count } = swingsFor(ms);
    // a 250 ms frame cap samples only the starts of the swings' wind-ups
    let hits = 0;
    for (let t = 0; t <= ms; t += 250) hits = Math.max(hits, blowsDue(beatAt(t, ms)));
    expect(hits).toBeGreaterThanOrEqual(count - 1);
    // a smooth run lands exactly as many blows as swings by the end
    let smooth = 0;
    for (let t = 0; t <= ms; t += 16) smooth = Math.max(smooth, blowsDue(beatAt(t, ms)));
    expect(smooth).toBe(count);
  });
});
