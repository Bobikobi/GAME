import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';

import type { Bundle } from '@game/kernel';
import { app } from '../src/app';
import { LEGACY_SAVE_KEY, SAVE_KEY } from '../src/config';
import { Session } from '../src/session';
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
    expect(storage.length).toBe(0);
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
    expect(vi.mocked(say).mock.calls[1]?.[3]?.map((option) => option.label)).toEqual(
      expect.arrayContaining(bundle.npcs['core/elder']!.topics!.map((topic) => topic.ask)),
    );
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
