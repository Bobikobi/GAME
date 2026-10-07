/** Persistence tests cover both normal storage and privacy-mode failures. */
import { describe, expect, test } from 'vitest';

import { readMuted, SOUND_PREF_NAME, writeMuted } from '../../src/audio/storage';
import type { SoundStorage } from '../../src/audio/storage';

class FakeStorage implements SoundStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
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

  test('defaults to audible if storage throws', () => {
    const storage: SoundStorage = {
      getItem: () => { throw new Error('private mode'); },
      setItem: () => { throw new Error('private mode'); },
    };
    expect(() => writeMuted(storage, true)).not.toThrow();
    expect(readMuted(storage)).toBe(false);
  });
});
