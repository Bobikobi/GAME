/** Tending in the client (NEXT 13b): the words and the once-per-burn warning read only the kernel's state and tick. */
import { beforeAll, describe, expect, test } from 'vitest';

import { type Bundle, type State, newState, questSatisfied } from '@game/kernel';
import { TOO_DARK, fireLow, fireName, fireWarnKey, fireWarning, logsToDawn, readable, tendMet, warnTicks, woodToFeed } from '../src/fires';
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

function withFire(fire?: { lit: number; until: number }, quest: 'active' | 'done' | 'none' = 'active'): State {
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
    // burnt out at 21:00
    expect(line(withFire({ lit: H19, until: H21 }), H21 + 1)!.text).toBe('Keep the elder hearth burning until dawn - light it before dusk');
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
    expect(line(withFire({ lit: DUSK + 10_000, until: DAWN }), DUSK + 20_000)!.text).toBe('Keep the elder hearth burning until dawn - light it before dusk');
  });

  test('is met once the wood reaches dawn, and agrees with the kernel', () => {
    const s = withFire({ lit: H19, until: DAWN });
    expect(line(s, DUSK + 1)).toEqual({ text: 'Keep the elder hearth burning until dawn', done: true });
    for (const tick of [H19, DUSK, DUSK + 1, H21, DAWN, DAWN + 1]) {
      expect(tendMet(bundle, s, HEARTH, tick)).toBe(questSatisfied(bundle, { ...s, tick }, QUEST));
    }
    // the state's own tick lags behind the live one: the giver reads the live tick
    s.tick = H19;
    expect(readyToHandIn(bundle, s, QUEST)).toBe(false);
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

  test('once per burn, only for a fire a tend step keeps, only where the player sees it', () => {
    const at = H21 - 10_000;
    const s = withFire({ lit: H19, until: H21 });
    const seen = () => true;
    expect(fireWarning(bundle, s, at, new Set(), seen)).toEqual({ key: `${HEARTH}@${H19}`, id: HEARTH, name: 'elder hearth' });
    expect(fireWarning(bundle, s, at, new Set([`${HEARTH}@${H19}`]), seen)).toBeUndefined();
    expect(fireWarning(bundle, s, at, new Set(), () => false)).toBeUndefined();
    expect(fireWarning(bundle, withFire({ lit: H19, until: H21 }, 'done'), at, new Set(), seen)).toBeUndefined();
    expect(fireWarning(bundle, withFire({ lit: H19, until: H21 }, 'none'), at, new Set(), seen)).toBeUndefined();
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
