import { describe, expect, it } from 'vitest';
import type { Device } from '../src/device';
import { AUTO_SETTINGS, SETTINGS_KEY, readSettings, resolve, richOf, writeSettings, type Settings } from '../src/settings';

const dev = (tier: Device['tier'], refreshHz = 60, p95 = 0, headless = false): Device => ({ tier, headless, refreshHz, p50: p95 / 2, p95 });
const mem = (): { store: Record<string, string>; getItem(k: string): string | null; setItem(k: string, v: string): void } => {
  const store: Record<string, string> = {};
  return { store, getItem: (k) => store[k] ?? null, setItem: (k, v) => void (store[k] = v) };
};

describe('resolve, Auto', () => {
  it('high tier on a fast 120 Hz screen gives high and 120', () => {
    expect(resolve(AUTO_SETTINGS, dev('high', 120, 4))).toEqual({ quality: 'high', frameCap: 120 });
  });
  it('high tier stays at 60 when the screen is 60, or the frames are slow, or not measured yet', () => {
    expect(resolve(AUTO_SETTINGS, dev('high', 60, 4)).frameCap).toBe(60);
    expect(resolve(AUTO_SETTINGS, dev('high', 120, 7)).frameCap).toBe(60);
    expect(resolve(AUTO_SETTINGS, dev('high', 0, 0)).frameCap).toBe(60);
  });
  it('mid tier gives medium and 60', () => {
    expect(resolve(AUTO_SETTINGS, dev('mid', 120, 3))).toEqual({ quality: 'medium', frameCap: 60 });
  });
  it('low tier gives low and 30 only when p95 passes 16 ms', () => {
    expect(resolve(AUTO_SETTINGS, dev('low', 60, 20))).toEqual({ quality: 'low', frameCap: 30 });
    expect(resolve(AUTO_SETTINGS, dev('low', 60, 12))).toEqual({ quality: 'low', frameCap: 60 });
    expect(resolve(AUTO_SETTINGS, dev('low', 60, 0)).frameCap).toBe(60);
  });
});

describe('resolve, headless', () => {
  it('Auto on a headless device keeps high and no cap, even when slow', () => {
    expect(resolve(AUTO_SETTINGS, dev('low', 60, 40, true))).toEqual({ quality: 'high', frameCap: 0 });
  });
  it('a chosen value still stands there', () => {
    expect(resolve({ ...AUTO_SETTINGS, quality: 'low', frameCap: 30 }, dev('low', 60, 40, true))).toEqual({ quality: 'low', frameCap: 30 });
  });
});

describe('resolve, overrides', () => {
  const s = (o: Partial<Settings>): Settings => ({ ...AUTO_SETTINGS, ...o });
  it('a chosen quality stands whatever the tier', () => {
    expect(resolve(s({ quality: 'high' }), dev('low')).quality).toBe('high');
    expect(resolve(s({ quality: 'low' }), dev('high')).quality).toBe('low');
    expect(resolve(s({ quality: 'medium' }), dev('high')).quality).toBe('medium');
  });
  it('a chosen cap stands, bounded by the screen', () => {
    expect(resolve(s({ frameCap: 30 }), dev('high', 120, 1)).frameCap).toBe(30);
    expect(resolve(s({ frameCap: 60 }), dev('low', 120)).frameCap).toBe(60);
    expect(resolve(s({ frameCap: 120 }), dev('mid', 120)).frameCap).toBe(120);
    expect(resolve(s({ frameCap: 120 }), dev('mid', 60)).frameCap).toBe(0);
    expect(resolve(s({ frameCap: 120 }), dev('mid', 0)).frameCap).toBe(120);
    expect(resolve(s({ frameCap: 'max' }), dev('mid', 90)).frameCap).toBe(0);
  });
});

describe('richOf', () => {
  it('maps the presets to the groups', () => {
    expect(richOf('low', false)).toEqual({ detail: false, motion: false, light: false });
    expect(richOf('medium', false)).toEqual({ detail: true, motion: false, light: true });
    expect(richOf('high', false)).toEqual({ detail: true, motion: true, light: true });
    expect(richOf('high', true).motion).toBe(false);
  });
});

describe('storage', () => {
  it('round-trips', () => {
    const m = mem();
    const s: Settings = { quality: 'high', frameCap: 120, reducedMotion: true };
    writeSettings(m, s);
    expect(readSettings(m)).toEqual(s);
  });
  it('falls back to Auto on nothing, junk or wrong fields', () => {
    const m = mem();
    expect(readSettings(m)).toEqual(AUTO_SETTINGS);
    expect(readSettings(null)).toEqual(AUTO_SETTINGS);
    m.store[SETTINGS_KEY] = '{not json';
    expect(readSettings(m)).toEqual(AUTO_SETTINGS);
    m.store[SETTINGS_KEY] = '"text"';
    expect(readSettings(m)).toEqual(AUTO_SETTINGS);
    m.store[SETTINGS_KEY] = JSON.stringify({ quality: 'ultra', frameCap: 45, reducedMotion: 'yes' });
    expect(readSettings(m)).toEqual(AUTO_SETTINGS);
    m.store[SETTINGS_KEY] = JSON.stringify({ quality: 'low' });
    expect(readSettings(m)).toEqual({ ...AUTO_SETTINGS, quality: 'low' });
  });
  it('survives a storage that throws', () => {
    const bad = { getItem: () => { throw new Error('x'); }, setItem: () => { throw new Error('x'); } };
    expect(readSettings(bad)).toEqual(AUTO_SETTINGS);
    expect(() => writeSettings(bad, AUTO_SETTINGS)).not.toThrow();
  });
});
