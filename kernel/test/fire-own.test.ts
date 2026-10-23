/**
 * The player's own fire (NEXT 21 a; DECISIONS.md, 2026-10-19; GAME_RULES G30, G31, G47, G48): kindled on a free tile
 * beside them outside the town, safe while it burns, shorter-lived the deeper the ground, kept by hand, and a vigil
 * for a `tend` step named "own". Every world here is a copy of the shipped bundle with a clean meadow stamped over a
 * corner of the map, so no test reads a coordinate of the real valley.
 */
import { beforeAll, describe, expect, test } from 'vitest';

import {
  type Action,
  type Bundle,
  type GameEvent,
  OWN_FIRE,
  type State,
  dangerAt,
  fireArea,
  fireBurns,
  hazardsOf,
  isSafe,
  mulDiv,
  newState,
  nextLogAt,
  questSatisfied,
  replay,
  serialize,
  step,
  tendHolds,
  watchOf,
} from '@game/kernel';

import { loadBundle } from '../../tools/test/helpers/world.js';

type Tile = [number, number];
type Prop = Bundle['map']['props'][number];

const WOOD = 'core/log';
const QUEST = 'test/vigil';
const NOON = 100_000;
const DUSK = 400_000;
const DAWN = 850_000;
/** 21:20, a third of the way into the night. */
const NIGHT = 500_000;
const DAY = 1_200_000;

/** The corner stamped clean: x 2..17, y 2..10. The fire stands on F, the player beside it on P. */
const PATCH = { x: 2, y: 2, w: 16, h: 9 };
const F: Tile = [8, 6];
const P: Tile = [7, 6];
const TOWN: Tile = [3, 9];
const WATER: Tile = [3, 6];

let base: Bundle;

beforeAll(() => {
  base = loadBundle();
});

const overlaps = (r: { x: number; y: number; w: number; h: number }): boolean =>
  r.x < PATCH.x + PATCH.w && r.x + r.w > PATCH.x && r.y < PATCH.y + PATCH.h && r.y + r.h > PATCH.y;

/** The bundle with a clean meadow in the patch (a town tile and a water tile in it), no shipped hazard, no hunger drain, and these props. */
function world(props: Prop[] = [], tweak?: (b: Bundle) => void): Bundle {
  const b = structuredClone(base);
  b.params.satiety_drain_per_min = 0;
  const rows = b.map.ground.map((row) => row.split(''));
  for (let y = PATCH.y; y < PATCH.y + PATCH.h; y++) for (let x = PATCH.x; x < PATCH.x + PATCH.w; x++) rows[y]![x] = '.';
  rows[TOWN[1]]![TOWN[0]] = '=';
  rows[WATER[1]]![WATER[0]] = '~';
  b.map.ground = rows.map((row) => row.join(''));
  b.map.slots = b.map.slots.filter((s) => !overlaps(s));
  b.map.props = [...b.map.props.filter((p) => !overlaps(p) && !p.hazard), ...props];
  for (const [id, inst] of Object.entries(b.instances)) if (overlaps({ x: inst.x, y: inst.y, w: 1, h: 1 })) delete b.instances[id];
  b.quests[QUEST] = { ...b.quests['core/a-coin-for-maru']!, id: QUEST, steps: [{ kind: 'tend', fire: OWN_FIRE }] };
  tweak?.(b);
  return b;
}

const wolf = (x: number, y: number, reach = 3): Prop => ({
  id: 'test/wolf',
  sprite: 'core/base-kit:props/standing_stone',
  x,
  y,
  w: 1,
  h: 1,
  solid: false,
  hazard: { kind: 'predator', window: ['night'], reach },
});

/** A wolf whose round is a 2x2 loop with its corner at (x, y) and eyes two tiles wide: its watch is x-2..x+3, y-2..y+3. */
const roundWolf = (x: number, y: number): Prop => ({
  id: 'test/wolf',
  sprite: 'core/base-kit:props/standing_stone',
  x,
  y,
  w: 1,
  h: 1,
  solid: false,
  hazard: {
    kind: 'predator',
    window: ['night'],
    round: [
      [x, y],
      [x + 1, y],
      [x + 1, y + 1],
      [x, y + 1],
    ],
    eyes: 2,
  },
});

function begin(b: Bundle, bag: Record<string, number> = { [WOOD]: 20 }, at: Tile = P, tick = NOON): State {
  const r = step(b, newState(b, 7), { t: 'start', starter: 'core/forager', name: 'Tester' }, 0);
  if (!r.ok) throw new Error(r.error);
  const s = structuredClone(r.state);
  s.player.at = [...at];
  s.player.movedAt = tick;
  s.player.satietyAt = tick;
  s.player.attrs.might = 100;
  s.player.bag = { ...bag };
  s.tick = tick;
  return s;
}

function ok(b: Bundle, s: State, a: Action, tick: number): { state: State; events: GameEvent[] } {
  const r = step(b, s, a, tick);
  if (!r.ok) throw new Error(`${a.t} refused: ${r.error}`);
  return { state: r.state, events: r.events };
}

const kindle = (b: Bundle, s: State, tick: number, fire: Tile = F, at: Tile = P) => ok(b, s, { t: 'kindle', fire, at }, tick);
const feed = (b: Bundle, s: State, tick: number, at: Tile = P) => ok(b, s, { t: 'feed', fire: OWN_FIRE, item: WOOD, at }, tick);

/** A refusal leaves the world as it was: the state is not returned, so the caller's own is compared. */
function refused(b: Bundle, s: State, a: Action, tick: number, error: string): void {
  const before = serialize(s);
  expect(step(b, s, a, tick)).toEqual({ ok: false, error });
  expect(serialize(s)).toBe(before);
  expect(s.player.bag[WOOD]).toBe(20);
}

/** Feed whenever a log fits, every `every` game ms from `from` to before `to`, except the instants listed. */
function keep(b: Bundle, s: State, from: number, to: number, skip: readonly number[] = [], every = 30_000): State {
  let state = s;
  for (let t = from; t < to; t += every) {
    if (skip.includes(t) || nextLogAt(b, state, OWN_FIRE, t) > t) continue;
    state = feed(b, state, t).state;
  }
  return state;
}

describe('kindling', () => {
  test('two logs build it beside the player, lit with one log of burn, and the step is busy for the camp fire work', () => {
    const b = world();
    const { log_ms } = b.params.fire;
    const log = mulDiv(log_ms, 100, 100 + b.params.fire.burn_pct_per_d);
    const r = kindle(b, begin(b), NOON);
    expect(r.state.player.own).toEqual({ at: F, lit: NOON, until: NOON + log, log });
    expect(r.state.player.bag[WOOD]).toBe(18);
    expect(r.events).toEqual([
      { e: 'spend', item: WOOD, qty: 2 },
      { e: 'fire', id: OWN_FIRE, until: NOON + log },
      { e: 'busy', verb: 'kindle', ms: b.camps['core/campfire']!.active_ms },
    ]);
    expect(fireBurns(r.state, OWN_FIRE, NOON)).toBe(true);
    expect(fireBurns(r.state, OWN_FIRE, NOON + log)).toBe(false);
  });

  test('a new state and a save from before the fire hold none', () => {
    const b = world();
    expect(newState(b, 1).player.own).toBeNull();
    const old = begin(b);
    delete (old.player as Partial<State['player']>).own;
    expect(isSafe(b, old, F)).toBe(false);
    expect(fireBurns(old, OWN_FIRE, NOON)).toBe(false);
    expect(kindle(b, old, NOON).state.player.own?.at).toEqual(F);
  });

  test('the shipped map hands out a danger of 0 in the town and 1 outside it, and a safe slot is 0', () => {
    const b = world();
    expect(dangerAt(b, TOWN)).toBe(0);
    expect(dangerAt(b, F)).toBe(1);
    const safe = base.map.slots.find((s) => s.safe === true)!;
    expect(dangerAt(base, [safe.x, safe.y])).toBe(0);
  });
});

describe('where it is refused, and the logs stay', () => {
  test('on a town tile', () => {
    const b = world();
    refused(b, begin(b, undefined, [TOWN[0] + 1, TOWN[1]]), { t: 'kindle', fire: TOWN, at: [TOWN[0] + 1, TOWN[1]] }, NOON, 'The town has its own fires.');
  });

  test('inside any slot, whatever kind', () => {
    const b = world([], (w) => {
      w.map.slots.push({ id: 'test/spot', kind: 'resource', x: F[0], y: F[1], w: 1, h: 1, tag: 'meadow' });
    });
    refused(b, begin(b), { t: 'kindle', fire: F, at: P }, NOON, 'A fire has no place here.');
  });

  test('on water and on a solid prop', () => {
    const rock: Prop = { sprite: 'core/base-kit:props/standing_stone', x: F[0], y: F[1], w: 1, h: 1, solid: true };
    const b = world([rock]);
    refused(b, begin(b), { t: 'kindle', fire: F, at: P }, NOON, 'Nothing here will hold a fire.');
    const w = world();
    refused(w, begin(w, undefined, [WATER[0] + 1, WATER[1]]), { t: 'kindle', fire: WATER, at: [WATER[0] + 1, WATER[1]] }, NOON, 'Nothing here will hold a fire.');
  });

  test('on a node or on a fire already on the map', () => {
    const hearth: Prop = { id: 'test/hearth', sprite: 'core/base-kit:props/campfire_unlit', x: F[0], y: F[1], w: 1, h: 1, solid: false, fire: true };
    const b = world([hearth]);
    refused(b, begin(b), { t: 'kindle', fire: F, at: P }, NOON, 'Something is already there.');
  });

  test('during a chase, even a hunt that began a moment before', () => {
    const b = world([wolf(13, 6)]);
    const hunted = begin(b, undefined, [11, 6], NIGHT);
    // standing in the wolf's reach at night, the world acts on the player first: the hunt starts before the fire is looked at
    const seen = step(b, hunted, { t: 'kindle', fire: [10, 6], at: [11, 6] }, NIGHT);
    expect(seen).toEqual({ ok: false, error: 'Not with the wolf at your heels.' });
    // and with a hunt already on, on ground out of its reach
    const chased = structuredClone(begin(b, undefined, P, NIGHT));
    chased.player.chase = { hazard: 'test/wolf', since: NIGHT - 1000, bites: 0 };
    refused(b, chased, { t: 'kindle', fire: F, at: P }, NIGHT, 'Not with the wolf at your heels.');
  });

  test('where any tile of its safe area lies in a round\'s watch, by day as at night', () => {
    // the round's corner is (14, 6) and its watch x 12..17: a fire on (11, 6) has x 10..12 in it, one on (10, 6) x 9..11 does not
    const b = world([roundWolf(14, 6)]);
    expect(watchOf(b, hazardsOf(b)[0]!).some(([x]) => x === 12)).toBe(true);
    for (const tick of [NOON, NIGHT]) {
      refused(b, begin(b, undefined, [10, 6], tick), { t: 'kindle', fire: [11, 6], at: [10, 6] }, tick, 'A wolf watches this ground. Not here.');
    }
    const clear = kindle(b, begin(b, undefined, [9, 6]), NOON, [10, 6], [9, 6]);
    expect(clear.state.player.own?.at).toEqual([10, 6]);
    expect(fireArea(b, [10, 6])).toHaveLength(9);
  });

  test('a watch is read from the round alone: a wolf with no round watches nothing by day', () => {
    const b = world([wolf(13, 6)]);
    expect(kindle(b, begin(b), NOON).state.player.own?.at).toEqual(F);
  });

  test('without two logs, from the wrong tile, and under the player\'s own feet', () => {
    const b = world();
    const name = b.items[WOOD]!.name;
    expect(step(b, begin(b, { [WOOD]: 1 }), { t: 'kindle', fire: F, at: P }, NOON)).toEqual({ ok: false, error: `You need 2 ${name}.` });
    expect(step(b, begin(b, { [WOOD]: 2 }, [5, 6]), { t: 'kindle', fire: F, at: [5, 6] }, NOON)).toEqual({ ok: false, error: 'That is too far away.' });
    refused(b, begin(b), { t: 'kindle', fire: P, at: P }, NOON, 'Step off that spot first.');
    expect(step(b, begin(b), { t: 'kindle', fire: [8.5, 6] as unknown as Tile, at: P }, NOON)).toEqual({ ok: false, error: 'Where would the fire go?' });
  });
});

describe('safe while it burns', () => {
  test('its tile and the ring around it are safe until the last tick of burn, and nothing farther is', () => {
    const b = world();
    const r = kindle(b, begin(b), NOON);
    const until = r.state.player.own!.until;
    for (const at of fireArea(b, F)) expect(isSafe(b, r.state, at, NOON)).toBe(true);
    expect(isSafe(b, r.state, [F[0] + 2, F[1]], NOON)).toBe(false);
    expect(isSafe(b, r.state, [F[0], F[1] - 2], NOON)).toBe(false);
    expect(isSafe(b, r.state, F, until - 1)).toBe(true);
    expect(isSafe(b, r.state, F, until)).toBe(false);
    // by default the state's own clock is asked
    expect(isSafe(b, { ...r.state, tick: until }, F)).toBe(false);
    expect(isSafe(b, { ...r.state, tick: until - 1 }, F)).toBe(true);
  });

  test('a chase that reaches its ring ends there, and out of it does not', () => {
    const b = world([wolf(13, 6)]);
    const lit = kindle(b, begin(b, undefined, P, NIGHT), NIGHT).state;
    const seen = ok(b, lit, { t: 'move', at: [11, 6] }, NIGHT + 10_000);
    expect(seen.events.map((e) => e.e)).toContain('seen');
    expect(seen.state.player.chase).not.toBeNull();
    const home = ok(b, seen.state, { t: 'move', at: [9, 6] }, NIGHT + 12_000);
    expect(home.events).toContainEqual({ e: 'safe', id: 'test/wolf', bitten: false });
    expect(home.state.player.chase).toBeNull();

    // the same walk with no fire: the hunt goes on
    const bare = ok(b, begin(b, undefined, P, NIGHT), { t: 'move', at: [11, 6] }, NIGHT + 10_000);
    expect(ok(b, bare.state, { t: 'move', at: [9, 6] }, NIGHT + 12_000).state.player.chase).not.toBeNull();
  });

  test('once it has burned out the ground is hunted again', () => {
    // the wolf reaches x 9..17: the ring's far edge (9, 6) is in its reach, and the player's own tile (7, 6) is not
    const b = world([wolf(13, 6, 4)]);
    const lit = kindle(b, begin(b, undefined, P, NIGHT), NIGHT).state;
    const until = lit.player.own!.until;
    const warm = ok(b, lit, { t: 'move', at: [9, 6] }, until - 1_000);
    expect(warm.events.map((e) => e.e)).not.toContain('seen');
    expect(warm.state.player.chase).toBeNull();
    const cold = ok(b, lit, { t: 'move', at: [9, 6] }, until + 1_000);
    expect(cold.events).toContainEqual({ e: 'seen', id: 'test/wolf' });
    expect(cold.state.player.chase).not.toBeNull();
  });

  test('standing in the ring ends the outing at once, as the camp does', () => {
    const b = world();
    const s = begin(b);
    s.player.outing = { gained: { [WOOD]: 1 }, solved: [], visited: [] };
    expect(kindle(b, s, NOON).state.player.outing).toBeNull();
  });
});

describe('wood by danger', () => {
  test('at d 1 a log lasts log_ms * 100 / 150, fixed into the fire', () => {
    const b = world();
    const { log_ms } = b.params.fire;
    expect(b.params.fire.burn_pct_per_d).toBe(50);
    const log = mulDiv(log_ms, 100, 150);
    expect(log).toBe(Math.floor((log_ms * 100) / 150));
    const lit = kindle(b, begin(b), NOON).state;
    expect(lit.player.own).toMatchObject({ lit: NOON, until: NOON + log, log });
    const fed = feed(b, lit, NOON + 5_000);
    expect(fed.state.player.own!.until).toBe(NOON + 2 * log);
    expect(fed.events).toEqual([
      { e: 'spend', item: WOOD, qty: 1 },
      { e: 'fire', id: OWN_FIRE, until: NOON + 2 * log },
    ]);
  });

  test('the rate is a parameter: 0 keeps log_ms, 100 halves it', () => {
    for (const [pct, expected] of [[0, 100_000], [100, 50_000], [50, 66_666]] as const) {
      const b = world([], (w) => {
        w.params.fire.log_ms = 100_000;
        w.params.fire.burn_pct_per_d = pct;
      });
      expect(kindle(b, begin(b), NOON).state.player.own!.log).toBe(expected);
    }
  });

  test('the fire holds `fire.cap` of its own logs, and the next one fits once one has burned down', () => {
    const b = world();
    const { cap } = b.params.fire;
    let s = kindle(b, begin(b), NOON).state;
    const log = s.player.own!.log;
    const t = NOON + 5_000;
    for (let i = 1; i < cap; i++) s = feed(b, s, t + i).state;
    expect(s.player.own!.until).toBe(NOON + cap * log);
    expect(nextLogAt(b, s, OWN_FIRE, t + cap)).toBe(NOON + log);
    expect(step(b, s, { t: 'feed', fire: OWN_FIRE, item: WOOD, at: P }, t + cap)).toEqual({ ok: false, error: 'The fire is already full.' });
    expect(feed(b, s, NOON + log).state.player.own!.until).toBe(NOON + (cap + 1) * log);
  });

  test('a fire on the map keeps log_ms', () => {
    const hearth: Prop = { id: 'test/hearth', sprite: 'core/base-kit:props/campfire_unlit', x: 12, y: 4, w: 1, h: 1, solid: true, fire: true };
    const b = world([hearth]);
    const fed = ok(b, begin(b, undefined, [11, 4]), { t: 'feed', fire: 'test/hearth', item: WOOD, at: [11, 4] }, NOON);
    expect(fed.state.player.fires['test/hearth']).toEqual({ lit: NOON, until: NOON + b.params.fire.log_ms });
  });
});

describe('feeding it', () => {
  test('there is nothing to feed before it is kindled, and it must be near', () => {
    const b = world();
    refused(b, begin(b), { t: 'feed', fire: OWN_FIRE, item: WOOD, at: P }, NOON, 'There is no fire there.');
    const lit = kindle(b, begin(b), NOON).state;
    expect(step(b, lit, { t: 'feed', fire: OWN_FIRE, item: WOOD, at: [5, 6] }, NOON + 5_000)).toEqual({ ok: false, error: 'That is too far away.' });
  });

  test('a fire that burned out is lit again by a log, in the same place and with the same log', () => {
    const b = world();
    const lit = kindle(b, begin(b), NOON).state;
    const { until, log } = lit.player.own!;
    const relit = feed(b, lit, until + 50_000).state;
    expect(relit.player.own).toEqual({ at: F, lit: until + 50_000, until: until + 50_000 + log, log });
    expect(Object.keys(relit.player.own!)).not.toContain('kept');
  });
});

describe('a second fire', () => {
  test('puts the first out and takes its place; its ground is hunted again', () => {
    const b = world();
    const first = kindle(b, begin(b), NOON).state;
    const second: Tile = [12, 6];
    const moved = ok(b, first, { t: 'move', at: [11, 6] }, NOON + 10_000).state;
    const r = kindle(b, moved, NOON + 12_000, second, [11, 6]);
    expect(r.state.player.own).toMatchObject({ at: second, lit: NOON + 12_000 });
    expect(r.state.player.bag[WOOD]).toBe(16);
    expect(isSafe(b, r.state, second, NOON + 12_000)).toBe(true);
    expect(isSafe(b, r.state, F, NOON + 12_000)).toBe(false);
    expect(Object.keys(r.state.player.fires)).toEqual([]);
  });
});

describe('the long night out in the wild', () => {
  /** The vigil as the player keeps it: kindled at 19:00, fed through the night, looked at at dawn. */
  function night(b: Bundle, skip: readonly number[] = []): State {
    let s = kindle(b, begin(b, { [WOOD]: 30 }, P, 350_000), 350_000).state;
    s.player.quests[QUEST] = 'active';
    s = keep(b, s, 380_000, DAWN + 30_000, skip);
    return s;
  }

  test('a fire kindled before dusk and fed through the night holds at dawn, never before, and stays met until dusk', () => {
    const b = world();
    const s = night(b);
    const at = (tick: number): State => ({ ...s, tick });
    expect(s.player.own!.lit).toBe(350_000);
    expect(tendHolds(b, at(DAWN - 1), OWN_FIRE, DAWN - 1)).toBe(false);
    expect(questSatisfied(b, at(DAWN - 1), QUEST)).toBe(false);
    expect(tendHolds(b, at(DAWN), OWN_FIRE, DAWN)).toBe(true);
    expect(questSatisfied(b, at(DAWN), QUEST)).toBe(true);
    expect(questSatisfied(b, at(DUSK + DAY - 1), QUEST)).toBe(true);
    expect(questSatisfied(b, at(DUSK + DAY), QUEST)).toBe(false);
  });

  test('a gap in the night fails it, and a fire kindled after dusk does too', () => {
    const b = world();
    // one tick of cold between two logs
    const s = kindle(b, begin(b, { [WOOD]: 30 }, P, 350_000), 350_000).state;
    const out = s.player.own!.until;
    s.player.quests[QUEST] = 'active';
    // out at 20:30, relit one tick later: lit after dusk, however well it is fed from there to dawn
    const gap = { ...keep(b, feed(b, s, out + 1).state, out + 31_000, DAWN + 30_000), tick: DAWN };
    expect(gap.player.own!.until).toBeGreaterThanOrEqual(DAWN);
    expect(questSatisfied(b, gap, QUEST)).toBe(false);

    const late = kindle(b, begin(b, { [WOOD]: 30 }, P, DUSK + 1), DUSK + 1).state;
    late.player.quests[QUEST] = 'active';
    const kept = { ...keep(b, late, DUSK + 31_000, DAWN + 30_000), tick: DAWN };
    expect(kept.player.own!.until).toBeGreaterThanOrEqual(DAWN);
    expect(questSatisfied(b, kept, QUEST)).toBe(false);
  });

  test('a fire that went out in the night it was keeping is told once, at the next step', () => {
    const b = world();
    let s = kindle(b, begin(b, { [WOOD]: 30 }, P, 350_000), 350_000).state;
    s.player.quests[QUEST] = 'active';
    s = keep(b, s, 380_000, 500_000);
    const until = s.player.own!.until;
    const r = ok(b, s, { t: 'move', at: P }, until + 5_000);
    expect(r.events).toContainEqual({ e: 'fire_out', id: OWN_FIRE });
    expect(ok(b, r.state, { t: 'move', at: P }, until + 10_000).events.map((e) => e.e)).not.toContain('fire_out');
  });

  test('it counts only while it stands outside the town', () => {
    const b = world();
    const s = night(b);
    s.tick = DAWN;
    expect(questSatisfied(b, s, QUEST)).toBe(true);
    s.player.own!.at = [...TOWN];
    expect(questSatisfied(b, s, QUEST)).toBe(false);
  });

  test('kindling another by day does not undo a night already kept', () => {
    const b = world();
    const s = night(b);
    const morning = DAWN + 40_000;
    const moved = ok(b, s, { t: 'move', at: [11, 6] }, morning).state;
    const r = kindle(b, moved, morning + 1_000, [12, 6], [11, 6]);
    expect(r.state.player.own!.kept).toBe(DAWN);
    expect(r.state.player.own!.lit).toBe(morning + 1_000);
    const held = { ...r.state, tick: morning + 2_000 };
    expect(questSatisfied(b, held, QUEST)).toBe(true);
  });
});

describe('a replay', () => {
  test('agrees with the steps taken one by one', () => {
    const b = world([wolf(13, 6)]);
    const start = begin(b, undefined, P, 350_000);
    const log: { a: Action; tick: number }[] = [
      { a: { t: 'kindle', fire: F, at: P }, tick: 350_000 },
      { a: { t: 'feed', fire: OWN_FIRE, item: WOOD, at: P }, tick: 360_000 },
      { a: { t: 'move', at: [9, 6] }, tick: 440_000 },
      { a: { t: 'move', at: [11, 6] }, tick: 450_000 },
      { a: { t: 'move', at: [9, 6] }, tick: 460_000 },
      { a: { t: 'move', at: P }, tick: 470_000 },
      { a: { t: 'feed', fire: OWN_FIRE, item: WOOD, at: P }, tick: 480_000 },
    ];
    let state = start;
    for (const entry of log) state = ok(b, state, entry.a, entry.tick).state;
    const first = replay(b, start, log);
    const second = replay(b, start, log);
    expect(first.error).toBeUndefined();
    expect(serialize(first.state)).toBe(serialize(state));
    expect(serialize(second.state)).toBe(serialize(first.state));
    expect(first.state.player.own).not.toBeNull();
  });
});
