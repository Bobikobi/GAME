import { beforeAll, describe, expect, test } from 'vitest';

import { type Action, type Bundle, type State, makeWalkable, newState, npcTile, replay, serialize, step } from '@game/kernel';
import { activeQuests } from '../src/text';
import { loadBundle } from '../../tools/test/helpers/world';

let bundle: Bundle;

beforeAll(() => {
  bundle = loadBundle();
});

const OPENING = ['core/fix-the-bridge', 'core/first-fire', 'core/into-town', 'core/three-fruits', 'core/a-coin-for-maru'];
const ARCH = 'core/the-night-arch';
const LONG_NIGHT = 'core/the-long-night';

describe('the tracked task', () => {
  test('reads the same after a save and in a replay: it follows a rule, not the order the tasks were taken in', () => {
    const log: { a: Action; tick: number }[] = [];
    let s = newState(bundle, 1);
    const act = (a: Action, tick: number): void => {
      const r = step(bundle, s, a, tick);
      if (!r.ok) throw new Error(r.error);
      s = r.state;
      log.push({ a, tick });
    };
    act({ t: 'start', starter: 'core/forager', name: 'Tess' }, 0);
    // the opening as played
    for (const id of Object.keys(s.player.quests)) if (s.player.quests[id] === 'active') s.player.quests[id] = 'done';
    for (const id of OPENING) s.player.quests[id] = 'done';
    const seeded = structuredClone(s);
    // the next step opens the arch at night by itself; then the long night is taken from Maru
    act({ t: 'move', at: s.player.at }, 1000);
    expect(s.player.quests[ARCH]).toBe('active');
    const maru = npcTile(bundle, 'core/elder')!;
    const walk = makeWalkable(bundle);
    const at = ([[0, 1], [0, -1], [1, 0], [-1, 0]] as const)
      .map(([dx, dy]): [number, number] => [maru[0] + dx, maru[1] + dy])
      .find(([x, y]) => walk(x, y, s.player))!;
    act({ t: 'move', at }, 900_000);
    act({ t: 'accept', quest: LONG_NIGHT, at }, 901_000);

    const saved = JSON.parse(serialize(s)) as State;
    const replayed = replay(bundle, seeded, log.slice(1));
    expect(replayed.error).toBeUndefined();
    // the keys keep the order the tasks opened in only until a save: the saved form sorts them (R3),
    // so "the newest task" cannot be read from them
    const order = (st: State) => Object.keys(st.player.quests).filter((id) => id === ARCH || id === LONG_NIGHT);
    expect(order(s)).toEqual([ARCH, LONG_NIGHT]);
    expect(order(saved)).toEqual([LONG_NIGHT, ARCH]);
    // the tracker goes by its rule (the tasks that need nobody first), the same live, saved and replayed
    expect(activeQuests(bundle, s)).toEqual([ARCH, LONG_NIGHT]);
    expect(activeQuests(bundle, saved)).toEqual([ARCH, LONG_NIGHT]);
    expect(activeQuests(bundle, replayed.state)).toEqual([ARCH, LONG_NIGHT]);
  });
});
