import { describe, expect, test } from 'vitest';

import { POSE_KINDS, eatPose, poseFrame } from '../src/work';
import { loadBundle } from '../../tools/test/helpers/world';

describe('the body poses of the player (NEXT 4c)', () => {
  test('a pose that plays through stays on its last frame, one that goes round goes round', () => {
    expect(poseFrame('eat', 0, 3)).toBe(0);
    expect(poseFrame('eat', 5000, 3)).toBe(2);
    expect(poseFrame('craft', 0, 2)).toBe(0);
    expect(poseFrame('craft', 300, 2)).toBe(1);
    expect(poseFrame('craft', 600, 2)).toBe(0);
  });

  test('a cup is drunk and the rest is eaten', () => {
    expect(eatPose('core/herb-tea')).toBe('drink');
    expect(eatPose('core/herb-stew')).toBe('eat');
    expect(eatPose('core/berry-mash')).toBe('eat');
  });

  test('every starter has every pose in both looks, and none draws the shared player sheets', () => {
    const b = loadBundle();
    for (const [id, st] of Object.entries(b.starters)) {
      for (const base of [st.sprite, st.sprite_alt].filter((x): x is string => !!x)) {
        expect(base, `${id} draws a shared sheet`).not.toMatch(/chars\/(player|woman)_/);
        for (const pose of POSE_KINDS) {
          for (const dir of pose === 'sleep' ? ['down'] : ['down', 'left', 'up']) {
            const key = base.replace(/_down$/, `_${pose}_${dir}`);
            expect(b.sprites[key], `${id}: ${key}`).toBeDefined();
          }
        }
      }
    }
  });
});
