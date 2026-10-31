/** Groups (BEHAVIOUR 5.1): the leader, the band draw, the refill, the spread of a flight, the regroup. */
import { describe, expect, test } from 'vitest';

import { think } from '../src/wild/brain';
import { drawBand, followTarget, groupDraws, groupPeriod, leaderOf, refillStep, regroupTarget, sizeInBand, spreadFlee, targetSize } from '../src/wild/groups';
import { d2 } from '../src/wild/senses';
import { type Creature, THINK_MS, WILD } from '../src/wild/types';
import { HARE, NOISE, ROE, creature, deepFreeze, field, grid, lcg, player, view } from './wild-fixtures';

const OPEN = grid(field(41));
const ANCHOR = [20, 20] as const;

function roe(id: number, at: [number, number], over: Partial<Creature> = {}): Creature {
  return creature({ id, at, anchor: 'core/roe@20,20', ...over });
}

describe('the group size', () => {
  test('band draw follows the weights', () => {
    const counts = [0, 0, 0, 0];
    for (let bp = 0; bp < 10_000; bp++) counts[drawBand([0, 40, 60, 0], bp)]! += 1;
    expect(counts).toEqual([0, 4000, 6000, 0]);
    expect(drawBand([100, 0, 0, 0], 9999)).toBe(0);
    expect(drawBand([0, 0, 0, 100], 0)).toBe(3);
  });

  test('the count inside a band', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7].map((r) => sizeInBand(3, r))).toEqual([5, 6, 7, 8, 9, 10, 11, 12]);
    expect([0, 1].map((r) => sizeInBand(2, r))).toEqual([3, 4]);
    expect(sizeInBand(1, 99)).toBe(2);
    expect(sizeInBand(0, 99)).toBe(1);
  });

  test('room cuts the band', () => {
    const large = { ...ROE, bands: [0, 0, 0, 100] as const };
    expect(targetSize(large, 0, 7, 99)).toBe(12);
    expect(targetSize(large, 0, 7, 3)).toBe(3);
    expect(targetSize(large, 0, 7, 2)).toBe(2);
    expect(targetSize(large, 0, 7, 0)).toBe(1);
    expect(targetSize(ROE, 5000, 1, 99)).toBe(4);
  });

  test('a refill moves one member', () => {
    expect(refillStep(4, 1)).toBe(-1);
    expect(refillStep(1, 4)).toBe(1);
    expect(refillStep(2, 2)).toBe(0);
  });

  test('the period draws are the server\'s, on their own counters', () => {
    expect(groupPeriod(13, 3)).toBe(4);
    const seed = [1, 2, 3, 4] as const;
    const a = groupDraws(seed, 'core/roe@20,20', 4);
    expect(groupDraws(seed, 'core/roe@20,20', 4)).toEqual(a);
    expect(a.bp).toBeGreaterThanOrEqual(0);
    expect(a.bp).toBeLessThan(10_000);
    expect(groupDraws(seed, 'core/roe@20,20', 5)).not.toEqual(a);
    expect(groupDraws(seed, 'core/roe@21,20', 4)).not.toEqual(a);
  });
});

describe('a group on the move', () => {
  test('the leader is the lowest id, the next leads when it is taken', () => {
    const group = [roe(5, [20, 20]), roe(3, [21, 20]), roe(9, [22, 20])];
    expect(leaderOf(group).id).toBe(3);
    expect(leaderOf(group.filter((m) => m.id !== 3)).id).toBe(5);
    expect(() => leaderOf([])).toThrow();
  });

  test('a member wanders within 3 of the leader\'s target', () => {
    const leader = roe(1, [20, 20], { state: 'WANDER', target: [25, 20] });
    for (let id = 2; id < 30; id++) {
      const m = roe(id, [18, 20]);
      const t = followTarget(ROE, m, leader, view(OPEN, { anchorAt: ANCHOR, leader }));
      expect(Math.max(Math.abs(t![0] - 25), Math.abs(t![1] - 20))).toBeLessThanOrEqual(3);
    }
  });

  test('one fleeing moves all within 8', () => {
    const fleeing = roe(1, [20, 20], { state: 'FLEE', src: [10, 20] });
    const near = roe(2, [28, 20]);
    const far = roe(3, [28, 21]);
    expect(d2(near.at, fleeing.at)).toBe(64);
    expect(spreadFlee(fleeing, [fleeing, near, far]).map((m) => m.id)).toEqual([2]);
    // as a read, at the member's own think step (question 10 default A)
    const v = view(OPEN, { anchorAt: ANCHOR, kin: [fleeing] });
    expect(think(ROE, near, v).events).toEqual([{ e: 'flee', id: 2 }]);
    expect(think(ROE, far, v).events).toEqual([]);
    // a solitary kind reads no group
    const hare = roe(4, [21, 20]);
    expect(think(HARE, hare, v).events).toEqual([]);
  });

  test('herd scatters, then regroups within 3 of the anchor outside the avoid ring', () => {
    const threat = player([20, 14], NOISE.run);
    const herd = [roe(1, [19, 20]), roe(2, [21, 20]), roe(3, [20, 22])];
    const outs = herd.map((m) => think(ROE, m, view(OPEN, { anchorAt: ANCHOR, player: threat })));
    expect(outs.every((o) => o.events.some((e) => e.e === 'flee'))).toBe(true);
    const ends = new Set(herd.map((m) => m.at.join(',')));
    expect(ends.size).toBe(3);
    // the regroup: a tile within 3 of the anchor, outside the ring round the tile it was put up from
    const tick = 10 * THINK_MS;
    const away = roe(4, [30, 30], { from: [30, 30], avoidUntil: tick + 1 });
    for (let i = 0; i < 20; i++) {
      const t = regroupTarget(away, view(OPEN, { anchorAt: ANCHOR, tick }));
      expect(Math.max(Math.abs(t![0] - 20), Math.abs(t![1] - 20))).toBeLessThanOrEqual(3);
    }
    // the anchor inside the ring: it waits at the ring's edge nearest the anchor
    const close = roe(5, [20, 20], { from: [20, 21], avoidUntil: tick + 1 });
    const edge = regroupTarget(close, view(OPEN, { anchorAt: ANCHOR, tick }))!;
    expect(Math.max(Math.abs(edge[0] - 20), Math.abs(edge[1] - 21))).toBe(WILD.avoidTiles + 1);
    expect(edge).toEqual([20, 16]);
    // the ring lapses after 60 steps
    expect(regroupTarget(close, view(OPEN, { anchorAt: ANCHOR, tick: tick + 1 }))).toBeDefined();
  });

  test('no member writes another member', () => {
    const r = lcg(3);
    const me = roe(2, [20, 20]);
    const leader = deepFreeze(roe(1, [22, 20], { state: 'WANDER', target: [24, 22] }));
    const others = deepFreeze([leader, roe(3, [18, 20], { state: 'ALERT', src: [10, 10] }), roe(4, [20, 24], { state: 'FLEE', src: [10, 10] })]);
    const before = structuredClone(others);
    for (let i = 0; i < 300; i++) {
      const v = view(OPEN, { anchorAt: ANCHOR, tick: i * THINK_MS, leader, kin: others, player: r(2) ? player([10 + r(21), 10 + r(21)], NOISE.walk) : undefined });
      think(ROE, me, v);
    }
    expect(others).toEqual(before);
  });
});
