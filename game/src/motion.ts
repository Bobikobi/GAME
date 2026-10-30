/**
 * The lighting ladder's motion (LIGHTING.md section 3 C, the owner's C of 30.10): two small shaders, both behind
 * `RICH.motion`, so a reader who asked for reduced motion sees the valley still (G29).
 *
 * - **Sway**, over the camera before its colour grade: the pixels that may move (richground.ts `MOVES`: the meadow's
 *   two lightest greens, wherever they are drawn, in a tile, a tall grass or a canopy; and the water's two light
 *   dashes) lean with a slow gust, 1 art px at its edge and 2 at its heart, rows alternating every 6. Everything else
 *   stays where it is, so a trunk, a path or a body never moves. Whole art pixels: the shift is a multiple of one.
 * - **Flame**, on a burning fire's drawn flame: its outline wobbles a texel at a time, row by row, at the flame's own
 *   phase, so the tongue licks instead of only scaling.
 *
 * The numbers the shaders read are richground.ts's and are pinned there by a test; this file only hands them over.
 */
import * as Phaser from 'phaser';

import { GUST, MOVES } from './richground';

const rgb = (c: number): [number, number, number] => [((c >> 16) & 0xff) / 255, ((c >> 8) & 0xff) / 255, (c & 0xff) / 255];

const SWAY_FS = `
#pragma phaserTemplate(shaderName)
precision mediump float;
uniform sampler2D uMainSampler;
uniform vec2 resolution;
uniform float time;
uniform vec2 scroll;
uniform float artPx;
uniform vec3 m0;
uniform vec3 m1;
uniform vec3 w0;
uniform vec3 w1;
uniform float tol;
uniform float speed;
uniform float scale;
varying vec2 outTexCoord;

float kind(vec3 c) {
  if (all(lessThan(abs(c - m0), vec3(tol))) || all(lessThan(abs(c - m1), vec3(tol)))) return 1.0;
  if (all(lessThan(abs(c - w0), vec3(tol))) || all(lessThan(abs(c - w1), vec3(tol)))) return 2.0;
  return 0.0;
}

void main () {
  vec2 px = outTexCoord * resolution;
  // the art pixel this screen pixel shows, anchored to the world so the gust stays on the ground as the camera moves
  vec2 art = floor(vec2(px.x + scroll.x, resolution.y - px.y + scroll.y) / artPx);
  float g = sin(art.x * scale + art.y * scale * 0.6 - time * speed);
  float lean = g > 0.85 ? 2.0 : (g > 0.55 ? 1.0 : 0.0);
  // rows alternate every 6 art px: one row leans a step less, so a blade bends instead of sliding
  if (mod(floor(art.y / 6.0), 2.0) > 0.5) lean = max(0.0, lean - 1.0);
  float drift = floor(mod(time * 2.0 + art.y * 0.37, 3.0)) - 1.0;
  vec2 step = vec2(artPx / resolution.x, 0.0);
  vec4 here = texture2D(uMainSampler, outTexCoord);
  float k = kind(here.rgb);
  vec4 col = here;
  vec4 fromM = texture2D(uMainSampler, outTexCoord - step * lean);
  vec4 fromW = texture2D(uMainSampler, outTexCoord - step * drift);
  if (lean > 0.0 && k != 2.0 && kind(fromM.rgb) == 1.0) {
    // the light green from the left leans over this pixel
    col = fromM;
  } else if (lean > 0.0 && k == 1.0) {
    // this light green leaned away: what lay beside it shows through
    vec4 beside = texture2D(uMainSampler, outTexCoord + step * lean);
    if (kind(beside.rgb) == 0.0) col = beside;
  } else if (drift != 0.0 && k != 0.0 && kind(fromW.rgb) == 2.0) {
    col = fromW;
  }
  gl_FragColor = col;
}
`;

const FLAME_FS = `
#pragma phaserTemplate(shaderName)
precision mediump float;
uniform sampler2D uMainSampler;
uniform vec2 resolution;
uniform float time;
uniform float cell;
uniform float phase;
varying vec2 outTexCoord;

void main () {
  vec2 px = outTexCoord * resolution;
  float row = floor(px.y / cell);
  float rows = floor(resolution.y / cell);
  // the top two thirds of the tongue lick a texel to either side, each row at its own beat; the base holds
  float top = step(rows / 3.0, row);
  float shift = floor(sin(time * 9.0 + row * 1.1 + phase) * 1.49 + 0.5) * top;
  gl_FragColor = texture2D(uMainSampler, outTexCoord - vec2(shift * cell / resolution.x, 0.0));
}
`;

type Manager = Phaser.Renderer.WebGL.RenderNodes.RenderNodeManager;
type Context = Phaser.Renderer.WebGL.DrawingContext;

/** The sway's controller: the clock and the camera's corner it reads every frame. */
export class Sway extends Phaser.Filters.Controller {
  time = 0;
  scroll: [number, number] = [0, 0];
  artPx = 1;
  constructor(camera: Phaser.Cameras.Scene2D.Camera) {
    super(camera, 'FilterSway');
  }
}

/** A flame's controller: its clock, its phase, and how many screen pixels one of its texels covers. */
export class Flame extends Phaser.Filters.Controller {
  time = 0;
  cell = 1;
  phase = 0;
  constructor(camera: Phaser.Cameras.Scene2D.Camera, phase: number) {
    super(camera, 'FilterFlame');
    this.phase = phase;
    // a texel of room on each side, so a licking edge is not cut by the flame's own bounds
    this.setPaddingOverride(-2, 0, 2, 0);
  }
}

/** Registers the two shaders with the renderer, once. False on a renderer without WebGL filters. */
export function installMotion(game: Phaser.Game): boolean {
  const renderer = game.renderer as Phaser.Renderer.WebGL.WebGLRenderer;
  const nodes = renderer.renderNodes as Manager | undefined;
  if (!nodes || renderer.type !== Phaser.WEBGL) return false;
  const Base = Phaser.Renderer.WebGL.RenderNodes.BaseFilterShader;
  const has = (name: string) => (nodes as unknown as { _nodeConstructors: Record<string, unknown> })._nodeConstructors[name] !== undefined;
  if (!has('FilterSway')) {
    nodes.addNodeConstructor(
      'FilterSway',
      class extends Base {
        constructor(manager: Manager) {
          super('FilterSway', manager, undefined, SWAY_FS);
        }
        override setupUniforms(c: Sway, ctx: Context): void {
          const p = this.programManager;
          p.setUniform('resolution', [ctx.width, ctx.height]);
          p.setUniform('time', c.time);
          p.setUniform('scroll', c.scroll);
          p.setUniform('artPx', c.artPx);
          p.setUniform('m0', rgb(MOVES.meadow[0]));
          p.setUniform('m1', rgb(MOVES.meadow[1]));
          p.setUniform('w0', rgb(MOVES.water[0]));
          p.setUniform('w1', rgb(MOVES.water[1]));
          p.setUniform('tol', GUST.tolerance);
          p.setUniform('speed', GUST.speed);
          p.setUniform('scale', GUST.scale);
        }
      } as unknown as typeof Phaser.Renderer.WebGL.RenderNodes.RenderNode,
    );
  }
  if (!has('FilterFlame')) {
    nodes.addNodeConstructor(
      'FilterFlame',
      class extends Base {
        constructor(manager: Manager) {
          super('FilterFlame', manager, undefined, FLAME_FS);
        }
        override setupUniforms(c: Flame, ctx: Context): void {
          const p = this.programManager;
          p.setUniform('resolution', [ctx.width, ctx.height]);
          p.setUniform('time', c.time);
          p.setUniform('cell', c.cell);
          p.setUniform('phase', c.phase);
        }
      } as unknown as typeof Phaser.Renderer.WebGL.RenderNodes.RenderNode,
    );
  }
  return true;
}
