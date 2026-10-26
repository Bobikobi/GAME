import { expect, test } from 'vitest';
import { waterLayers } from '../src/layered-water';
import type { WaterSample } from '../src/water-response';

const sample = (distance: number, exposure = 1): WaterSample => ({ x: distance, y: 0, distance, nx: 1, ny: 0, land: false, exposure });

test('shallow bed follows shore distance and gentle banks reveal a wider bed', () => {
  expect(waterLayers(sample(3), 'calm', .4, 0).shallow).toBeGreaterThan(waterLayers(sample(40), 'calm', .4, 0).shallow);
  expect(waterLayers(sample(20), 'calm', 0, 0).shallow).toBeGreaterThan(waterLayers(sample(20), 'calm', 1, 0).shallow);
});
test('breaking is a broad band travelling toward the bank, not a stationary outline', () => {
  const band = (time: number) => Array.from({ length: 65 }, (_, d) => waterLayers(sample(d), 'storm', 0, time).foam);
  const a = band(.8), b = band(1.6);
  const peak = (v: number[]) => v.indexOf(Math.max(...v));
  expect(peak(b)).toBeLessThan(peak(a));
  expect(b.filter(v => v > .1).length).toBeGreaterThan(8);
});
test('foam leaves a receding wash after impact then clears before the next wave', () => {
  const at = (time: number) => waterLayers(sample(2), 'storm', 0, time);
  expect(at(2.8).retreat).toBeGreaterThan(.1);
  expect(at(3.79).retreat).toBeLessThan(.01);
});
test('calm has no breakers; shelter weakens surf; land and open water never get foam', () => {
  expect(waterLayers(sample(20), 'calm', .4, 1.6).foam).toBe(0);
  expect(waterLayers(sample(20, .04), 'storm', .4, 1.6).foam).toBeLessThan(waterLayers(sample(20), 'storm', .4, 1.6).foam * .25);
  for (const s of [{ ...sample(2), land: true }, sample(Infinity)]) {
    // An unbounded water field has no nearest coast or meaningful normal.
    if (!Number.isFinite(s.distance)) { s.x = 2; s.nx = 0; }
    const result = waterLayers(s, 'storm', .4, 2);
    expect(result.foam + result.retreat + result.body).toBe(0);
    expect(Object.values(result).every(Number.isFinite)).toBe(true);
  }
});
