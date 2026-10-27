/**
 * The races' walk (tools/anim): a sheet's frames are the poses of a cycle and, last, the standing pose; the pose shown
 * follows the distance the body has walked. The slide of a planted foot is measured here in the game's own walker, with
 * the game's own pose rule, against the feet the render measured (tools/anim/feet.json), at the three paces.
 *
 * Two numbers per sheet, view and pace:
 *  - at the pose instants (the body exactly at a pose), the foot is within `foot_slide_px` (1 px) of the ground: the
 *    drawing is true to the walk;
 *  - frame by frame at 60 Hz, the pose is the nearest one to the distance walked, held while the body goes on, so the
 *    foot swings about the ground by up to half a pose: that swing is reported and held to its bound.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, test } from 'vitest';

import { Walker } from '../src/walking';
import { poseFrame, standingFrame } from '../src/work';
import { plantSlide } from '../../tools/src/anim/measure';
import { ANIM_DIR } from '../../tools/src/anim/clip';
import { loadBundle } from '../../tools/test/helpers/world';

const b = loadBundle();
const feet = JSON.parse(readFileSync(join(ANIM_DIR, 'feet.json'), 'utf8')) as {
  sheets: Record<string, Record<string, { poses: number; travel: number; slope: number; plants: { foot: string; poses: number[]; ys: number[]; icpt: number }[] }>>;
};
const settings = JSON.parse(readFileSync(join(ANIM_DIR, 'anim.json'), 'utf8')) as { limits: { foot_slide_px: number }; frame: { size: [number, number]; anchor: [number, number] } };

const FRAME_MS = 1000 / 60;
const PACES = { light: b.params.load.light_step_ms, steady: b.params.walk_step_ms, heavy: b.params.load.heavy_step_ms } as const;
const HELD: Record<string, [number, number]> = { down: [0, 1], up: [0, -1], left: [-1, 0] };

describe('the pose rule', () => {
  test('a pose is the nearest to the distance walked, round the cycle', () => {
    expect(poseFrame(0, 10, 16)).toBe(0);
    expect(poseFrame(4.9, 10, 16)).toBe(0);
    expect(poseFrame(5.1, 10, 16)).toBe(1);
    expect(poseFrame(10 * 15, 10, 16)).toBe(0);
    expect(poseFrame(10 * 15 + 30, 10, 16)).toBe(3);
  });

  test('a sheet with no pose or no stride shows its first pose, and a stride sheet rests on its last frame', () => {
    expect(poseFrame(100, 10, 1)).toBe(0);
    expect(poseFrame(100, 0, 16)).toBe(0);
    expect(standingFrame({ frames: 16, stride: { travel_mpx: 14000, anchor: [64, 90] } }, 1)).toBe(15);
    expect(standingFrame({ frames: 3 }, 1)).toBe(1);
    expect(standingFrame(undefined, 1)).toBe(1);
  });
});

describe('the sheets the races walk on', () => {
  const races = Object.values(b.races);
  test('every race and look names a stride sheet of the anim frame, with its anchor', () => {
    for (const race of races) {
      for (const ref of [race.sprite, race.sprite_alt]) {
        if (!ref) continue;
        const info = b.sprites[ref];
        expect(info, ref).toBeDefined();
        expect(info!.density).toBe(4);
        expect([info!.w, info!.h]).toEqual(settings.frame.size);
        expect(info!.stride?.anchor).toEqual(settings.frame.anchor);
        expect(info!.frames).toBeGreaterThanOrEqual(3);
        expect(info!.frames).toBeLessThanOrEqual(16);
      }
    }
  });

  test('the kit says what the render measured', () => {
    for (const [sheet, views] of Object.entries(feet.sheets)) {
      for (const [view, f] of Object.entries(views)) {
        const info = b.sprites[`core/base-kit:chars/${sheet}_${view}`];
        expect(info?.stride?.travel_mpx, `${sheet}_${view}`).toBe(Math.round(f.travel * 1000));
        expect(info?.frames).toBe(f.poses + 1);
      }
    }
  });
});

describe('a planted foot against the ground, in the game walker', () => {
  const report: string[] = [];
  afterAll(() => {
    // the numbers the pull request quotes
    console.info(`foot slide, art px (instants / swing at 60 Hz):\n${report.join('\n')}`);
  });

  for (const [sheet, views] of Object.entries(feet.sheets)) {
    for (const [view, f] of Object.entries(views)) {
      for (const [pace, stepMs] of Object.entries(PACES)) {
        test(`${sheet} ${view} at the ${pace} pace`, () => {
          const frames = f.poses + 1;
          // the travel the game reads from the bundle, in whole thousandths of a pixel
          const travel = b.sprites[`core/base-kit:chars/${sheet}_${view}`]!.stride!.travel_mpx / 1000;
          // at the instants: the body exactly at pose k of any cycle
          let instants = 0;
          for (let k = 0; k < f.poses * 3; k++) {
            const pose = poseFrame(k * travel, travel, frames);
            expect(pose).toBe(k % f.poses);
            const slide = plantSlide(f.plants, f.slope, f.poses, pose, k);
            if (slide !== undefined) instants = Math.max(instants, Math.abs(slide));
          }
          expect(instants).toBeLessThanOrEqual(settings.limits.foot_slide_px);

          // frame by frame: the real walker at 60 Hz and the real pose rule
          const w = new Walker();
          w.place([40, 40]);
          let swing = 0;
          let shown = 0;
          const speed = (64 * FRAME_MS) / stepMs;
          for (let t = 0; t < 6000; t += FRAME_MS) {
            w.frame(HELD[view]!, FRAME_MS, stepMs, () => true);
            const pose = poseFrame(w.walked, travel, frames);
            const slide = plantSlide(f.plants, f.slope, f.poses, pose, w.walked / travel);
            if (slide === undefined) continue;
            shown++;
            swing = Math.max(swing, Math.abs(slide));
          }
          expect(shown).toBeGreaterThan(0);
          report.push(`${sheet} ${view} ${pace}: ${Math.round(instants * 100) / 100} / ${Math.round(swing * 10) / 10} (pose ${travel} px, ${Math.round(speed * 10) / 10} px a frame)`);
          // half a pose, plus a pixel of drawing
          expect(swing).toBeLessThanOrEqual(travel / 2 + settings.limits.foot_slide_px);
        });
      }
    }
  }
});
