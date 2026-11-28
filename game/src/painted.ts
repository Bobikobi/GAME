/**
 * A trial mount, dev only (`?debug&painted=<id>`, DECISIONS 2026-11-09): track 2's composition (colour by code) as the land of a real
 * Session, read by the real scene. Its pieces are laid over a strip of new tiles added east of the valley, in memory only, so the
 * game's own map, pockets and quests stand as they are and content/core/map.json is untouched.
 *
 * Everything on it is the unlit art and the engine lights it: one sun (a far light of the renderer, over the pieces' relief as
 * normal maps) with the numbers of the standard (`hours` in the scene file), the shadow pass as a multiply that takes the sun away,
 * and the water drawn by its own shader. Nothing is lit in advance. Moving things are never painted: wind leans the pieces, the
 * figure and the animal walk on the walk map.
 *
 * `hold=` freezes single moving things for a measurement: wind, water, air (motes, birds, mist, everything that is not the scene),
 * clock, shadow (off), fog (the fog's own clock); `nofog` hides the fog and `fogmap` draws its density as grey, for the measures. Nothing here runs without the query.
 * Round 11 to 15 water switches, DEFAULT ON since the owner's yes (16.11): the lit fog (`oldfog` brings the first fog program back), the still water's depth ramp (`flatwater` turns it off) and the dark-water marks and ripples (`plainmarks` turns them off); `snow` brings the old water specks back (a switch for a snow or light-mote atmosphere later). Proof switch `noburn` turns the high sun's burning-off of the thin fog off (fogform.ts FOG_BURN). Proof switches, off by default: `fogland` (a land whose
 * hours say no fog gets the bone moor's noon numbers, for a measure), `nobands` (a streamed land's textures go up whole, as before B3, for the stills that compare the two), `copyrelief` (bands on, the relief copied into its colour's normal map instead of shared), and for the lit fog's inputs drawn as grey with `fogmap`: `fogwall`, `fogground`, `foglow` (the low ground), `fogy` (the row), `fogrow` (the land's own density by row).
 */
import { PREVIEW_QUERY, baseOf, presenceOf, zoomOf } from './painted-presence';
import { type Disc, trunkDiscsOf } from './walking';
import * as Phaser from 'phaser';
import { takesHour } from './kitart';
import type { Bundle, MapDef } from '@game/kernel';
import { DEFAULT_WIND, TILE_PX, leanNow, leanSignal, type Wind } from './wind';
import { groundLightOf, waterLook, FOAM, gust, FOG_CLEAR, FOG_LAYERS, fogColour, fogLetThrough, FOG_NOISE, fogNoise, fogNoiseSteps, sparkleOf, warmthOf, type FogData } from './look';
import { GrassPass, installGrass } from './painted-grass';
import { litAt, lightRowsOf, shadeTint, worldOf } from './painted-table';
export { litAt, lightRowsOf };
import haloData from './painted-halo.json';
import { sunAt, sunTableOf } from './cast';
import { clusterRects, standingReach, standingRegionSteps, type Rect, type RegionBuffers, type Standing } from './standing';
import { decodeFootLine, footLineOk, type FootLine, type SheetPixels } from './painted-depth';
import { FrontCut, frontStats } from './painted-front';
import { StillWater, type StillBaked } from './waterstill-layers';
import { inflateBlob } from './baked';
import { BROWSER_EARLY, EarlyImages } from './early-fetch';
import { PaintedStream, STREAM, layerKey, type StreamLayerMeta, type StreamUnitMeta, type WindSheets } from './painted-stream';
import { GROUND_COVER, castPad, flatNormals, leanCopy, leanOf, fogUp, pieceLean, risesOutOfFog, windLayout } from './painted-wind';

export { GROUND_COVER, leanOf };
import { FOG_BURN, FOG_EVEN, FOG_FORM, FOG_HOLLOW, burnOf, fogSkyOf, lownessOf } from './fogform';
import { distanceTo } from './waterfield';
import { linkOf, piecesOf, walkableCell } from './painted-link';
import { CANOPY, COVER, coverAt, coverBake, coverBakeSteps, coverDeep, coverMasks, isMassPiece, type CoverMasks } from './painted-cover';
import { FIGURE_ART_H, SOLE_BELOW_BOTTOM, aimAlpha, paintedCameraZoom, phoneCameraZoom, bottomRow, easeAlpha, feetOffset, lstar, median } from './contact.js';

/** the layers of a river course's water (the river shader's); a still-water land loads none of them */
export const RIVER_LAYERS = ['water', 'water-d', 'water-refl', 'flow-s', 'flow-n'] as const;

const T = 16;
const ART = 4;
/** the fog's noise tile, texels a side (the cap on its density is in fogform.ts) */
const NOISE_SIZE = FOG_NOISE.size;
/** the longest a streamed land holds her step at an unlit unit's edge, ms (the maze peek's hold) */
const HOLD_MAX = 3000;
/** how many leaning pieces of a unit take their wind frames in one frame (bakeUnitWind): the split valley has up to 190 */
const WIND_HAND = 24;
/**
 * The most rows a streamed layer's texture takes in one frame once the land is lit (B3, private #44 H): a 1280 x 896 layer went up in one texImage2D of 8 to 12 ms, its relief in
 * 20 to 40 (a second copy for the colour's normal map); in bands of rows each frame's share is a quarter.
 */
const BAND_ROWS = 256;

/** what the renderer offers for laying pixels into a texture's own storage (as painted-front's uploadDirect does) */
type BandGL = {
  gl?: WebGLRenderingContext;
  glTextureUnits?: { bind(t: unknown, u: number): void };
  glWrapper?: { updateTexturing(o: unknown): void };
  createTextureFromSource?(source: null, w: number, h: number, scaleMode: number, forceClamp?: boolean, flipY?: boolean): BandTex;
};
/** Phaser's pool of framebuffers, keyed by exact size (renderer.drawingContextPool) */
type CtxPool = { setMaxAge(ms: number): void; get(w: number, h: number): { release(): void } };
type BandTex = { flipY: boolean; pma: boolean; width: number; height: number; pixels: unknown; update(...a: unknown[]): void; generateMipmap(): void; destroy(): void };
/**
 * What each fog layer's stated speed (look.ts FOG_LAYERS) is multiplied by in the shader. The live engine measured the big bank at 55 frame px a second
 * where the table says 19 (6 s for a quarter of the frame, look lane v10, 16.11, by the best shift of the band-passed density over 4 and 8 s), so the
 * bank is slowed to the stated pace; the middle layer and the wisps keep more of their speed, so two frames a second apart still differ over much of the fog.
 * The cause of the gap is not found.
 */
const FOG_PACE = [0.28, 0.45, 0.8] as const;
/**
 * The river world's fog moves faster than the table's pace above (V5c, F2): a valley's banks at 5 scene px a second crossed a quarter of the phone's screen in 40 s, where the
 * bar says 10 to 20. Per layer, times the pace above (the bank 0.55 and the wisp layer 0.6 of the stated speed, so 10 and 16 px a second); the undead world's fog keeps its measured pace.
 */
const FOG_PACE_RIVER = [0.85, 0.6, 0.6] as const;

export interface PaintedHour {
  L: [number, number];
  elev: number;
  amb: [number, number, number];
  sun: [number, number, number];
  /** the shadow's lean and length (the placer's sl and sq) */
  sl: number;
  sq: number;
  /** how much of the sun a shadow takes */
  al: number;
  wall: number;
  spec: number;
  /** how thick the land says its fog lies at the bottom and at the top of the frame in this hour; none: no fog (the colour is the hour's light, never the land's) */
  fog?: FogData;
}

/** A row of a world's light table (painted-light.json): the hour's fields at a minute of the day, how it was made, whether the sun is up, and the evening's two small numbers that were constants of the engine */
export interface LightRow extends PaintedHour {
  minute: number;
  state: 'tuned' | 'untuned' | 'proposal' | 'tuned on the column 12.11';
  sunUp: boolean;
  /** the share of the sun moved into the ambient (the evening's fill) and the lamp's loss (was FILL x evening and SHIFT x evening) */
  fill: number;
  shift: number;
  /** the depth of the cover's shade at this hour (the power the shadow's tint is taken to, painted-cover.ts `coverDeep`); none: the engine's rule of the sun's height. The painted hour of a world names the number that gives the painting's own floor back. */
  cover?: number;
  /** the warmth of the shadows at this hour (private #44 B, rule L3): per channel, what a full shadow's tint is multiplied by, so a sunset's shadow turns red-brown instead of cool. Read only by the shadow's tint (`shadeTint`), never by the ambient (V5c: warming the ambient broke the water's hue). none: [1, 1, 1] */
  warm?: [number, number, number];
  /** the wind at this hour, a column per season: [x, y, speed (tiles a second), k] (wind.ts); none: the engine's own */
  wind?: Record<string, [number, number, number, number]>;
}

export interface Lit {
  amb: [number, number, number];
  sun: [number, number, number];
  L3: [number, number, number];
  elev: number;
  sl: number;
  sq: number;
  al: number;
  wall: number;
  spec: number;
  fill: number;
  shift: number;
  /** the cover shade's depth now when a row of the table names one, else none (the rule of the sun's height) */
  cover?: number;
  /** the shadow's warmth now (the table's `warm`, [1, 1, 1] when a row names none) */
  warm: [number, number, number];
  /** the wind now (the table's `wind`, its season column) */
  wind: Wind;
  fog?: FogData;
}

export interface PaintedObject {
  i: number;
  kind: string;
  x0: number;
  y0: number;
  fx: number;
  fy: number;
  w: number;
  h: number;
  /** its place on the sheet */
  sx: number;
  sy: number;
  river: boolean;
  /** a part of the wood's mass cut by ground line: treated as the mass (no shadow of its own), see isMassPiece */
  masspart?: boolean;
  /** a building, ruin or arch that can be entered: the scene px of its door (W5); `closed` is a roofed body named by the card, which nothing enters */
  door?: [number, number];
  closed?: boolean;
}

interface LynxStrip {
  frames: number;
  file: string;
  low: number;
}

export interface PaintedScene {
  id: string;
  cell: number;
  cols: number;
  rows: number;
  width: number;
  height: number;
  hours: Record<'1300' | '1730', PaintedHour>;
  /** the world the land belongs to: its light table in painted-light.json (a scene without one is the river's) */
  hourset?: string;
  cells: string[];
  /** the trunk feet that refuse the body at art-pixel precision: [x, y, r] in scene px, one per tree (walking.ts Disc). A land without the field walks on its cells alone; with it, a wood's cells are open and each trunk is a disc. */
  feet?: [number, number, number][];
  sheet: { w: number; h: number };
  objects: PaintedObject[];
  /** the join's foot-line map (footline.png: red the high byte, green the low byte of each pixel's foot row), when the mount has one: the figure's depth against the mass is then tested per pixel */
  footline?: { w: number; h: number; max: number; probe: [number, number, number] };
  river: { sLength: number; width: number; sTop: number; nTop: number };
  /** round 12, optional: how thick the fog lies in this land's frame (look.ts FogData numbers) when the switch `fogland` asks for fog on a land whose hours say none; absent = the bone moor's noon numbers */
  fogland?: { bottom: number; top: number };
  /** order v11, optional: the land's own word on how deep its water runs, a factor on the geometry's depth (waterfield.ts RAMP): below 1 shallower, above 1 deeper; absent = 1 */
  water?: { slope?: number };
  /** the land's units when it streams (written by the exporter); absent for a land laid whole */
  tiles?: PaintedTiles;
}

interface WorldShape extends Phaser.Scene {
  player: Phaser.GameObjects.Sprite;
  body: { x: number; y: number; moving: boolean; place(t: readonly [number, number]): void };
  noCast: Set<Phaser.GameObjects.GameObject>;
  veil?: Phaser.GameObjects.Container;
  lights: Phaser.GameObjects.LightsManager;
  cast?: {
    add(image: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite, layer: 'under' | 'standing', mode: 'drawn' | 'rest' | 'moving', body?: boolean): unknown;
    multiply?: { tint: number; blur: number };
    weaken?: (x: number, y: number) => number;
    canvasBox(): { x: number; y: number; w: number; h: number } | undefined;
    /** the caster an image was registered as (a streamed land's leaning piece turns to its rest frame once its unit's wind is baked) */
    of(image: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite): { mode: 'drawn' | 'rest' | 'moving' } | undefined;
    version: number;
  };
}

interface SessionShape {
  pos: [number, number];
  tick: number;
  facing: string;
  state: { player: { at: [number, number]; race?: string } };
  report: (at: readonly [number, number], again?: boolean, gait?: never) => void;
}

/** the hours the standard was lit at, in minutes of the day */
const NOON = 780;
const EVENING = 1050;

const FIGURE = { walk: 'painted:figure', idle: 'painted:figure_idle' } as const;
const FIGURE_ANCHOR: [number, number] = [64, 90];
/** art px walked per pose, measured on the sheets by the animation lane (slim_jog/measures.json `travelPerPose`) */
const TRAVEL = { down: 13.561, left: 23.666, up: 13.586 } as const;
/** the ground's lightness (0-1) under the feet below which the figure's edge is a lifted rim and above which it is a dark line */
const EDGE_SPLIT = 0.3;
/** the drawn sole of the figure's frame, in frame pixels from its top (the sheets' feet sit 4.7 px under the anchor) */
const FIGURE_SOLE = 94.7;
/**
 * The figure's contact patch (DECISIONS 2026-10-18, shadows C): an ellipse under the feet in the shadow's ink, multiplied in, so the figure
 * stands on the ground and not over it. Art pixels. Shape 13 x 3 (rx 6, ry 1), centred on the drawn feet; the strength follows the ground:
 * the band under the feet is aimed at the ring's median L* minus `aim`, nothing is drawn where the ground is already `skip` under the ring,
 * `alpha` is the clamp (figure presence, step A, 11.11).
 */
const CONTACT = { rx: 6, ry: 1, alpha: 0.75, tint: 0x1b1a2e, dy: 1.5, adapt: 1, aim: 10.5, skip: 8, cover: 0.7 };
/** the ring round the figure the patch is measured against, in art pixels (one figure height) */
const CONTACT_RING = FIGURE_ART_H;
/** An object drawn in front of the figure counts as covering it when this many of her silhouette's sample points (SEE_SAMPLE) lie on its opaque pixels (see-through) */
const SEE_THROUGH = { cover: 2 } as const;
/**
 * See-through follows the figure (figure presence, S1-S4, M1): an object in front of the figure is thinned only inside a capsule that is the
 * figure's own size (`figW` x `figH` art px) grown by `grow` art px (3 first; 1 is the widest that keeps M1 under 20,000: 22.7k, 21.0k, 19.3k at old wood 6-10) on every side, taking `fade` of the object there, then falling off on a
 * straight ramp `edge` art px wide to nothing (0.95 over 8.5 px is 11.2 percent per art px; a 4 px edge would step 24 percent, which S2 refuses).
 * The mask is a filter of the object's own sprite, only while it covers the figure, centred on the figure's middle so a walking figure carries it.
 * History: a round of radius 46 with a flat middle of 23 art px (11.11 19:40) showed as a pale oval of rock twice the figure's width at high rock 10-2. */
const SEE_LOCAL = { fade: 0.95, figW: 15, figH: 52, grow: 1, edge: 8.5, perMs: 1 / 150 } as const;
/**
 * The figure's own drawn height (rows of its idle sheet, the median over the frames) that SEE_LOCAL's figW x figH, the halo's shape and the cover
 * points were tuned at: the slim sheet re-drawn to the game's height (the stand-in scenes at 0.55 draw 52). A scene's sheet can be drawn at another
 * height (the look lane's unscaled export is 93); every one of those numbers then scales by drawn / this, so the window lies on the figure as drawn
 * in that scene (2026-11-12, the strip 2c: a 52 px window on a 93 px figure left her head and chest under the crown). At the tuned height the scale is 1.
 */
const FIG_REF_ROWS = 52;
/** Her front windows: the box round the drawn figure (art px: width, room above and below the figure) and the slack a window keeps round that box so walking does not cut it again at every step. */
/** how far (art px) beside a low bush's box her foot is still counted as beside it, not in it: her body's half width plus a step */
const LOW_REACH = 16;
/** how far under her depth the lowest thing that follows her sits (her contact shadow at 0.6; the rim copies at 0.5): a bush she stands in front of sorts under all of it */
const STACK_UNDER = 0.65;
/** world px of room round the camera's view for a window to count as seen (the view is last frame's; a run moves the camera a few px a frame) */
const VIEW_MARGIN = 16;
const FRONT_BOX = { w: 48, pad: 6, slack: 14 } as const;
/** the spacing (art px) of the points on her drawn silhouette that decide whether a piece in front covers her, and how many of them it must lie on (the old fifteen
 * points on a 3 x 5 grid left a piece over her chest at 2 points, and the window shut: old wood 12,6 on bar V). */
const SEE_SAMPLE = 3;
const IDLE_MS = 625;
const IDLE_POSES = 4;

const ANIMAL_MS = 520;
const ANIMAL_POSE_MS = 100;
const ANIMAL_IDLE_MS = 500;
const ANIMAL_SIZE = 128;

/** a blade's bend away from the walker: the ellipse it reaches (scene px), how fast it goes over and how fast it comes back (s) */
const BEND = { rx: 64, ry: 40, over: 0.07, back: 0.2 } as const;
/** a shadow takes this much of the sway off a blade, at most */
const SHADE_SWAY = 0.6;

export { gust, leanNow, leanSignal };

const packRgb = (c: readonly number[]): number =>
  (Math.round(Math.min(1, Math.max(0, c[0]!)) * 255) << 16) | (Math.round(Math.min(1, Math.max(0, c[1]!)) * 255) << 8) | Math.round(Math.min(1, Math.max(0, c[2]!)) * 255);

/** The in-memory land: the valley's map widened by a strip east of it holding the scene's cells, one solid tile all around. */
function widen(raw: MapDef, scene: PaintedScene, link = false): { map: MapDef; x0: number; y0: number } {
  const ring = 1;
  const x0 = raw.width + ring;
  const y0 = ring;
  const width = x0 + scene.cols + ring;
  const row = (y: number): string => {
    let s = '';
    for (let x = raw.width; x < width; x++) {
      const inside = x >= x0 && x < x0 + scene.cols && y >= y0 && y < y0 + scene.rows;
      // '^' is plain grass that blocks: under the picture neither water nor forest draws anything of its own
      s += inside && walkableCell(scene.cells[y - y0]?.[x - x0]) ? '.' : '^';
    }
    return s;
  };
  const map: MapDef = { ...raw, width, ground: raw.ground.map((r, y) => r + row(y)) };
  if (raw.levels) map.levels = raw.levels.map((r) => r + '0'.repeat(width - raw.width));
  const way = link ? linkOf(raw, scene) : undefined;
  if (way) {
    // the cut: path tiles at ground level through the hills and the ring, and open cells from the scene's west edge to the arrival cell (a forest edge the walk map closed)
    const put = (rows: string[] | undefined, x: number, y: number, ch: string): void => {
      const r = rows?.[y];
      if (rows && r !== undefined) rows[y] = r.slice(0, x) + ch + r.slice(x + 1);
    };
    const ground = [...map.ground];
    const levels = map.levels ? [...map.levels] : undefined;
    for (const [x, y] of way.cut) {
      put(ground, x, y, ':');
      put(levels, x, y, '0');
    }
    map.ground = ground;
    if (levels) map.levels = levels;
  }
  return { map, x0, y0 };
}

/**
 * The river, built in layers from code (the owner's method, 9.11): the bake (water-layers) gives depth, a neutral bed, the colour and
 * opacity of the water by depth from this land's painted river, and what is mirrored in it; here they are put together, moved along
 * the course (s along the river, n across it; two phases on a cycle, each new cycle a fresh slice of the 25.10 layers, so nothing
 * comes back), and lit by the one sun. `uStage` stops the build at a layer: 1 depth, 2 bed, 3 colour, 4 reflection, 5 motion, 6 light.
 */
const WATER_FS = `
#pragma phaserTemplate(shaderName)
precision highp float;
uniform sampler2D uD;
uniform sampler2D uBed;
uniform sampler2D uS;
uniform sampler2D uN;
uniform sampler2D uRefl;
uniform sampler2D uLut;
uniform sampler2D uTiles;
uniform sampler2D uShade;
uniform vec2 uSize;
uniform vec3 uTint;
uniform vec3 uReflTint;
uniform vec3 uSun;
uniform float uFade;
uniform float uSpec;
uniform float uTime;
uniform float uSTop;
uniform float uNTop;
uniform float uStage;
uniform vec3 uMeans;
uniform float uSparkle;
uniform float uWarm;
uniform vec2 uL;
varying vec2 outTexCoord;
const float SIZE = 128.0;
const float SD0 = 0.081; // the spread of the 25.10 ripple layer, so that a ripple has a size of its own
float h1(float n) { return fract(sin(n * 91.7) * 43758.5453); }
float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float bounce(float v) { return abs(mod(v, 2.0 * SIZE - 2.0) - (SIZE - 1.0)); }
float fetch(float layer, vec2 i) {
  return dot(texture2D(uTiles, (vec2(bounce(i.x) + layer * SIZE, bounce(i.y)) + 0.5) / vec2(3.0 * SIZE, SIZE)).rgb, vec3(0.3, 0.59, 0.11));
}
float tile(float layer, vec2 uv) {
  vec2 i = floor(uv);
  vec2 f = fract(uv);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(fetch(layer, i), fetch(layer, i + vec2(1.0, 0.0)), f.x), mix(fetch(layer, i + vec2(0.0, 1.0)), fetch(layer, i + vec2(1.0, 1.0)), f.x), f.y);
}
/** One layer carried along the course: two phases half a cycle apart, each restarting on a fresh slice; the mean is kept and the contrast held through the blend. */
float flow(float layer, vec2 q, float speed, float cycle, float seed, vec2 scale, float mean) {
  float ca = uTime / cycle + seed;
  float cb = ca + 0.5;
  float pa = fract(ca);
  float pb = fract(cb);
  float ia = floor(ca) + seed * 17.0;
  float ib = floor(cb) + seed * 17.0 + 0.5;
  vec2 ja = vec2(h1(ia), h1(ia + 3.1)) * 254.0;
  vec2 jb = vec2(h1(ib), h1(ib + 3.1)) * 254.0;
  float a = tile(layer, vec2(q.x - speed * pa * cycle, q.y) * scale + ja);
  float b = tile(layer, vec2(q.x - speed * pb * cycle, q.y) * scale + jb);
  float wa = 1.0 - abs(2.0 * pa - 1.0);
  float wb = 1.0 - wa;
  return mean + (wa * a + wb * b - mean) / sqrt(wa * wa + wb * wb);
}
const float TAU = 6.2831853;
vec2 rot(vec2 v, float a) { float c = cos(a); float s = sin(a); return vec2(c * v.x - s * v.y, s * v.x + c * v.y); }
/** The course-free twin of flow(): one layer carried along a drift (px a second), two phases half a cycle apart, each restarting on a fresh slice. */
float flowD(float layer, vec2 q, vec2 drift, float cycle, float seed, float scale, float mean) {
  float ca = uTime / cycle + seed;
  float cb = ca + 0.5;
  float pa = fract(ca);
  float pb = fract(cb);
  float ia = floor(ca) + seed * 17.0;
  float ib = floor(cb) + seed * 17.0 + 0.5;
  vec2 ja = vec2(h1(ia), h1(ia + 3.1)) * 254.0;
  vec2 jb = vec2(h1(ib), h1(ib + 3.1)) * 254.0;
  float a = tile(layer, (q - drift * pa * cycle) * scale + ja);
  float b = tile(layer, (q - drift * pb * cycle) * scale + jb);
  float wa = 1.0 - abs(2.0 * pa - 1.0);
  float wb = 1.0 - wa;
  return mean + (wa * a + wb * b - mean) / sqrt(wa * wa + wb * wb);
}
/**
 * Standing water, one rule for every land (no course, so no s and n): two ripple layers carried by two winds a third of a turn apart (each on fresh
 * slices, so nothing comes back and nothing pulses in place), the depth a gradient from the bank (light shallows, darker middle), the foam line
 * breathing on a swell that rolls along the shore, a wet band behind it, the bed seen through the ripples about a pixel, the hour's glitter and its
 * warm road toward the sun. Toward an open edge of the frame (no bank there) the depth is the deep kind and no foam lies along the edge.
 */
vec3 standing(vec2 p, vec3 dv, float t) {
  float sd = dv.g * 255.0 / 4.0;
  vec2 W1 = vec2(0.97, 0.24);
  vec2 D1 = W1 * 9.5;
  vec2 D2 = rot(W1, 1.75) * 7.0;
  float r1 = (flowD(0.0, p, D1, 3.4, 0.13, 0.85, uMeans.x) - uMeans.x) / SD0;
  float r2 = (flowD(0.0, p, D2, 4.4, 0.57, 0.50, uMeans.x) - uMeans.x) / SD0;
  float surf = 0.8 * r1 + 0.6 * r2;
  vec2 pb = p + vec2(r1, r2) * 1.5 * (1.0 - 0.5 * t);
  float b0 = texture2D(uBed, pb / uSize).r;
  float bl = 0.25 * (texture2D(uBed, (pb + vec2(4.0, 0.0)) / uSize).r + texture2D(uBed, (pb - vec2(4.0, 0.0)) / uSize).r + texture2D(uBed, (pb + vec2(0.0, 4.0)) / uSize).r + texture2D(uBed, (pb - vec2(0.0, 4.0)) / uSize).r);
  float bed = bl + (b0 - bl) * mix(1.0, 0.12, smoothstep(0.12, 0.65, t));
  float tr = texture2D(uD, pb / uSize).r;
  float cell = (tr * 255.0 + 0.5) / 256.0;
  vec3 tint = texture2D(uLut, vec2(cell, 0.75)).rgb;
  float opacity = texture2D(uLut, vec2(cell, 0.25)).r;
  vec3 c = vec3(bed) * (1.0 - opacity) + tint * opacity;
  c += surf * 0.1 * (0.6 + 0.4 * t);
  // depth as a gradient from the bank: the first dozen px are shallows, in the land's own lightest water, and the middle goes darker with the depth
  vec3 shallowC = texture2D(uLut, vec2(0.01, 0.75)).rgb;
  // toward the frame's edge the water has no shore of its own (an open sea runs past it): no shallows, no foam, no wet band within the edge's strip
  float db = min(min(p.x, uSize.x - p.x), min(p.y, uSize.y - p.y));
  float openEdge = smoothstep(14.0, 34.0, db);
  float shallow = (1.0 - smoothstep(0.0, 14.0, sd)) * openEdge;
  c = mix(c, shallowC * 1.05, shallow * 0.4);
  c *= 1.0 - 0.2 * smoothstep(0.3, 1.0, t);
  // what stands over the water is mirrored in it, the mirror moved by the ripples and torn along a travelling wave
  vec2 ruv = (p + vec2(r1, r2) * 3.0) / uSize;
  float a = texture2D(uD, ruv).b;
  if (a > 0.003) {
    float tear = smoothstep(0.28, 0.72, 0.5 + r2 * 0.26 + 0.2 * sin(dot(p, vec2(-0.24, 0.97)) * 0.7 + 0.06 * (dot(p, W1) - 6.0 * uTime)));
    c = mix(c, texture2D(uRefl, ruv).rgb * uReflTint, a * (0.35 + 0.65 * tear));
  }
  c *= uTint;
  float shade = texture2D(uShade, (p + vec2(r1, r2)) / uSize).a;
  c *= 1.0 - uFade * shade;
  // the sun's road: across the frame toward the sun, glitter in it and a warm band at a warm hour
  vec2 pn = (p - 0.5 * uSize) / uSize.y * vec2(1.0, -1.0); // the quad's y runs up, the sun's direction is y down (flipped 16.11 with the water switches)
  vec2 Ls = normalize(uL);
  float perp = pn.x * Ls.y - pn.y * Ls.x;
  float road = exp(-pow(perp / 0.32, 2.0)) * (0.55 + 0.45 * smoothstep(-0.6, 0.6, dot(pn, Ls)));
  vec2 DS = W1 * 8.5;
  float l1 = flowD(2.0, p, DS, 3.7, 0.31, 1.0, uMeans.z);
  float fca = uTime / 6.0 + 0.37;
  float fpa = fract(fca);
  float fpb = fract(fca + 0.5);
  vec2 qa = p - DS * fpa * 6.0;
  vec2 qb = p - DS * fpb * 6.0;
  vec2 ida = floor(qa * 0.25) + vec2(floor(fca) * 7.3, 0.0);
  vec2 idb = floor(qb * 0.25) + vec2((floor(fca + 0.5) + 0.5) * 7.3, 3.0);
  float fa = pow(max(0.0, sin(uTime * 1.2 + qa.x * 0.045 + qa.y * 0.02 + 6.28 * h2(ida))), 6.0);
  float fb = pow(max(0.0, sin(uTime * 1.2 + qb.x * 0.045 + qb.y * 0.02 + 6.28 * h2(idb))), 6.0);
  float fwa = 1.0 - abs(2.0 * fpa - 1.0);
  float flash = fwa * fa + (1.0 - fwa) * fb;
  float g = clamp((l1 - 0.42) * 2.5, 0.0, 1.0) * (0.12 + 0.88 * flash);
  float pca = uTime / 4.0 + 0.61;
  float ppa = fract(pca);
  float ppb = fract(pca + 0.5);
  vec2 ra = p - DS * ppa * 4.0;
  vec2 rb = p - DS * ppb * 4.0;
  vec2 ca_ = floor(ra / 3.0) + vec2(floor(pca) * 5.1, 0.0);
  vec2 cb_ = floor(rb / 3.0) + vec2((floor(pca + 0.5) + 0.5) * 5.1, 2.0);
  float cka = uTime * 0.55 + h2(ca_) * 7.0;
  float ckb = uTime * 0.55 + h2(cb_) * 7.0;
  float pta = step(1.0 - (0.006 + 0.04 * uSparkle), h2(ca_ + floor(cka) * 3.7)) * step(length(fract(ra / 3.0) - 0.5), 0.26) * sin(3.14159 * fract(cka));
  float ptb = step(1.0 - (0.006 + 0.04 * uSparkle), h2(cb_ + floor(ckb) * 3.7)) * step(length(fract(rb / 3.0) - 0.5), 0.26) * sin(3.14159 * fract(ckb));
  float pwa = 1.0 - abs(2.0 * ppa - 1.0);
  float point_ = (pwa * pta * pta + (1.0 - pwa) * ptb * ptb) * clamp((l1 - 0.25) * 4.0, 0.0, 1.0);
  float mean3 = (uSun.x + uSun.y + uSun.z) / 3.0;
  vec3 glint = vec3(mean3) + (uSun - vec3(mean3)) * 0.25;
  float dim = 1.0 - 0.8 * uFade / 0.45 * shade;
  c += (g * uSparkle * (0.5 + 2.2 * road) + point_ * (0.35 + 1.6 * uSparkle) * (0.4 + 0.9 * road)) * glint * dim;
  // the warm road is the light's colour laid on the water by multiplication, so the water's own hue family stays (a dark brown water never turns orange)
  c *= 1.0 + (uSun / max(max(uSun.x, uSun.y), uSun.z) - 1.0) * uWarm * road * 0.3 * dim;
  c += uSun * uWarm * road * 0.03 * dim;
  // the foam line: a core always there, a lace outside it that comes in and goes out on a swell rolling along the shore, a wet band behind the lace
  float edge = ${FOAM.base.toFixed(3)} + ${FOAM.amp.toFixed(3)} * sin(TAU * (uTime / ${FOAM.period.toFixed(3)} + dot(p, vec2(1.0, 0.8)) * ${FOAM.wave.toFixed(4)}));
  float f = flowD(1.0, p, W1 * 4.0, 4.6, 0.77, 1.0, uMeans.y);
  float holes = smoothstep(0.2, 0.8, 0.5 + (f - uMeans.y) / (2.0 * SD0));
  float lace = (1.0 - smoothstep(edge - 0.6, edge + 0.3, sd)) * (0.3 + 0.7 * holes);
  float core = 1.0 - smoothstep(0.7, 1.3, sd);
  float wet = smoothstep(edge, edge + 0.8, sd) * (1.0 - smoothstep(edge + 2.0, edge + 3.4, sd));
  c *= 1.0 - 0.16 * wet * openEdge;
  c = mix(c, vec3(0.9, 0.96, 0.94) * uTint, clamp(max(core * 0.75, lace * 0.85), 0.0, 0.85) * openEdge);
  return c;
}
void main () {
  vec2 p = floor(outTexCoord * uSize) + 0.5;
  vec2 uv = p / uSize;
  vec4 bedTex = texture2D(uBed, uv);
  if (bedTex.g < 0.5) { gl_FragColor = vec4(0.0); return; }
  vec3 dv = texture2D(uD, uv).rgb;
  float t = dv.r;
  if (uStage < 1.5) { gl_FragColor = vec4(vec3(1.0 - t), 1.0); return; }
  vec4 sf = texture2D(uS, uv);
  vec4 nf = texture2D(uN, uv);
  bool main_ = sf.b > 0.5;
  if (!main_) { gl_FragColor = vec4(standing(p, dv, t), 1.0); return; }
  float s = main_ ? (sf.r * 255.0 * 256.0 + sf.g * 255.0) / 65535.0 * uSTop : p.x;
  float n = main_ ? (nf.r * 255.0 * 256.0 + nf.g * 255.0) / 65535.0 * uNTop : p.y;
  float bank = main_ ? nf.b : 0.0;
  vec2 q = vec2(s, n);
  float live = uStage >= 4.5 ? 1.0 : 0.0;
  // the current: slow at the banks, about three times faster in the middle (measured on real rivers, 9.11); the same speed carries
  // every mark on the surface, so what is on the water moves along the course and is not a picture that changes colour
  float v = 22.0 * (0.25 + 0.75 * bank) * live;
  // ripples: the 25.10 layer stretched along the course, two sizes, each carried by the current and renewed from fresh slices
  float r1 = (flow(0.0, q, v, 4.2, 0.13, vec2(0.50, 1.20), uMeans.x) - uMeans.x) / SD0;
  float r2 = (flow(0.0, q, v * 0.85, 5.6, 0.57, vec2(0.90, 2.00), uMeans.x) - uMeans.x) / SD0;
  float surf = 0.62 * r1 + 0.45 * r2;
  // the bed is seen through the ripples: pushed about by them, and its fine detail goes with the depth (a deep bed shows only its tone)
  vec2 pb = p + vec2(r1, r2) * 3.0 * (1.0 - 0.5 * t) * live;
  float b0 = texture2D(uBed, pb / uSize).r;
  float bl = 0.25 * (texture2D(uBed, (pb + vec2(4.0, 0.0)) / uSize).r + texture2D(uBed, (pb - vec2(4.0, 0.0)) / uSize).r + texture2D(uBed, (pb + vec2(0.0, 4.0)) / uSize).r + texture2D(uBed, (pb - vec2(0.0, 4.0)) / uSize).r);
  float bed = bl + (b0 - bl) * mix(1.0, 0.12, smoothstep(0.12, 0.65, t));
  // the depth contours are seen through the same ripples, so they wobble along with them
  float tr = texture2D(uD, pb / uSize).r;
  if (uStage < 2.5) { gl_FragColor = vec4(vec3(bed), 1.0); return; }
  float cell = (tr * 255.0 + 0.5) / 256.0;
  vec3 tint = texture2D(uLut, vec2(cell, 0.75)).rgb;
  float opacity = texture2D(uLut, vec2(cell, 0.25)).r;
  vec3 c = vec3(bed) * (1.0 - opacity) + tint * opacity;
  c += surf * 0.05 * (0.6 + 0.4 * t) * live;
  // the reflection is carried by the same surface: moved by the ripple and torn across the flow
  vec2 ruv = (p + vec2(r1 * 4.5, r2 * 2.0) * live) / uSize;
  float a = texture2D(uD, ruv).b;
  if (a > 0.003 && uStage >= 3.5) {
    float tear = smoothstep(0.28, 0.72, 0.5 + r2 * 0.26 + 0.2 * sin(n * 0.7 + 0.06 * (s - 0.9 * v * uTime)));
    c = mix(c, texture2D(uRefl, ruv).rgb * uReflTint, a * (0.35 + 0.65 * tear));
  }
  c *= uTint;
  if (uStage >= 5.5) {
    float shade = texture2D(uShade, (p + vec2(r1, r2) * 2.0 * live) / uSize).a;
    c *= 1.0 - uFade * shade;
    // sparks: the bright flecks of the 25.10 light layer, carried and twinkling, the more the lower the sun
    float l1 = flow(2.0, q, v * 1.25, 3.7, 0.31, vec2(1.0), uMeans.z);
    float band = exp(-pow((p.x - 0.3 * uSize.x) / (0.34 * uSize.x), 2.0));
    // the twinkle rides the current too: two phases on a cycle, each on a fresh set of cells, so the cells keep their shape and nothing shears apart
    float fca = uTime / 6.0 + 0.37;
    float fpa = fract(fca);
    float fpb = fract(fca + 0.5);
    vec2 qa = vec2(q.x - v * 1.25 * fpa * 6.0, q.y);
    vec2 qb = vec2(q.x - v * 1.25 * fpb * 6.0, q.y);
    vec2 ida = floor(qa * 0.25) + vec2(floor(fca) * 7.3, 0.0);
    vec2 idb = floor(qb * 0.25) + vec2((floor(fca + 0.5) + 0.5) * 7.3, 3.0);
    float fa = pow(max(0.0, sin(uTime * 1.2 + qa.x * 0.045 + qa.y * 0.02 + 6.28 * h2(ida))), 6.0);
    float fb = pow(max(0.0, sin(uTime * 1.2 + qb.x * 0.045 + qb.y * 0.02 + 6.28 * h2(idb))), 6.0);
    float fwa = 1.0 - abs(2.0 * fpa - 1.0);
    float flash = fwa * fa + (1.0 - fwa) * fb;
    float g = clamp((l1 - 0.42) * 2.5, 0.0, 1.0) * (0.12 + 0.88 * flash);
    // and single points that fade in and out, each on its own slow clock; a new place every time it comes back. They ride the current as well
    // (two phases on a cycle, each on a fresh lattice), so a point travels along the course while it lives and does not blink in one place
    float pca = uTime / 4.0 + 0.61;
    float ppa = fract(pca);
    float ppb = fract(pca + 0.5);
    vec2 ra = vec2(q.x - v * 1.25 * ppa * 4.0, q.y);
    vec2 rb = vec2(q.x - v * 1.25 * ppb * 4.0, q.y);
    vec2 ca_ = floor(ra / 3.0) + vec2(floor(pca) * 5.1, 0.0);
    vec2 cb_ = floor(rb / 3.0) + vec2((floor(pca + 0.5) + 0.5) * 5.1, 2.0);
    float cka = uTime * 0.55 + h2(ca_) * 7.0;
    float ckb = uTime * 0.55 + h2(cb_) * 7.0;
    float pta = step(1.0 - (0.006 + 0.04 * uSpec), h2(ca_ + floor(cka) * 3.7)) * step(length(fract(ra / 3.0) - 0.5), 0.26) * sin(3.14159 * fract(cka));
    float ptb = step(1.0 - (0.006 + 0.04 * uSpec), h2(cb_ + floor(ckb) * 3.7)) * step(length(fract(rb / 3.0) - 0.5), 0.26) * sin(3.14159 * fract(ckb));
    float pwa = 1.0 - abs(2.0 * ppa - 1.0);
    float point_ = (pwa * pta * pta + (1.0 - pwa) * ptb * ptb) * clamp((l1 - 0.25) * 4.0, 0.0, 1.0);
    // a glint keeps the sun's brightness and a quarter of its colour: the low sun's full orange turned the river's hue 1.5 degrees off the standard at 17:30
    vec3 glint = vec3((uSun.x + uSun.y + uSun.z) / 3.0) + (uSun - vec3((uSun.x + uSun.y + uSun.z) / 3.0)) * 0.25;
    c += (g * uSpec * (0.5 + 2.2 * band) + point_ * (0.35 + 1.6 * uSpec) * (0.4 + 0.9 * band)) * glint * (1.0 - 0.8 * uFade / 0.45 * shade);
    // foam at the banks and round the things that stand in the water, in the holes of the 25.10 foam
    float foamd = dv.g * 255.0 / 4.0;
    float f = flow(1.0, q, v * 0.85, 4.6, 0.77, vec2(1.0, 1.3), uMeans.y);
    float holes = clamp((f - 0.28) * 1.9, 0.0, 1.0);
    float pulse = 0.65 + 0.35 * sin(0.03 * (s - v * uTime) + n * 0.09);
    float near = exp(-foamd / 3.2) * pulse;
    c = mix(c, vec3(0.86, 0.93, 0.9) * uTint, clamp(near * holes * 1.3, 0.0, 0.9));
  }
  gl_FragColor = vec4(c, 1.0);
}`;


/**
 * The fog, one rule for every land and every hour that says it has fog: three layers of drifting banks (look.ts FOG_LAYERS) carried along the gust, the
 * hour's light for colour (never a black veil), thick toward the top of the frame where the far land lies and thin at the bottom, the walker's clear
 * circle, and the top third of tall things let out of it (the mask). `uShow` draws the density as grey, for the measures.
 */
const FOG_FS = `
#pragma phaserTemplate(shaderName)
precision highp float;
uniform sampler2D uNoise;
uniform sampler2D uMask;
uniform vec2 uSize;
uniform vec3 uColour;
uniform vec2 uDensity;
uniform float uTime;
uniform vec3 uPace;
uniform vec2 uWalker;
uniform float uClear;
uniform float uRing;
uniform float uShow;
uniform float uCap;
uniform vec4 uForm;
varying vec2 outTexCoord;
const float NS = 256.0;
float fetchN(vec3 ch, vec2 i) {
  vec2 b = vec2(abs(mod(i.x, 2.0 * NS - 2.0) - (NS - 1.0)), abs(mod(i.y, 2.0 * NS - 2.0) - (NS - 1.0)));
  return dot(texture2D(uNoise, (b + 0.5) / NS).rgb, ch);
}
float noiseN(vec3 ch, vec2 q) {
  vec2 i = floor(q);
  vec2 f = fract(q);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(fetchN(ch, i), fetchN(ch, i + vec2(1.0, 0.0)), f.x), mix(fetchN(ch, i + vec2(0.0, 1.0)), fetchN(ch, i + vec2(1.0, 1.0)), f.x), f.y);
}
void main () {
  vec2 p = outTexCoord * uSize;
  // the quad's y runs up, the gust's runs down the screen: flip it, so the fog goes the way the trees lean
  vec2 W = vec2(${DEFAULT_WIND.x}, ${-DEFAULT_WIND.y});
  vec2 X = vec2(${DEFAULT_WIND.y}, ${DEFAULT_WIND.x});
  float f = 0.0;
  ${FOG_LAYERS.map((l, i) => `{ vec2 q = p - (W * ${(l.speed * FOG_PACE[i]!).toFixed(2)} + X * ${(l.speed * FOG_PACE[i]! * l.across).toFixed(2)}) * uTime * uPace.${'xyz'[i]}; f += ${l.share.toFixed(2)} * noiseN(vec3(${i === 0 ? '1.0, 0.0, 0.0' : i === 1 ? '0.0, 1.0, 0.0' : '0.0, 0.0, 1.0'}), q * ${(NOISE_SIZE / (4 * l.size)).toFixed(4)}); }`).join('\n  ')}
  float banks = smoothstep(uForm.z, uForm.w, f);
  float base = mix(uDensity.x, uDensity.y, p.y / uSize.y); // flipped 16.11: the bottom value at the bottom (the quad's y runs up)
  float open = smoothstep(uClear, uClear + uRing, length(p - uWalker) / 64.0);
  // the mask is written with the picture's row 0 on top; the quad's y runs up
  float mask = texture2D(uMask, vec2(outTexCoord.x, 1.0 - outTexCoord.y)).r;
  float peak = min(base * uForm.x, uCap);
  float a = peak * (uForm.y + (1.0 - uForm.y) * banks) * open * (1.0 - mask);
  if (uShow > 0.5) { gl_FragColor = vec4(vec3(a), 1.0); return; }
  // the banks catch the light a little where they are thickest; the layer is drawn by SCREEN, so only light is added (src = colour * density)
  vec3 col = uColour * (0.9 + 0.2 * banks);
  gl_FragColor = vec4(col * a, 1.0);
}`;

/**
 * The lit fog (round 12; order v11, 19.11: the sky's light, not the ground's). A program of its own, so the shipped fog above keeps its source and its pixels. It brightens a pixel toward the sky of the hour
 * (uSky, fogform.ts fogSkyOf: bright, most of the chroma taken out), the same over water and over land, by the land's own density (thick far, thin near), the banks' noise, and the land's form: it lies over water
 * and in the low ground (uWall green, fogform.ts lownessOf) and is thin on ridges and near walls. SCREEN gets exactly the excess over the ground, so a pixel is never darker and never more coloured than the sky.
 */
const FOG_LIT_FS = `
#pragma phaserTemplate(shaderName)
precision highp float;
uniform sampler2D uNoise;
uniform sampler2D uMask;
uniform vec2 uSize;
uniform vec2 uDensity;
uniform float uTime;
uniform vec3 uPace;
uniform vec2 uBank;
uniform vec2 uWalker;
uniform vec4 uUnit; // the quad's share of the scene, y counted up from the scene's bottom (a streamed land's unit; (0, 0, 1, 1) for the whole land)
uniform float uClear;
uniform float uRing;
uniform float uShow;
uniform float uCap;
uniform float uRidge;
uniform float uBurn;
uniform float uCut;
uniform float uEven;
uniform float uThin;
uniform vec4 uForm;
uniform sampler2D uWall;
uniform sampler2D uPlate;
uniform float uDbg;
uniform vec3 uFlat;
uniform vec3 uSky;
varying vec2 outTexCoord;
const float NS = 256.0;
float fetchN(vec3 ch, vec2 i) {
  vec2 b = vec2(abs(mod(i.x, 2.0 * NS - 2.0) - (NS - 1.0)), abs(mod(i.y, 2.0 * NS - 2.0) - (NS - 1.0)));
  return dot(texture2D(uNoise, (b + 0.5) / NS).rgb, ch);
}
float noiseN(vec3 ch, vec2 q) {
  vec2 i = floor(q);
  vec2 f = fract(q);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(fetchN(ch, i), fetchN(ch, i + vec2(1.0, 0.0)), f.x), mix(fetchN(ch, i + vec2(0.0, 1.0)), fetchN(ch, i + vec2(1.0, 1.0)), f.x), f.y);
}
void main () {
  vec2 su = uUnit.xy + outTexCoord * uUnit.zw;
  vec2 p = su * uSize;
  // the lit variant is made in whole art pixels (the picture's grid starts 1.333 scene px off the corner, as the water's)
  p = (floor((p + 1.333) / 4.0) + 0.5) * 4.0 - 1.333;
  // the quad's y runs up, the gust's runs down the screen: flip it, so the fog goes the way the trees lean
  vec2 W = vec2(${DEFAULT_WIND.x}, ${-DEFAULT_WIND.y});
  vec2 X = vec2(${DEFAULT_WIND.y}, ${DEFAULT_WIND.x});
  float f = 0.0;
  ${FOG_LAYERS.map((l, i) => `{ vec2 q = p - (W * ${(l.speed * FOG_PACE[i]!).toFixed(2)} + X * ${(l.speed * FOG_PACE[i]! * l.across).toFixed(2)}) * uTime * uPace.${'xyz'[i]}; f += ${l.share.toFixed(2)} * noiseN(vec3(${i === 0 ? '1.0, 0.0, 0.0' : i === 1 ? '0.0, 1.0, 0.0' : '0.0, 0.0, 1.0'}), q * ${(NOISE_SIZE / (4 * l.size)).toFixed(4)}); }`).join('\n  ')}
  float banks = smoothstep(uBank.x, uBank.y, f);
  float open = smoothstep(uClear, uClear + uRing, length(p - uWalker) / 64.0);
  // the mask is a canvas texture like the wall field, read the same way (a flip here stood every tall piece's mask upside down about the quad's middle, private #44)
  float mask = texture2D(uMask, outTexCoord).r;
  vec4 wl = texture2D(uWall, su);
  float dW = wl.r * 255.0 / 8.0;
  // over water the banks' noise is pulled to its mean (order v11c, fogform.ts evenBanks): one even veil, no soft dark gap between two banks
  banks = mix(banks, ${FOG_EVEN.mean.toFixed(2)}, uEven * smoothstep(${FOG_EVEN.lo.toFixed(2)}, ${FOG_EVEN.hi.toFixed(2)}, wl.g));
  // the land's own numbers as the land says them: thick at the top of the frame (far), thin at the bottom (near). The quad's y runs up (p.y / uSize.y is 1 at the top row), so the top takes the land's top number
  float grad = min(mix(uDensity.x, uDensity.y, p.y / uSize.y) * uForm.x, uCap);
  // the form from the land: over water and in the low ground the fog keeps all of it, on a ridge (far from any water) uRidge of it; near a wall it thins as before
  float a = grad * (uForm.y + (1.0 - uForm.y) * banks) * open * (1.0 - mask) * (0.35 + 0.65 * smoothstep(2.0, 14.0, dW)) * mix(uRidge, 1.0, wl.g) * (1.0 - (1.0 - uThin) * smoothstep(${FOG_EVEN.lo.toFixed(2)}, ${FOG_EVEN.hi.toFixed(2)}, wl.g));
  // the high sun burns the thin fog off dry ground (order v11b): the density loses uCut, the low ground (water and its margins) keeps all of it
  float ax = a - uBurn * uCut * (1.0 - smoothstep(0.15, 0.7, wl.g));
  a = mix(a, 0.5 * (ax + sqrt(ax * ax + 0.0016)), uBurn); // a soft knee: the cut ends in no hard edge
  vec3 G = texture2D(uPlate, outTexCoord).rgb * uFlat;
  if (uShow > 0.5) { gl_FragColor = vec4(vec3(uDbg > 7.5 ? wl.g : uDbg > 6.5 ? grad : uDbg > 5.5 ? p.y / uSize.y : uDbg > 3.5 ? dot(G, vec3(0.2126, 0.7152, 0.0722)) : uDbg > 2.5 ? dW / 16.0 : a), 1.0); return; }
  // lighter only: SCREEN gets exactly the lerp toward the sky's excess over the ground, never a pixel darker
  gl_FragColor = vec4(min(a * max(uSky - G, vec3(0.0)) / max(vec3(1.0) - G, vec3(0.05)), vec3(1.0)), 1.0);
}`;

interface Leaner {
  o: PaintedObject;
  spr: Phaser.GameObjects.Sprite;
  lean: number;
  shown: number;
  /** ground cover only: 0 where the foot stands on a wall or in water, how much of the sun is on it (1 to 1 - SHADE_SWAY), and its bend from the walker now (frames, signed) */
  cover?: { gate: number; shade: number; push: number };
}

/** A painted land cut into units by the exporter: tiles/index.json beside scene.json, and the same index in scene.json's `tiles`. */
export interface PaintedTiles {
  format: 1;
  unit: { w: number; h: number };
  grid: { cols: number; rows: number };
  units: (StreamUnitMeta & { pieces: number })[];
  /** per piece (the scene's objects by index): its unit's index in `units` and where it lies in that unit's sheet; null for a piece in no unit */
  pieces: ([number, number, number] | null)[];
  /** the still water the exporter baked; null for a land with no water, absent for a cut made before it */
  still?: { grid: { w: number; h: number }; seam: number; field: string; base: string; ramp: string; tone: string[] | null } | null;
  /** the canopy's cover masks the exporter baked (red the gate, green the rays' stop); null for a land with no canopy */
  cover?: { file: string; w: number; h: number } | null;
  /** the lit fog's inputs the exporter baked: the walls' distance and the low ground per art pixel, and the tall pieces' mask per unit */
  fog?: { wall: string; aw: number; ah: number; mask: string[]; /** the noise tile baked by the exporter; absent on a scene baked before it */ noise?: string };
  /** the meadow's mask per unit (255 on the plate pixels that move); absent on a scene baked before it: the meadow then holds still */
  grass?: { mask: string[] };
}

/** how long a streamed land waits after first light before its deferred work (the pieces' alpha, the wall shade) starts */
const SETTLE_MS = 1000;

/** the layers a streamed land leaves out of the boot: its units carry them */
const WHOLE_LAYERS = ['ground', 'ground-n', 'walls', 'walls-n', 'water-bed'];

/** the time each part of the per-frame work took (n, max and sum in ms), read by the rigs as window.__cost */
const COST: Record<string, { n: number; max: number; sum: number }> = ((globalThis as unknown as { __cost?: object }).__cost = {} as never) as never;
const SPIKES: [number, string, number][] = ((globalThis as unknown as { __spikes?: unknown }).__spikes = []) as never;
function timed<R>(name: string, fn: () => R): R {
  const t = performance.now();
  const r = fn();
  const d = performance.now() - t;
  const c = (COST[name] ??= { n: 0, max: 0, sum: 0 });
  c.n++;
  c.sum += d;
  if (d > c.max) c.max = d;
  // the rigs read the spikes (window.__spikes: when, what, how long) to match a long frame with the work in it
  if (d >= 3 && SPIKES.length < 600) SPIKES.push([t, name, Math.round(d * 10) / 10]);
  return r;
}

/** the time one frame may spend on a landing unit's work, in ms (PaintedMount.update) */
const FRAME_BUDGET_MS = 25;
/** the same while the camera moves (the walk): 8 ms, as the long frames of a seam were the last item that fitted under 25; the figure's own frame needs the rest */
const WALK_BUDGET_MS = 8;

/**
 * B4b (private #44): a sprite with a filter draws it into a framebuffer of its own frame's size, and the context pool is keyed by that size, so every crown of a new size made a framebuffer (or resized an old one:
 * checkFramebufferStatus, 15 to 42 ms in the stutter walk's profile, h/prof-4b0). The filter's size is the next multiple of FILTER_BUCKET over the frame, by an even margin so the sprite stays on whole pixels in it,
 * and the sprite's focus keeps the frame's centre. Returns the margin on each side (frame pixels) the mask's place must add. Held off by `nobucket4b`.
 */
const FILTER_BUCKET = 128;
/** B4c: the framebuffer warm-up starts at first light's settle, or this long after the mount when first light is not near (a walk that starts far from the valley) */
const WARM_AFTER_MS = 5000;
function bucketUp(n: number): number {
  const b = Math.ceil(n / FILTER_BUCKET) * FILTER_BUCKET;
  return b + ((b - n) & 1);
}
function bucketFilter(s: Phaser.GameObjects.Sprite): [number, number] {
  const w = s.width;
  const h = s.height;
  const W = bucketUp(w);
  const H = bucketUp(h);
  const base = Phaser.GameObjects.Sprite.prototype.focusFilters;
  s.focusFilters = function (this: Phaser.GameObjects.Sprite) {
    base.call(this);
    const fc = this.filterCamera;
    if (fc && (fc.width !== W || fc.height !== H)) {
      this.setFilterSize(W, H);
      fc.centerOn(this.x + w * (0.5 - this.originX), this.y + h * (0.5 - this.originY));
    }
    return this;
  };
  return [(W - w) / 2, (H - h) / 2];
}

export class PaintedMount {
  readonly bundle: Bundle;
  readonly scene: PaintedScene;
  readonly base: string;
  readonly x0: number;
  readonly y0: number;
  readonly hold: Set<string>;
  readonly steps: { player: [number, number][]; roe: [number, number][] } = { player: [], roe: [] };
  private readonly lynx: Record<string, LynxStrip>;
  private world!: WorldShape;
  private session?: SessionShape;
  private sprites: Phaser.GameObjects.Sprite[] = [];
  private leaners: Leaner[] = [];
  private covers: Leaner[] = [];
  private coverShadeAt = 0;
  private coverShadeVersion = -1;
  private sun?: Phaser.GameObjects.Light;
  private wallShade?: Phaser.GameObjects.Image;
  /** the cover's shade over a wood's floor (painted-cover.ts): its masks, the picture and the sun it was last baked for */
  private coverM?: CoverMasks;
  private origin: [number, number] = [0, 0];
  private standingField?: { data: Standing; ox: number; oy: number };
  /** the standing field is out of date (a unit's alpha arrived since it was made); stepStanding makes it again, in slices, and the old one serves meanwhile */
  private standingStale = false;
  /** when the camera last moved or a walk was last held (ms, holdsWalk): a land being walked gives a landing unit's work a small share of each frame, a land standing still a large one (budgeted) */
  private movedAt = -1e9;
  private camX = 0;
  private camY = 0;
  private standingJob?: Generator<void, void, void>;
  /** every standing piece's opaque pixels so far (1 a pixel): a unit's alpha is stamped into it when it arrives, and a pass takes a copy */
  private standingMask?: Uint8Array;
  /** where the mask changed since a pass last took it (a streamed unit's arrival changes only its own pieces' pixels); the next pass makes the field again only there */
  private standingDirty: Rect[] = [];
  /** a unit's pieces were dropped: the mask has to be made again from the pieces left, and the field over the whole land (a land laid whole stamps its pieces at its first pass) */
  private standingFull = false;
  /** the planes of the field served and of the one being made (taken in turn: the served one stays whole until the new one lands) */
  private standingSets: { mask: Uint8Array; nx: Int8Array; ny: Int8Array }[] = [];
  private standingTurn = 0;
  /** the blurs' scratch for a pass over a crop of the mask, grown to the largest crop and kept; a whole-land crop's is let go after its pass */
  private standingScratch?: RegionBuffers;
  private coverImg?: Phaser.GameObjects.Image;
  private coverTex?: Phaser.Textures.CanvasTexture;
  private coverTmp?: HTMLCanvasElement;
  private coverData?: Uint8ClampedArray;
  private coverSun = '';
  private water?: Phaser.GameObjects.Shader;
  /** the still water of v10 (waterstill.ts): over the picture's own water, for a scene without a river course; the old layer is kept for a river's course */
  private still?: StillWater;
  private lit?: Lit;
  /** the wind at the hour now (the table's field, wind.ts): the leaning pieces, the ground cover, the meadow's pass and the water's streaks read it */
  private wind: Wind = DEFAULT_WIND;
  get windNow(): Wind {
    return this.wind;
  }
  private litMinute = -1;
  /** the light of the land's world, row by row over the day */
  private rows: LightRow[] = [];
  private tintOfWater: [number, number, number] = [1, 1, 1];
  private reflTint: [number, number, number] = [1, 1, 1];
  private sunOfWater: [number, number, number] = [1, 1, 1];
  private fadeOfWater = 0;
  private specOfWater = 0;
  private waterTime = 0;
  private fogTime = 0;
  /** where the noise turns into a bank (smoothstep edges on the layers' sum): the river world's is cut across the middle of the noise's spread so a bank and a gap both show and move; the undead world's keeps the wide cut it was measured with */
  private fogBank(): [number, number] {
    return worldOf(this.scene) === 'river' ? [0.38, 0.5] : [0.21, 0.5];
  }
  /** each fog layer's pace relative to FOG_PACE: the river world's fog drifts faster */
  private fogPace(): [number, number, number] {
    if (worldOf(this.scene) !== 'river') return [1, 1, 1];
    return [FOG_PACE_RIVER[0] / FOG_PACE[0], FOG_PACE_RIVER[1] / FOG_PACE[1], FOG_PACE_RIVER[2] / FOG_PACE[2]];
  }
  private fog?: Phaser.GameObjects.Shader;
  private fogLit?: Phaser.GameObjects.Shader;
  private fogAt?: [number, number];
  private fogOf?: FogData;
  private fogRgb: [number, number, number] = [0.5, 0.5, 0.5];
  private fogLight = { flat: [1, 1, 1] as [number, number, number] };
  /** the sky of the hour the lit fog moves toward (fogform.ts fogSkyOf) */
  private fogSky: [number, number, number] = [0.5, 0.5, 0.5];
  /** how much the high sun has burnt the fog off the dry ground (fogform.ts burnOf): 0 at 17:30, 1 at 13:00 */
  private fogBurn = 0;
  private sparkleOfWater = 0;
  private warmOfWater = 0;
  private sunDir: [number, number] = [-1, 0];
  private waterStage = 6;
  private readonly tileMeans: [number, number, number];
  private waterShade?: Phaser.Textures.CanvasTexture;
  private wallCanvas?: HTMLCanvasElement;
  private shadeAt = -1;
  private sheetAlpha?: Uint8ClampedArray;
  /** the sheet's normal map, read only for a land with a foot-line map (the front windows carry it) */
  private sheetNormal?: Uint8ClampedArray;
  /** the join's foot-line map decoded, when the mount has one and the lever `hold=nodepth` is not set (order 5): the mass is then drawn under the figure and cut over her per pixel */
  private footline?: FootLine;
  private massObjs: PaintedObject[] = [];
  /** the windows of the mass drawn over the figure (by mass piece) and over each standing piece (by piece), see stepFront */
  private herCuts = new Map<number, FrontCut>();
  private pieceCuts: { cut: FrontCut; piece: PaintedObject }[] = [];
  private pieceCutsMade = false;
  /** pieces lower than half her height that sort by the bottom of their box (a low bush covers her feet while she stands in it), made once the figure's size is read */
  private lowDone = false;
  /** each low piece with the depth it sorts at while her foot is in its footprint, and whether it is sunk under her now (her foot stands beside it, not in it) */
  private lowList: { spr: Phaser.GameObjects.Sprite; o: PaintedObject; depth: number; under: boolean }[] = [];
  /** how far open the see-through window is in each of her front windows (by mass piece), and the capsule's pixels read once from its texture */
  private seeFront = new Map<number, number>();
  private seeCap?: { key: string; data: Uint8ClampedArray; w: number; h: number };
  lowPieces = 0;
  /** the depth pass's counters: windows made and frames run (a rig reads them) */
  readonly depthCounters = { cuts: 0, frames: 0 };
  /** the front windows' CPU cost (cuts, ms cutting, ms uploading, bytes): a rig reads it and zeroes it */
  readonly frontStats = frontStats;
  /** a rig reads this: windows drawn, masks made since the start (a still view adds none) */
  depthReport(): { windows: number; masks: number; pieceWindows: number; frames: number } {
    let masks = 0;
    for (const c of this.herCuts.values()) masks += c.made;
    for (const { cut } of this.pieceCuts) masks += cut.made;
    return { windows: this.herCuts.size, masks, pieceWindows: this.pieceCuts.length, frames: this.depthCounters.frames };
  }
  /** a rig's lever: the windows over the figure are not drawn (the mass then lies under everything); what the last frame's test saw: her foot row, her box and each window's pixel count */
  frontOff = false;
  /** levers for the cost measure: the static windows of the pieces off, her own windows off */
  pieceOff = false;
  herOff = false;
  /** cost measure only: her windows are cut once and not again (what drawing them costs without the cutting) */
  herStill = false;
  depthInfo: { row: number; box: [number, number, number, number]; cuts: [number, number][] } = { row: 0, box: [0, 0, 0, 0], cuts: [] };
  /** the sprites that carry a see-through mask right now, with their mask image and how much of it is on (0..1) */
  /** how much of the object the mask takes at the figure's middle (a rig sets 0 to test that the filter alone changes nothing) */
  seeFade: number = SEE_LOCAL.fade;
  readonly seeDefault = SEE_LOCAL;
  /** how far (art px) the full-strength capsule stands out from the figure's outline, and the width of the ramp after it; read when the first mask is made, so a rig sets them first */
  seeGrow: number = SEE_LOCAL.grow;
  seeEdge: number = SEE_LOCAL.edge;
  private seeCam?: Phaser.Cameras.Scene2D.Camera;
  /** how far open the see-through window is now, 0 to 1 (the deepest of the masks): the halo is felt there */
  private seeAmount = 0;
  private seeMasks = new Map<Phaser.GameObjects.Sprite, { img: Phaser.GameObjects.Image; ctrl: unknown; k: number; padX: number; padY: number }>();
  private frozenTick: number | undefined;
  /** The figure's edge, on unless the query says `figedge=0` (the figure's presence): eight copies of the figure's frame, one art pixel out, under it */
  edgeOn: boolean;
  /** The contact patch under the figure's feet, on unless the query says `contact=0` */
  contactOn: boolean;
  /** Objects in front of the figure fade while they cover it; off unless the query has `seethrough=1` (it meets W2 and the depth cues: the owner rules) */
  seeThrough: boolean;
  private contact?: Phaser.GameObjects.Image;
  private halo?: Phaser.GameObjects.Image;
  /** the preview: the valley stays the start and a way is cut from its east lane into the scene (`link`), and the first minute is the device's own (`clock=device`) */
  readonly link: boolean;
  /** the valley as the painted land (V5, private #44, `base=1`): the bundle's own map IS the scene's cells with one ring round them, so the scene sits at tile (1, 1) and nothing is glued on; the session starts where the content says */
  readonly baseMode: boolean;
  /** the land's pictures fetched from the moment the scene was read (early-fetch.ts); the boot scene adds them as textures */
  readonly early = new EarlyImages(BROWSER_EARLY);
  /** the land's units, when it streams (scene.json's `tiles`); undefined for a land laid whole */
  readonly tiles?: PaintedTiles;
  /** the stream of units (painted-stream.ts), made at build when the land streams */
  stream?: PaintedStream<Blob | HTMLImageElement, ImageBitmap>;
  /** a streamed land's pieces' alpha by piece index (readUnitAlpha), and the units whose sheet waits to be read */
  private pieceAlpha = new Map<number, Uint8Array>();
  private alphaQueue: StreamUnitMeta[] = [];
  /** B4c: the framebuffer sizes still to be made ahead of the walk (undefined until first light settles), and how long an idle one is kept */
  private readonly born = performance.now();
  private warmQ?: [number, number][];
  private warmPool?: CtxPool;
  private warmHeld: { release(): void }[] = [];
  /** a streamed land's wall shade per unit (stepWallShade), its canvases, and the units whose shade waits */
  private shadeImgs = new Map<string, Phaser.GameObjects.Image>();
  private shadeCanvas = new Map<string, HTMLCanvasElement>();
  private shadeQueue: { unit: StreamUnitMeta; on: boolean; first?: boolean }[] = [];
  /** when the streamed land's standing unit was first seen lit (settled()) */
  private litSince?: number;
  /** a streamed land's still water: 'off' until settled, 'loading' while its baked textures come, then 'on' (the StillWater with a quad pair per resident unit) */
  private stillState: 'off' | 'loading' | 'on' | 'none' = 'off';
  /** per unit (`ux,uy`): its shadow copy for the water (canvas texture) and whether its tone is in */
  private waterUnits = new Map<string, { unit: StreamUnitMeta; shade: Phaser.Textures.CanvasTexture; tone: 'loading' | 'in' }>();
  private waterShadeAt = -1;
  /** a streamed land's lit fog: 'off' until settled, then 'loading', 'on' or 'none'; per unit its quad (made once its mask is in) */
  private fogState: 'off' | 'loading' | 'on' | 'none' = 'off';
  private fogUnits = new Map<string, { unit: StreamUnitMeta; quad?: Phaser.GameObjects.Shader }>();
  /** a streamed land's cover: 'off' until settled, then 'loading', 'on' or 'none' */
  private coverState: 'off' | 'loading' | 'on' | 'none' = 'off';
  /** work that came out of a fetch or a decode (a texture made, a quad built), run one at a time inside the frame's budget (update) */
  private laterQ: { name: string; fn: () => void }[] = [];
  /** the cover's shade being baked in slices (lightCover), and the fog's noise being made in slices (stepStreamFog) */
  private coverJob?: { gen: Generator<void, void, void>; out: Uint8ClampedArray; m: CoverMasks; tex: Phaser.Textures.CanvasTexture; tmp: HTMLCanvasElement };
  private fogNoiseJob?: { gen: Generator<void, void, void>; done: () => void };
  /** a streamed land's units whose wind is baked (stepUnitWind), by `ux,uy` */
  private windDone = new Set<string>();
  /** the wall shade's offset (scene px) and tint at the hour laid last (applyLight) */
  private shadeLook?: { dx: number; dy: number; tint: number };
  /** per streamed layer key whose texture is being laid by bands: the bitmap, its texture's storage, the bands' rows and their cut bitmaps once made, and the next band */
  private bandJobs = new Map<string, { gen: Generator<void, boolean, void>; layer: StreamLayerMeta; unit: StreamUnitMeta }>();
  /** per unit key, the ground and walls images laid for it */
  private unitImgs = new Map<string, Phaser.GameObjects.Image>();
  /** per unit (`ux,uy`), a CPU copy of its ground for the figure's edge and contact, made when first read */
  /** the meadow's pass on each streamed ground unit (painted-grass.ts), by the unit's ground key, with the mask's texture key; `ctl` is set when the mask has arrived */
  private grassUnits = new Map<string, { im: Phaser.GameObjects.Image; mk: string; ctl?: GrassPass }>();
  /** how far over the meadow round her feet is bent, 0 to 1 (the ground cover's BEND times) */
  private grassBend = 0;
  /** the meadow's clock in seconds when something other than the game's own time must drive it (the clip rig steps it frame by frame); undefined: the game's time */
  grassClock: number | undefined;
  private unitPlate = new Map<string, { x: number; y: number; w: number; h: number; px: Uint8ClampedArray }>();
  /** the painting covers every tile the camera can see (base mode without the way out): the world paints no tile ground under it */
  /** The trunk discs in the world's art pixels, where the body's point stands when the drawn feet meet a trunk (walking.ts trunkDiscsOf), or none: the walker passes between trunks and round them (pushOutOfDiscs). */
  get trunkDiscs(): readonly Disc[] {
    if (!this.discs) {
      this.discs = trunkDiscsOf(this.scene.feet ?? [], this.x0, this.y0);
    }
    return this.discs;
  }

  private discs?: Disc[];

  get coversGround(): boolean {
    return this.baseMode && !this.link;
  }
  /** a tile of the map under the painted scene's rectangle: the painting hides it, so the world paints no tile ground there (the per-pixel edge blend of those tiles was the stutter of a walk through the seams, private #44) */
  coversTile(tx: number, ty: number): boolean {
    return tx >= this.x0 && tx < this.x0 + this.scene.cols && ty >= this.y0 && ty < this.y0 + this.scene.rows;
  }
  private readonly deviceClock: boolean;
  /** a rig's lever: the race whose halo is drawn instead of the session's */
  raceOverride = '';
  /** the contact patch's numbers; a mount field so a rig can sweep them */
  contactCfg: Record<string, number> = { ...CONTACT };
  /** the defaults, for a rig that overrides some */
  readonly contactDefault = CONTACT;
  /** the drawn strength of the patch (eased) and the per-texture feet offsets read from the sheets */
  private contactA = 0;
  private contactFoot = '';
  private contactTarget = 0;
  /** screen pixels per art pixel asked by the query (`figzoom`), 0 = the default, PAINTED_SCREEN_PX_PER_ART_PX */
  figZoom = 0;
  private feetOff = new Map<string, { x: number; sole: Map<string, number> }>();
  /** the scale of the drawn figure against the height the window and halo were tuned at (1 until the sheet is read), read once from the idle sheet facing down */
  private lastDelta = 16;
  private figK = 0;
  /** her silhouette sampled every SEE_SAMPLE art px (the idle sheet's first frame facing down): [across from the frame's middle, up from the sole], art px as drawn */
  private figPts: [number, number][] = [];
  /** the scene object each sprite of `sprites` was cut from, by index */
  private spriteObj: PaintedObject[] = [];
  private edge: Phaser.GameObjects.Sprite[] = [];
  private edgeGround?: { w: number; h: number; px: Uint8ClampedArray };
  private edgeFoot = '';
  private edgeRgb: [number, number, number] = [0, 0, 0];
  private animal?: Phaser.GameObjects.Sprite;
  private animalAt: [number, number] = [0, 0];
  private animalRoute: [number, number][] = [];
  private animalT = 0;
  private animalFacing: 'down' | 'up' | 'left' | 'right' = 'down';

  constructor(raw: Bundle, scene: PaintedScene, base: string, lynx: Record<string, LynxStrip>, hold: Set<string>, tileMeans: [number, number, number], stage: number,
    presence: { edge: boolean; contact: boolean; seeThrough: boolean; figZoom?: number; link?: boolean; deviceClock?: boolean; base?: boolean } = { edge: true, contact: true, seeThrough: false }, tiles?: PaintedTiles) {
    this.tiles = tiles;
    this.figZoom = presence.figZoom ?? 0;
    this.link = presence.link ?? false;
    this.baseMode = presence.base ?? false;
    this.deviceClock = presence.deviceClock ?? false;
    this.edgeOn = presence.edge;
    this.contactOn = presence.contact;
    this.seeThrough = presence.seeThrough;
    this.scene = scene;
    this.tileMeans = tileMeans;
    this.waterStage = stage;
    this.base = base;
    this.hold = hold;
    this.rows = lightRowsOf(scene);
    this.lynx = lynx;
    const { map, x0, y0 } = this.baseMode ? baseOf(raw.map, scene) : widen(raw.map, scene, this.link);
    this.x0 = x0;
    this.y0 = y0;
    const sprites = { ...raw.sprites };
    const whole = { w: scene.width, h: scene.height, frames: 1, density: 4 as const };
    // a streamed land's units carry these (painted-stream.ts): none of them is loaded whole
    if (!tiles) for (const n of WHOLE_LAYERS) sprites[`painted:${n}`] = { url: `${base}/${n}.png`, ...whole };
    // the river's own layers only for a land with a river course: a still-water land reads the bed alone (StillWater), and the five whole layers it never read cost 89 MB of texture (V5b)
    if (scene.river.sLength) {
      for (const n of RIVER_LAYERS) sprites[`painted:${n}`] = { url: `${base}/${n}.png`, ...whole };
      sprites['painted:water-lut'] = { url: `${base}/water-lut.png`, w: 256, h: 2, frames: 1, density: 4 };
      sprites['painted:water-tiles'] = { url: `${base}/water-tiles.png`, w: 384, h: 128, frames: 1, density: 4 };
    }
    if (scene.footline) sprites['painted:footline'] = { url: `${base}/footline.png`, ...whole };
    if (!tiles) for (const n of ['objects', 'objects-n']) sprites[`painted:${n}`] = { url: `${base}/${n}.png`, w: scene.sheet.w, h: scene.sheet.h, frames: 1, density: 4 };
    // the current character: the slim elf, walk (a jog of 12 poses) and idle (4), down, left and up; the right is the left mirrored
    for (const v of ['down', 'left', 'up'] as const) {
      sprites[`${FIGURE.walk}_${v}`] = { url: `${base}/figures/slim_jog_${v}.png`, w: 128, h: 128, frames: 12, density: 4, stride: { travel_mpx: Math.round(TRAVEL[v] * 1000), anchor: FIGURE_ANCHOR, bob: false } };
      sprites[`${FIGURE.idle}_${v}`] = { url: `${base}/figures/slim_idle_${v}.png`, w: 128, h: 128, frames: IDLE_POSES, density: 4, stride: { travel_mpx: 1000, anchor: FIGURE_ANCHOR, bob: false } };
    }
    for (const [name, s] of Object.entries(lynx)) sprites[`painted:lynx-${name}`] = { url: `${base}/figures/${s.file}`, w: ANIMAL_SIZE, h: ANIMAL_SIZE, frames: s.frames, density: 4 };
    // each race walks in its own approved sheet (the manager's ruling of 28.11 on DECISIONS 2026-11-15 and 2026-11-21): the race sheets are baked
    // to the adult's 73 art px, the height the painted figure stands at (73 to 74 rows), so they are drawn at their own scale, and every clip of
    // a race keeps its size against that race's walk. The painted figure's sheets stay loaded for a land whose races wear it.
    const races = raw.races;
    // one sun for the picture and the shadows: the standard's two hours as the shadow's shear, its wash taken off (the light is the sun's now)
    const shear = (h: Pick<PaintedHour, 'sq' | 'sl'>) => ({ right: Math.round(h.sq * h.sl * 1.9 * 100), down: Math.round(-h.sq * 100) });
    const light = raw.params.light;
    const params = {
      ...raw.params,
      light: light && {
        ...light,
        keys: light.keys.map((k) => ({ ...k, pct: 0 })),
        sun: { alpha: 100, cap: 400, keys: this.sunKeys(shear) },
      },
    };
    this.bundle = { ...raw, map, sprites, races, params } as Bundle;
    (window as unknown as { __painted: PaintedMount }).__painted = this;
  }

  private local(x: number, y: number): [number, number] {
    return [x - this.x0, y - this.y0];
  }

  /** since when the walk has been held at an unlit unit's edge (0: not held), and the longest hold so far in ms (read by the rig) */
  private heldSince = 0;
  heldLongest = 0;

  /**
   * Whether the walk in direction (dx, dy) waits this frame: a streamed land holds the step into a unit not lit yet while she is near its edge (PaintedStream.holdStep), for
   * HOLD_MAX ms at most; then she walks on whatever is there. A whole land never holds.
   */
  holdsWalk(dx: number, dy: number, now: number): boolean {
    // a walk held against a trunk or a wall moves no camera but is still a walk: it keeps the walking share of the frame (walking()), never the still land's long slices (private #44 H, 26.11)
    if (dx !== 0 || dy !== 0) this.movedAt = now;
    const st = this.stream;
    if (!st || (dx === 0 && dy === 0) || !st.holdStep(dx, dy)) {
      this.heldSince = 0;
      return false;
    }
    if (this.heldSince === 0) this.heldSince = now;
    const held = now - this.heldSince;
    this.heldLongest = Math.max(this.heldLongest, Math.min(held, HOLD_MAX));
    return held < HOLD_MAX;
  }

  /** Whether a cell of the scene can be stood on. */
  free(x: number, y: number): boolean {
    return walkableCell(this.scene.cells[y]?.[x]);
  }

  /** A four-way route between two free cells, or undefined. */
  route(from: [number, number], to: [number, number]): [number, number][] | undefined {
    const key = (p: readonly number[]) => `${p[0]},${p[1]}`;
    const prev = new Map<string, [number, number] | null>([[key(from), null]]);
    const queue: [number, number][] = [from];
    for (let i = 0; i < queue.length; i++) {
      const at = queue[i] as [number, number];
      if (at[0] === to[0] && at[1] === to[1]) {
        const path: [number, number][] = [];
        for (let c: [number, number] | null | undefined = at; c; c = prev.get(key(c))) path.unshift(c);
        return path.slice(1);
      }
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const n: [number, number] = [at[0] + dx, at[1] + dy];
        if (!this.free(n[0], n[1]) || prev.has(key(n))) continue;
        prev.set(key(n), at);
        queue.push(n);
      }
    }
    return undefined;
  }

  // ------------------------------------------------------------ scene

  build(world: unknown): void {
    this.world = world as WorldShape;
    const w = this.world;
    // what follows the figure (her rim, her contact shadow, the see-through window, the halo) reads her place and depth after the world has moved her
    // this frame: in update() it read the last frame's, and walking up (her depth falling) the rim copies sat at her depth + 1.5 - in front of her, a flat
    // silhouette over her whole body - and every follower trailed her by a frame (6 art px at a run)
    w.events.on(Phaser.Scenes.Events.POST_UPDATE, () => {
      this.stepEdge();
      this.stepContact(this.lastDelta);
      this.stepSeeThrough(this.lastDelta);
      this.stepLow();
      this.stepFront();
      this.stepHalo();
    });
    const scene = this.scene;
    const x = this.x0 * T;
    const y = this.y0 * T;
    const textures = w.textures;
    if (this.tiles) {
      this.buildStream(x, y);
      return;
    }
    const normalOf = (key: string, normal: string): void => {
      textures.get(key).setDataSource(textures.get(normal).getSourceImage() as HTMLImageElement);
    };
    normalOf('painted:ground', 'painted:ground-n');
    normalOf('painted:walls', 'painted:walls-n');
    normalOf('painted:objects', 'painted:objects-n');
    w.lights.enable();
    this.sun = w.lights.addLight(0, 0, 1e9, 0xffffff, 1, 1);

    const lay = (key: string, depth: number): Phaser.GameObjects.Image => {
      const img = w.add.image(x, y, key).setOrigin(0).setScale(1 / ART).setDepth(depth);
      w.noCast.add(img);
      return img;
    };
    lay('painted:ground', 0.5).setLighting(true);
    this.wallShade = lay(this.makeWallShade(), 0.53).setBlendMode(Phaser.BlendModes.MULTIPLY);
    lay('painted:walls', 0.55).setLighting(true);

    const sheet = textures.get('painted:objects');
    // two sheets of sheared copies: what leaned before low growth did (its shadow is read at the density of a sheet nobody registered, as it always was),
    // and low growth, whose shadow is read at the density of the picture it was cut from, as it always was
    const windKeys = { tall: this.bakeWind(false), low: this.bakeWind(true) };
    this.readSheetAlpha();
    this.readFootLine();
    this.origin = [x, y];
    this.buildCover(x, y);
    for (const o of scene.objects) {
      const lean = pieceLean(o);   // a part of the mass is cut at ground-line bands: neighbours must not sway out of phase, so none leans (the whole mass leaned 3 px as one)
      const name = `${o.i}:0`;
      if (!lean) sheet.add(name, 0, o.sx, o.sy, o.w, o.h);
      const cx = x + (o.x0 + o.w / 2) / ART;
      const bottom = y + (o.y0 + o.h) / ART;
      const spr = w.add.sprite(cx, bottom, lean ? (castPad(o.kind, o.h) > 0 ? windKeys.tall : windKeys.low) : 'painted:objects', name);
      // with a foot-line map the mass lies under everything that stands; what stands in front of the figure is drawn again over her (stepFront)
      const low = !!this.footline && isMassPiece(o, scene);
      spr.setOrigin(0.5, 1).setScale(1 / ART).setDepth(low ? Math.max(y + 0.5, 3.6) : (o.fy + 1) / ART + y).setLighting(true).setData('rest', lean ? `${o.i}:r` : name);
      w.noCast.add(spr);
      this.sprites.push(spr);
      this.spriteObj.push(o);
      if (lean) {
        const l: Leaner = { o, spr, lean, shown: 0 };
        if (GROUND_COVER.has(o.kind)) {
          // the foot's cell: a wall's top or the water gives no sway; everything else is ground
          const cell = scene.cells[Math.min(scene.rows - 1, Math.max(0, Math.floor(o.fy / scene.cell)))]?.[Math.min(scene.cols - 1, Math.max(0, Math.floor(o.fx / scene.cell)))];
          l.cover = { gate: cell === '#' || cell === '~' ? 0 : 1, shade: 1, push: 0 };
          this.covers.push(l);
        }
        this.leaners.push(l);
      }
    }

    // the water lies over the shadow layers and reads them from its own copy, because a shadow takes less off water than off land
    const shade = textures.createCanvas('painted:water-shade', scene.width, scene.height);
    if (!shade) throw new Error('painted: the water shade was refused');
    this.waterShade = shade;
    if (scene.river.sLength) this.water = w.add.shader(
      {
        name: 'painted-water',
        fragmentSource: WATER_FS,
        setupUniforms: (set: (name: string, value: unknown) => void) => {
          ['uD', 'uBed', 'uS', 'uN', 'uRefl', 'uLut', 'uTiles', 'uShade'].forEach((u, i) => set(u, i));
          set('uSize', [scene.width, scene.height]);
          set('uTint', this.tintOfWater);
          set('uReflTint', this.reflTint);
          set('uSun', this.sunOfWater);
          set('uFade', this.hold.has('shadow') ? 0 : this.fadeOfWater);
          set('uSpec', this.specOfWater);
          set('uSparkle', this.sparkleOfWater);
          set('uWarm', this.warmOfWater);
          set('uL', this.sunDir);
          set('uTime', this.waterTime);
          set('uSTop', scene.river.sTop);
          set('uNTop', scene.river.nTop);
          set('uStage', this.waterStage);
          set('uMeans', this.tileMeans);
        },
      } as unknown as Phaser.Types.GameObjects.Shader.ShaderQuadConfig,
      x,
      y,
      scene.width / ART,
      scene.height / ART,
      ['painted:water-d', 'painted:water-bed', 'painted:flow-s', 'painted:flow-n', 'painted:water-refl', 'painted:water-lut', 'painted:water-tiles', 'painted:water-shade'],
    ) as Phaser.GameObjects.Shader;
    this.water?.setOrigin(0).setDepth(2.6);
    if (!scene.river.sLength) {
      const still = new StillWater(w, x, y, scene, ART, () => this.waterTime, 'painted:water-shade', 2.6, () => !this.hold.has('flatwater'), () => this.hold.has('sunlane'), () => !this.hold.has('plainmarks'), () => this.hold.has('snow'));
      if (still.any) this.still = still;
    }

    this.buildFog(x, y);

    const start = this.firstFree();
    this.animalAt = [start[0], start[1]];
    this.animal = w.add.sprite(0, 0, 'painted:lynx-idle-down', 0).setScale(1 / ART).setLighting(true);
    w.noCast.add(this.animal);
    this.showAnimal('idle-down', 0);
    this.placeAnimal(start[0], start[1]);
  }

  /**
   * A streamed land (V5b): its units come in as the player nears them (painted-stream.ts), each unit's ground and walls an image of its own and its pieces cut from its own
   * sheet. A piece's sprite is made now, hidden, and shows once its unit's sheet is a texture, so every list that runs by the scene's piece index stays as it is. The light is
   * flat until a unit's relief lands (line 7 of the V5b note). What reads the whole land (the wind's sheets, the wall shade, the water, the fog, the cover, the pieces' alpha)
   * waits for its own per-unit bake.
   */
  private buildStream(x: number, y: number): void {
    const w = this.world;
    const tiles = this.tiles!;
    w.lights.enable();
    this.sun = w.lights.addLight(0, 0, 1e9, 0xffffff, 1, 1);
    this.origin = [x, y];
    for (const o of this.scene.objects) {
      const spr = w.add.sprite(x + (o.x0 + o.w / 2) / ART, y + (o.y0 + o.h) / ART, '__DEFAULT');
      spr.setOrigin(0.5, 1).setScale(1 / ART).setDepth((o.fy + 1) / ART + y).setLighting(true).setVisible(false).setData('rest', `${o.i}:0`);
      w.noCast.add(spr);
      this.sprites.push(spr);
      this.spriteObj.push(o);
    }
    const early = this.early;
    this.stream = new PaintedStream<Blob | HTMLImageElement, ImageBitmap>(
      tiles.units,
      this.base,
      {
        fetch: (url) => {
          const key = this.earlyKeyOf(url);
          return key && early.has(key) ? early.get(key)! : BROWSER_EARLY.fetch(url);
        },
        // an ImageBitmap, made off the main thread: the texture upload of a decoded <img> copied it again on the main thread (17 to 46 ms a layer, twice per texture, on this laptop's GPU),
        // from a bitmap it is 2 to 3 ms (the stutter bars of the preview, private #44)
        decode: (b) => createImageBitmap(b),
        upload: (key, img, layer, unit) => this.uploadUnit(key, img, layer, unit),
        band: (key) => this.bandUnit(key),
        drop: (key, layer, unit, was) => this.dropUnit(key, layer, unit, was),
        failed: (key, e) => console.warn(`painted: ${key} did not load (${String(e)})`),
      },
      () => performance.now(),
      STREAM,
    );
    const start = this.firstFree();
    this.animalAt = [start[0], start[1]];
    this.animal = w.add.sprite(0, 0, 'painted:lynx-idle-down', 0).setScale(1 / ART).setLighting(true);
    w.noCast.add(this.animal);
    this.showAnimal('idle-down', 0);
    this.placeAnimal(start[0], start[1]);
  }

  /** the early fetch's key of a unit file (mountPainted starts the units round the start before the boot) */
  private earlyKeyOf(url: string): string | undefined {
    const m = /tiles\/(.+)-(\d+)-(\d+)\.webp$/.exec(url);
    return m ? `painted:${m[1]}@${m[2]},${m[3]}` : undefined;
  }

  /**
   * A layer's texture: before the land is first lit, made whole in this frame (first light waits for nothing); after, made empty and laid by bands of BAND_ROWS, one band a
   * frame (bandUnit), and the scene builds on it once the last is in.
   */
  private uploadUnit(key: string, img: ImageBitmap, layer: StreamLayerMeta, unit: StreamUnitMeta): void | 'bands' {
    return timed(`up.${layer.name}`, () => {
      if (this.litSince !== undefined && !this.hold.has('nobands') && this.startBands(key, img, layer, unit)) return 'bands';
      if (!this.world.textures.exists(key)) this.world.textures.addImage(key, img as unknown as HTMLImageElement);
      this.layUnit(key, layer, unit);
      return undefined;
    });
  }

  /**
   * The texture of `key` made empty (bandStorage) under the bitmap as its image, which is what the CPU readers draw from, and its bands to lay, one a frame (bandUnit). False
   * when the renderer offers no way or the layer is one band (the whole upload then).
   */
  private startBands(key: string, img: ImageBitmap, layer: StreamLayerMeta, unit: StreamUnitMeta): boolean {
    const textures = this.world.textures;
    if (textures.exists(key) || img.height <= BAND_ROWS) return false;
    const tex = this.bandStorage(img.width, img.height);
    if (!tex) return false;
    const t = textures.addGLTexture(key, tex as unknown as Phaser.Renderer.WebGL.Wrappers.WebGLTextureWrapper);
    if (!t) {
      tex.destroy();
      return false;
    }
    t.source[0]!.image = img as unknown as HTMLImageElement;
    const gen = this.laidByBands(tex, img, `band.${layer.name}`);
    gen.next(); // the cuts start now, off the main thread
    this.bandJobs.set(key, { gen, layer, unit });
    return true;
  }

  /** A layer laid by bands: its next band, and once the last is in, what the scene builds on it. True then. */
  private bandUnit(key: string): boolean {
    const job = this.bandJobs.get(key);
    if (!job) return true;
    if (!job.gen.next().done) return false;
    this.bandJobs.delete(key);
    timed(`up.${job.layer.name}`, () => this.layUnit(key, job.layer, job.unit));
    return true;
  }

  /**
   * A texture's normal map set to another texture's storage, shared, not copied. A new source in a pixel-art game sets its filter, and Phaser's filter call uploads the storage again
   * from its pixels in this frame (a whole upload's cost; a storage laid by bands it emptied: the relief then lit as zero normals, darker everywhere). The storage was made with
   * that filter (bandStorage, addImage), so the one call is skipped for this join.
   */
  private shareStorage(tex: Phaser.Textures.Texture, store: BandTex): void {
    const up = store.update;
    store.update = () => undefined;
    try {
      tex.setDataSource(store as unknown as HTMLImageElement);
    } finally {
      store.update = up;
    }
  }

  /** An empty texture storage of w x h, made by the renderer's own call with the scale mode and flip a texture from an image gets, so it is the storage the whole upload would give. */
  private bandStorage(w: number, h: number, flipY = true): BandTex | undefined {
    const r = this.world.sys.game.renderer as unknown as BandGL;
    if (!r.gl || !r.glTextureUnits || !r.glWrapper || !r.createTextureFromSource) return undefined;
    return r.createTextureFromSource(null, w, h, Phaser.ScaleModes.DEFAULT, false, flipY);
  }

  /**
   * A texture made after first light, uploaded once (B4a, private #44 H): `addImage` uploads the picture, and a pixel-art game's filter call uploads it a second time in the same
   * frame. Here the storage is made empty (bandStorage) and the picture laid into it by one texSubImage2D, so the source `put` lays (a bitmap, or a canvas, flipped as a texture of
   * an image is) goes up once. The texture's image, which the CPU readers draw from, is `image`. Undefined when the renderer offers no way (the caller takes the whole upload).
   */
  private textureOnce(key: string, w: number, h: number, flipY: boolean, image: CanvasImageSource, put: (gl: WebGLRenderingContext) => void): Phaser.Textures.Texture | undefined {
    if (this.hold.has('nobands4a') || (key.startsWith('painted:wall-shade') ? this.hold.has('noshade4a') : this.hold.has('nobitmap4a')) || this.litSince === undefined) return undefined;
    const store = this.bandStorage(w, h, flipY);
    if (!store) return undefined;
    const textures = this.world.textures;
    const t = textures.addGLTexture(key, store as unknown as Phaser.Renderer.WebGL.Wrappers.WebGLTextureWrapper);
    if (!t) {
      store.destroy();
      return undefined;
    }
    t.source[0]!.image = image as unknown as HTMLImageElement;
    this.laidOnce(store, put);
    return t;
  }

  /** A picture laid into a texture's storage whole, by one texSubImage2D (`put`), with the flip and premultiply the storage was made with. */
  private laidOnce(store: BandTex, put: (gl: WebGLRenderingContext) => void): void {
    const r = this.world.sys.game.renderer as unknown as BandGL;
    timed('once', () => {
      r.glTextureUnits!.bind(store, 0);
      r.glWrapper!.updateTexturing({ texturing: { flipY: store.flipY, premultiplyAlpha: store.pma } });
      put(r.gl!);
      store.generateMipmap();
    });
  }

  /**
   * A bitmap laid into a texture's storage by bands of at most BAND_ROWS rows, one band a step (texSubImage2D, as painted-front's uploadDirect does). The bands are cut from the
   * bitmap off the main thread first (the steps before they are made do nothing). Rows are counted from the top as the whole upload stores them: a bitmap's upload ignores the
   * flip and premultiply flags (WebGL 1.0, 5.14.8), so each band lands where its rows would. A generator dropped half way, or whose `alive` turns false, stops and closes its cuts;
   * it returns whether the last band went in.
   */
  private *laidByBands(tex: BandTex, img: ImageBitmap, name: string, alive: () => boolean = () => true): Generator<void, boolean, void> {
    const n = Math.ceil(img.height / BAND_ROWS);
    const bh = Math.ceil(img.height / n);
    const rows: [number, number][] = [];
    for (let y = 0; y < img.height; y += bh) rows.push([y, Math.min(bh, img.height - y)]);
    let cuts: ImageBitmap[] | undefined;
    let failed = false;
    let over = false;
    Promise.all(rows.map(([y, h]) => createImageBitmap(img, 0, y, img.width, h))).then(
      (c) => {
        if (over) for (const b of c) b.close();
        else cuts = c;
      },
      (e: unknown) => {
        // no cuts: the bitmap goes up whole, in the next step
        console.warn(`painted: a ${img.width} x ${img.height} picture could not be cut into bands (${String(e)})`);
        failed = true;
      },
    );
    try {
      while (!cuts && !failed) yield;
      if (!alive()) return false;
      const r = this.world.sys.game.renderer as unknown as BandGL;
      const gl = r.gl!;
      const put = (src: ImageBitmap, y: number): void =>
        timed(name, () => {
          r.glTextureUnits!.bind(tex, 0);
          r.glWrapper!.updateTexturing({ texturing: { flipY: tex.flipY, premultiplyAlpha: tex.pma } });
          gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, y, gl.RGBA, gl.UNSIGNED_BYTE, src);
        });
      if (!cuts) put(img, 0);
      else
        for (let i = 0; i < cuts.length; i++) {
          if (i > 0) yield;
          if (!alive()) return false;
          put(cuts[i]!, rows[i]![0]);
          cuts[i]!.close();
        }
      tex.generateMipmap();
      // what a whole upload's storage holds as its source: Phaser's filter call uploads a storage again from it (null would empty it)
      tex.pixels = img;
      return true;
    } finally {
      over = true;
      for (const b of cuts ?? []) b.close();
    }
  }

  /** What a layer whose texture is whole builds: the relief joined to its colour, the ground and walls images, the pieces on the objects sheet. */
  private layUnit(key: string, layer: StreamLayerMeta, unit: StreamUnitMeta): void {
    const w = this.world;
    const textures = w.textures;
    const [x, y] = this.origin;
    const relief = layer.name.endsWith('-n');
    const colourKey = relief ? layerKey(unit, layer.name.slice(0, -2)) : key;
    const normalKey = relief ? key : layerKey(unit, `${layer.name}-n`);
    // the relief joins its colour whichever is whole first; the colour's normal map is the relief's own texture, not a second copy of it (that copy was half a relief's upload)
    if (textures.exists(colourKey) && textures.exists(normalKey) && !this.bandJobs.has(colourKey) && !this.bandJobs.has(normalKey)) {
      const relief = textures.get(normalKey).source[0]!;
      if (this.hold.has('nobands') || this.hold.has('copyrelief')) textures.get(colourKey).setDataSource(relief.image as HTMLImageElement);
      else this.shareStorage(textures.get(colourKey), relief.glTexture as unknown as BandTex);
    }
    if (relief) return;
    if (layer.name === 'ground' || layer.name === 'walls') {
      const im = w.add.image(x + unit.x / ART, y + unit.y / ART, key).setOrigin(0).setScale(1 / ART).setDepth(layer.name === 'ground' ? 0.5 : 0.55).setLighting(true);
      w.noCast.add(im);
      if (layer.name === 'ground') this.startGrass(key, unit, im);
      this.unitImgs.set(key, im);
      if (layer.name === 'walls') this.shadeQueue.push({ unit, on: true, first: true });
      return;
    }
    if (layer.name !== 'objects') return;
    const tex = textures.get(key);
    const ui = this.tiles!.units.findIndex((u) => u.ux === unit.ux && u.uy === unit.uy);
    this.tiles!.pieces.forEach((at, i) => {
      if (!at || at[0] !== ui) return;
      const o = this.scene.objects[i]!;
      const name = `${o.i}:0`;
      if (!tex.has(name)) tex.add(name, 0, at[1], at[2], o.w, o.h);
      const spr = this.sprites[i];
      if (spr) spr.setTexture(key, name).setVisible(true);
    });
    this.alphaQueue.push(unit);
    this.litMinute = -1;
  }

  /** The meadow's pass on a ground unit's image, once its mask is in: a land with no mask for it leaves the unit as it was. */
  private startGrass(key: string, unit: StreamUnitMeta, im: Phaser.GameObjects.Image): void {
    const mask = this.tiles?.grass?.mask;
    if (!mask) return;
    try {
      if (!installGrass(this.world.game)) return;
    } catch {
      return; // a renderer without custom filters still plays; the meadow holds still
    }
    const ui = this.tiles!.units.findIndex((u) => u.ux === unit.ux && u.uy === unit.uy);
    const file = mask[ui];
    if (!file) return;
    const mk = `painted:grass@${unit.ux},${unit.uy}`;
    const entry: { im: Phaser.GameObjects.Image; mk: string; ctl?: GrassPass } = { im, mk };
    this.grassUnits.set(key, entry);
    BROWSER_EARLY.fetch(`${this.base}/${file}`)
      .then((b) => this.decodeBoth(b))
      .then((img) => this.later('grass-mask', () => {
        if (this.grassUnits.get(key) !== entry) {
          img[0].close();
          img[1].close();
          return;
        }
        const tex = this.bitmapTex(mk, img); // nearest from its making (a mask is read pixel for pixel, never blended)
        im.enableFilters();
        entry.ctl = new GrassPass(this.world.cameras.main, tex, [unit.w, unit.h], [unit.x, unit.y], [this.wind.x, this.wind.y, this.wind.speed * TILE_PX]);
        im.filters?.internal.add(entry.ctl);
      }))
      .catch((e: unknown) => console.warn(`painted: ${file} did not load (${String(e)})`));
  }

  /** The meadow's clock, the walker and the hold, each frame: `hold=grass` takes the pass off (every pixel the plate's own; `hold=wind` stops the leaning pieces and leaves the meadow to `grass`). */
  private stepGrass(time: number, delta: number): void {
    if (!this.grassUnits.size) return;
    const held = this.hold.has('grass');
    const w = this.world;
    const near = w.player.visible && !this.hold.has('grass');
    const dt = Math.min(0.1, delta / 1000);
    const target = near ? 1 : 0;
    this.grassBend += (target - this.grassBend) * (1 - Math.exp(-dt / (target > this.grassBend ? BEND.over : BEND.back)));
    if (target === 0 && this.grassBend < 0.02) this.grassBend = 0;
    const fx = w.body.x - this.x0 * 64;
    const fy = w.body.y - this.y0 * 64;
    for (const { ctl } of this.grassUnits.values()) {
      if (!ctl) continue;
      ctl.time = this.grassClock ?? time / 1000;
      ctl.amp = held || this.hold.has('grassamp0') ? 0 : this.wind.k;
      ctl.wind = [this.wind.x, this.wind.y, this.wind.speed * TILE_PX];
      ctl.fig = [fx, fy, near ? 1 : 0];
      ctl.bend = this.grassBend;
      ctl.show = this.hold.has('grassmap') ? 1 : 0;
      ctl.active = !held && !this.hold.has('nomeadow'); // held: the pass is off, the plate goes the old way, so the rest frame is the old picture itself (`grassamp0` keeps it running at amp 0, to measure what the filter's own path costs)
    }
  }

  private dropUnit(key: string, layer: StreamLayerMeta, unit: StreamUnitMeta, was: boolean): void {
    if (!was) return;
    const textures = this.world.textures;
    this.bandJobs.get(key)?.gen.return(false);
    this.bandJobs.delete(key);
    this.unitImgs.get(key)?.destroy();
    this.unitImgs.delete(key);
    if (layer.name === 'objects') {
      const ui = this.tiles!.units.findIndex((u) => u.ux === unit.ux && u.uy === unit.uy);
      this.tiles!.pieces.forEach((at, i) => {
        if (!at || at[0] !== ui) return;
        this.sprites[i]?.setTexture('__DEFAULT').setVisible(false);
        this.pieceAlpha.delete(i);
        this.standingFull = true;
        this.standingStale = true;
      });
      this.dropUnitWind(unit, ui);
      this.tiles!.pieces.forEach(() => {
      });
    }
    if (layer.name === 'ground') this.unitPlate.delete(`${unit.ux},${unit.uy}`);
    if (layer.name === 'ground') {
      const g = this.grassUnits.get(key);
      this.grassUnits.delete(key);
      if (g && textures.exists(g.mk)) textures.remove(g.mk);
    }
    if (layer.name === 'walls') this.shadeQueue.push({ unit, on: false });
    if (textures.exists(key)) textures.remove(key);
  }

  /** The stream's step: the player's feet and the camera's view in scene px. */
  private stepStream(): void {
    const st = this.stream;
    if (!st) return;
    const w = this.world;
    const v = w.cameras.main.worldView;
    const ox = this.x0 * T;
    const oy = this.y0 * T;
    st.tick({ player: [(w.player.x - ox) * ART, (w.player.y - oy) * ART], view: { x: (v.x - ox) * ART, y: (v.y - oy) * ART, w: v.width * ART, h: v.height * ART } });
  }

  /**
   * The fog layer, only for a land whose hours say they have fog. Above every piece (fog is the air's, over the picture), its noise a CPU tile, its
   * mask the tall pieces' top thirds (look.ts fogLetThrough): written once here from the sheet's alpha. Not named `fx-` or `senses-`: the mount
   * hides the valley's own air by those names.
   */
  private buildFog(x: number, y: number): void {
    if (!this.rows.some((h) => h.fog) && !this.hold.has('fogland')) return;
    const w = this.world;
    const { width, height } = this.scene;
    const textures = w.textures;
    const noise = textures.createCanvas('painted:fog-noise', NOISE_SIZE, NOISE_SIZE);
    const mask = textures.createCanvas('painted:fog-mask', width, height);
    if (!noise || !mask) throw new Error('painted: the fog textures were refused');
    noise.getContext().putImageData(new ImageData(fogNoise(NOISE_SIZE, FOG_NOISE.seed) as unknown as Uint8ClampedArray<ArrayBuffer>, NOISE_SIZE, NOISE_SIZE), 0, 0);
    noise.refresh();
    const m = new Uint8ClampedArray(width * height * 4);
    for (let i = 3; i < m.length; i += 4) m[i] = 255;
    const sheet = this.sheetAlpha;
    const sw = this.scene.sheet.w;
    if (sheet) {
      for (const o of this.scene.objects) {
        // tall pieces only: a tree, a ruin, a pillar rises out of the fog; low growth and stones stand in it
        if (!risesOutOfFog(o.kind, o.h)) continue;
        for (let r = 0; r < o.h; r++) {
          const up = fogUp(o.kind, o.h, r);
          const let_ = 1 - fogLetThrough(up, true);
          if (let_ <= 0) continue;
          const gy = o.y0 + r;
          if (gy < 0 || gy >= height) continue;
          for (let c = 0; c < o.w; c++) {
            const gx = o.x0 + c;
            if (gx < 0 || gx >= width) continue;
            if ((sheet[((o.sy + r) * sw + o.sx + c) * 4 + 3] ?? 0) < 128) continue;
            const k = (gy * width + gx) * 4;
            const v = Math.round(let_ * 255);
            if (v > m[k]!) {
              m[k] = v;
              m[k + 1] = v;
              m[k + 2] = v;
            }
          }
        }
      }
    }
    mask.getContext().putImageData(new ImageData(m as unknown as Uint8ClampedArray<ArrayBuffer>, width, height), 0, 0);
    mask.refresh();
    const form = FOG_FORM;
    this.fog = w.add.shader(
      {
        name: 'painted-fog',
        fragmentSource: FOG_FS,
        setupUniforms: (set: (name: string, value: unknown) => void) => {
          ['uNoise', 'uMask'].forEach((u, i) => set(u, i));
          set('uSize', [width, height]);
          set('uColour', this.fogRgb);
          const d = this.fogOf;
          set('uDensity', d ? [d.bottom, d.top] : [0, 0]);
          set('uTime', this.fogTime);
          set('uPace', this.fogPace());
          set('uWalker', [w.body.x - this.x0 * 64, height - (w.body.y - this.y0 * 64)]); // the quad's y runs up (the density's and the mask's are flipped to match): so is the walker's
          set('uClear', FOG_CLEAR.clear);
          set('uRing', FOG_CLEAR.ring);
          set('uShow', this.hold.has('fogmap') ? 1 : 0);
          set('uCap', form.cap);
          set('uForm', [form.gain, form.floor, form.lo, form.hi]);
        },
      } as unknown as Phaser.Types.GameObjects.Shader.ShaderQuadConfig,
      x,
      y,
      width / ART,
      height / ART,
      ['painted:fog-noise', 'painted:fog-mask'],
    ) as Phaser.GameObjects.Shader;
    this.fog.setOrigin(0).setDepth(y + 4000).setBlendMode(Phaser.BlendModes.SCREEN);
    this.fogAt = [x, y];
  }

  /** Round 12, the lit fog (default since 16.11) is built the first time an hour asks for it (its own program, the shipped fog is not touched). */
  private buildFogLit(): void {
    if (this.fogLit || !this.fogAt || this.tiles) return;
    const w = this.world;
    const { width, height } = this.scene;
    const textures = w.textures;
    // the walls' distance per art pixel (the lit fog's low-ground proxy), quarter art pixels in red
    const wc = document.createElement('canvas');
    wc.width = width;
    wc.height = height;
    const wx = wc.getContext('2d', { willReadFrequently: true });
    if (!wx) throw new Error('no 2d context');
    wx.drawImage(textures.get('painted:walls').getSourceImage() as CanvasImageSource, 0, 0);
    const wd = wx.getImageData(0, 0, width, height).data;
    const aw = Math.floor(width / ART);
    const ah = Math.floor(height / ART);
    const walls = new Uint8Array(aw * ah);
    for (let y = 0; y < ah * ART; y++) for (let x = 0; x < aw * ART; x++) if ((wd[(y * width + x) * 4 + 3] ?? 0) >= 128) walls[Math.floor(y / ART) * aw + Math.floor(x / ART)] = 1;
    const dist = distanceTo(walls, aw, ah);
    // the low ground (order v11): the water's share within FOG_HOLLOW.reach art pixels, in green (the scene's water mask is the bed's green, 255 on water)
    const water = new Uint8Array(aw * ah);
    if (textures.exists('painted:water-bed')) {
      wx.clearRect(0, 0, width, height);
      wx.drawImage(textures.get('painted:water-bed').getSourceImage() as CanvasImageSource, 0, 0);
      const bd = wx.getImageData(0, 0, width, height).data;
      for (let y = 0; y < ah * ART; y++) for (let x = 0; x < aw * ART; x++) if ((bd[(y * width + x) * 4 + 1] ?? 0) >= 128) water[Math.floor(y / ART) * aw + Math.floor(x / ART)] = 1;
    }
    const low = lownessOf(water, aw, ah, FOG_HOLLOW.reach);
    const wallTex = textures.createCanvas('painted:fog-wall', aw, ah);
    if (!wallTex) throw new Error('painted: the fog wall field was refused');
    const wp = new Uint8ClampedArray(aw * ah * 4);
    for (let i = 0; i < aw * ah; i++) {
      wp[i * 4] = Math.min(255, Math.round(dist[i]! * 8));
      wp[i * 4 + 1] = low[i]!;
      wp[i * 4 + 3] = 255;
    }
    wallTex.getContext().putImageData(new ImageData(wp as unknown as Uint8ClampedArray<ArrayBuffer>, aw, ah), 0, 0);
    wallTex.refresh();
    wallTex.setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.fogLit = this.fogLitQuad({ x: 0, y: 0, w: width, h: height }, ['painted:fog-noise', 'painted:fog-mask', 'painted:fog-wall', 'painted:ground']);
  }

  /** The lit fog over one rectangle of the scene (scene px): the whole land, or a streamed land's unit with its own mask and ground. */
  private fogLitQuad(r: { x: number; y: number; w: number; h: number }, keys: string[]): Phaser.GameObjects.Shader {
    const w = this.world;
    const { width, height } = this.scene;
    const [fx, fy] = this.fogAt!;
    const unit = [r.x / width, (height - r.y - r.h) / height, r.w / width, r.h / height];
    const form = FOG_FORM;
    return (w.add.shader(
      {
        name: 'painted-fog-lit',
        fragmentSource: FOG_LIT_FS,
        setupUniforms: (set: (name: string, value: unknown) => void) => {
          ['uNoise', 'uMask', 'uWall', 'uPlate'].forEach((u, i) => set(u, i));
          set('uSize', [width, height]);
          set('uUnit', unit);
          const d = this.fogOf;
          set('uDensity', d ? [d.bottom, d.top] : [0, 0]);
          set('uTime', this.fogTime);
          set('uPace', this.fogPace());
          set('uBank', this.fogBank());
          set('uWalker', [w.body.x - this.x0 * 64, height - (w.body.y - this.y0 * 64)]); // the quad's y runs up (the density's and the mask's are flipped to match): so is the walker's
          set('uClear', FOG_CLEAR.clear);
          set('uRing', FOG_CLEAR.ring);
          set('uShow', this.hold.has('fogmap') ? 1 : 0);
          set('uDbg', this.hold.has('foglow') ? 8 : this.hold.has('fogrow') ? 7 : this.hold.has('fogy') ? 6 : this.hold.has('fogground') ? 4 : this.hold.has('fogwall') ? 3 : 1);
          set('uFlat', this.fogLight.flat);
          set('uSky', this.fogSky);
          set('uRidge', FOG_HOLLOW.ridge);
          set('uBurn', this.fogBurn);
          set('uCut', FOG_BURN.cut);
          set('uEven', this.hold.has('noeven') ? 0 : FOG_EVEN.k);
          set('uThin', this.hold.has('nothin') ? 1 : FOG_EVEN.thin);
          set('uCap', form.cap);
          set('uForm', [form.gain, form.floor, form.lo, form.hi]);
        },
      },
      fx + r.x / ART,
      fy + r.y / ART,
      r.w / ART,
      r.h / ART,
      keys,
    ) as Phaser.GameObjects.Shader)
      .setOrigin(0)
      .setDepth(fy + 4000)
      .setBlendMode(this.hold.has('fogmap') ? Phaser.BlendModes.NORMAL : Phaser.BlendModes.SCREEN);
  }

  /**
   * The cover's shade (the owner's note L8, 12.11): what a standing piece's pixels cover, taken once onto the grid of painted-cover.ts, and one image over the ground that
   * the sun's rays are baked into when the sun moves. The rule is the same on every land; `nocover` switches it off (and the mass skip with it), `nocovershade` takes away only the shade (a measure's lever).
   */
  private buildCover(x: number, y: number): void {
    const alpha = this.sheetAlpha;
    if (!alpha) return;
    const { width, height } = this.scene;
    const sw = this.scene.sheet.w;
    const cover = new Uint8Array(width * height);
    for (const o of this.scene.objects) {
      if (!CANOPY.has(o.kind)) continue;
      for (let r = 0; r < o.h; r++) {
        const gy = o.y0 + r;
        if (gy < 0 || gy >= height) continue;
        for (let c = 0; c < o.w; c++) {
          const gx = o.x0 + c;
          if (gx < 0 || gx >= width) continue;
          if ((alpha[((o.sy + r) * sw + o.sx + c) * 4 + 3] ?? 0) >= 128) cover[gy * width + gx] = 1;
        }
      }
    }
    this.layCover(coverMasks(cover, width, height), x, y);
  }

  /** The cover's masks laid as the shade image under the walls (lightCover bakes it at the sun's angle): from the mount's own reading, or a streamed land's bake. */
  private layCover(m: CoverMasks, x: number, y: number): void {
    this.coverM = m;
    const w = this.world;
    const key = 'painted:cover-shade';
    if (w.textures.exists(key)) w.textures.remove(key);
    const tex = w.textures.createCanvas(key, m.w, m.h);
    if (!tex) throw new Error('painted: the cover shade was refused');
    tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.coverTex = tex;
    const tmp = document.createElement('canvas');
    tmp.width = m.w;
    tmp.height = m.h;
    this.coverTmp = tmp;
    this.coverData = new Uint8ClampedArray(m.w * m.h * 4);
    const img = w.add.image(x, y, key).setOrigin(0).setScale(COVER.half / ART).setDepth(0.52).setBlendMode(Phaser.BlendModes.MULTIPLY).setVisible(false);
    w.noCast.add(img);
    this.coverImg = img;
  }

  /** The cover's shade at the clock: baked again only when the sun's rays (their cells) change, shown with the shadow's own tint. */
  private lightCover(minute: number, tint: number): void {
    const img = this.coverImg;
    const m = this.coverM;
    const tex = this.coverTex;
    const tmp = this.coverTmp;
    const data = this.coverData;
    if (!img || !m || !tex || !tmp || !data) return;
    const d = sunAt(sunTableOf(this.bundle.params.light?.sun as never), minute);
    const on = d.up && !this.hold.has('nocover') && !this.hold.has('nocovershade') && !this.hold.has('shadow');
    img.setVisible(on);
    if (!on) return;
    img.setTint(tint);
    const k = `${d.sx.toFixed(3)},${d.sy.toFixed(3)}`;
    if (k === this.coverSun) return;
    this.coverSun = k;
    if (this.stream) {
      // a streamed land bakes it in slices inside the frame's budget (stepCoverBake); the shade shown stays the last one until the new one is whole
      const out = new Uint8ClampedArray(m.w * m.h * 4);
      this.coverJob = { gen: coverBakeSteps(m, d.sx, d.sy, out), out, m, tex, tmp };
      return;
    }
    coverBake(m, d.sx, d.sy, data);
    const t = tmp.getContext('2d');
    const ctx = tex.getContext();
    if (!t) return;
    t.putImageData(new ImageData(data as unknown as Uint8ClampedArray<ArrayBuffer>, m.w, m.h), 0, 0);
    ctx.clearRect(0, 0, m.w, m.h);
    ctx.drawImage(tmp, 0, 0);
    tex.refresh();
  }

  /** How much of the cover's shade lies on an art pixel of the picture now (0 to 1): the figure's and the low pieces' share of the light the cover takes. */
  coverShadeOf(ax: number, ay: number): number {
    const m = this.coverM;
    if (!m || this.hold.has('nocover') || this.hold.has('nocovershade') || this.hold.has('shadow')) return 0;
    const d = sunAt(sunTableOf(this.bundle.params.light?.sun as never), Math.floor(this.minuteNow()));
    if (!d.up) return 0;
    return coverAt(m, ax, ay, d.sx, d.sy);
  }

  /** The walls' shape, for their own shadow: white where a wall is, softened as the standard softens it. */
  private makeWallShade(): string {
    const key = 'painted:wall-shade';
    const { width, height } = this.scene;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no 2d context');
    ctx.filter = 'blur(2.4px)';
    ctx.drawImage(this.world.textures.get('painted:walls').getSourceImage() as CanvasImageSource, 0, 0);
    ctx.filter = 'none';
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    this.wallCanvas = canvas;
    if (this.world.textures.exists(key)) this.world.textures.remove(key);
    this.world.textures.addCanvas(key, canvas);
    return key;
  }

  /** The water's own copy of the shadows on it: the shadow pass's canvas and the walls' shadow, re-copied only when one of them moved. */
  private copyShade(): void {
    const tex = this.waterShade;
    const cast = this.world.cast;
    if (!tex || !cast) return;
    const version = cast.version;
    if (version === this.shadeAt) return;
    this.shadeAt = version;
    const ctx = tex.getContext();
    ctx.clearRect(0, 0, tex.width, tex.height);
    const box = cast.canvasBox();
    const source = this.world.textures.get('cast-standing').getSourceImage() as CanvasImageSource;
    if (box) ctx.drawImage(source, (box.x - this.x0 * T) * ART, (box.y - this.y0 * T) * ART);
    const l = this.lit;
    if (this.wallCanvas && l) ctx.drawImage(this.wallCanvas, Math.trunc(l.wall * 0.7 * 3), Math.trunc(l.wall * 3));
    tex.refresh();
  }

  /** Stops the river's build at a layer, for a still of the first ones. */
  setWaterStage(stage: number): void {
    this.waterStage = stage;
  }

  /** The foot-line map as numbers, proved by the loader's probe; a map that does not decode exactly is left out (the pieces' own sort stays the rule). */
  private readFootLine(): void {
    const meta = this.scene.footline;
    if (!meta || this.hold.has('nodepth')) return;
    const src = this.world.textures.get('painted:footline').getSourceImage() as CanvasImageSource & { width: number; height: number };
    const canvas = document.createElement('canvas');
    canvas.width = meta.w;
    canvas.height = meta.h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('no 2d context');
    ctx.drawImage(src, 0, 0);
    const fl: FootLine = { w: meta.w, h: meta.h, data: decodeFootLine(ctx.getImageData(0, 0, meta.w, meta.h).data, meta.w, meta.h) };
    if (src.width !== meta.w || src.height !== meta.h || !footLineOk(fl, meta.probe)) {
      console.warn('painted: the foot-line map did not decode exactly; the depth test is off');
      return;
    }
    this.footline = fl;
    this.massObjs = this.scene.objects.filter((o) => isMassPiece(o, this.scene));
  }

  /**
   * Low bushes cover her feet (order 5): a piece lower than half her drawn height sorts by the bottom of its box and not by its foot, so while her foot is inside the piece's box (the footprint) the
   * piece is drawn over her and covers what lies below its top line, and one step out (her foot below the box) it does not. The shelf carries no tag for "low", so the height rule is used. `hold=nolow` leaves
   * every piece on its foot line (a rig's baseline).
   */
  private stepLow(): void {
    if (this.hold.has('nolow')) return;
    const p = this.world.player;
    if (!p.texture || !p.frame) return;
    if (!this.lowDone) {
      const half = (FIG_REF_ROWS * this.figScale(p)) / 2;
      const y = this.y0 * T;
      this.sprites.forEach((spr, k) => {
        const o = this.spriteObj[k]!;
        if (isMassPiece(o, this.scene) || o.h >= half) return;
        const depth = (o.y0 + o.h + 1) / ART + y - 0.01;   // a hair under her at the same row: the figure's rim copies sit half a pixel under her and a tie would put the bush over them
        spr.setDepth(depth);
        this.lowList.push({ spr, o, depth, under: false });
        this.lowPieces++;
      });
      this.lowDone = true;
    }
    // the footprint is the box in both directions (round 5, R5): her foot beside the box (within her body's reach of its left or right edge, in its rows) is not in the bush, so the bush
    // sinks under her there and does not draw its edge over her calves; in it, above it or farther off, the depth is the box's bottom as before
    const [sx, sy] = this.soleOf(p);
    const X = (sx - this.origin[0]) * ART;
    const Y = (sy - this.origin[1]) * ART;
    const under = p.depth - 1;
    // one step out (her foot just below the box) she is in front of the bush by a hair, and her rim copies (half a depth under her) and her contact shadow (0.6 under) would still sort under
    // it: the bush drew over her outline along her calves (O3, 43 of 90 pixels at p220). While her depth is within that stack of the bush's, the bush sinks to just under the stack.
    const stack = p.depth - STACK_UNDER;
    for (const l of this.lowList) {
      const { x0, y0, w, h } = l.o;
      const beside = p.visible && Y >= y0 && Y < y0 + h && ((X < x0 && X >= x0 - LOW_REACH) || (X >= x0 + w && X < x0 + w + LOW_REACH));
      const front = p.visible && p.depth > l.depth && l.depth > stack;
      const sunk = beside || front;
      if (!sunk && !l.under) continue;
      l.under = sunk;
      const d = beside ? under : front ? stack : l.depth;
      if (l.spr.depth !== d) l.spr.setDepth(d);
    }
  }

  /**
   * The figure against the mass (order 5): the mass is drawn under her, and the pixels of it whose foot row is below hers are drawn again over her, window by window (FrontCut). A standing piece gets the
   * same, once, for the mass pixels in front of its own foot. Nothing is recut while nothing moves.
   */
  private stepFront(): void {
    const fl = this.footline;
    if (!fl) return;
    this.depthCounters.frames++;
    if (this.frontOff) {
      for (const c of this.herCuts.values()) c.hide();
      for (const { cut } of this.pieceCuts) cut.spr.setVisible(false);
      return;
    }
    const w = this.world;
    const p = w.player;
    const [ox, oy] = this.origin;
    if (!this.pieceCutsMade) this.makePieceCuts();
    const [sx, sy] = this.soleOf(p);
    const row = Math.floor((sy - oy) * ART);
    // her box: the drawn figure with room round it, not the whole frame (the frame is three times as wide and half again as tall as she is): the windows are cut and uploaded as pixels, so their size is their cost
    const figH = Math.ceil(FIG_REF_ROWS * this.figScale(p));
    const bw = FRONT_BOX.w;
    const bh = figH + 2 * FRONT_BOX.pad;
    const bx = Math.floor((sx - ox) * ART) - bw / 2;
    const by = row - figH - FRONT_BOX.pad;
    const used = new Set<number>();
    if (p.visible && !this.herOff) {
      for (const o of this.massObjs) {
        if (bx + bw <= o.x0 || bx >= o.x0 + o.w || by + bh <= o.y0 || by >= o.y0 + o.h) continue;
        let cut = this.herCuts.get(o.i);
        if (!cut) {
          cut = new FrontCut(w, o, this.origin, ART, this.sheetPixels()!, bw + 2 * FRONT_BOX.slack, bh + 2 * FRONT_BOX.slack, 'her');
          cut.spr.setDepth(p.depth + 0.9);
          w.noCast.add(cut.spr);
          this.herCuts.set(o.i, cut);
          this.depthCounters.cuts++;
        }
        cut.spr.setDepth(p.depth + 0.9);
        const k = this.stepSeeFront(o, row, sx, sy, p.flipX ? -1 : 1, fl);
        const cap = k > 0 ? this.seeCapsule() : undefined;
        const [cx, cy] = [(sx - ox) * ART, (sy - oy) * ART - (SEE_LOCAL.figH * this.figScale(p)) / 2];
        if (this.herStill && cut.made > 0) { used.add(o.i); continue; }
        cut.show({ x: bx, y: by, w: bw, h: bh }, FRONT_BOX.slack, row, fl, cap ? (x, y) => this.capsuleAt(cap, x - cx, y - cy) * this.seeFade * k : undefined, cap ? `a${k.toFixed(3)}@${Math.floor(cx)},${Math.floor(cy)}` : `a${k.toFixed(3)}`);
        used.add(o.i);
      }
    }
    for (const [i, cut] of this.herCuts) if (!used.has(i)) cut.hide();
    this.depthInfo = { row, box: [bx, by, bw, bh], cuts: [...this.herCuts].map(([i, c]) => [i, c.count]) };
    // a standing piece's window is one draw call whether or not the camera sees it: drawn only while it overlaps the view (a window out of the view changes no pixel)
    const v = w.cameras.main.worldView;
    for (const { cut } of this.pieceCuts) {
      const s = cut.spr;
      const seen = s.x + s.displayWidth >= v.x - VIEW_MARGIN && s.x <= v.right + VIEW_MARGIN && s.y + s.displayHeight >= v.y - VIEW_MARGIN && s.y <= v.bottom + VIEW_MARGIN;
      s.setVisible(seen && !this.pieceOff);
    }
  }

  /**
   * See-through for the mass over her (the pieces thin through their own sprites, stepSeeThrough): when at least `SEE_THROUGH.cover` of the points sampled on her body lie under mass that is in front of her,
   * the window's mask is thinned round her middle by the same capsule, easing in and out as the pieces' masks do. Returns how far open it is (0 to 1).
   */
  private stepSeeFront(o: PaintedObject, row: number, sx: number, sy: number, flip: number, fl: FootLine): number {
    let want = 0;
    if (this.seeThrough && this.hasAlpha()) {
      const [ox, oy] = this.origin;
      this.figScale(this.world.player);   // reads her silhouette points (figPts) the first time
      let n = 0;
      for (const [dx, dy] of this.figPts) {
        const X = Math.floor((sx - ox) * ART + dx * flip);
        const Y = Math.floor((sy - oy) * ART - dy);
        if (X < o.x0 || Y < o.y0 || X >= o.x0 + o.w || Y >= o.y0 + o.h || X < 0 || Y < 0 || X >= fl.w || Y >= fl.h) continue;
        if (fl.data[Y * fl.w + X]! > row && this.alphaAt(o, Y - o.y0, X - o.x0) > 0) n++;
      }
      if (n >= SEE_THROUGH.cover) want = 1;
    }
    const step = this.lastDelta * SEE_LOCAL.perMs;
    const now = this.seeFront.get(o.i) ?? 0;
    const k = want > now ? Math.min(want, now + step) : Math.max(want, now - step);
    this.seeFront.set(o.i, k);
    this.seeAmount = Math.max(this.seeAmount, k);
    return k;
  }

  /** the see-through capsule's alpha pixels (the texture of the pieces' masks), read once */
  private seeCapsule(): { data: Uint8ClampedArray; w: number; h: number } | undefined {
    if (!this.seeTexture()) return undefined;
    const key = this.seeKey();
    if (this.seeCap?.key === key) return this.seeCap;
    const src = this.world.textures.get(key).getSourceImage() as HTMLCanvasElement;
    const data = src.getContext('2d')!.getImageData(0, 0, src.width, src.height).data;
    this.seeCap = { key, data, w: src.width, h: src.height };
    return this.seeCap;
  }

  /** the capsule's alpha (0..1) at an offset in art px from its middle */
  private capsuleAt(cap: { data: Uint8ClampedArray; w: number; h: number }, dx: number, dy: number): number {
    const x = Math.floor(dx + cap.w / 2);
    const y = Math.floor(dy + cap.h / 2);
    if (x < 0 || y < 0 || x >= cap.w || y >= cap.h) return 0;
    return (cap.data[(y * cap.w + x) * 4 + 3] ?? 0) / 255;
  }

  /** The mass's pixels in front of each standing piece's foot, drawn over it (a window the size of the piece's box, cut once). */
  private makePieceCuts(): void {
    const fl = this.footline;
    if (!fl) return;
    const w = this.world;
    const [, oy] = this.origin;
    this.pieceCutsMade = true;
    for (const piece of this.scene.objects) {
      if (isMassPiece(piece, this.scene)) continue;
      for (const m of this.massObjs) {
        if (piece.x0 + piece.w <= m.x0 || piece.x0 >= m.x0 + m.w || piece.y0 + piece.h <= m.y0 || piece.y0 >= m.y0 + m.h) continue;
        const cut = new FrontCut(w, m, this.origin, ART, this.sheetPixels()!, piece.w, piece.h, `p${piece.i}`);
        if (cut.show({ x: piece.x0, y: piece.y0, w: piece.w, h: piece.h }, 0, piece.fy, fl, undefined, 's') === 0) {
          cut.destroy();
          continue;
        }
        cut.spr.setDepth((piece.fy + 1) / ART + oy + 0.01);   // just over its piece: any whole-pixel depth of a standing actor beyond it still sorts by foot (0.5 let a piece a pixel behind her cover her)
        w.noCast.add(cut.spr);
        this.pieceCuts.push({ cut, piece });
      }
    }
  }

  private readSheetAlpha(): void {
    const { w, h } = this.scene.sheet;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('no 2d context');
    ctx.drawImage(this.world.textures.get('painted:objects').getSourceImage() as CanvasImageSource, 0, 0);
    this.sheetAlpha = ctx.getImageData(0, 0, w, h).data;
    if (this.scene.footline) {
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(this.world.textures.get('painted:objects-n').getSourceImage() as CanvasImageSource, 0, 0);
      this.sheetNormal = ctx.getImageData(0, 0, w, h).data;
    }
  }

  /** The sheet's colour and normal pixels, for the front windows (only a land with a foot-line map has them). */
  /** whether the pieces' alpha can be read: the whole sheet's (read at build), or on a streamed land at least one unit's */
  private hasAlpha(): boolean {
    return this.tiles ? this.pieceAlpha.size > 0 : !!this.sheetAlpha;
  }

  /** A piece's alpha at its own row and column (0 to 255): from the whole sheet, or on a streamed land from its unit's sheet once read (0 until then). */
  private alphaAt(o: PaintedObject, r: number, c: number): number {
    if (this.tiles) return this.pieceAlpha.get(o.i)?.[r * o.w + c] ?? 0;
    return this.sheetAlpha?.[((o.sy + r) * this.scene.sheet.w + o.sx + c) * 4 + 3] ?? 0;
  }

  /** a streamed unit's wall shade at the hour's offset and tint */
  private lightShade(im: Phaser.GameObjects.Image): void {
    const k = this.shadeLook;
    if (!k) return;
    const m = /@(\d+),(\d+)$/.exec(im.texture.key);
    const u = m && this.tiles!.units.find((v) => v.ux === Number(m[1]) && v.uy === Number(m[2]));
    if (!u) return;
    const [x, y] = this.origin;
    im.setPosition(x + (u.x + k.dx) / ART, y + (u.y + k.dy) / ART).setTint(k.tint).setVisible(!this.hold.has('shadow'));
  }

  /**
   * The moment a streamed land's work after first light may start: the standing unit lit and the light laid, then SETTLE_MS more, so nothing deferred lands in the frame
   * the player first sees.
   */
  private settled(): boolean {
    const st = this.stream;
    if (!st || !(st.standingLit() || (!this.hold.has('nonear4c') && st.nearLit())) || this.litMinute < 0) return false;
    const now = performance.now();
    this.litSince ??= now;
    return now - this.litSince >= SETTLE_MS;
  }

  /**
   * A streamed land's wall shade, one unit a frame after first light: per unit an image of its size, the walls blurred 2.4 px and made white with their alpha (as
   * makeWallShade makes it for the whole land). The blur reads the neighbours' walls across the seam where they are resident; a unit that lands later redoes its neighbours.
   */
  private stepWallShade(): boolean {
    if (!this.settled()) return false;
    const job = this.shadeQueue.shift();
    if (!job) return false;
    const { unit, on } = job;
    const w = this.world;
    const textures = w.textures;
    const key = `painted:wall-shade@${unit.ux},${unit.uy}`;
    const old = this.shadeImgs.get(key);
    if (!on) {
      old?.destroy();
      this.shadeImgs.delete(key);
      if (textures.exists(key)) textures.remove(key);
      return true;
    }
    if (!textures.exists(layerKey(unit, 'walls'))) return true;
    const M = 8;
    const src = document.createElement('canvas');
    src.width = unit.w + 2 * M;
    src.height = unit.h + 2 * M;
    const sctx = src.getContext('2d');
    if (!sctx) return true;
    for (const u of this.tiles!.units) {
      if (Math.abs(u.ux - unit.ux) > 1 || Math.abs(u.uy - unit.uy) > 1) continue;
      const k = layerKey(u, 'walls');
      if (textures.exists(k)) sctx.drawImage(textures.get(k).getSourceImage() as CanvasImageSource, u.x - unit.x + M, u.y - unit.y + M);
    }
    let c = this.shadeCanvas.get(key);
    if (!c) {
      c = document.createElement('canvas');
      c.width = unit.w;
      c.height = unit.h;
      this.shadeCanvas.set(key, c);
    }
    const ctx = c.getContext('2d');
    if (!ctx) return true;
    ctx.clearRect(0, 0, unit.w, unit.h);
    ctx.filter = 'blur(2.4px)';
    ctx.drawImage(src, -M, -M);
    ctx.filter = 'none';
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, unit.w, unit.h);
    ctx.globalCompositeOperation = 'source-over';
    // an image texture of the canvas, not a CanvasTexture: that one reads the whole canvas back (getImageData, 77 ms of the walk's long frames) for a pixel copy nothing here uses
    if (textures.exists(key)) {
      const src = textures.get(key).source[0]!;
      // a texture made by textureOnce is a bare storage: the source's own update would upload its (empty) pixels, so the canvas is laid into it again
      if (src.isGLTexture) this.laidOnce(src.glTexture as unknown as BandTex, (gl) => gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, c));
      else src.update();
    } else if (!this.textureOnce(key, c.width, c.height, true, c, (gl) => gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, c))) textures.addImage(key, c as unknown as HTMLImageElement);
    if (!old) {
      const [x, y] = this.origin;
      const im = w.add.image(x + unit.x / ART, y + unit.y / ART, key).setOrigin(0).setScale(1 / ART).setDepth(0.53).setBlendMode(Phaser.BlendModes.MULTIPLY);
      w.noCast.add(im);
      this.shadeImgs.set(key, im);
      this.lightShade(im);
    }
    this.waterShadeAt = -1;
    // a unit that came in redoes its resident neighbours' shade (their blur now reads its walls across the seam)
    if (job.first) for (const u of this.tiles!.units) {
      if (u === unit || Math.abs(u.ux - unit.ux) > 1 || Math.abs(u.uy - unit.uy) > 1) continue;
      if (this.shadeImgs.has(`painted:wall-shade@${u.ux},${u.uy}`)) this.shadeQueue.push({ unit: u, on: true });
    }
    return true;
  }

  /**
   * A streamed land's still water, after first light settles: the exporter's baked field, base and ramp (three small pictures, 0.4 MB on the valley block) load once, and
   * then each unit whose ground is resident gets its tone, its own copy of the shadows on the water and its pair of quads (StillWater.addUnit); an evicted unit's go with it.
   */
  private stepStillWater(): void {
    const tiles = this.tiles;
    if (!tiles || !this.stream || !this.settled()) return;
    const still = tiles.still;
    if (this.stillState === 'off') {
      if (!still || this.hold.has('nowater')) {
        this.stillState = 'none';
        return;
      }
      this.stillState = 'loading';
      const keys = { fieldKey: 'painted:still-field', baseKey: 'painted:still-base', rampKey: 'painted:still-ramp' };
      const files = [still.field, still.base, still.ramp];
      Promise.all(files.map((f) => BROWSER_EARLY.fetch(`${this.base}/${f}`).then((b) => this.decodeBoth(b))))
        .then((imgs) => this.later('still-load', () => {
          // canvas textures, as the mount's own bake makes them
          [keys.fieldKey, keys.baseKey, keys.rampKey].forEach((k, i) => this.bitmapTex(k, imgs[i]!));
          const baked: StillBaked = { grid: still.grid, seam: still.seam, ...keys };
          const [x, y] = this.origin;
          this.still = new StillWater(this.world, x, y, this.scene, ART, () => this.waterTime, '', 2.6, () => !this.hold.has('flatwater'), () => this.hold.has('sunlane'), () => !this.hold.has('plainmarks'), () => this.hold.has('snow'), baked);
          if (this.lit) this.still.setHour(this.lit, this.hold.has('shadow') ? 0 : this.fadeOfWater);
          this.stillState = 'on';
        }, () => { this.stillState = 'none'; }))
        .catch((e: unknown) => {
          console.warn(`painted: the still water did not load (${String(e)})`);
          this.stillState = 'none';
        });
      return;
    }
    if (this.stillState !== 'on' || !still) return;
    const textures = this.world.textures;
    const st = this.stream;
    // one unit a frame: a resident unit without water gets it, a gone one loses it
    for (const [k, wu] of this.waterUnits) {
      if (st.isLit(wu.unit)) continue;
      this.still?.removeUnit(k);
      wu.shade.destroy();
      const tk = `painted:still-tone@${k}`;
      if (textures.exists(tk)) textures.remove(tk);
      this.waterUnits.delete(k);
      return;
    }
    for (const [ui, u] of tiles.units.entries()) {
      const k = `${u.ux},${u.uy}`;
      if (this.waterUnits.has(k) || !st.isLit(u) || !textures.exists(layerKey(u, 'ground'))) continue;
      const shade = textures.createCanvas(`painted:water-shade@${k}`, u.w, u.h);
      if (!shade) return;
      const wu = { unit: u, shade, tone: 'loading' as 'loading' | 'in' };
      this.waterUnits.set(k, wu);
      this.waterShadeAt = -1;
      const toneFile = still.tone?.[ui];
      const toneKey = toneFile ? `painted:still-tone@${k}` : 'painted:still-white';
      const lay = (): void => {
        if (this.waterUnits.get(k) !== wu) return;
        wu.tone = 'in';
        this.still?.addUnit(k, { x: u.x, y: u.y, w: u.w, h: u.h, plateKey: layerKey(u, 'ground'), toneKey, shadeKey: shade.key });
      };
      if (!toneFile) {
        if (!textures.exists(toneKey)) {
          const c = textures.createCanvas(toneKey, 1, 1);
          if (c) {
            const ctx = c.getContext();
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, 1, 1);
            c.refresh();
          }
        }
        lay();
      } else
        BROWSER_EARLY.fetch(`${this.base}/${toneFile}`)
          .then((b) => this.decodeBoth(b))
          .then((img) => this.later('still-tone', () => {
            this.bitmapTex(toneKey, img);
            lay();
          }))
          .catch((e: unknown) => console.warn(`painted: ${toneFile} did not load (${String(e)})`));
      return;
    }
  }

  /**
   * A streamed land's wind, one unit a frame after first light settles, once the unit's piece sheet and its relief are in: its leaning pieces are copied at every lean
   * (painted-wind.ts, as bakeWind does for the whole sheet) into the unit's own wind sheets, and each takes its frames from there and its shadow from its rest frame.
   */
  /** the wind bake of the unit being baked: a generator that does one slice of it a frame (stepUnitWind) */
  private windJob?: Generator<void, void, void>;

  private stepUnitWind(): boolean {
    const tiles = this.tiles;
    const st = this.stream;
    if (!tiles || !st || !this.settled()) return false;
    if (this.windJob) {
      if (this.windJob.next().done) this.windJob = undefined;
      return true;
    }
    const textures = this.world.textures;
    for (const [ui, u] of tiles.units.entries()) {
      const k = `${u.ux},${u.uy}`;
      if (this.windDone.has(k) || !st.isLit(u)) continue;
      const ck = layerKey(u, 'objects');
      const nk = layerKey(u, 'objects-n');
      if (!textures.exists(ck) || !textures.exists(nk)) continue;
      this.windDone.add(k);
      this.windJob = this.bakeUnitWind(u, ui, ck, nk);
      if (this.windJob.next().done) this.windJob = undefined;
      return true;
    }
    return false;
  }

  /**
   * a unit's wind, a slice a frame: the sheets (the exporter's, loaded; or made here from two layer reads when the scene carries none, computeUnitWind), then the sprites. A unit evicted in between stops it.
   */
  private *bakeUnitWind(u: StreamUnitMeta, ui: number, ck: string, nk: string): Generator<void, void, void> {
    const wk = `${u.ux},${u.uy}`;
    const tiles = this.tiles!;
    const textures = this.world.textures;
    const mine = this.scene.objects.flatMap((o, i) => {
      const at = tiles.pieces[i];
      return at && at[0] === ui && pieceLean(o) > 0 ? [{ i, o, at }] : [];
    });
    if (!mine.length) return;
    const keys: Record<'tall' | 'low', string> = { tall: `painted:wind@${u.ux},${u.uy}`, low: `painted:wind-low@${u.ux},${u.uy}` };
    const baked = u.wind ? yield* this.loadBakedWind(u, keys) : false;
    if (!baked) yield* this.computeUnitWind(u, mine, ck, nk, keys);
    if (!this.windDone.has(wk)) return;
    const scene = this.scene;
    const cast = this.world.cast;
    // the split valley has up to 190 leaning trees: their frames are handed out WIND_HAND a frame
    let handed = 0;
    for (const { i, o } of mine) {
      if (++handed % WIND_HAND === 0) {
        yield;
        if (!this.windDone.has(wk)) return;
      }
      const spr = this.sprites[i];
      if (!spr) continue;
      const lean = pieceLean(o);
      const key = castPad(o.kind, o.h) > 0 ? keys.tall : keys.low;
      if (!textures.exists(key)) continue;
      spr.setTexture(key, `${o.i}:0`).setData('rest', `${o.i}:r`);
      const c = cast?.of(spr);
      if (c) c.mode = 'rest';
      const l: Leaner = { o, spr, lean, shown: 0 };
      if (GROUND_COVER.has(o.kind)) {
        const cell = scene.cells[Math.min(scene.rows - 1, Math.max(0, Math.floor(o.fy / scene.cell)))]?.[Math.min(scene.cols - 1, Math.max(0, Math.floor(o.fx / scene.cell)))];
        l.cover = { gate: cell === '#' || cell === '~' ? 0 : 1, shade: 1, push: 0 };
        this.covers.push(l);
      }
      this.leaners.push(l);
    }
  }

  /** the frames of a wind sheet, from its places: each piece at each lean, and the rest frame its shadow is read from */
  private addWindFrames(tex: Phaser.Textures.Texture, place: readonly { o: { i: number; kind: string; w: number; h: number }; lean: number; k: number; x: number; y: number }[]): void {
    for (const { o, lean, k, x, y } of place) {
      tex.add(`${o.i}:${k}`, 0, x, y, o.w + 2 * lean, o.h);
      const pad = castPad(o.kind, o.h);
      if (k === 0) tex.add(`${o.i}:r`, 0, x + lean - pad, y, o.w + 2 * pad, o.h);
    }
  }

  /**
   * A unit's wind from the exporter: the frames' places and the two sheets of each kind, fetched and decoded off the main thread, then each laid as an image
   * texture (2 to 3 ms, as the unit's own layers are) in place of the two full-layer readbacks and the canvas uploads of computeUnitWind. Returns false when a file did not load (the
   * scene's own computation then runs); a unit evicted while it loads leaves true with nothing laid.
   */
  private *loadBakedWind(u: StreamUnitMeta, keys: Record<'tall' | 'low', string>): Generator<void, boolean, void> {
    const wk = `${u.ux},${u.uy}`;
    const textures = this.world.textures;
    let meta: WindSheets | null | undefined;
    BROWSER_EARLY.fetch(`${this.base}/${u.wind}`).then((b) => b.text()).then((t) => { meta = JSON.parse(t) as WindSheets; }, () => { meta = null; });
    while (meta === undefined) yield;
    if (!meta) return false;
    // A bitmap's upload ignores the flip an image or a canvas is given (the frames' rows are counted by it), so the sheet's upload is of a bitmap made flipped; the colour sheet's own
    // image stays the plain one, which is what the cast's mask reads frames from.
    const pics = new Map<string, ImageBitmap>();
    const plain = new Map<string, ImageBitmap>();
    let pending = meta.sheets.length * 3;
    let failed = false;
    const done = (): void => { pending--; };
    for (const sh of meta.sheets)
      for (const f of [sh.c, sh.n]) {
        const blob = BROWSER_EARLY.fetch(`${this.base}/${f}`);
        blob.then((bl) => createImageBitmap(bl, { imageOrientation: 'flipY' })).then((img) => { pics.set(f, img); }, () => { failed = true; }).finally(done);
        if (f === sh.c) blob.then((bl) => createImageBitmap(bl)).then((img) => { plain.set(f, img); }, () => { failed = true; }).finally(done);
      }
    while (pending > 0) yield;
    if (failed || !this.windDone.has(wk)) {
      for (const img of [...pics.values(), ...plain.values()]) img.close();
      return !failed;
    }
    for (const sh of meta.sheets) {
      const key = sh.low ? keys.low : keys.tall;
      if (textures.exists(key)) textures.remove(key);
      const flipped = pics.get(sh.c)!;
      // the colour sheet and its relief were each a 20-40 ms upload: each now goes into its own storage by bands, a band a frame (laidByBands, B3 of private #44 H); a renderer
      // without the way uploads each whole, one a frame
      const store = this.hold.has('nobands') ? undefined : this.bandStorage(flipped.width, flipped.height);
      const tex = store ? textures.addGLTexture(key, store as unknown as Phaser.Renderer.WebGL.Wrappers.WebGLTextureWrapper) : timed('w.addC', () => textures.addImage(key, flipped as unknown as HTMLImageElement));
      if (!tex) {
        store?.destroy();
        continue;
      }
      const src = tex.source[0]!;
      src.image = plain.get(sh.c) as unknown as HTMLImageElement;
      const alive = (): boolean => this.windDone.has(wk) && textures.exists(key) && textures.get(key) === tex;
      if (store && !(yield* this.laidByBands(store, flipped, 'w.addC', alive))) return true;
      flipped.close();
      yield;
      if (!alive()) return true;
      const relief = pics.get(sh.n)!;
      const nstore = this.hold.has('nobands') ? undefined : this.bandStorage(relief.width, relief.height);
      if (nstore) {
        tex.setDataSource(nstore as unknown as HTMLImageElement);
        if (!(yield* this.laidByBands(nstore, relief, 'w.setN', alive))) return true;
      } else timed('w.setN', () => tex.setDataSource(relief as unknown as HTMLImageElement));
      this.addWindFrames(tex, sh.place.map(([i, lean, k, x, y]) => ({ o: this.scene.objects[i]!, lean, k, x, y })));
      yield;
      if (!this.windDone.has(wk)) return true;
    }
    return true;
  }

  /** a unit's wind made on the device (a scene baked before the exporter made it): the unit's two layers read back in bands, each of the two sheets laid and uploaded, a slice a frame */
  private *computeUnitWind(u: StreamUnitMeta, mine: { i: number; o: PaintedScene['objects'][number]; at: readonly number[] }[], ck: string, nk: string, keys: Record<'tall' | 'low', string>): Generator<void, void, void> {
    const wk = `${u.ux},${u.uy}`;
    const textures = this.world.textures;
    const src = textures.get(ck).getSourceImage() as CanvasImageSource & { width: number; height: number };
    // a layer is read in bands of rows, a band a frame (a whole layer's getImageData was a 40 ms frame)
    const read = function* (key: string, into: { data?: Uint8ClampedArray }): Generator<void, void, void> {
      const c = document.createElement('canvas');
      c.width = src.width;
      c.height = src.height;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw new Error('no 2d context');
      ctx.drawImage(textures.get(key).getSourceImage() as CanvasImageSource, 0, 0);
      yield;
      const out = new Uint8ClampedArray(c.width * c.height * 4);
      for (let y0 = 0; y0 < c.height; y0 += 320) {
        out.set(ctx.getImageData(0, y0, c.width, Math.min(320, c.height - y0)).data, y0 * c.width * 4);
        yield;
      }
      into.data = out;
    };
    const rc: { data?: Uint8ClampedArray } = {};
    yield* read(ck, rc);
    if (!this.windDone.has(wk) || !textures.exists(nk)) return;
    const rn: { data?: Uint8ClampedArray } = {};
    yield* read(nk, rn);
    const colour = rc.data!;
    const normal = rn.data!;
    const WIDE = 2048;
    for (const low of [false, true]) {
      if (!this.windDone.has(wk)) return;
      // the pieces at their place in the unit's sheet
      const { place, high } = windLayout(
        mine.map(({ o, at }) => ({ ...o, sx: at[1]!, sy: at[2]! })),
        low,
        WIDE,
      );
      if (!place.length) continue;
      const key = low ? keys.low : keys.tall;
      const outC = new Uint8ClampedArray(WIDE * high * 4);
      const outN = flatNormals(WIDE * high);
      timed('w.copy', () => { for (const { o, lean, k, x, y } of place) leanCopy(colour, normal, src.width, o.sx, o.sy, o.w, o.h, lean, k, outC, outN, WIDE, x, y); });
      yield;
      const canvasOf = (data: Uint8ClampedArray): HTMLCanvasElement => {
        const c = document.createElement('canvas');
        c.width = WIDE;
        c.height = high;
        c.getContext('2d')?.putImageData(new ImageData(data as Uint8ClampedArray<ArrayBuffer>, WIDE, high), 0, 0);
        return c;
      };
      if (textures.exists(key)) textures.remove(key);
      const cc = timed('w.canvasC', () => canvasOf(outC));
      yield;
      if (!this.windDone.has(wk)) return;
      const tex = timed('w.addC', () => textures.addCanvas(key, cc));
      if (!tex) continue;
      yield;
      if (!this.windDone.has(wk)) return;
      const cn = timed('w.canvasN', () => canvasOf(outN));
      timed('w.setN', () => tex.setDataSource(cn));
      this.addWindFrames(tex, place);
      yield;
    }
  }

  /** An evicted unit's wind: its leaners leave the lists, their shadows go back to the drawn frame, its sheets go. */
  private dropUnitWind(u: StreamUnitMeta, ui: number): void {
    const k = `${u.ux},${u.uy}`;
    if (!this.windDone.delete(k)) return;
    const gone = (l: Leaner): boolean => this.tiles!.pieces[this.scene.objects.indexOf(l.o)]?.[0] === ui;
    const cast = this.world.cast;
    for (const l of this.leaners) if (gone(l)) {
      const c = cast?.of(l.spr);
      if (c) c.mode = 'drawn';
    }
    this.leaners = this.leaners.filter((l) => !gone(l));
    this.covers = this.covers.filter((l) => !gone(l));
    const textures = this.world.textures;
    for (const key of [`painted:wind@${k}`, `painted:wind-low@${k}`]) if (textures.exists(key)) textures.remove(key);
  }

  /** For a rig: the camera stops following and centres on (x, y) in scene px; the stream brings in what it shows. */
  lookAt(x: number, y: number): void {
    const cam = this.world.cameras.main;
    cam.stopFollow();
    cam.centerOn(this.x0 * T + x / ART, this.y0 * T + y / ART);
  }

  /** For a rig: whether a streamed land's work after first light is all done for the units now lit (always true for a land laid whole). */
  deferredDone(): boolean {
    const st = this.stream;
    if (!st) return true;
    if (!st.standingLit() || !this.settled() || this.alphaQueue.length || this.shadeQueue.length || this.alphaJob || this.standingJob || this.standingStale || this.windJob || this.coverJob || this.fogNoiseJob || this.laterQ.length) return false;
    if (this.stillState === 'off' || this.stillState === 'loading' || this.coverState === 'off' || this.coverState === 'loading' || this.fogState === 'off' || this.fogState === 'loading') return false;
    if (this.fogState === 'on') for (const u of this.tiles!.units) if (st.isLit(u) && !this.fogUnits.get(`${u.ux},${u.uy}`)?.quad) return false;
    if (this.stillState === 'on') for (const u of this.tiles!.units) if (st.isLit(u) && this.waterUnits.get(`${u.ux},${u.uy}`)?.tone !== 'in') return false;
    return true;
  }

  /** A streamed land's cover, once after first light settles: the exporter's masks (tiles/cover.png) laid as the whole land's shade, as buildCover lays the mount's own. */
  private stepStreamCover(): void {
    const tiles = this.tiles;
    if (!tiles || this.coverState !== 'off' || !this.settled()) return;
    const cover = tiles.cover;
    if (!cover) {
      this.coverState = 'none';
      return;
    }
    this.coverState = 'loading';
    BROWSER_EARLY.fetch(`${this.base}/${cover.file}`)
      .then((b) => BROWSER_EARLY.decode(b))
      .then((img) => this.later('cover-load', () => {
        // three steps in three frames (together 22 ms): the picture read, the two masks split off, the shade image laid
        const c = document.createElement('canvas');
        c.width = cover.w;
        c.height = cover.h;
        const ctx = c.getContext('2d', { willReadFrequently: true });
        if (!ctx) throw new Error('no 2d context');
        ctx.drawImage(img, 0, 0);
        const px = ctx.getImageData(0, 0, cover.w, cover.h).data;
        const fail = (): void => { this.coverState = 'none'; };
        this.later('cover-split', () => {
          const n = cover.w * cover.h;
          const wood = new Uint8Array(n);
          const ray = new Uint8Array(n);
          for (let i = 0; i < n; i++) {
            wood[i] = px[i * 4]!;
            ray[i] = px[i * 4 + 1]! >= 128 ? 1 : 0;
          }
          this.later('cover-lay', () => {
            this.layCover({ w: cover.w, h: cover.h, cfg: COVER, wood, ray }, this.origin[0], this.origin[1]);
            this.coverSun = '';
            this.litMinute = -1;
            this.coverState = 'on';
          }, fail);
        }, fail);
      }, () => { this.coverState = 'none'; }))
      .catch((e: unknown) => {
        console.warn(`painted: the cover did not load (${String(e)})`);
        this.coverState = 'none';
      });
  }

  /**
   * A streamed land's lit fog, after first light settles, for a land whose hours have fog: the noise and the exporter's wall field once, then per lit unit its mask and its
   * quad (fogLitQuad over the unit, its own ground); a unit that goes takes its quad and mask with it.
   */
  private stepStreamFog(): void {
    const tiles = this.tiles;
    const st = this.stream;
    if (!tiles || !st || !this.settled()) return;
    const textures = this.world.textures;
    if (this.fogState === 'off') {
      const fog = tiles.fog;
      if (!fog || (!this.rows.some((h) => h.fog) && !this.hold.has('fogland'))) {
        this.fogState = 'none';
        return;
      }
      this.fogState = 'loading';
      // the wall's fetch starts once the noise is laid (a fogNoise of 256 px was one 41 ms frame: it is made in slices, stepFogNoise)
      const startWall = (): void => {
        BROWSER_EARLY.fetch(`${this.base}/${fog.wall}`)
          .then((b) => this.decodeBoth(b))
          .then((img) => this.later('fog-wall', () => {
            this.bitmapTex('painted:fog-wall', img);
            this.fogAt = [this.origin[0], this.origin[1]];
            this.fogState = 'on';
            this.litMinute = -1;
          }, () => { this.fogState = 'none'; }))
          .catch((e: unknown) => {
            console.warn(`painted: the fog did not load (${String(e)})`);
            this.fogState = 'none';
          });
      };
      const noise = textures.exists('painted:fog-noise') ? undefined : textures.createCanvas('painted:fog-noise', NOISE_SIZE, NOISE_SIZE);
      if (!noise) {
        startWall();
        return;
      }
      if (fog.noise) {
        // the exporter's noise tile: fetched and decoded off the main thread, laid with one drawImage (no 41 ms of noise on the device)
        BROWSER_EARLY.fetch(`${this.base}/${fog.noise}`)
          .then((b) => BROWSER_EARLY.decode(b))
          .then((img) => this.later('fog-noise', () => {
            noise.getContext().drawImage(img, 0, 0);
            noise.refresh();
            startWall();
          }, () => { this.fogState = 'none'; }))
          .catch((e: unknown) => {
            console.warn(`painted: the fog's noise did not load (${String(e)})`);
            this.fogState = 'none';
          });
        return;
      }
      const px = new Uint8ClampedArray(NOISE_SIZE * NOISE_SIZE * 4);
      this.fogNoiseJob = {
        gen: fogNoiseSteps(NOISE_SIZE, FOG_NOISE.seed, px),
        done: () => {
          noise.getContext().putImageData(new ImageData(px as unknown as Uint8ClampedArray<ArrayBuffer>, NOISE_SIZE, NOISE_SIZE), 0, 0);
          noise.refresh();
          startWall();
        },
      };
      return;
    }
    if (this.fogState !== 'on') return;
    const fog = tiles.fog!;
    for (const [k, fu] of this.fogUnits) {
      if (st.isLit(fu.unit)) continue;
      fu.quad?.destroy();
      const mk = `painted:fog-mask@${k}`;
      if (textures.exists(mk)) textures.remove(mk);
      this.fogUnits.delete(k);
      return;
    }
    for (const [ui, u] of tiles.units.entries()) {
      const k = `${u.ux},${u.uy}`;
      const gk = layerKey(u, 'ground');
      if (this.fogUnits.has(k) || !st.isLit(u) || !textures.exists(gk)) continue;
      const fu: { unit: StreamUnitMeta; quad?: Phaser.GameObjects.Shader } = { unit: u };
      this.fogUnits.set(k, fu);
      const mk = `painted:fog-mask@${k}`;
      BROWSER_EARLY.fetch(`${this.base}/${fog.mask[ui]!}`)
        .then((b) => this.decodeBoth(b))
        .then((img) => this.later('fog-mask', () => {
          if (this.fogUnits.get(k) !== fu || !textures.exists(gk)) {
            img[0].close();
            img[1].close();
            return;
          }
          this.bitmapTex(mk, img);
          fu.quad = this.fogLitQuad(u, ['painted:fog-noise', mk, 'painted:fog-wall', gk]).setVisible(!!this.fogOf && !this.hold.has('nofog'));
        }))
        .catch((e: unknown) => console.warn(`painted: ${fog.mask[ui]} did not load (${String(e)})`));
      return;
    }
  }

  /**
   * A picture decoded twice, off the main thread: flipped and plain. A bitmap's upload ignores the flip an image or a canvas gets (the frames' rows are counted by it), so the texture is
   * uploaded from the flipped one and keeps the plain one as its image, which is what the CPU reads (bitmapTex).
   */
  private decodeBoth(b: Blob): Promise<[ImageBitmap, ImageBitmap]> {
    return Promise.all([createImageBitmap(b, { imageOrientation: 'flipY' }), createImageBitmap(b)]);
  }

  /** A decoded picture as an image texture under `key` (made once): 2 to 3 ms to upload, where a canvas drawn from an <img> was 12 to 20 (the stutter bars of the preview, private #44). */
  private bitmapTex(key: string, pair: [ImageBitmap, ImageBitmap]): Phaser.Textures.Texture {
    const textures = this.world.textures;
    if (textures.exists(key)) {
      pair[0].close();
      pair[1].close();
      return textures.get(key);
    }
    const once = this.textureOnce(key, pair[0].width, pair[0].height, true, pair[1], (gl) => gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, pair[0]));
    if (once) {
      // what a whole upload's storage holds as its source, as laidByBands leaves it: the closed bitmap's later filter calls then do nothing (the filter was set with the storage)
      (once.source[0]!.glTexture as unknown as BandTex).pixels = pair[0];
      pair[0].close();
      return once;
    }
    const tex = textures.addImage(key, pair[0] as unknown as HTMLImageElement);
    if (!tex) throw new Error(`painted: ${key} was refused`);
    tex.source[0]!.image = pair[1] as unknown as HTMLImageElement;
    pair[0].close();
    return tex;
  }

  /** A streamed land's copies of the shadows on the water, per unit: the cast shadows' canvas and the walls' shade at the hour's offset, re-drawn only when one moved. */
  private copyShadeUnits(): void {
    const cast = this.world.cast;
    if (!cast || !this.waterUnits.size) return;
    const version = cast.version;
    if (version === this.waterShadeAt) return;
    this.waterShadeAt = version;
    const box = cast.canvasBox();
    const source = this.world.textures.get('cast-standing').getSourceImage() as CanvasImageSource;
    const k = this.shadeLook;
    for (const { unit, shade } of this.waterUnits.values()) {
      const ctx = shade.getContext();
      ctx.clearRect(0, 0, shade.width, shade.height);
      if (box) ctx.drawImage(source, (box.x - this.x0 * T) * ART - unit.x, (box.y - this.y0 * T) * ART - unit.y);
      if (k)
        for (const u of this.tiles!.units) {
          if (Math.abs(u.ux - unit.ux) > 1 || Math.abs(u.uy - unit.uy) > 1) continue;
          const c = this.shadeCanvas.get(`painted:wall-shade@${u.ux},${u.uy}`);
          if (c) ctx.drawImage(c, u.x - unit.x + k.dx, u.y - unit.y + k.dy);
        }
      shade.refresh();
    }
  }

  /**
   * A streamed unit's pieces' alpha, read from its sheet once it is a texture, one unit a frame and never before the standing unit is lit (first light pays nothing for it).
   * What reads the alpha (the standing field, the pieces' shading) is made again with the new pieces.
   */
  /** the alpha read of the unit being read: a generator that does one slice of it a frame (readUnitAlpha) */
  private alphaJob?: Generator<void, void, void>;

  private readUnitAlpha(): boolean {
    if (!this.settled()) return false;
    if (!this.alphaJob) {
      const unit = this.alphaQueue.shift();
      if (!unit) return false;
      this.alphaJob = this.alphaSlices(unit);
    }
    if (this.alphaJob.next().done) this.alphaJob = undefined;
    return true;
  }

  /** the picture's alpha read in bands of rows, a band a frame: its drawImage, then each band's getImageData, then the pieces (the readback of a whole layer was one 40 ms frame) */
  private *alphaSlices(unit: StreamUnitMeta): Generator<void, void, void> {
    const key = layerKey(unit, 'objects');
    const textures = this.world.textures;
    if (!textures.exists(key)) return;
    const sheet = unit.layers.find((l) => l.name === 'objects');
    let alpha: Uint8Array | undefined;
    let sheetW = 0;
    if (unit.alpha && sheet) {
      // the exporter's alpha: fetched and inflated off the main thread, a frame or more of waiting; a file that is not the sheet's size falls back to the picture's own
      let got: Uint8Array | null | undefined;
      BROWSER_EARLY.fetch(`${this.base}/${unit.alpha}`).then(inflateBlob).then((v) => { got = v; }, () => { got = null; });
      while (got === undefined) yield;
      if (got && got.length === sheet.w * sheet.h) {
        alpha = got;
        sheetW = sheet.w;
      } else console.warn(`painted: ${unit.alpha} did not read as the sheet's alpha, the picture's is read instead`);
      if (!textures.exists(key)) return;
    }
    if (!alpha) {
      const img = textures.get(key).getSourceImage() as CanvasImageSource & { width: number; height: number };
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);
      yield;
      const read = new Uint8Array(c.width * c.height);
      const BAND = 320;
      for (let y0 = 0; y0 < c.height; y0 += BAND) {
        const h = Math.min(BAND, c.height - y0);
        const band = ctx.getImageData(0, y0, c.width, h).data;
        for (let k = 0; k < c.width * h; k++) read[y0 * c.width + k] = band[k * 4 + 3]!;
        yield;
      }
      alpha = read;
      sheetW = c.width;
    }
    const ui = this.tiles!.units.findIndex((u) => u.ux === unit.ux && u.uy === unit.uy);
    let copied = 0;
    const arrived: PaintedObject[] = [];
    for (const [i, at] of this.tiles!.pieces.entries()) {
      if (!at || at[0] !== ui) continue;
      const o = this.scene.objects[i]!;
      const a = new Uint8Array(o.w * o.h);
      for (let r = 0; r < o.h; r++) for (let q = 0; q < o.w; q++) a[r * o.w + q] = alpha![(at[2] + r) * sheetW + at[1] + q] ?? 0;
      this.pieceAlpha.set(o.i, a);
      arrived.push(o);
      copied += a.length;
      if (copied >= 150_000) {
        copied = 0;
        yield;
      }
    }
    // the unit's pieces join the mask, and the field is made again over the box they changed (before the first pass has made the mask, that pass takes them all)
    this.standingMask ??= new Uint8Array(this.scene.width * this.scene.height);
    if (!this.standingFull) yield* this.stampStanding(arrived, true);
    this.standingStale = true;
    this.litMinute = -1;
  }

  private sheetPixels(): SheetPixels | undefined {
    return this.sheetAlpha && this.sheetNormal ? { w: this.scene.sheet.w, colour: this.sheetAlpha, normal: this.sheetNormal } : undefined;
  }

  /** One sheet holding every leaning piece at each of its leans, its relief leaning with it. Returns its key. */
  private bakeWind(low: boolean): string {
    const key = low ? 'painted:wind-low' : 'painted:wind';
    // the low sheet is drawn at 64 art pixels a tile, like the one it was cut from: its shadows are the ones the sheet's own frames gave
    if (low) this.bundle.sprites[key] = { url: '', w: 1, h: 1, frames: 1, density: 4 };
    const { scene } = this;
    const read = (name: string): Uint8ClampedArray => {
      const c = document.createElement('canvas');
      c.width = scene.sheet.w;
      c.height = scene.sheet.h;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw new Error('no 2d context');
      ctx.drawImage(this.world.textures.get(name).getSourceImage() as CanvasImageSource, 0, 0);
      return ctx.getImageData(0, 0, c.width, c.height).data;
    };
    const colour = read('painted:objects');
    const normal = read('painted:objects-n');
    const WIDE = 4096;
    const { place, high } = windLayout(scene.objects, low, WIDE);
    const outC = new Uint8ClampedArray(WIDE * high * 4);
    const outN = flatNormals(WIDE * high);
    const sw = scene.sheet.w;
    for (const { o, lean, k, x, y } of place) leanCopy(colour, normal, sw, o.sx, o.sy, o.w, o.h, lean, k, outC, outN, WIDE, x, y);
    const canvasOf = (data: Uint8ClampedArray): HTMLCanvasElement => {
      const c = document.createElement('canvas');
      c.width = WIDE;
      c.height = high;
      const ctx = c.getContext('2d');
      if (!ctx) throw new Error('no 2d context');
      ctx.putImageData(new ImageData(data as Uint8ClampedArray<ArrayBuffer>, WIDE, high), 0, 0);
      return c;
    };
    const tex = this.world.textures.addCanvas(key, canvasOf(outC));
    if (!tex) throw new Error('painted: the wind sheet was refused');
    tex.setDataSource(canvasOf(outN));
    for (const { o, lean, k, x, y } of place) {
      tex.add(`${o.i}:${k}`, 0, x, y, o.w + 2 * lean, o.h);
      // the shadow's frame: the piece at rest with the padding the sheet gave it, so a shadow is the one it always had
      const pad = castPad(o.kind, o.h);
      if (k === 0) tex.add(`${o.i}:r`, 0, x + lean - pad, y, o.w + 2 * pad, o.h);
    }
    return key;
  }

  /** The camera sees the scene and nothing else; with the way out of the valley (`link`, the private preview) it keeps the world's own bounds, the whole widened map, so the walk from the valley is seen. */
  frame(cam: Phaser.Cameras.Scene2D.Camera): void {
    if (this.link) return;
    cam.setBounds(this.x0 * T, this.y0 * T, this.scene.width / ART, this.scene.height / ART);
  }

  /** The west end of the largest walkable piece of the scene: a walker starts where it can go far. */
  private firstFree(): [number, number] {
    const best = this.pieces()[0] ?? [[0, 0] as [number, number]];
    return best.reduce((a, b) => (b[0] < a[0] || (b[0] === a[0] && b[1] > a[1]) ? b : a), best[0] as [number, number]);
  }

  /** The walkable pieces of the scene, largest first. */
  pieces(): [number, number][][] {
    return piecesOf(this.scene);
  }

  /** The piece that fills the picture, which the cover's rule takes out of the cast pass; the lever `nocover` gives the old reading, the mass casting as every piece did. */
  private massOf(o: { w: number; h: number; masspart?: boolean }): boolean {
    return !this.hold.has('nocover') && isMassPiece(o, this.scene);
  }

  afterCasters(): void {
    const cast = this.world.cast;
    if (!cast) return;
    const leaning = new Set<Phaser.GameObjects.GameObject>(this.leaners.map((l) => l.spr));
    // a piece that fills the picture is the painting's whole wood: it has no foot of its own to throw a shadow from, and a wood shades its floor by its cover (lightCover)
    this.sprites.forEach((spr, k) => {
      if (this.massOf(this.spriteObj[k]!)) return;
      cast.add(spr, 'standing', leaning.has(spr) ? 'rest' : 'drawn');
    });
    if (this.animal) cast.add(this.animal, 'standing', 'moving');
    cast.weaken = (wx, wy) => this.coverShadeOf((wx - this.x0 * T) * ART, (wy - this.y0 * T) * ART);
    this.world.player.setLighting(true);
    if (this.baseMode) this.lightKit();
    this.applyLight(true);
  }

  /**
   * Base mode (the valley as the painted land): the game's own pieces (props, items, people, rubble) are drawn over the painting, and the painting takes the hour's
   * light through the lights pipeline while these stood outside it: a rock kept its noon at midnight and a bush its white at sunset. They go through the same
   * pipeline (a flat normal, so the sun's height and the ambient are all they take). A piece that is itself a light (a fire, a lamp's head) keeps its own, as it
   * does under the standard's night shade.
   */
  private lightKit(): void {
    for (const o of this.world.children.list) {
      if (!(o instanceof Phaser.GameObjects.Image) && !(o instanceof Phaser.GameObjects.Sprite)) continue;
      if (o === this.world.player || !takesHour(o.texture.key)) continue;
      o.setLighting(true);
    }
  }

  /**
   * The density the cast pass reads a texture at, when the picture knows better than the bundle: the sheet of tall leaning pieces (a bush, a snag with a lean) is drawn at the
   * density of the picture it was cut from, 4, and its shadow was read at 1, four times too wide and thrown off the piece (a bush at the column's left edge cast nothing in
   * its own place). `nocover` keeps the old reading, so the lever returns the old picture whole.
   */
  castDensity(key: string): number | undefined {
    if (key.startsWith('painted:objects@') || key.startsWith('painted:wind-low@')) return 4;
    return (key === 'painted:wind' || key.startsWith('painted:wind@')) && !this.hold.has('nocover') ? 4 : undefined;
  }

  /** The shadow's keys for the cast pass: one per row whose sun is up (the table's own rows, no second list); `twohours` keeps the standard's four keys (a measure's lever). */
  private sunKeys(shear: (h: Pick<PaintedHour, 'sq' | 'sl'>) => { right: number; down: number }): { at: string; right: number; down: number }[] {
    const hm = (m: number): string => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    if (this.hold.has('twohours')) {
      const a = this.rows.find((r) => r.minute === NOON)!;
      const b = this.rows.find((r) => r.minute === EVENING)!;
      return [{ at: '05:00', ...shear(a) }, { at: '13:00', ...shear(a) }, { at: '17:30', ...shear(b) }, { at: '22:00', ...shear(b) }];
    }
    return this.rows.filter((r) => r.sunUp).map((r) => ({ at: hm(r.minute), ...shear(r) }));
  }

  /** The shadow the cast pass draws at a minute, as the table's keys give it (a measure's read: bar B's direction): up, the shear and its direction in degrees. */
  shadowAt(minute: number): { up: boolean; sx: number; sy: number; deg: number } {
    const d = sunAt(sunTableOf(this.bundle.params.light?.sun as never), minute);
    return { up: d.up, sx: d.sx, sy: d.sy, deg: (Math.atan2(d.sy, d.sx) * 180) / Math.PI };
  }

  /**
   * What stands in this land and which way its silhouette faces (standing.ts), taken from every object's opaque pixels (on first use for a land laid whole; for a streamed land again after each unit's alpha, in slices), with the world position of the land's corner
   * (a land pixel is an art pixel: the world position of pixel (gx, gy) is corner + (gx, gy) / ART). undefined where the sheet's alpha could not be read.
   */
  standing(): { data: Standing; ox: number; oy: number } | undefined {
    // a land laid whole makes it at the first call; a streamed land's is made in slices (stepStanding) and the last whole one serves meanwhile
    if (!this.standingField && !this.stream && this.hasAlpha()) {
      this.standingFull = true;
      for (const _ of this.standingSlices()) void _;
    }
    return this.standingField;
  }

  /**
   * The standing field made again, in slices (it was one 160 ms frame at each unit's arrival: the mask of every object's opaque pixels over the whole land, then standingOf's blurs). The field
   * of the units loaded before serves until the new one lands whole; a unit that arrives meanwhile starts another pass when this one is done.
   */
  private stepStanding(): boolean {
    if (!this.standingJob) {
      if (!this.standingStale || !this.settled() || !this.hasAlpha()) return false;
      this.standingStale = false;
      this.standingJob = this.standingSlices();
    }
    const t0 = performance.now();
    do {
      if (this.standingJob.next().done) {
        this.standingJob = undefined;
        return true;
      }
    } while (performance.now() - t0 < (this.walking() ? 1.5 : 10));
    return true;
  }

  /**
   * Opaque pixels of `objects` stamped into the standing mask, a yield about every 8,000 pixels of an object's box; with `track` the box of the pixels that changed is added to the dirty rectangle
   * (an object's pixels and its dirty box change together, with no yield between, so a pass that starts in a yield sees both).
   */
  private *stampStanding(objects: Iterable<PaintedObject>, track: boolean): Generator<void, void, void> {
    const { width, height } = this.scene;
    const mask = this.standingMask!;
    let n = 0;
    for (const o of objects) {
      // a streamed land's pieces carry their alpha from their unit's arrival: one that has none yet is skipped whole (the lookup was per pixel, over every piece of every unit)
      const a = this.tiles ? this.pieceAlpha.get(o.i) : undefined;
      if (this.tiles && !a) continue;
      let x0 = width;
      let y0 = height;
      let x1 = -1;
      let y1 = -1;
      for (let r = 0; r < o.h; r++) {
        const gy = o.y0 + r;
        if (gy < 0 || gy >= height) continue;
        for (let c = 0; c < o.w; c++) {
          const gx = o.x0 + c;
          if (gx < 0 || gx >= width) continue;
          if ((a ? a[r * o.w + c]! : this.alphaAt(o, r, c)) < 128) continue;
          const i = gy * width + gx;
          if (mask[i]) continue;
          mask[i] = 1;
          if (gx < x0) x0 = gx;
          if (gx >= x1) x1 = gx + 1;
          if (gy < y0) y0 = gy;
          if (gy >= y1) y1 = gy + 1;
        }
      }
      if (track && x1 > 0) this.standingDirty.push({ x0, y0, x1, y1 });
      n += o.w * o.h;
      if (n >= 8_000) {
        n = 0;
        yield;
      }
    }
  }

  private *standingSlices(): Generator<void, void, void> {
    const { width, height } = this.scene;
    const px = width * height;
    let prev = this.standingField?.data;
    let rects: Rect[];
    if (this.standingFull) {
      // the pieces left, all of them again: a land laid whole at its first pass, or after a unit's went (the field is made over the whole land)
      this.standingMask ??= new Uint8Array(px);
      this.standingMask.fill(0);
      this.standingFull = false;
      this.standingDirty = [];
      yield* this.stampStanding(this.scene.objects, true);
      rects = this.standingField ? [{ x0: 0, y0: 0, x1: width, y1: height }] : this.standingDirty;
      this.standingDirty = [];
      prev = undefined;
    } else {
      rects = this.standingDirty;
      this.standingDirty = [];
    }
    if (!rects.length || !this.standingMask) return;
    this.standingTurn ^= 1;
    const set = (this.standingSets[this.standingTurn] ??= { mask: new Uint8Array(px), nx: new Int8Array(px), ny: new Int8Array(px) });
    set.mask.set(this.standingMask);
    // a set taken before holds its field of two passes ago: the planes outside the patches are the served field's (a copy), or empty for the first (a fresh set) and for a whole-land patch
    const clusters = clusterRects(rects, width, height);
    const grown = 2 * standingReach() + 4;
    const most = Math.max(...clusters.map((r) => Math.min(width, r.x1 - r.x0 + 2 * grown) * Math.min(height, r.y1 - r.y0 + 2 * grown)));
    let sc = this.standingScratch;
    if (!sc || sc.f.length < most) sc = this.standingScratch = { f: new Float32Array(most), tmp: new Float32Array(most), nx: new Int8Array(most), ny: new Int8Array(most), cmask: new Uint8Array(most) };
    yield;
    const since = prev ? { nx: prev.nx, ny: prev.ny } : undefined;
    for (let k = 0; k < clusters.length; k++) {
      yield* standingRegionSteps(set.mask, width, height, clusters[k]!, k === 0 ? since : undefined, set, undefined, 8, sc);
    }
    this.standingField = { data: { w: width, h: height, mask: set.mask, nx: set.nx, ny: set.ny }, ox: this.origin[0], oy: this.origin[1] };
    if (sc.f.length > 2_000_000) this.standingScratch = undefined;
  }

  /** The light on a flat patch of ground at the clock's minute, per channel (set by applyLight). */
  private flatLight: [number, number, number] = [1, 1, 1];
  private noonWater: Lit | undefined;
  groundLight(): readonly [number, number, number] {
    return this.flatLight;
  }
  /** The tint of a shadow cast against a lamp that adds `add` (per channel) to the flat ground: what the ground keeps with that light taken away, so a shadow in a pool is the unlit ground. */
  shadowTintOf(add: readonly number[]): number {
    const b = this.flatLight;
    return packRgb([0, 1, 2].map((c) => b[c]! / (b[c]! + add[c]!)));
  }

  /** The camera zoom: 3 screen pixels per art pixel (PAINTED_SCREEN_PX_PER_ART_PX, owner 11.11) unless the query says `figzoom=N` (for tests) */
  zoom(screen?: { cssHeight: number; canvasPerCss: number }): number {
    if (this.zoomValue > 0) return this.zoomValue;
    if (this.zoomAuto && this.figZoom === 0 && screen) return phoneCameraZoom(ART, screen.cssHeight, screen.canvasPerCss);
    return paintedCameraZoom(ART, this.figZoom);
  }

  /** The camera's zoom for this run: a measure asks for the game's own zoom 3 with `?zoom=3`; 0 (the default) leaves the standard's (`figzoom=N` or 3 screen px per art px). */
  private zoomValue = 0;
  setZoomValue(z: number): void {
    if (z > 0) this.zoomValue = z;
  }
  /** The phone camera (`zoom=auto`, the preview's own query): whole screen pixels per art pixel that follow the screen's height (contact.ts phoneCameraZoom). Off in the engine's default; `zoom=N` and `figzoom=N` still win. */
  zoomAuto = false;

  /** The sun, from the clock: the renderer's far light over the relief, the shadow's colour, and each piece's share of other pieces' shade. */
  private applyLight(force = false): void {
    const minute = Math.floor(this.minuteNow());
    if (!force && minute === this.litMinute) return;
    this.litMinute = minute;
    const l = litAt(this.rows, minute, this.hold.has('twohours'));
    this.lit = l;
    this.wind = l.wind;
    const w = this.world;
    // the standard's shaded side keeps more light than a plain lamp leaves it (a fir at 17:30: right half 47 against 45 here): the evening
    // moves a share of the sun into the ambient, in the sun's own colour, so the lit half stays, the shaded half rises and the warmth holds;
    // the share is the table's `fill` (0 at 13:00), the lamp's loss its `shift`
    const top = Math.max(...l.sun);
    const { ambient, flat } = groundLightOf(l);
    w.lights.ambientColor.set(ambient[0], ambient[1], ambient[2]);
    // the light on a flat patch of ground now (the ambient and the sun's flat share): what the lantern's pool lifts the night's picture from (light.ts PAINTED_POOL)
    this.flatLight = flat;
    const sun = this.sun as Phaser.GameObjects.Light;
    sun.color.set(l.sun[0] / top, l.sun[1] / top, l.sun[2] / top);
    sun.setIntensity(top * (1 - l.shift));
    const far = 1e5;
    const cx = (this.x0 * T + this.scene.width / ART / 2);
    const cy = (this.y0 * T + this.scene.height / ART / 2);
    sun.setPosition(cx + l.L3[0] * far, cy + l.L3[1] * far);
    sun.z = l.L3[2] * far;
    const tint = packRgb(shadeTint(l, 1 - l.al));
    if (w.cast) w.cast.multiply = { tint, blur: 1.8 };
    const shade = this.wallShade;
    if (shade) {
      const dx = Math.trunc(l.wall * 0.7 * 3);
      const dy = Math.trunc(l.wall * 3);
      shade.setPosition(this.x0 * T + dx / ART, this.y0 * T + dy / ART).setTint(tint).setVisible(!this.hold.has('shadow'));
    }
    this.shadeLook = { dx: Math.trunc(l.wall * 0.7 * 3), dy: Math.trunc(l.wall * 3), tint };
    for (const im of this.shadeImgs.values()) this.lightShade(im);
    // the water takes its hour from the world's table through the ground's own light: its noon look (the 13:00 row) times the flat ground's light now over the flat ground's light at 13:00, per
    // channel, so the water keeps its world's hue and follows the day exactly as the ground beside it (bar W1); at 13:00 the factor is 1 and the old look is untouched (bar W2)
    const noon = this.noonWater ?? (this.noonWater = litAt(this.rows, NOON, this.hold.has('twohours')));
    const look = waterLook(l, noon);
    this.tintOfWater = look.tint;
    this.fadeOfWater = 0.5 * l.al;
    this.still?.setHour(l, this.hold.has('shadow') ? 0 : this.fadeOfWater);
    this.specOfWater = l.spec;
    this.sparkleOfWater = sparkleOf(l);
    this.warmOfWater = warmthOf(l);
    this.sunDir = [l.L3[0], l.L3[1]];
    this.fogOf = l.fog ?? (this.hold.has('fogland') ? (this.scene.fogland ?? { bottom: 0.14, top: 0.46 }) : undefined);
    this.fogRgb = fogColour(l);
    this.fogLight = { flat: groundLightOf(l).flat };
    this.fogSky = fogSkyOf(this.fogRgb);
    this.fogBurn = this.hold.has('noburn') ? 0 : burnOf(l.elev);
    const lit = !this.hold.has('oldfog');
    if (lit && this.fogOf) this.buildFogLit();
    this.fog?.setVisible(!!this.fogOf && !this.hold.has('nofog') && !lit);
    this.fogLit?.setVisible(!!this.fogOf && !this.hold.has('nofog') && lit);
    for (const q of this.fogUnits.values()) q.quad?.setVisible(!!this.fogOf && !this.hold.has('nofog'));
    // `fogmap` draws the density as grey over the frame (the measures read it); in play the layer only adds light
    this.fog?.setBlendMode(this.hold.has('fogmap') ? Phaser.BlendModes.NORMAL : Phaser.BlendModes.SCREEN);
    this.fogLit?.setBlendMode(this.hold.has('fogmap') ? Phaser.BlendModes.NORMAL : Phaser.BlendModes.SCREEN);
    for (const q of this.fogUnits.values()) q.quad?.setBlendMode(this.hold.has('fogmap') ? Phaser.BlendModes.NORMAL : Phaser.BlendModes.SCREEN);
    this.sunOfWater = [l.sun[0], l.sun[1], l.sun[2]];
    this.reflTint = look.refl;
    this.shadeAt = -1;
    this.waterShadeAt = -1;
    this.lightCover(minute, packRgb(shadeTint(l, 1 - l.al).map((c) => c ** this.coverDepthOf(l))));
    this.shadeObjects(l);
  }

  /** The depth of the cover's shade now: the table's number for the hour (it gives back the painting at the painted hour, where the rule of the sun's height left the gaps between the trunks about 6 luma darker than the painting), the rule's when the hour names none; `oldcover` keeps the rule everywhere. */
  private coverDepthOf(l: Lit): number {
    return l.cover === undefined || this.hold.has('oldcover') ? coverDeep(l.elev) : l.cover;
  }

  /** How much of another piece's shadow lies on each piece's foot, the standard's rule, as a tint that takes that share of the sun away. */
  private shadeObjects(l: Lit): void {
    const objs = this.scene.objects;
    if (!this.hasAlpha()) return;
    const off = this.hold.has('shadow');
    // the painting's whole wood neither shades another piece's foot nor is shaded by one (see afterCasters)
    const mass = objs.map((o) => this.massOf(o));
    const boxes = objs.map((o) => {
      const sh = Math.max(1, Math.trunc(o.h * l.sq));
      const run = Math.trunc(sh * l.sl * 1.9);
      return { sh, run, px: o.x0, py: o.fy - sh + 1 + Math.trunc(o.h * 0.03) };
    });
    objs.forEach((o, i) => {
      let s = 0;
      if (!off) {
        for (let j = 0; j < objs.length && s < 1; j++) {
          if (j === i || mass[j] || mass[i]) continue;
          const b = boxes[j]!;
          const q = objs[j]!;
          const yy = o.fy - b.py;
          const xx = o.fx - b.px;
          if (yy < 0 || yy >= b.sh || xx < 0 || xx >= q.w + b.run + 2) continue;
          const sx = Math.floor(xx + (b.run * yy) / b.sh - b.run);
          const sy = Math.floor((yy * q.h) / b.sh);
          if (sx < 0 || sx >= q.w || sy < 0 || sy >= q.h) continue;
          if (this.alphaAt(q, sy, sx) >= 128) s = 1;
        }
      }
      let v = 1 - s * l.al * 0.85;
      // low growth and low pieces stand in the floor's light: where the cover shades the floor they take the same share the floor does
      if (!mass[i] && (GROUND_COVER.has(o.kind) || o.h < 48)) {
        const c = this.coverShadeOf(o.fx, o.fy);
        if (c > 0) v = v * (1 - c) + Math.min(v, Math.max(0, 1 - l.al * this.coverDepthOf(l))) * c;
      }
      const spr = this.sprites[i];
      if (spr) spr.setTint(packRgb(shadeTint(l, v)));
    });
  }

  private showAnimal(strip: string, frame: number): void {
    const a = this.animal;
    if (!a) return;
    const s = this.lynx[strip];
    if (!s) return;
    const key = `painted:lynx-${strip}`;
    if (a.texture.key !== key) a.setTexture(key, frame);
    else if (a.frame.name !== String(frame)) a.setFrame(frame);
    a.setOrigin(0.5, (s.low + 1) / ANIMAL_SIZE);
  }

  private placeAnimal(x: number, y: number): void {
    if (!this.animal) return;
    const wx = (this.x0 + x + 0.5) * T;
    const wy = (this.y0 + y + 0.5) * T;
    this.animal.setPosition(wx, wy).setDepth(Math.round(wy) + 1);
  }

  bind(session: unknown): void {
    const s = session as SessionShape;
    this.session = s;
    // the figure's size and silhouette are the race's: read again for the session's race
    this.figK = 0;
    this.figPts.length = 0;
    if (!this.link && !this.baseMode) {
      const start = this.firstFree();
      const at: [number, number] = [this.x0 + start[0], this.y0 + start[1]];
      s.pos = [at[0], at[1]];
      s.state.player.at = [at[0], at[1]];
    }
    if (this.deviceClock) {
      const now = new Date();
      this.setMinuteFirstDay(now.getHours() * 60 + now.getMinutes());
    }
    this.steps.player.length = 0;
    this.steps.roe.length = 0;
    const report = s.report.bind(s);
    s.report = (where, again, gait) => {
      this.steps.player.push(this.local(where[0], where[1]));
      report(where, again, gait);
    };
  }

  afterAdvance(tick: number): void {
    if (this.hold.has('clock') && this.session) {
      if (this.frozenTick === undefined) this.frozenTick = tick;
      this.session.tick = this.frozenTick;
    } else {
      this.frozenTick = undefined;
    }
  }

  /**
   * The per-frame budget over a landing unit's work (private #44, the preview walk's stutter). Design:
   *  1. A streamed unit's ground and walls show the frame their texture lands (stepStream's one upload a tick); everything else a unit brings is added after, in a fixed order.
   *  2. Each frame starts a clock; the stream goes first, then the items below, each only while less than the budget is spent (FRAME_BUDGET_MS, 25 ms, while the camera stands; WALK_BUDGET_MS, 8 ms, while it moves, so a walk's frames keep room for the figure); an item that did work and went over stops the frame.
   *  3. The order: work out of a fetch (later: the water's, the fog's and the cover's textures and quads), the pieces' alpha, the wall shade, the wind, the cover's bake, the water, the cover's load, the fog, the light.
   *  4. Every item is a slice that fits the budget (the alpha in bands of rows, the wind in its stages, the cover's bake and the fog's noise as generators), or a single call that took under 20 ms measured.
   *  5. What is deferred waits in its own queue (laterQ, alphaQueue, shadeQueue, the jobs) and goes on next frame, nothing is dropped; the light runs last, on the data of that frame.
   *  6. Until an item is done the unit looks as it did without it: flat light, still pieces, the old shade; nothing half-made is shown (a job writes its result in one step at its end).
   *  7. A land laid whole (not streamed) has none of these items and is unchanged.
   */
  private budgeted(): void {
    const t0 = performance.now();
    timed('stream', () => this.stepStream());
    const limit = this.walking() ? WALK_BUDGET_MS : FRAME_BUDGET_MS;
    const items: [string, () => unknown][] = [
      ['later', () => this.runLater()],
      ['alpha', () => this.readUnitAlpha()],
      ['standing', () => this.stepStanding()],
      ['shade', () => this.stepWallShade()],
      ['wind', () => this.stepUnitWind()],
      ['coverbake', () => this.stepCoverBake()],
      ['still', () => this.stepStillWater()],
      ['cover', () => this.stepStreamCover()],
      ['fog', () => this.stepStreamFog()],
      ['fognoise', () => this.stepFogNoise()],
      ['light', () => this.applyLight()],
      ['warm', () => this.stepPoolWarm()],
    ];
    for (const [name, fn] of items) {
      if (performance.now() - t0 >= limit) break;
      timed(name, fn);
    }
  }

  /**
   * B4c (private #44): the sizes the walk would otherwise make mid-frame. Every see-through filter draws into two framebuffers of its crown's bucket size (bucketFilter), a unit's
   * pictures into one of the unit's size, and Phaser makes a size's framebuffer on the first request (checkFramebufferStatus, 8 to 16 ms in the stutter walk's profile) or, when the
   * oldest idle one is over `maxAge`, resizes that one to the new size. So once the standing unit is lit and settled (or WARM_AFTER_MS after the mount), one framebuffer a frame is made for each size the land can ask
   * (two for each crown size, one pair for a unit size) and put back in the pool, and `maxAge` is raised so an idle one is not taken for a size it was not made for. Held off by `nowarm4c`.
   */
  private stepPoolWarm(): boolean {
    if (this.hold.has('nowarm4c') || !(this.settled() || performance.now() - this.born > WARM_AFTER_MS)) return false;
    if (!this.warmQ) {
      const pool = (this.world.sys.game.renderer as unknown as { drawingContextPool?: CtxPool }).drawingContextPool;
      this.warmQ = [];
      if (!pool || !this.tiles) return false;
      const crowns = new Map<string, [number, number, number]>();
      for (const o of this.scene.objects) {
        const w = bucketUp(o.w);
        const h = bucketUp(o.h);
        const c = crowns.get(`${w}x${h}`);
        if (c) c[2]++;
        else crowns.set(`${w}x${h}`, [w, h, 1]);
      }
      // the sizes most crowns have first, two framebuffers each (one pair per filter), then the unit sizes (a pair each), then the rare crown sizes
      for (const [w, h] of [...crowns.values()].sort((a, b) => b[2] - a[2])) this.warmQ.push([w, h], [w, h]);
      const seen = new Set<string>();
      for (const u of this.tiles.units) if (!seen.has(`${u.w}x${u.h}`) && seen.add(`${u.w}x${u.h}`)) this.warmQ.push([u.w, u.h], [u.w, u.h]);
      pool.setMaxAge(600_000);
      this.warmPool = pool;
    }
    const next = this.warmQ.shift();
    if (!next || !this.warmPool) return false;
    // two requests of one size are two framebuffers: the first is held until the second is made
    this.warmHeld.push(this.warmPool.get(next[0], next[1]));
    if (this.warmHeld.length === 2 || !this.warmQ.length || this.warmQ[0]![0] !== next[0] || this.warmQ[0]![1] !== next[1]) for (const c of this.warmHeld.splice(0)) c.release();
    return true;
  }

  /** whether the camera moved in the last 400 ms (the walk, or the camera settling after it) */
  private walking(): boolean {
    const c = this.world.cameras.main;
    const now = performance.now();
    // a step of half a world px or more (a walk moves it by several; the follow's last easing moves it by hundredths)
    if (Math.abs(c.scrollX - this.camX) + Math.abs(c.scrollY - this.camY) >= 0.5) this.movedAt = now;
    this.camX = c.scrollX;
    this.camY = c.scrollY;
    return now - this.movedAt < 400;
  }

  /** Work that came out of a fetch goes into the frame's budget (runLater); a failure in it is told in the console, as the fetch's own were. */
  private later(name: string, fn: () => void, onError?: () => void): void {
    this.laterQ.push({
      name,
      fn: () => {
        try {
          fn();
        } catch (e) {
          onError?.();
          throw e;
        }
      },
    });
  }

  /** Runs the work that came out of a fetch, one piece at a time, while the frame has budget (runLater is the first item, so the frame's clock is read by the caller). */
  private runLater(): boolean {
    const job = this.laterQ.shift();
    if (!job) return false;
    try {
      timed(`later.${job.name}`, job.fn);
    } catch (e) {
      console.warn(`painted: ${job.name} failed (${String(e)})`);
    }
    return true;
  }

  /** a step of the cover's bake in slices; its last step lays the result in one go */
  private stepCoverBake(): boolean {
    const job = this.coverJob;
    if (!job || !this.settled()) return false;
    if (!job.gen.next().done) return true;
    this.coverJob = undefined;
    if (this.coverTex !== job.tex) return true;
    const t = job.tmp.getContext('2d');
    if (!t) return true;
    t.putImageData(new ImageData(job.out as unknown as Uint8ClampedArray<ArrayBuffer>, job.m.w, job.m.h), 0, 0);
    const ctx = job.tex.getContext();
    ctx.clearRect(0, 0, job.m.w, job.m.h);
    ctx.drawImage(job.tmp, 0, 0);
    job.tex.refresh();
    return true;
  }

  /** a step of the fog's noise in slices; its last step lays it and starts the fog's wall fetch */
  private stepFogNoise(): boolean {
    const job = this.fogNoiseJob;
    if (!job) return false;
    if (!job.gen.next().done) return true;
    this.fogNoiseJob = undefined;
    job.done();
    return true;
  }

  update(time: number, delta: number): void {
    // the valley's own mist and slot fog lie at their places on the valley's map: on the picture the veil stays off
    this.world.veil?.setVisible(false);
    this.budgeted();
    // `nowater`: the standing and river water layer is not drawn, so the picture's own water shows (the reference of the look measures)
    this.water?.setVisible(!this.hold.has('nowater') && !this.still);
    this.still?.setVisible(!this.hold.has('nowater'));
    if (!this.hold.has('water')) this.waterTime += delta / 1000;
    if (!this.hold.has('fog')) this.fogTime += delta / 1000;
    this.copyShade();
    this.copyShadeUnits();
    this.stepWind(time);
    this.stepCover(time, delta);
    this.stepGrass(time, delta);
    this.stepFigure(time);
    this.lastDelta = delta;
    this.stepAnimal(delta);
    // the air's particles are 16 px art at this camera, squares of eight screen pixels; the standard has none, so they stay off here
    this.hideAir();
  }

  private stepWind(time: number): void {
    if (this.hold.has('wind')) return;
    const t = time / 1000;
    for (const l of this.leaners) {
      if (l.cover) continue;
      const k = leanNow(l.o, l.lean, t, this.wind);
      if (k === l.shown) continue;
      l.shown = k;
      l.spr.setFrame(`${l.o.i}:${k}`);
    }
  }

  /**
   * Ground cover: the gust's lean (less in a shadow, none on a wall or in water) plus the bend away from the figure, which goes over quickly and comes
   * back in about half a second. The bend is its own term: it works with the wind held, and with the figure away every blade stands on the frame the
   * composition drew.
   */
  private stepCover(time: number, delta: number): void {
    if (!this.covers.length || this.hold.has('grass') || this.hold.has('covers')) return;
    this.sampleShade();
    const t = time / 1000;
    const wind = !this.hold.has('wind');
    const w = this.world;
    const fx = w.body.x - this.x0 * 64;
    const fy = w.body.y - this.y0 * 64;
    const near = w.player.visible;
    const dt = Math.min(0.1, delta / 1000);
    for (const l of this.covers) {
      const c = l.cover as NonNullable<Leaner['cover']>;
      let target = 0;
      if (near && c.gate) {
        const dx = l.o.fx - fx;
        const q = 1 - Math.hypot(dx / BEND.rx, (l.o.fy - fy) / BEND.ry);
        if (q > 0) target = (dx >= 0 ? 1 : -1) * l.lean * Math.min(1, q * 1.5);
      }
      c.push += (target - c.push) * (1 - Math.exp(-dt / (Math.abs(target) > Math.abs(c.push) ? BEND.over : BEND.back)));
      if (target === 0 && Math.abs(c.push) < 0.05) c.push = 0;
      const sway = wind ? l.lean * c.gate * c.shade * leanSignal(l.o, t, this.wind) : 0;
      const k = Math.max(-l.lean, Math.min(l.lean, Math.round(sway + c.push)));
      if (k === l.shown) continue;
      l.shown = k;
      l.spr.setFrame(`${l.o.i}:${k}`);
    }
  }

  /** sampleShade on a streamed land: each blade's foot read from its unit's copy of the shadows (3 x 3 px), or the full sun where its unit has none yet. */
  private sampleShadeUnits(): void {
    const cast = this.world.cast;
    if (!cast || !this.covers.length || cast.version === this.coverShadeVersion) return;
    const now = performance.now();
    if (now - this.coverShadeAt < 500) return;
    this.coverShadeAt = now;
    this.coverShadeVersion = cast.version;
    const share = Math.max(0.05, this.lit?.al ?? 1);
    for (const l of this.covers) {
      const c = l.cover as NonNullable<Leaner['cover']>;
      const u = this.tiles!.units.find((v) => l.o.fx >= v.x && l.o.fx < v.x + v.w && l.o.fy >= v.y && l.o.fy < v.y + v.h);
      const tex = u && this.waterUnits.get(`${u.ux},${u.uy}`)?.shade;
      if (!u || !tex) {
        c.shade = 1;
        continue;
      }
      const x = Math.min(tex.width - 2, Math.max(1, Math.round(l.o.fx - u.x)));
      const y = Math.min(tex.height - 2, Math.max(1, Math.round(l.o.fy - u.y)));
      const px = tex.getContext().getImageData(x - 1, y - 1, 3, 3).data;
      let a = 0;
      for (let q = 3; q < px.length; q += 4) a = Math.max(a, px[q] ?? 0);
      c.shade = 1 - SHADE_SWAY * Math.min(1, a / 255 / share);
    }
  }

  /** How much of the sun is on each blade's foot, read from the water's copy of the shadows: at most twice a second and only when a shadow moved. */
  private sampleShade(): void {
    if (this.tiles) {
      this.sampleShadeUnits();
      return;
    }
    const tex = this.waterShade;
    const cast = this.world.cast;
    if (!tex || !cast || cast.version === this.coverShadeVersion) return;
    const now = performance.now();
    if (now - this.coverShadeAt < 500) return;
    this.coverShadeAt = now;
    this.coverShadeVersion = cast.version;
    const { width, height } = tex;
    const px = tex.getContext().getImageData(0, 0, width, height).data;
    const share = Math.max(0.05, this.lit?.al ?? 1);
    for (const l of this.covers) {
      const c = l.cover as NonNullable<Leaner['cover']>;
      const x = Math.min(width - 2, Math.max(1, Math.round(l.o.fx)));
      const y = Math.min(height - 2, Math.max(1, Math.round(l.o.fy)));
      let a = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) a = Math.max(a, px[((y + dy) * width + x + dx) * 4 + 3] ?? 0);
      c.shade = 1 - SHADE_SWAY * Math.min(1, a / 255 / share);
    }
  }

  /** At rest the figure breathes on the idle sheet of its facing; the world's own walk sets the frames while it walks. */
  private stepFigure(time: number): void {
    const w = this.world;
    const s = this.session;
    if (!s || w.body.moving) return;
    // only a race that wears the painted figure breathes on its idle sheet; a race's own sheet rests on its standing frame
    if (!this.bundle.races[s.state.player.race ?? '']?.sprite.startsWith(FIGURE.walk)) return;
    const face = s.facing === 'right' ? 'left' : s.facing;
    const key = `${FIGURE.idle}_${face}`;
    if (!w.textures.exists(key)) return;
    const frame = Math.floor(time / IDLE_MS) % IDLE_POSES;
    if (w.player.texture.key !== key) w.player.setTexture(key, frame);
    else if (w.player.frame.name !== String(frame)) w.player.setFrame(frame);
    w.player.setFlipX(s.facing === 'right');
  }

  /**
   * The figure's edge: one art pixel all round, in the ground's own colour pushed away in lightness, so the figure stands off the ground on any land
   * (dark ground gets a lifted rim, light ground a dark line). The ground under the feet is read from the painting's own ground plate. The edge is the
   * figure's frame drawn eight times, flat, behind it; it never touches the sprite's pixels and it is never lit by the engine.
   */
  private stepEdge(): void {
    if (!this.edgeOn) {
      for (const e of this.edge) e.setVisible(false);
      return;
    }
    const w = this.world;
    const p = w.player;
    if (!this.edge.length) {
      for (let i = 0; i < 8; i++) {
        const e = w.add.sprite(p.x, p.y, p.texture.key, p.frame.name);
        e.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
        this.edge.push(e);
      }
    }
    const fx = Math.round(w.body.x - this.x0 * 64);
    const fy = Math.round(w.body.y - this.y0 * 64);
    const foot = `${fx},${fy}`;
    if (foot !== this.edgeFoot) {
      this.edgeFoot = foot;
      this.edgeRgb = this.groundUnder(fx, fy);
    }
    const [r, g, b] = this.edgeRgb;
    const luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    // a dark ground gets a lifted rim (half the way to white), a light one a dark line (a quarter of its own colour)
    const lift = (c: number): number => c + (255 - c) * 0.55;
    const rgb = luma < EDGE_SPLIT ? [lift(r), lift(g), lift(b)] : [r * 0.25, g * 0.25, b * 0.25];
    const tint = (Math.round(rgb[0]!) << 16) | (Math.round(rgb[1]!) << 8) | Math.round(rgb[2]!);
    const d = 0.25;
    const offs: [number, number][] = [[-d, 0], [d, 0], [0, -d], [0, d], [-d, -d], [d, -d], [-d, d], [d, d]];
    this.edge.forEach((e, i) => {
      const [ox, oy] = offs[i]!;
      if (e.texture.key !== p.texture.key || e.frame.name !== p.frame.name) e.setTexture(p.texture.key, p.frame.name);
      e.setOrigin(p.originX, p.originY).setScale(p.scaleX, p.scaleY).setFlipX(p.flipX).setPosition(p.x + ox, p.y + oy);
      e.setDepth(p.depth - 0.5).setVisible(p.visible).setTint(tint);
    });
  }

  /** Where the figure's drawn sole is, in world units: the middle of the frame across, the sole's row down. */
  private soleOf(p: Phaser.GameObjects.Sprite): [number, number] {
    return [p.x + (0.5 - p.originX) * p.displayWidth, p.y + (FIGURE_SOLE / 128 - p.originY) * p.displayHeight];
  }

  /**
   * Where the drawn feet sit, read once per texture key from the sheet: across, the median over its frames of the middle of the lowest three
   * rows (art pixels from the frame's middle); down, each frame's own lowest row (the walk's frames stand 85 to 100 rows down the frame).
   */
  private feetOf(p: Phaser.GameObjects.Sprite): { x: number; sole: Map<string, number> } {
    const key = p.texture.key;
    const known = this.feetOff.get(key);
    if (known) return known;
    const tex = p.texture;
    const names = tex.getFrameNames().filter((n) => n !== '__BASE');
    const img = tex.getSourceImage() as CanvasImageSource & { width: number; height: number };
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(img, 0, 0);
    const px = ctx.getImageData(0, 0, c.width, c.height).data;
    const fr = names.map((n) => tex.get(n));
    const w = fr[0]?.cutWidth ?? 128;
    const h = fr[0]?.cutHeight ?? 128;
    const at = (f: number, x: number, y: number): number => px[((fr[f]!.cutY + y) * c.width + fr[f]!.cutX + x) * 4 + 3] ?? 0;
    const sole = new Map<string, number>();
    names.forEach((n, f) => sole.set(n, bottomRow(f, w, h, at) + SOLE_BELOW_BOTTOM));
    const out = { x: feetOffset(fr.length, w, h, at), sole };
    this.feetOff.set(key, out);
    return out;
  }

  /**
   * The scale of the figure as this scene draws it against FIG_REF_ROWS: the median over the race's facing-down walk sheet's frames of the rows from the
   * highest to the lowest opaque pixel, in art pixels, read once a session (not the current texture, so a turn or a step never resizes the window).
   */
  private figScale(p: Phaser.GameObjects.Sprite): number {
    if (this.figK > 0) return this.figK;
    const own = this.bundle.races[this.session?.state.player.race ?? '']?.sprite ?? '';
    const tex = this.world.textures.exists(own) ? this.world.textures.get(own) : p.texture;
    const names = tex.getFrameNames().filter((n) => n !== '__BASE');
    const img = tex.getSourceImage() as CanvasImageSource & { width: number; height: number };
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(img, 0, 0);
    const px = ctx.getImageData(0, 0, c.width, c.height).data;
    const rows: number[] = [];
    const f0 = names.length ? tex.get(names[0]!) : undefined;
    if (f0) {
      const apf = (p.displayHeight * ART) / 128;
      let bot = -1;
      for (let y = 0; y < f0.cutHeight; y++) for (let x = 0; x < f0.cutWidth; x++) if ((px[((f0.cutY + y) * c.width + f0.cutX + x) * 4 + 3] ?? 0) > 0) bot = y;
      for (let y = bot; y >= 0; y -= SEE_SAMPLE) {
        for (let x = SEE_SAMPLE / 2; x < f0.cutWidth; x += SEE_SAMPLE) {
          if ((px[((f0.cutY + y) * c.width + f0.cutX + x) * 4 + 3] ?? 0) > 0) this.figPts.push([(x - f0.cutWidth / 2) * apf, (bot - y) * apf]);
        }
      }
    }
    for (const n of names) {
      const f = tex.get(n);
      let top = -1;
      let bot = -1;
      for (let y = 0; y < f.cutHeight; y++) {
        let any = false;
        for (let x = 0; x < f.cutWidth && !any; x++) any = (px[((f.cutY + y) * c.width + f.cutX + x) * 4 + 3] ?? 0) > 0;
        if (any) {
          if (top < 0) top = y;
          bot = y;
        }
      }
      if (top >= 0) rows.push(bot - top + 1);
    }
    const artPerFrame = (p.displayHeight * ART) / 128;
    this.figK = rows.length ? (median(rows) * artPerFrame) / FIG_REF_ROWS : 1;
    return this.figK;
  }

  /** The ground plate's pixels (read once), for the edge and the contact patch. */
  private plate(): { w: number; h: number; px: Uint8ClampedArray } {
    if (this.tiles) return this.streamPlate();
    if (!this.edgeGround) {
      const img = this.world.textures.get('painted:ground').getSourceImage() as CanvasImageSource & { width: number; height: number };
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext('2d', { willReadFrequently: true })!;
      ctx.drawImage(img, 0, 0);
      this.edgeGround = { w: c.width, h: c.height, px: ctx.getImageData(0, 0, c.width, c.height).data };
    }
    return this.edgeGround;
  }

  /**
   * A streamed land's plate for the figure's reads (edge, contact): a whole-scene array whose units are filled from each unit's ground as it is resident, grey elsewhere. It is
   * the scene's size on the CPU (17.8 MB for the valley block) but holds no texture; a unit's pixels are read from its image once, when first wanted.
   */
  private streamPlate(): { w: number; h: number; px: Uint8ClampedArray } {
    const { width, height } = this.scene;
    if (!this.edgeGround) {
      const px = new Uint8ClampedArray(width * height * 4);
      px.fill(128);
      this.edgeGround = { w: width, h: height, px };
    }
    const g = this.edgeGround;
    const st = this.stream;
    const textures = this.world.textures;
    for (const u of this.tiles!.units) {
      const k = `${u.ux},${u.uy}`;
      if (this.unitPlate.has(k) || !st?.isLit(u)) continue;
      const key = layerKey(u, 'ground');
      if (!textures.exists(key)) continue;
      const c = document.createElement('canvas');
      c.width = u.w;
      c.height = u.h;
      const ctx = c.getContext('2d', { willReadFrequently: true })!;
      ctx.drawImage(textures.get(key).getSourceImage() as CanvasImageSource, 0, 0);
      const data = ctx.getImageData(0, 0, u.w, u.h).data;
      for (let r = 0; r < u.h; r++) g.px.set(data.subarray(r * u.w * 4, (r + 1) * u.w * 4), ((u.y + r) * width + u.x) * 4);
      this.unitPlate.set(k, { x: u.x, y: u.y, w: u.w, h: u.h, px: data });
    }
    return g;
  }

  /** The strength the ground under (fx, fy) wants: the band under the feet against the median L* of the ring one figure height round. */
  private contactWant(fx: number, fy: number): number {
    const cfg = this.contactCfg;
    const { w, h, px } = this.plate();
    let r = 0, g = 0, b = 0, l = 0, n = 0;
    for (let y = Math.max(0, Math.round(fy) - 2); y <= Math.min(h - 1, Math.round(fy) + 1); y++) {
      for (let x = Math.max(0, Math.round(fx) - 4); x <= Math.min(w - 1, Math.round(fx) + 4); x++) {
        const i = (y * w + x) * 4;
        r += px[i]!; g += px[i + 1]!; b += px[i + 2]!; l += lstar(px[i]!, px[i + 1]!, px[i + 2]!); n++;
      }
    }
    if (!n) return 0;
    const ring: number[] = [];
    for (let y = Math.max(0, Math.round(fy) - CONTACT_RING); y <= Math.min(h - 1, Math.round(fy) + CONTACT_RING); y += 3) {
      for (let x = Math.max(0, Math.round(fx) - CONTACT_RING); x <= Math.min(w - 1, Math.round(fx) + CONTACT_RING); x += 3) {
        if ((x - fx) ** 2 + (y - fy) ** 2 > CONTACT_RING * CONTACT_RING) continue;
        const i = (y * w + x) * 4;
        ring.push(lstar(px[i]!, px[i + 1]!, px[i + 2]!));
      }
    }
    return aimAlpha([r / n, g / n, b / n], l / n, median(ring), cfg.tint!, { aim: cfg.aim!, skip: cfg.skip!, max: cfg.alpha!, cover: cfg.cover! });
  }

  /**
   * The contact patch: one ellipse of art pixels under the sole, multiplied in, on the art grid. Centred on the drawn feet (the offset read from
   * the sheet), its strength follows the ground (`contactWant`) and eases toward it so it never pops while walking.
   */
  private stepContact(delta: number): void {
    const w = this.world;
    const p = w.player;
    const cfg = this.contactCfg;
    const key = `painted:contact-${cfg.rx}-${cfg.ry}`;
    if (!this.contact || this.contact.texture.key !== key) {
      const rx = cfg.rx!, ry = cfg.ry!;
      if (!w.textures.exists(key)) {
        const tex = w.textures.createCanvas(key, 2 * rx + 1, 2 * ry + 1) as Phaser.Textures.CanvasTexture;
        tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
        const ctx = tex.getContext();
        ctx.fillStyle = '#ffffff';
        for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++) if ((x / (rx + 0.5)) ** 2 + (y / (ry + 0.5)) ** 2 <= 1) ctx.fillRect(x + rx, y + ry, 1, 1);
        tex.refresh();
      }
      if (!this.contact) {
        this.contact = w.add.image(0, 0, key).setOrigin(0.5).setScale(1 / ART).setBlendMode(Phaser.BlendModes.MULTIPLY);
        w.noCast.add(this.contact);
      } else this.contact.setTexture(key);
    }
    const [sx, sy0] = this.soleOf(p);
    const feet = this.feetOf(p);
    // the middle of the drawn feet across, mirrored with the sprite; the frame's own sole down (soleOf is the idle frame's)
    const off = feet.x * (p.flipX ? -1 : 1);
    const sy = sy0 + ((feet.sole.get(String(p.frame.name)) ?? FIGURE_SOLE) - FIGURE_SOLE) * (p.displayHeight / 128);
    const ax = Math.round(sx * ART + off), ay = Math.round(sy * ART);
    if (cfg.adapt) {
      const foot = `${ax},${ay},${cfg.alpha},${cfg.aim},${cfg.skip},${cfg.cover}`;
      if (foot !== this.contactFoot) {
        this.contactFoot = foot;
        this.contactTarget = this.contactWant(ax - this.x0 * 64, ay - this.y0 * 64);
      }
      this.contactA = easeAlpha(this.contactA, this.contactTarget, delta);
    } else this.contactA = cfg.alpha!;
    this.contact.setTint(cfg.tint).setAlpha(this.contactA);
    // the patch's middle `dy` art pixels under the sole row, snapped to the art grid
    this.contact.setPosition(ax / ART, (ay + cfg.dy!) / ART).setDepth(p.depth - 0.6).setVisible(this.contactOn && p.visible && this.contactA > 0.004);
  }

  /**
   * The halo: one soft glow round the figure, the size of the see-through window, its colour, blend and strength the race's (painted-halo.json),
   * its strength rising as the table's light falls (one smoothstep of how dark the table is). It is drawn above the lantern's layers with the
   * figure's own pixels cut out of it, so the ring never swallows it and the figure is never veiled. The see-through window is untouched.
   */
  private stepHalo(): void {
    const w = this.world;
    const p = w.player;
    const race = this.raceOverride || this.session?.state?.player?.race || 'core/elf';
    const spec = (haloData.races as Record<string, { colour: number[]; day: number; dim: number; night: number; window: number; blend: string } | null>)[race];
    const l = this.lit;
    if (!spec || !l) {
      this.halo?.setVisible(false);
      return;
    }
    const key = 'painted:halo';
    if (!w.textures.exists(key)) {
      const { w: hw, h: hh, core } = haloData.shape;
      const tex = w.textures.createCanvas(key, hw, hh) as Phaser.Textures.CanvasTexture;
      const ctx = tex.getContext();
      const im = ctx.createImageData(hw, hh);
      for (let y = 0; y < hh; y++) {
        for (let x = 0; x < hw; x++) {
          const q = Math.hypot((x + 0.5 - hw / 2) / (hw / 2), (y + 0.5 - hh / 2) / (hh / 2));
          const t = q <= core ? 1 : q >= 1 ? 0 : (1 - q) / (1 - core);
          const i = (y * hw + x) * 4;
          im.data[i] = im.data[i + 1] = im.data[i + 2] = 255;
          im.data[i + 3] = Math.round(t * t * (3 - 2 * t) * 255);
        }
      }
      ctx.putImageData(im, 0, 0);
      tex.refresh();
    }
    if (!this.halo) {
      this.halo = w.add.image(0, 0, key).setOrigin(0.5).setScale(1 / ART);
      w.noCast.add(this.halo);
      // the figure's own pixels are cut out of the glow, drawn where the figure is in the world
      this.halo.enableFilters();
      this.halo.filters?.internal.addMask(p, true);
    }
    const luma = (c: readonly number[]): number => 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
    const lightNow = luma([l.amb[0] + l.sun[0] * l.elev, l.amb[1] + l.sun[1] * l.elev, l.amb[2] + l.sun[2] * l.elev]);
    const dark = Math.max(0, Math.min(1, 1 - lightNow / haloData.ref));
    const u = Math.max(0, Math.min(1, (dark - haloData.from) / (haloData.to - haloData.from)));
    const sunL = luma([l.sun[0] * l.elev, l.sun[1] * l.elev, l.sun[2] * l.elev]);
    const out = 1 - Math.max(0, Math.min(1, sunL / haloData.sunOut));
    const dim = spec.day + (spec.dim - spec.day) * u * u * (3 - 2 * u);
    // behind a tall thing the window is open and the glow is what shows in it: the race's own extra strength, as far as the window is open
    const strength = dim + (spec.night - dim) * out + spec.window * this.seeAmount;
    const [sx, sy] = this.soleOf(p);
    this.halo
      .setTint(packRgb(spec.colour.map((c) => c / 255)))
      .setBlendMode(spec.blend === 'add' ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL)
      .setAlpha(strength)
      .setScale(this.figScale(p) / ART)
      .setPosition(sx, sy - (SEE_LOCAL.figH * this.figScale(p)) / 2 / ART)
      .setDepth(9650)
      .setVisible(p.visible && strength > 0.004);
  }

  /**
   * See-through: an object drawn in front of the figure (deeper than it) whose own opaque pixels cover at least `SEE_THROUGH.cover` of the
   * points sampled on the figure's drawn silhouette is thinned round the figure's middle only (SEE_LOCAL: a soft round mask on the sprite), and comes back whole when
   * the figure leaves. One way for every object; read from the objects' own sheet, so a crown's empty corner never thins it.
   */
  private stepSeeThrough(delta: number): void {
    this.seeAmount = 0;
    const sprites = this.sprites;
    if (!this.seeThrough) {
      for (const s of [...this.seeMasks.keys()]) this.dropSeeMask(s);
      return;
    }
    if (!this.hasAlpha()) return;
    const p = this.world.player;
    const [sx, sy] = this.soleOf(p);
    // her body: the points sampled on her drawn silhouette (figScale reads them with the scale), from her lowest drawn row up to the head
    const fk = this.figScale(p);
    const flip = p.flipX ? -1 : 1;
    const pts: [number, number][] = this.figPts.map(([dx, dy]) => [sx + (dx * flip) / ART, sy - dy / ART]);
    // the middle of the body, where the mask is deepest
    const mx = sx;
    const my = sy - (SEE_LOCAL.figH * fk) / 2 / ART;
    const step = delta * SEE_LOCAL.perMs;
    for (let k = 0; k < sprites.length; k++) {
      const s = sprites[k]!;
      let want = 0;
      const o = this.spriteObj[k]!;
      const left = s.x - s.displayWidth / 2;
      const top = s.y - s.displayHeight;
      if (s.visible && s.depth > p.depth) {
        let n = 0;
        for (const [px, py] of pts) {
          let lx = Math.floor((px - left) * ART);
          const ly = Math.floor((py - top) * ART);
          if (lx < 0 || ly < 0 || lx >= o.w || ly >= o.h) continue;
          if (s.flipX) lx = o.w - 1 - lx;
          if (this.alphaAt(o, ly, lx) > 0) n++;
        }
        if (n >= SEE_THROUGH.cover) want = 1;
      }
      let m = this.seeMasks.get(s);
      if (!m) {
        if (want === 0) continue;
        m = this.addSeeMask(s);
        if (!m) continue;
      }
      m.k = want > m.k ? Math.min(want, m.k + step) : Math.max(want, m.k - step);
      this.seeAmount = Math.max(this.seeAmount, m.k);
      if (m.k <= 0 && want === 0) {
        this.dropSeeMask(s);
        continue;
      }
      // the figure's middle in the sprite's own frame, in art pixels (the mask is drawn in the frame's pixels; the frame is the sprite unflipped)
      let lx = (mx - left) * ART;
      const ly = (my - top) * ART;
      // scene sprites are never mirrored in this file (flipX is the figure's and the animal's), so this line has not been exercised
      if (s.flipX) lx = s.displayWidth * ART - lx;
      m.img.setPosition(lx + m.padX, ly + m.padY).setAlpha(this.seeFade * m.k);
    }
  }

  private seeKey(): string {
    return `painted:seemask:${this.seeGrow}:${this.seeEdge}:${(this.figK || 1).toFixed(3)}`;
  }

  /** The mask's capsule as a texture of the sheet's pixels (made once): white, alpha 1 inside the figure grown by `seeGrow`, a straight ramp `seeEdge` wide to 0. */
  private seeDims(): { r: number; half: number; w: number; h: number } {
    const k = this.figK || 1;
    const r = (SEE_LOCAL.figW * k) / 2 + this.seeGrow;
    const half = (SEE_LOCAL.figH * k) / 2 + this.seeGrow;
    return { r, half, w: 2 * Math.ceil(r + this.seeEdge) + 2, h: 2 * Math.ceil(half + this.seeEdge) + 2 };
  }

  private seeTexture(): boolean {
    const w = this.world;
    if (w.textures.exists(this.seeKey())) return true;
    const { r, half, w: tw, h: th } = this.seeDims();
    const tex = w.textures.createCanvas(this.seeKey(), tw, th);
    if (!tex) return false;
    const ctx = tex.getContext();
    const im = ctx.createImageData(tw, th);
    const seg = half - r;
    for (let y = 0; y < th; y++) {
      for (let x = 0; x < tw; x++) {
        const dx = x + 0.5 - tw / 2;
        const dy = Math.max(0, Math.abs(y + 0.5 - th / 2) - seg);
        const d = Math.hypot(dx, dy) - r;
        const a = d <= 0 ? 1 : d >= this.seeEdge ? 0 : 1 - d / this.seeEdge;
        const i = (y * tw + x) * 4;
        im.data[i] = im.data[i + 1] = im.data[i + 2] = 255;
        im.data[i + 3] = Math.round(a * 255);
      }
    }
    ctx.putImageData(im, 0, 0);
    tex.refresh();
    return true;
  }

  /** The share of an object the mask takes, one art pixel apart from the figure's middle out to the edge of the round, read from the mask's own pixels (a rig's check of S2). */
  seeProfile(): number[] {
    if (!this.seeTexture()) return [];
    const src = this.world.textures.get(this.seeKey()).getSourceImage() as HTMLCanvasElement;
    const d = src.width;
    const row = src.getContext('2d')!.getImageData(0, Math.floor(src.height / 2), d, 1).data;
    const out: number[] = [];
    for (let x = Math.floor(d / 2); x < d; x++) out.push(((row[x * 4 + 3] ?? 0) / 255) * this.seeFade);
    return out;
  }

  /** A mask for one sprite: a soft round of the sheet's pixels, the filter that multiplies the sprite by what the round does not cover. */
  private addSeeMask(s: Phaser.GameObjects.Sprite): { img: Phaser.GameObjects.Image; ctrl: unknown; k: number; padX: number; padY: number } | undefined {
    const w = this.world;
    if (!this.seeTexture()) return undefined;
    // not on the display list: the filter draws it into its own texture and nothing else shows it
    const img = new Phaser.GameObjects.Image(w, 0, 0, this.seeKey());
    s.enableFilters();
    const list = s.filters?.internal;
    if (!list) return undefined;
    // the mask is drawn in the sprite's own frame pixels, so it is seen through a camera that moves and zooms nothing (the game camera's zoom would carry it off the frame)
    this.seeCam ??= new Phaser.Cameras.Scene2D.Camera(0, 0, 8192, 8192).setScene(w, false);
    const ctrl = list.addMask(img, true, this.seeCam, 'local');
    const [padX, padY] = this.hold.has('nobucket4b') ? [0, 0] : bucketFilter(s);
    const m = { img, ctrl, k: 0, padX, padY };
    this.seeMasks.set(s, m);
    return m;
  }

  private dropSeeMask(s: Phaser.GameObjects.Sprite): void {
    const m = this.seeMasks.get(s);
    if (!m) return;
    const list = s.filters?.internal;
    if (list) list.remove(m.ctrl as Parameters<typeof list.remove>[0]);
    m.img.destroy();
    this.seeMasks.delete(s);
  }

  /** The mean colour of the ground plate in a small window round the feet, in art pixels. */
  private groundUnder(fx: number, fy: number): [number, number, number] {
    const { w, h, px } = this.plate();
    let r = 0, g = 0, b = 0, n = 0;
    for (let y = Math.max(0, fy - 8); y <= Math.min(h - 1, fy + 8); y += 2) {
      for (let x = Math.max(0, fx - 14); x <= Math.min(w - 1, fx + 14); x += 2) {
        const i = (y * w + x) * 4;
        r += px[i]!; g += px[i + 1]!; b += px[i + 2]!; n++;
      }
    }
    return n ? [r / n, g / n, b / n] : [128, 128, 128];
  }

  private stepAnimal(delta: number): void {
    const a = this.animal;
    if (!a) return;
    const next = this.animalRoute[0];
    if (!next) {
      const strip = `idle-${this.animalFacing === 'right' ? 'left' : this.animalFacing}`;
      this.showAnimal(strip, Math.floor(performance.now() / ANIMAL_IDLE_MS) % (this.lynx[strip]?.frames ?? 1));
      a.setFlipX(this.animalFacing === 'right');
      return;
    }
    this.animalT += delta;
    const k = Math.min(1, this.animalT / ANIMAL_MS);
    const [ax, ay] = this.animalAt;
    const [bx, by] = next;
    this.animalFacing = by > ay ? 'down' : by < ay ? 'up' : bx < ax ? 'left' : 'right';
    const wx = (this.x0 + ax + 0.5 + (bx - ax) * k) * T;
    const wy = (this.y0 + ay + 0.5 + (by - ay) * k) * T;
    a.setPosition(Math.round(wx * ART) / ART, Math.round(wy * ART) / ART).setDepth(Math.round(wy) + 1);
    const strip = `walk-${this.animalFacing === 'right' ? 'left' : this.animalFacing}`;
    const frames = this.lynx[strip]?.frames ?? 1;
    this.showAnimal(strip, Math.floor(performance.now() / ANIMAL_POSE_MS) % frames);
    a.setFlipX(this.animalFacing === 'right');
    if (k >= 1) {
      this.animalAt = next;
      this.steps.roe.push([next[0], next[1]]);
      this.animalRoute.shift();
      this.animalT = 0;
    }
  }

  private hideAir(): void {
    for (const obj of this.world.children.list) {
      const key = (obj as { texture?: { key?: string } }).texture?.key ?? '';
      if (key.startsWith('fx-') || key.startsWith('senses-')) (obj as unknown as Phaser.GameObjects.Components.Visible).setVisible(false);
      if (obj === this.world.veil) (obj as Phaser.GameObjects.Container).setVisible(false);
    }
  }

  // ------------------------------------------------------------ for the harness

  /** Walks the animal to a free cell along a route of free cells; false when there is none. */
  roeTo(x: number, y: number): boolean {
    const route = this.route(this.animalAt, [x, y]);
    if (!route) return false;
    this.animalRoute = route;
    this.animalT = 0;
    return true;
  }

  roePlace(x: number, y: number): void {
    this.animalAt = [x, y];
    this.animalRoute = [];
    this.placeAnimal(x, y);
  }

  get roeBusy(): boolean {
    return this.animalRoute.length > 0;
  }

  roeShown(on: boolean): void {
    this.animal?.setVisible(on);
  }

  playerShown(on: boolean): void {
    this.world.player.setVisible(on);
  }

  setHold(list: string): void {
    this.hold.clear();
    for (const h of list.split(',')) if (h) this.hold.add(h);
    // a tree held by the wind's hold stands at rest, whatever gust it was caught in; held grass stands on the drawn frame, and a bend is let go
    for (const l of this.leaners) {
      if (l.cover ? !this.hold.has('grass') : !this.hold.has('wind')) continue;
      l.shown = 0;
      if (l.cover) l.cover.push = 0;
      l.spr.setFrame(`${l.o.i}:0`);
    }
    this.litMinute = -1;
  }

  /**
   * For the look measures: the water's own clock set to `t` seconds, so that two frames at exact times can be taken from a held water
   * (hold `water`) without the wall clock in the numbers. Nothing in play calls it.
   */
  seekLook(t: number): void {
    this.waterTime = t;
    this.fogTime = t;
  }

  /** The clock's minute now, as the world reads it. */
  minuteNow(): number {
    const s = this.session;
    if (!s) return NOON;
    const day = this.bundle.params.day_length_ms;
    return (((s.tick + day / 2) % day) * 1440) / day;
  }

  /** The cell the mount put the figure on. */
  firstFreeCell(): [number, number] {
    return this.firstFree();
  }

  /** A walker's box on screen, its frame and its facing: what a read needs to find its pixels. */
  walkerBox(who: 'player' | 'roe'): number[] {
    const obj = who === 'player' ? this.world.player : this.animal;
    if (!obj) return [0, 0, 0, 0];
    const cam = this.world.cameras.main;
    const b = obj.getBounds();
    return [(b.x - cam.worldView.x) * cam.zoom, (b.y - cam.worldView.y) * cam.zoom, b.width * cam.zoom, b.height * cam.zoom];
  }

  /** What a walker shows now: its sheet, frame, mirror and scales. */
  walkerState(who: 'player' | 'roe'): { key: string; frame: string; flip: boolean; sx: number; sy: number; moving: boolean } | undefined {
    const obj = who === 'player' ? this.world.player : this.animal;
    if (!obj) return undefined;
    return { key: obj.texture.key, frame: String(obj.frame.name), flip: obj.flipX, sx: obj.scaleX, sy: obj.scaleY, moving: who === 'player' ? this.world.body.moving : this.roeBusy };
  }

  /** Shows or hides every piece. */
  objectsShown(on: boolean): void {
    for (const s of this.sprites) s.setVisible(on);
  }

  /** Shows one piece alone (by its place in the scene's list); -1 hides them all. */
  objectAlone(index: number): void {
    this.sprites.forEach((s, i) => s.setVisible(i === index));
  }

  /** Every piece: its index, its foot on the screen, its kind and whether it leans. */
  objectList(): { i: number; kind: string; x: number; y: number; leans: boolean; river: boolean }[] {
    const cam = this.world.cameras.main;
    const leaning = new Set(this.leaners.map((l) => l.o.i));
    return this.scene.objects.map((o, n) => {
      const s = this.sprites[n] as Phaser.GameObjects.Sprite;
      return { i: o.i, kind: o.kind, x: (s.x - cam.worldView.x) * cam.zoom, y: (s.y - cam.worldView.y) * cam.zoom, leans: leaning.has(o.i), river: o.river };
    });
  }

  /** Every ground-cover piece: its rect and foot on the scene, its lean range, whether it sways at all (gate), its sun share, the frame it shows and its bend. */
  coverList(): { i: number; kind: string; fx: number; fy: number; x0: number; y0: number; w: number; h: number; lean: number; gate: number; shade: number; k: number; push: number }[] {
    return this.covers.map((l) => {
      const c = l.cover as NonNullable<Leaner['cover']>;
      return { i: l.o.i, kind: l.o.kind, fx: l.o.fx, fy: l.o.fy, x0: l.o.x0, y0: l.o.y0, w: l.o.w, h: l.o.h, lean: l.lean, gate: c.gate, shade: c.shade, k: l.shown, push: c.push };
    });
  }

  /** Each leaning piece's lean now, in art px at its top. */
  leansNow(): { i: number; fx: number; fy: number; lean: number; k: number }[] {
    return this.leaners.map((l) => ({ i: l.o.i, fx: l.o.fx, fy: l.o.fy, lean: l.lean, k: l.shown }));
  }

  /** The light as the engine holds it now, for the report. */
  lightNow(): Lit | undefined {
    return this.lit;
  }

  /** Sets the clock to a minute of the day, on the same day or a later one: held if `clock` is held. */
  setMinute(minute: number): void {
    const s = this.session;
    if (!s) return;
    const day = this.bundle.params.day_length_ms;
    const want = Math.round((minute / 1440) * day);
    let tick = want - Math.floor(day / 2);
    while (tick < s.tick) tick += day;
    s.tick = tick;
    this.frozenTick = this.hold.has('clock') ? tick : undefined;
    this.litMinute = -1;
  }

  /** Sets the clock to a minute of the FIRST day (tick 0 is 12:00, so the day runs 12:00 to 12:00): a measure's sweep over 24 hours stays on one day, whatever the clock read before. */
  setMinuteFirstDay(minute: number): void {
    const s = this.session;
    if (!s) return;
    const day = this.bundle.params.day_length_ms;
    const tick = Math.round((((minute - 720) % 1440) + 1440) % 1440 / 1440 * day);
    s.tick = tick;
    this.frozenTick = this.hold.has('clock') ? tick : undefined;
    this.litMinute = -1;
  }
}

export { PREVIEW_QUERY, presenceOf, zoomOf };

/** the land's whole pictures in the order the first frame needs them: the plate, the walls, the pieces and the water's bed, then their relief */
/**
 * The first layers of the units round the player's start, nearest first, for the early fetch: the start is the map's spawn, the view the window's size at one scene px a CSS px
 * (the phone's camera, zoom 4), padded as the stream pads it. The stream takes them over at build (its port's fetch reads the early ones first).
 */
function earlyUnits(mount: PaintedMount, tiles: PaintedTiles, base: string): { key: string; url: string }[] {
  const spawn = (mount.bundle.map as { spawn?: { x: number; y: number } }).spawn ?? { x: mount.x0, y: mount.y0 };
  const px = (spawn.x - mount.x0 + 0.5) * 64;
  const py = (spawn.y - mount.y0 + 0.5) * 64;
  const hw = (typeof window === 'undefined' ? 422 : window.innerWidth / 2) + STREAM.pad;
  const hh = (typeof window === 'undefined' ? 195 : window.innerHeight / 2) + STREAM.pad;
  const near = tiles.units
    .filter((u) => {
      const r = u.reach ?? u;
      return r.x < px + hw && r.x + r.w > px - hw && r.y < py + hh && r.y + r.h > py - hh;
    })
    .sort((a, b) => Math.hypot(a.x + a.w / 2 - px, a.y + a.h / 2 - py) - Math.hypot(b.x + b.w / 2 - px, b.y + b.h / 2 - py));
  const out: { key: string; url: string }[] = [];
  for (const name of ['ground', 'walls', 'objects']) for (const u of near) {
    const l = u.layers.find((x) => x.name === name);
    if (l) out.push({ key: layerKey(u, name), url: `${base}/${l.file}` });
  }
  return out;
}

export const EARLY_ORDER = ['painted:ground', 'painted:walls', 'painted:objects', 'painted:water-bed', 'painted:footline', 'painted:ground-n', 'painted:walls-n', 'painted:objects-n'];

/** Loads the scene file and builds the mount for the query, or throws. */
/**
 * Where a painted land's pictures are read from, the one place: a folder beside the page (`painted/<scene id>`), the preview server's today. When the pictures move to our own store
 * (DECISIONS 2026-11-22), this is the one line that names its URL; nothing else in the code holds a source.
 */
export const PAINTED_BASE = 'painted';

export async function mountPainted(raw: Bundle, search: string): Promise<PaintedMount> {
  const q = new URLSearchParams(search);
  const id = q.get('painted') ?? '';
  const base = `${PAINTED_BASE}/${id}`;
  const read = async <V>(name: string): Promise<V> => {
    const res = await fetch(`${base}/${name}`);
    if (!res.ok) throw new Error(`painted: ${base}/${name} answered ${res.status}`);
    return (await res.json()) as V;
  };
  // the three small files at once: each is a round trip, 170 ms on a phone's 4G
  const [scene, lynx, means] = await Promise.all([read<PaintedScene>('scene.json'), read<Record<string, LynxStrip>>('figures/lynx.json'), read<[number, number, number]>('water.json')]);
  // a land cut into units streams (scene.json's `tiles`); `?whole` lays it whole
  const tiles = !q.has('whole') && scene.tiles?.format === 1 ? scene.tiles : undefined;
  const mount = new PaintedMount(raw, scene, base, lynx, new Set((q.get('hold') ?? '').split(',').filter(Boolean)), means, Number(q.get('waterstage') ?? 6), presenceOf(search), tiles);
  if (tiles && !q.has('late')) mount.early.want(earlyUnits(mount, tiles, base));
  // the land's pictures start now, beside the boot, not behind the kit in the loader's queue (V5b); the first frame's first, the relief after
  if (!tiles && !q.has('late')) mount.early.want(EARLY_ORDER.filter((n) => mount.bundle.sprites[n]?.url).map((n) => ({ key: n, url: mount.bundle.sprites[n]!.url })));
  const zoom = zoomOf(search);
  mount.setZoomValue(zoom.value);
  mount.zoomAuto = zoom.auto;
  return mount;
}
