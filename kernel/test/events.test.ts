/**
 * What the kernel tells the client for the game's feel (DECISIONS.md, 2026-10-16): a hunt
 * seen and a hunt outrun, the health an outrun hunt gives back, a kept fire gone out in the night it kept,
 * and the record of bites that picks the giver's line at the hand-in. Every world is a copy of the bundle
 * with its own hazards and no hunger drain, as in hazards.test.ts.
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
  hpCap,
  serialize,
  step,
  tendHolds,
} from '@game/kernel';
import { loadBundle } from '../../tools/test/helpers/world.js';

type Prop = Bundle['map']['props'][number];

/** Tick 0 is noon and a game hour is 50,000 ticks: night runs from 400,000 (20:00) to 850,000 (05:00). */
const HOUR = 50_000;
const NOON = 100_000;
const EVE = 350_000;
const DUSK = 400_000;
const LATE = 450_000;
const NIGHT = 500_000;
const LATER = 550_000;
const DAWN = 850_000;
/** A log burns two game hours, and a fire holds three (set in `hearth`, so the content's tuning does not move these). */
const LOG_MS = 2 * HOUR;
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
  tweak?.(b);
  return b;
}

/**
 * The same with a fire at (8, 8) and a quest whose one step keeps it from dusk to dawn (fire.test.ts):
 * a log burns two hours and the fire holds three.
 */
function hearth(props: Prop[] = [], tweak?: (b: Bundle) => void): Bundle {
  const b = world(props);
  b.params.fire = { ...b.params.fire, cap: 3, log_ms: LOG_MS };
  b.map.props = [...b.map.props, { id: FIRE, sprite: 'core/base-kit:props/standing_stone', x: 8, y: 8, w: 1, h: 1, solid: true, fire: true }];
  b.quests[VIGIL] = { ...b.quests['core/a-coin-for-maru']!, id: VIGIL, steps: [{ kind: 'tend', fire: FIRE }] };
  tweak?.(b);
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
  s.player.hp = mulDiv(hpCap(b, s), pct, 100);
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
  s.player.attrs.might = 100;
  s.player.bag[LOG] = logs;
  if (open) s.player.quests[VIGIL] = 'active';
  return s;
}

const feed = (b: Bundle, s: State, tick: number) => ok(b, s, { t: 'feed', fire: FIRE, item: LOG, at: HEARTH }, tick);
/** `logs` logs into the hearth at one tick. */
function light(b: Bundle, s: State, tick: number, logs: number): State {
  let out = s;
  for (let i = 0; i < logs; i++) out = feed(b, out, tick).state;
  return out;
}
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

  test('a camp part built under a hunt makes the ground safe: the hunt ends there, told safe, and gives its bites back', () => {
    const b = world();
    const camp = b.map.slots.find((x) => x.kind === 'camp')!;
    const fire = campTile(b, b.camps['core/campfire']!.slot)!;
    const at = beside(b, begin(b), fire, camp);
    const s = place(begin(b), at, NIGHT);
    expect(isSafe(b, s, at)).toBe(false);
    const cap = hpCap(b, s);
    s.player.bag[LOG] = 2;
    // two bites fall due as the player stops to build
    s.player.chase = { hazard: WOLF, since: NIGHT - 4600, bites: 0 };
    const r = ok(b, s, { t: 'build', camp: 'core/campfire', at }, NIGHT);
    expect(only(r.events, 'hurt', 'build', 'safe')).toEqual([
      { e: 'hurt', by: 'predator', id: WOLF, hp: cap / 2 },
      { e: 'build', camp: 'core/campfire' },
      { e: 'safe', id: WOLF, bitten: true },
    ]);
    expect(r.state.player.chase).toBeNull();
    expect(r.state.player.hp).toBe(mulDiv(cap, 7500, 10_000));
  });
});

describe('health after a hunt', () => {
  test('the core params cap what a hunt gives back at three quarters of the cap', () => {
    expect(base.params.hazard.predator.refill_bp).toBe(7500);
  });

  test('a hunt outrun gives back what its bites took, up to three quarters of the cap', () => {
    const b = world();
    const cap = hpCap(b, begin(b));
    const pct = (n: number) => mulDiv(cap, n, 100);
    // two bites from full: half is left on the cobbles, and three quarters after
    const twice = move(b, hunted(b), TOWN, NIGHT + 4600);
    expect(only(twice.events, 'hurt')).toEqual([{ e: 'hurt', by: 'predator', id: WOLF, hp: pct(50) }]);
    expect(twice.state.player.hp).toBe(pct(75));
    // three bites from full, a quarter left: three quarters after
    expect(move(b, hunted(b), TOWN, NIGHT + 6600).state.player.hp).toBe(pct(75));
    // hurt before the hunt: the bites come back, the hurt from before does not
    expect(move(b, hunted(b, 60), TOWN, NIGHT + 4600).state.player.hp).toBe(pct(60));
    expect(move(b, hunted(b, 40), TOWN, NIGHT + 2600).state.player.hp).toBe(pct(40));
  });

  test('a hunt that never bit gives nothing back: stepping in and out of reach heals nothing', () => {
    const b = world();
    const low = mulDiv(hpCap(b, begin(b)), 30, 100);
    let s = hunted(b, 30);
    for (const t of [NIGHT + 1000, NIGHT + 3000, NIGHT + 5000]) {
      const home = move(b, s, TOWN, t);
      expect(only(home.events, 'safe')).toEqual([{ e: 'safe', id: WOLF, bitten: false }]);
      expect(home.state.player.hp).toBe(low);
      const out = move(b, home.state, OUT, t + 1000);
      expect(only(out.events, 'seen')).toEqual([{ e: 'seen', id: WOLF }]);
      s = out.state;
    }
  });

  test('health at or above three quarters stays where it is', () => {
    const b = world();
    const cap = hpCap(b, begin(b));
    expect(move(b, hunted(b, 90), TOWN, NIGHT + 1000).state.player.hp).toBe(mulDiv(cap, 90, 100));
    expect(move(b, hunted(b), TOWN, NIGHT + 1000).state.player.hp).toBe(cap);
    // one bite from full leaves three quarters, and two bites from 90% come back only that far
    expect(move(b, hunted(b), TOWN, NIGHT + 2600).state.player.hp).toBe(mulDiv(cap, 7500, 10_000));
    expect(move(b, hunted(b, 90), TOWN, NIGHT + 4600).state.player.hp).toBe(mulDiv(cap, 7500, 10_000));
  });

  test('no hunt outrun, nothing given back: safe ground by day, a hunt ended at dawn, a fall', () => {
    const b = world();
    const cap = hpCap(b, begin(b));
    const low = mulDiv(cap, 30, 100);
    const day = place(begin(b), OUT, NOON);
    day.player.hp = low;
    expect(move(b, move(b, day, OUT, NOON).state, TOWN, NOON + 1000).state.player.hp).toBe(low);

    const early = move(b, place(begin(b), OUT, DAWN - 1000), OUT, DAWN - 1000).state;
    early.player.hp = low;
    expect(move(b, early, TOWN, DAWN + 60_000).state.player.hp).toBe(low);

    // a fall wakes the player whole (G33), and that is the fall's, not the hunt's
    expect(move(b, hunted(b, 25), TOWN, NIGHT + 2600).state.player.hp).toBe(cap);
  });

  test('the cap of what comes back is the param: a whole bar and half of one', () => {
    // three bites from full leave a quarter
    const full = world([wolf()], (b) => {
      b.params.hazard.predator.refill_bp = 10_000;
    });
    expect(move(full, hunted(full), TOWN, NIGHT + 6600).state.player.hp).toBe(hpCap(full, begin(full)));
    const half = world([wolf()], (b) => {
      b.params.hazard.predator.refill_bp = 5000;
    });
    expect(move(half, hunted(half), TOWN, NIGHT + 6600).state.player.hp).toBe(mulDiv(hpCap(half, begin(half)), 5000, 10_000));
  });
});

describe('a kept fire that goes out', () => {
  test('in the night it keeps, it is told once, at the first step at or after its until, before anything else', () => {
    const b = hearth();
    const lit = light(b, tending(b), EVE, 3);
    const until = EVE + 3 * LOG_MS;
    expect(lit.player.fires[FIRE]).toEqual({ lit: EVE, until });
    const before = wait(b, lit, until - 1);
    expect(only(before.events, 'fire_out')).toEqual([]);
    const after = wait(b, before.state, until + 5000);
    expect(after.events[0]).toEqual({ e: 'fire_out', id: FIRE });
    expect(only(after.events, 'fire_out')).toHaveLength(1);
    // never again for that burn, however the steps come
    let s = after.state;
    for (const t of [until + 6000, until + 7000, until + 600_000]) {
      const r = wait(b, s, t);
      expect(only(r.events, 'fire_out'), String(t)).toEqual([]);
      s = r.state;
    }
    // a step at until itself tells it: the fire no longer burns then
    expect(only(wait(b, lit, until).events, 'fire_out')).toEqual([{ e: 'fire_out', id: FIRE }]);
  });

  test('a night kept to dawn tells nothing: not at dawn when the wood runs out, not after, and not at the hand-in', () => {
    const b = hearth();
    // three logs at 19:00, one at 21:00 and one at 23:00: the wood runs out at 05:00
    const fed = feed(b, feed(b, light(b, tending(b, 5), EVE, 3), LATE).state, LATER).state;
    expect(fed.player.fires[FIRE]).toEqual({ lit: EVE, until: DAWN });
    for (const t of [DAWN - 1000, DAWN, DAWN + HOUR]) expect(only(wait(b, fed, t).events, 'fire_out'), String(t)).toEqual([]);
    expect(tendHolds(b, fed, FIRE, DAWN)).toBe(true);
    // handed in at dawn, the step after the last log
    const at = beside(b, fed, npcTile(b, b.quests[VIGIL]!.giver!)!);
    const handIn = ok(b, fed, { t: 'turnin', quest: VIGIL, at }, DAWN);
    expect(handIn.events).toContainEqual({ e: 'quest', quest: VIGIL, state: 'done' });
    expect(only(handIn.events, 'fire_out')).toEqual([]);
  });

  test('an out by day or before dusk loses no night, so it is not told; a fire relit before dusk keeps the night again', () => {
    const b = hearth();
    // by day: lit at 14:00, out at 16:00
    const day = feed(b, tending(b), NOON).state;
    expect(only(wait(b, day, NOON + LOG_MS + 1000).events, 'fire_out')).toEqual([]);
    // before dusk: one log at 17:00 is out at 19:00
    const early = feed(b, tending(b, 4), DUSK - 3 * HOUR).state;
    expect(early.player.fires[FIRE]!.until).toBe(DUSK - HOUR);
    const out = wait(b, early, DUSK - HOUR + 10_000);
    expect(only(out.events, 'fire_out')).toEqual([]);
    // relit at 19:30 with three logs, it burns at dusk and goes out at 01:30: that night is lost
    const relitAt = DUSK - HOUR / 2;
    const relit = light(b, out.state, relitAt, 3);
    expect(relit.player.fires[FIRE]).toEqual({ lit: relitAt, until: relitAt + 3 * LOG_MS });
    expect(only(wait(b, relit, NIGHT).events, 'fire_out')).toEqual([]);
    expect(only(wait(b, relit, relitAt + 3 * LOG_MS + 1000).events, 'fire_out')).toEqual([{ e: 'fire_out', id: FIRE }]);
  });

  test('a fire lit after dusk keeps no night: its out is not told, nor the out of a fire relit after its night was lost', () => {
    const b = hearth();
    const late = light(b, tending(b), LATE, 3);
    expect(only(wait(b, late, LATE + 3 * LOG_MS + 1000).events, 'fire_out')).toEqual([]);
    // the night is lost at 01:00 and told once, before the feed that relights it; the new burn's out is not told again
    const kept = light(b, tending(b, 4), EVE, 3);
    const relit = feed(b, kept, EVE + 3 * LOG_MS + HOUR / 2);
    expect(kinds(relit.events)).toEqual(['fire_out', 'spend', 'fire']);
    const second = relit.state.player.fires[FIRE]!;
    expect(second).toEqual({ lit: EVE + 3 * LOG_MS + HOUR / 2, until: EVE + 4 * LOG_MS + HOUR / 2 });
    expect(only(wait(b, relit.state, second.until).events, 'fire_out')).toEqual([]);
  });

  test('a fire fed in time is not told, and is told once when its longer burn ends in the night', () => {
    const b = hearth();
    const fed = feed(b, light(b, tending(b, 4), EVE, 3), LATE).state;
    expect(fed.player.fires[FIRE]).toEqual({ lit: EVE, until: EVE + 4 * LOG_MS });
    const pastFirst = wait(b, fed, EVE + 3 * LOG_MS + 1);
    expect(only(pastFirst.events, 'fire_out')).toEqual([]);
    expect(only(wait(b, pastFirst.state, EVE + 4 * LOG_MS).events, 'fire_out')).toEqual([{ e: 'fire_out', id: FIRE }]);
  });

  test('a fire no open quest keeps is not told: before the vigil is taken, and after it is done', () => {
    const b = hearth();
    const untaken = light(b, tending(b, 3, false), EVE, 3);
    const until = EVE + 3 * LOG_MS;
    expect(only(wait(b, untaken, until).events, 'fire_out')).toEqual([]);
    const done = structuredClone(untaken);
    done.player.quests[VIGIL] = 'done';
    expect(only(wait(b, done, until).events, 'fire_out')).toEqual([]);
    // the same burn with the vigil open is told: the open quest is what keeps it
    const open = structuredClone(untaken);
    open.player.quests[VIGIL] = 'active';
    expect(only(wait(b, open, until).events, 'fire_out')).toEqual([{ e: 'fire_out', id: FIRE }]);
  });

  test('a refused step tells nothing, and the next step tells it', () => {
    const b = hearth();
    // one log at 19:00 is out at 21:00, in the night it keeps
    const lit = feed(b, tending(b, 1), EVE).state;
    const until = EVE + LOG_MS;
    expect(step(b, lit, { t: 'feed', fire: FIRE, item: LOG, at: HEARTH }, until + 10)).toEqual({ ok: false, error: 'You do not have any.' });
    expect(only(wait(b, lit, until + 20).events, 'fire_out')).toEqual([{ e: 'fire_out', id: FIRE }]);
  });

  test('two kept fires gone out between the same two steps are told in the order of their ids', () => {
    const BRAZIER = 'test/a-brazier';
    const b = hearth([], (x) => {
      x.map.props = [...x.map.props, { id: BRAZIER, sprite: 'core/base-kit:props/standing_stone', x: 10, y: 8, w: 1, h: 1, solid: true, fire: true }];
      x.quests[VIGIL] = { ...x.quests[VIGIL]!, steps: [{ kind: 'tend', fire: FIRE }, { kind: 'tend', fire: BRAZIER }] };
    });
    const s = tending(b);
    s.player.fires = { [FIRE]: { lit: EVE, until: LATER + 2 * HOUR }, [BRAZIER]: { lit: EVE, until: LATER + 3 * HOUR } };
    expect(only(wait(b, s, LATER + 4 * HOUR).events, 'fire_out')).toEqual([
      { e: 'fire_out', id: BRAZIER },
      { e: 'fire_out', id: FIRE },
    ]);
  });
});

describe('the record of bites and the line at the hand-in', () => {
  test('a bite marks the quests open when it lands on the outing, and they join the record when the outing comes home', () => {
    const b = world();
    const s = hunted(b);
    s.player.quests[SOUTH_BANK] = 'active';
    s.player.quests['core/herbs-for-pell'] = 'done';
    const open = Object.keys(s.player.quests).filter((id) => s.player.quests[id] === 'active').sort();
    const bite = move(b, s, OUT, NIGHT + 2600).state;
    expect(bite.player.outing?.bitten).toEqual(open);
    expect(bite.player.bitten).toEqual([]);
    // a quest taken after the last bite is not marked
    bite.player.quests['core/a-coin-for-maru'] = 'active';
    const home = move(b, bite, TOWN, NIGHT + 3000).state;
    expect(home.player.outing).toBeNull();
    expect(home.player.bitten).toEqual(open);
    expect(home.player.bitten).toContain(SOUTH_BANK);
    expect(home.player.bitten).not.toContain('core/herbs-for-pell');
  });

  test('a fall drops the bites of the outing it ends (G33), and the record already brought home stays', () => {
    const b = world();
    const talk = b.quests[SOUTH_BANK]!.talk!;
    // bitten to a fall: the bite goes with the outing, and the giver has the plain line
    const weak = hunted(b, 25);
    weak.player.quests[SOUTH_BANK] = 'active';
    const fell = move(b, weak, TOWN, NIGHT + 2600);
    expect(only(fell.events, 'fall')).toHaveLength(1);
    expect(fell.state.player.bitten).toEqual([]);
    expect(doneLines(b, fell.state, SOUTH_BANK)).toEqual(talk.done);

    // bitten and outrun: the record holds the south bank, and a later fall does not take it
    const s = hunted(b);
    s.player.quests[SOUTH_BANK] = 'active';
    const home = move(b, s, TOWN, NIGHT + 2600).state;
    expect(home.player.bitten).toContain(SOUTH_BANK);
    const again = move(b, home, OUT, NIGHT + 10_000).state;
    again.player.hp = mulDiv(hpCap(b, again), 25, 100);
    const down = move(b, again, OUT, NIGHT + 12_600);
    expect(only(down.events, 'fall')).toHaveLength(1);
    expect(down.state.player.bitten).toEqual(home.player.bitten);
    expect(doneLines(b, down.state, SOUTH_BANK)).toEqual(talk.done_bitten);
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
    // the wolf has had the player's scent long enough for one bite on arrival; with no outing to carry it, the bite is recorded at once
    s.player.chase = { hazard: WOLF, since: NIGHT - 2600, bites: 0 };
    const r = ok(b, s, { t: 'turnin', quest: SOUTH_BANK, at }, NIGHT);
    expect(only(r.events, 'hurt', 'safe').map((e) => e.e)).toEqual(['hurt', 'safe']);
    expect(only(r.events, 'safe')).toEqual([{ e: 'safe', id: WOLF, bitten: true }]);
    expect(r.events).toContainEqual({ e: 'quest', quest: SOUTH_BANK, state: 'done' });
    expect(doneLines(b, r.state, SOUTH_BANK)).toEqual(b.quests[SOUTH_BANK]!.talk!.done_bitten);
  });
});

describe('a replay and an old save', () => {
  /** After the hearth went out at 01:00: out into the wolf's reach at 01:12. */
  const OUT_AT = EVE + 3 * LOG_MS + 10_000;
  const FEED: Action = { t: 'feed', fire: FIRE, item: LOG, at: HEARTH };
  /** Light the hearth at 19:00, walk out into the wolf's reach after it went out, take two bites, outrun it. */
  const LOG_OF_A_NIGHT: readonly { a: Action; tick: number }[] = [
    { a: FEED, tick: EVE },
    { a: FEED, tick: EVE },
    { a: FEED, tick: EVE },
    { a: { t: 'move', at: OUT }, tick: OUT_AT },
    { a: { t: 'move', at: OUT }, tick: OUT_AT + 4600 },
    { a: { t: 'move', at: TOWN }, tick: OUT_AT + 5000 },
  ];

  test('the same log tells the same events and leaves the same state, however it is cut (R4)', () => {
    const b = hearth([wolf()]);
    const start = tending(b);
    const cap = hpCap(b, start);
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
    expect(one.state.player.hp).toBe(mulDiv(cap, 7500, 10_000));
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
    const lit = light(b, tending(b), EVE, 3);
    const until = EVE + 3 * LOG_MS;
    const old = (s: State, tick: number): State => {
      const out = place(s, s.player.at, tick);
      out.kernel = '0.8.0';
      delete (out.player as Partial<State['player']>).bitten;
      return out;
    };
    // saved before the fire went out: told at the next step; saved after: never told
    expect(only(wait(b, old(lit, until - 10), until + 20).events, 'fire_out')).toEqual([{ e: 'fire_out', id: FIRE }]);
    expect(only(wait(b, old(lit, until + 10), until + 20).events, 'fire_out')).toEqual([]);

    // hunted in the old save: the first bite rides the outing home and starts the record, and a replay agrees
    const hunt = old(move(b, place(lit, OUT, OUT_AT), OUT, OUT_AT).state, OUT_AT);
    expect(hunt.player.bitten).toBeUndefined();
    const log = LOG_OF_A_NIGHT.slice(4);
    const one = replay(b, hunt, log);
    const two = replay(b, hunt, log);
    expect(one.error).toBeUndefined();
    expect(one.state.player.bitten).toContain(VIGIL);
    expect(only(one.events, 'safe')).toEqual([{ e: 'safe', id: WOLF, bitten: true }]);
    expect(serialize(one.state)).toBe(serialize(two.state));
    expect(one.events).toEqual(two.events);
  });
});
