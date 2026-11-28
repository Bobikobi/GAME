/**
 * The map's animals stepped (kernel/src/wild/valley.ts): they stand at their spots, the nearest few are stepped, they move by
 * their weights, flee a player who walks at them, keep their hours and their reach, and a take names where one stands now.
 */
import { beforeAll, describe, expect, test } from 'vitest';

import {
  type Action,
  type State,
  type WildSense,
  type WildWorld,
  hourOf,
  newState,
  step,
  stonePrey,
  tagAt,
  walkableFor,
  wildKindOf,
  wildReach,
  wildShown,
  wildStep,
  wildWorld,
} from '@game/kernel';

import { loadBundle } from '../../tools/test/helpers/world.js';

let bundle: ReturnType<typeof loadBundle>;
beforeAll(() => { bundle = loadBundle(); });

const STILL: WildSense = { face: [0, 1], gait: 'still', asleep: false };
const HOUR = 50_000;

function started(b = bundle): State {
  const r = step(b, newState(b, 916), { t: 'start', race: 'core/human', name: 'Watcher' }, 0);
  if (!r.ok) throw new Error(r.error);
  return r.state;
}

/** Steps the world from `from` to `to` game ms in frames of `frame` ms, the player held where the state puts it. */
function run(world: WildWorld, s: State, from: number, to: number, sense = STILL, frame = 50): void {
  for (let ms = from; ms <= to; ms += frame) wildStep(bundle, world, s, sense, ms);
}

const spotOf = (i: number) => bundle.map.creatures!.spots[i]!;
const d2 = (a: readonly number[], b: readonly number[]) => (a[0]! - b[0]!) ** 2 + (a[1]! - b[1]!) ** 2;

describe('the valley animals', () => {
  test('one animal stands at each spot whose kind has a behaviour, none is stepped before a pulse', () => {
    const w = wildWorld(bundle);
    const spots = bundle.map.creatures!.spots;
    expect(w.animals.length).toBe(spots.filter((s) => wildKindOf(bundle, s.kind)).length);
    expect(w.animals.length).toBeGreaterThan(30);
    for (const a of w.animals) {
      expect(a.c.at).toEqual([spotOf(a.spot).x, spotOf(a.spot).y]);
      expect(a.c.id).toBe(a.spot + 1);
      expect(a.stepped).toBe(false);
    }
  });

  test('the kinds read from the map: the hare burrows, the trout swims, the crow flies, every one flees', () => {
    expect(wildKindOf(bundle, 'core/hare')).toMatchObject({ tier: 'flee', sight: 6, ear: 2, roam: 8, flight: 'burrow', group: 'solitary', hours: [5, 20], small: true });
    expect(wildKindOf(bundle, 'core/trout')).toMatchObject({ flight: 'swim', hours: [5, 22] });
    expect(wildKindOf(bundle, 'core/crow')).toMatchObject({ flight: 'fly', looksBack: true });
    expect(wildKindOf(bundle, 'core/roe')).toMatchObject({ tier: 'flee', small: false, alarm: 4 });
  });

  test('only the nearest awake_max within wake_tiles are stepped, nearest first', () => {
    const s = started();
    s.player.at = [32, 32];
    const w = wildWorld(bundle);
    wildStep(bundle, w, s, STILL, 1_000);
    const { wake_tiles, awake_max } = bundle.params.wild;
    const stepped = w.animals.filter((a) => a.stepped);
    expect(stepped.length).toBeLessThanOrEqual(awake_max);
    const near = w.animals.filter((a) => d2([spotOf(a.spot).x, spotOf(a.spot).y], s.player.at) <= wake_tiles * wake_tiles);
    expect(stepped.length).toBe(Math.min(near.length, awake_max));
    const far = Math.max(...stepped.map((a) => d2([spotOf(a.spot).x, spotOf(a.spot).y], s.player.at)));
    for (const a of w.animals.filter((x) => !x.stepped)) expect(d2([spotOf(a.spot).x, spotOf(a.spot).y], s.player.at)).toBeGreaterThanOrEqual(far);
  });

  test('left alone by day they graze and wander inside their reach, on ground their flight allows, on whole tiles', () => {
    const s = started();
    s.player.at = [32, 2];
    const w = wildWorld(bundle);
    const start = 2 * HOUR; // 14:00
    run(w, s, start, start + 120_000);
    const walk = walkableFor(bundle);
    let moved = 0;
    for (const a of w.animals.filter((x) => x.stepped)) {
      const sp = spotOf(a.spot);
      const kind = wildKindOf(bundle, a.kind)!;
      expect(a.c.at.every(Number.isSafeInteger)).toBe(true);
      expect(d2(a.c.at, [sp.x, sp.y])).toBeLessThanOrEqual(wildReach(kind) ** 2);
      if (a.c.at[0] !== sp.x || a.c.at[1] !== sp.y) moved++;
      const tag = tagAt(bundle.map, a.c.at[0], a.c.at[1]);
      if (kind.flight === 'swim') expect(tag).toBe('water');
      else if (kind.flight !== 'fly' && (a.c.at[0] !== sp.x || a.c.at[1] !== sp.y)) expect(walk(a.c.at[0], a.c.at[1], s.player)).toBe(true);
    }
    expect(moved).toBeGreaterThan(3);
  });

  test('a roe flees a player who walks at it and stands farther off than the player came', () => {
    const s = started();
    const w = wildWorld(bundle);
    const roe = w.animals.find((a) => a.kind === 'core/roe' && a.spot === 15)!;
    const sp = spotOf(roe.spot);
    const start = 2 * HOUR;
    // the player waits out of sight 14 tiles east, so the roe is stepped and calm
    s.player.at = [sp.x + 14, sp.y];
    run(w, s, start, start + 4_000);
    expect(['IDLE', 'GRAZE', 'WANDER']).toContain(roe.c.state);
    // then walks west at it, a tile every walk step, until two tiles from its anchor
    const sense: WildSense = { face: [-1, 0], gait: 'walk', asleep: false };
    let ms = start + 4_000;
    let fled = false;
    const walk = walkableFor(bundle);
    for (let x = sp.x + 13; x >= sp.x + 2; x--) {
      if (walk(x, sp.y, s.player)) s.player.at = [x, sp.y];
      ms += bundle.params.walk_step_ms;
      wildStep(bundle, w, s, sense, ms);
      if (roe.c.state === 'FLEE') fled = true;
    }
    // and stands there, two tiles off, while the roe makes up its mind
    for (const end = ms + 8_000; ms <= end && !fled; ms += 50) {
      wildStep(bundle, w, s, { face: [-1, 0], gait: 'still', asleep: false }, ms);
      if (roe.c.state === 'FLEE') fled = true;
    }
    run(w, s, ms, ms + 4_000, { face: [-1, 0], gait: 'still', asleep: false });
    expect(fled).toBe(true);
    expect(d2(roe.c.at, s.player.at)).toBeGreaterThan(4 * 4);
  });

  test('a hare put up runs for its den and goes under; it is not shown there, and comes out again', () => {
    const s = started();
    const w = wildWorld(bundle);
    const hare = w.animals.find((a) => a.kind === 'core/hare')!;
    const sp = spotOf(hare.spot);
    s.player.at = [sp.x, sp.y + 12];
    const start = 2 * HOUR;
    run(w, s, start, start + 2_000);
    // pulled off its den first, so its flight has somewhere to go
    hare.c.at = [sp.x + 3, sp.y];
    s.player.at = [sp.x + 5, sp.y];
    let under = false;
    let ms = start + 2_000;
    for (let i = 0; i < 40 && !under; i++) {
      ms += 200;
      wildStep(bundle, w, s, { face: [-1, 0], gait: 'run', asleep: false }, ms);
      under = hare.c.under === true;
    }
    expect(under).toBe(true);
    expect(wildShown(hare)).toBe(false);
    // the player steps back past a walk's hearing of the den (gait.noise_walk + the hare's ear) and waits
    s.player.at = [sp.x, sp.y + 12];
    run(w, s, ms, ms + 30_000);
    expect(hare.stepped).toBe(true);
    expect(hare.c.under).toBeFalsy();
  });

  test('by their hours: at 21:00 the day kinds have left the map and the roe and the trout are still out', () => {
    const s = started();
    s.player.at = [12, 12];
    const w = wildWorld(bundle);
    const nine = 9 * HOUR; // 12:00 + 9 h
    expect(hourOf(bundle, nine)).toBe(21);
    run(w, s, nine, nine + 20_000);
    for (const a of w.animals.filter((x) => x.stepped)) {
      const late = a.kind === 'core/roe' || a.kind === 'core/trout';
      expect(wildShown(a), `${a.kind} at spot ${a.spot}`).toBe(late);
    }
  });

  test('the same inputs give the same world; the same animal walks another way the next day', () => {
    const s = started();
    s.player.at = [32, 2];
    const a = wildWorld(bundle);
    const b = wildWorld(bundle);
    run(a, s, 2 * HOUR, 2 * HOUR + 60_000);
    run(b, s, 2 * HOUR, 2 * HOUR + 60_000);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    const trail = (from: number) => {
      const w = wildWorld(bundle);
      const out: string[] = [];
      for (let ms = from; ms <= from + 90_000; ms += 100) {
        wildStep(bundle, w, s, STILL, ms);
        out.push(w.animals.filter((x) => x.stepped).map((x) => x.c.at.join(',')).join(' '));
      }
      return out.join('|');
    };
    const day = bundle.params.day_length_ms;
    expect(trail(2 * HOUR)).not.toBe(trail(day + 2 * HOUR));
  });

  test('a long gap is not replayed: one round of pulses, and every animal settles', () => {
    const s = started();
    s.player.at = [12, 12];
    const w = wildWorld(bundle);
    run(w, s, 2 * HOUR, 2 * HOUR + 10_000);
    const later = 5 * HOUR;
    const t0 = performance.now();
    wildStep(bundle, w, s, STILL, later);
    expect(performance.now() - t0).toBeLessThan(200);
    expect(w.pulse).toBe(later / bundle.params.wild.tick_ms);
    for (const a of w.animals.filter((x) => x.stepped)) {
      expect(a.last).toBeGreaterThan(later - bundle.params.wild.think_ms);
      expect(a.path).toEqual([]);
    }
  });

  test('a thrown stone names where the animal stands now, held to its reach', () => {
    const b = structuredClone(bundle);
    const s = started(b);
    const walk = walkableFor(b);
    const i = b.map.creatures!.spots.findIndex((sp) => sp.kind === 'core/hare');
    const sp = b.map.creatures!.spots[i]!;
    const reach = wildReach(wildKindOf(b, 'core/hare')!);
    const near = ([[3, 0], [-3, 0], [0, 3], [0, -3], [2, 2]] as const).map(([dx, dy]) => [sp.x + dx, sp.y + dy] as [number, number]).find(([x, y]) => walk(x, y, s.player))!;
    s.player.at = [near[0], near[1] + 1];
    if (!walk(s.player.at[0], s.player.at[1], s.player)) s.player.at = [near[0] + 1, near[1]];
    s.player.bag[b.params.hunt.throw_item] = 1;
    expect(stonePrey(b, s, 0, i, s.player.at, near)).toBeDefined();
    expect(stonePrey(b, s, 0, i, s.player.at, [sp.x + reach + 1, sp.y])).toBeUndefined();
    expect(stonePrey(b, s, 0, i, s.player.at, [0.5, 1] as never)).toBeUndefined();
    // a short throw from the tile beside it comes down on the tile it stands on
    const take: Action = { t: 'throw', at: s.player.at, aim: near, kind: b.params.hunt.throw_item, power: b.params.stones.throw_min_power, prey: i, stands: near };
    const r = step(b, s, take, 0);
    if (!r.ok) throw new Error(r.error);
    expect(r.state.player.carcasses![0]).toMatchObject({ kind: 'core/hare', at: near });
    // the taken animal leaves the world until it is back
    const w = wildWorld(b);
    wildStep(b, w, r.state, STILL, 1_000);
    expect(w.animals.find((a) => a.spot === i)!.stepped).toBe(false);
  });
});
