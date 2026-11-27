/**
 * Still water, v10 (look lane, 14.11). The picture's own water is the base: the ground plate under it is lit by the engine's one light like the ground
 * beside it, so its hue and its hour are the world's by construction. The water layers only CHANGE it, in whole art pixels (one effect pixel is one art
 * pixel, 3 x 3 device pixels at the game's zoom): a darks pass drawn by MULTIPLY (depth toward the middle, the dark tones of the streaks, the wet band
 * behind the foam and round what stands in the water: it can only take light off) and a lights pass drawn by ADD (the light tones of the streaks, the
 * broken foam, the sun's glints and its warm road: it can only put light on). Nothing replaces a pixel, so nothing is made up that the painting did
 * not draw, and no synthetic bed, tint table or reflection is laid over it (v9 did, and the middle went black).
 *
 * The streaks and the foam are carried along the gust (the table's wind, wind.ts: the one the trees and the grass use) and are read from a hash that has no period,
 * so nothing repeats and nothing restarts. The foam's coverage, its width and its breathing are the numbers of STILL below, taken from the references.
 */
import { DEFAULT_WIND } from './wind';
import { groundLightOf, waterHold, waterHoldTwilight, sparkleOf, warmthOf, type GroundLight } from './look';
import { burnOf } from './fogform';
import { baseLumaPixels, fieldPixels, fillEdge, rampPixels, waterFieldOf, type Footprint, type WaterField } from './waterfield';
import { addMissedWater, seamPixels, toneAtScene } from './waterseam';

/** The numbers of the look, in art pixels and seconds. Each says where it was measured (numbers.md of the v10 drop). */
export type StillNumbers = {
  streak: { along: number; across: number; speed: number; dark: number; light: number; darkMul: number; lightAdd: number; fromShore: readonly [number, number] };
  depth: { drop: number; from: number; to: number; deep: number; lift: number; liftTo: number; turn: number; bands: number; pull: { to: number; k: number; max: number }; glare: { from: number; k: number; max: number } };
  foam: { lo: number; hi: number; period: number; wave: number; cut: number; add: number; lace: number };
  wet: { width: number; mul: number; thing: number; thingMul: number };
  /** the light's dashes: cell length along the gust, share of cells lit, length range, drift in art px a second, strength, life period in seconds */
  dash: { cell: number; prob: number; minLen: number; maxLen: number; speed: number; add: number; period: number };
  /** the depth's patches: size in art px, drift in art px a second, the noise cut where the water is deeper, what the deeper part leaves of the light, the lift of the shallower part */
  patch: { scale: number; speed: number; cut: number; mul: number; lift: number; soft: number };
  /** where the painting's own art-pixel grid starts, in scene px (the engine draws it 1.33 px off the world grid in x and y: measured on the first frame of five lands, always the same) */
  grid: { x: number; y: number };
  /** the darks never push the painting under this encoded brightness (0 to 1, after the hour's light): where it is already that dark they leave it */
  floor: number;
  /** the most the darks may take off at one pixel, in L* (the references' deepest step is 16.24): read from the painting's own brightness, the hour's light and the shade */
  maxStep: number;
};
export const STILL: StillNumbers = {
  /** the streaks: length along the gust, thickness across it, the drift in art px a second, and the tone cuts of the noise (3 tones) */
  streak: { along: 9, across: 1.6, speed: 2.5, dark: 0.32, light: 0.95, darkMul: 0.94, lightAdd: 0.0, fromShore: [1.5, 6] as const },
  /** the depth: how much of the picture's light the middle may lose at most, and the distance from the bank over which it does (the flat body of rounds 12 to 16, kept for `flatwater`).
   * Order v11, the ramp (waterfield.ts rampPixels): `deep` L* off at the deep end of a body of strength 1 (the owner's pond measures 5.4 shallow band to deepest decile, rampref.json), `lift` L* on in the
   * shallows (the bank's first `liftTo` art pixels fade it out: the references' shallow rim is the lightest), `turn` radians of blueward hue at the deep end (the pond's measures +7.5 degrees). */
  depth: { drop: 0.14, from: 2, to: 18, deep: 11.7, lift: 3.6, liftTo: 10, turn: 0.08,
    /** order v11b: the depth ramp's steps (3 before: `bands` equal steps of the ramp, edges dithered): a step of the ramp between two far apart bands read as a blotch (bar F7w) */
    bands: 4,
    /** order v11b: the water's hue family. A painted water bluer than the teal the owner's pond measures (HSV hue 173.6 deg) is pulled toward `to` degrees by `k` of the way (1 = all the way), at most `max` degrees;
     * water at or under `to` is left alone (the painting's own hue stays the base). */
    pull: { to: 172, k: 1, max: 14 },
    /** order v11b: the bright water of the high sun (uNoon, the sun's elevation: 0 at 17:30, 1 at 13:00) takes `k` of the L* it has above `from` off, at most `max` L* (the owner's pond at 13:00 is 5.3 L* lighter than the reference's; the evening is under `from` and untouched).
     * One shift for the whole body, so the depth ramp's shore-to-deep step (bar D1) does not move. */
    glare: { from: 42, k: 0.3, max: 3 } },
  /** the foam: width (breathing between lo and hi), the period of the breath, coverage noise cut, strength of the light it adds, lace one pixel out */
  foam: { lo: 0.9, hi: 2.1, period: 3.2, wave: 0.011, cut: 0.71, add: 0.4, lace: 0.55 },
  /** the wet band: its width behind the foam and round things, and what it leaves of the light */
  wet: { width: 2.2, mul: 0.93, thing: 2, thingMul: 0.93 },
  dash: { cell: 9, prob: 0.09, minLen: 2, maxLen: 6, speed: 1.2, add: 0.22, period: 6 },
  patch: { scale: 22, speed: 0.5, cut: 0.5, mul: 0.98, lift: 0.03, soft: 0.1 },
  grid: { x: 1.333, y: 1.333 },
  /** encoded brightness 0.126 is L* 12; the margin is for the light the estimate leaves out (normal map, a cast shadow) */
  floor: 0.19,
  maxStep: 11,
};

/**
 * The cut's dark outline lifted (after V5b, the east channel's vertical line, a painted outline 2 to 4 px wide at luma 0.2 against water at 0.33 to 0.5). The darks can only take light off, so the lights
 * pass adds back what the line lacks: a plate pixel under `hi` (encoded luma; fully lifted under `lo`), beside the seam band or in open water (`clear` art px from the shore and from any standing thing),
 * takes the mean of the plate round it (4 directions at each of `reach` px, pixels under `hi` left out), dimmed by the darks as the water there is. The pale rim the painter left 2 to 3 px off the line
 * (`rim` above the mean round it) is drawn down to that mean in the darks pass. The soft tone shift of the cut stays.
 */
export const OUTLINE_LIFT = { lo: 0.28, hi: 0.36, reach: [2, 5, 8], clear: 4, rim: 0.08, k: 1.0 } as const;

/** the fragment shader of both passes; `uPass` 0 writes the darks (a multiplier), 1 the lights (an addend) */
export function stillFs(S: StillNumbers): string {
  const DARK = `    // round 16: what stands in the water does not light a ring round it. The depth counted things like the bank, so the open water was darkened and the water within 16 art px of a rock was not: that was the ring.
    // Things now count at 1.7 times their distance and for a third of it, the shore as before; on the shadow side the thing counts as the shore, so the ring is broken there
    float ringK = mix(0.65, 1.0, smoothstep(0.1, 0.6, shade));
    float depth = (1.0 - uRamp) * ${S.depth.drop.toFixed(3)} * mix(smoothstep(${S.depth.from.toFixed(1)}, ${S.depth.to.toFixed(1)}, min(dS, dT * 1.7)), smoothstep(${S.depth.from.toFixed(1)}, ${S.depth.to.toFixed(1)}, dS), ringK);
    float m = 1.0 - depth;
    m *= 1.0 - (1.0 - ${S.streak.darkMul.toFixed(2)}) * darkS;
    m *= 1.0 - (1.0 - ${S.patch.mul.toFixed(2)}) * deepP;
    m *= 1.0 - (1.0 - ${S.wet.mul.toFixed(2)}) * wetS * (1.0 - foam);
    m *= 1.0 - (1.0 - ${S.wet.thingMul.toFixed(2)}) * wetT;
    // never into the dark: the painting's own brightness here, times the hour's light, is the most the darks may take off
    float lit = texture2D(uBase, uvA).r * toneY * (uLight.x + uLight.y + uLight.z) / 3.0 * dim;
    m = max(m, min(1.0, ${S.floor.toFixed(3)} / max(lit, 0.001)));
    // and never a step deeper than maxStep in L*: with the lightness of this pixel as L = 116 * Y^(1/3) - 16 and Y = lit^2.2, the darks scale Y by m^2.2
    float lcube = 116.0 * pow(max(lit, 0.001), 2.2 / 3.0);
    if (rip < 0.0) m *= max(pow(max(1.0 + rip / lcR, 0.0), 3.0 / 2.2), min(1.0, ${S.floor.toFixed(3)} / max(lit, 0.001))); // darker ripples keep the floor
    if (uRamp > 0.5) {
      // order v11: depth by geometry only (uBody: R the depth 0..1 from the bank to the body's own reach, G its strength, waterfield.ts rampPixels), in three bands with dithered edges.
      // The deep end takes deep x strength L* off the light and turns the hue a little toward blue; the shallows are lifted in the lights pass. The streaks' and patches' darks keep the shipped step cap, the depth is added to them.
      vec4 bd = texture2D(uBody, uvA);
      float dk = floor(bd.r * ${S.depth.bands.toFixed(1)} + 0.5 + (fract(52.9829189 * fract(dot(a, vec2(0.06711056, 0.00583715)))) - 0.5) * 0.5) / ${S.depth.bands.toFixed(1)};
      float deepL = ${S.depth.deep.toFixed(2)} * (0.5 + bd.g) * dk;
      vec3 p0 = texture2D(uPlate, outTexCoord).rgb; // the pixel's own colour, not its art cell's centre: a cell on a cut holds two tones, and the one tone's turn laid on the other draws a line
      vec3 pc = p0 * texture2D(uTone, outTexCoord).rgb; // the seam band (waterseam.ts): the light water takes the dark tone's colour toward the cut (it can only take light off); the depth's turn and drop then run on that colour, as they do on the dark water beside it
      vec3 tc = pc;
      float hh = degrees(atan(1.7320508 * (pc.g - pc.b), 2.0 * pc.r - pc.g - pc.b));
      hh += hh < 0.0 ? 360.0 : 0.0;
      float pull = radians(clamp(${S.depth.pull.k.toFixed(2)} * (hh - ${S.depth.pull.to.toFixed(1)}), 0.0, ${S.depth.pull.max.toFixed(1)}));
      float th = ${S.depth.turn.toFixed(3)} * dk - pull;
      vec3 nn = vec3(0.57735);
      tc = tc * cos(th) + cross(nn, tc) * sin(th) + nn * dot(nn, tc) * (1.0 - cos(th));
      tc *= pow(dot(pow(pc, vec3(2.2)), vec3(0.2126, 0.7152, 0.0722)) / max(dot(pow(max(tc, vec3(0.0)), vec3(2.2)), vec3(0.2126, 0.7152, 0.0722)), 0.00001), 1.0 / 2.2); // the turn keeps the luminance (linear light, so L* stays)
      float glareL = uNoon * clamp(${S.depth.glare.k.toFixed(2)} * (lcube - ${S.depth.glare.from.toFixed(1)}), 0.0, ${S.depth.glare.max.toFixed(1)});
      vec3 rc = max(tc, vec3(0.0)) / max(p0, vec3(0.004)) * pow(max(1.0 - (deepL + glareL) / lcube, 0.0), 3.0 / 2.2);
      darkOut = max(vec3(max(m, pow(max(1.0 - ${S.maxStep.toFixed(1)} / lcube, 0.0), 3.0 / 2.2))) * rc, vec3(min(1.0, ${S.floor.toFixed(3)} / max(lit, 0.001))) * texture2D(uTone, outTexCoord).rgb) * uHold; // the floor is of the painting's own colour: the seam band's tone is a dark water that already keeps it
    } else {
    m = max(m, pow(max(1.0 - ${S.maxStep.toFixed(1)} / lcube, 0.0), 3.0 / 2.2));
    darkOut = vec3(m) * uHold;
    }`;
  return `
#pragma phaserTemplate(shaderName)
precision highp float;
uniform sampler2D uField;
uniform sampler2D uShade;
uniform sampler2D uBase;
uniform sampler2D uBody;
uniform sampler2D uPlate;
uniform sampler2D uTone; // waterseam.ts: the share of the painting's colour the water keeps, per scene pixel (1 everywhere unless two painted tones meet on a hard cut)
uniform float uRamp;
uniform float uNoon; // 0 below sun elevation .5, 1 from .75 (fogform.ts burnOf): the high sun's glare on the bright water
uniform vec2 uSize;
uniform vec2 uGrid;
uniform float uArt;
uniform float uTime;
uniform float uPass;
uniform vec2 uWind;
uniform vec3 uLight;
uniform vec3 uHold; // look.ts waterHold: the excess of the night's colour taken back off the water (1 by day)
uniform vec3 uSun;
uniform vec2 uL;
uniform float uSparkle;
uniform float uWarm;
uniform float uLane;
uniform float uDark;
uniform float uMarks; // uDark without the old specks' switch: where the marks follow the lane and the shore
uniform float uFade;
uniform vec4 uUnit; // the quad's share of the scene in the shader's uv (x, y, w, h; y counted up from the scene's bottom edge): (0, 0, 1, 1) for the whole scene; a streamed land draws one quad per unit (V5b), its plate and tone the unit's own
varying vec2 outTexCoord;
const float TAU = 6.2831853;
vec2 unitUv(vec2 s) { return clamp((s - uUnit.xy) / uUnit.zw, 0.0, 1.0); }
float hash(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
// round 14 (switch darkmarks): ripples on dark water, signed L* step (asked 4 to 10, about 3 to 7 comes out on the dark water) of horizontal bands 1 to 3 rows thick; about one row in seven starts one, cut into pieces 15 to 54 long that drift with the gust
// round 15: a piece is 2 to 4 segments (gaps 2 to 6 art px), each fading in and out over its outer third; three in ten pieces step one row up or down once or twice along their length; three neighbouring tones, dithered by art pixel; strength asked 10 to 19 (was 4 to 10: the fades and gaps take about half the marked pixels), short segments (under 9 px) held to 11 so they do not read as specks
float ripSeg(vec2 a, vec2 W, float t, float yy, float d) {
  float x = a.x - W.x * t * 0.4 + 64.0 * hash(vec2(yy, 47.1));
  float cx = floor(x / 64.0);
  vec2 c = vec2(cx, yy);
  float len = 15.0 + floor(hash(c + 5.3) * 40.0);
  float p = x - cx * 64.0 - floor(hash(c + 11.7) * (65.0 - len));
  if (hash(c + 2.9) >= 0.85 || p < 0.0 || p >= len) return 0.0;
  float sg = hash(c + 6.1) < 0.5 ? -1.0 : 1.0;
  if ((hash(c + 4.4) < 0.3 ? sg * (step(len * (0.2 + 0.6 * hash(c + 3.3)), p) - (hash(c + 9.4) < 0.6 ? step(len * (0.2 + 0.6 * hash(c + 8.8)), p) : 0.0)) : 0.0) != d) return 0.0;
  float n = min(2.0 + floor(hash(c + 13.1) * hash(c + 13.7) * 3.0), floor(len / 7.0));
  float gap = min(2.0 + floor(hash(c + 17.3) * hash(c + 17.9) * hash(c + 18.3) * 5.0), floor((len - 5.0 * n) / (n - 1.0)));
  float sl = (len - gap * (n - 1.0)) / n;
  float q = p - floor(p / (sl + gap)) * (sl + gap);
  if (q >= sl) return 0.0;
  float tone = floor(clamp(3.0 * hash(vec2(floor(x / 5.0), yy + cx * 7.0)) + (hash(vec2(floor(x), yy + cx)) - 0.5) * 0.8, 0.0, 2.999));
  return min(10.0 + 9.0 * hash(c + 23.7), sl < 9.0 ? 11.0 : 16.0) * (0.85 + 0.075 * tone) * pow(clamp((min(q, sl - 1.0 - q) + 0.3) / (sl / 3.0), 0.0, 1.0), 1.5) * (hash(c + 31.1) < 0.5 ? -1.0 : 1.0);
}
float ripple(vec2 a, float t, vec2 W) {
  float r = 0.0;
  for (int k = 0; k < 3; k++) for (int d = -1; d <= 1; d++) {
    float yy = a.y - float(k) - float(d);
    if (hash(vec2(yy, 41.3)) < 0.15 && float(k) < 1.0 + step(0.7, hash(vec2(yy, 43.9)))) r += ripSeg(a, W, t, yy, float(d));
  }
  return clamp(r, -16.0, 16.0);
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
void main () {
  vec2 a = floor(((uUnit.xy + outTexCoord * uUnit.zw) * uSize + vec2(${S.grid.x.toFixed(3)}, ${S.grid.y.toFixed(3)})) / uArt);
  vec2 uvA = (a + 0.5) / uGrid;
  vec4 fd = texture2D(uField, uvA);
  float ident = uPass < 0.5 ? 1.0 : 0.0;
  if (fd.a < 0.5) { gl_FragColor = vec4(vec3(ident), 1.0); return; }
  float dS = fd.r * 255.0 / 4.0;
  float dT = fd.g * 255.0 / 4.0;
  float dA = fd.b * 255.0 / 4.0;
  float t = uTime;
  vec2 W = uWind;
  vec2 X = vec2(-W.y, W.x);
  float u = dot(a, W);
  float v = dot(a, X);
  // streaks: two noises long along the gust and thin across it, each carried by the gust, cut into three tones; weaker toward the bank, where the foam is
  float n1 = vnoise(vec2(u / ${S.streak.along.toFixed(1)} - t * ${(S.streak.speed / S.streak.along).toFixed(4)}, v / ${S.streak.across.toFixed(2)}) + 17.3);
  float n2 = vnoise(vec2(u / ${(S.streak.along * 0.55).toFixed(2)} - t * ${((S.streak.speed * 1.7) / (S.streak.along * 0.55)).toFixed(4)}, v / ${(S.streak.across * 0.6).toFixed(2)}) + 91.7);
  float n = 0.62 * n1 + 0.38 * n2;
  float sMid = smoothstep(${S.streak.fromShore[0].toFixed(1)}, ${S.streak.fromShore[1].toFixed(1)}, dA);
  float darkS = (n < ${S.streak.dark.toFixed(2)} ? 1.0 : 0.0) * sMid;
  float lightS = (n > ${S.streak.light.toFixed(2)} ? 1.0 : 0.0) * sMid;
  // foam: the width breathes on a swell that rolls along the shore; broken by a noise along it
  float swell = 0.5 + 0.5 * sin(TAU * (t / ${S.foam.period.toFixed(2)} + dot(a, vec2(1.0, 0.8)) * ${S.foam.wave.toFixed(4)}));
  float width = ${S.foam.lo.toFixed(2)} + ${(S.foam.hi - S.foam.lo).toFixed(2)} * swell;
  float nf = vnoise(a * 0.42 + vec2(0.0, t * 0.11) + 5.1);
  float broken = nf > ${S.foam.cut.toFixed(2)} - 0.1 * (swell - 0.5) ? 1.0 : 0.0;
  float foam = (dS <= width ? 1.0 : (dS <= width + 1.0 ? ${S.foam.lace.toFixed(2)} : 0.0)) * broken;
  float wetS = (dS > width && dS <= width + ${S.wet.width.toFixed(1)}) ? 1.0 : 0.0;
  float wetT = 1.0 - smoothstep(${(S.wet.thing - 1).toFixed(1)}, ${(S.wet.thing + 1.5).toFixed(1)}, dT); // round 16: the wet band round a thing fades over 2.5 art px instead of ending on a step
  // patches: slow broad noise cut into steps, carried by the gust; the deeper part takes a little light off, the shallower part gives a little back
  float np = vnoise(a / ${S.patch.scale.toFixed(1)} - W * t * ${(S.patch.speed / S.patch.scale).toFixed(4)} + 41.7);
  // order v11b: the patch edge is a soft step (width soft of the noise), not a cut: a cut patch of 22 art px reads as a dark blotch at midday (bar F7w)
  float deepP = smoothstep(${S.patch.cut.toFixed(2)} - ${S.patch.soft.toFixed(2)}, ${S.patch.cut.toFixed(2)} + ${S.patch.soft.toFixed(2)}, np) * sMid;
  float liftP = (1.0 - smoothstep(${(S.patch.cut - 0.28).toFixed(2)} - ${S.patch.soft.toFixed(2)}, ${(S.patch.cut - 0.28).toFixed(2)} + ${S.patch.soft.toFixed(2)}, np)) * sMid;
  // dashes: one art pixel thick, horizontal, 2 to ${S.dash.maxLen} long, drifting with the gust and each on its own slow life
  // round 12 (switch sunlane, uLane 0 = today): at a low sun the dashes crowd into a lane along the sun's screen direction, about the same count (the lane takes up to 1.8 times, the rest 0.1)
  vec2 pnL = (a * uArt - 0.5 * uSize) / uSize.y * vec2(1.0, -1.0); // the quad's y runs up: the sun's screen direction (y down, as the world gives it) needs the flip
  vec2 LsL = normalize(uL);
  float inLane = 1.0 - smoothstep(0.14, 0.22, abs(pnL.x * LsL.y - pnL.y * LsL.x));
  float laneK = 1.0 + uLane * (inLane * 0.8 - (1.0 - inLane) * 0.9);
  // round 13 (switch darkmarks, uMarks 0 = today): bright marks live in the sun's lane (12 art px either side of the line) and at the shore; open water darker than L* 35 gets none
  float perpA = pnL.x * LsL.y - pnL.y * LsL.x;
  float laneD = 1.0 - smoothstep(10.0, 16.0, abs(perpA) * uSize.y / uArt);
  // the painting's brightness here as the seam band leaves it (waterseam.ts): the light water drawn down to the dark tone is judged, for its floor and its depth, as the dark water it now is
  float toneY = dot(texture2D(uTone, outTexCoord).rgb, vec3(0.2126, 0.7152, 0.0722));
  float litD = texture2D(uBase, uvA).r * toneY * (uLight.x + uLight.y + uLight.z) / 3.0;
  float markK = mix(1.0, max(max(laneD, 1.0 - smoothstep(4.0, 8.0, dA)), 0.2 * smoothstep(0.30, 0.40, litD)), uMarks); // round 14: open bright water keeps a fifth of the marks, the lane and the edges all of them
  vec2 dq = vec2(a.x - W.x * t * ${S.dash.speed.toFixed(2)}, a.y);
  float dcx = floor(dq.x / ${S.dash.cell.toFixed(1)});
  float dh = hash(vec2(dcx, dq.y) + 3.1);
  float dlen = ${S.dash.minLen.toFixed(1)} + floor(hash(vec2(dcx, dq.y) + 9.7) * ${(S.dash.maxLen - S.dash.minLen + 1).toFixed(1)});
  float doff = floor(hash(vec2(dcx, dq.y) + 17.3) * (${S.dash.cell.toFixed(1)} - dlen + 1.0));
  float dpos = dq.x - dcx * ${S.dash.cell.toFixed(1)};
  float dlife = sin(TAU * (t / ${S.dash.period.toFixed(1)} + hash(vec2(dcx, dq.y) + 5.5)));
  float dash = (dh < ${S.dash.prob.toFixed(3)} * laneK * markK && dpos >= doff && dpos < doff + dlen && dlife > 0.2 ? 1.0 : 0.0) * sMid;
  float shade = texture2D(uShade, unitUv((a + 0.5) * uArt / uSize)).a; // the quad's own copy of the shadows (a unit's, or the whole land's)
  float dim = 1.0 - 0.8 * uFade / 0.45 * shade;
  float rip = ripple(a, t, W) * uDark * sMid * (1.0 - smoothstep(0.30, 0.40, litD)); // round 14: only on water darker than about L* 35
  if (rip < 0.0 && litD * dim < ${S.floor.toFixed(3)}) rip = -rip; // the floor forbids darkening this water: that piece is a lighter one
  float lcR = 116.0 * pow(max(litD * dim, 0.001), 2.2 / 3.0);
  vec3 darkOut = vec3(1.0); // what the darks pass leaves of this pixel (a multiplier); the lights pass recomputes it for the outline lift
  if (uPass < 0.5) {
${DARK}
    // the bright pixels the outline's painter left beside it (a pale rim 2 to 3 px off the dark line) are drawn down to the mean of the water round them, so the lift of the dark line does not leave a light seam in its place
    {
      float yo = dot(texture2D(uPlate, outTexCoord).rgb, vec3(0.2126, 0.7152, 0.0722));
      float sumY = 0.0;
      float nY = 0.0;
      float darkN = 1.0;
      float bandN = 1.0;
      for (int r = 0; r < 4; r++) {
        float rr = r == 0 ? 3.0 : r == 1 ? ${OUTLINE_LIFT.reach[0].toFixed(1)} + 3.0 : r == 2 ? ${OUTLINE_LIFT.reach[1].toFixed(1)} + 1.0 : ${OUTLINE_LIFT.reach[2].toFixed(1)};
        vec2 st = rr / (uSize * uUnit.zw);
        for (int k = 0; k < 4; k++) {
          vec2 o = st * (k == 0 ? vec2(1.0, 0.0) : k == 1 ? vec2(-1.0, 0.0) : k == 2 ? vec2(0.0, 1.0) : vec2(0.0, -1.0));
          float yn = dot(texture2D(uPlate, outTexCoord + o).rgb, vec3(0.2126, 0.7152, 0.0722));
          if (r == 0) darkN = min(darkN, yn);
          if (r == 2) { vec3 tn = texture2D(uTone, outTexCoord + o).rgb; bandN = min(bandN, min(tn.r, min(tn.g, tn.b))); }
          sumY += yn;
          nY += 1.0;
        }
      }
      float meanY = sumY / nY;
      if (darkN < ${OUTLINE_LIFT.lo.toFixed(2)} + 0.04 && yo > meanY + ${OUTLINE_LIFT.rim.toFixed(2)} && (bandN < 0.99 || (dS > ${OUTLINE_LIFT.clear.toFixed(1)} && dT > ${OUTLINE_LIFT.clear.toFixed(1)}))) darkOut *= clamp(meanY / max(yo, 0.01), 0.55, 1.0);
    }
    gl_FragColor = vec4(darkOut, 1.0);
    return;
  }
  // the sun's road across the frame toward the sun, glints in it as art-pixel cells carried by the gust, each on its own slow clock
  vec2 pn = (a * uArt - 0.5 * uSize) / uSize.y * vec2(1.0, 1.0 - 2.0 * uMarks); // darkmarks: the quad's y runs up, the sun's direction is y down
  vec2 Ls = normalize(uL);
  float perp = pn.x * Ls.y - pn.y * Ls.x;
  float road = exp(-pow(perp / 0.32, 2.0)) * (0.55 + 0.45 * smoothstep(-0.6, 0.6, dot(pn, Ls)));
  vec2 ra = a - W * 2.1 * t;
  vec2 cell = floor(ra / vec2(1.0 + 2.0 * uMarks, 1.0)); // darkmarks: a glint is a run of 3 px along the row
  float ph = hash(cell) * 7.0 + t * 0.55;
  float fire = step(1.0 - (0.004 + 0.035 * uSparkle) * laneK * markK, hash(cell + floor(ph) * 3.7)) * sin(3.14159 * fract(ph));
  float mean3 = (uSun.x + uSun.y + uSun.z) / 3.0;
  vec3 glint = vec3(mean3) + (uSun - vec3(mean3)) * mix(0.25, 0.9, uMarks);
  // a dash is lighter than the water it lies on by about the same share on dark water as on bright: what it adds follows the painting's brightness here (on the dark bone-moor water the flat add read as snow)
  float keep = clamp(0.15 + 1.4 * texture2D(uBase, uvA).r * toneY * (uLight.x + uLight.y + uLight.z) / 3.0, 0.0, 1.0);
  vec3 add = uLight * (${S.streak.lightAdd.toFixed(3)} * lightS + (${S.dash.add.toFixed(3)} * dash + ${S.patch.lift.toFixed(3)} * liftP) * keep + ${S.foam.add.toFixed(3)} * foam) * dim;
  // the lane's dashes take the hour's sun colour by half (a dash on the sun's road is the sun's light)
  add += uLight * (uSun / max(mean3, 0.001) - 1.0) * 0.5 * ${S.dash.add.toFixed(3)} * dash * keep * dim * uLane;
  add += uLight * (uSun / max(mean3, 0.001) - 1.0) * 0.9 * ${S.dash.add.toFixed(3)} * dash * keep * dim * uMarks; // darkmarks: the dash is the sun's colour
  if (rip > 0.0) add += texture2D(uPlate, unitUv(uvA)).rgb * texture2D(uTone, outTexCoord).rgb * uLight * (pow(1.0 + rip / lcR, 3.0 / 2.2) - 1.0) * dim; // lighter ripples: the water's own colour, brighter by rip L*
  // order v11: the shallows are the lightest part of a body: the bank's own distance (not what stands in the water, round 16's ring) lifts the water's own colour by lift L* x the body's strength, fading out over the first liftTo art px
  if (uRamp > 0.5) add += texture2D(uPlate, unitUv(uvA)).rgb * texture2D(uTone, outTexCoord).rgb * uLight * (pow(1.0 + ${S.depth.lift.toFixed(2)} * (0.5 + texture2D(uBody, uvA).g) * (1.0 - smoothstep(1.0, ${S.depth.liftTo.toFixed(1)}, dS)) / lcR, 3.0 / 2.2) - 1.0) * dim;
  // the cut's own dark outline (see OUTLINE_LIFT): a pixel of the painting darker than the outline's luma is lifted to the water round it, as the band leaves that water. The darks can only take light off, so the lift is an addend, lit as the ripples are
  {
    vec3 p0 = texture2D(uPlate, outTexCoord).rgb;
    float wl = 1.0 - smoothstep(${OUTLINE_LIFT.lo.toFixed(2)}, ${OUTLINE_LIFT.hi.toFixed(2)}, dot(p0, vec3(0.2126, 0.7152, 0.0722)));
    if (wl > 0.0) {
      vec3 sum = vec3(0.0);
      float band = 1.0;
      float n = 0.0;
      for (int r = 0; r < 3; r++) {
        float rr = r == 0 ? ${OUTLINE_LIFT.reach[0].toFixed(1)} : r == 1 ? ${OUTLINE_LIFT.reach[1].toFixed(1)} : ${OUTLINE_LIFT.reach[2].toFixed(1)};
        vec2 st = rr / (uSize * uUnit.zw);
        for (int k = 0; k < 4; k++) {
          vec2 o = st * (k == 0 ? vec2(1.0, 0.0) : k == 1 ? vec2(-1.0, 0.0) : k == 2 ? vec2(0.0, 1.0) : vec2(0.0, -1.0));
          vec3 tn = texture2D(uTone, outTexCoord + o).rgb;
          if (r > 0) band = min(band, min(tn.r, min(tn.g, tn.b)));
          vec3 pn = texture2D(uPlate, outTexCoord + o).rgb;
          float w = step(${OUTLINE_LIFT.hi.toFixed(2)}, dot(pn, vec3(0.2126, 0.7152, 0.0722))); // a neighbour on the outline itself does not count
          sum += pn * tn * w;
          n += w;
        }
      }
      if (n > 0.5 && (band < 0.99 || (dS > ${OUTLINE_LIFT.clear.toFixed(1)} && dT > ${OUTLINE_LIFT.clear.toFixed(1)}))) {
        // the water round the line is dimmed by the darks pass as this pixel is, so what the line lacks is lacked in that dimmed light
        { ${DARK} }
        add += max(sum / n - p0 * texture2D(uTone, outTexCoord).rgb, vec3(0.0)) * darkOut * wl * uLight * dim * ${OUTLINE_LIFT.k.toFixed(2)};
      }
    }
  }
  add += fire * (0.35 + 1.6 * uSparkle) * (0.4 + 0.9 * road) * 0.5 * glint * dim * sMid;
  add += uSun * uWarm * road * 0.03 * dim * sMid;
  gl_FragColor = vec4(add, 1.0);
}`;
}

/** the fragment shader of both passes with the numbers of STILL */
export const STILL_FS = stillFs(STILL);

/** the facts of a scene the water needs, read from the mount (painted.ts) */
export interface StillScene {
  width: number;
  height: number;
  /** the land's own factor on the depth ramp (scene.json water.slope), absent = 1 */
  water?: { slope?: number };
  objects: readonly { kind: string; river: boolean; x0: number; y0: number; w: number; h: number; sx: number; sy: number }[];
  sheet: { w: number; h: number };
}

/** The field from the scene's water mask (an image whose green is 255 on water) and the opaque pixels of the standing things. */
/** scene pixels along the frame's border that the exporter leaves out of the water bed (measured: 3 on every land) */
export const BED_EDGE = 3;

/** a piece's alpha, `w` x `h` (0 to 255), by its index in the scene's objects: read from the whole sheet (sheetAlphaOf) or from a streamed land's alpha atlas */
export type PieceAlpha = (k: number) => Uint8Array | Uint8ClampedArray;

/** Each piece's alpha read from the whole sheet's RGBA. */
export function sheetAlphaOf(scene: Pick<StillScene, 'objects' | 'sheet'>, sheetRgba: Uint8ClampedArray): PieceAlpha {
  const cache = new Map<number, Uint8Array>();
  return (k) => {
    let a = cache.get(k);
    if (a) return a;
    const o = scene.objects[k]!;
    a = new Uint8Array(o.w * o.h);
    for (let r = 0; r < o.h; r++) for (let c = 0; c < o.w; c++) a[r * o.w + c] = sheetRgba[((o.sy + r) * scene.sheet.w + o.sx + c) * 4 + 3] ?? 0;
    cache.set(k, a);
    return a;
  };
}

export function stillFieldOf(scene: StillScene, bedRgba: Uint8ClampedArray, alphaOf: PieceAlpha, art: number, plate?: Uint8ClampedArray): WaterField {
  const mask = new Uint8Array(scene.width * scene.height);
  for (let i = 0; i < mask.length; i++) mask[i] = bedRgba[i * 4 + 1]! >= 128 ? 1 : 0;
  if (plate) addMissedWater(mask, plate, scene.width, scene.height); // a flat patch of painted water the bed left out (waterseam.ts)
  fillEdge(mask, scene.width, scene.height, BED_EDGE);
  const things: Footprint[] = [];
  scene.objects.forEach((o, k) => {
    if (!o.river || (o.kind !== 'rock' && o.kind !== 'snag' && o.kind !== 'structure')) return;
    const al = alphaOf(k);
    const opaque = new Uint8Array(o.w * o.h);
    for (let i = 0; i < opaque.length; i++) opaque[i] = (al[i] ?? 0) >= 128 ? 1 : 0;
    things.push({ x0: o.x0, y0: o.y0, w: o.w, h: o.h, opaque });
  });
  return waterFieldOf(mask, scene.width, scene.height, art, things);
}

/** What the still water's passes read, baked once from the whole land (the mount at build, or a streamed land's exporter): the field, the painting's brightness, the depth ramp, and the seam band's tone. */
export interface StillBake {
  field: WaterField;
  /** whether the land has any water */
  any: boolean;
  /** the field, the base and the ramp as the shader reads them, RGBA at the field's grid (field.w x field.h) */
  fieldRgba: Uint8ClampedArray;
  baseRgba: Uint8ClampedArray;
  rampRgba: Uint8ClampedArray;
  /** art pixels on a hard cut between two painted tones (waterseam.ts) */
  seam: number;
  /** the seam band's tone at scene resolution (scene.width x scene.height), when the land has a cut */
  tone?: Uint8ClampedArray;
}

export function stillBake(scene: StillScene, bedRgba: Uint8ClampedArray, alphaOf: PieceAlpha, plate: Uint8ClampedArray, art: number): StillBake {
  const field = stillFieldOf(scene, bedRgba, alphaOf, art, plate);
  const any = field.water.some((v) => v === 1);
  const empty = new Uint8ClampedArray(0);
  if (!any) return { field, any, fieldRgba: empty, baseRgba: empty, rampRgba: empty, seam: 0 };
  const fieldRgba = fieldPixels(field);
  // the painting's own brightness per art pixel (its ground plate, unlit), for the darks' floor
  const baseRgba = baseLumaPixels(plate, scene.width, scene.height, art, field.w, field.h);
  const rampRgba = rampPixels(field, scene.water?.slope ?? 1);
  // the seam band (waterseam.ts): the multiplier is white where no two painted tones meet on a hard cut, so a land without one draws as before
  const toned = seamPixels(plate, scene.width, scene.height, art, field.water, field.w, field.h);
  const tone = toned.seam ? toneAtScene(toned.rgba, toned.fixed, field.w, plate, scene.width, scene.height, art, STILL.grid) : undefined;
  return { field, any, fieldRgba, baseRgba, rampRgba, seam: toned.seam, tone };
}

const mulHold = (a: readonly number[], b: readonly number[]): [number, number, number] => [a[0]! * b[0]!, a[1]! * b[1]!, a[2]! * b[2]!];

/** What the passes read of the hour: the flat ground light, the sun, its direction, and the glint's and warm road's strengths (the table's `spec` and the sun's warmth). */
export function stillLightOf(l: GroundLight & { spec: number; L3: readonly number[]; wind?: { x: number; y: number } }): { light: [number, number, number]; hold: [number, number, number]; sun: [number, number, number]; dir: [number, number]; wind: [number, number]; sparkle: number; warm: number; noon: number; lane: number } {
  return { light: groundLightOf(l).flat, hold: mulHold(waterHold(l.amb), waterHoldTwilight(l)), sun: [l.sun[0], l.sun[1], l.sun[2]], dir: [l.L3[0]!, l.L3[1]!], wind: [l.wind?.x ?? DEFAULT_WIND.x, l.wind?.y ?? DEFAULT_WIND.y], sparkle: sparkleOf(l), warm: warmthOf(l), noon: burnOf(l.elev), lane: 1 - Math.min(1, Math.max(0, (l.elev - 0.5) / 0.22)) };
}

export { fieldPixels };
