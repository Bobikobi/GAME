/**
 * The lighting ladder's layers (LIGHTING.md, the owner's C of 30.10; STYLE sections 4 and 5), drawn over the valley
 * the way cast-layer.ts draws the shadows: the numbers are light.ts's, this file only lays them.
 *
 * - **The shade.** One render texture over the view holds the hour's shade (params `light.keys`: the dusk's gold and
 *   red and the night's ink, one colour per minute), multiplied over everything under it. Every light cuts its pool
 *   out of it in STYLE 5's two hard steps (clean inside, half in a ring), and the ring around the player holds only
 *   the shade that keeps the ground at the readable floor (`light.read`). A lit window's glass is drawn over it.
 * - **The pools.** A second render texture holds the added light of every pool: each step a disc, drawn from the
 *   outermost step of every light to the innermost, opaque, so a pixel ends at the brightest step that reaches it
 *   and two pools never sum. Then the lamps' heads. It is added over the shade.
 *
 * Both textures are at art pixels (4 a world unit), so every step is whole art pixels, and are only as large as the
 * view. Nothing is drawn while no light paints and the shade is clear (the day).
 */
import * as Phaser from 'phaser';

import {
  HEAD_GLOW,
  POOL_RADIUS,
  POOL_STEPS,
  READ,
  WINDOW,
  cutAt,
  lumaOf,
  poolAt,
  poolColour,
  poolDisc,
  poolSun,
  readableAlpha,
  washAt,
  type LightKey,
  type LightKind,
} from './light';

/** How often a flame's pool takes a new breath, ms: the flicker reads on this beat, so the layers redraw no faster. */
const FLICKER_MS = 250;
/**
 * The layers' corner steps by this many world units and they reach one step past the view (as the cast layer's do):
 * the camera scrolls inside them, so a walk does not redraw them while nothing else changed.
 */
const SNAP = 32;
/** Art pixels a world unit: the layers are drawn on the art grid. */
const ART = 4;
/** World units a tile. */
const TILE = 16;

/** One thing that gives light. The scene moves it and switches it; the layer reads it every frame. */
export interface Light {
  kind: LightKind;
  /** the pool's centre on the ground, world units */
  x: number;
  y: number;
  /** a lamp's head, where its glow sits */
  head?: { x: number; y: number };
  /** a burning fire dims with its last wood, 0 to 1 */
  strength: number;
  on: boolean;
  /** a lit window's own glass, drawn over the shade so it shines through the night */
  glass?: Phaser.GameObjects.Image;
  /** the flicker's phase: a flame's pool breathes (with motion on) */
  phase: number;
}

export class LightLayer {
  private readonly scene: Phaser.Scene;
  private readonly table: readonly LightKey[];
  private readonly read: { floor: number };
  private readonly shade: Phaser.GameObjects.RenderTexture;
  private readonly pools: Phaser.GameObjects.RenderTexture;
  private readonly lights: Light[] = [];
  private w = 0;
  private h = 0;
  /** what the two textures hold now: a frame that would draw the same leaves them as they are */
  private drawn = '';
  /** the shade's colour and alpha now, for a still and a test */
  wash = { tint: 0, alpha: 0 };

  constructor(scene: Phaser.Scene, table: readonly LightKey[], read: { floor: number }, depth: { shade: number; pools: number }) {
    this.scene = scene;
    this.table = table;
    this.read = read;
    this.makeTextures();
    this.shade = scene.add.renderTexture(0, 0, 4, 4).setOrigin(0).setDepth(depth.shade).setBlendMode(Phaser.BlendModes.MULTIPLY).setScale(1 / ART).setVisible(false);
    this.pools = scene.add.renderTexture(0, 0, 4, 4).setOrigin(0).setDepth(depth.pools).setBlendMode(Phaser.BlendModes.ADD).setScale(1 / ART).setVisible(false);
  }

  add(light: Omit<Light, 'phase' | 'strength' | 'on'> & Partial<Pick<Light, 'strength' | 'on'>>): Light {
    const l: Light = { strength: 1, on: true, phase: Math.random() * Math.PI * 2, ...light };
    this.lights.push(l);
    return l;
  }

  /** The shade's alpha inside the ring around the player now: the hour's, or the floor's if that is less. */
  ringAlpha(alpha: number, ink: number): number {
    return Math.min(alpha, readableAlpha(this.read.floor, lumaOf(READ.ground), lumaOf(ink)));
  }

  /**
   * Draws the minute's shade and pools around the view. `player` is the readable ring's centre, `flicker` true
   * with motion on (a flame's pool breathes), `time` the scene's clock for the flicker.
   */
  update(minute: number, view: Phaser.Geom.Rectangle, player: { x: number; y: number } | undefined, time: number, flicker: boolean): void {
    this.wash = washAt(this.table, minute);
    const ox = Math.floor(view.x / SNAP) * SNAP;
    const oy = Math.floor(view.y / SNAP) * SNAP;
    const w = (Math.ceil(view.width / SNAP) + 1) * SNAP * ART;
    const h = (Math.ceil(view.height / SNAP) + 1) * SNAP * ART;
    if (w !== this.w || h !== this.h) {
      this.w = w;
      this.h = h;
      this.shade.resize(w, h);
      this.pools.resize(w, h);
    }
    const lit: { l: Light; gate: number; flick: number }[] = [];
    for (const l of this.lights) {
      // in fiftieths, so the hour's slow rise redraws the layers a few times an hour, not every minute
      const gate = l.on ? Math.round(50 * poolAt(minute, l.kind) * l.strength) / 50 : 0;
      // a lit window's glass shows with its pool, at the hour's strength
      if (l.glass) l.glass.setVisible(gate > 0).setAlpha(gate);
      if (gate <= 0) continue;
      const [rx, ry] = POOL_RADIUS[l.kind];
      const reach = Math.max(rx, ry) * TILE + 16;
      if (l.x + reach < view.x || l.x - reach > view.right || l.y + reach < view.y || l.y - reach > view.bottom + 32) continue;
      // a flame's pool breathes a little (LIGHTING C: the shape a flicker gives the light); a lamp's glass holds it still
      const amp = l.kind === 'fire' ? 0.04 : 0;
      // read on a beat of FLICKER_MS, not every frame, so a still view redraws its layers a few times a second at most
      const beat = Math.floor(time / FLICKER_MS) * FLICKER_MS;
      const flick = flicker && amp > 0 ? Math.round(100 * (1 + amp * Math.sin(beat / 173 + l.phase) * Math.sin(beat / 419 + l.phase * 1.7))) / 100 : 1;
      lit.push({ l, gate, flick });
    }
    const at = (x: number, y: number) => ({ x: Math.round((x - ox) * ART), y: Math.round((y - oy) * ART) });
    // the shade: the hour's colour over the view, the pools cut out of it
    const shading = this.wash.alpha > 0;
    this.shade.setVisible(shading).setPosition(ox, oy);
    this.pools.setVisible(lit.length > 0).setPosition(ox, oy);
    // the ring is drawn only while the hour's shade is darker than the floor allows (the night): only then does it move the layer
    const keep = this.ringAlpha(this.wash.alpha, this.wash.tint);
    const ring = player && shading && keep < this.wash.alpha ? at(player.x, player.y) : undefined;
    const key = `${ox},${oy},${w},${h}|${this.wash.tint}:${this.wash.alpha}|${ring ? `${ring.x},${ring.y}` : ''}|${lit.map(({ l, gate, flick }) => `${l.x},${l.y},${gate.toFixed(3)},${flick}`).join(';')}`;
    // nothing moved since the last draw: the textures already hold this frame
    if (key === this.drawn) return;
    this.drawn = key;
    if (shading) {
      this.shade.clear();
      // opaque, at the multiply's own factor (1 - a + a x colour a channel): the layer then multiplies the valley by it
      // exactly, and a cut that takes alpha away leaves the valley as it is
      this.shade.fill(shadeFactor(this.wash.tint, this.wash.alpha), 1);
      // the ring around the player keeps the ground at the floor: the readable shade there, never darker; drawn first,
      // so a pool inside the ring still cuts it
      if (ring) this.shade.stamp('light-ring', undefined, ring.x, ring.y, { tint: shadeFactor(this.wash.tint, keep) });
      for (const { l, gate, flick } of lit) {
        const p = at(l.x, l.y);
        this.shade.stamp(`light-cut-${l.kind}`, undefined, p.x, p.y, { alpha: gate, scale: flick, blendMode: Phaser.BlendModes.ERASE });
      }
      this.shade.render();
    }
    // the pools: every light's outermost step first, the innermost last, so the brightest step that reaches a pixel wins
    if (lit.length === 0) return;
    this.pools.clear();
    for (let i = POOL_STEPS.length - 1; i >= 0; i -= 1) {
      const step = POOL_STEPS[i]!;
      for (const { l, gate, flick } of lit) {
        const p = at(l.x, l.y);
        this.pools.stamp(`light-pool-${l.kind}-${i}`, undefined, p.x, p.y, { tint: poolColour(step, gate), scale: flick });
      }
    }
    for (const { l, gate } of lit) {
      if (!l.head) continue;
      const p = at(l.head.x, l.head.y);
      for (const [j, s] of HEAD_GLOW.steps.map((s, j) => [j, s] as const).reverse()) {
        this.pools.stamp(`light-head-${j}`, undefined, p.x, p.y, { tint: poolColour({ edge: 1, tint: HEAD_GLOW.tint, pct: s.pct }, gate) });
      }
    }
    this.pools.render();
  }

  /**
   * The sun of the light whose pool the feet at (x, y) stand in, by night (STYLE 4): the nearest lit pool that holds
   * them. A light's own post (its foot within a quarter tile) casts nothing from it.
   */
  nightSun(x: number, y: number, minute: number, alpha: number): ReturnType<typeof poolSun> {
    let best: ReturnType<typeof poolSun>;
    let near = Infinity;
    for (const l of this.lights) {
      const gate = l.on ? poolAt(minute, l.kind) * l.strength : 0;
      if (gate <= 0) continue;
      const r = POOL_RADIUS[l.kind][0] * TILE;
      const d = Math.hypot(x - l.x, y - l.y);
      if (d < TILE / 4 || d > r || d >= near) continue;
      near = d;
      best = poolSun(x - l.x, y - l.y, r, alpha, gate);
    }
    return best;
  }

  /** Hides both layers, for the plain valley or a scene that is leaving. */
  hide(): void {
    this.drawn = '';
    this.shade.setVisible(false);
    this.pools.setVisible(false);
  }

  /** The discs every light is drawn with, made once: a texture per pool step and kind, a cut per kind, the heads, the ring. */
  private makeTextures(): void {
    const tex = this.scene.textures;
    const make = (key: string, w: number, h: number, fill: (x: number, y: number) => number) => {
      if (tex.exists(key)) return;
      const t = tex.createCanvas(key, w, h);
      if (!t) return;
      const img = t.getContext().createImageData(w, h);
      for (let y = 0; y < h; y += 1) {
        for (let x = 0; x < w; x += 1) {
          const a = fill(x, y);
          if (a <= 0) continue;
          const i = 4 * (y * w + x);
          img.data[i] = 255;
          img.data[i + 1] = 255;
          img.data[i + 2] = 255;
          img.data[i + 3] = Math.round(255 * a);
        }
      }
      t.getContext().putImageData(img, 0, 0);
      t.refresh();
      t.setFilter(Phaser.Textures.FilterMode.NEAREST);
    };
    for (const kind of Object.keys(POOL_RADIUS) as LightKind[]) {
      const [rx, ry] = POOL_RADIUS[kind].map((r) => r * TILE * ART) as [number, number];
      for (let i = 0; i < POOL_STEPS.length; i += 1) {
        const d = poolDisc(rx, ry, i);
        make(`light-pool-${kind}-${i}`, d.w, d.h, (x, y) => d.mask[y * d.w + x]!);
      }
      const w = 2 * Math.ceil(rx) + 1;
      const h = 2 * Math.ceil(ry) + 1;
      // the cut is the share of the shade a pixel loses: all of it inside, half in the ring (STYLE 5)
      make(`light-cut-${kind}`, w, h, (x, y) => 1 - cutAt(Math.hypot((x - (w - 1) / 2) / rx, (y - (h - 1) / 2) / ry), (x + y) % 2 === 1));
    }
    HEAD_GLOW.steps.forEach((s, j) => {
      const n = 2 * s.r + 1;
      make(`light-head-${j}`, n, n, (x, y) => (Math.hypot(x - s.r, y - s.r) <= s.r ? 1 : 0));
    });
    const r = READ.ring * TILE * ART;
    const n = 2 * r + 1;
    // the ring's edge steps like a pool's, checkered over the dither, so its rim is whole pixels too
    make('light-ring', n, n, (x, y) => (cutAt(Math.hypot(x - r, y - r) / r, (x + y) % 2 === 1) < 1 ? 1 : 0));
  }
}

/** The colour a multiply of `tint` at `alpha` multiplies by, as one opaque colour: 1 - a + a x tint, a channel. */
export function shadeFactor(tint: number, alpha: number): number {
  const ch = (shift: number) => Math.round(255 * (1 - alpha) + ((tint >> shift) & 0xff) * alpha);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

/**
 * A lit window drawn in code (no new sprite, STYLE 5): the building's own sprite with only its glass kept, the dark
 * pane in `#eda83a` and the light one in `#f8de62`. Undefined when the sprite holds no glass. The texture is made once
 * per sprite and frame and kept; the box is the glass's bounds in the frame's pixels, for the pool in front of it.
 */
export function litWindow(scene: Phaser.Scene, key: string, frame?: string | number): { key: string; box: { x: number; y: number; w: number; h: number } } | undefined {
  const out = `${key}#lit`;
  const f = scene.textures.getFrame(key, frame);
  if (!f) return undefined;
  const source = f.source.image as CanvasImageSource | null;
  if (!source) return undefined;
  const canvas = document.createElement('canvas');
  canvas.width = f.cutWidth;
  canvas.height = f.cutHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return undefined;
  ctx.drawImage(source, f.cutX, f.cutY, f.cutWidth, f.cutHeight, 0, 0, f.cutWidth, f.cutHeight);
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -1;
  let y1 = -1;
  for (let i = 0; i < d.length; i += 4) {
    const rgb = ((d[i] ?? 0) << 16) | ((d[i + 1] ?? 0) << 8) | (d[i + 2] ?? 0);
    const g = (d[i + 3] ?? 0) >= 128 ? WINDOW.glass.indexOf(rgb as (typeof WINDOW.glass)[number]) : -1;
    if (g < 0) {
      d[i + 3] = 0;
      continue;
    }
    const c = WINDOW.lit[g]!;
    d[i] = (c >> 16) & 0xff;
    d[i + 1] = (c >> 8) & 0xff;
    d[i + 2] = c & 0xff;
    d[i + 3] = 255;
    const p = i / 4;
    const x = p % canvas.width;
    const y = Math.floor(p / canvas.width);
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  }
  if (x1 < 0) return undefined;
  if (!scene.textures.exists(out)) {
    const t = scene.textures.createCanvas(out, canvas.width, canvas.height);
    if (!t) return undefined;
    t.getContext().putImageData(img, 0, 0);
    t.refresh();
    t.setFilter(Phaser.Textures.FilterMode.NEAREST);
  }
  return { key: out, box: { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 } };
}
