/**
 * Weather by day (docs/design/REACTIONS.md, phase B): the sky over a region is a pure function of
 * the world's seed, the region and the day, never of the player, and a reaction may hold on it.
 * Weather never touches a fire (the owner, 19.10).
 */
import { beforeAll, describe, expect, test } from 'vitest';

import {
  type Bundle,
  type State,
  type Tile,
  WEATHER_ODDS,
  computeValues,
  dayOf,
  fireBurns,
  newState,
  reactionHolds,
  regionOf,
  appears,
  step,
  waitPermille,
  weatherOf,
} from '@game/kernel';
import type { WeatherName } from '@game/schema';

import { loadBundle } from '../../tools/test/helpers/world.js';

let base: Bundle;

beforeAll(() => {
  base = loadBundle();
});

const SEED = 5;
const LOG = 'core/fallen-logs#0';
const REEDS = 'core/reed-bank#0';
const MUSHROOMS = `core/mushrooms-after-rain@${LOG}`;
/** 10:00 on a game day, so the hours of a node or the night never decide the answer */
const MORNING = (b: Bundle) => (b.params.day_length_ms * 10) / 24;

function started(b: Bundle, seed = SEED): State {
  const r = step(b, newState(b, seed), { t: 'start', starter: 'core/forager', name: 'Tester' }, 0);
  if (!r.ok) throw new Error(r.error);
  return r.state;
}

/** The first game day from 1 on with this weather over the map. */
function dayWith(b: Bundle, kind: WeatherName, seed = SEED): number {
  for (let d = 1; d < 400; d++) if (weatherOf(seed, regionOf(b, 0, 0), d) === kind) return d;
  throw new Error(`no ${kind} day in 400`);
}

const at = (b: Bundle, day: number) => day * b.params.day_length_ms + MORNING(b);

describe('the weather of a day', () => {
  test('is the same on every call, and falls about as the odds say', () => {
    const region = regionOf(base, 0, 0);
    const days = Array.from({ length: 1000 }, (_, d) => weatherOf(SEED, region, d));
    expect(Array.from({ length: 1000 }, (_, d) => weatherOf(SEED, region, d))).toEqual(days);
    for (const [kind, bp] of WEATHER_ODDS) {
      const share = days.filter((w) => w === kind).length / days.length;
      expect(Math.abs(share - bp / 10_000)).toBeLessThan(0.05);
    }
  });

  test('is one sky for a region, and another region keeps its own', () => {
    const here = Array.from({ length: 60 }, (_, d) => weatherOf(SEED, 'core/world', d));
    const there = Array.from({ length: 60 }, (_, d) => weatherOf(SEED, 'test/far-region', d));
    expect(there).not.toEqual(here);
    // every tile of the hand-made map reads the one region
    expect(regionOf(base, 0, 0)).toBe(regionOf(base, base.map.width - 1, base.map.height - 1));
  });

  test('reads nothing of the player: two players in one world see one sky', () => {
    const rain = base.reactions['core/reeds-in-rain']!;
    const inst = base.instances[REEDS]!;
    const anchor = { id: REEDS, x: inst.x, y: inst.y, inst };
    const one = started(base);
    const other = started(base);
    other.player.race = 'core/skeleton';
    other.player.pocket = 'core/slid-bank';
    other.player.at = [1, 1];
    other.player.attrs.senses += 3;
    for (let d = 0; d < 40; d++) {
      expect(reactionHolds(base, other, rain, anchor, at(base, d), [1, 1])).toBe(reactionHolds(base, one, rain, anchor, at(base, d)));
    }
  });
});

describe('the core rows in the rain', () => {
  test('mushrooms show by a fallen log on a day of rain, and not on a clear one', () => {
    const s = started(base);
    const wet = dayWith(base, 'rain');
    const dry = dayWith(base, 'clear');
    expect(dayOf(base, at(base, wet))).toBe(wet);
    expect(appears(base, s, MUSHROOMS, at(base, wet))).toBe(true);
    expect(appears(base, s, MUSHROOMS, at(base, dry))).toBe(false);
    expect(appears(base, s, MUSHROOMS, at(base, dayWith(base, 'fog')))).toBe(false);
  });

  test('reeds grow back sooner in the rain, and as ever on other days', () => {
    const s = started(base);
    expect(waitPermille(base, s, REEDS, at(base, dayWith(base, 'rain')))).toBe(600);
    expect(waitPermille(base, s, REEDS, at(base, dayWith(base, 'clear')))).toBe(1000);
  });

  test("the rain's mushrooms leave the mushroom's value as the forest's patch makes it", () => {
    const dry = structuredClone(base);
    delete dry.reactions['core/mushrooms-after-rain'];
    const without = computeValues(dry);
    const withRain = computeValues(base);
    expect(withRain.values['core/mushroom']).toBe(without.values['core/mushroom']);
    expect(withRain.cheapest['core/mushroom']).toBe('core/forest-mushrooms');
  });
});

describe('a fire', () => {
  test('burns the same in the rain as on a clear day', () => {
    const hearth = base.map.props.find((p) => p.fire === true)!;
    const id = hearth.id!;
    const { cap, log_ms } = base.params.fire;
    const burn = (day: number) => {
      let s = started(base);
      s.player.attrs.might = 100;
      s.player.bag['core/log'] = cap;
      s.player.movedAt = 0;
      const beside: Tile = [hearth.x, hearth.y + hearth.h];
      s.player.at = beside;
      const t0 = at(base, day);
      for (let i = 0; i < cap; i++) {
        const r = step(base, s, { t: 'feed', fire: id, item: 'core/log', at: beside }, t0);
        if (!r.ok) throw new Error(r.error);
        s = r.state;
      }
      const fire = s.player.fires[id]!;
      return {
        lit: fire.lit - t0,
        until: fire.until - t0,
        burns: [0, log_ms, cap * log_ms - 1, cap * log_ms].map((dt) => fireBurns(s, id, t0 + dt)),
      };
    };
    const wet = burn(dayWith(base, 'rain'));
    expect(wet).toEqual(burn(dayWith(base, 'clear')));
    expect(wet).toEqual(burn(dayWith(base, 'fog')));
    expect(wet.until).toBe(cap * log_ms);
  });
});
