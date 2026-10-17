/**
 * The stealth client (DECISIONS.md, 2026-10-16): the bank wolf's eyes, the moment it sees the
 * player, the wolf drawn running after the player while the kernel's hunt names it and back to its
 * round after, the music of a hunt, the lines of a hunt seen and outrun, and Pell's line at the
 * hand-in. Every hunt here is the kernel's own, begun and ended by its steps.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, relative, sep } from 'node:path';
import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest';

import {
  type Action,
  type Bundle,
  type GameEvent,
  type Hazard,
  type State,
  type Tile,
  hazardsOf,
  headingOf,
  isNight,
  isSafe,
  makeWalkable,
  mulDiv,
  near,
  newState,
  nightFalls,
  npcTile,
  predatorAt,
  satietyCap,
  sees,
  step,
} from '@game/kernel';
import { app } from '../src/app';
import {
  HOME_SPEED,
  type Run,
  SEEN,
  type Spot,
  WOLF_EYES,
  bangAt,
  firstStep,
  flareAt,
  glowPixels,
  huntGround,
  huntSong,
  predatorSpriteAt,
  roundStep,
  songFade,
  wolfDrawn,
} from '../src/predator';
import type { Session } from '../src/session';
import { describe as describeEvent } from '../src/text';
import { eventToasts, urgent } from '../src/toasts';
import { say } from '../src/ui/dialog';
import { UI } from '../src/ui/ui';
import { CORE_PALETTE } from '../../tools/src/kit/palette';
import { REPO_ROOT } from '../../tools/src/load';
import { loadBundle } from '../../tools/test/helpers/world';

vi.mock('../src/ui/dialog', () => ({ say: vi.fn() }));

type Prop = Bundle['map']['props'][number];

/** Tick 0 is noon and a game hour is 50,000 ticks: night runs from 400,000 (20:00) to 850,000 (05:00). */
const NIGHT = 500_000;
const DAWN = 850_000;
/** The reach wolf of kernel/test/events.test.ts: west of the town's cobbles, in its reach; one step east is the town. */
const WOLF = 'test/wolf';
const OUT: Tile = [21, 7];
const TOWN: Tile = [22, 7];
const FAR: Tile = [6, 18];
const BANK_WOLF = 'core/bank-wolf';
const SOUTH_BANK = 'core/the-south-bank';
/** A frame of the scene, in game ms. */
const FRAME = 16;

let base: Bundle;

beforeAll(() => {
  base = loadBundle();
});

afterEach(() => {
  delete app.session;
});

/** A wolf that notices by reach, beside the town. */
function reachWolf(): Prop {
  return { id: WOLF, sprite: 'core/base-kit:props/standing_stone', x: 19, y: 7, w: 1, h: 1, solid: false, hazard: { kind: 'predator', window: ['night'], reach: 4 } };
}

/** The bundle with only the reach wolf for a hazard and no hunger drain. */
function reachWorld(): Bundle {
  const b = structuredClone(base);
  b.map.props = [...b.map.props.filter((p) => !p.hazard), reachWolf()];
  b.params.satiety_drain_per_min = 0;
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

/** Seen by the reach wolf on OUT at NIGHT, with health at `pct` percent of the cap. */
function hunted(b: Bundle, pct = 100): State {
  const s = move(b, place(begin(b), OUT, NIGHT), OUT, NIGHT).state;
  s.player.satiety = mulDiv(satietyCap(b, s), pct, 100);
  return s;
}

/** A walkable tile next to `tile`. */
function beside(b: Bundle, s: State, tile: Tile): Tile {
  const walkable = makeWalkable(b);
  for (let y = tile[1] - 1; y <= tile[1] + 1; y++) {
    for (let x = tile[0] - 1; x <= tile[0] + 1; x++) {
      if (x === tile[0] && y === tile[1]) continue;
      if (walkable(x, y, s.player) && near([x, y], { x: tile[0], y: tile[1], w: 1, h: 1 })) return [x, y];
    }
  }
  throw new Error(`nowhere to stand beside ${tile.join(',')}`);
}

/** The first open tile on the map with safe ground one step from it, and that safe tile. */
function safeStep(b: Bundle, s: State): [Tile, Tile] {
  const walkable = makeWalkable(b);
  for (let y = 0; y < b.map.height; y++) {
    for (let x = 0; x < b.map.width; x++) {
      if (!walkable(x, y, s.player) || isSafe(b, s, [x, y])) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const to: Tile = [x + dx, y + dy];
        if (walkable(to[0], to[1], s.player) && isSafe(b, s, to)) return [[x, y], to];
      }
    }
  }
  throw new Error('no safe ground beside open ground');
}

const gap = (a: Spot, b: Spot) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** Notes the tile a run walks to, once for each time it heads for it. */
function addStep(tiles: string[], run: Run | undefined): void {
  const to = run?.to?.join(',');
  if (to !== undefined && tiles[tiles.length - 1] !== to) tiles.push(to);
}

/** The text files of the game's code, content and art sources, as repo paths. */
function sources(): string[] {
  const text = new Set(['.ts', '.js', '.json', '.css', '.html', '.md', '.svg']);
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (name === 'node_modules' || name === 'dist') continue;
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (text.has(extname(name))) out.push(relative(REPO_ROOT, path).split(sep).join('/'));
    }
  };
  for (const dir of ['game/src', 'kernel/src', 'tools/src', 'content', 'design']) {
    if (existsSync(join(REPO_ROOT, dir))) walk(join(REPO_ROOT, dir));
  }
  return out;
}

describe("the bank wolf's eyes", () => {
  test("the owner's pick: two eyes 2x2 game px, 2 px apart, in a red off the core palette, with a three-ring glow", () => {
    expect(WOLF_EYES.red).toBe(0xff1744);
    expect([WOLF_EYES.size, WOLF_EYES.gap]).toEqual([2, 2]);
    expect(WOLF_EYES.halo).toEqual([0.4, 0.2, 0.08]);
    expect(CORE_PALETTE.map((c) => c.toLowerCase())).not.toContain('#ff1744');
  });

  test('the glow lights whole-pixel rings around both eyes and leaves the eyes clear', () => {
    const halo = glowPixels(WOLF_EYES.halo);
    expect([halo.w, halo.h]).toEqual([12, 8]);
    const at = new Map(halo.px.map((p) => [`${p.x},${p.y}`, p.a]));
    // the eyes stand at x 3-4 and 7-8, y 3-4
    for (const x of [3, 4, 7, 8]) for (const y of [3, 4]) expect(at.has(`${x},${y}`)).toBe(false);
    // out from the left eye along its row, one ring a pixel
    expect([at.get('2,3'), at.get('1,3'), at.get('0,3')]).toEqual([0.4, 0.2, 0.08]);
    // the gap between the eyes is in the first ring of both
    expect([at.get('5,3'), at.get('6,3')]).toEqual([0.4, 0.4]);
    // one pixel out on the diagonal is still the first ring; the corners are past the last
    expect(at.get('2,2')).toBe(0.4);
    expect(at.has('0,0')).toBe(false);
    for (const p of halo.px) {
      expect(at.get(`${halo.w - 1 - p.x},${p.y}`)).toBe(p.a);
      expect(at.get(`${p.x},${halo.h - 1 - p.y}`)).toBe(p.a);
    }
  });

  test('the flare is two rings wider than the glow, and brighter ring for ring', () => {
    const flare = glowPixels(WOLF_EYES.flare);
    expect([flare.w, flare.h]).toEqual([16, 12]);
    WOLF_EYES.halo.forEach((a, i) => expect(WOLF_EYES.flare[i]).toBeGreaterThan(a));
  });

  test('no other light, eye pair or prop takes the red: it is written in one place', () => {
    const red = /ff1744|255\s*,\s*23\s*,\s*68|16717636/i;
    const users = sources().filter((f) => red.test(readFileSync(join(REPO_ROOT, f), 'utf8')));
    expect(users).toEqual(['game/src/predator.ts']);
  });
});

describe('the moment it sees the player', () => {
  test('the eyes flare at once and fade back to the steady glow', () => {
    expect(flareAt(-1)).toBe(0);
    expect(flareAt(0)).toBe(1);
    expect(flareAt(SEEN.flareHold - 1)).toBe(1);
    expect(flareAt((SEEN.flareHold + SEEN.flare) / 2)).toBeCloseTo(0.5);
    expect(flareAt(SEEN.flare)).toBe(0);
    for (let ms = 0; ms < SEEN.flare; ms += 10) expect(flareAt(ms + 10)).toBeLessThanOrEqual(flareAt(ms));
  });

  test('the "!" stands from the moment the hunt begins, past the flare; the wolf breaks into its run while it stands', () => {
    expect(bangAt(-1)).toBe(false);
    expect(bangAt(0)).toBe(true);
    expect(bangAt(SEEN.bang - 1)).toBe(true);
    expect(bangAt(SEEN.bang)).toBe(false);
    expect(SEEN.bang).toBeGreaterThan(SEEN.flare);
    expect(SEEN.hold).toBeLessThan(SEEN.bang);
  });
});

describe('the wolf drawn on a hunt', () => {
  let wolf: Hazard;
  /** The first night, as the bank wolf steps onto (11, 25) on its way south down the meadow. */
  let t0: number;
  const PLAYER: Tile = [11, 30];

  beforeAll(() => {
    const found = hazardsOf(base).find((h) => h.id === BANK_WOLF);
    if (!found?.round) throw new Error(`${BANK_WOLF} with a round is missing from the map`);
    wolf = found;
    t0 = nightFalls(base, 0) + 4 * wolf.pace;
  });

  test('a run goes round what the player cannot walk, and stops beside the player', () => {
    // a wall down x = 2 with one gap, at the bottom
    const walk = (x: number, y: number) => x >= 0 && y >= 0 && x < 5 && y < 5 && (x !== 2 || y === 4);
    expect(firstStep([0, 0], [4, 0], 1, walk)).toEqual([1, 0]);
    expect(firstStep([1, 3], [4, 0], 1, walk)).toEqual([1, 4]);
    expect(firstStep([3, 0], [4, 0], 1, walk)).toBeUndefined();
    expect(firstStep([0, 0], [4, 0], 1, () => false)).toBeUndefined();
  });

  test('it holds where it saw the player, runs at its pace over open ground, and waits beside them; when the hunt ends it goes back to its round', () => {
    expect(predatorAt(base, wolf, t0)).toEqual([11, 25]);
    expect(headingOf(base, wolf, t0)).toEqual([0, 1]);
    expect(sees(base, wolf, t0, PLAYER)).toBe(true);
    const chased = move(base, place(begin(base), PLAYER, t0), PLAYER, t0);
    expect(only(chased.events, 'seen')).toEqual([{ e: 'seen', id: BANK_WOLF }]);
    expect(chased.state.player.chase).toMatchObject({ hazard: BANK_WOLF, since: t0 });

    const walk = huntGround(base, chased.state, makeWalkable(base));
    let run: Run | undefined;
    let prev: Spot | undefined;
    let arrived: number | undefined;
    const ran: string[] = [];
    const end = t0 + 4000;
    for (let tick = t0; tick <= end; tick += FRAME) {
      const drawn = wolfDrawn(base, wolf, chased.state, tick, run, walk);
      run = drawn.run;
      expect(run).toBeDefined();
      if (tick <= t0 + SEEN.hold) expect(drawn.at).toEqual([11, 25]);
      if (prev) expect(Math.abs(drawn.at[0] - prev[0]) + Math.abs(drawn.at[1] - prev[1])).toBeLessThanOrEqual(FRAME / wolf.pace + 1e-9);
      addStep(ran, run);
      if (arrived === undefined && drawn.at[0] === 11 && drawn.at[1] === 29) arrived = tick;
      prev = drawn.at;
    }
    // straight down the meadow, four tiles at its pace once the moment it saw the player is over, and then it waits beside them
    expect(ran).toEqual(['11,26', '11,27', '11,28', '11,29']);
    expect(Math.abs(arrived! - (t0 + SEEN.hold + 4 * wolf.pace))).toBeLessThanOrEqual(FRAME);
    expect(prev).toEqual([11, 29]);
    expect(run?.to).toBeUndefined();
    expect(wolfDrawn(base, wolf, chased.state, end, run, walk).heading).toEqual([0, 1]);

    // the player reaches safe ground elsewhere: the kernel ends the hunt, and the wolf walks back
    const [out, safe] = safeStep(base, chased.state);
    const home = move(base, place(chased.state, out, end - 1000), safe, end);
    expect(only(home.events, 'safe')).toMatchObject([{ e: 'safe', id: BANK_WOLF }]);
    expect(home.state.player.chase).toBeNull();
    let back: number | undefined;
    const returned: string[] = [];
    for (let tick = end; tick <= end + 6000; tick += FRAME) {
      const drawn = wolfDrawn(base, wolf, home.state, tick, run, walk);
      expect(gap(drawn.at, prev!)).toBeLessThanOrEqual((FRAME * HOME_SPEED) / wolf.pace + 1e-9);
      addStep(returned, drawn.run);
      if (!drawn.run) back ??= tick;
      if (back !== undefined) {
        expect(drawn.run).toBeUndefined();
        expect(drawn.at).toEqual(predatorSpriteAt(base, wolf, tick));
        expect(drawn.heading).toEqual(headingOf(base, wolf, tick));
      }
      run = drawn.run;
      prev = drawn.at;
    }
    // it turns back to where its round has gone on to, over open ground, and is on it again within three paces
    expect(returned[0]).toBe('11,30');
    for (const t of [...ran, ...returned]) {
      const [x, y] = t.split(',').map(Number) as [number, number];
      expect(walk(x, y), t).toBe(true);
    }
    expect(back).toBeDefined();
    expect(back! - end).toBeLessThanOrEqual(3 * wolf.pace);
  });

  test('seen between two tiles of its round, it walks on to the one nearer the player, never back and then on again', () => {
    // just short of halfway from (11, 25) to (11, 26): the tile it left is the nearer, the player is ahead
    const ahead = t0 + Math.floor(wolf.pace / 2) - 1;
    expect(roundStep(base, wolf, ahead)).toEqual({ from: [11, 25], to: [11, 26] });
    expect(roundStep(base, wolf, t0)).toBeUndefined();
    // past halfway, with the player adjacent behind it: the tile it left is the nearer to them too
    const behind = t0 + Math.floor((wolf.pace * 7) / 10);
    const BEHIND: Tile = [11, 24];
    const cases: { tick: number; player: Tile; ran: string[]; end: Spot; way: 1 | -1 }[] = [
      { tick: ahead, player: PLAYER, ran: ['11,26', '11,27', '11,28', '11,29'], end: [11, 29], way: 1 },
      { tick: behind, player: BEHIND, ran: ['11,25'], end: [11, 25], way: -1 },
    ];
    for (const c of cases) {
      expect(sees(base, wolf, c.tick, c.player)).toBe(true);
      const chased = move(base, place(begin(base), c.player, c.tick), c.player, c.tick);
      expect(chased.state.player.chase).toMatchObject({ hazard: BANK_WOLF, since: c.tick });
      const walk = huntGround(base, chased.state, makeWalkable(base));
      let run: Run | undefined;
      let prev: Spot | undefined;
      const ran: string[] = [];
      for (let tick = c.tick; tick <= c.tick + 4000; tick += FRAME) {
        const drawn = wolfDrawn(base, wolf, chased.state, tick, run, walk);
        run = drawn.run;
        // along the meadow edge only, and only ever toward the player
        expect(drawn.at[0]).toBe(11);
        if (prev) expect((drawn.at[1] - prev[1]) * c.way).toBeGreaterThanOrEqual(0);
        addStep(ran, run);
        prev = drawn.at;
      }
      expect(ran).toEqual(c.ran);
      expect(prev).toEqual(c.end);
    }
  });

  test("another predator's hunt leaves the bank wolf on its round, and none is drawn off it without a hunt", () => {
    const s = place(begin(base), PLAYER, t0);
    const walk = huntGround(base, s, makeWalkable(base));
    const tick = t0 + 1000;
    const round = { at: predatorSpriteAt(base, wolf, tick), heading: headingOf(base, wolf, tick) };
    expect(wolfDrawn(base, wolf, s, tick, undefined, walk)).toEqual(round);
    s.player.chase = { hazard: 'core/ruins-wolf', since: t0, bites: 0 };
    expect(wolfDrawn(base, wolf, s, tick, undefined, walk)).toEqual(round);
  });
});

describe('the music of a hunt', () => {
  /** The song the scene asks for: the hour here is the kernel's, which the shade's night follows hour for hour. */
  const song = (b: Bundle, s: State) => huntSong(s.player.chase !== null, isNight(b, s.tick));

  test("the hunt's own from the moment it begins, and back when it ends, however it ends", () => {
    const b = reachWorld();
    expect(song(b, move(b, place(begin(b), FAR, NIGHT), FAR, NIGHT).state)).toBe('night');
    expect(song(b, move(b, place(begin(b), FAR, NIGHT - 250_000), FAR, NIGHT - 250_000).state)).toBe('valley');

    const start = move(b, place(begin(b), OUT, NIGHT), OUT, NIGHT);
    expect(only(start.events, 'seen')).toHaveLength(1);
    expect(song(b, start.state)).toBe('chase');

    // outrun to the town
    const safe = move(b, start.state, TOWN, NIGHT + 1000);
    expect(only(safe.events, 'safe')).toHaveLength(1);
    expect(song(b, safe.state)).toBe('night');

    // bitten to a fall on the way
    const fell = move(b, hunted(b, 25), TOWN, NIGHT + 2600);
    expect(only(fell.events, 'fall')).toHaveLength(1);
    expect(song(b, fell.state)).toBe('night');

    // still hunted at dawn: the next report after it ends the hunt
    const early = move(b, place(begin(b), OUT, DAWN - 1000), OUT, DAWN - 1000).state;
    expect(song(b, early)).toBe('chase');
    expect(song(b, move(b, early, OUT, DAWN + 60_000).state)).toBe('valley');

    // its predator gone from the world
    const lost = structuredClone(start.state);
    lost.player.chase = { hazard: 'test/gone', since: NIGHT, bites: 1 };
    const gone = move(b, lost, TOWN, NIGHT + 3000);
    expect(gone.state.player.chase).toBeNull();
    expect(song(b, gone.state)).toBe('night');
  });

  test('a hunt cuts in at once, its end eases back, and dusk and dawn take their time', () => {
    expect(songFade('night', 'chase')).toBe(250);
    expect(songFade('valley', 'chase')).toBe(250);
    expect(songFade('chase', 'night')).toBe(2500);
    expect(songFade('chase', 'valley')).toBe(2500);
    expect(songFade('valley', 'night')).toBe(4000);
    expect(songFade(undefined, 'valley')).toBe(4000);
  });
});

describe('the lines of a hunt', () => {
  test('seen is a call to run, in the voice of the bite, and goes ahead of the calm lines; safe is short and good', () => {
    const s = begin(base);
    const seen: GameEvent = { e: 'seen', id: BANK_WOLF };
    expect(describeEvent(base, s, seen)).toEqual({ text: 'Seen! Run for a safe place', tone: 'bad' });
    const [toast] = eventToasts(base, s, [seen]);
    expect(toast && urgent(toast)).toBe(true);
    for (const bitten of [true, false]) {
      expect(eventToasts(base, s, [{ e: 'safe', id: BANK_WOLF, bitten }])).toEqual([{ lines: ['Safe.'], tone: 'good' }]);
    }
  });
});

describe("Pell's line at the hand-in", () => {
  /** A UI with only what its story beats read (session.test.ts builds its talker the same way). */
  const beats = (events: readonly GameEvent[]) =>
    (Object.create(UI.prototype) as { storyBeats(events: readonly GameEvent[]): Promise<void> }).storyBeats(events);

  test('bitten on the south bank and home safe, Pell has the line for bite marks; never bitten, the plain one', async () => {
    const b = reachWorld();
    app.bundle = b;
    const talk = b.quests[SOUTH_BANK]!.talk!;
    const pell = b.npcs['core/trader']!;
    const counter = npcTile(b, 'core/trader')!;
    for (const [bitten, lines] of [
      [true, talk.done_bitten],
      [false, talk.done],
    ] as const) {
      vi.mocked(say).mockReset().mockResolvedValue('bye');
      const s = hunted(b);
      s.player.quests['core/herbs-for-pell'] = 'done';
      s.player.quests[SOUTH_BANK] = 'active';
      // to the town before the first bite, or after it
      const home = move(b, s, TOWN, NIGHT + (bitten ? 2600 : 1000)).state;
      expect(home.player.bitten.includes(SOUTH_BANK)).toBe(bitten);
      const at = beside(b, home, counter);
      const there = place(home, at, NIGHT + 5000);
      there.player.bag['core/moonreed'] = 1;
      const handed = ok(b, there, { t: 'turnin', quest: SOUTH_BANK, at }, NIGHT + 5000);
      app.session = { state: handed.state } as unknown as Session;
      await beats(handed.events);
      expect(vi.mocked(say)).toHaveBeenCalledTimes(1);
      expect(vi.mocked(say).mock.calls[0]?.[1]).toBe(pell.name);
      expect(vi.mocked(say).mock.calls[0]?.[2]).toEqual(lines);
    }
  });
});
