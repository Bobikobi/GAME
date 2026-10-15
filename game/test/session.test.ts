import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';

import { type Bundle, type GameEvent, isSafe, makeWalkable } from '@game/kernel';
import { app } from '../src/app';
import { LEGACY_SAVE_KEY, SAVE_KEY } from '../src/config';
import { s1Use } from '../src/net/s1';
import { DEMO_SINCE_KEY, Session } from '../src/session';
import { say } from '../src/ui/dialog';
import { UI } from '../src/ui/ui';
import { loadBundle } from '../../tools/test/helpers/world';

vi.mock('../src/ui/dialog', () => ({ say: vi.fn() }));

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

let bundle: Bundle;
let storage: MemoryStorage;

beforeAll(() => {
  bundle = loadBundle();
  app.bundle = bundle;
});

beforeEach(() => {
  storage = new MemoryStorage();
  vi.stubGlobal('localStorage', storage);
  vi.mocked(say).mockReset().mockResolvedValue('bye');
});

afterEach(() => {
  delete app.session;
  vi.unstubAllGlobals();
});

function startedSession(name = 'Tester'): Session {
  const session = Session.fresh(bundle);
  const result = session.act({ t: 'start', starter: 'core/forager', name });
  expect(result.ok).toBe(true);
  return session;
}

function talker(): UI {
  const ui = Object.create(UI.prototype) as UI;
  Object.assign(ui, { talkCount: new Map<string, number>() });
  return ui;
}

describe('session persistence', () => {
  test('loads an old save without met NPCs', () => {
    startedSession();
    const oldSave = JSON.parse(storage.getItem(SAVE_KEY)!) as Record<string, unknown>;
    delete oldSave.met;
    storage.setItem(SAVE_KEY, JSON.stringify(oldSave));

    const restored = Session.restore(bundle);
    expect(restored).toBeDefined();
    expect(restored?.met.size).toBe(0);
  });

  test('a save from before the kit existed is given the start\'s axe once, and the next visit leaves it alone', () => {
    startedSession();
    const file = JSON.parse(storage.getItem(SAVE_KEY)!) as { state: string };
    const old = JSON.parse(file.state) as { content: string; player: { bag: Record<string, number>; journal: string[] } };
    delete old.player.bag['core/axe'];
    old.player.journal = old.player.journal.filter((id) => id !== 'core/axe');
    old.content = 'an-older-world';
    file.state = JSON.stringify(old);
    storage.setItem(SAVE_KEY, JSON.stringify(file));

    const restored = Session.restore(bundle)!;
    expect(restored.adapted).toBe(true);
    expect(restored.state.player.bag['core/axe']).toBe(1);
    expect(restored.state.player.journal).toContain('core/axe');

    // the world is current now: an axe the player no longer holds is not handed out again
    delete restored.state.player.bag['core/axe'];
    restored.save();
    const again = Session.restore(bundle)!;
    expect(again.adapted).toBe(false);
    expect(again.state.player.bag['core/axe']).toBeUndefined();
  });

  test('carries a save made under the working title over to the new key', () => {
    startedSession();
    storage.setItem(LEGACY_SAVE_KEY, storage.getItem(SAVE_KEY)!);
    storage.removeItem(SAVE_KEY);

    const restored = Session.restore(bundle);
    expect(restored?.started).toBe(true);
    restored!.save();
    expect(storage.getItem(SAVE_KEY)).not.toBeNull();
    expect(storage.getItem(LEGACY_SAVE_KEY)).toBeNull();

    storage.setItem(LEGACY_SAVE_KEY, storage.getItem(SAVE_KEY)!);
    Session.erase();
    // only the demo's date is left
    expect(storage.length).toBe(1);
    expect(storage.getItem(DEMO_SINCE_KEY)).not.toBeNull();
  });

  test('a save under the new key wins over one left under the working title, which is never read', () => {
    // both keys hold a game when the page closed between writing the new key and removing the old one
    startedSession('Older');
    const older = storage.getItem(SAVE_KEY)!;
    startedSession('Newer');
    storage.setItem(LEGACY_SAVE_KEY, older);
    const getItem = vi.spyOn(storage, 'getItem');

    expect(Session.hasSave()).toBe(true);
    expect(getItem).not.toHaveBeenCalledWith(LEGACY_SAVE_KEY);
    expect(Session.restore(bundle)?.state.player.name).toBe('Newer');
    expect(getItem).toHaveBeenCalledWith(SAVE_KEY);
    expect(getItem).not.toHaveBeenCalledWith(LEGACY_SAVE_KEY);
  });

  test('keeps the save made under the working title when the new key cannot be written', () => {
    startedSession();
    const old = storage.getItem(SAVE_KEY)!;
    storage.clear();
    storage.setItem(LEGACY_SAVE_KEY, old);
    const restored = Session.restore(bundle)!;
    vi.spyOn(storage, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });

    expect(() => restored.save()).not.toThrow();
    expect(storage.getItem(LEGACY_SAVE_KEY)).toBe(old);
    expect(storage.getItem(SAVE_KEY)).toBeNull();
    expect(Session.restore(bundle)?.state.player.name).toBe('Tester');
  });

  test('loads a save from before worn things and craft tries', () => {
    startedSession();
    const save = JSON.parse(storage.getItem(SAVE_KEY)!) as { state: string };
    const state = JSON.parse(save.state) as { player: Record<string, unknown> };
    delete state.player.worn;
    delete state.player.looks;
    delete state.player.tries;
    storage.setItem(SAVE_KEY, JSON.stringify({ ...save, state: JSON.stringify(state) }));

    const restored = Session.restore(bundle);
    expect(restored?.state.player.worn).toEqual({});
    expect(restored?.state.player.looks).toEqual({});
    expect(restored?.state.player.tries).toEqual({});
  });

  test('loads a save from before health and hazards', () => {
    startedSession();
    const save = JSON.parse(storage.getItem(SAVE_KEY)!) as { state: string };
    const state = JSON.parse(save.state) as { player: Record<string, unknown> };
    for (const k of ['town', 'outing', 'chase', 'falls', 'movedAt']) delete state.player[k];
    storage.setItem(SAVE_KEY, JSON.stringify({ ...save, state: JSON.stringify(state) }));

    const restored = Session.restore(bundle)!;
    const p = restored.state.player;
    expect([p.town, p.outing, p.chase, p.falls]).toEqual(['', null, null, 0]);
    expect(p.movedAt).toBe(restored.state.tick);
    expect(restored.act({ t: 'move', at: [p.at[0], p.at[1]] }).ok).toBe(true);
  });

  test('loads a save from before tended fires', () => {
    startedSession();
    const save = JSON.parse(storage.getItem(SAVE_KEY)!) as { state: string };
    const state = JSON.parse(save.state) as { player: Record<string, unknown> };
    delete state.player.fires;
    storage.setItem(SAVE_KEY, JSON.stringify({ ...save, state: JSON.stringify(state) }));

    expect(Session.restore(bundle)?.state.player.fires).toEqual({});
  });

  test('loads a save from before expeditions', () => {
    startedSession();
    const save = JSON.parse(storage.getItem(SAVE_KEY)!) as { state: string };
    const state = JSON.parse(save.state) as { player: Record<string, unknown> };
    delete state.player.expeditions;
    storage.setItem(SAVE_KEY, JSON.stringify({ ...save, state: JSON.stringify(state) }));

    expect(Session.restore(bundle)?.state.player.expeditions).toEqual({});
  });

  test('a new world version teaches its new start recipes and drops what is gone', () => {
    const session = startedSession();
    session.state.player.tries = { 'core/berry-mash': 2, 'x/gone': 1 };
    session.state.player.worn = { head: 'x/gone-cap' };
    session.save();
    const recipes = { ...bundle.recipes, 'x/new': { ...bundle.recipes['core/berry-mash']!, id: 'x/new' } };
    const next: Bundle = { ...bundle, tag: `${bundle.tag}-next`, recipes };

    const restored = Session.restore(next);
    expect(restored?.state.player.recipes).toContain('x/new');
    expect(restored?.state.player.recipes).toEqual([...restored!.state.player.recipes].sort());
    expect(restored?.state.player.tries).toEqual({ 'core/berry-mash': 2 });
    expect(restored?.state.player.worn).toEqual({});
  });

  test('a save from before the new opening is dropped once, under either key, and the demo date is kept', () => {
    for (const key of [SAVE_KEY, LEGACY_SAVE_KEY]) {
      startedSession();
      const file = JSON.parse(storage.getItem(SAVE_KEY)!) as { v: number };
      storage.clear();
      storage.setItem(key, JSON.stringify({ ...file, v: 1 }));

      expect(Session.hasSave()).toBe(false);
      expect(Session.dropOld()).toBe(true);
      expect(storage.getItem(SAVE_KEY)).toBeNull();
      expect(storage.getItem(LEGACY_SAVE_KEY)).toBeNull();
      expect(Session.demoSince()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      // the notice comes once: there is nothing left to drop
      expect(Session.dropOld()).toBe(false);
    }
  });

  test('a current save, an unreadable one and no save at all are left alone', () => {
    expect(Session.dropOld()).toBe(false);
    startedSession();
    expect(Session.dropOld()).toBe(false);
    expect(Session.restore(bundle)?.started).toBe(true);
    storage.setItem(SAVE_KEY, 'not a save');
    expect(Session.dropOld()).toBe(false);
    expect(storage.getItem(SAVE_KEY)).toBe('not a save');
  });

  test('the demo date is written once and outlives a new game and an erase', () => {
    expect(Session.demoSince()).toBeUndefined();
    storage.setItem(DEMO_SINCE_KEY, '2026-10-01');
    startedSession();
    Session.erase();
    startedSession('Again');
    expect(Session.demoSince()).toBe('2026-10-01');
  });

  test('plays the elder monologue once across a reload', async () => {
    app.session = startedSession();
    await talker().talk('core/elder');

    const monologue = bundle.npcs['core/elder']!.dialogue.first!;
    expect(vi.mocked(say)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(say).mock.calls[0]?.[2]).toEqual(monologue);

    app.session = Session.restore(bundle)!;
    await talker().talk('core/elder');

    expect(vi.mocked(say)).toHaveBeenCalledTimes(2);
    expect(vi.mocked(say).mock.calls[1]?.[2]).toHaveLength(1);
    const topics = bundle.npcs['core/elder']!.topics!;
    const labels = vi.mocked(say).mock.calls[1]?.[3]?.map((option) => option.label);
    expect(labels).toEqual(expect.arrayContaining(topics.filter((t) => !t.when).map((t) => t.ask)));
    for (const t of topics.filter((t) => t.when)) expect(labels).not.toContain(t.ask);
  });

  test('says a remark the world earned once, across a reload, and opens the topic that waited (GRUNT S-1)', async () => {
    app.session = startedSession();
    app.session.meet('core/elder');
    app.session.state.player.quests['core/a-coin-for-maru'] = 'done';
    const elder = bundle.npcs['core/elder']!;
    const remark = elder.remarks!.find((r) => r.when.done?.includes('core/a-coin-for-maru'))!;
    const waited = elder.topics!.find((t) => t.when?.done?.includes('core/a-coin-for-maru'))!;

    await talker().talk('core/elder');
    expect(vi.mocked(say).mock.calls[0]?.[2]).toEqual(remark.say);
    expect(vi.mocked(say).mock.calls[0]?.[3]?.map((option) => option.label)).toContain(waited.ask);

    app.session = Session.restore(bundle)!;
    await talker().talk('core/elder');
    expect(vi.mocked(say).mock.calls[1]?.[2]).not.toEqual(remark.say);
  });
});

describe('the clock', () => {
  test('redraws once when the game hour turns, not on every frame', () => {
    const session = startedSession();
    session.advance(16);
    let changes = 0;
    session.on('change', () => changes++);
    // tick 0 is noon, and the next hour turns one twenty-fourth of a day later
    const hour = bundle.params.day_length_ms / 24;
    session.tick = hour - 10;
    session.advance(5);
    expect(changes).toBe(0);
    session.advance(10);
    expect(changes).toBe(1);
    session.advance(16);
    expect(changes).toBe(1);
  });
});

describe('position reports (P-5b)', () => {
  /** 21:20, inside the night (tick 0 is noon). */
  const NIGHT = 500_000;

  /** The bundle with a pit on a tile beside the forager's wake, outside the safe ground, and no hunger clock. */
  function withPit(): { b: Bundle; session: Session; pit: [number, number] } {
    const b = structuredClone(bundle);
    b.params.satiety_drain_per_min = 0;
    const probe = Session.fresh(b);
    probe.act({ t: 'start', starter: 'core/forager', name: 'Tester' });
    const walkable = makeWalkable(b);
    const [x, y] = probe.state.player.at;
    const pit = ([[1, 0], [-1, 0], [0, 1], [0, -1]] as const)
      .map(([dx, dy]): [number, number] => [x + dx, y + dy])
      .find(([px, py]) => walkable(px, py, probe.state.player) && !isSafe(b, probe.state, [px, py]))!;
    expect(pit).toBeDefined();
    b.map.props = [...b.map.props, { id: 'test/pit', sprite: 'core/base-kit:props/hazard_pit', x: pit[0], y: pit[1], w: 1, h: 1, solid: false, hazard: { kind: 'pit', window: ['night'] } }];
    app.bundle = b;
    const session = Session.fresh(b);
    session.act({ t: 'start', starter: 'core/forager', name: 'Tester' });
    session.tick = NIGHT;
    return { b, session, pit };
  }

  afterEach(() => {
    app.bundle = bundle;
  });

  test('goes only when the tile changes, and a refused one changes nothing', () => {
    const session = startedSession();
    session.tick = 1000;
    const [x, y] = session.state.player.at;
    const before = session.state;
    session.report([x, y]);
    expect(session.state).toBe(before);
    session.report([x + 40, y]);
    expect(session.state).toBe(before);
    const walkable = makeWalkable(bundle);
    const next = ([[1, 0], [-1, 0], [0, 1], [0, -1]] as const).map(([dx, dy]): [number, number] => [x + dx, y + dy]).find(([a, c]) => walkable(a, c, before.player))!;
    session.report(next);
    expect(session.state.player.at).toEqual(next);
    expect(session.state.player.movedAt).toBe(1000);
  });

  test('a hazard it walks into hurts, and a fall wakes the player elsewhere and moves the walk there', () => {
    const { session, pit } = withPit();
    const seen: GameEvent[] = [];
    session.on('events', (events) => seen.push(...events));
    const wake: [number, number] = [session.pos[0], session.pos[1]];
    session.report(pit);
    expect(seen.map((e) => e.e)).toEqual(['hurt']);

    // step back off it, put the health at the edge, and step on again: the pit takes the rest
    session.tick += 2000;
    session.report(wake);
    expect(session.state.player.at).toEqual(wake);
    session.state.player.satiety = 1;
    session.state.player.satietyAt = session.tick;
    seen.length = 0;
    session.tick += 2000;
    session.report(pit);
    const fall = seen.find((e) => e.e === 'fall');
    expect(fall).toBeDefined();
    if (fall?.e === 'fall') expect(session.pos).toEqual(fall.at);
  });

  test('a step that lands while a menu is open is still heard', () => {
    const { session, pit } = withPit();
    session.pause();
    session.report(pit);
    expect(session.state.player.at).toEqual(pit);
  });

});

describe('the stage-1 service hears of play (GRUNT 18)', () => {
  const calls: [string, unknown][] = [];
  beforeEach(() => {
    calls.length = 0;
    s1Use((path, body) => void calls.push([path, body]));
  });
  afterEach(() => s1Use(() => {}));

  test('a visit to a filled place, a gather from a node and a quest step are each reported once', () => {
    const session = startedSession();
    calls.length = 0;
    const slot = bundle.map.slots.find((sl) => bundle.resources[Object.values(bundle.resources).find((r) => r.place.slot === sl.id)?.id ?? '']);
    const node = Object.entries(bundle.instances).find(([, i]) => i.kind === 'resource')!;
    const tell = (a: unknown, e: GameEvent[]) => (session as unknown as { tell(a: unknown, e: GameEvent[]): void }).tell(a, e);
    tell({ t: 'visit', slot: slot!.id }, [{ e: 'visit', slot: slot!.id }]);
    tell({ t: 'visit', slot: slot!.id }, [{ e: 'visit', slot: slot!.id }]);
    tell({ t: 'gather', node: node[0] }, []);
    tell({ t: 'accept', quest: 'core/fix-the-bridge' }, [{ e: 'quest', quest: 'core/fix-the-bridge', state: 'active' }, { e: 'quest', quest: 'core/fix-the-bridge', state: 'done' }]);
    expect(calls.map(([p]) => p)).toEqual(['visit', 'pickup', 'stop']);
    expect(calls[2]![1]).toEqual({ step: 'core/fix-the-bridge:done' });
  });
});
