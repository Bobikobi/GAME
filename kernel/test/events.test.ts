/**
 * What the kernel tells the client for the game's feel (DECISIONS.md, 2026-10-16): a hunt
 * seen and a hunt outrun, the health an outrun hunt leaves, a kept fire that went out, and the record of
 * bites that picks the giver's line at the hand-in. Every world is a copy of the bundle with its own
 * hazards and no hunger drain, as in hazards.test.ts.
 */
import { beforeAll, describe, expect, test } from 'vitest';

import {
  type Action,
  type Bundle,
  type GameEvent,
  type Rect,
  type State,
  type Tile,
  campTile,
  doneLines,
  inRect,
  isSafe,
  makeWalkable,
  mulDiv,
  near,
  newState,
  npcTile,
  replay,
  satietyCap,
  serialize,
  step,
} from '@game/kernel';
import { loadBundle } from '../../tools/test/helpers/world.js';

type Prop = Bundle['map']['props'][number];

const NOON = 100_000;
const NIGHT = 500_000;
const DAWN = 850_000;
const WOLF = 'test/wolf';
/** West of the town's cobbles, in the wolf's reach; one step east is the town, which is safe. */
const OUT: Tile = [21, 7];
const TOWN: Tile = [22, 7];
/** Far from the wolf, by the spawn. */
const FAR: Tile = [6, 18];
const FIRE = 'test/hearth';
const VIGIL = 'test/vigil';
const LOG = 'core/log';
const HEARTH: Tile = [7, 8];
const SOUTH_BANK = 'core/the-south-bank';

let base: Bundle;

beforeAll(() => {
  base = loadBundle();
});

/** A wolf that notices by reach, beside the town (the outrun test of hazards.test.ts). */
function wolf(x = 19, y = 7, reach = 4): Prop {
  return { id: WOLF, sprite: 'core/base-kit:props/standing_stone', x, y, w: 1, h: 1, solid: false, hazard: { kind: 'predator', window: ['night'], reach } };
}

/** The bundle with only these hazards and no hunger drain. */
function world(props: Prop[] = [wolf()], tweak?: (b: Bundle) => void): Bundle {
  const b = structuredClone(base);
  b.map.props = [...b.map.props.filter((p) => !p.hazard), ...props];
  b.params.satiety_drain_per_min = 0;
  tweak?.(b);
  return b;
}

/** The same with a fire at (8, 8) and a quest whose one step keeps it from dusk to dawn (fire.test.ts). */
function hearth(props: Prop[] = []): Bundle {
  const b = world(props);
  b.map.props = [...b.map.props, { id: FIRE, sprite: 'core/base-kit:props/standing_stone', x: 8, y: 8, w: 1, h: 1, solid: true, fire: true }];
  b.quests[VIGIL] = { ...b.quests['core/a-coin-for-maru']!, id: VIGIL, steps: [{ kind: 'tend', fire: FIRE }] };
  return b;
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
  out.player.satietyAt = tick;
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

/** The events of these kinds, in order. */
const only = (events: GameEvent[], ...kinds: GameEvent['e'][]): GameEvent[] => events.filter((e) => kinds.includes(e.e));

/** The kinds of the events, leaving out the quests that move on their own as the player is put about. */
const kinds = (events: GameEvent[]): string[] => events.map((e) => e.e).filter((k) => k !== 'quest');

/** Seen by the wolf on OUT at NIGHT, with health at `pct` percent of the cap. */
function hunted(b: Bundle, pct = 100): State {
  const s = move(b, place(begin(b), OUT, NIGHT), OUT, NIGHT).state;
  s.player.satiety = mulDiv(satietyCap(b, s), pct, 100);
  return s;
}

/** A walkable tile next to `tile`, inside `within` when it is given. */
function beside(b: Bundle, s: State, tile: Tile, within?: Rect): Tile {
  const walkable = makeWalkable(b);
  for (let y = tile[1] - 1; y <= tile[1] + 1; y++) {
    for (let x = tile[0] - 1; x <= tile[0] + 1; x++) {
      if ((x === tile[0] && y === tile[1]) || (within && !inRect(x, y, within))) continue;
      if (walkable(x, y, s.player) && near([x, y], { x: tile[0], y: tile[1], w: 1, h: 1 })) return [x, y];
    }
  }
  throw new Error(`nowhere to stand beside ${tile.join(',')}`);
}

/** At the hearth with logs in the bag and the vigil open (or not). */
function tending(b: Bundle, logs = 3, open = true): State {
  const s = place(begin(b), HEARTH, 0);
  s.player.attrs.carry = 100;
  s.player.bag[LOG] = logs;
  if (open) s.player.quests[VIGIL] = 'active';
  return s;
}

const feed = (b: Bundle, s: State, tick: number) => ok(b, s, { t: 'feed', fire: FIRE, item: LOG, at: HEARTH }, tick);
/** A report from the hearth: time passes and the player stays. */
const wait = (b: Bundle, s: State, tick: number) => move(b, s, HEARTH, tick);

describe('seen', () => {
  test('a hunt that begins is told once, with its predator, and never again while it runs', () => {
    const b = world();
    const start = move(b, place(begin(b), OUT, NIGHT), OUT, NIGHT);
    expect(only(start.events, 'seen')).toEqual([{ e: 'seen', id: WOLF }]);
    expect(start.state.player.chase).toEqual({ hazard: WOLF, since: NIGHT, bites: 0 });
    let s = start.state;
    // reports while it runs, and two bites
    for (const t of [NIGHT + 500, NIGHT + 2500, NIGHT + 4600]) {
      const r = move(b, s, OUT, t);
      expect(only(r.events, 'seen'), String(t)).toEqual([]);
      s = r.state;
    }
    expect(s.player.chase).toEqual({ hazard: WOLF, since: NIGHT, bites: 2 });
  });

  test('a new hunt after one was outrun is told again', () => {
    const b = world();
    const safe = move(b, hunted(b), TOWN, NIGHT + 1000).state;
    expect(safe.player.chase).toBeNull();
    const again = move(b, safe, OUT, NIGHT + 2000);
    expect(only(again.events, 'seen')).toEqual([{ e: 'seen', id: WOLF }]);
    expect(again.state.player.chase).toEqual({ hazard: WOLF, since: NIGHT + 2000, bites: 0 });
  });

  test('nothing is told by day, out of reach, or on safe ground in reach', () => {
    const b = world();
    const day = move(b, place(begin(b), OUT, NOON), OUT, NOON);
    const far = move(b, place(begin(b), FAR, NIGHT), FAR, NIGHT);
    const town = move(b, place(begin(b), TOWN, NIGHT), TOWN, NIGHT);
    for (const r of [day, far, town]) {
      expect(only(r.events, 'seen')).toEqual([]);
      expect(r.state.player.chase).toBeNull();
    }
  });
});

describe('safe', () => {
  test('a hunt outrun before its first bite is told safe and not bitten', () => {
    const b = world();
    const r = move(b, hunted(b), TOWN, NIGHT + 1000);
    expect(only(r.events, 'seen', 'hurt', 'safe')).toEqual([{ e: 'safe', id: WOLF, bitten: false }]);
    expect(r.state.player.chase).toBeNull();
    expect(r.state.player.outing).toBeNull();
  });

  test('a hunt that bit is told safe and bitten: a bite on the way lands first, an earlier bite counts too', () => {
    const b = world();
    const onTheWay = move(b, hunted(b), TOWN, NIGHT + 2600);
    expect(kinds(onTheWay.events)).toEqual(['hurt', 'safe']);
    expect(only(onTheWay.events, 'safe')).toEqual([{ e: 'safe', id: WOLF, bitten: true }]);

    const bitten = move(b, hunted(b), OUT, NIGHT + 2600).state;
    expect(bitten.player.chase?.bites).toBe(1);
    const home = move(b, bitten, TOWN, NIGHT + 3000);
    expect(kinds(home.events)).toEqual(['safe']);
    expect(only(home.events, 'safe')).toEqual([{ e: 'safe', id: WOLF, bitten: true }]);
  });

  test('a hunt that ends at dawn, in a fall or with its predator gone is not told safe, nor is the safe tile after', () => {
    const b = world();
    const early = move(b, place(begin(b), OUT, DAWN - 1000), OUT, DAWN - 1000).state;
    expect(early.player.chase).not.toBeNull();
    const morning = move(b, early, TOWN, DAWN + 60_000);
    expect(morning.state.player.chase).toBeNull();

    // health at one bite: the bite due on the way takes the last of it before the cobbles
    const fell = move(b, hunted(b, 25), TOWN, NIGHT + 2600);
    expect(kinds(fell.events)).toEqual(['hurt', 'fall']);

    const lost = hunted(b);
    lost.player.chase = { hazard: 'test/gone', since: NIGHT, bites: 1 };
    const gone = move(b, lost, TOWN, NIGHT + 3000);
    expect(gone.state.player.chase).toBeNull();

    for (const r of [morning, fell, gone]) {
      expect(only(r.events, 'safe')).toEqual([]);
      expect(only(move(b, r.state, r.state.player.at, r.state.tick + 1000).events, 'safe')).toEqual([]);
    }
  });

  test('a camp part built under a hunt makes the ground safe: the hunt ends there, told safe', () => {
    const b = world();
    const camp = b.map.slots.find((x) => x.kind === 'camp')!;
    const fire = campTile(b, b.camps['core/campfire']!.slot)!;
    const at = beside(b, begin(b), fire, camp);
    const s = place(begin(b), at, NIGHT);
    expect(isSafe(b, s, at)).toBe(false);
    const cap = satietyCap(b, s);
    s.player.bag[LOG] = 2;
    s.player.chase = { hazard: WOLF, since: NIGHT - 1000, bites: 0 };
    s.player.satiety = mulDiv(cap, 30, 100);
    const r = ok(b, s, { t: 'build', camp: 'core/campfire', at }, NIGHT);
    expect(only(r.events, 'build', 'safe')).toEqual([
      { e: 'build', camp: 'core/campfire' },
      { e: 'safe', id: WOLF, bitten: false },
    ]);
    expect(r.state.player.chase).toBeNull();
    expect(r.state.player.satiety).toBe(mulDiv(cap, 7500, 10_000));
  });
});

describe('health after a hunt', () => {
  test('the core params leave three quarters of the cap', () => {
    expect(base.params.hazard.predator.refill_bp).toBe(7500);
  });

  test('a hunt outrun lifts health to three quarters of the cap, after the bites it made', () => {
    const b = world();
    const cap = satietyCap(b, begin(b));
    const threeQuarters = mulDiv(cap, 7500, 10_000);
    // hurt before the hunt, no bite
    expect(move(b, hunted(b, 30), TOWN, NIGHT + 1000).state.player.satiety).toBe(threeQuarters);
    // two bites from full health: half is left on the cobbles, and three quarters after
    const twice = move(b, hunted(b), TOWN, NIGHT + 4600);
    expect(only(twice.events, 'hurt')).toEqual([{ e: 'hurt', by: 'predator', id: WOLF, hp: cap / 2 }]);
    expect(twice.state.player.satiety).toBe(threeQuarters);
    // three bites, a quarter left
    expect(move(b, hunted(b), TOWN, NIGHT + 6600).state.player.satiety).toBe(threeQuarters);
  });

  test('health at or above three quarters stays where it is', () => {
    const b = world();
    const cap = satietyCap(b, begin(b));
    expect(move(b, hunted(b, 90), TOWN, NIGHT + 1000).state.player.satiety).toBe(mulDiv(cap, 90, 100));
    expect(move(b, hunted(b), TOWN, NIGHT + 1000).state.player.satiety).toBe(cap);
    // one bite from full is exactly three quarters
    expect(move(b, hunted(b), TOWN, NIGHT + 2600).state.player.satiety).toBe(mulDiv(cap, 7500, 10_000));
  });

  test('no hunt outrun, no refill: safe ground by day, a hunt ended at dawn, a fall', () => {
    const b = world();
    const cap = satietyCap(b, begin(b));
    const low = mulDiv(cap, 30, 100);
    const day = place(begin(b), OUT, NOON);
    day.player.satiety = low;
    expect(move(b, move(b, day, OUT, NOON).state, TOWN, NOON + 1000).state.player.satiety).toBe(low);

    const early = move(b, place(begin(b), OUT, DAWN - 1000), OUT, DAWN - 1000).state;
    early.player.satiety = low;
    expect(move(b, early, TOWN, DAWN + 60_000).state.player.satiety).toBe(low);

    // a fall wakes the player whole (G33), and that is the fall's, not the refill's
    expect(move(b, hunted(b, 25), TOWN, NIGHT + 2600).state.player.satiety).toBe(cap);
  });

  test('the refill is the param: a full one and a half one', () => {
    const full = world([wolf()], (b) => {
      b.params.hazard.predator.refill_bp = 10_000;
    });
    expect(move(full, hunted(full, 30), TOWN, NIGHT + 1000).state.player.satiety).toBe(satietyCap(full, begin(full)));
    const half = world([wolf()], (b) => {
      b.params.hazard.predator.refill_bp = 5000;
    });
    expect(move(half, hunted(half, 30), TOWN, NIGHT + 1000).state.player.satiety).toBe(mulDiv(satietyCap(half, begin(half)), 5000, 10_000));
  });
});

describe('a kept fire that goes out', () => {
  test('is told once, at the first step at or after its until, before anything else', () => {
    const b = hearth();
    const lit = feed(b, tending(b), 10).state;
    const until = lit.player.fires[FIRE]!.until;
    const before = wait(b, lit, until - 1);
    expect(only(before.events, 'fire_out')).toEqual([]);
    const after = wait(b, before.state, until + 5000);
    expect(after.events[0]).toEqual({ e: 'fire_out', id: FIRE });
    expect(only(after.events, 'fire_out')).toHaveLength(1);
    // never again for that burn, however the steps come
    let s = after.state;
    for (const t of [until + 5000, until + 6000, until + 600_000]) {
      const r = wait(b, s, t);
      expect(only(r.events, 'fire_out'), String(t)).toEqual([]);
      s = r.state;
    }
    // a step at until itself tells it: the fire no longer burns then
    expect(only(wait(b, lit, until).events, 'fire_out')).toEqual([{ e: 'fire_out', id: FIRE }]);
  });

  test('a fire fed in time is not told, and is told once when its longer burn ends', () => {
    const b = hearth();
    const L = b.params.fire.log_ms;
    const fed = feed(b, feed(b, tending(b), 10).state, L - 1000).state;
    expect(fed.player.fires[FIRE]).toEqual({ lit: 10, until: 10 + 2 * L });
    const pastFirst = wait(b, fed, 10 + L + 1);
    expect(only(pastFirst.events, 'fire_out')).toEqual([]);
    expect(only(wait(b, pastFirst.state, 10 + 2 * L).events, 'fire_out')).toEqual([{ e: 'fire_out', id: FIRE }]);
  });

  test('a relit fire is a new burn: the out is told before the feed that relights it, and the new burn once more', () => {
    const b = hearth();
    const first = feed(b, tending(b), 10).state;
    const until = first.player.fires[FIRE]!.until;
    const relit = feed(b, first, until + 1000);
    expect(kinds(relit.events)).toEqual(['fire_out', 'spend', 'fire']);
    const second = relit.state.player.fires[FIRE]!.until;
    expect(second).toBe(until + 1000 + b.params.fire.log_ms);
    expect(only(wait(b, relit.state, second).events, 'fire_out')).toEqual([{ e: 'fire_out', id: FIRE }]);
  });

  test('a fire no open quest keeps is not told: before the vigil is taken, and after it is done', () => {
    const b = hearth();
    const untaken = feed(b, tending(b, 3, false), 10).state;
    const until = untaken.player.fires[FIRE]!.until;
    expect(only(wait(b, untaken, until).events, 'fire_out')).toEqual([]);
    const done = structuredClone(untaken);
    done.player.quests[VIGIL] = 'done';
    expect(only(wait(b, done, until).events, 'fire_out')).toEqual([]);
  });

  test('a refused step tells nothing, and the next step tells it', () => {
    const b = hearth();
    const lit = feed(b, tending(b, 1), 10).state;
    const until = lit.player.fires[FIRE]!.until;
    expect(step(b, lit, { t: 'feed', fire: FIRE, item: LOG, at: HEARTH }, until + 10)).toEqual({ ok: false, error: 'You do not have any.' });
    expect(only(wait(b, lit, until + 20).events, 'fire_out')).toEqual([{ e: 'fire_out', id: FIRE }]);
  });
});

describe('the record of bites and the line at the hand-in', () => {
  test('a bite marks the quests open when it lands, and only those, for good', () => {
    const b = world();
    const s = hunted(b);
    s.player.quests[SOUTH_BANK] = 'active';
    s.player.quests['core/herbs-for-pell'] = 'done';
    const open = Object.keys(s.player.quests).filter((id) => s.player.quests[id] === 'active').sort();
    const bite = move(b, s, OUT, NIGHT + 2500).state;
    expect(bite.player.bitten).toEqual(open);
    expect(bite.player.bitten).toContain(SOUTH_BANK);
    expect(bite.player.bitten).not.toContain('core/herbs-for-pell');
    // a quest taken after the last bite is not marked
    bite.player.quests['core/a-coin-for-maru'] = 'active';
    const home = move(b, bite, TOWN, NIGHT + 3000).state;
    expect(home.player.bitten).toEqual(open);
    // a fall keeps the record: the bite happened
    const weak = hunted(b, 25);
    weak.player.quests[SOUTH_BANK] = 'active';
    const fell = move(b, weak, TOWN, NIGHT + 2600).state;
    expect(fell.player.falls).toBe(1);
    expect(fell.player.bitten).toContain(SOUTH_BANK);
  });

  test('a hunt that never bit marks nothing', () => {
    const b = world();
    const s = hunted(b);
    s.player.quests[SOUTH_BANK] = 'active';
    expect(move(b, s, TOWN, NIGHT + 1000).state.player.bitten).toEqual([]);
  });

  test("the hand-in line follows the record: Pell's line for a bitten hand-in, the plain one otherwise", () => {
    const b = world();
    const s = begin(b);
    const talk = b.quests[SOUTH_BANK]!.talk!;
    expect(talk.done_bitten).toHaveLength(1);
    expect(talk.done_bitten![0]).not.toBe(talk.done![0]);
    expect(doneLines(b, s, SOUTH_BANK)).toEqual(talk.done);
    expect(doneLines(b, { ...s, player: { ...s.player, bitten: [SOUTH_BANK] } }, SOUTH_BANK)).toEqual(talk.done_bitten);
    // a quest with no bitten line keeps its one line either way
    const plain = 'core/herbs-for-pell';
    expect(b.quests[plain]!.talk?.done_bitten).toBeUndefined();
    expect(doneLines(b, { ...s, player: { ...s.player, bitten: [plain] } }, plain)).toEqual(b.quests[plain]!.talk?.done);
    // a state from before the record has the plain line
    const old = structuredClone(s);
    delete (old.player as Partial<State['player']>).bitten;
    expect(doneLines(b, old, SOUTH_BANK)).toEqual(talk.done);
  });

  test('bitten on the way to Pell and handed in at her stall: told safe and bitten, and her line says so', () => {
    const b = world();
    const tile = npcTile(b, 'core/trader')!;
    const at = beside(b, begin(b), tile);
    const s = place(begin(b), at, NIGHT);
    expect(isSafe(b, s, at)).toBe(true);
    s.player.quests['core/herbs-for-pell'] = 'done';
    s.player.quests[SOUTH_BANK] = 'active';
    s.player.bag['core/moonreed'] = 1;
    // the wolf has had the player's scent long enough for one bite on arrival
    s.player.chase = { hazard: WOLF, since: NIGHT - 2600, bites: 0 };
    const r = ok(b, s, { t: 'turnin', quest: SOUTH_BANK, at }, NIGHT);
    expect(only(r.events, 'hurt', 'safe').map((e) => e.e)).toEqual(['hurt', 'safe']);
    expect(only(r.events, 'safe')).toEqual([{ e: 'safe', id: WOLF, bitten: true }]);
    expect(r.events).toContainEqual({ e: 'quest', quest: SOUTH_BANK, state: 'done' });
    expect(doneLines(b, r.state, SOUTH_BANK)).toEqual(b.quests[SOUTH_BANK]!.talk!.done_bitten);
  });
});

describe('a replay and an old save', () => {
  /** Light the hearth, walk out into the wolf's reach after the fire went out, take two bites, outrun it. */
  const LOG_OF_A_NIGHT: readonly { a: Action; tick: number }[] = [
    { a: { t: 'feed', fire: FIRE, item: LOG, at: HEARTH }, tick: 10 },
    { a: { t: 'move', at: OUT }, tick: NIGHT },
    { a: { t: 'move', at: OUT }, tick: NIGHT + 4600 },
    { a: { t: 'move', at: TOWN }, tick: NIGHT + 5000 },
  ];

  test('the same log tells the same events and leaves the same state, however it is cut (R4)', () => {
    const b = hearth([wolf()]);
    const start = tending(b);
    const cap = satietyCap(b, start);
    const one = replay(b, start, LOG_OF_A_NIGHT);
    const two = replay(b, start, LOG_OF_A_NIGHT);
    expect(one.error).toBeUndefined();
    expect(serialize(one.state)).toBe(serialize(two.state));
    expect(one.events).toEqual(two.events);
    expect(only(one.events, 'fire_out', 'seen', 'hurt', 'safe')).toEqual([
      { e: 'fire_out', id: FIRE },
      { e: 'seen', id: WOLF },
      { e: 'hurt', by: 'predator', id: WOLF, hp: cap / 2 },
      { e: 'safe', id: WOLF, bitten: true },
    ]);
    expect(one.state.player.satiety).toBe(mulDiv(cap, 7500, 10_000));
    expect(one.state.player.bitten).toContain(VIGIL);
    // saved after any step and played on from the save: the same events, the same state
    for (let cut = 1; cut < LOG_OF_A_NIGHT.length; cut++) {
      const head = replay(b, start, LOG_OF_A_NIGHT.slice(0, cut));
      const tail = replay(b, JSON.parse(serialize(head.state)) as State, LOG_OF_A_NIGHT.slice(cut));
      expect(tail.error).toBeUndefined();
      expect([...head.events, ...tail.events]).toEqual(one.events);
      expect(serialize(tail.state)).toBe(serialize(one.state));
    }
  });

  test('a save from 0.8.0 loads: no record of bites yet, and a fire that went out before it is not told', () => {
    const b = hearth([wolf()]);
    const lit = feed(b, tending(b), 10).state;
    const until = lit.player.fires[FIRE]!.until;
    const old = (s: State, tick: number): State => {
      const out = place(s, s.player.at, tick);
      out.kernel = '0.8.0';
      delete (out.player as Partial<State['player']>).bitten;
      return out;
    };
    // saved before the fire went out: told at the next step; saved after: never told
    expect(only(wait(b, old(lit, until - 10), until + 20).events, 'fire_out')).toEqual([{ e: 'fire_out', id: FIRE }]);
    expect(only(wait(b, old(lit, until + 10), until + 20).events, 'fire_out')).toEqual([]);

    // hunted in the old save: the first bite starts the record, and a replay agrees
    const hunt = old(move(b, place(lit, OUT, NIGHT), OUT, NIGHT).state, NIGHT);
    expect(hunt.player.bitten).toBeUndefined();
    const log = LOG_OF_A_NIGHT.slice(2);
    const one = replay(b, hunt, log);
    const two = replay(b, hunt, log);
    expect(one.error).toBeUndefined();
    expect(one.state.player.bitten).toContain(VIGIL);
    expect(only(one.events, 'safe')).toEqual([{ e: 'safe', id: WOLF, bitten: true }]);
    expect(serialize(one.state)).toBe(serialize(two.state));
    expect(one.events).toEqual(two.events);
  });
});
