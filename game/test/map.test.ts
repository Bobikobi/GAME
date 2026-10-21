import { beforeAll, describe, expect, test } from 'vitest';

import type { Bundle } from '@game/kernel';
import { STALL_SLOT, canPlaceStall, chunkKey, directionOf, mapPlaces } from '../src/places';
import { mapSvg } from '../src/ui/map';
import { loadBundle } from '../../tools/test/helpers/world';

let bundle: Bundle;

beforeAll(() => {
  bundle = loadBundle();
});

describe('the map reveals only what was walked', () => {
  test('a place enters the map when its slot has been entered, and not before', () => {
    const before = mapPlaces(bundle, new Set(), [28, 9]);
    expect(before.some((p) => p.id === 'core/town-square')).toBe(false);

    const after = mapPlaces(bundle, new Set(['core/town-square']), [28, 9]);
    expect(after.find((p) => p.id === 'core/town-square')).toMatchObject({ label: 'Town square', current: true });
  });

  test('a named ground slot is a place; an unnamed one and a person are not', () => {
    const places = mapPlaces(bundle, new Set(['core/west-glade', 'core/sun-bank', 'core/trader-stall']), [6, 17]);
    expect(places.some((p) => p.label === 'Quiet glade')).toBe(true);
    expect(places.some((p) => p.id === 'core/sun-bank')).toBe(false);
    expect(places.some((p) => p.id === 'core/trader-stall')).toBe(false);
  });

  test('the chart hides every place not walked, and names the ones it shows', () => {
    const seen = new Set(['core/town-square']);
    const svg = mapSvg(bundle, { seen, chunks: new Set(['3,0', '4,0']), at: [28, 9] });
    expect(svg).toContain('Town square');
    expect(svg).not.toContain('Old bridge');
    expect(svg).not.toContain('Quiet glade');
    expect(svg).toContain('#a8302f');
  });

  test('the stall is named on the chart and marked in the list', () => {
    const seen = new Set([STALL_SLOT]);
    const places = mapPlaces(bundle, seen, [32, 12], STALL_SLOT);
    expect(places.find((p) => p.id === STALL_SLOT)).toMatchObject({ stall: true, current: true, label: 'Empty corner' });
    const svg = mapSvg(bundle, { seen, chunks: new Set(['3,1']), at: [32, 12], stall: STALL_SLOT });
    expect(svg).toContain('Your stall');
  });

  test('the empty corner is the stall spot, and only from its two-by-two tiles', () => {
    expect(canPlaceStall(bundle, [32, 12])).toBe(true);
    expect(canPlaceStall(bundle, [31, 11])).toBe(true);
    expect(canPlaceStall(bundle, [28, 9])).toBe(false);
    expect(canPlaceStall(bundle, [6, 17])).toBe(false);
    expect(STALL_SLOT).toBe('core/town-corner');
  });

  test('ground is remembered in eight-tile chunks, never per tile', () => {
    expect(chunkKey(0, 0)).toBe('0,0');
    expect(chunkKey(7, 7)).toBe('0,0');
    expect(chunkKey(8, 8)).toBe('1,1');
  });

  test('a place is named by the direction a walk would take', () => {
    expect(directionOf([28, 9], [28, 9])).toBe('Beside you');
    expect(directionOf([28, 9], [28, 30])).toBe('south');
    expect(directionOf([28, 9], [3, 9])).toBe('west');
    expect(directionOf([28, 9], [40, 30])).toBe('south-east');
  });
});
