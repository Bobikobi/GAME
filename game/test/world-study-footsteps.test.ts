import { expect, test } from 'vitest';
import { FOOTPRINT_LIMIT, WorldStudyFootsteps, footprintAlpha, type FootstepBody } from '../src/world-study-footsteps';

const body = (x = 0, dx = 1, support = true): FootstepBody => ({ x, y: 20, dx, dy: 0, mirrored: false, feet: [{ foot: 'Left', x: -3, y: 1, support }] });

test('standing or blocked input makes no marks; a supporting foot stamps once per plant', () => {
  const trail = new WorldStudyFootsteps(() => true);
  for (let i = 0; i < 60; i++) trail.advance(i * 16, body(0, 0));
  expect(trail.marks).toHaveLength(0);
  trail.advance(1000, body(1));
  for (let i = 2; i < 30; i++) trail.advance(1000 + i, body(i));
  expect(trail.marks).toHaveLength(1);
  trail.advance(1100, body(30, 1, false));
  trail.advance(1200, body(31));
  expect(trail.marks).toHaveLength(2);
  expect(trail.marks[1]).toMatchObject({ x: 28, y: 21 });
});

test('only sand can receive a whole stamp, including the edge of a patch', () => {
  const grass = new WorldStudyFootsteps(() => false);
  grass.advance(0, body());
  expect(grass.marks).toHaveLength(0);
  const edge = new WorldStudyFootsteps(x => x >= 0);
  edge.advance(0, body(4)); // the toe is in sand, but part of its sole is outside
  expect(edge.marks).toHaveLength(0);
  edge.relocate();
  edge.advance(1, body(20));
  expect(edge.marks).toHaveLength(1);
});

test('a relocation or repeated start in place cannot draw a trail through the map', () => {
  const trail = new WorldStudyFootsteps(() => true);
  trail.advance(0, body(10));
  trail.advance(1, body(10, 0));
  trail.advance(2, body(11));
  expect(trail.marks).toHaveLength(1);
  trail.relocate();
  trail.advance(3, body(1000, 0));
  expect(trail.marks).toHaveLength(1);
  trail.advance(4, body(1001));
  expect(trail.marks).toHaveLength(2);
});

test('marks have four opacity levels and expire at twenty seconds, with bounded memory', () => {
  expect([0, 4999, 5000, 10_000, 15_000, 19_999, 20_000].map(footprintAlpha)).toEqual([.8, .8, .6, .4, .2, .2, 0]);
  const trail = new WorldStudyFootsteps(() => true);
  for (let i = 0; i < 100; i++) {
    trail.advance(i * 2, body(i * 10, 1, false));
    trail.advance(i * 2 + 1, body(i * 10));
  }
  expect(trail.marks).toHaveLength(FOOTPRINT_LIMIT);
  trail.advance(20_300, body(1000, 0));
  expect(trail.marks).toHaveLength(0);
});

test('right-foot and mirrored body prints retain the corresponding sole orientation', () => {
  const trail = new WorldStudyFootsteps(() => true);
  const step = body(); step.feet = [{ foot: 'Right', x: 3, y: 1, support: true }];
  trail.advance(0, step);
  expect(trail.marks[0]).toMatchObject({ angle: Math.PI / 2, flipX: true });
  trail.relocate();
  trail.advance(1, { ...step, x: 20, mirrored: true });
  expect(trail.marks[1]).toMatchObject({ flipX: false });
});
