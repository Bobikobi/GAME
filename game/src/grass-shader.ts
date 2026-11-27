/**
 * The meadow pass's numbers and its shader text (private #44 step A), kept apart from painted-grass.ts so that code that needs no renderer (the unit tests, the bars' tools) can read them
 * without loading Phaser.
 */

/** the pass's numbers: the most plate px a pixel is moved, the rows in a band, the spread of the bands' lag behind the front (s) and the bend's ellipse (scene px) */
export const GRASS = { lean: 2, band: 3, lag: 0.9, rx: 64, ry: 40 } as const;

export const GRASS_FS = `
#pragma phaserTemplate(shaderName)
precision highp float;
uniform sampler2D uMainSampler;
uniform sampler2D uMask;
uniform vec2 uSize;
uniform vec2 uAt;
uniform float uTime;
uniform float uAmp;
uniform vec3 uWind;
uniform vec3 uWave0;
uniform vec3 uWave1;
uniform vec3 uWave2;
uniform vec3 uFig;
uniform vec4 uBend;
uniform float uShow;
varying vec2 outTexCoord;
const float TAU = 6.283185307;
float wave(vec3 w, float t) { return w.x * sin(TAU * t / w.y + w.z); }
float h1(float n) { return fract(sin(n * 127.1 + 311.7) * 43758.5453); }
void main () {
  vec4 here = texture2D(uMainSampler, outTexCoord);
  float inside = texture2D(uMask, outTexCoord).r;
  if (uShow > 0.5) { gl_FragColor = vec4(vec3(step(0.5, inside)), 1.0); return; }
  if (uAmp <= 0.0 || inside < 0.5) { gl_FragColor = here; return; }
  vec2 px = floor(outTexCoord * uSize);
  vec2 sc = uAt + vec2(px.x, uSize.y - 1.0 - px.y);
  float band = floor(sc.y / ${GRASS.band}.0);
  float u = (sc.x * uWind.x + sc.y * uWind.y) / uWind.z + (h1(band) - 0.5) * ${GRASS.lag.toFixed(2)};
  float t = uTime - u;
  float g = wave(uWave0, t) + wave(uWave1, t) + wave(uWave2, t);
  float shift = (0.3 + 0.62 * g) * ${GRASS.lean}.0;
  vec2 d = (sc - uFig.xy) / uBend.xy;
  float q = 1.0 - length(d);
  if (q > 0.0 && uFig.z > 0.5) shift += (d.x >= 0.0 ? 1.0 : -1.0) * ${GRASS.lean}.0 * min(1.0, q * 1.5) * uBend.z;
  shift = floor(clamp(shift, -${GRASS.lean + 1}.0, ${GRASS.lean + 1}.0) * uAmp + 0.5);
  vec2 from = outTexCoord - vec2(shift / uSize.x, 0.0);
  if (shift == 0.0 || texture2D(uMask, from).r < 0.5) { gl_FragColor = here; return; }
  gl_FragColor = texture2D(uMainSampler, from);
}
`;
