/**
 * The meadow of the painted plate moves (private #44 step A, the owner's word of 9.11: "all grass, always like this").
 *
 * One filter pass on each ground unit, in plate pixels, so the painting is kept (nothing is cut out of it): where the unit's meadow mask (baked by the private exporter) is set, a pixel takes
 * the colour of the pixel `shift` to its left, and only when that one is meadow too. A pixel the mask does not name never changes and never lends its colour. With `uAmp` 0 every pixel is
 * the one the plate holds (the rest frame, `hold=grass`). `hold=nomeadow` takes the pass off (the old picture's own path); `hold=grassmap` draws the mask itself, white on black, for the measures.
 *
 * The shift is the gust's: the same front the trees and the ground cover lean with (painted.ts leanSignal: 0.3 + 0.62 x the three-wave gust of look.ts, carried along the gust's direction at
 * its speed), at most `lean` plate px, in bands of `band` rows that each lag the front a little so the meadow ripples instead of sliding. A walker pushes the meadow round her feet away
 * from her, over quickly and back slowly (the ground cover's BEND), by up to the same `lean`.
 */
import * as Phaser from 'phaser';

import { GUST_WAVES } from './look';
import { GRASS, GRASS_FS } from './grass-shader';

export { GRASS, GRASS_FS } from './grass-shader';

type Manager = Phaser.Renderer.WebGL.RenderNodes.RenderNodeManager;

/** One unit's pass: its clock and gust, its mask, where it lies in the scene, and the walker's place in the scene and how far over the meadow is bent. */
export class GrassPass extends Phaser.Filters.Controller {
  time = 0;
  amp = 1;
  size: [number, number];
  at: [number, number];
  wind: [number, number, number];
  fig: [number, number, number] = [0, 0, 0];
  bend = 0;
  show = 0;
  constructor(camera: Phaser.Cameras.Scene2D.Camera, readonly mask: Phaser.Textures.Texture, size: [number, number], at: [number, number], wind: [number, number, number]) {
    super(camera, 'FilterGrass');
    this.size = size;
    this.at = at;
    this.wind = wind;
  }
}

/** Registers the pass with the renderer, once. False on a renderer without WebGL filters. */
export function installGrass(game: Phaser.Game): boolean {
  const renderer = game.renderer as Phaser.Renderer.WebGL.WebGLRenderer;
  const nodes = renderer.renderNodes as Manager | undefined;
  if (!nodes || renderer.type !== Phaser.WEBGL) return false;
  const Base = Phaser.Renderer.WebGL.RenderNodes.BaseFilterShader;
  const has = (nodes as unknown as { _nodeConstructors: Record<string, unknown> })._nodeConstructors['FilterGrass'] !== undefined;
  if (!has) {
    nodes.addNodeConstructor(
      'FilterGrass',
      class extends Base {
        constructor(manager: Manager) {
          super('FilterGrass', manager, undefined, GRASS_FS);
        }
        override setupTextures(c: GrassPass, textures: unknown[]): void {
          textures[1] = c.mask.source[0]?.glTexture;
        }
        override setupUniforms(c: GrassPass): void {
          const p = this.programManager;
          p.setUniform('uMask', 1);
          p.setUniform('uSize', c.size);
          p.setUniform('uAt', c.at);
          p.setUniform('uTime', c.time);
          p.setUniform('uAmp', c.amp);
          p.setUniform('uWind', c.wind);
          GUST_WAVES.forEach((w, i) => p.setUniform(`uWave${i}`, [...w]));
          p.setUniform('uFig', c.fig);
          p.setUniform('uBend', [GRASS.rx, GRASS.ry, c.bend, 0]);
          p.setUniform('uShow', c.show);
        }
      } as unknown as typeof Phaser.Renderer.WebGL.RenderNodes.RenderNode,
    );
  }
  return true;
}
