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

function startedSession(): Session {
  const session = Session.fresh(bundle);
  const result = session.act({ t: 'start', starter: 'core/forager', name: 'Tester' });
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
