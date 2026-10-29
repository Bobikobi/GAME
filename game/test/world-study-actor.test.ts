import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { WorldStudyActorMotion } from '../src/world-study-actor';
import provenance from '../../docs/design/frames/rich-world-motion-2026-10-29/walk-metadata.json';
import before from '../../docs/design/frames/rich-world-character-2026-10-28/provenance.json';

test('rendered sheets retain the recorded bytes and native frame geometry', () => {
  for (const sheet of Object.values(provenance.sheets)) {
    const bytes = readFileSync(new URL(`../../docs/design/frames/rich-world-motion-2026-10-29/${sheet.file}`, import.meta.url));
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(sheet.sha256);
    expect(bytes.readUInt32BE(16)).toBe(provenance.frame.width * sheet.frames);
    expect(bytes.readUInt32BE(20)).toBe(provenance.frame.height);
  }
});

test('walking depends on travelled distance, including sliding and a fully blocked step', () => {
  const direct = new WorldStudyActorMotion(), divided = new WorldStudyActorMotion();
  const travel = provenance.sheets.down.travelMpx / 1000;
  const directPose = direct.advance(0, travel * 2.2);
  expect(directPose).toMatchObject({ sheet: 'down', frame: 2 });
  for (let i = 0; i < 21; i++) divided.advance(0, travel * .1);
  const dividedPose = divided.advance(0, travel * .1);
  expect(dividedPose).toMatchObject({ sheet: directPose.sheet, frame: directPose.frame, flipX: directPose.flipX });
  expect(dividedPose.phase).toBeCloseTo(directPose.phase, 12);
  for (let i = 0; i < 100; i++) expect(direct.advance(0, 0)).toMatchObject({ sheet: 'down', frame: provenance.walkingFrames });
  // A key held against a root supplied no actual distance: the next pose remains the same.
  expect(direct.advance(0, travel * .4)).toMatchObject({ frame: 3 });
  expect(direct.advance(travel, 0)).toMatchObject({ sheet: 'left', flipX: true });
});

test('directional output uses the rendered views, mirrors right, and keeps the facing at rest', () => {
  const motion = new WorldStudyActorMotion();
  expect(motion.advance(0, -10)).toMatchObject({ sheet: 'up', flipX: false });
  expect(motion.advance(-10, 0)).toMatchObject({ sheet: 'left', flipX: false });
  expect(motion.advance(10, 0)).toMatchObject({ sheet: 'left', flipX: true });
  expect(motion.advance(0, 0)).toMatchObject({ sheet: 'left', flipX: true, frame: provenance.walkingFrames });
  expect(motion.advance(0, 10)).toMatchObject({ sheet: 'down', flipX: false });
  expect(motion.reset()).toMatchObject({ sheet: 'down', flipX: false, frame: provenance.walkingFrames, phase: 0 });
  expect(motion.advance(0, 1)).toMatchObject({ frame: 0 });
});

test('at 60Hz the drawn foot is held over less than half the old ground distance', () => {
  const longestHold = (frameAt: (step: number) => number) => {
    let previous = -1, started = 0, longest = 0;
    for (let step = 0; step < 600; step++) {
      const frame = frameAt(step);
      if (frame !== previous) { previous = frame; started = step; }
      longest = Math.max(longest, (step - started) * 125 / 60);
    }
    return longest;
  };
  const baseline = longestHold(step => Math.floor(step * 125 / 60 / (before.sheets.down.travelMpx / 1000) + .5) % 10);
  const motion = new WorldStudyActorMotion();
  const corrected = longestHold(() => motion.advance(0, 125 / 60).frame);
  expect(corrected).toBeLessThan(baseline / 2);
  expect(corrected).toBeLessThanOrEqual(125 / 60 * 2 + .001);
  for (const sheet of Object.values(provenance.sheets)) {
    expect(125 * provenance.walkingFrames * 1000 / sheet.cycleDistanceMpx).toBeLessThanOrEqual(30);
    expect(sheet.frames * 128).toBeLessThanOrEqual(4096);
  }
});
