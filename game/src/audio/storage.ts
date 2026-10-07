/** Defensive persistence helpers for the audio preference. */

export const SOUND_PREF_NAME = 'mistvale.sound.1';

export interface SoundStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function readMuted(storage: SoundStorage | null | undefined): boolean {
  try {
    const saved = storage?.getItem(SOUND_PREF_NAME);
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
  } catch {
    // Sound remains usable when storage is unavailable or full.
  }
}
