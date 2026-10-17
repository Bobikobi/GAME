/** Tending in the client (NEXT 13b): the words and the once-per-burn warning read only the kernel's state and tick. */
import { beforeAll, describe, expect, test } from 'vitest';

import { type Bundle, type FireState, type State, newState, questSatisfied } from '@game/kernel';
import {
  TOO_DARK,
  feedTooLate,
  fireLow,
  fireName,
  fireWarnKey,
  fireWarning,
  logsToDawn,
  nextLogClock,
  nightLost,
  readable,
  wantsWood,
  warnTicks,
  woodToFeed,
} from '../src/fires';
import { describe as describeEvent, questSteps, readyToHandIn } from '../src/text';
import { loadBundle } from '../../tools/test/helpers/world';

const HEARTH = 'core/elder-hearth';
const QUEST = 'core/the-long-night';
/** Tick 0 is noon and a game hour is 50 000 ms: the first day's 19:00, dusk, 21:00, and the next dawn. */
const H19 = 350_000;
const DUSK = 400_000;
const H21 = 450_000;
const DAWN = 850_000;

let bundle: Bundle;

beforeAll(() => {
  bundle = loadBundle();
});

function withFire(fire?: FireState, quest: 'active' | 'done' | 'none' = 'active'): State {
  const s = newState(bundle, 1);
  if (quest !== 'none') s.player.quests[QUEST] = quest;
  if (fire) s.player.fires[HEARTH] = fire;
  return s;
}

describe('a fire by name', () => {
  test('is its id after the namespace, hyphens as spaces', () => {
    expect(fireName(HEARTH)).toBe('elder hearth');
    expect(fireName('ext/old-camp-fire')).toBe('old camp fire');
  });

  test('the fire event says until when it burns, by the game clock', () => {
    expect(describeEvent(bundle, withFire(), { e: 'fire', id: HEARTH, until: H21 })!.text).toBe('The elder hearth burns until 21:00.');
    expect(describeEvent(bundle, withFire(), { e: 'fire', id: HEARTH, until: DAWN + 25_000 })!.text).toBe('The elder hearth burns until 5:30.');
  });
});

describe('the wood a Feed sends', () => {
  test('a log first, else the first wood in the bag, never anything else', () => {
    const s = withFire();
    s.player.bag = { 'core/herb': 2, 'core/branch': 1, 'core/log': 2 };
    expect(woodToFeed(bundle, s)).toBe('core/log');
    s.player.bag = { 'core/herb': 2, 'core/branch': 1 };
    expect(woodToFeed(bundle, s)).toBe('core/branch');
    s.player.bag = { 'core/herb': 2, 'core/log': 0 };
    expect(woodToFeed(bundle, s)).toBeUndefined();
  });

  test('a class an extension declares under wood burns too', () => {
    const b = structuredClone(bundle);
    b.classes['test/peat'] = { id: 'test/peat', name: 'Peat', base: 'wood', creator: 'test', file: 'test' };
    b.items['test/peat'] = { ...b.items['core/log']!, id: 'test/peat', class: 'test/peat' };
    const s = withFire();
    s.player.bag = { 'core/herb': 1, 'test/peat': 1 };
    expect(woodToFeed(b, s)).toBe('test/peat');
  });
});

describe('the journal line of a tend step', () => {
  const line = (s: State, tick: number) => questSteps(bundle, s, QUEST, tick)[0];

  test('asks to light it before dusk while it is out', () => {
    expect(line(withFire(), H19)).toEqual({ text: 'Keep the elder hearth burning until dawn - light it before dusk', done: false });
    // burnt out at 21:00, in the night it was keeping: that night is lost, and the line says so
    expect(line(withFire({ lit: H19, until: H21 }), H21 + 1)!.text).toBe(
      'Keep the elder hearth burning until dawn - it went out, tonight is lost: light it before dusk',
    );
  });

  test('counts the logs to dawn once it burns, from 19:00 through the night', () => {
    expect(line(withFire({ lit: H19, until: H21 }), H19)!.text).toBe('Keep the elder hearth burning until dawn - fed to reach dawn: 4 more logs');
    // at midnight three hours of wood are left, so a log fits now and the line only counts
    expect(line(withFire({ lit: H19, until: DAWN - 100_000 }), DAWN - 250_000)!.text).toBe('Keep the elder hearth burning until dawn - fed to reach dawn: 1 more log');
    // half a log short still needs a whole one
    expect(logsToDawn(bundle, withFire({ lit: H19, until: DAWN - 50_000 }), HEARTH, DAWN - 250_000)).toBe(1);
  });

  test('says when the next log fits while the fire is too full for one', () => {
    // lit at 19:00 with three logs it burns to 01:00, and takes a fourth once one has burned: at 21:00
    const full = withFire({ lit: H19, until: H19 + 3 * bundle.params.fire.log_ms });
    expect(line(full, H19 + 1)!.text).toBe(
      'Keep the elder hearth burning until dawn - fed to reach dawn: 2 more logs, the next at 21:00',
    );
    // a tick later the 21:00 minute has already begun when the log fits, so the line says 21:01
    const late = withFire({ lit: H19, until: H19 + 3 * bundle.params.fire.log_ms + 1 });
    expect(line(late, H19 + 1)!.text).toBe(
      'Keep the elder hearth burning until dawn - fed to reach dawn: 2 more logs, the next at 21:01',
    );
    // the Feed refusal names the same time, and none once a log fits
    expect(nextLogClock(bundle, full, HEARTH, H19 + 1)).toBe('21:00');
    expect(nextLogClock(bundle, full, HEARTH, H21)).toBeUndefined();
    // one log short at 22:00, while five hours of wood are left: it fits at 23:00
    expect(line(withFire({ lit: H19, until: DAWN - 100_000 }), H21 + 50_000)!.text).toBe(
      'Keep the elder hearth burning until dawn - fed to reach dawn: 1 more log, the next at 23:00',
    );
    // a log that fits inside the last minute before midnight is promised for the first minute after it
    expect(line(withFire({ lit: H19, until: 799_500 }), H21 + 100_001)!.text).toBe(
      'Keep the elder hearth burning until dawn - fed to reach dawn: 1 more log, the next at 0:00',
    );
  });

  test('a fire first lit after dark began cannot keep this night', () => {
    expect(line(withFire({ lit: DUSK + 10_000, until: DAWN }), DUSK + 20_000)!.text).toBe(
      'Keep the elder hearth burning until dawn - tonight is lost: light it before dusk',
    );
  });

  test('waits for dawn once the wood reaches it, is met at dawn until the next dusk, and agrees with the kernel', () => {
    const s = withFire({ lit: H19, until: DAWN });
    const waiting = { text: 'Keep the elder hearth burning until dawn - it has the wood: wait for dawn', done: false };
    expect(line(s, DUSK + 1)).toEqual(waiting);
    expect(line(s, DAWN - 1)).toEqual(waiting);
    expect(line(s, DAWN)).toEqual({ text: 'Keep the elder hearth burning until dawn', done: true });
    // met through the day; the next dusk asks for a new night
    const nextDusk = DUSK + bundle.params.day_length_ms;
    expect(line(s, nextDusk - 1)!.done).toBe(true);
    expect(line(s, nextDusk)).toEqual({ text: 'Keep the elder hearth burning until dawn - light it before dusk', done: false });
    for (const tick of [H19, DUSK, DUSK + 1, H21, DAWN - 1, DAWN, DAWN + 1, nextDusk - 1, nextDusk]) {
      expect(line(s, tick)!.done).toBe(questSatisfied(bundle, { ...s, tick }, QUEST));
    }
    // the state's own tick lags behind the live one: the giver reads the live tick, and only from dawn
    s.tick = H19;
    expect(readyToHandIn(bundle, s, QUEST)).toBe(false);
    expect(readyToHandIn(bundle, s, QUEST, DAWN - 1)).toBe(false);
    expect(readyToHandIn(bundle, s, QUEST, DAWN)).toBe(true);
  });
});

describe('the running-low warning', () => {
  test('opens in the last fire.warn_min game minutes of a burn, keyed by that burn', () => {
    expect(warnTicks(bundle)).toBe(25_000);
    const s = withFire({ lit: H19, until: H21 });
    expect(fireWarnKey(bundle, s, HEARTH, H21 - 25_001)).toBeUndefined();
    expect(fireWarnKey(bundle, s, HEARTH, H21 - 25_000)).toBe(`${HEARTH}@${H19}`);
    expect(fireLow(bundle, s, HEARTH, H21 - 1)).toBe(true);
    // out is out, not low
    expect(fireWarnKey(bundle, s, HEARTH, H21)).toBeUndefined();
    // a top-up keeps the burn and so its key; a fire lit again is a new burn
    expect(fireWarnKey(bundle, withFire({ lit: H19, until: H21 + 100_000 }), HEARTH, H21 + 90_000)).toBe(`${HEARTH}@${H19}`);
    expect(fireWarnKey(bundle, withFire({ lit: H21 + 5, until: H21 + 100_005 }), HEARTH, H21 + 90_000)).toBe(`${HEARTH}@${H21 + 5}`);
  });

  test('once per burn, only for a fire a tend step keeps, wherever the player stands', () => {
    const at = H21 - 10_000;
    const s = withFire({ lit: H19, until: H21 });
    // nothing about the screen goes in: a fire off screen warns as one on it does (6b)
    expect(fireWarning(bundle, s, at, new Set())).toEqual({ key: `${HEARTH}@${H19}`, id: HEARTH, name: 'elder hearth' });
    expect(fireWarning(bundle, s, at, new Set([`${HEARTH}@${H19}`]))).toBeUndefined();
    expect(fireWarning(bundle, withFire({ lit: H19, until: H21 }, 'done'), at, new Set())).toBeUndefined();
    expect(fireWarning(bundle, withFire({ lit: H19, until: H21 }, 'none'), at, new Set())).toBeUndefined();
  });

  test('opens only while the fire wants wood for its night: never once its wood reaches dawn, nor after the night is kept', () => {
    const { log_ms } = bundle.params.fire;
    // the journal's night (three logs at 19:00, one at 21:00, one at 23:00) has wood to exactly 05:00:
    // low from 04:30, while the journal waits for dawn, and no box asks for wood
    const toDawn = withFire({ lit: H19, until: DAWN });
    for (const tick of [DAWN - 25_000, DAWN - 1]) {
      expect(fireLow(bundle, toDawn, HEARTH, tick)).toBe(true);
      expect(questSteps(bundle, toDawn, QUEST, tick)[0]!.text).toBe('Keep the elder hearth burning until dawn - it has the wood: wait for dawn');
      expect(wantsWood(bundle, toDawn, HEARTH, tick)).toBe(false);
      expect(fireWarning(bundle, toDawn, tick, new Set())).toBeUndefined();
    }
    // three logs at 19:00 alone run out at 01:00: from 00:30 the box opens while the journal asks for two more
    const short = withFire({ lit: H19, until: H19 + 3 * log_ms });
    expect(questSteps(bundle, short, QUEST, 625_000)[0]!.text).toBe('Keep the elder hearth burning until dawn - fed to reach dawn: 2 more logs');
    expect(fireWarning(bundle, short, 625_000, new Set())).toEqual({ key: `${HEARTH}@${H19}`, id: HEARTH, name: 'elder hearth' });
    // lit again at 06:00 after the night it kept: low at 07:30 with the step met, so nothing is asked
    const relit = withFire({ lit: DAWN + 50_000, until: DAWN + 50_000 + log_ms, kept: DAWN });
    expect(fireLow(bundle, relit, HEARTH, DAWN + 125_000)).toBe(true);
    expect(questSteps(bundle, relit, QUEST, DAWN + 125_000)[0]).toEqual({ text: 'Keep the elder hearth burning until dawn', done: true });
    expect(fireWarning(bundle, relit, DAWN + 125_000, new Set())).toBeUndefined();
    // lit after dark began: that night is lost, and the journal asks for a fire before the next dusk, not for wood
    expect(fireWarning(bundle, withFire({ lit: DUSK + 10_000, until: DUSK + 10_000 + log_ms }), DUSK + 100_000, new Set())).toBeUndefined();
    // by day a burn that would go out before the coming night is still warned of: a log keeps it for that night
    const noon = bundle.params.day_length_ms;
    expect(fireWarning(bundle, withFire({ lit: noon, until: noon + 2 * log_ms }), noon + 2 * log_ms - 25_000, new Set())).toEqual({
      key: `${HEARTH}@${noon}`,
      id: HEARTH,
      name: 'elder hearth',
    });
  });

  test('wants wood exactly when the journal counts logs', () => {
    const { log_ms } = bundle.params.fire;
    const noon = bundle.params.day_length_ms;
    const fires: (FireState | undefined)[] = [
      undefined,
      { lit: H19, until: H21 },
      { lit: H19, until: DAWN },
      { lit: DUSK + 10_000, until: DAWN },
      { lit: DAWN + 50_000, until: DAWN + 50_000 + log_ms, kept: DAWN },
      { lit: noon, until: noon + 2 * log_ms },
    ];
    for (const fire of fires) {
      const s = withFire(fire);
      for (const tick of [H19, DUSK, H21, DAWN - 25_000, DAWN, DAWN + 125_000, noon + 2 * log_ms - 25_000]) {
        expect(wantsWood(bundle, s, HEARTH, tick)).toBe(/fed to reach dawn/.test(questSteps(bundle, s, QUEST, tick)[0]!.text));
      }
    }
  });

  test('opens only while the fire wants wood for its night: never once its wood reaches dawn, nor after the night is kept', () => {
    const seen = () => true;
    const { log_ms } = bundle.params.fire;
    // the journal's night (three logs at 19:00, one at 21:00, one at 23:00) has wood to exactly 05:00:
    // low from 04:30, while the journal waits for dawn, and no box asks for wood
    const toDawn = withFire({ lit: H19, until: DAWN });
    for (const tick of [DAWN - 25_000, DAWN - 1]) {
      expect(fireLow(bundle, toDawn, HEARTH, tick)).toBe(true);
      expect(questSteps(bundle, toDawn, QUEST, tick)[0]!.text).toBe('Keep the elder hearth burning until dawn - it has the wood: wait for dawn');
      expect(wantsWood(bundle, toDawn, HEARTH, tick)).toBe(false);
      expect(fireWarning(bundle, toDawn, tick, new Set(), seen)).toBeUndefined();
    }
    // three logs at 19:00 alone run out at 01:00: from 00:30 the box opens while the journal asks for two more
    const short = withFire({ lit: H19, until: H19 + 3 * log_ms });
    expect(questSteps(bundle, short, QUEST, 625_000)[0]!.text).toBe('Keep the elder hearth burning until dawn - fed to reach dawn: 2 more logs');
    expect(fireWarning(bundle, short, 625_000, new Set(), seen)).toEqual({ key: `${HEARTH}@${H19}`, id: HEARTH, name: 'elder hearth' });
    // lit again at 06:00 after the night it kept: low at 07:30 with the step met, so nothing is asked
    const relit = withFire({ lit: DAWN + 50_000, until: DAWN + 50_000 + log_ms, kept: DAWN });
    expect(fireLow(bundle, relit, HEARTH, DAWN + 125_000)).toBe(true);
    expect(questSteps(bundle, relit, QUEST, DAWN + 125_000)[0]).toEqual({ text: 'Keep the elder hearth burning until dawn', done: true });
    expect(fireWarning(bundle, relit, DAWN + 125_000, new Set(), seen)).toBeUndefined();
    // lit after dark began: that night is lost, and the journal asks for a fire before the next dusk, not for wood
    expect(fireWarning(bundle, withFire({ lit: DUSK + 10_000, until: DUSK + 10_000 + log_ms }), DUSK + 100_000, new Set(), seen)).toBeUndefined();
    // by day a burn that would go out before the coming night is still warned of: a log keeps it for that night
    const noon = bundle.params.day_length_ms;
    expect(fireWarning(bundle, withFire({ lit: noon, until: noon + 2 * log_ms }), noon + 2 * log_ms - 25_000, new Set(), seen)).toEqual({
      key: `${HEARTH}@${noon}`,
      id: HEARTH,
      name: 'elder hearth',
    });
  });

  test('wants wood exactly when the journal counts logs', () => {
    const { log_ms } = bundle.params.fire;
    const noon = bundle.params.day_length_ms;
    const fires: (FireState | undefined)[] = [
      undefined,
      { lit: H19, until: H21 },
      { lit: H19, until: DAWN },
      { lit: DUSK + 10_000, until: DAWN },
      { lit: DAWN + 50_000, until: DAWN + 50_000 + log_ms, kept: DAWN },
      { lit: noon, until: noon + 2 * log_ms },
    ];
    for (const fire of fires) {
      const s = withFire(fire);
      for (const tick of [H19, DUSK, H21, DAWN - 25_000, DAWN, DAWN + 125_000, noon + 2 * log_ms - 25_000]) {
        expect(wantsWood(bundle, s, HEARTH, tick)).toBe(/fed to reach dawn/.test(questSteps(bundle, s, QUEST, tick)[0]!.text));
      }
    }
  });
});

describe('a prop lit by a fire', () => {
  test('reads only while that fire burns', () => {
    const s = withFire({ lit: H19, until: H21 });
    expect(readable(s, undefined, H21)).toBe(true);
    expect(readable(s, HEARTH, H21 - 1)).toBe(true);
    expect(readable(s, HEARTH, H21)).toBe(false);
    expect(TOO_DARK).toBe('Too dark to read.');
  });
});

describe('a night lost (6b)', () => {
  const KEEP = 'Keep the elder hearth burning until dawn';
  const NEXT_DUSK = DUSK + 1_200_000;
  const line = (s: State, tick: number) => questSteps(bundle, s, QUEST, tick)[0]!.text;
  const at = (s: State, tick: number): State => ({ ...s, tick });

  test('a fire out in the night it kept: the journal says the night is lost through that night and the day, and the next dusk starts clean', () => {
    const s = withFire({ lit: H19, until: H21 });
    expect(nightLost(bundle, s, HEARTH, H21 - 1)).toBeUndefined();
    for (const tick of [H21, H21 + 1, DAWN - 1]) {
      expect(nightLost(bundle, s, HEARTH, tick)).toBe('out');
      expect(line(s, tick)).toBe(`${KEEP} - it went out, tonight is lost: light it before dusk`);
    }
    for (const tick of [DAWN, DAWN + 25_000, NEXT_DUSK - 1]) {
      expect(nightLost(bundle, s, HEARTH, tick)).toBe('past');
      expect(line(s, tick)).toBe(`${KEEP} - it went out in the night: light it before dusk`);
    }
    expect(nightLost(bundle, s, HEARTH, NEXT_DUSK)).toBeUndefined();
    expect(line(s, NEXT_DUSK)).toBe(`${KEEP} - light it before dusk`);
  });

  test('nothing is lost by a fire out before dusk, a night kept, or a fire lit again by day', () => {
    // lit at 17:00, out at 19:00: no night was under way, and none is told lost
    const early = withFire({ lit: H19 - 100_000, until: H19 });
    expect(nightLost(bundle, early, HEARTH, H21)).toBeUndefined();
    expect(line(early, H21)).toBe(`${KEEP} - light it before dusk`);
    // wood to dawn exactly: the night was kept, though the fire goes out at dawn
    expect(nightLost(bundle, withFire({ lit: H19, until: DAWN }), HEARTH, DAWN)).toBeUndefined();
    // out in the night, then lit again at 06:00: the day's line counts logs for the coming night
    const relit = withFire({ lit: DAWN + 50_000, until: DAWN + 150_000 });
    expect(nightLost(bundle, relit, HEARTH, DAWN + 60_000)).toBeUndefined();
    expect(line(relit, DAWN + 60_000)).toMatch(/fed to reach dawn/);
  });

  test('a fire lit after dark began is late for its night: the feed is told plainly, never cheered', () => {
    const late = withFire({ lit: DUSK + 10_000, until: DUSK + 110_000 });
    expect(nightLost(bundle, late, HEARTH, DUSK + 10_000)).toBe('late');
    expect(feedTooLate(bundle, late, HEARTH, DUSK + 10_000)).toBe(true);
    expect(describeEvent(bundle, at(late, DUSK + 10_000), { e: 'fire', id: HEARTH, until: DUSK + 110_000 })).toEqual({
      text: 'The elder hearth burns, but tonight is lost.',
      tone: 'info',
    });
    // lit again at 21:10 after it went out at 21:00: just as late
    const relit = withFire({ lit: H21 + 10_000, until: H21 + 110_000 });
    expect(feedTooLate(bundle, relit, HEARTH, H21 + 10_000)).toBe(true);
    expect(describeEvent(bundle, at(relit, H21 + 10_000), { e: 'fire', id: HEARTH, until: H21 + 110_000 })!.tone).toBe('info');
  });

  test('a feed that can still keep a night, a feed by day, and a fire no task keeps are cheered as before', () => {
    // a log at 21:00 on a fire lit by its dusk
    const kept = withFire({ lit: H19, until: H21 + 100_000 });
    expect(feedTooLate(bundle, kept, HEARTH, H21)).toBe(false);
    expect(describeEvent(bundle, at(kept, H21), { e: 'fire', id: HEARTH, until: H21 + 100_000 })).toEqual({
      text: 'The elder hearth burns until 23:00.',
      tone: 'good',
    });
    // lit by day after a lost night: the try for the next night
    const noon = bundle.params.day_length_ms;
    const day = withFire({ lit: noon, until: noon + 100_000 });
    expect(feedTooLate(bundle, day, HEARTH, noon)).toBe(false);
    expect(describeEvent(bundle, at(day, noon), { e: 'fire', id: HEARTH, until: noon + 100_000 })!.tone).toBe('good');
    // lit after dark with the task done: no night of a task was lost
    const free = withFire({ lit: DUSK + 10_000, until: DUSK + 110_000 }, 'done');
    expect(feedTooLate(bundle, free, HEARTH, DUSK + 10_000)).toBe(false);
    expect(describeEvent(bundle, at(free, DUSK + 10_000), { e: 'fire', id: HEARTH, until: DUSK + 110_000 })!.tone).toBe('good');
  });

  test('the fire_out the kernel tells reads as a bad line with the retry in words, and no clock', () => {
    const told = describeEvent(bundle, withFire({ lit: H19, until: H21 }), { e: 'fire_out', id: HEARTH });
    expect(told).toEqual({ text: 'The elder hearth went out - tonight is lost. Try again before the next dusk.', tone: 'bad' });
    expect(told!.text).not.toMatch(/\d:\d\d/);
  });
});
