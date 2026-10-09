/** Persistence tests cover both normal storage and privacy-mode failures. */
import { describe, expect, test, vi } from 'vitest';

import { LEGACY_SOUND_PREF_NAME, readMuted, SOUND_PREF_NAME, writeMuted } from '../../src/audio/storage';
import type { SoundStorage } from '../../src/audio/storage';

class FakeStorage implements SoundStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

describe('sound preference', () => {
  test('round-trips the muted setting under the versioned key', () => {
    const storage = new FakeStorage();
    writeMuted(storage, true);
    expect(storage.getItem(SOUND_PREF_NAME)).toBe('{"muted":true}');
    expect(readMuted(storage)).toBe(true);
    writeMuted(storage, false);
    expect(readMuted(storage)).toBe(false);
  });

  test('keeps a setting saved under the working title and moves it on the next write', () => {
    const storage = new FakeStorage();
    storage.setItem(LEGACY_SOUND_PREF_NAME, '{"muted":true}');
    expect(readMuted(storage)).toBe(true);
    writeMuted(storage, true);
    expect(storage.getItem(SOUND_PREF_NAME)).toBe('{"muted":true}');
    expect(storage.getItem(LEGACY_SOUND_PREF_NAME)).toBeNull();
  });

  test('a setting under the new name wins over one left under the working title, which is never read', () => {
    const storage = new FakeStorage();
    storage.setItem(SOUND_PREF_NAME, '{"muted":false}');
    storage.setItem(LEGACY_SOUND_PREF_NAME, '{"muted":true}');
    const getItem = vi.spyOn(storage, 'getItem');

    expect(readMuted(storage)).toBe(false);
    expect(getItem).not.toHaveBeenCalledWith(LEGACY_SOUND_PREF_NAME);
  });

  test('keeps the setting saved under the working title when the new name cannot be written', () => {
    const storage = new FakeStorage();
    storage.setItem(LEGACY_SOUND_PREF_NAME, '{"muted":true}');
    vi.spyOn(storage, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });

    expect(() => writeMuted(storage, false)).not.toThrow();
    expect(storage.getItem(LEGACY_SOUND_PREF_NAME)).toBe('{"muted":true}');
    expect(storage.getItem(SOUND_PREF_NAME)).toBeNull();
    expect(readMuted(storage)).toBe(true);
  });

  test('defaults to audible if storage throws', () => {
    const storage: SoundStorage = {
      getItem: () => { throw new Error('private mode'); },
      setItem: () => { throw new Error('private mode'); },
    };
    expect(() => writeMuted(storage, true)).not.toThrow();
    expect(readMuted(storage)).toBe(false);
  });
});
