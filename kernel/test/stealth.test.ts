/** Stealth over hazards (NEXT.md 12a): a deterministic night round, readable eyes, and the ordinary chase on failure. */
import { beforeAll, describe, expect, test } from 'vitest';

import {
  type Action,
  type Bundle,
  type GameEvent,
  type State,
  type Tile,
  hazardsOf,
  lastDusk,
  newState,
  predatorAt,
  replay,
  satietyCap,
  sees,
  serialize,
  step,
} from '@game/kernel';
import { loadBundle } from '../../tools/test/helpers/world.js';

type Prop = Bundle['map']['props'][number];

const DUSK = 400_000;
const NOON = 100_000;
const ROUND: Tile[] = [
  [8, 22],
  [9, 22],
  [9, 23],
  [8, 23],
];

let base: Bundle;

beforeAll(() => {
  base = loadBundle();
});

function wolf(round = true): Prop {
  return {
    id: 'test/wolf',
    sprite: 'core/base-kit:props/standing_stone',
    x: 8,
    y: 22,
    w: 1,
    h: 1,
    solid: false,
    hazard: {
      kind: 'predator',
      window: ['night'],
      reach: 3,
      ...(round ? { round: ROUND, pace_ms: 600, eyes: 5 } : {}),
    },
  };
}

function cover(x: number, y: number): Prop {
  return { sprite: 'core/base-kit:props/standing_stone', x, y, w: 1, h: 1, solid: false, cover: true };
}

function world(props: Prop[]): Bundle {
  const b = structuredClone(base);
  b.map.props = [...b.map.props.filter((p) => !p.hazard && p.cover !== true), ...props];
  b.params.satiety_drain_per_min = 0;
  return b;
}

function begin(b: Bundle): State {
  const r = step(b, newState(b, 7), { t: 'start', starter: 'core/forager', name: 'Tester' }, 0);
  if (!r.ok) throw new Error(r.error);
  return r.state;
}

function place(s: State, at: Tile, tick: number): State {
  const out = structuredClone(s);
  out.player.at = [...at];
  out.player.movedAt = tick;
  out.player.satietyAt = tick;
  out.player.busyUntil = Math.min(out.player.busyUntil, tick);
  out.tick = tick;
  return out;
}

function move(b: Bundle, s: State, at: Tile, tick: number): { state: State; events: GameEvent[] } {
  const r = step(b, s, { t: 'move', at }, tick);
  if (!r.ok) throw new Error(r.error);
  return r;
}

describe('a predator round', () => {
  test('stays on its den by day, walks one tile each pace after dusk, and replays to the same tile', () => {
    const b = world([wolf()]);
    const hazard = hazardsOf(b)[0]!;
    expect(lastDusk(b, DUSK)).toBe(DUSK);
    expect(lastDusk(b, NOON)).toBe(DUSK - b.params.day_length_ms);
    expect(predatorAt(b, hazard, NOON)).toEqual([8, 22]);
    const wide = world([{ ...wolf(), x: 7, w: 2, hazard: { ...wolf().hazard!, round: [[8, 22], [9, 22], [9, 23], [8, 23]] } }]);
    expect(predatorAt(wide, hazardsOf(wide)[0]!, NOON)).toEqual([8, 22]);
    expect(predatorAt(b, hazard, DUSK)).toEqual(ROUND[0]);
    expect(predatorAt(b, hazard, DUSK + 599)).toEqual(ROUND[0]);
    expect(predatorAt(b, hazard, DUSK + 600)).toEqual(ROUND[1]);
    expect(predatorAt(b, hazard, DUSK + 1200)).toEqual(ROUND[2]);

    const log: readonly { a: Action; tick: number }[] = [
      { a: { t: 'start', starter: 'core/forager', name: 'Tester' }, tick: 0 },
      { a: { t: 'move', at: [12, 22] }, tick: DUSK + 1200 },
    ];
    const one = replay(b, newState(b, 7), log);
    const two = replay(b, newState(b, 7), log);
    expect(one.error).toBeUndefined();
    expect(serialize(one.state)).toBe(serialize(two.state));
    expect(predatorAt(b, hazard, one.state.tick)).toEqual(predatorAt(b, hazard, two.state.tick));
  });

  test('sees inside its cone, cover hides farther away, and adjacency is seen even on cover', () => {
    const open = world([wolf()]);
    expect(sees(open, hazardsOf(open)[0]!, DUSK, [11, 22])).toBe(true);

    const hidden = world([wolf(), cover(11, 22), cover(9, 22)]);
    const hazard = hazardsOf(hidden)[0]!;
    expect(sees(hidden, hazard, DUSK, [11, 22])).toBe(false);
    expect(sees(hidden, hazard, DUSK, [9, 22])).toBe(true);
  });

  test('being seen starts the ordinary chase with its ordinary bites', () => {
    const b = world([wolf()]);
    const start = move(b, place(begin(b), [11, 22], DUSK), [11, 22], DUSK);
    expect(start.state.player.chase).toEqual({ hazard: 'test/wolf', since: DUSK, bites: 0 });
    const bitten = move(b, start.state, [11, 22], DUSK + b.params.hazard.predator.catch_ms);
    expect(bitten.state.player.chase).toEqual({ hazard: 'test/wolf', since: DUSK, bites: 1 });
    const cap = satietyCap(b, start.state);
    expect(bitten.events).toEqual([{ e: 'hurt', by: 'predator', id: 'test/wolf', hp: cap - (cap * b.params.hazard.predator.bite_pct) / 100 }]);
  });

  test('a predator without a round still notices by reach', () => {
    const b = world([wolf(false)]);
    const inside = move(b, place(begin(b), [5, 22], DUSK), [5, 22], DUSK).state;
    expect(inside.player.chase).toEqual({ hazard: 'test/wolf', since: DUSK, bites: 0 });
    const outside = move(b, place(begin(b), [4, 22], DUSK), [4, 22], DUSK).state;
    expect(outside.player.chase).toBeNull();
  });
});
