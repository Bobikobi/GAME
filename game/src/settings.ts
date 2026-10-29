/**
 * The player's settings and how Auto resolves them: a quality preset (Low, Medium, High), a frame-rate cap
 * (30, 60, 120, max) and reduced motion, each of them either chosen or Auto. Auto picks from the device
 * (device.ts): the tier gives the preset, and the measured refresh and frame time give the cap. The choice
 * lives in localStorage under one key, read defensively like the sound preference (audio/storage.ts), so a
 * missing or corrupt value is Auto. Nothing here changes a rule of the game: the kernel never sees it.
 */
import type { Rich } from './config';
import type { Device } from './device';

export const SETTINGS_KEY = 'openfold.settings.1';

export type Quality = 'auto' | 'low' | 'medium' | 'high';
export type FrameCap = 'auto' | 30 | 60 | 120 | 'max';

export interface Settings {
  quality: Quality;
  frameCap: FrameCap;
  reducedMotion: boolean;
}

export const AUTO_SETTINGS: Readonly<Settings> = { quality: 'auto', frameCap: 'auto', reducedMotion: false };

export interface Effective {
  quality: 'low' | 'medium' | 'high';
  /** frames a second at most, 0 for no cap (the screen's own rate) */
  frameCap: 0 | 30 | 60 | 120;
}

/** Auto gives a cap of 120 only above this refresh in Hz... */
export const HIGH_REFRESH_HZ = 100;
/** ...and only when the p95 frame time in ms is under this, which leaves room in an 8.3 ms frame. */
export const HIGH_P95_MS = 6;
/** Auto on a low tier drops to 30 only when the p95 frame time in ms at 60 passes this (a 16.7 ms budget). */
export const LOW_P95_MS = 16;
/** Frames the world is watched before Auto may change the cap. */
export const SETTLE_FRAMES = 120;

export interface SettingsStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const QUALITIES: readonly Quality[] = ['auto', 'low', 'medium', 'high'];
const CAPS: readonly FrameCap[] = ['auto', 30, 60, 120, 'max'];

/** The stored settings; every field that is missing or wrong falls back to Auto. */
export function readSettings(storage: SettingsStorage | null | undefined): Settings {
  try {
    const saved = storage?.getItem(SETTINGS_KEY);
    if (saved === null || saved === undefined) return { ...AUTO_SETTINGS };
    const v: unknown = JSON.parse(saved);
    if (typeof v !== 'object' || v === null) return { ...AUTO_SETTINGS };
    const o = v as Record<string, unknown>;
    return {
      quality: QUALITIES.find((q) => q === o.quality) ?? 'auto',
      frameCap: CAPS.find((c) => c === o.frameCap) ?? 'auto',
      reducedMotion: o.reducedMotion === true,
    };
  } catch {
    return { ...AUTO_SETTINGS };
  }
}

export function writeSettings(storage: SettingsStorage | null | undefined, s: Settings): void {
  try {
    storage?.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    // The game stays playable when storage is unavailable or full.
  }
}

/** The preset Auto gives a tier. */
function qualityOfTier(tier: Device['tier']): Effective['quality'] {
  return tier === 'high' ? 'high' : tier === 'mid' ? 'medium' : 'low';
}

/** The cap Auto gives a device, from what is measured so far (zeros mean not measured: stay at 60). */
function autoCap(d: Device): Effective['frameCap'] {
  if (d.tier === 'high' && d.refreshHz > HIGH_REFRESH_HZ && d.p95 > 0 && d.p95 < HIGH_P95_MS) return 120;
  if (d.tier === 'low' && d.p95 > LOW_P95_MS) return 30;
  return 60;
}

/** The preset and cap in force: a chosen value stands (a cap is bounded by the screen), Auto resolves from the device. */
export function resolve(s: Settings, d: Device): Effective {
  const quality = s.quality === 'auto' ? qualityOfTier(d.tier) : s.quality;
  let frameCap: Effective['frameCap'];
  if (s.frameCap === 'auto') frameCap = autoCap(d);
  else if (s.frameCap === 'max') frameCap = 0;
  else frameCap = s.frameCap;
  // a cap above the screen's refresh changes nothing, so it is the screen's own rate
  if (frameCap !== 0 && d.refreshHz > 0 && frameCap > d.refreshHz) frameCap = 0;
  return { quality, frameCap };
}

/** The ?rich= groups a preset draws; reduced motion takes the motion group off whatever the preset says. */
export function richOf(quality: Effective['quality'], reducedMotion: boolean): Rich {
  const high = quality === 'high';
  const low = quality === 'low';
  return { detail: !low, motion: high && !reducedMotion, light: !low };
}
