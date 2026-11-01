/**
 * The threat telegraph (NEXT.md 12 c): the far howl and the rising layer by distance, the "!" on `seen`, the drawn
 * wolf closing on a player who stands still so it is beside them by the first bite, one drawn bite per `hurt` from
 * a predator, and the visual twins that do not depend on the sound. Every hunt here is the kernel's own.
 */
import { beforeAll, describe, expect, test } from 'vitest';

import { type Bundle, type GameEvent, type Hazard, type State, type Tile, hazardsOf, makeWalkable, newState, nightFalls, sees, step } from '@game/kernel';
import { type Run, type Spot, SEEN, bangAt, huntGround, walkSteps, wolfDrawn } from '../src/predator';
import { Bites, HOWL_LINE, Telegraph, type Threat, VOICES, catchPace, farGain, nearGain, nextBiteAt, swing, telegraphOf } from '../src/telegraph';
import { loadBundle } from '../../tools/test/helpers/world';

const BANK_WOLF = 'core/bank-wolf';
const PLAYER: Tile = [11, 30];
/** A frame of the scene, in game ms. */
const FRAME = 16;

let base: Bundle;
let wolf: Hazard;
/** The first night, as the bank wolf steps onto (11, 25) on its way south down the meadow and sees the player at PLAYER. */
let t0: number;

beforeAll(() => {
  base = loadBundle();
  const found = hazardsOf(base).find((h) => h.id === BANK_WOLF);
  if (!found?.round) throw new Error(`${BANK_WOLF} with a round is missing from the map`);
  wolf = found;
  t0 = nightFalls(base, 0) + 4 * wolf.pace;
});

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

/** The player reports where they stand at a tick, as the scene does while a hunt runs. */
function report(s: State, at: Tile, tick: number): { state: State; events: GameEvent[] } {
  const r = step(base, s, { t: 'move', at }, tick);
  if (!r.ok) throw new Error(`move refused: ${r.error}`);
  return { state: r.state, events: r.events };
}

const tel = () => {
  const t = telegraphOf(base, 'predator');
  if (!t) throw new Error('the core params carry no telegraph');
  return t;
};

describe('the far and the near beats by distance', () => {
  test('at 12 tiles the howl is heard and the rising layer is silent', () => {
    expect(farGain(tel(), 12)).toBeGreaterThan(0);
    expect(nearGain(tel(), 12)).toBe(0);
  });

  test('at 3 tiles the rising layer is at least three times as loud as at 8, and above 0 at 8', () => {
    expect(nearGain(tel(), 8)).toBeGreaterThan(0);
    expect(nearGain(tel(), 3)).toBeGreaterThanOrEqual(3 * nearGain(tel(), 8));
  });

  test('the layer grows all the way in and stops at the near range', () => {
    let prev = -1;
    for (let tiles = tel().near_tiles + 2; tiles >= 0; tiles -= 0.5) {
      const g = nearGain(tel(), tiles);
      expect(g).toBeGreaterThanOrEqual(prev);
      prev = g;
    }
    expect(nearGain(tel(), tel().near_tiles)).toBe(0);
  });

  test('the bounds in the params keep both measurables at any value inside them', () => {
    const p = JSON.parse(JSON.stringify(base.params.hazard.predator.telegraph)) as ReturnType<typeof tel>;
    for (const near of [9, 14]) {
      for (const curve of [2, 3]) {
        const t = { ...p, near_tiles: near, near_curve: curve };
        expect(nearGain(t, 8)).toBeGreaterThan(0);
        expect(nearGain(t, 3) / nearGain(t, 8)).toBeGreaterThanOrEqual(3);
      }
    }
    expect(farGain({ ...p, howl_tiles: 13, howl_pct: 10 }, 12)).toBeGreaterThan(0);
  });

  test('only the kinds with a voice are heard: the pit, the trap and deep water wait for theirs', () => {
    expect(VOICES.predator).toEqual({ far: 'howl', near: 'prowl' });
    for (const kind of ['pit', 'trap', 'deep_water'] as const) expect(telegraphOf(base, kind)).toBeUndefined();
  });
});

describe('the far howl over a night', () => {
  const far: Threat = { id: BANK_WOLF, kind: 'predator', at: [0, 0], out: true };
  const at12: Spot = [12, 0];

  test('it waits a drawn gap after dusk, the first of a night says so, and the next does not', () => {
    const t = new Telegraph(base, () => 0);
    const gap = tel().howl_gap_min_s * 1000;
    const dusk = nightFalls(base, 0);
    expect(t.hear(0, dusk, at12, [far], null).far).toBeUndefined();
    expect(t.hear(gap - 1, dusk, at12, [far], null).far).toBeUndefined();
    const first = t.hear(gap, dusk, at12, [far], null).far;
    expect(first).toMatchObject({ id: BANK_WOLF, sfx: 'howl', first: true });
    expect(first!.gain).toBeGreaterThan(0);
    const second = t.hear(2 * gap, dusk, at12, [far], null).far;
    expect(second).toMatchObject({ first: false });
    // the next night's first howl says so again
    const next = nightFalls(base, dusk + 1);
    t.hear(3 * gap, next, at12, [far], null);
    expect(t.hear(4 * gap, next, at12, [far], null).far).toMatchObject({ first: true });
    expect(HOWL_LINE).toBe('A howl, far off.');
  });

  test('no howl by day, none from a wolf that is not out or that hunts the player, none from inside the near range', () => {
    const gap = tel().howl_gap_max_s * 1000;
    const dusk = nightFalls(base, 0);
    const cases: [number | null, Threat, Spot, string | null][] = [
      [null, far, at12, null],
      [dusk, { ...far, out: false }, at12, null],
      [dusk, far, at12, BANK_WOLF],
      [dusk, far, [3, 0], null],
      [dusk, far, [tel().howl_tiles + 1, 0], null],
    ];
    for (const [d, th, player, hunted] of cases) {
      const t = new Telegraph(base, () => 0.5);
      t.hear(0, d, player, [th], hunted);
      expect(t.hear(gap, d, player, [th], hunted).far).toBeUndefined();
    }
  });

  test('the layer follows the nearest wolf that is out', () => {
    const t = new Telegraph(base, () => 0.5);
    const near = t.hear(0, null, [3, 0], [far], null).near.prowl!;
    expect(near.level).toBeCloseTo(nearGain(tel(), 3));
    expect(near.pan).toBeLessThan(0);
    expect(t.hear(0, null, [3, 0], [{ ...far, out: false }], null).near.prowl).toEqual({ level: 0, pan: 0 });
  });
});

describe('the alert on seen, as the stealth cues built it', () => {
  test('the "!" stands over the predator within 100 ms of seen', () => {
    for (let ms = 0; ms <= 100; ms += FRAME) expect(bangAt(ms)).toBe(true);
    expect(bangAt(100)).toBe(true);
  });
});

describe('the act: the drawn wolf by the bite, and the bite drawn', () => {
  test('a run closes in time for the bite, never slower than its pace and never faster than the dash', () => {
    expect(catchPace(4, 2100, 600, 150)).toBeCloseTo(525);
    expect(catchPace(2, 2100, 600, 150)).toBe(600);
    expect(catchPace(40, 2100, 600, 150)).toBe(150);
    expect(catchPace(3, 0, 600, 150)).toBe(150);
    expect(catchPace(0, 2100, 600, 150)).toBe(600);
  });

  test('through a hunt the wolf never draws away from a player who stands still, and is within one tile at the first bite', () => {
    expect(sees(base, wolf, t0, PLAYER)).toBe(true);
    let s = report(place(begin(base), PLAYER, t0), PLAYER, t0).state;
    const chase = s.player.chase!;
    expect(chase).toMatchObject({ hazard: BANK_WOLF, since: t0, bites: 0 });
    const bite = nextBiteAt(base, chase);
    expect(bite).toBe(t0 + base.params.hazard.predator.catch_ms);
    const walk = huntGround(base, s, makeWalkable(base));
    // the walk still between the drawn wolf and the player: to the tile it runs to, then the steps from there
    const away = (at: Spot, r: Run | undefined): number => {
      const tile: Spot = r?.to ?? [Math.round(at[0]), Math.round(at[1])];
      return (walkSteps(tile, PLAYER, 0, walk) ?? 99) + Math.abs(at[0] - tile[0]) + Math.abs(at[1] - tile[1]);
    };
    let run: Run | undefined;
    let prev = Number.POSITIVE_INFINITY;
    let atBite: number | undefined;
    let bites = 0;
    for (let tick = t0; tick <= t0 + 3 * base.params.hazard.predator.bite_ms; tick += FRAME) {
      const r = report(s, PLAYER, tick);
      s = r.state;
      bites += r.events.filter((e) => e.e === 'hurt' && e.by === 'predator').length;
      const drawn = wolfDrawn(base, wolf, s, tick, run, walk);
      run = drawn.run;
      const d = away(drawn.at, run);
      expect(d).toBeLessThanOrEqual(prev + 1e-9);
      prev = d;
      if (atBite === undefined && bites > 0) atBite = Math.max(Math.abs(drawn.at[0] - PLAYER[0]), Math.abs(drawn.at[1] - PLAYER[1]));
      if (bites > 0) expect(Math.max(Math.abs(drawn.at[0] - PLAYER[0]), Math.abs(drawn.at[1] - PLAYER[1]))).toBeLessThanOrEqual(1);
    }
    expect(bites).toBeGreaterThanOrEqual(2);
    expect(atBite).toBeDefined();
    expect(atBite!).toBeLessThanOrEqual(1);
  });

  test('a wolf that sees from far is still beside the player by the first bite, at no more than the dash', () => {
    const goal: Tile = [0, 0];
    const walk = () => true;
    // twelve tiles off, as far as eyes and a run's noise reach: its pace alone would bring it seconds late
    const steps = 12;
    const pace = catchPace(steps, base.params.hazard.predator.catch_ms - SEEN.hold, wolf.pace, tel().dash_ms);
    expect(pace).toBeLessThan(wolf.pace);
    expect(SEEN.hold + steps * pace).toBeLessThanOrEqual(base.params.hazard.predator.catch_ms);
    expect(walkSteps([12, 1], goal, 1, walk)).toBe(12);
  });

  test('one drawn bite per hurt from a predator, none for a pit, a trap, deep water or hunger', () => {
    const bites = new Bites(base);
    const hurt = (by: string, id?: string): GameEvent => (id === undefined ? { e: 'hurt', by, hp: 1 } : { e: 'hurt', by, id, hp: 1 });
    expect(bites.take([hurt('predator', BANK_WOLF)], 0)).toHaveLength(1);
    expect(bites.take([hurt('pit', 'core/doorstep-pit'), hurt('trap', 'x/trap'), hurt('deep_water', 'x/water'), hurt('food')], 10)).toHaveLength(0);
    expect(bites.take([hurt('predator', BANK_WOLF), { e: 'seen', id: BANK_WOLF }], 2000)).toHaveLength(1);
    expect(bites.count).toBe(2);
  });

  test('the lunge and the flinch rise and fall once in their time; reduced motion keeps only the meter', () => {
    const t = tel();
    const bites = new Bites(base);
    bites.take([{ e: 'hurt', by: 'predator', id: BANK_WOLF, hp: 1 }], 1000);
    const peak = bites.pose(BANK_WOLF, 1000 + t.lunge_ms / 3, true);
    expect(peak.lunge).toBeCloseTo(t.lunge_px);
    expect(peak.flinch).toBeGreaterThan(0);
    expect(peak.hit).toBe(true);
    expect(bites.pose(BANK_WOLF, 1000 + Math.max(t.lunge_ms, t.flinch_ms), true)).toMatchObject({ lunge: 0, flinch: 0 });
    expect(bites.pose(BANK_WOLF, 1000 + t.hit_ms, true).hit).toBe(false);
    expect(bites.pose(BANK_WOLF, 1000 + t.lunge_ms / 3, false)).toEqual({ lunge: 0, flinch: 0, hit: true });
    expect(bites.pose('core/other-wolf', 1000, true)).toEqual({ lunge: 0, flinch: 0, hit: false });
    // a swing has one rise and one fall
    let turns = 0;
    let last = 0;
    let rising = true;
    for (let ms = 0; ms <= 300; ms += 5) {
      const v = swing(ms, 300);
      if (rising && v < last) {
        turns++;
        rising = false;
      }
      last = v;
    }
    expect(turns).toBe(1);
  });
});

describe('muted, every visual cue still shows', () => {
  test('the beats are worked out without the sound: the first howl of a night still goes up as a line, the "!" and the bite still show', () => {
    // the telegraph never reads the mute: the toast's cue, the "!" and the drawn bite come from the kernel's
    // state and the clock alone, and the mute only silences the buses its sounds play on (the master gain)
    const t = new Telegraph(base, () => 0);
    const dusk = nightFalls(base, 0);
    t.hear(0, dusk, [12, 0], [{ id: BANK_WOLF, kind: 'predator', at: [0, 0], out: true }], null);
    expect(t.hear(tel().howl_gap_min_s * 1000, dusk, [12, 0], [{ id: BANK_WOLF, kind: 'predator', at: [0, 0], out: true }], null).far?.first).toBe(true);
    const bites = new Bites(base);
    bites.take([{ e: 'hurt', by: 'predator', id: BANK_WOLF, hp: 1 }], 0);
    expect(bites.pose(BANK_WOLF, 10, false).hit).toBe(true);
    expect(bangAt(0)).toBe(true);
  });
});
