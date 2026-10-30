/**
 * Which instruments play the music, the player's own choice (DECISIONS.md, 2026-10-30): the sampled real
 * instruments by default, the synth as the other. Kept on the device like the mute (storage.ts), never a
 * server value; a missing or corrupt value is the default.
 */
import type { SoundStorage } from './storage';

export type MusicSource = 'real' | 'synth';

export const MUSIC_PREF_NAME = 'openfold.music.1';
export const DEFAULT_SOURCE: MusicSource = 'real';

export function readSource(storage: SoundStorage | null | undefined): MusicSource {
  try {
    const saved = storage?.getItem(MUSIC_PREF_NAME);
    if (saved === null || saved === undefined) return DEFAULT_SOURCE;
    const value: unknown = JSON.parse(saved);
    const source = typeof value === 'object' && value !== null ? (value as { source?: unknown }).source : undefined;
    return source === 'synth' || source === 'real' ? source : DEFAULT_SOURCE;
  } catch {
    return DEFAULT_SOURCE;
  }
}

export function writeSource(storage: SoundStorage | null | undefined, source: MusicSource): void {
  try {
    storage?.setItem(MUSIC_PREF_NAME, JSON.stringify({ source }));
  } catch {
    // The music still plays when storage is unavailable or full.
  }
}

/** The settings row's words for each source. */
export const SOURCE_LABEL: Readonly<Record<MusicSource, string>> = { real: 'real instruments', synth: 'synth' };
