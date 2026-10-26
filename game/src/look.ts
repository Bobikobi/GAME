/**
 * The look trial's filter: one fragment pass on the world camera's outside, after the colour matrix. It warps
 * the picture so its top is narrower than its bottom (perspective), then blurs each pixel by its distance from
 * the crisp band (tilt-shift). Pixels in the crisp band with no perspective are one plain sample, so they leave
 * as they came in. See look-spec.ts for the numbers.
 */
import * as Phaser from 'phaser';
import { specOf, type Look, type LookSpec } from './look-spec';

const NAME = 'FilterTiltShift';
const TAPS = 24;

const FRAGMENT = [
  '#pragma phaserTemplate(shaderName)',
  'precision highp float;',
  'uniform sampler2D uMainSampler;',
  'uniform vec2 resolution;',
  'uniform float radius;',
  'uniform vec2 band;',
  'uniform float ramp;',
  'uniform float topWidth;',
  'uniform float flipY;',
  'uniform vec4 gap;',
  'varying vec2 outTexCoord;',
  '#pragma phaserTemplate(fragmentHeader)',
  'void main ()',
  '{',
  '    float t = flipY > 0.5 ? 1.0 - outTexCoord.y : outTexCoord.y;',
  '    float w = mix(topWidth, 1.0, t);',
  '    vec2 uv = vec2(0.5 + (outTexCoord.x - 0.5) / w, outTexCoord.y);',
  '    if (uv.x < 0.0 || uv.x > 1.0) { gl_FragColor = gap; return; }',
  '    float out_ = t < band.x ? band.x - t : (t > band.y ? t - band.y : 0.0);',
  '    float r = radius * clamp(out_ / ramp, 0.0, 1.0);',
  '    if (r < 0.01) { gl_FragColor = texture2D(uMainSampler, uv); return; }',
  '    vec4 acc = texture2D(uMainSampler, uv);',
  '    for (int i = 0; i < ' + TAPS + '; i++)',
  '    {',
  '        float f = (float(i) + 0.5) / ' + TAPS + '.0;',
  '        float a = float(i) * 2.39996323;',
  '        vec2 o = sqrt(f) * r * vec2(cos(a), sin(a)) / resolution;',
  '        acc += texture2D(uMainSampler, clamp(uv + o, 0.0, 1.0));',
  '    }',
  '    gl_FragColor = acc / ' + (TAPS + 1) + '.0;',
  '}',
].join('\n');

/** The filter's settings, one per camera. `active` false leaves the picture as the game draws it. */
export class TiltShift extends Phaser.Filters.Controller {
  radius = 0;
  band: [number, number] = [0.25, 0.75];
  ramp = 0.15;
  topWidth = 1;
  /** 1 when the filter's texture coordinate runs up the screen */
  flipY = 0;
  /** what shows where the warped world does not reach: transparent, so the page behind shows */
  gap: [number, number, number, number] = [0, 0, 0, 0];

  constructor(camera: Phaser.Cameras.Scene2D.Camera) {
    super(camera, NAME);
    this.setPaddingOverride(0, 0, 0, 0);
  }

  private spec: LookSpec = specOf('tiltshift');

  /** The radius again, for a canvas of another width. */
  resize(canvasWidth: number): void {
    this.radius = this.spec.radius * canvasWidth;
  }

  /** The numbers of a look, for the canvas's width in device pixels. */
  use(spec: LookSpec, canvasWidth: number): this {
    this.spec = spec;
    this.radius = spec.radius * canvasWidth;
    this.band = [spec.bandTop, spec.bandBottom];
    this.ramp = spec.ramp;
    this.topWidth = spec.topWidth;
    return this;
  }
}

class FilterTiltShift extends Phaser.Renderer.WebGL.RenderNodes.BaseFilterShader {
  constructor(manager: Phaser.Renderer.WebGL.RenderNodes.RenderNodeManager) {
    super(NAME, manager, undefined, FRAGMENT);
  }

  setupUniforms(controller: TiltShift, drawingContext: Phaser.Renderer.WebGL.DrawingContext): void {
    const p = this.programManager;
    p.setUniform('radius', controller.radius);
    p.setUniform('band', controller.band);
    p.setUniform('ramp', controller.ramp);
    p.setUniform('topWidth', controller.topWidth);
    p.setUniform('flipY', controller.flipY);
    p.setUniform('gap', controller.gap);
    p.setUniform('resolution', [drawingContext.width, drawingContext.height]);
  }
}

/** Puts the look on the camera, off the world's own pipeline: returns the filter, or null where there is no WebGL. */
export function addLook(cam: Phaser.Cameras.Scene2D.Camera, renderer: Phaser.Renderer.WebGL.WebGLRenderer, look: Look, canvasWidth: number): TiltShift {
  if (!renderer.renderNodes.hasNode(NAME)) renderer.renderNodes.addNodeConstructor(NAME, FilterTiltShift);
  const f = new TiltShift(cam).use(specOf(look), canvasWidth);
  cam.filters.external.add(f);
  return f;
}
