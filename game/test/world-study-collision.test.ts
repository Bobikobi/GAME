import { expect, test } from 'vitest';
import { worldStudyCanStand } from '../src/world-study-collision';

const land = () => true;
const trees = [{ x: 100, y: 100, radiusX: 32, radiusY: 18 }];

test('feet stop at the trunk from every side, including body overlap at the edge', () => {
  for (const [x, y] of [[100, 100], [63, 100], [137, 100], [100, 79], [100, 121]]) {
    expect(worldStudyCanStand(x!, y!, land, trees)).toBe(false);
  }
  for (const [x, y] of [[61, 100], [139, 100], [100, 77], [100, 123]]) {
    expect(worldStudyCanStand(x!, y!, land, trees)).toBe(true);
  }
});

test('the canopy behind a trunk and the space around its roots stay walkable', () => {
  expect(worldStudyCanStand(100, 20, land, trees)).toBe(true);
  expect(worldStudyCanStand(60, 76, land, trees)).toBe(true);
  expect(worldStudyCanStand(100, 100, land, [])).toBe(true);
});

test('the whole feet rectangle must stay on land, even away from trees', () => {
  expect(worldStudyCanStand(10, 10, x => x >= 0, [])).toBe(true);
  expect(worldStudyCanStand(5, 10, x => x >= 0, [])).toBe(false);
  expect(worldStudyCanStand(10, 3, (_x, y) => y >= 0, [])).toBe(false);
  expect(worldStudyCanStand(NaN, 10, land, trees)).toBe(false);
});
