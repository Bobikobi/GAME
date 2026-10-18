import { beforeAll, describe, expect, test } from 'vitest';

import { type Action, type Bundle, type GameEvent, type State, campTile, makeWalkable, newState, step } from '@game/kernel';
import { TOASTS, ToastBand, eventToasts, mergeTasks, readTime, urgent } from '../src/toasts';
import { loadBundle } from '../../tools/test/helpers/world';

let bundle: Bundle;

beforeAll(() => {
  bundle = loadBundle();
});

/** A tile to stand on beside another. */
function beside(s: State, t: readonly [number, number]): [number, number] {
  const walk = makeWalkable(bundle);
  for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]] as const) {
    if (walk(t[0] + dx, t[1] + dy, s.player)) return [t[0] + dx, t[1] + dy];
  }
  throw new Error(`nowhere to stand beside ${t.join(',')}`);
}

/** A new character with the bridge mended and the logs for the first campfire, standing beside its place. */
function beforeTheFirstFire(): { act: (a: Action, tick: number) => GameEvent[]; state: () => State; at: [number, number] } {
  let s = newState(bundle, 1);
  const act = (a: Action, tick: number): GameEvent[] => {
    const r = step(bundle, s, a, tick);
    if (!r.ok) throw new Error(r.error);
    s = r.state;
    return r.events;
  };
  act({ t: 'start', starter: 'core/forager', name: 'Tess' }, 0);
  for (const id of Object.keys(s.player.quests)) if (s.player.quests[id] === 'active') s.player.quests[id] = 'done';
  s.player.quests['core/fix-the-bridge'] = 'done';
  s.player.restored.push('core/old-bridge');
  s.player.bag['core/log'] = 6;
  const at = beside(s, campTile(bundle, 'fire')!);
  return { act, state: () => s, at };
}

describe('the task lines of one action read as one toast', () => {
  test('a task done and a new one become one toast where the first of them stood, the done line first', () => {
    expect(
      mergeTasks([
        { text: 'Campfire built', tone: 'good' },
        { text: 'New task: Smoke', tone: 'info', task: 'active' },
        { text: '+2 gold', tone: 'good', icon: 'coin' },
        { text: 'Task done: A fire', tone: 'good', task: 'done' },
      ]),
    ).toEqual([
      { lines: ['Campfire built'], tone: 'good' },
      { lines: ['Task done: A fire', 'New task: Smoke'], tone: 'good' },
      { lines: ['+2 gold'], tone: 'good', icon: 'coin' },
    ]);
  });

  test('a lone task line stays as it is, and two new tasks read as one', () => {
    expect(mergeTasks([{ text: 'New task: A', tone: 'info', task: 'active' }, { text: '+1 Log', tone: 'good' }])).toEqual([
      { lines: ['New task: A'], tone: 'info' },
      { lines: ['+1 Log'], tone: 'good' },
    ]);
    expect(mergeTasks([{ text: 'New task: A', task: 'active' }, { text: 'New task: B', task: 'active' }])).toEqual([
      { lines: ['New task: A', 'New task: B'], tone: 'info' },
    ]);
  });

  test('the first campfire: its own line, then one toast for the task it ends and the task it opens', () => {
    const { act, state, at } = beforeTheFirstFire();
    act({ t: 'move', at }, 600_000);
    expect(state().player.quests['core/first-fire']).toBe('active');
    const events = act({ t: 'build', camp: 'core/campfire', at }, 601_000);
    expect(eventToasts(bundle, state(), events)).toEqual([
      { lines: ['Campfire built'], tone: 'good' },
      { lines: ['Task done: A fire across the river', 'New task: Smoke over the town'], tone: 'good' },
    ]);
  });

  test('a task that opens and closes in the same step is told once, as done', () => {
    // the town square seen before the first fire: building it opens "Smoke over the town" and ends it at once
    const { act, state, at } = beforeTheFirstFire();
    state().player.visited.push('core/town-square');
    act({ t: 'move', at }, 600_000);
    const events = act({ t: 'build', camp: 'core/campfire', at }, 601_000);
    const told = events.flatMap((e) => (e.e === 'quest' ? [`${e.quest} ${e.state}`] : []));
    expect(told).toEqual(['core/first-fire done', 'core/into-town active', 'core/into-town done']);
    expect(eventToasts(bundle, state(), events)).toEqual([
      { lines: ['Campfire built'], tone: 'good' },
      { lines: ['Task done: A fire across the river', 'Task done: Smoke over the town'], tone: 'good' },
    ]);
  });

  test('a fall says it all in its box: the call to run from the hunt does not show', () => {
    const s = newState(bundle, 1);
    const hurt: GameEvent = { e: 'hurt', by: 'predator', hp: 0 };
    const fall: GameEvent = { e: 'fall', from: [1, 1], at: [2, 2], lost: [] };
    expect(eventToasts(bundle, s, [hurt])).toEqual([{ lines: ['Bitten! Run for a safe place'], tone: 'bad' }]);
    expect(eventToasts(bundle, s, [hurt, fall])).toEqual([]);
  });
});

describe('how long a toast is read, and which goes first', () => {
  test('a short line is read in the least time, a long one by its letters, never past its life', () => {
    expect(readTime({ lines: ['+1 Reed'], tone: 'good' })).toBe(TOASTS.least);
    const merged = { lines: ['Task done: A fire across the river', 'New task: Smoke over the town'], tone: 'good' as const };
    expect(readTime(merged)).toBe((34 + 29) * TOASTS.perChar);
    expect(readTime({ lines: ['Foraging level 2! You gained a skill point. New technique: Quick hands.'], tone: 'good' })).toBe(TOASTS.life);
  });

  test('a bad line is urgent: a bite, a refusal, a miss', () => {
    expect(urgent({ lines: ['Bitten! Run for a safe place'], tone: 'bad' })).toBe(true);
    expect(urgent({ lines: ['+1 Reed'], tone: 'good' })).toBe(false);
    expect(urgent({ lines: ['New task: A'], tone: 'info' })).toBe(false);
  });
});

describe('the band: two toasts at most, the rest in line', () => {
  const { life, fade, least } = TOASTS;

  test('one toast alone stands its whole time, then fades and goes', () => {
    const band = new ToastBand<string>();
    band.add('a');
    expect(band.run(0, false)).toEqual({ show: ['a'], fade: [], remove: [], next: life });
    expect(band.run(life - 1, false)).toEqual({ show: [], fade: [], remove: [], next: life });
    expect(band.run(life, false)).toEqual({ show: [], fade: ['a'], remove: [], next: life + fade });
    expect(band.run(life + fade, false)).toEqual({ show: [], fade: [], remove: ['a'] });
  });

  test('a third and a fourth wait their turn, in order, and none is dropped', () => {
    const band = new ToastBand<string>();
    for (const t of ['a', 'b', 'c', 'd']) band.add(t);
    expect(band.run(0, false)).toEqual({ show: ['a', 'b'], fade: [], remove: [], next: least });
    // the oldest leaves early, once read, because another waits
    expect(band.run(least, false)).toEqual({ show: [], fade: ['a'], remove: [], next: least + fade });
    // a fading toast keeps its place until it is gone: never three at once
    expect(band.run(least + fade - 1, false)).toEqual({ show: [], fade: [], remove: [], next: least + fade });
    // a goes, c goes up, and b (read long enough) makes way for d
    expect(band.run(least + fade, false)).toEqual({ show: ['c'], fade: ['b'], remove: ['a'], next: least + 2 * fade });
    expect(band.run(least + 2 * fade, false)).toEqual({ show: ['d'], fade: [], remove: ['b'], next: least + fade + life });
    // nothing waits now: c and d each stand their whole time
    expect(band.run(least + fade + life, false)).toEqual({ show: [], fade: ['c'], remove: [], next: least + 2 * fade + life });
    expect(band.run(least + 2 * fade + life, false)).toEqual({ show: [], fade: ['d'], remove: ['c'], next: least + 3 * fade + life });
    expect(band.run(least + 3 * fade + life, false)).toEqual({ show: [], fade: [], remove: ['d'] });
  });

  test('a toast that comes while two are up waits only until the oldest has been read', () => {
    const band = new ToastBand<string>();
    band.add('a');
    band.run(0, false);
    band.add('b');
    band.run(100, false);
    band.add('c');
    expect(band.run(500, false)).toEqual({ show: [], fade: [], remove: [], next: least });
    expect(band.run(least, false)).toEqual({ show: [], fade: ['a'], remove: [], next: least + fade });
    expect(band.run(least + fade, false)).toEqual({ show: ['c'], fade: [], remove: ['a'], next: 100 + life });
  });

  test('a long toast is read for its length before it makes way', () => {
    const band = new ToastBand<string>();
    band.add('level', { read: 2400 });
    band.add('b');
    band.add('c');
    expect(band.run(0, false)).toEqual({ show: ['level', 'b'], fade: [], remove: [], next: 2400 });
    // b's own life ends while the level line fades; then c takes the place the level line leaves
    expect(band.run(2400, false)).toEqual({ show: [], fade: ['level'], remove: [], next: life });
    expect(band.run(life, false)).toEqual({ show: [], fade: ['b'], remove: [], next: 2400 + fade });
    expect(band.run(2400 + fade, false)).toEqual({ show: ['c'], fade: [], remove: ['level'], next: life + fade });
  });

  test('a bad line goes ahead of the calm ones, and the oldest calm toast makes way at once', () => {
    const band = new ToastBand<string>();
    band.add('+1 Reed');
    band.add('New in your journal');
    band.run(0, false);
    band.add('Jackpot');
    // the bite comes 100ms later, behind a calm line that waits
    band.add('Bitten', { urgent: true });
    expect(band.run(100, false)).toEqual({ show: [], fade: ['+1 Reed'], remove: [], next: 100 + fade });
    // up within one fade of the bite, ahead of the jackpot
    expect(band.run(100 + fade, false)).toEqual({ show: ['Bitten'], fade: [], remove: ['+1 Reed'], next: least });
    // then the calm line again: the oldest makes way once read
    expect(band.run(least, false)).toEqual({ show: [], fade: ['New in your journal'], remove: [], next: least + fade });
    expect(band.run(least + fade, false)).toEqual({ show: ['Jackpot'], fade: [], remove: ['New in your journal'], next: 100 + fade + life });
  });

  test('urgent lines keep their own order, and an urgent toast up is not pushed out by the next', () => {
    const band = new ToastBand<string>();
    band.add('calm');
    band.add('bite 1', { urgent: true });
    band.add('bite 2', { urgent: true });
    // the bites went ahead of the calm one: both up, and the calm one waits
    expect(band.run(0, false)).toEqual({ show: ['bite 1', 'bite 2'], fade: [], remove: [], next: least });
    band.add('bite 3', { urgent: true });
    // no calm toast is up to make way: the oldest bite leaves once read
    expect(band.run(least, false)).toEqual({ show: [], fade: ['bite 1'], remove: [], next: least + fade });
    // bite 3 goes up; bite 2, read by now, makes way for the calm one
    expect(band.run(least + fade, false)).toEqual({ show: ['bite 3'], fade: ['bite 2'], remove: ['bite 1'], next: least + 2 * fade });
    expect(band.run(least + 2 * fade, false)).toEqual({ show: ['calm'], fade: [], remove: ['bite 2'], next: least + fade + life });
  });

  test('a box that opens while a toast is up holds it from that moment, as the page runs the band', () => {
    const band = new ToastBand<string>();
    band.add('a');
    expect(band.run(0, false).next).toBe(life);
    band.add('b');
    // the box opens at 1000: the page runs the band as it opens (ui.ts push), and nothing goes up
    expect(band.run(1000, true)).toEqual({ show: [], fade: [], remove: [] });
    // the timer set before the box fires at 2800: still held, and the hold still counts from 1000
    expect(band.run(life, true)).toEqual({ show: [], fade: [], remove: [] });
    // the box closes at 6000: b goes up, and a has the rest of its time (it had stood 1000)
    expect(band.run(6000, false)).toEqual({ show: ['b'], fade: [], remove: [], next: 6000 + life - 1000 });
    expect(band.run(6000 + life - 1000, false)).toEqual({ show: [], fade: ['a'], remove: [], next: 6000 + life - 1000 + fade });
  });

  test('a fall takes everything down, the line too', () => {
    const band = new ToastBand<string>();
    for (const t of ['a', 'b', 'c']) band.add(t);
    band.run(0, false);
    expect(band.clear()).toEqual(['a', 'b']);
    expect(band.run(10, false)).toEqual({ show: [], fade: [], remove: [] });
  });
});

describe('a fire out (6b)', () => {
  test('the kernel tells it once, in the first step past its end, and it reads as one urgent bad toast', () => {
    let s = newState(bundle, 1);
    const go = (a: Action, tick: number): GameEvent[] => {
      const r = step(bundle, s, a, tick);
      if (!r.ok) throw new Error(r.error);
      s = r.state;
      return r.events;
    };
    go({ t: 'start', starter: 'core/forager', name: 'Tess' }, 0);
    // the long night under way: the elder hearth lit at 19:00 with wood to 21:00
    s.player.quests['core/the-long-night'] = 'active';
    s.player.fires['core/elder-hearth'] = { lit: 350_000, until: 450_000 };
    const here: Action = { t: 'move', at: [s.player.at[0], s.player.at[1]] };
    expect(go(here, 449_000)).toEqual([]);
    const events = go(here, 450_001);
    expect(events).toEqual([{ e: 'fire_out', id: 'core/elder-hearth' }]);
    const toasts = eventToasts(bundle, s, events);
    expect(toasts).toEqual([{ lines: ['The elder hearth went out - tonight is lost. Try again before the next dusk.'], tone: 'bad' }]);
    expect(urgent(toasts[0]!)).toBe(true);
    // told once: the steps after it say nothing of it
    expect(go(here, 460_000)).toEqual([]);
  });
});
