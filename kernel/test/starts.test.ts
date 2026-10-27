/**
 * The three wake pockets (DECISIONS.md, 2026-10-22, after the three starts of 2026-10-10): the seed
 * draws where a character wakes, the pocket's tools lie on the ground by the wake tile, a pocket's own
 * first task is offered to a character who woke there alone, and a pocket's own spot shows to that
 * character alone, gives its one find every time, and only once. A reward the pocket's ground already
 * gives comes as something the pocket lacks.
 */
import { beforeAll, describe, expect, test } from 'vitest';

import { type Bundle, type State, type StepResult, newState, npcTile, rewardItem, spotOpen, step, wakePocket, widenSeed } from '@game/kernel';

import { type Tile, bfsNear, loadBundle } from '../../tools/test/helpers/world.js';

let b: Bundle;

beforeAll(() => {
  b = loadBundle();
});

/** The first seed that wakes in this pocket. */
function seedFor(pocket: string): number {
  for (let seed = 1; seed < 10_000; seed++) if (wakePocket(b, widenSeed(seed)) === pocket) return seed;
  throw new Error(`no seed wakes in ${pocket}`);
}

/** A character of this race woken in this pocket. */
function started(pocket: string, race = 'core/human'): State {
  const r = step(b, newState(b, seedFor(pocket)), { t: 'start', race, name: 'Tester' }, 0);
  if (!r.ok) throw new Error(r.error);
  return r.state;
}

/** The one spot a source lays on the map. */
function spotOf(source: string): string {
  const [id] = Object.entries(b.instances).find(([, inst]) => inst.source === source)!;
  return id;
}

/** Dig a spot from the nearest tile the character can walk to. */
function dig(s: State, spot: string, grade: 0 | 3 = 3, tick = Math.max(s.tick, s.player.busyUntil)): StepResult {
  const inst = b.instances[spot]!;
  const at: Tile = bfsNear(b, s.player, s.player.at, { x: inst.x, y: inst.y, w: 1, h: 1 })!.at(-1)!;
  return step(b, s, { t: 'dig', spot, grade, at }, tick);
}

/** Pick up every tool the pocket lays by the wake tile. */
function pickUpGround(s: State): State {
  let state = s;
  for (const [id, inst] of Object.entries(b.instances)) {
    if (inst.kind !== 'treasure' || b.treasures[inst.source]?.pocket !== s.player.pocket) continue;
    if (!b.pockets[s.player.pocket]!.ground.some((g) => b.treasures[inst.source]!.finds[0]?.item === g.item)) continue;
    const r = dig(state, id);
    if (!r.ok) throw new Error(r.error);
    state = r.state;
  }
  return state;
}

describe('waking', () => {
  test('the three pockets wake where the old starts woke', () => {
    expect(Object.keys(b.pockets).sort()).toEqual(['core/north-meadow', 'core/slid-bank', 'core/west-bank']);
    expect(b.pockets['core/north-meadow']!.wake).toEqual({ x: 7, y: 6 });
    expect(b.pockets['core/west-bank']!.wake).toEqual({ x: 6, y: 17 });
    expect(b.pockets['core/slid-bank']!.wake).toEqual({ x: 9, y: 23 });
    for (const p of Object.values(b.pockets)) expect(started(p.id).player.at, p.id).toEqual([p.wake.x, p.wake.y]);
  });

  test("the pocket's tools lie on the ground: none is in the bag, and each is picked up by hand", () => {
    for (const p of Object.values(b.pockets)) {
      const s = started(p.id);
      for (const g of p.ground) expect(s.player.bag[g.item], `${p.id} ${g.item}`).toBeUndefined();
      const picked = pickUpGround(s);
      for (const g of p.ground) expect(picked.player.bag[g.item], `${p.id} ${g.item}`).toBe(g.qty);
      expect(picked.player.wear, p.id).toEqual({});
    }
  });
});

describe("a pocket's own first task", () => {
  test('is offered to a character who woke there alone, whatever the race', () => {
    const own = Object.values(b.quests).filter((q) => q.pocket !== undefined);
    expect(own.map((q) => q.pocket).sort()).toEqual(['core/north-meadow', 'core/slid-bank', 'core/west-bank']);
    for (const p of Object.values(b.pockets)) {
      for (const race of Object.keys(b.races)) {
        const quests = started(p.id, race).player.quests;
        for (const q of own) expect(quests[q.id], `${p.id} ${race} ${q.id}`).toBe(q.pocket === p.id ? 'active' : undefined);
      }
    }
  });
});

describe("a pocket's own spot", () => {
  test('shows to a character who woke there alone, and refuses every other', () => {
    const spot = spotOf('core/slid-bank-dig');
    expect(spotOpen(b, started('core/slid-bank'), spot)).toBe(true);
    const other = started('core/west-bank');
    other.player.bag['core/trowel'] = 1;
    expect(spotOpen(b, other, spot)).toBe(false);
    expect(dig(other, spot)).toEqual({ ok: false, error: 'There is nothing to dig here.' });
  });

  test('gives its one find on the worst timing, and only once', () => {
    const spot = spotOf('core/slid-bank-dig');
    const s = pickUpGround(started('core/slid-bank'));
    const r = dig(s, spot, 0);
    if (!r.ok) throw new Error(r.error);
    expect(r.state.player.bag['core/axe']).toBe(1);
    // a task nobody gave keeps what it found: the axe is the finder's
    expect(r.state.player.quests['core/buried-axe']).toBe('done');
    expect(spotOpen(b, r.state, spot)).toBe(false);
    expect(dig(r.state, spot, 3, r.state.player.busyUntil + 3_600_000)).toEqual({ ok: false, error: 'There is nothing more here.' });
  });

  test('picked up by hand asks for no tool and wears none', () => {
    const s = started('core/north-meadow');
    const r = dig(s, spotOf('core/bridge-glint'));
    if (!r.ok) throw new Error(r.error);
    expect(r.state.player.bag['core/axe']).toBe(1);
    expect(r.state.player.wear).toEqual({});
    expect(r.state.player.quests['core/glint-by-the-bridge']).toBe('done');
  });
});

describe('a reward item', () => {
  const stack = { item: 'core/trowel', instead: 'core/walking-staff' };

  test("comes as its swap to a pocket whose ground lays it, and as itself to every other", () => {
    expect(rewardItem(b, 'core/slid-bank', stack)).toBe('core/walking-staff');
    expect(rewardItem(b, 'core/west-bank', stack)).toBe('core/trowel');
    expect(rewardItem(b, 'core/north-meadow', stack)).toBe('core/trowel');
    expect(rewardItem(b, 'core/slid-bank', { item: 'core/trowel' })).toBe('core/trowel');
  });

  test("Maru's bells give the slid bank a walking staff in place of a second trowel", () => {
    const s = pickUpGround(started('core/slid-bank'));
    // past the bridge and into town, with the bells picked
    s.player.restored = ['core/old-bridge'];
    for (const id of ['core/fix-the-bridge', 'core/first-fire', 'core/into-town']) s.player.quests[id] = 'done';
    s.player.quests['core/three-fruits'] = 'active';
    s.player.bag['core/bellberry'] = 1;
    const [x, y] = npcTile(b, 'core/elder')!;
    const at: Tile = bfsNear(b, s.player, s.player.at, { x, y, w: 1, h: 1 })!.at(-1)!;
    const r = step(b, s, { t: 'turnin', quest: 'core/three-fruits', at }, Math.max(s.tick, s.player.busyUntil));
    if (!r.ok) throw new Error(r.error);
    expect(r.state.player.bag['core/trowel']).toBe(1);
    expect(r.state.player.bag['core/walking-staff']).toBe(1);
  });
});

describe('the keystone waits for the glint (opens_after)', () => {
  const key = (): string => spotOf('core/keystone');
  function strike(s: State): StepResult {
    const inst = b.instances[key()]!;
    const at: Tile = bfsNear(b, s.player, s.player.at, { x: inst.x, y: inst.y, w: 1, h: 1 })!.at(-1)!;
    return step(b, s, { t: 'gather', node: key(), grade: 3, at }, Math.max(s.tick, s.player.busyUntil));
  }

  test('the north meadow is refused with one short line that changes nothing, until the glint is picked up', () => {
    const s = started('core/north-meadow');
    const refused = strike(s);
    expect(refused).toEqual({ ok: false, error: 'Something else catches the light first.' });
    expect(refused.ok ? 0 : refused.error.length).toBeLessThanOrEqual(80);
    expect(s.player.busyUntil).toBe(0);
    expect(s.player.bag['core/keystone']).toBeUndefined();

    const picked = dig(s, spotOf('core/bridge-glint'));
    if (!picked.ok) throw new Error(picked.error);
    expect(picked.state.player.quests['core/glint-by-the-bridge']).toBe('done');
    const after = strike(picked.state);
    expect(after.ok).toBe(true);
    expect(after.ok && after.state.player.bag['core/keystone']).toBe(1);
  });

  test('the west bank and the slid bank strike it at once, as before', () => {
    for (const pocket of ['core/west-bank', 'core/slid-bank']) {
      const r = strike(started(pocket));
      expect(r.ok, pocket).toBe(true);
      expect(r.ok && r.state.player.bag['core/keystone'], pocket).toBe(1);
    }
  });
});
