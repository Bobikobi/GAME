import { beforeAll, describe, expect, test } from 'vitest';

import { type Action, type Bundle, type GameEvent, type State, campTile, makeWalkable, newState, step } from '@game/kernel';
import { TOASTS, ToastBand, eventToasts, mergeTasks } from '../src/toasts';
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
    let s = newState(bundle, 1);
    const act = (a: Action, tick: number): GameEvent[] => {
      const r = step(bundle, s, a, tick);
      if (!r.ok) throw new Error(r.error);
      s = r.state;
      return r.events;
    };
    act({ t: 'start', starter: 'core/forager', name: 'Tess' }, 0);
    // the bridge mended: a fire before dark is the task, and the bag holds the logs for it
    for (const id of Object.keys(s.player.quests)) if (s.player.quests[id] === 'active') s.player.quests[id] = 'done';
    s.player.quests['core/fix-the-bridge'] = 'done';
    s.player.restored.push('core/old-bridge');
    s.player.bag['core/log'] = 6;
    const at = beside(s, campTile(bundle, 'fire')!);
    act({ t: 'move', at }, 600_000);
    expect(s.player.quests['core/first-fire']).toBe('active');
    const events = act({ t: 'build', camp: 'core/campfire', at }, 601_000);
    expect(eventToasts(bundle, s, events)).toEqual([
      { lines: ['Campfire built'], tone: 'good' },
      { lines: ['Task done: A fire before dark', 'New task: Smoke over the town'], tone: 'good' },
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

  test('while a box is open nothing new goes up, and the toasts up stand still', () => {
    const band = new ToastBand<string>();
    band.add('a');
    band.run(0, false);
    band.add('b');
    // a box opens at 1000 and closes at 6000
    expect(band.run(1000, true)).toEqual({ show: [], fade: [], remove: [] });
    expect(band.run(4000, true)).toEqual({ show: [], fade: [], remove: [] });
    // b goes up, and a has the rest of its time: it had stood 1000
    expect(band.run(6000, false)).toEqual({ show: ['b'], fade: [], remove: [], next: 6000 + life - 1000 });
  });

  test('a fall takes everything down, the line too', () => {
    const band = new ToastBand<string>();
    for (const t of ['a', 'b', 'c']) band.add(t);
    band.run(0, false);
    expect(band.clear()).toEqual(['a', 'b']);
    expect(band.run(10, false)).toEqual({ show: [], fade: [], remove: [] });
  });
});
