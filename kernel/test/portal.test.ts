/**
 * The ways through (OPEN_WORLD, the map generator's hidden doors): a non-solid prop with an id and a `portal`.
 * A step onto it stands the player at the far tile and tells it; one way per step, never chained; a way to a
 * tile nobody can stand on is only a prop. The shipped valley has no way, so every world here is a copy of the
 * bundle with a few synthetic props added.
 */
import { beforeAll, describe, expect, test } from 'vitest';

import { type Action, type Bundle, type GameEvent, type State, makeWalkable, newState, step } from '@game/kernel';

import { loadBundle } from '../../tools/test/helpers/world.js';

type Tile = [number, number];
type Prop = Bundle['map']['props'][number];

let base: Bundle;

beforeAll(() => {
  base = loadBundle();
});

function world(props: Prop[]): Bundle {
  const b = structuredClone(base);
  b.map.props = [...b.map.props, ...props];
  return b;
}

function way(id: string | undefined, at: Tile, to: Tile, solid = false): Prop {
  return { ...(id === undefined ? {} : { id }), sprite: 'core/base-kit:props/ruin_arch', x: at[0], y: at[1], w: 1, h: 1, solid, portal: { x: to[0], y: to[1] } };
}

function begin(b: Bundle): State {
  const r = step(b, newState(b, 7), { t: 'start', starter: 'core/forager', name: 'Tester' }, 0);
  if (!r.ok) throw new Error(r.error);
  return r.state;
}

/** The player is put on a tile at a tick, as if they had walked there. */
function place(s: State, at: Tile, tick: number): State {
  const out = structuredClone(s);
  out.player.at = [...at];
  out.player.movedAt = tick;
  out.player.busyUntil = Math.min(out.player.busyUntil, tick);
  out.tick = tick;
  return out;
}

function ok(b: Bundle, s: State, a: Action, tick: number, validateTravel = false): { state: State; events: GameEvent[] } {
  const r = step(b, s, a, tick, { validateTravel });
  if (!r.ok) throw new Error(`${a.t} refused: ${r.error}`);
  return { state: r.state, events: r.events };
}

const through = (events: GameEvent[]) => events.filter((e) => e.e === 'through');

/**
 * Open tiles with an open tile to their right, far apart on the map: the first pair is the door and the tile the
 * player steps from, the last is the landing and its neighbour, and one tile nobody can stand on.
 */
function tiles(b: Bundle, s: State): { door: Tile; from: Tile; landing: Tile; beside: Tile; wall: Tile } {
  const walkable = makeWalkable(b);
  const pairs: [Tile, Tile][] = [];
  let wall: Tile | undefined;
  for (let y = 1; y < b.map.height - 1; y++) {
    for (let x = 1; x < b.map.width - 2; x++) {
      const open = walkable(x, y, s.player);
      if (!open) wall ??= [x, y];
      if (open && walkable(x + 1, y, s.player)) pairs.push([[x, y], [x + 1, y]]);
    }
  }
  const [first, last] = [pairs[0]!, pairs[pairs.length - 1]!];
  if (!wall) throw new Error('no wall on the map');
  return { from: first[0], door: first[1], landing: last[1], beside: last[0], wall };
}

describe('a way through', () => {
  test('a step onto a way stands the player at its far tile, tells it, and the step from there is a plain walk', () => {
    const s0 = begin(base);
    const t = tiles(base, s0);
    const b = world([way('core/t-door', t.door, t.landing)]);
    const s = place(s0, t.from, 1000);
    const { state, events } = ok(b, s, { t: 'move', at: t.door }, 1000, true);
    expect(state.player.at).toEqual(t.landing);
    expect(state.player.movedAt).toBe(1000);
    expect(through(events)).toEqual([{ e: 'through', id: 'core/t-door', from: t.door, at: t.landing }]);
    const next = ok(b, state, { t: 'move', at: t.beside }, 1000, true);
    expect(next.state.player.at).toEqual(t.beside);
    expect(through(next.events)).toEqual([]);
  });

  test('the way back: a second way beside the landing returns the player to the tile before the door', () => {
    const s0 = begin(base);
    const t = tiles(base, s0);
    const b = world([way('core/t-door', t.door, t.landing), way('core/t-up', t.beside, t.from)]);
    const down = ok(b, place(s0, t.from, 1000), { t: 'move', at: t.door }, 1000);
    const up = ok(b, down.state, { t: 'move', at: t.beside }, 1000);
    expect(up.state.player.at).toEqual(t.from);
    expect(through(up.events).map((e) => (e as { id: string }).id)).toEqual(['core/t-up']);
  });

  test('one way per step: a way whose far tile is another way leaves the player standing on it', () => {
    const s0 = begin(base);
    const t = tiles(base, s0);
    const b = world([way('core/t-door', t.door, t.beside), way('core/t-up', t.beside, t.from)]);
    const { state, events } = ok(b, place(s0, t.from, 1000), { t: 'move', at: t.door }, 1000);
    expect(state.player.at).toEqual(t.beside);
    expect(through(events).length).toBe(1);
  });

  test('a way to a tile nobody can stand on, a way without an id, and a solid way are only props', () => {
    const s0 = begin(base);
    const t = tiles(base, s0);
    for (const prop of [way('core/t-door', t.door, t.wall), way(undefined, t.door, t.landing)]) {
      const { state, events } = ok(world([prop]), place(s0, t.from, 1000), { t: 'move', at: t.door }, 1000);
      expect(state.player.at).toEqual(t.door);
      expect(through(events)).toEqual([]);
    }
    const r = step(world([way('core/t-door', t.door, t.landing, true)]), place(s0, t.from, 1000), { t: 'move', at: t.door }, 1000);
    expect(r).toEqual({ ok: false, error: 'You cannot stand there.' });
  });

  test('the same steps on the same world give the same state', () => {
    const s0 = begin(base);
    const t = tiles(base, s0);
    const b = world([way('core/t-door', t.door, t.landing)]);
    const a = ok(b, place(s0, t.from, 1000), { t: 'move', at: t.door }, 1000).state;
    const c = ok(b, place(s0, t.from, 1000), { t: 'move', at: t.door }, 1000).state;
    expect(JSON.stringify(a)).toBe(JSON.stringify(c));
  });
});
