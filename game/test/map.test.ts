import { beforeAll, describe, expect, test } from 'vitest';

import type { Bundle } from '@game/kernel';
import { STALL_SLOT, canPlaceStall, chunkKey, directionOf, mapPlaces, mapRegions } from '../src/places';
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

describe('the chart on the first map (M3)', () => {
  /** The core map moved into a 192 by 192 frame with two regions, as the first map will have. */
  function wide(): Bundle {
    const b = structuredClone(bundle);
    b.map.width = 192;
    b.map.height = 192;
    const row = (b.map.ground[0]![0] ?? ' ').repeat(192);
    b.map.ground = Array.from({ length: 192 }, () => row);
    b.map.regions = [
      { id: 'old_north-wood', x: 70, y: 20, w: 40, h: 30 },
      { id: 'salt-shore', title: 'The salt shore', x: 10, y: 150, w: 50, h: 20 },
    ];
    return b;
  }

  test('every region is on the chart, and only one entered is named', () => {
    const b = wide();
    const regions = mapRegions(b, [`${b.map.id}/old_north-wood`], [80, 30]);
    expect(regions).toHaveLength(2);
    expect(regions[0]).toMatchObject({ title: 'Old north wood', current: true });
    expect(regions[1]).toMatchObject({ title: undefined, current: false, x: 10, y: 150, w: 50, h: 20 });
    const svg = mapSvg(b, { seen: new Set(), chunks: new Set(), at: [80, 30], regions });
    expect(svg).toContain('Old north wood');
    expect(svg).not.toContain('The salt shore');
    expect(svg).toContain('stroke-dasharray="6 5"');
  });

  test('an entered region shows its ground whole; one not entered shows none', () => {
    const b = wide();
    const none = mapSvg(b, { seen: new Set(), chunks: new Set(), at: [80, 30], regions: mapRegions(b, [], [80, 30]) });
    expect(none).not.toContain('opacity=".42"');
    const svg = mapSvg(b, { seen: new Set(), chunks: new Set(), at: [80, 30], regions: mapRegions(b, [`${b.map.id}/salt-shore`], [80, 30]) });
    expect(svg).toContain('The salt shore');
    const d = /<path d="([^"]+)"[^>]*opacity="\.42"/.exec(svg)?.[1] ?? '';
    // 20 rows of the region, one run each, and not one row outside it
    expect(d.match(/M/g)).toHaveLength(20);
    expect(d.startsWith(`M${Math.round((10 * 640 / 192) * 100) / 100} 500H`)).toBe(true);
  });

  test('an id that is no region, and a region the map lost, name nothing', () => {
    const b = wide();
    expect(mapRegions(b, ['core/town-square', `${b.map.id}/gone`], [0, 0]).filter((r) => r.title)).toEqual([]);
    expect(mapRegions(b, undefined, [0, 0]).filter((r) => r.title)).toEqual([]);
    expect(mapRegions(bundle, [], [0, 0])).toEqual([]);
  });

  test('the chart is 640 units across at 64 tiles and at 192, so a name reads the same', () => {
    const small = mapSvg(bundle, { seen: new Set(), chunks: new Set(), at: [28, 9] });
    expect(small).toContain('viewBox="0 0 640 640"');
    const big = mapSvg(wide(), { seen: new Set(), chunks: new Set(), at: [80, 30] });
    expect(big).toContain('viewBox="0 0 640 640"');
  });

  test('a named area entered shows its ground with no chunk walked, as on a server session', () => {
    const svg = mapSvg(bundle, { seen: new Set(['core/town-square']), chunks: new Set(), at: [0, 0] });
    expect(svg).toContain('Town square');
    expect(svg).toContain('opacity=".42"');
  });
});
