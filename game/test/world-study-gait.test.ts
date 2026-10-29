import { expect, test } from 'vitest';
import { WorldStudyGait, type WalkView } from '../src/world-study-gait';
import { maskOfAlpha } from '../src/cast';
import { worldStudyFootContacts } from '../src/world-study-contact';

const sheets = Object.fromEntries((['down', 'up', 'left', 'down-left', 'up-left'] as WalkView[]).map((view, i) => [view, { frames: 31, cycleDistanceMpx: (100 + i * 20) * 1000 }])) as Record<WalkView, { frames: number; cycleDistanceMpx: number }>;

test('a turn preserves cycle phase instead of reinterpreting the entire travelled distance', () => {
  const gait = new WorldStudyGait(sheets);
  const before = gait.advance(0, 25);
  const after = gait.advance(-1, 0);
  expect(before.phase).toBeCloseTo(.25);
  expect(after.phase).toBeCloseTo(.25 + 1 / 140);
  expect(after.sheet).toBe('left');
  expect(after.frame).toBe(8);
});

test('diagonals have their own projected stride, including mirrored right views', () => {
  const gait = new WorldStudyGait(sheets);
  expect(gait.advance(-10, 10)).toMatchObject({ sheet: 'down-left', flipX: false });
  expect(gait.advance(10, 10)).toMatchObject({ sheet: 'down-left', flipX: true });
  expect(gait.advance(-10, -10)).toMatchObject({ sheet: 'up-left', flipX: false });
  expect(gait.advance(10, -10)).toMatchObject({ sheet: 'up-left', flipX: true });
});

test('a stopped or blocked body consumes no stride, regardless of held-input duration', () => {
  const gait = new WorldStudyGait(sheets);
  const moving = gait.advance(0, 37);
  for (let i = 0; i < 1000; i++) expect(gait.advance(0, 0)).toEqual({ ...moving, frame: 30 });
  const resumed = gait.advance(0, 1);
  expect(resumed.phase).toBeCloseTo(.38);
  expect(gait.reset()).toMatchObject({ sheet: 'down', phase: 0, frame: 30 });
});

test('partitioning a measured displacement into frames leaves phase unchanged', () => {
  const direct = new WorldStudyGait(sheets), divided = new WorldStudyGait(sheets);
  for (let i = 0; i < 100; i++) divided.advance(-.2, -.2);
  expect(divided.advance(0, 0).phase).toBeCloseTo(direct.advance(-20, -20).phase);
});

test('contact remains under the planted shoe when a swinging foot is the lowest solid row', () => {
  const alpha = new Uint8Array(32 * 32);
  for (let x = 4; x <= 9; x++) alpha[18 * 32 + x] = 1;
  for (let x = 21; x <= 26; x++) alpha[26 * 32 + x] = 1;
  const mask = maskOfAlpha(alpha, 32, 32);
  expect(mask.feet).toBe(26);
  const contacts = worldStudyFootContacts(mask, 16, 16, [{ x: -10, y: 1, support: true }, { x: 8, y: 10, support: false }]);
  expect(contacts).toEqual(Array.from({ length: 4 }, (_, i) => ({ x: -12, y: 2 + i, width: 6 })));
  expect(worldStudyFootContacts(mask, 16, 16, [{ x: -10, y: 1, support: true }, { x: -10, y: 1, support: true }])).toEqual(contacts);
});
