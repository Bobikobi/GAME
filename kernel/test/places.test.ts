/**
 * Entering pays (OPEN_WORLD.md G63, G66; EXPERIENCE_AUDIT.md gap M2): the first entry to a map region or a
 * named area is told once and kept in the player's seen list, a fall or not, and the place counts for the
 * exploration board only once it is brought home. Every world is a copy of the bundle with no hazards but
 * the ones a test puts down, and one test region west of the town.
 */
import { beforeAll, describe, expect, test } from 'vitest';

import {
  type Action,
  type Bundle,
  type GameEvent,
  type State,
  type Tile,
  adaptState,
  findSlot,
  isSafe,
  makeWalkable,
  newState,
  placeName,
  placesAt,
  serialize,
  step,
} from '@game/kernel';
import { loadBundle } from '../../tools/test/helpers/world.js';

type Prop = Bundle['map']['props'][number];

const NOON = 100_000;
const NIGHT = 500_000;
/** The test region: the wild ground west of the town's cobbles. */
const MEADOW = { id: 'test-meadow', x: 18, y: 5, w: 4, h: 5, title: 'Test meadow' };
/** Two wild tiles inside the meadow, one step apart, and the town's first safe tile east of them. */
const IN: Tile = [20, 7];
const IN2: Tile = [21, 7];
const TOWN: Tile = [22, 7];

let base: Bundle;

beforeAll(() => {
  base = loadBundle();
});

/** The bundle with the meadow, no hazards but these, and no hunger drain. */
function world(props: Prop[] = []): Bundle {
  const b = structuredClone(base);
  b.map.props = [...b.map.props.filter((p) => !p.hazard), ...props];
  b.map.regions = [MEADOW];
  return b;
}

const meadowId = (b: Bundle) => `${b.map.id}/${MEADOW.id}`;

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

function ok(b: Bundle, s: State, a: Action, tick: number): { state: State; events: GameEvent[] } {
  const r = step(b, s, a, tick);
  if (!r.ok) throw new Error(`${a.t} refused: ${r.error}`);
  return { state: r.state, events: r.events };
}

const move = (b: Bundle, s: State, at: Tile, tick: number) => ok(b, s, { t: 'move', at }, tick);
const places = (events: GameEvent[]) => events.filter((e) => e.e === 'place');

describe('the places of a tile', () => {
  test('a region under its regionOf id, then the named areas; an unnamed area is no place', () => {
    const b = world();
    expect(placesAt(b.map, IN[0], IN[1])).toEqual([meadowId(b)]);
    const square = findSlot(b.map, 'core/town-square')!;
    expect(placesAt(b.map, square.x, square.y)).toEqual(['core/town-square']);
    const tangle = findSlot(b.map, 'core/tangle')!;
    expect(tangle.label).toBeUndefined();
    const heart = findSlot(b.map, 'core/tangle-heart')!;
    expect(placesAt(b.map, tangle.x, tangle.y)).not.toContain('core/tangle');
    expect(placesAt(b.map, heart.x, heart.y)).toEqual(['core/tangle-heart']);
  });

  test('the name: an area its label, a region its title, else its id made readable', () => {
    const b = world();
    expect(placeName(b.map, 'core/town-square')).toBe('Town square');
    expect(placeName(b.map, meadowId(b))).toBe('Test meadow');
    b.map.regions = [{ id: 'old_north-wood', x: 0, y: 0, w: 1, h: 1 }];
    expect(placeName(b.map, `${b.map.id}/old_north-wood`)).toBe('Old north wood');
    expect(placeName(b.map, 'core/tangle')).toBeUndefined();
    expect(placeName(b.map, 'test/nowhere')).toBeUndefined();
  });
});

describe('entering pays', () => {
  test('a new character holds no seen list and no explored list: an old save serializes as it did', () => {
    const s = begin(world());
    expect(s.player.seen).toBeUndefined();
    expect(s.player.explored).toBeUndefined();
    expect(serialize(s)).not.toContain('"seen"');
  });

  test('the first entry is told once and seen; walking on inside it and coming back tell nothing', () => {
    const b = world();
    const first = move(b, place(begin(b), [17, 7], NOON), IN, NOON + 1000);
    expect(places(first.events)).toEqual([{ e: 'place', id: meadowId(b) }]);
    expect(first.state.player.seen).toEqual([meadowId(b)]);
    const on = move(b, first.state, IN2, NOON + 2000);
    expect(places(on.events)).toEqual([]);
    const out = move(b, on.state, [17, 7], NOON + 4000);
    const back = move(b, out.state, IN, NOON + 5000);
    expect(places(back.events)).toEqual([]);
    expect(back.state.player.seen).toEqual([meadowId(b)]);
  });

  test('a place found in the wild rides the outing and counts once it is brought home', () => {
    const b = world();
    const found = move(b, place(begin(b), [17, 7], NOON), IN, NOON + 1000).state;
    expect(isSafe(b, found, IN)).toBe(false);
    expect(found.player.outing?.found).toEqual([meadowId(b)]);
    expect(found.player.explored).toBeUndefined();
    const home = move(b, move(b, found, IN2, NOON + 2000).state, TOWN, NOON + 3000).state;
    expect(isSafe(b, home, TOWN)).toBe(true);
    expect(home.player.outing).toBeNull();
    expect(home.player.explored).toContain(meadowId(b));
  });

  test('a fall drops the find and keeps the sight: the next entry is silent, and that one counts when it comes home', () => {
    const pit: Prop = { id: 'test/pit', sprite: 'core/base-kit:props/standing_stone', x: IN2[0], y: IN2[1], w: 1, h: 1, solid: false, hazard: { kind: 'pit', window: ['night'] } };
    const b = world([pit]);
    const found = move(b, place(begin(b), [17, 7], NIGHT), IN, NIGHT + 1000).state;
    expect(found.player.outing?.found).toEqual([meadowId(b)]);
    found.player.hp = 1;
    const fell = move(b, found, IN2, NIGHT + 2000);
    expect(fell.events.some((e) => e.e === 'fall')).toBe(true);
    expect(fell.state.player.seen).toEqual([meadowId(b)]);
    expect(fell.state.player.explored ?? []).not.toContain(meadowId(b));
    const again = move(b, place(fell.state, [17, 7], NIGHT + 3000), IN, NIGHT + 4000);
    expect(places(again.events)).toEqual([]);
    expect(again.state.player.outing?.found).toEqual([meadowId(b)]);
    const home = move(b, place(again.state, IN2, NIGHT + 5000), TOWN, NIGHT + 6000).state;
    expect(home.player.explored).toContain(meadowId(b));
  });

  test('a named area entered on safe ground is home already: it counts at once', () => {
    const b = world();
    const square = findSlot(b.map, 'core/town-square')!;
    const walkable = makeWalkable(b);
    const s0 = begin(b);
    const inside: Tile[] = [];
    for (let y = square.y; y < square.y + square.h; y++) {
      for (let x = square.x; x < square.x + square.w; x++) if (walkable(x, y, s0.player) && isSafe(b, s0, [x, y])) inside.push([x, y]);
    }
    const at = inside[0]!;
    const from: Tile = [at[0], square.y + square.h];
    const r = move(b, place(s0, from, NOON), at, NOON + 1000);
    expect(places(r.events)).toEqual([{ e: 'place', id: 'core/town-square' }]);
    expect(r.state.player.explored).toContain('core/town-square');
    expect(r.state.player.outing).toBeNull();
  });

  test('a place that left the map leaves both lists when a save is adapted', () => {
    const b = world();
    const home = move(b, move(b, move(b, place(begin(b), [17, 7], NOON), IN, NOON + 1000).state, IN2, NOON + 2000).state, TOWN, NOON + 3000).state;
    expect(home.player.explored).toContain(meadowId(b));
    const without = structuredClone(b);
    without.map.regions = [];
    const adapted = adaptState(without, home)!;
    expect(adapted.player.seen ?? []).not.toContain(meadowId(b));
    expect(adapted.player.explored ?? []).not.toContain(meadowId(b));
    const kept = adaptState(b, home)!;
    expect(kept.player.explored).toContain(meadowId(b));
  });
});
