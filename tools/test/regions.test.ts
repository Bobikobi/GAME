/**
 * The region cards (issue 581): every region of FIRST_MAP's table has a card on the map, with one weather
 * look and one sound bed, and every card a region names exists.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Bundle } from '@game/kernel';
import { runCheck } from '../src/check';
import { REPO_ROOT } from '../src/load';
import { FIRST_MAP_FILE, checkRegions, firstMapRegions } from '../src/regions';

let base: Bundle;

beforeAll(() => {
  const found = runCheck().assembled.bundle;
  if (!found) throw new Error('Content did not assemble into a bundle.');
  base = found;
});

const text = (b: Bundle, regions?: string[]): string => checkRegions(b, {}, regions).map((i) => i.message).join('\n');

describe('region cards', () => {
  it('reads the six regions of the first map from its table', () => {
    const regions = firstMapRegions(readFileSync(join(REPO_ROOT, FIRST_MAP_FILE), 'utf8'));
    expect(regions).toHaveLength(6);
    expect(regions[0]).toBe('Valley floor');
  });

  it('the shipped map has a card for every region and passes', () => {
    expect(checkRegions(base, {})).toEqual([]);
    expect(base.map.card).toBe('valley-floor');
  });

  it('names a region of the table with no card', () => {
    const b = structuredClone(base);
    b.map.cards = b.map.cards!.filter((c) => c.id !== 'elf-wood');
    expect(text(b)).toContain('the region "North: elf wood" of docs/design/FIRST_MAP.md has no card');
  });

  it('names a card that no region of the table carries', () => {
    expect(text(base, ['Valley floor'])).toContain('names no region of docs/design/FIRST_MAP.md');
  });

  it('refuses a card name that the map does not declare', () => {
    const b = structuredClone(base);
    b.map.card = 'nowhere';
    b.map.regions = [{ id: 'coast', x: 0, y: 0, w: 2, h: 2, card: 'nowhere-else' }];
    expect(text(b)).toContain('names the card "nowhere"');
    expect(text(b)).toContain('the region "coast" names the card "nowhere-else"');
  });

  it('refuses rain and fog that leave no clear days', () => {
    const b = structuredClone(base);
    b.map.cards![0]!.weather = { rain: 5000, fog: 5000 };
    expect(text(b)).toBe('');
    b.map.cards![0]!.weather = { rain: 5000, fog: 5001 };
    expect(text(b)).toContain('pass the 10000 basis points');
  });
});
