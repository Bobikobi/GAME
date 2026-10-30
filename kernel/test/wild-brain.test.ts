/** The wild brain (HUNTING 2 and 3): the noticing count and the ten states, one think step at a time. */
import { describe, expect, test } from 'vitest';

import { settle, stepsToMove, think, threshold, tierState } from '../src/wild/brain';
import { type Creature, type WildView, THINK_MS, awake } from '../src/wild/types';
import { BOAR, HARE, NOISE, ROE, WOLF, creature, field, grid, lcg, player, view } from './wild-fixtures';

const OPEN = grid(field(41));
/** A hare that runs on the ground, so a flight is not cut short by its burrow under its feet. */
const RUNNER = { ...HARE, flight: 'ground' as const };
const HOME: [number, number] = [20, 20];

function hare(over: Partial<Creature> = {}): Creature {
  return creature({ at: [20, 20], anchor: 'core/hare@20,20', ...over });
}

function at(over: Partial<WildView> = {}): WildView {
  return view(OPEN, { anchorAt: HOME, ...over });
}

describe('the noticing count', () => {
  test('threshold by distance', () => {
    expect(threshold(36, 6)).toBe(3);
    expect(threshold(10, 6)).toBe(3);
    expect(threshold(9, 6)).toBe(2);
    expect(threshold(5, 6)).toBe(2);
    expect(threshold(4, 6)).toBe(1);
    expect(threshold(0, 6)).toBe(1);
  });

  test('head-down mover is never noticed in the outer half', () => {
    // a hare that only grazes, a player at d2 29 in front (outer half of 6): sneaks while the head is
    // down, stands still while it is up. The head-up beat is 2 steps and the outer half needs 3.
    const grazer = { ...HARE, weights: { idle: 0, graze: 100, wander: 0 } };
    const run = (gaitDown: number) => {
      const c = hare({ state: 'GRAZE', up: 0, left: 5, beats: 3 });
      let spot = 0;
      const spots = [
        [25, 22],
        [25, 18],
      ] as const;
      for (let i = 0; i < 200; i++) {
        const down = c.state === 'GRAZE' && !c.up;
        if (down) spot = 1 - spot;
        const out = think(grazer, c, at({ tick: i * THINK_MS, player: player(spots[spot]!, down ? gaitDown : NOISE.still) }));
        if (out.events.some((e) => e.e === 'alert')) return i;
        expect(c.count).toBeLessThan(3);
      }
      return -1;
    };
    expect(run(NOISE.sneak)).toBe(-1);
    // the same dance at a walk is heard (5 + 2 = 7 tiles) and the count runs on
    expect(run(NOISE.walk)).toBeGreaterThanOrEqual(0);
  });

  test('a blank step resets the count', () => {
    const c = hare({ left: 100 });
    const seen = at({ player: player([25, 22], NOISE.still) });
    think(HARE, c, seen);
    think(HARE, c, seen);
    expect(c.count).toBe(2);
    think(HARE, c, at());
    expect(c.count).toBe(0);
    think(HARE, c, seen);
    expect(c.count).toBe(1);
    expect(c.state).toBe('IDLE');
  });

  test('alert then flee, alert then calm', () => {
    const near = at({ player: player([22, 20], NOISE.still) });
    const c = hare({ left: 100 });
    expect(think(RUNNER, c, near).events).toEqual([{ e: 'alert', id: 1 }]);
    expect(c.state).toBe('ALERT');
    expect(c.face).toEqual([1, 0]);
    think(RUNNER, c, near);
    think(RUNNER, c, near);
    expect(c.state).toBe('ALERT');
    expect(think(RUNNER, c, near).events).toEqual([{ e: 'flee', id: 1 }]);
    expect(c.state).toBe('FLEE');
    expect(c.from).toEqual([20, 20]);

    const d = hare({ left: 100 });
    think(HARE, d, near);
    for (let i = 0; i < 3; i++) think(HARE, d, at());
    expect(d.state).toBe('ALERT');
    expect(think(HARE, d, at()).events).toEqual([{ e: 'calm', id: 1 }]);
    expect(d.state).toBe('IDLE');
  });

  test('a run of 8 skips to the tier state', () => {
    // a hare away from its burrow (at its burrow it would go straight in)
    const c = hare({ left: 100, at: [24, 20] });
    // run noise 8 + ear 2 heard at 10 tiles, behind the hare
    const out = think(HARE, c, at({ anchorAt: [36, 36], player: player([15, 20], NOISE.run) }));
    expect(out.events.map((e) => e.e)).toEqual(['flee']);
    expect(c.from).toEqual([24, 20]);
    expect((c.at[0] - 15) ** 2 + (c.at[1] - 20) ** 2).toBeGreaterThanOrEqual(10 * 10);
    // so does a hit, and another kind's alarm of 8 or more
    const h = hare({ left: 100, at: [24, 20] });
    expect(think(HARE, h, at({ anchorAt: [36, 36], player: player([30, 30], NOISE.still), hit: true })).events).toEqual([{ e: 'flee', id: 1 }]);
    const a = hare({ left: 100, at: [24, 20] });
    expect(think(HARE, a, at({ anchorAt: [36, 36], noises: [{ at: [26, 20], r: 8 }] })).events).toEqual([{ e: 'flee', id: 1 }]);
    // a softer alarm within its ear only puts it on ALERT, facing the sound (question 5 default A)
    const s = hare({ left: 100 });
    const quietOut = think(HARE, s, at({ noises: [{ at: [20, 25], r: 5 }] }));
    expect(s.state).toBe('ALERT');
    expect(s.face).toEqual([0, 1]);
    expect(quietOut.alarm).toBeUndefined();
  });

  test('a defender only bluffs before the fight', () => {
    const boar = hare({ anchor: 'core/boar@20,20' });
    const close = at({ player: player([21, 20], NOISE.run) });
    for (let i = 0; i < 50; i++) {
      think(BOAR, boar, close);
      expect(boar.state).toBe('ALERT');
    }
    expect(tierState(BOAR)).toBe('ALERT');
    expect(tierState(BOAR, true)).toBe('DEFEND');
    expect(tierState(WOLF)).toBe('ALERT');
    expect(tierState(WOLF, true)).toBe('STALK');
    // the code path exists behind the fight
    const later = hare({ anchor: 'core/boar@20,20' });
    think(BOAR, later, { ...close, fight: true });
    expect(later.state).toBe('DEFEND');
  });

  test('an alert tell makes the kind\'s alarm noise', () => {
    const roe = hare({ anchor: 'core/roe@20,20' });
    const out = think(ROE, roe, at({ player: player([21, 20], NOISE.still) }));
    expect(out.alarm).toBe(4);
  });

  test('idle lasts 2 to 6, graze 4 to 12 head-down', () => {
    const idle = new Set<number>();
    const graze = new Set<number>();
    for (let id = 1; id <= 4; id++) {
      const c = hare({ id });
      for (let i = 0; i < 1000; i++) {
        const before = { state: c.state, up: c.up ?? 0 };
        think(HARE, c, at({ tick: i * THINK_MS }));
        if (c.state === 'IDLE' && before.state !== 'IDLE') idle.add(c.left);
        if (c.state === 'GRAZE' && !c.up && (before.state !== 'GRAZE' || before.up === 1)) graze.add(c.left);
        expect(Math.max(Math.abs(c.at[0] - 20), Math.abs(c.at[1] - 20))).toBeLessThanOrEqual(HARE.roam);
      }
    }
    expect([...idle].sort((a, b) => a - b)).toEqual([2, 3, 4, 5, 6]);
    expect([...graze].sort((a, b) => a - b)).toEqual([4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  test('pace is integer with carried credit', () => {
    const c = hare();
    expect([1, 2, 3, 4, 5].map(() => stepsToMove(c, 190))).toEqual([4, 4, 4, 4, 5]);
    expect(c.credit).toBe(10);
    const r = hare();
    // 95 ms a tile: 8 tiles and 40 ms carried each think, so every third think or so runs 9
    expect([1, 2, 3].map(() => stepsToMove(r, 95))).toEqual([8, 8, 9]);
    expect(r.credit).toBe(25);
    const s = hare();
    expect([1, 2].map(() => stepsToMove(s, 380))).toEqual([2, 2]);
    expect(s.credit).toBe(80);
  });

  test('the same inputs give the same creature', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const r = lcg(seed);
      const a = hare();
      const b = structuredClone(a);
      for (let i = 0; i < 400; i++) {
        const gait = [NOISE.still, NOISE.sneak, NOISE.walk, NOISE.run][r(4)]!;
        const v = at({ tick: i * THINK_MS, hour: 4 + r(20), player: r(3) ? player([10 + r(21), 10 + r(21)], gait) : undefined });
        const oa = think(HARE, a, v);
        const ob = think(HARE, b, v);
        expect(ob).toEqual(oa);
        expect(b).toEqual(a);
        expect(JSON.parse(JSON.stringify(a))).toEqual(a);
      }
    }
  });
});

describe('the states', () => {
  test('the hours window wraps midnight', () => {
    expect(awake(WOLF, 4)).toBe(true);
    expect(awake(WOLF, 21)).toBe(true);
    expect(awake(WOLF, 5)).toBe(false);
    expect(awake(WOLF, 12)).toBe(false);
    expect(awake(HARE, 4)).toBe(false);
    expect(awake(HARE, 21)).toBe(true);
    expect(awake(BOAR, 3)).toBe(true);
  });

  test('out of hours a hare walks home and goes under; it comes out at its hour', () => {
    const c = hare({ at: [24, 20], state: 'WANDER', target: [26, 20] });
    think(HARE, c, at({ hour: 23 }));
    expect(c.state).toBe('RETURN');
    for (let i = 0; i < 5 && !c.under; i++) think(HARE, c, at({ hour: 23 }));
    expect(c.under).toBe(true);
    expect(c.at).toEqual(HOME);
    // under, it is not sensed and senses nothing but a walk's hearing of the mouth
    expect(think(HARE, c, at({ hour: 23, player: player([21, 20], NOISE.run) })).events).toEqual([]);
    const out = think(HARE, c, at({ hour: 6 }));
    expect(out.events).toEqual([{ e: 'out', id: 1 }]);
    expect(c.under).toBe(false);
  });

  test('a burrower in its den stays in while a player is within a walk of the mouth', () => {
    const c = hare({ under: true, state: 'SLEEP', left: 8 });
    const watched = at({ player: player([26, 20], NOISE.still) });
    for (let i = 0; i < 30; i++) expect(think(HARE, c, watched).events).toEqual([]);
    expect(c.left).toBe(8);
    for (let i = 0; i < 7; i++) expect(think(HARE, c, at({ player: player([28, 20], NOISE.still) })).events).toEqual([]);
    expect(think(HARE, c, at()).events).toEqual([{ e: 'out', id: 1 }]);
  });

  test('a flight ends at sight + 4; a kind that looks back stops and turns first', () => {
    const roe = creature({ id: 3, at: [20, 20], anchor: 'core/roe@20,20', left: 100 });
    const threat = player([18, 20], NOISE.run);
    think(ROE, roe, at({ player: threat }));
    expect(roe.state).toBe('FLEE');
    for (let i = 0; i < 10 && roe.state === 'FLEE'; i++) think(ROE, roe, at({ tick: (i + 1) * THINK_MS, player: player([18, 20], NOISE.still) }));
    expect(roe.state).toBe('ALERT');
    expect(roe.back).toBe(true);
    expect((roe.at[0] - 18) ** 2 + (roe.at[1] - 20) ** 2).toBeGreaterThanOrEqual(12 * 12);
    expect(roe.avoidUntil).toBeGreaterThan(0);
    think(ROE, roe, at({ tick: 20 * THINK_MS }));
    think(ROE, roe, at({ tick: 21 * THINK_MS }));
    expect(['WANDER', 'IDLE']).toContain(roe.state);
  });

  test('behind the fight: a hunter stalks, chases at the walk and goes home past its leash', () => {
    const wolf = creature({ id: 7, at: [20, 20], anchor: 'core/wolf@20,20', left: 100 });
    let px = 27;
    const seen = new Set<string>();
    for (let i = 0; i < 40; i++) {
      const before = wolf.at;
      think(WOLF, wolf, at({ hour: 22, fight: true, tick: i * THINK_MS, player: player([px, 20], NOISE.walk, [1, 0]) }));
      seen.add(wolf.state);
      if (wolf.state === 'CHASE') {
        expect(Math.abs(wolf.at[0] - before[0]) + Math.abs(wolf.at[1] - before[1])).toBeLessThanOrEqual(5);
        px += 5;
      }
    }
    expect([...seen]).toEqual(expect.arrayContaining(['ALERT', 'STALK', 'CHASE', 'RETURN']));
    expect((wolf.at[0] - 20) ** 2 + (wolf.at[1] - 20) ** 2).toBeLessThanOrEqual((7 + 5) ** 2);
  });

  test('a long gap settles to the rest pose', () => {
    const c = hare({ at: [40, 40], state: 'FLEE', src: [30, 30] });
    settle(HARE, c, at({ hour: 12 }));
    expect(c).toMatchObject({ state: 'IDLE', at: HOME, under: false, count: 0 });
    settle(HARE, c, at({ hour: 23 }));
    expect(c).toMatchObject({ state: 'SLEEP', at: HOME, under: true });
  });
});
