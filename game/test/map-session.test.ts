import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';

import type { Bundle } from '@game/kernel';
import { STALL_SLOT } from '../src/places';
import { Session } from '../src/session';
import { loadBundle } from '../../tools/test/helpers/world';

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

beforeAll(() => {
  bundle = loadBundle();
});

beforeEach(() => {
  vi.stubGlobal('localStorage', new MemoryStorage());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function started(): Session {
  const s = Session.fresh(bundle);
  const r = s.act({ t: 'start', starter: 'core/explorer', name: 'Tess' });
  if (!r.ok) throw new Error(r.error);
  return s;
}

describe('the stall marker and the walked ground survive a save', () => {
  test('a stall stands only at the empty corner, and the map remembers it', () => {
    const s = started();
    s.pos = [32, 12];
    s.state.player.at = [32, 12];
    s.seen.clear();
    s.seenChunks.clear();
    s.seeAt();

    expect(s.seen.has(STALL_SLOT)).toBe(true);
    expect(s.seenChunks.size).toBe(1);
    expect(s.placeStall()).toBe(true);
    expect(s.stall).toBe(STALL_SLOT);

    s.save();
    const again = Session.restore(bundle);
    expect(again).toBeDefined();
    expect(again!.stall).toBe(STALL_SLOT);
    expect(again!.seen.has(STALL_SLOT)).toBe(true);
    expect(again!.seenChunks.size).toBeGreaterThan(0);
  });

  test('a stall cannot be placed from the road, and it can be lifted at the corner', () => {
    const s = started();
    s.pos = [6, 17];
    s.state.player.at = [6, 17];
    expect(s.placeStall()).toBe(false);

    s.pos = [32, 12];
    s.state.player.at = [32, 12];
    expect(s.placeStall()).toBe(true);
    expect(s.liftStall()).toBe(true);
    expect(s.stall).toBeUndefined();
  });
});
