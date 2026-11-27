/**
 * The lights' pools on a painted land, drawn as light (figure presence, #16, rounds three and four; the numbers are light.ts's PAINTED_POOL and PAINTED_LIGHTS).
 *
 * One light map holds every light's stepped, dithered pool as a colour per art pixel, each channel the share of that light's gain (a light that overlaps another keeps the brighter of the two:
 * the map is composed with a MAX blend, so two pools never sum and never leave a seam). The map is then laid over the scene `passes` times with the blend `dst x (1 + src)`, so every pixel
 * under a pool shows the picture's own colour times the light's gain. A pixel the map leaves at 0 is multiplied by exactly 1: nothing outside a pool changes by one level.
 *
 * Round four: each light is filled on the CPU into a box of its own (a canvas texture, one texel an art pixel), not stamped from one shared grey texture, for two reasons. The colour of the
 * light is the row's (a torch is redder than a lantern), so the gain is baked per channel into the texel; and a standing piece takes the light by what faces it: where the pool's box lies over
 * the land's standing mask (standing.ts), a pixel of a piece takes the step's level times the facing share (its silhouette's outward direction against the direction to the light, three
 * dithered steps), a pixel of ground takes the step's level as it is. A box is filled again only when its light moves to another art pixel, its flame steps or its gain changes; the whole
 * map is drawn again only then, and `counters` say how often (the cost bar's X1).
 *
 * The map is a render texture only as large as the view, its corner stepping by SNAP world units (as the light layer's do).
 */
import * as Phaser from 'phaser';

import { FLAME_LEVELS, PAINTED_LIGHTS, PAINTED_POOL, type PaintedLightKind, flameLevel, lightNow, paintedPoolStep, poolGain, poolRadiusArt, poolTexelValue } from './light';
import { type Standing, FACE_SHARE, bayerAt, facingShare, facingStep } from './standing';

/** Art pixels a world unit. */
const ART = 4;
/** The map's corner steps by this many world units. */
const SNAP = 32;
const MAP_KEY = 'fx-pool-map';
const BOX_KEY = 'fx-pool-box';

/** One light: its pool's centre on the ground, world units (whole art pixels), and its kind (a row of PAINTED_LIGHTS). */
export interface PoolLight {
  x: number;
  y: number;
  kind: PaintedLightKind;
  /** a number that tells one light's flame from another's (the same kind of light does not flicker in step) */
  seed?: number;
  /** the one she holds: it lights her and her ground and casts no shadow of hers */
  held?: boolean;
}

/** What the lights need to know of the world to be drawn. */
export interface PoolWorld {
  /** the flat ground's light now, per channel (painted.groundLight()) */
  base: readonly number[];
  /** the night's depth, 0 to 1 */
  night: number;
  /** the game clock in ms, which the flames read */
  clock: number;
  /** the land's standing mask and facing field, and the world position of its corner (art px of the mask are the land's art px); undefined: no piece takes the light by its facing */
  standing?: { data: Standing; ox: number; oy: number };
}

interface BlendPair {
  gain: number;
  max: number;
}
const BLENDS = new WeakMap<object, BlendPair | null>();

/** The two custom blends, made once per renderer: `dst x (1 + src)` and a per-channel MAX. null where the renderer is not WebGL. (addBlendMode returns one less than the index it made.) */
function blendsOf(renderer: Phaser.Renderer.WebGL.WebGLRenderer): BlendPair | null {
  if (BLENDS.has(renderer)) return BLENDS.get(renderer) ?? null;
  const gl = renderer.gl as WebGLRenderingContext | undefined;
  let pair: BlendPair | null = null;
  if (gl) {
    const max = (gl as unknown as { MAX?: number }).MAX ?? (gl.getExtension('EXT_blend_minmax') as { MAX_EXT: number } | null)?.MAX_EXT;
    if (max !== undefined) {
      renderer.addBlendMode([gl.DST_COLOR, gl.ONE], gl.FUNC_ADD);
      const gain = renderer.blendModes.length - 1;
      renderer.addBlendMode([gl.ONE, gl.ONE], max);
      pair = { gain, max: renderer.blendModes.length - 1 };
    }
  }
  BLENDS.set(renderer, pair);
  return pair;
}

/** The largest box any light needs: the biggest reach and flicker of the table, round. */
function boxSize(): number {
  let r = 0;
  for (const row of Object.values(PAINTED_LIGHTS)) r = Math.max(r, row.reach * (1 + row.flicker.radius));
  return 2 * Math.ceil(poolRadiusArt() * r) + 2;
}

/** The step codes of one pool (paintedPoolStep) in a box of `size`, for the full radius `R`, made once per radius. */
const STAMPS = new Map<string, Uint8Array>();
function stampOf(size: number, R: number): Uint8Array {
  const key = `${size},${R}`;
  let s = STAMPS.get(key);
  if (!s) {
    s = new Uint8Array(size * size);
    const c = size / 2;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) s[y * size + x] = paintedPoolStep(x, y, c, R);
    STAMPS.set(key, s);
  }
  return s;
}

/** For every texel of a box: the unit vector from the texel to the box's centre (where the light is), whole numbers of -127 to 127 (made once per size). */
const TOWARD = new Map<number, [Int8Array, Int8Array]>();
function towardOf(size: number): [Int8Array, Int8Array] {
  let t = TOWARD.get(size);
  if (!t) {
    const ux = new Int8Array(size * size);
    const uy = new Int8Array(size * size);
    const c = size / 2;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = c - (x + 0.5);
        const dy = c - (y + 0.5);
        const d = Math.hypot(dx, dy) || 1;
        ux[y * size + x] = Math.round((dx / d) * 127);
        uy[y * size + x] = Math.round((dy / d) * 127);
      }
    }
    t = [ux, uy];
    TOWARD.set(size, t);
  }
  return t;
}

/** The colour a share `f` of a light's core takes in the box, per channel: poolTexelValue(f) x the light's gain on that channel, 1/255 steps of f up to the most a facing pixel takes (FACE_SHARE). */
const LUT_N = Math.ceil(255 * FACE_SHARE[2]) + 1;
function lutOf(gain: readonly number[]): Uint8Array {
  const lut = new Uint8Array(LUT_N * 3);
  for (let i = 0; i < LUT_N; i++) {
    const v = poolTexelValue(i / 255, false);
    for (let c = 0; c < 3; c++) lut[i * 3 + c] = Math.round(255 * Math.min(1, v * gain[c]!));
  }
  return lut;
}

/** One light's box: its canvas texture, the pixels written to it, and what it shows now. */
interface Box {
  tex: Phaser.Textures.CanvasTexture;
  key: string;
  img: ImageData;
  u32: Uint32Array;
  shown: string;
  /** the light's centre in art px of the map (set by update) */
  at: readonly [number, number];
}

export class PaintedPool {
  /** how often each pass did its work: a still view of an unchanged hour adds none (bar X1) */
  readonly counters = { redraw: 0, crop: 0, tint: 0, resize: 0, frames: 0, fill: 0 };
  /** the last frame's lights as they were drawn: kind, radius, strength, flame level (for the flicker bar) */
  readonly lastLights: { kind: PaintedLightKind; radius: number; strength: number; level: number; x: number; y: number; held?: boolean }[] = [];
  /** a measure's lever: no facing (a pixel of a piece takes the step's level as the ground does) */
  noFacing = false;
  private readonly scene: Phaser.Scene;
  private readonly depth: number;
  private blends: BlendPair | null = null;
  private map: Phaser.GameObjects.RenderTexture | undefined;
  private images: Phaser.GameObjects.Image[] = [];
  private boxes: Box[] = [];
  private readonly size = boxSize();
  private w = 0;
  private h = 0;
  private drawn = '';

  constructor(scene: Phaser.Scene, depth: number) {
    this.scene = scene;
    this.depth = depth;
    this.blends = blendsOf(scene.renderer as Phaser.Renderer.WebGL.WebGLRenderer);
    if (!this.blends) return;
    this.map = scene.add.renderTexture(0, 0, 4, 4).setOrigin(0).setVisible(false);
    this.map.saveTexture(MAP_KEY);
    for (let i = 0; i < PAINTED_POOL.passes; i++) {
      this.images.push(scene.add.image(0, 0, MAP_KEY).setOrigin(0).setScale(1 / ART).setDepth(depth).setBlendMode(this.blends.gain).setVisible(false));
    }
  }

  /** The number of passes laid over the scene, and the map's size in texels (for the cost report). */
  report(): { passes: number; map: [number, number]; blend: BlendPair | null; boxes: number; box: number } {
    return { passes: this.images.length, map: [this.w, this.h], blend: this.blends, boxes: this.boxes.length, box: this.size };
  }

  private boxFor(i: number): Box {
    let b = this.boxes[i];
    if (b) return b;
    const key = `${BOX_KEY}-${i}`;
    if (this.scene.textures.exists(key)) this.scene.textures.remove(key);
    const tex = this.scene.textures.createCanvas(key, this.size, this.size);
    if (!tex) throw new Error('painted pool: a light box was refused');
    tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
    const img = tex.getContext().createImageData(this.size, this.size);
    b = { tex, key, img, u32: new Uint32Array(img.data.buffer), shown: '', at: [0, 0] };
    this.boxes[i] = b;
    return b;
  }

  /** Fills a box with one light's pool: the step's colour per texel, a piece of the land's standing mask taking it by its facing. */
  private fill(b: Box, R: number, lut: Uint8Array, standing: PoolWorld['standing'], artX: number, artY: number): void {
    const size = this.size;
    const stamp = stampOf(size, R);
    const levels = PAINTED_POOL.levels;
    const out = b.u32;
    const st = standing?.data;
    const [ux, uy] = towardOf(size);
    const c = size / 2;
    const x0 = artX - c;
    const y0 = artY - c;
    for (let y = 0; y < size; y++) {
      const sy = y0 + y;
      const inY = st !== undefined && sy >= 0 && sy < st.h;
      for (let x = 0; x < size; x++) {
        const i = y * size + x;
        const code = stamp[i]!;
        if (code === 0) {
          out[i] = 0;
          continue;
        }
        let f = levels[code - 1]!;
        if (inY) {
          const sx = x0 + x;
          if (sx >= 0 && sx < st!.w) {
            const si = sy * st!.w + sx;
            if (st!.mask[si]) f *= facingShare(facingStep(st!.nx[si]!, st!.ny[si]!, ux[i]! / 127, uy[i]! / 127, bayerAt(sx, sy)));
          }
        }
        const k = Math.round(f * 255) * 3;
        out[i] = 0xff000000 | (lut[k + 2]! << 16) | (lut[k + 1]! << 8) | lut[k]!;
      }
    }
    b.tex.getContext().putImageData(b.img, 0, 0);
    b.tex.refresh();
    this.counters.fill++;
  }

  /**
   * Lays the pools. `lights` the lights now (empty hides everything), `world` what they read of the world, `view` the camera's world view. Does nothing but the early return on a frame where no
   * light moved to another art pixel, the corner did not step, no flame stepped and the gain did not change.
   */
  update(view: Phaser.Geom.Rectangle, lights: readonly PoolLight[], world: PoolWorld): void {
    this.counters.frames++;
    const map = this.map;
    if (!map || !this.blends) return;
    const on = lights.length > 0 && world.night > 0;
    for (const img of this.images) img.setVisible(on);
    if (!on) {
      this.drawn = '';
      return;
    }
    const ox = Math.floor(view.x / SNAP) * SNAP;
    const oy = Math.floor(view.y / SNAP) * SNAP;
    const w = (Math.ceil(view.width / SNAP) + 1) * SNAP * ART;
    const h = (Math.ceil(view.height / SNAP) + 1) * SNAP * ART;
    if (w !== this.w || h !== this.h) {
      this.w = w;
      this.h = h;
      map.resize(w, h);
      map.saveTexture(MAP_KEY);
      for (const img of this.images) img.setTexture(MAP_KEY);
      this.drawn = '';
      this.counters.resize++;
    }
    this.lastLights.length = 0;
    const at: (readonly [number, number])[] = [];
    const gains: number[][] = [];
    const radii: number[] = [];
    for (let k = 0; k < lights.length; k++) {
      const l = lights[k]!;
      const row = PAINTED_LIGHTS[l.kind];
      const level = flameLevel(row, world.clock, l.seed ?? k);
      const now = lightNow(row, level);
      at.push([Math.round((l.x - ox) * ART), Math.round((l.y - oy) * ART)]);
      radii.push(now.radius);
      gains.push(poolGain(world.base, world.night * now.strength, row.lamp));
      this.lastLights.push({ kind: l.kind, radius: now.radius, strength: now.strength, level, x: l.x, y: l.y, held: l.held });
    }
    const faceOn = !this.noFacing && world.standing !== undefined;
    const key = `${ox},${oy};${faceOn ? 1 : 0};${lights.map((l, k) => `${l.kind},${at[k]!.join(',')},${radii[k]},${gains[k]!.map((g) => Math.round(g * 255)).join('.')}`).join(';')}`;
    if (key === this.drawn) return;
    this.drawn = key;
    for (let k = 0; k < lights.length; k++) {
      const b = this.boxFor(k);
      const l = lights[k]!;
      const artX = Math.round((l.x - (world.standing?.ox ?? 0)) * ART);
      const artY = Math.round((l.y - (world.standing?.oy ?? 0)) * ART);
      const shown = `${l.kind},${radii[k]},${gains[k]!.map((g) => Math.round(g * 255)).join('.')},${faceOn ? `${artX},${artY}` : 0}`;
      if (shown !== b.shown) {
        b.shown = shown;
        this.fill(b, radii[k]!, lutOf(gains[k]!), faceOn ? world.standing : undefined, artX, artY);
      }
      b.at = at[k]!;
    }
    map.fill(0x000000, 1);
    for (let k = 0; k < lights.length; k++) map.stamp(this.boxes[k]!.key, undefined, at[k]![0], at[k]![1], { blendMode: this.blends.max });
    map.render();
    this.counters.redraw++;
    // each pass draws only the box the pools lie in
    const R = this.size / 2 + 1;
    const x0 = Math.max(0, Math.min(...at.map((p) => p[0]!)) - R);
    const y0 = Math.max(0, Math.min(...at.map((p) => p[1]!)) - R);
    const x1 = Math.min(w, Math.max(...at.map((p) => p[0]!)) + R);
    const y1 = Math.min(h, Math.max(...at.map((p) => p[1]!)) + R);
    for (const img of this.images) img.setPosition(ox, oy).setCrop(x0, y0, Math.max(1, x1 - x0), Math.max(1, y1 - y0));
    this.counters.crop++;
    this.counters.tint++;
  }

  destroy(): void {
    for (const img of this.images) img.destroy();
    this.images = [];
    this.map?.destroy();
    this.map = undefined;
    for (const b of this.boxes) this.scene.textures.remove(b.key);
    this.boxes = [];
  }
}

export { FACE_SHARE, FLAME_LEVELS };
