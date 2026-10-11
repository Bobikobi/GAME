/**
 * The three starts (DECISIONS.md, 2026-10-10): each character wakes at its own
 * place with its own kit, a kit piece worn for its work goes on from the first
 * morning, a start's own first task is offered to it alone, and a start's own
 * spot shows to it alone, gives its one find every time, and only once. A
 * reward its kit already holds comes as something the kit lacks.
 */
import { beforeAll, describe, expect, test } from 'vitest';

import { type Bundle, type State, type StepResult, newState, npcTile, rewardItem, spotOpen, step } from '@game/kernel';

import { type Tile, bfsNear, loadBundle } from '../../tools/test/helpers/world.js';

let b: Bundle;

beforeAll(() => {
  b = loadBundle();
});

function started(starter: string): State {
  const r = step(b, newState(b, 7), { t: 'start', starter, name: 'Tester' }, 0);
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

describe('waking', () => {
  test('each start wakes at its own place, the map spawn when it names none', () => {
    expect(Object.keys(b.starters).sort()).toEqual(['core/digger', 'core/explorer', 'core/forager']);
    for (const s of Object.values(b.starters)) {
      expect(started(s.id).player.at, s.id).toEqual(s.wake ? [s.wake.x, s.wake.y] : [b.map.spawn.x, b.map.spawn.y]);
    }
  });

  test('a kit piece worn for its work goes on from the first morning', () => {
    const explorer = started('core/explorer');
    expect(explorer.player.bag['core/walking-staff']).toBe(1);
    expect(explorer.player.worn).toEqual({ hand: 'core/walking-staff' });
    expect(started('core/digger').player.worn).toEqual({});
  });
});

describe("a start's own first task", () => {
  test('is offered to its start alone', () => {
    const own = Object.values(b.quests).filter((q) => q.starter !== undefined);
    expect(own.map((q) => q.starter).sort()).toEqual(['core/digger', 'core/explorer', 'core/forager']);
    for (const s of Object.values(b.starters)) {
      const quests = started(s.id).player.quests;
      for (const q of own) expect(quests[q.id], `${s.id} ${q.id}`).toBe(q.starter === s.id ? 'active' : undefined);
    }
  });
});

describe("a start's own spot", () => {
  test('shows to its start alone, and refuses every other', () => {
    const spot = spotOf('core/slid-bank');
    expect(spotOpen(b, started('core/digger'), spot)).toBe(true);
    const forager = started('core/forager');
    forager.player.bag['core/trowel'] = 1;
    expect(spotOpen(b, forager, spot)).toBe(false);
    expect(dig(forager, spot)).toEqual({ ok: false, error: 'There is nothing to dig here.' });
  });

  test('gives its one find on the worst timing, and only once', () => {
    const spot = spotOf('core/slid-bank');
    const r = dig(started('core/digger'), spot, 0);
    if (!r.ok) throw new Error(r.error);
    expect(r.state.player.bag['core/axe']).toBe(1);
    // a task nobody gave keeps what it found: the axe is the digger's
    expect(r.state.player.quests['core/buried-axe']).toBe('done');
    expect(spotOpen(b, r.state, spot)).toBe(false);
    expect(dig(r.state, spot, 3, r.state.player.busyUntil + 3_600_000)).toEqual({ ok: false, error: 'There is nothing more here.' });
  });

  test('picked up by hand asks for no tool and wears none', () => {
    const explorer = started('core/explorer');
    expect(Object.values(b.items).filter((it) => it.tool?.kind !== 'staff' && explorer.player.bag[it.id])).toEqual([]);
    const r = dig(explorer, spotOf('core/bridge-glint'));
    if (!r.ok) throw new Error(r.error);
    expect(r.state.player.bag).toEqual({ 'core/walking-staff': 1, 'core/axe': 1 });
    expect(r.state.player.wear).toEqual({});
    expect(r.state.player.quests['core/glint-by-the-bridge']).toBe('done');
  });
});

describe('a reward item', () => {
  const stack = { item: 'core/trowel', instead: 'core/walking-staff' };

  test('comes as its swap to a start whose kit holds it, and as itself to every other', () => {
    expect(rewardItem(b, 'core/digger', stack)).toBe('core/walking-staff');
    expect(rewardItem(b, 'core/forager', stack)).toBe('core/trowel');
    expect(rewardItem(b, 'core/explorer', stack)).toBe('core/trowel');
    expect(rewardItem(b, 'core/digger', { item: 'core/trowel' })).toBe('core/trowel');
  });

  test("Maru's bells give the digger a walking staff in place of a second trowel", () => {
    const s = started('core/digger');
    // past the bridge and into town, with the bells picked
    s.player.restored = ['core/old-bridge'];
    for (const id of ['core/fix-the-bridge', 'core/first-fire', 'core/into-town']) s.player.quests[id] = 'done';
    s.player.quests['core/three-fruits'] = 'active';
    s.player.bag['core/bellberry'] = 1;
    const [x, y] = npcTile(b, 'core/elder')!;
    const at: Tile = bfsNear(b, s.player, s.player.at, { x, y, w: 1, h: 1 })!.at(-1)!;
    const r = step(b, s, { t: 'turnin', quest: 'core/three-fruits', at }, 0);
    if (!r.ok) throw new Error(r.error);
    expect(r.state.player.bag['core/trowel']).toBe(1);
    expect(r.state.player.bag['core/walking-staff']).toBe(1);
  });
});
