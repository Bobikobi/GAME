import { expect, test } from 'vitest';
import { WORLD_TILE_SIZE, worldStudyLandTile, worldStudyLayout, worldStudyMask, worldStudyMaterial, worldStudyPathDistance } from '../src/world-study-layout';

test('the coast uses supported shore pieces and every full land tile connects to the spawn', () => {
  const { width, height, corners, spawn, viewpoints } = worldStudyLayout;
  expect(corners).toHaveLength(height + 1);
  for (const row of corners) expect(row).toMatch(new RegExp(`^[01]{${width + 1}}$`));
  const allowed = new Set([0, 1, 2, 3, 4, 6, 7, 8, 9, 11, 12, 13, 14, 15]);
  const land: string[] = [];
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    expect(allowed.has(worldStudyMask(x, y)), `unsupported bank at ${x},${y}`).toBe(true);
    if (worldStudyLandTile(x, y)) land.push(`${x},${y}`);
  }
  expect(worldStudyLandTile(spawn.x, spawn.y)).toBe(true);
  const reached = new Set([`${spawn.x},${spawn.y}`]);
  const queue = [spawn];
  for (let i = 0; i < queue.length; i++) {
    const p = queue[i]!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = p.x + dx!, y = p.y + dy!, key = `${x},${y}`;
      if (!worldStudyLandTile(x, y) || reached.has(key)) continue;
      reached.add(key); queue.push({ x, y });
    }
  }
  expect(reached.size).toBe(land.length);
  for (const view of viewpoints) expect(reached.has(`${view.x},${view.y}`), view.id).toBe(true);
  expect(worldStudyLandTile(-1, 4)).toBe(false);
  expect(worldStudyLandTile(width, 4)).toBe(false);
});

test('the authored route stays on land and turns before a straight run exceeds eight tiles', () => {
  const points = worldStudyLayout.path.points;
  let direction = '', run = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!, b = points[i]!;
    const dx = b.x - a.x, dy = b.y - a.y;
    expect((dx === 0) !== (dy === 0), 'route segments follow one tile axis').toBe(true);
    const nextDirection = `${Math.sign(dx)},${Math.sign(dy)}`;
    run = (direction === nextDirection ? run : 0) + Math.abs(dx) + Math.abs(dy);
    direction = nextDirection;
    expect(run, 'G69 straight path limit').toBeLessThanOrEqual(8);
    const steps = (Math.abs(dx) + Math.abs(dy)) * 8;
    for (let step = 0; step <= steps; step++) {
      const x = a.x + .5 + dx * step / steps, y = a.y + .5 + dy * step / steps;
      expect(worldStudyLandTile(Math.floor(x), Math.floor(y)), 'path must not cross water').toBe(true);
      expect(worldStudyPathDistance(x * WORLD_TILE_SIZE, y * WORLD_TILE_SIZE)).toBeLessThan(.001);
    }
  }
});

test('the preview has meadow, forest and path centres, and the cove looks onto open water', () => {
  const point = (id: string) => worldStudyLayout.viewpoints.find(p => p.id === id)!;
  for (const kind of ['meadow', 'forest'] as const) {
    const view = point(kind);
    expect(worldStudyMaterial((view.x + .5) * WORLD_TILE_SIZE, (view.y + .5) * WORLD_TILE_SIZE)).toBe(kind);
  }
  const end = worldStudyLayout.path.points.at(-1)!;
  expect(worldStudyMaterial((end.x + .5) * WORLD_TILE_SIZE, (end.y + .5) * WORLD_TILE_SIZE)).toBe('path');
  const cove = point('cove');
  expect(worldStudyMask(cove.x + 2, cove.y)).toBe(0);
  expect(worldStudyPathDistance(Infinity, 0)).toBe(Infinity);
});
