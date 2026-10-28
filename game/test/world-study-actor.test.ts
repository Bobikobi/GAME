import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { WorldStudyActorMotion } from '../src/world-study-actor';
import provenance from '../../docs/design/frames/rich-world-character-2026-10-28/provenance.json';

test('review copies retain the exact source sheets and their frame geometry', () => {
  for (const sheet of Object.values(provenance.sheets)) {
    const bytes = readFileSync(new URL(`../../docs/design/frames/rich-world-character-2026-10-28/${sheet.file}`, import.meta.url));
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
  expect(divided.advance(0, travel * .1)).toEqual(directPose);
  for (let i = 0; i < 100; i++) expect(direct.advance(0, 0)).toMatchObject({ sheet: 'down', frame: 10 });
  // A key held against a root supplied no actual distance: the next pose remains the same.
  expect(direct.advance(0, travel * .4)).toMatchObject({ frame: 3 });
  expect(direct.advance(travel, 0)).toMatchObject({ sheet: 'left', flipX: true });
});

test('directional output uses all three views, mirrors right, and keeps the facing at rest', () => {
  const motion = new WorldStudyActorMotion();
  expect(motion.advance(0, -10)).toMatchObject({ sheet: 'up', flipX: false });
  expect(motion.advance(-10, 0)).toMatchObject({ sheet: 'left', flipX: false });
  expect(motion.advance(10, 0)).toMatchObject({ sheet: 'left', flipX: true });
  expect(motion.advance(0, 0)).toEqual({ sheet: 'left', flipX: true, frame: 10 });
  expect(motion.advance(0, 10)).toMatchObject({ sheet: 'down', flipX: false });
  expect(motion.reset()).toEqual({ sheet: 'down', flipX: false, frame: 10 });
  expect(motion.advance(0, 1)).toMatchObject({ frame: 0 });
});
