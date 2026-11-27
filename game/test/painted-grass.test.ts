import { describe, expect, test } from 'vitest';

import { GRASS, GRASS_FS } from '../src/grass-shader.js';
import { GUST_WAVES, gust } from '../src/look.js';

/**
 * Private #44, step A (the owner's word of 9.11: "all grass, always like this"): the meadow's pass moves the painted plate's grass in a filter, so the painting is kept. The picture bars are
 * measured on frames (tools/art/scene/grassbars.py); these hold what code can: the pass reads the same gust as the trees and the ground cover, and it can only ever take a colour from a pixel its
 * mask names.
 */
describe('the meadow pass', () => {
  test('the gust is one table: the three waves of look.ts, summing to a swing of -1 to 1', () => {
    expect(GUST_WAVES.reduce((a, w) => a + w[0], 0)).toBeCloseTo(1, 9);
    for (let t = 0; t < 40; t += 0.37) {
      const by = GUST_WAVES.reduce((a, [k, period, shift]) => a + k * Math.sin((2 * Math.PI * t) / period + shift), 0);
      expect(gust(t)).toBeCloseTo(by, 12);
      expect(Math.abs(gust(t))).toBeLessThanOrEqual(1 + 1e-9);
    }
  });

  test('the shader reads the same lean signal as the pieces: 0.3 + 0.62 x the gust, in the same waves', () => {
    expect(GRASS_FS).toContain('0.3 + 0.62 * g');
    // the pieces' signal is 0.3 + 0.62 x gust(t - u) (painted.ts leanSignal), u the front's arrival at the place: the shader's `g` is that same sum of the same waves at t - u
    expect(GRASS_FS).toContain('float t = uTime - u;');
    expect(GRASS_FS).toContain('float g = wave(uWave0, t) + wave(uWave1, t) + wave(uWave2, t);');
    expect(GRASS_FS).toContain('float wave(vec3 w, float t) { return w.x * sin(TAU * t / w.y + w.z); }');
    // the shader's three waves come in as uniforms from GUST_WAVES (painted-grass.ts setupUniforms), none are written in the text
    expect(GRASS_FS).not.toMatch(/\b(5\.3|2\.9|1\.7)\b/);
  });

  test('a pixel is moved only from a pixel the mask names, and a pixel the mask does not name is returned as it is', () => {
    expect(GRASS_FS).toMatch(/uAmp <= 0\.0 \|\| inside < 0\.5\) \{ gl_FragColor = here; return; \}/);
    expect(GRASS_FS).toMatch(/texture2D\(uMask, from\)\.r < 0\.5\) \{ gl_FragColor = here; return; \}/);
    // the last line of the shader is the only one that takes a colour from elsewhere, and it comes after both guards
    const last = GRASS_FS.lastIndexOf('texture2D(uMainSampler, from)');
    expect(last).toBeGreaterThan(GRASS_FS.indexOf('texture2D(uMask, from)'));
    expect(GRASS_FS.match(/texture2D\(uMainSampler, from\)/g)).toHaveLength(1);
  });

  test('the shift is whole plate pixels, never more than lean + 1 (a bend on top of a full gust), and the mask is read pixel for pixel', () => {
    expect(GRASS.lean).toBe(2);
    expect(GRASS_FS).toContain(`clamp(shift, -${GRASS.lean + 1}.0, ${GRASS.lean + 1}.0)`);
    expect(GRASS_FS).toContain('floor(clamp(');
  });
});
