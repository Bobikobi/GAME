/** What the exporter bakes and the mount reads (game/src/baked.ts): the bytes the exporter's zlib makes come back as they were; the fog noise tile is the one the device would make. */
import { deflateSync } from 'node:zlib';
import { describe, expect, test } from 'vitest';

import { inflateBlob } from '../src/baked';
import { FOG_NOISE, fogNoise, fogNoiseSteps } from '../src/look';

describe('inflateBlob', () => {
  test('inflates a zlib blob to the bytes that were compressed', async () => {
    const raw = new Uint8Array(5000).map((_, i) => (i * 7) % 251);
    const back = await inflateBlob(new Blob([deflateSync(raw, { level: 9 })]));
    expect(back.length).toBe(raw.length);
    expect(Buffer.from(back).equals(Buffer.from(raw))).toBe(true);
  });
});

describe('the fog noise tile', () => {
  test('is the same bytes whole and in slices, opaque, and moves when the seed does', () => {
    const whole = fogNoise(FOG_NOISE.size, FOG_NOISE.seed);
    const sliced = new Uint8ClampedArray(FOG_NOISE.size * FOG_NOISE.size * 4);
    for (const _ of fogNoiseSteps(FOG_NOISE.size, FOG_NOISE.seed, sliced)) void _;
    expect(Buffer.from(sliced).equals(Buffer.from(whole))).toBe(true);
    expect(whole.every((v, i) => i % 4 !== 3 || v === 255)).toBe(true);
    expect(Buffer.from(fogNoise(FOG_NOISE.size, FOG_NOISE.seed + 1)).equals(Buffer.from(whole))).toBe(false);
  });
});
