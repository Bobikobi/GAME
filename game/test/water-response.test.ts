import { expect, test } from 'vitest';
import { buildWaterField, waterResponse, type WaterSample } from '../src/water-response';

test('coast normals follow geometry and incoming wind exposes the facing bank', () => {
  const wall = (x: number) => x < 32;
  const a = buildWaterField(64, 8, wall, [-1, 0]).find(p => p.x === 36 && p.y === 28)!;
  const b = buildWaterField(64, 8, wall, [1, 0]).find(p => p.x === 36 && p.y === 28)!;
  expect(a.nx).toBeGreaterThan(.8);
  expect(a.exposure).toBeGreaterThan(b.exposure * 3);
  const mirrored = buildWaterField(64, 8, x => x >= 32, [1, 0]).find(p => p.x === 28 && p.y === 28)!;
  expect(mirrored.nx).toBeLessThan(-.8);
});
test('calm is quieter than storm; inland and far offshore never get shore foam', () => {
  const sample: WaterSample = { x: 20, y: 10, land: false, distance: 3, nx: 1, ny: 0, exposure: 1 };
  expect(waterResponse(sample, 'storm', .5, 0).foam).toBeGreaterThan(waterResponse(sample, 'calm', .5, 0).foam * 10);
  expect(waterResponse({ ...sample, land: true }, 'storm', .5, 0).foam).toBe(0);
  expect(waterResponse({ ...sample, distance: 100 }, 'storm', .5, 0).foam).toBe(0);
});
test('gentle slope spreads response farther than a steep bank', () => {
  const sample: WaterSample = { x: 20, y: 10, land: false, distance: 15, nx: 1, ny: 0, exposure: 1 };
  expect(waterResponse(sample, 'windy', 0, 0).foam).toBeGreaterThan(0);
  expect(waterResponse(sample, 'windy', 1, 0).foam).toBe(0);
});
test('open water with no land remains finite and has no shoreline reaction', () => {
  for (const s of buildWaterField(32, 8, () => false, [-1, 0])) {
    const r = waterResponse(s, 'storm', .5, 10);
    expect(Number.isFinite(r.bend)).toBe(true);
    expect(r.foam).toBe(0);
  }
});
