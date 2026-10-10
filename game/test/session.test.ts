import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';

import type { Bundle } from '@game/kernel';
import { app } from '../src/app';
import { SAVE_KEY } from '../src/config';
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
