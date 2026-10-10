/** Defensive persistence helpers for the audio preference. */

export const SOUND_PREF_NAME = 'openfold.sound.1';
/** The preference's name under the working title: read while the new one is missing, removed on the next write. */
export const LEGACY_SOUND_PREF_NAME = 'mistvale.sound.1';

export interface SoundStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

export function readMuted(storage: SoundStorage | null | undefined): boolean {
  try {
    const saved = storage?.getItem(SOUND_PREF_NAME) ?? storage?.getItem(LEGACY_SOUND_PREF_NAME);
    if (saved === null || saved === undefined) return false;
    const value: unknown = JSON.parse(saved);
    return typeof value === 'object' && value !== null && 'muted' in value
      && (value as { muted?: unknown }).muted === true;
  } catch {
    return false;
  }
}

export function writeMuted(storage: SoundStorage | null | undefined, muted: boolean): void {
  try {
    storage?.setItem(SOUND_PREF_NAME, JSON.stringify({ muted }));
    storage?.removeItem?.(LEGACY_SOUND_PREF_NAME);
  } catch {
    // Sound remains usable when storage is unavailable or full.
  }
}
