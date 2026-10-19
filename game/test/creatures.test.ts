import { beforeAll, describe, expect, test } from 'vitest';

import type { Bundle } from '@game/kernel';
import { REACT_MS, type Creature, isOut, makeCreatures, poseOf, startled, stepCreature } from '../src/creatures';
import { loadBundle } from '../../tools/test/helpers/world';

const TICK = 16;

let b: Bundle;
let all: Creature[];

beforeAll(() => {
  b = loadBundle();
  all = makeCreatures(b.map);
});

const first = (look: string) => {
  const c = all.find((x) => x.look === look);
  if (!c) throw new Error(`no ${look} on the map`);
  return structuredClone(c);
};

/** The player walking at `gap` tiles east of the creature's spot. */
const near = (c: Creature, gap: number, moving = true) => ({ x: c.sx + 0.5 + gap, y: c.sy + 0.5, moving });

/** Ticks of 16 ms until it is no longer sitting; -1 if it never leaves within `limit` ms. */
function msToLeave(c: Creature, gap: number, moving = true, limit = 1000): number {
  const p = near(c, gap, moving);
  for (let t = TICK; t <= limit; t += TICK) {
    stepCreature(c, TICK, p, true);
    if (c.phase !== 'sitting') return t;
  }
  return -1;
}

describe('the map gives every look at least one creature', () => {
  test('bird, fish, rabbit and deer all have spots', () => {
    for (const look of ['bird', 'fish', 'rabbit', 'deer']) expect(all.some((c) => c.look === look), look).toBe(true);
  });
});

describe('a bird sitting on the ground', () => {
  test('takes off within 300 ms of a walking player within 3 tiles', () => {
    const bird = first('bird');
    expect(bird.kind.alert_tiles).toBeGreaterThanOrEqual(3);
    const ms = msToLeave(bird, 3);
    expect(ms).toBeGreaterThan(0);
    expect(ms).toBeLessThanOrEqual(300);
    expect(ms).toBeGreaterThanOrEqual(REACT_MS);
    expect(bird.phase).toBe('fleeing');
  });

  test('stays when the player is further than its alert distance, or stands still', () => {
    const far = first('bird');
    expect(msToLeave(far, far.kind.alert_tiles + 1)).toBe(-1);
    const still = first('bird');
    expect(msToLeave(still, 1, false)).toBe(-1);
  });

  test('flies away from the player, and is gone from view after its flight', () => {
    const bird = first('bird');
    msToLeave(bird, 2);
    expect(bird.dx).toBeLessThan(0);
    for (let t = 0; t < 3000; t += TICK) stepCreature(bird, TICK, near(bird, 2), true);
    expect(bird.phase).toBe('away');
    expect(poseOf(bird).alpha).toBe(0);
  });

  test('comes back only after its time, and only with the player clear of it', () => {
    const bird = first('bird');
    msToLeave(bird, 2);
    const wait = bird.kind.return_s * 1000;
    // the player stays close: it does not return, however long it waits
    for (let t = 0; t < wait + 5000; t += 100) stepCreature(bird, 100, near(bird, 2, false), true);
    expect(bird.phase).toBe('away');
    // the player goes off: it returns and sits again
    const gone = near(bird, bird.kind.alert_tiles + 5, false);
    for (let t = 0; t < 3000; t += 100) stepCreature(bird, 100, gone, true);
    expect(bird.phase).toBe('sitting');
    expect(poseOf(bird).alpha).toBe(1);
  });
});

describe('fish, hare and deer', () => {
  test('a fish darts along the river, north or south, and not sideways', () => {
    const fish = first('fish');
    const p = { x: fish.sx + 0.5, y: fish.sy + 1.5, moving: true };
    for (let t = 0; t < 300; t += TICK) stepCreature(fish, TICK, p, true);
    expect(fish.phase).toBe('fleeing');
    expect(fish.dx).toBe(0);
    expect(fish.dy).toBeLessThan(0);
  });

  test('a hare that bolts into trees is gone as soon as it reaches them', () => {
    const hare = first('rabbit');
    const tree = (x: number) => x < hare.sx; // solid to its west
    const p = { x: hare.sx + 1.5, y: hare.sy + 0.5, moving: true };
    for (let t = 0; t < 4000 && hare.phase !== 'away'; t += TICK) stepCreature(hare, TICK, p, true, (x) => tree(x));
    expect(hare.phase).toBe('away');
    expect(hare.t).toBeLessThan(900);
  });

  test('the deer is out only at dawn, by the game hour', () => {
    const deer = first('deer');
    expect(isOut(deer.kind, 6, 0.3)).toBe(true);
    for (const hour of [0, 4, 8, 12, 17, 22]) expect(isOut(deer.kind, hour, 0), `hour ${hour}`).toBe(false);
    // in the middle of the day a sitting deer fades out of view and is gone, then is back at once when its hour comes
    for (let t = 0; t < 2000; t += TICK) stepCreature(deer, TICK, near(deer, 20, false), false);
    expect(deer.phase).toBe('away');
    expect(poseOf(deer).alpha).toBe(0);
    for (let t = 0; t < 2000; t += TICK) stepCreature(deer, TICK, near(deer, 20, false), true);
    expect(deer.phase).toBe('sitting');
  });

  test('the others are out by day and gone by night', () => {
    const bird = first('bird');
    expect(isOut(bird.kind, 12, 0)).toBe(true);
    expect(isOut(bird.kind, 23, 1)).toBe(false);
  });

  test('startled needs both closeness and movement', () => {
    const c = first('rabbit');
    expect(startled(c, near(c, 1))).toBe(true);
    expect(startled(c, near(c, 1, false))).toBe(false);
    expect(startled(c, near(c, c.kind.alert_tiles + 1))).toBe(false);
  });
});
