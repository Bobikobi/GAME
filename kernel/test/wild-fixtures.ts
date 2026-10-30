/** Fixtures for the wild brain's tests: kinds with the design pages' numbers, maps drawn as strings. */
import type { Creature, Tile, WildKind, WildView } from '../src/wild/types';
import { keyedRand } from '../src/wild/types';

/** Hare: HUNTING 8 senses 6 / +2, BEHAVIOUR 5 row (30/50/20, roam 8, burrow, silent), solitary (5.1.6). */
export const HARE: WildKind = {
  id: 'core/hare',
  tier: 'flee',
  sight: 6,
  ear: 2,
  weights: { idle: 30, graze: 50, wander: 20 },
  roam: 8,
  flight: 'burrow',
  group: 'solitary',
  bands: [100, 0, 0, 0],
  alarm: 0,
  looksBack: false,
  hours: [5, 22],
  small: true,
};

/** Roe deer: 8 / +2, 20/50/30, roam 12, ground, alarm 4, looks back; a herd 0/40/60/0 (5.1.6). */
export const ROE: WildKind = {
  id: 'core/roe',
  tier: 'flee',
  sight: 8,
  ear: 2,
  weights: { idle: 20, graze: 50, wander: 30 },
  roam: 12,
  flight: 'ground',
  group: 'herd',
  bands: [0, 40, 60, 0],
  alarm: 4,
  looksBack: true,
  hours: [5, 22],
  small: false,
};

/** Wild boar: 4 / 0, a defender (danger 1), herd 20/30/50/0. */
export const BOAR: WildKind = {
  id: 'core/boar',
  tier: 'defend',
  sight: 4,
  ear: 0,
  weights: { idle: 20, graze: 50, wander: 30 },
  roam: 10,
  flight: 'ground',
  group: 'herd',
  bands: [20, 30, 50, 0],
  alarm: 4,
  looksBack: false,
  small: false,
};

/** Wolf: 8 / +2, a hunter awake 20 to 05 (a window that wraps). */
export const WOLF: WildKind = {
  id: 'core/wolf',
  tier: 'hunt',
  sight: 8,
  ear: 2,
  weights: { idle: 10, graze: 20, wander: 70 },
  roam: 14,
  flight: 'ground',
  group: 'pack',
  bands: [30, 60, 10, 0],
  alarm: 12,
  looksBack: true,
  hours: [20, 5],
  small: false,
};

/** The core gait: walk_step_ms 190, run_div 2, sneak_mul 2. */
export const PACE = { walk: 190, run: 95, sneak: 380 };
export const NOISE = { still: 2, sneak: 3, walk: 5, run: 8 };
export const NOON = 12;

/**
 * A map from rows: `#` a wall (not open, blocks sight), `g` tall grass (open, cover), anything else
 * open. Off the rows is a wall. `find` gives the tiles of a letter, in order of y, then x.
 */
export function grid(rows: readonly string[]) {
  const at = (x: number, y: number) => (y >= 0 && y < rows.length && x >= 0 && x < rows[y]!.length ? rows[y]![x]! : '#');
  return {
    open: (x: number, y: number) => at(x, y) !== '#',
    blocks: (x: number, y: number) => at(x, y) === '#',
    cover: (x: number, y: number) => at(x, y) === 'g',
    find(ch: string): Tile[] {
      const out: Tile[] = [];
      rows.forEach((row, y) => [...row].forEach((c, x) => c === ch && out.push([x, y])));
      return out;
    },
  };
}

/** An open field of `size` by `size`, walled round. */
export function field(size: number): readonly string[] {
  return Array.from({ length: size }, (_, y) => (y === 0 || y === size - 1 ? '#'.repeat(size) : `#${'.'.repeat(size - 2)}#`));
}

export function creature(over: Partial<Creature> = {}): Creature {
  return { id: 1, anchor: 'core/hare@10,10', at: [10, 10], face: [1, 0], state: 'IDLE', since: 0, count: 0, left: 50, credit: 0, grade: 2, draws: 0, ...over };
}

/** A view over a map with no player, no threats, no noises, at noon. */
export function view(map: ReturnType<typeof grid>, over: Partial<WildView> = {}): WildView {
  return {
    tick: 0,
    hour: NOON,
    open: map.open,
    blocks: map.blocks,
    cover: map.cover,
    threats: [],
    noises: [],
    anchorAt: [10, 10],
    kin: [],
    pace: PACE,
    rand: keyedRand([11, 22, 33, 44]),
    ...over,
  };
}

/** The player standing at a tile facing west, making a noise. */
export function player(at: Tile, noise: number, face: Tile = [-1, 0]) {
  return { at, face, noise, asleep: false };
}

/** A small integer generator for property tests (a 31-bit LCG), so the tests stay free of Math.random. */
export function lcg(seed: number): (n: number) => number {
  let s = seed >>> 0;
  return (n: number) => {
    s = (Math.imul(s, 1_103_515_245) + 12_345) >>> 0;
    return (s >>> 8) % n;
  };
}

/** Freezes an object and everything in it, so any write to it throws. */
export function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object') {
    for (const v of Object.values(o)) deepFreeze(v);
    Object.freeze(o);
  }
  return o;
}
