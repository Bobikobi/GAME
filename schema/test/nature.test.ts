/** `scale` on a kit sprite and `climate` on a region's map body (NATURE sections 1 and 2). */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CLIMATES, validateFile } from '../src/index';

const load = (path: string) => JSON.parse(readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8'));

const kitWith = (scale?: unknown) => {
  const kit = load('content/kit/core/kit.json');
  const name = Object.keys(kit.kit.sprites)[0] as string;
  if (scale === undefined) delete kit.kit.sprites[name].scale;
  else kit.kit.sprites[name].scale = scale;
  return kit;
};
const mapWith = (climate?: unknown) => {
  const map = load('content/core/map.json');
  if (climate === undefined) delete map.map.climate;
  else map.map.climate = climate;
  return map;
};

describe('sprite scale', () => {
  it('is optional: the kit of today validates without it', () => {
    expect(validateFile(kitWith())).toEqual([]);
  });

  it('accepts a height in characters with one decimal', () => {
    expect(validateFile(kitWith(1))).toEqual([]);
    expect(validateFile(kitWith(3.5))).toEqual([]);
    expect(validateFile(kitWith(0.3))).toEqual([]);
  });

  it('refuses zero, a negative height, a giant and a string', () => {
    for (const bad of [0, -1, 41, '3.5']) expect(validateFile(kitWith(bad))).not.toEqual([]);
  });
});

describe('region climate', () => {
  it('is optional: the valley validates without it', () => {
    expect(validateFile(mapWith())).toEqual([]);
  });

  it('accepts each of the four climates', () => {
    expect([...CLIMATES]).toEqual(['temperate', 'dry', 'cold', 'wet']);
    for (const c of CLIMATES) expect(validateFile(mapWith(c))).toEqual([]);
  });

  it('refuses a climate outside the closed list', () => {
    for (const bad of ['tropical', 'Temperate', '', 1]) expect(validateFile(mapWith(bad))).not.toEqual([]);
  });
});
