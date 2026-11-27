/**
 * #847: the drawn wolf. The kit names a wolf sheet per verb and view (`creature_clip`) and the old 16 px still names the wolf it
 * stands for (`still_of`); the world finds the sheet by the way the wolf faces and walks it while it moves. This reads the shipped
 * bundle, so the six sheets and their numbers are held here as the game gets them.
 */
import { beforeAll, describe, expect, test } from 'vitest';
import { type Bundle, hazardsOf } from '@game/kernel';
import { WalkWatch, creatureClipFor, creatureOf, creaturePoint, creatureSheets, creatureX, viewOfHeading, type CreatureSprites } from '../src/clips';
import type { Dir } from '../src/input';
import { glowPixels, WOLF_EYES } from '../src/predator';
import { loadBundle } from '../../tools/test/helpers/world';

let b: Bundle;
let sprites: CreatureSprites;
beforeAll(() => {
  b = loadBundle();
  sprites = b.sprites as CreatureSprites;
});

describe('the wolf finds its sheet by its heading', () => {
  test('a heading is a facing: left, right (the left sheet flipped), up is the back and down the front', () => {
    expect(viewOfHeading([-1, 0])).toMatchObject({ dir: 'left', view: 'left', flip: false });
    expect(viewOfHeading([1, 0])).toMatchObject({ dir: 'right', view: 'left', flip: true });
    expect(viewOfHeading([0, -1])).toMatchObject({ dir: 'up', view: 'back', flip: false });
    expect(viewOfHeading([0, 1])).toMatchObject({ dir: 'down', view: 'front', flip: false });
  });

  test('a wolf with no heading keeps the way it faced, and with none before it has no view', () => {
    expect(viewOfHeading([0, 0], 'up')).toMatchObject({ dir: 'up', view: 'back' });
    expect(viewOfHeading([0, 0])).toBeUndefined();
  });

  test('the bank wolf, the camp wolf and the ruins wolf share one still, and it stands for core/wolf', () => {
    const stills = new Set(b.map.props.filter((p) => p.hazard?.kind === 'predator').map((p) => p.sprite));
    expect([...stills]).toEqual(['core/base-kit:props/hazard_wolf']);
    expect(creatureOf(sprites, 'core/base-kit:props/hazard_wolf')).toBe('core/wolf');
    expect(Object.keys(b.map.creatures?.kinds ?? {})).toContain('core/wolf');
    expect(hazardsOf(b).filter((h) => h.kind === 'predator').length).toBeGreaterThanOrEqual(3);
  });

  test('every verb and facing finds a sheet: six sheets, eight frames each, the left one for both sides', () => {
    expect(creatureSheets(sprites, 'core/wolf')).toHaveLength(6);
    const faces: [Dir, string, boolean][] = [['left', 'left', false], ['right', 'left', true], ['down', 'front', false], ['up', 'back', false]];
    for (const verb of ['walk', 'idle'] as const) {
      for (const [dir, view, flip] of faces) {
        const found = creatureClipFor(sprites, 'core/wolf', verb, dir);
        expect(found, `${verb} ${dir}`).toBeDefined();
        expect(found).toMatchObject({ view, flip, frames: 8, w: 128, h: 128, fit: 1 });
        expect(found!.key).toBe(`core/base-kit:creatures/wolf_${verb}_${view}`);
        expect(found!.frame_ms).toBe(verb === 'walk' ? 90 : 150);
        expect(found!.anchor[1]).toBeLessThan(128);
      }
    }
  });

  test('a creature with no sheet finds none, so its still stays', () => {
    expect(creatureClipFor(sprites, 'core/hare', 'walk', 'left')).toBeUndefined();
    expect(creatureOf(sprites, 'core/base-kit:props/rubble')).toBeUndefined();
  });

  test('the eye is on the head the sheet names: from the side and the front, and from behind the middle top of the figure', () => {
    for (const dir of ['left', 'down', 'up'] as const) {
      const found = creatureClipFor(sprites, 'core/wolf', 'walk', dir)!;
      expect(found.head, dir).toBeDefined();
      expect(found.head![0]).toBeGreaterThan(0);
      expect(found.head![1]).toBeLessThan(found.anchor[1]);
    }
  });
});

describe('a wolf walks while it moves and stands when it stops', () => {
  test('still at first, walking the moment its drawn place moves, and standing again after the hold', () => {
    const w = new WalkWatch(250);
    expect(w.walking(0, [3, 4])).toBe(false);
    expect(w.walking(16, [3, 4])).toBe(false);
    expect(w.walking(32, [3.01, 4])).toBe(true);
    expect(w.walking(200, [3.01, 4])).toBe(true);
    expect(w.walking(283, [3.01, 4])).toBe(false);
  });

  test('a pause shorter than the hold (the turn at a corner) does not flicker to the idle', () => {
    const w = new WalkWatch(250);
    w.walking(0, [0, 0]);
    w.walking(10, [0.1, 0]);
    expect(w.walking(120, [0.1, 0])).toBe(true);
    expect(w.walking(130, [0.1, 0.1])).toBe(true);
  });
});

describe('the feet stay where the wolf stands, in every view and flipped', () => {
  test('the foot column of a sheet lands on the wolf tile whichever way the sheet is drawn', () => {
    for (const verb of ['walk', 'idle'] as const) {
      for (const dir of ['left', 'right', 'down', 'up'] as const) {
        const found = creatureClipFor(sprites, 'core/wolf', verb, dir)!;
        const scale = 0.25 * found.fit;
        const x = 100;
        const placed = creatureX(x, found, scale);
        // a sheet pixel's world x: the image's middle at `placed`, the pixel's distance from it mirrored when flipped
        const world = (px: number): number => placed + (found.flip ? -1 : 1) * (px - found.w / 2) * scale;
        expect(world(found.anchor[0])).toBeCloseTo(x, 9);
        const head = creaturePoint(x, 50, found, found.head!, scale);
        expect(head.x).toBeCloseTo(world(found.head![0]), 9);
        expect(head.y).toBeCloseTo(50 + (found.head![1] - found.anchor[1]) * scale, 9);
      }
    }
  });

  test('the left wolf faces left and its flip faces right: the head is on the other side of the feet', () => {
    const left = creatureClipFor(sprites, 'core/wolf', 'walk', 'left')!;
    const right = creatureClipFor(sprites, 'core/wolf', 'walk', 'right')!;
    const a = creaturePoint(0, 0, left, left.head!, 0.25).x;
    const c = creaturePoint(0, 0, right, right.head!, 0.25).x;
    expect(a).toBeLessThan(0);
    expect(c).toBeCloseTo(-a, 9);
  });
});

describe('the glow on the drawn eye', () => {
  test('one glow point has the pair its rings and one eye wide, the same strengths', () => {
    const pair = glowPixels(WOLF_EYES.halo);
    const one = glowPixels(WOLF_EYES.halo, 1);
    expect(one.h).toBe(pair.h);
    expect(one.w).toBe(WOLF_EYES.size + 2 * WOLF_EYES.halo.length);
    expect(new Set(one.px.map((p) => p.a))).toEqual(new Set(WOLF_EYES.halo));
    // the eye itself is left clear
    expect(one.px.some((p) => p.x >= WOLF_EYES.halo.length && p.x < WOLF_EYES.halo.length + WOLF_EYES.size && p.y >= WOLF_EYES.halo.length && p.y < WOLF_EYES.halo.length + WOLF_EYES.size)).toBe(false);
  });
});
