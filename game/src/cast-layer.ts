/**
 * The shadow pass (STYLE section 4): every caster's own alpha, sheared away from the sun and
 * laid on the ground. The scene registers images and sprites; the pass reads their texture,
 * frame and place each frame, so a node that grows, a fire whose flame steps and a body that
 * walks all keep their shadow without a second list.
 *
 * The shadows of a layer are painted opaque into one canvas a little larger than the camera's
 * view, then drawn at the table's alpha in the squares (`CELL`) a shadow reaches. Overlaps are
 * therefore one shadow, not two. The contact line under the feet is separate, at the decided 45%.
 *
 * A layer is painted only when what it shows has moved: the sun's shear, the canvas's corner
 * (it steps by `SNAP`, so the camera scrolls inside it), or one of its casters' texture, mirror
 * or place. A software renderer (a test runner with no GPU) pays a whole canvas upload per
 * paint: two paints and two uploads in every frame slowed its frames past the length a step is
 * drawn in, so a step on the desktop door showed only its landing frame. So nothing that changes
 * every frame is painted into a layer:
 * - a thing that walks (`moving`: the player, a wolf) casts through its own small image, one
 *   texture per frame and sun shear, made once and then only placed. Where it crosses another
 *   shadow the two darken, the one exception to "overlaps are one shadow";
 * - a thing on a beat (`rest`: a sway, a flicker, a blink) casts the shadow of its first frame,
 *   so the beat does not repaint the layer.
 */
import * as Phaser from 'phaser';

import { type Mask, type Shadow, type Sun, type SunTable, SHADOW, downsampleAlpha, footRows, maskOfAlpha, mirrorMask, shadowBox, shadowOf, sunAt, sunKey } from './cast';
import { bodyLight, litSide } from './light';

/**
 * By night the sun is down, and a body inside a light's pool casts from that light (STYLE 4 "Night"): the scene
 * answers, for the feet at (x, y), the light's own sun, or undefined outside every pool, where nothing casts.
 */
export type NightSun = (x: number, y: number) => Sun | undefined;

export type CastLayerName = 'under' | 'standing';

/**
 * How a caster's shadow is drawn: `drawn` from the frame it shows, in its layer; `rest` from its first frame,
 * in its layer (a thing on a beat); `moving` from the frame it shows, through its own image (a thing that walks).
 */
export type CastMode = 'drawn' | 'rest' | 'moving';

/** One thing that casts: a world image or sprite, and how strongly it casts now. */
export interface Caster {
  readonly image: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite;
  readonly layer: CastLayerName;
  readonly mode: CastMode;
  enabled: boolean;
  /** a body (the player, the people): STYLE 4's body light, one step on each side, baked per sun key */
  readonly body: boolean;
}

/** A moving caster's own shadow: its image, its contact line, and the texture both show now. */
interface Own {
  readonly image: Phaser.GameObjects.Image;
  readonly contact: Phaser.GameObjects.Graphics;
  key: string;
}

/**
 * Where the two shadow layers sit, between the ground and the things that stand on it. Both
 * are below `DEPTH.puff` (3.5), the shallowest thing `world.ts` lets cast, so with the sun in
 * the south (GK2 B) a caster is drawn over its own shadow and a thing standing north, nearer
 * the sun, covers the shadow that falls behind it.
 */
export const CAST_DEPTH = { under: 1.5, standing: 2.5, contact: 0.1 } as const;

const INK = `#${SHADOW.ink.toString(16).padStart(6, '0')}`;
const UNDER_KEY = 'cast-under';
const STANDING_KEY = 'cast-standing';

/** Frames whose alpha is too faint to cast: a hidden thing, a ghost, a growing node. */
const MIN_ALPHA = 0.02;

/** One caster's shadow as this frame lays it: which layer, the shadow's runs, and where its feet stand on the layer. */
interface Draw {
  layer: CastLayerName;
  shadow: Shadow;
  /** the frame's left edge and the feet row (the sprite's lowest solid row, footRows), in layer pixels from the layer's corner */
  x: number;
  y: number;
}

/** One of the two layers: its canvas, the cells that draw it, its contact lines, and what it shows now. */
interface Plane {
  readonly key: string;
  readonly tex: Phaser.Textures.CanvasTexture;
  readonly depth: number;
  /** one image per `CELL` square a shadow reaches, each a frame of the one canvas; the rest of the pool is hidden */
  readonly cells: Phaser.GameObjects.Image[];
  used: number;
  readonly contact: Phaser.GameObjects.Graphics;
  /** what the plane shows now; a frame that would paint the same leaves it as it is */
  painted: string;
}

/**
 * The layers' corner steps by this many world pixels, and the canvas reaches one step past the view: the
 * camera scrolls inside it, so a layer whose casters stand still is not painted again while the player walks.
 */
const SNAP = 64;

/**
 * A layer is drawn in squares of this many world pixels, only those a shadow reaches. One quad the size of the
 * view, blended in every frame for each layer, is a cost a software renderer feels on a large screen; the
 * squares cover the shadows and little else, and the canvas they cut is still one, so overlaps stay one shadow.
 */
const CELL = 32;

export class CastLayer {
  private readonly scene: Phaser.Scene;
  private readonly sun: SunTable;
  private readonly density: number;
  /** a texture's own density (1 at 16 art px a tile, 4 at 64): the mask is brought onto the layer's grid by it */
  private readonly densityOf: (key: string) => number;
  private readonly planes: Record<CastLayerName, Plane>;
  private readonly casters: Caster[] = [];
  /** alpha masks by `texture#frame`, on the layer's grid, built once and kept: a sprite's shape does not move */
  private readonly masks = new Map<string, Mask | null>();
  /** the shadow of each mask (and its mirror) under the sun of `shadowsSun`; a new shear empties it */
  private readonly shadows = new Map<string, Shadow>();
  private shadowsSun = '';
  /** each moving caster's own image */
  private readonly owns = new Map<Caster, Own>();
  /** the moving casters' textures under the sun of `shadowsSun`, by key, with the corner of each shadow's box */
  private readonly ownTex = new Map<string, { x: number; y: number }>();
  /** each body's light: an image over it holding only the pixels the light moved a step */
  private readonly bodies = new Map<Caster, Phaser.GameObjects.Image>();
  /** the body-light textures made so far, by texture and lit side */
  private readonly bodyTex = new Set<string>();
  /** the lights' suns by night, when the scene has a light layer */
  night: NightSun | undefined;

  constructor(scene: Phaser.Scene, sun: SunTable, density = 1, densityOf: (key: string) => number = () => 1) {
    this.scene = scene;
    this.sun = sun;
    this.density = Math.max(1, Math.round(density));
    this.densityOf = densityOf;
    const plane = (key: string, depth: number): Plane => {
      if (scene.textures.exists(key)) scene.textures.remove(key);
      const tex = scene.textures.createCanvas(key, 1, 1) as Phaser.Textures.CanvasTexture;
      tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
      return {
        key,
        tex,
        depth,
        cells: [],
        used: 0,
        contact: scene.add.graphics().setDepth(depth + CAST_DEPTH.contact).setVisible(false),
        painted: '',
      };
    };
    this.planes = { under: plane(UNDER_KEY, CAST_DEPTH.under), standing: plane(STANDING_KEY, CAST_DEPTH.standing) };
  }

  /** Registers one thing that casts; the scene keeps the returned caster to turn it off. */
  add(image: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite, layer: CastLayerName, mode: CastMode = 'drawn', body = false): Caster {
    const caster: Caster = { image, layer, mode, enabled: true, body };
    this.casters.push(caster);
    return caster;
  }

  /** The caster an image was registered as, for a node that is ready or taken. */
  of(image: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite): Caster | undefined {
    return this.casters.find((c) => c.image === image);
  }

  /** Drops every caster, for a rescan after the scene adds or removes a kind of thing. */
  clear(): void {
    this.casters.length = 0;
    for (const p of Object.values(this.planes)) p.painted = '';
    for (const own of this.owns.values()) {
      own.image.destroy();
      own.contact.destroy();
    }
    this.owns.clear();
    for (const img of this.bodies.values()) img.destroy();
    this.bodies.clear();
  }

  /**
   * Lays the shadows of this minute into the two layers, around the view of the camera. Every
   * caster's runs are painted opaque, so two shadows that meet are one shape; the layer is
   * then drawn once at the table's alpha. A layer is painted only when what it shows moved.
   */
  update(minute: number, view?: Phaser.Geom.Rectangle): void {
    const day = sunAt(this.sun, minute);
    if (!day.up && !this.night) {
      this.hide();
      return;
    }
    // by night every caster has its own sun, the light whose pool it stands in; the cache is then keyed per sun
    const shear = day.up ? sunKey(day) : 'night';
    const stale = shear !== this.shadowsSun ? [...this.ownTex.keys()] : [];
    if (shear !== this.shadowsSun) {
      this.shadows.clear();
      this.ownTex.clear();
      this.shadowsSun = shear;
    }
    const placed = new Set<Caster>();
    const v = view ?? this.scene.cameras.main.worldView;
    // the corner on a step of SNAP world pixels and the canvas a step wider than the view, so the view always
    // lies inside it and a shadow keeps its pixels however the camera scrolls
    const ox = Math.floor(v.x / SNAP) * SNAP;
    const oy = Math.floor(v.y / SNAP) * SNAP;
    const ww = (Math.ceil(v.width / SNAP) + 1) * SNAP;
    const wh = (Math.ceil(v.height / SNAP) + 1) * SNAP;
    const area = new Phaser.Geom.Rectangle(ox, oy, ww, wh);
    const draws: Record<CastLayerName, Draw[]> = { under: [], standing: [] };
    const head = `${shear}|${ox},${oy},${ww},${wh}`;
    const sig: Record<CastLayerName, string> = { under: head, standing: head };
    const lit = new Set<Caster>();
    for (const caster of this.casters) {
      if (!caster.enabled) continue;
      const img = caster.image;
      if (!img.visible || img.alpha <= MIN_ALPHA) continue;
      const sun = day.up ? day : this.night?.(img.x, img.y);
      if (!sun) continue;
      const own = day.up ? '' : `@${sunKey(sun)}`;
      if (caster.body && this.placeBody(caster, sun)) lit.add(caster);
      // a thing on a beat casts its first frame, so the beat leaves the layer as it is
      const frame = caster.mode === 'rest' && img.texture.has('0') ? img.texture.get('0') : img.frame;
      if (!frame) continue;
      const tex = img.texture.key;
      const density = this.densityOf(tex);
      // the frame's size in world units: a density-4 sprite is drawn at a quarter of its art pixels
      const width = frame.cutWidth / density;
      const height = frame.cutHeight / density;
      const left = img.x - width / 2;
      const feet = img.y;
      if (!this.inView(left, feet - height, width, height, area)) continue;
      const maskKey = `${tex}#${frame.name}`;
      const flip = img.flipX;
      const shadow = this.shadowFor(maskKey, frame, density, flip, sun, own);
      if (!shadow || shadow.spans.length === 0) continue;
      if (caster.mode === 'moving') {
        this.placeOwn(caster, shadow, `${maskKey}${flip ? '~' : ''}${own}`, left, feet, sun.alpha);
        placed.add(caster);
        continue;
      }
      const x = Math.round((left - ox) * this.density);
      // the shadow's row 0 on the sprite's lowest row, not on the frame's edge under it (footRows)
      const y = footRows(Math.round((feet - oy) * this.density), shadow).shadow;
      draws[caster.layer].push({ layer: caster.layer, shadow, x, y });
      sig[caster.layer] += `|${maskKey}${flip ? '~' : ''}${own}@${x},${y}`;
    }
    for (const [caster, img] of this.bodies) if (!lit.has(caster) && img.visible) img.setVisible(false);
    const alpha = day.up ? day.alpha : this.sun.alpha;
    for (const name of ['under', 'standing'] as const) {
      const p = this.planes[name];
      if (sig[name] !== p.painted) {
        this.paint(p, draws[name], ww * this.density, wh * this.density, ox, oy);
        p.painted = sig[name];
      }
      for (let i = 0; i < p.used; i++) p.cells[i]!.setAlpha(alpha);
      p.contact.setPosition(ox, oy).setVisible(true);
    }
    for (const [caster, own] of this.owns) if (!placed.has(caster)) this.hideOwn(own);
    // the last shear's textures go once nothing shows them
    for (const key of stale) if (!this.ownTex.has(key) && this.scene.textures.exists(key)) this.scene.textures.remove(key);
  }

  /** Turns the pass off, for the night and for a scene that is leaving. */
  hide(): void {
    for (const p of Object.values(this.planes)) {
      for (const cell of p.cells) cell.setVisible(false);
      p.used = 0;
      p.contact.clear().setVisible(false);
      p.painted = '';
    }
    for (const own of this.owns.values()) this.hideOwn(own);
    for (const img of this.bodies.values()) img.setVisible(false);
  }

  /**
   * A body's light (STYLE 4): an image over the body showing its frame with the lit side a step lighter and the far
   * side a step darker, from a copy of its texture baked once per side. False at noon, when no side is lit.
   */
  private placeBody(caster: Caster, sun: Sun): boolean {
    const side = litSide(sun.sx);
    const img = caster.image;
    if (!side) return false;
    // a mirrored sprite shows its texture's right on the left, so its lit side in the texture is the other one
    const texSide = img.flipX ? (side === 'left' ? 'right' : 'left') : side;
    const key = this.bodyTexture(img.texture.key, texSide);
    if (!key) return false;
    let over = this.bodies.get(caster);
    if (!over) {
      over = this.scene.add.image(0, 0, key);
      this.bodies.set(caster, over);
    }
    if (over.texture.key !== key || over.frame.name !== img.frame.name) over.setTexture(key, img.frame.name);
    over
      .setPosition(img.x, img.y)
      .setOrigin(img.originX, img.originY)
      .setScale(img.scaleX, img.scaleY)
      .setFlipX(img.flipX)
      .setAngle(img.angle)
      .setDepth(img.depth + 0.0005)
      .setAlpha(img.alpha)
      .setVisible(true);
    if (img.isTinted) over.setTint(img.tintTopLeft);
    else over.clearTint();
    return true;
  }

  /** The body-light copy of a texture, every frame lit from one side; made once and kept. Undefined when the pixels are refused. */
  private bodyTexture(tex: string, side: 'left' | 'right'): string | undefined {
    const key = `body:${tex}:${side}`;
    if (this.bodyTex.has(key)) return key;
    const texture = this.scene.textures.get(tex);
    const source = texture.getSourceImage() as CanvasImageSource & { width: number; height: number };
    try {
      const canvas = document.createElement('canvas');
      canvas.width = source.width;
      canvas.height = source.height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return undefined;
      ctx.drawImage(source, 0, 0);

      const out = ctx.createImageData(canvas.width, canvas.height);
      const names = texture.getFrameNames();
      const frames = names.length > 0 ? names.map((n) => texture.get(n)) : [texture.get()];
      for (const f of frames) {
        const sub = ctx.getImageData(f.cutX, f.cutY, f.cutWidth, f.cutHeight);
        const lit = new Uint8ClampedArray(sub.data.length);
        // the body's own pixels, at the frame's density: STYLE 4's 4 art px are 4 of the sprite's pixels at 64 a tile
        bodyLight(sub.data, f.cutWidth, f.cutHeight, side, lit, Math.max(1, Math.round((4 * this.densityOf(tex)) / 4)));
        for (let y = 0; y < f.cutHeight; y++) out.data.set(lit.subarray(y * f.cutWidth * 4, (y + 1) * f.cutWidth * 4), ((f.cutY + y) * canvas.width + f.cutX) * 4);
      }
      if (this.scene.textures.exists(key)) this.scene.textures.remove(key);
      const made = this.scene.textures.createCanvas(key, canvas.width, canvas.height) as Phaser.Textures.CanvasTexture;
      made.getContext().putImageData(out, 0, 0);
      for (const f of frames) if (f.name !== '__BASE') made.add(f.name, 0, f.cutX, f.cutY, f.cutWidth, f.cutHeight);
      made.refresh();
      made.setFilter(Phaser.Textures.FilterMode.NEAREST);
      this.bodyTex.add(key);
      return key;
    } catch {
      return undefined;
    }
  }

  destroy(): void {
    for (const p of Object.values(this.planes)) {
      for (const cell of p.cells) cell.destroy();
      p.cells.length = 0;
      p.contact.destroy();
    }
    this.clear();
    for (const key of [UNDER_KEY, STANDING_KEY, ...this.ownTex.keys()]) if (this.scene.textures.exists(key)) this.scene.textures.remove(key);
    this.ownTex.clear();
  }

  /**
   * Lays a moving caster's shadow through its own image: the texture of this frame and shear is made the
   * first time it is needed and kept, so a walk only places an image and swaps among a few textures.
   */
  private placeOwn(caster: Caster, shadow: Shadow, shadowKey: string, left: number, feet: number, alpha: number): void {
    const key = `cast:${shadowKey}@${this.shadowsSun}`;
    let corner = this.ownTex.get(key);
    if (!corner) {
      const box = shadowBox(shadow);
      if (this.scene.textures.exists(key)) this.scene.textures.remove(key);
      const tex = this.scene.textures.createCanvas(key, box.w, box.h) as Phaser.Textures.CanvasTexture;
      tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
      const ctx = tex.getContext();
      ctx.fillStyle = INK;
      for (const span of shadow.spans) ctx.fillRect(span.x - box.x, span.y - box.y, span.w, 1);
      tex.refresh();
      corner = { x: box.x, y: box.y };
      this.ownTex.set(key, corner);
    }
    const depth = CAST_DEPTH[caster.layer];
    let own = this.owns.get(caster);
    if (!own) {
      own = {
        image: this.scene.add.image(0, 0, key).setOrigin(0).setDepth(depth),
        contact: this.scene.add.graphics().setDepth(depth + CAST_DEPTH.contact),
        key: '',
      };
      this.owns.set(caster, own);
    }
    const scale = 1 / this.density;
    if (own.key !== key) {
      own.image.setTexture(key);
      own.contact.clear();
      own.contact.fillStyle(SHADOW.ink, SHADOW.contact);
      for (const [a, b] of shadow.contact) own.contact.fillRect(a * scale, scale, (b - a + 1) * scale, scale);
      own.key = key;
    }
    // on the layer's grid, as a painted shadow would lie
    const x = Math.round(left * this.density) * scale;
    const y = footRows(Math.round(feet * this.density), shadow).shadow * scale;
    own.image.setPosition(x + corner.x * scale, y + corner.y * scale).setScale(scale).setAlpha(alpha).setVisible(true);
    own.contact.setPosition(x, y).setVisible(true);
  }

  private hideOwn(own: Own): void {
    if (!own.image.visible && !own.contact.visible) return;
    own.image.setVisible(false);
    own.contact.setVisible(false);
  }

  /** Paints one layer's shadows and contact lines, uploads its canvas once, and lays the cells its shadows reach. */
  private paint(p: Plane, draws: readonly Draw[], cw: number, ch: number, ox: number, oy: number): void {
    if (p.tex.width !== cw || p.tex.height !== ch) p.tex.setSize(cw, ch);
    const ctx = p.tex.getContext();
    ctx.clearRect(0, 0, cw, ch);
    ctx.fillStyle = INK;
    p.contact.clear();
    p.contact.fillStyle(SHADOW.ink, SHADOW.contact);
    const scale = 1 / this.density;
    for (const d of draws) {
      for (const span of d.shadow.spans) ctx.fillRect(d.x + span.x, d.y + span.y, span.w, 1);
      // the contact line under the feet: the decided 45%, one layer pixel deep, on the row under the feet row
      for (const [a, b] of d.shadow.contact) p.contact.fillRect((d.x + a) * scale, (d.y + 1) * scale, (b - a + 1) * scale, scale);
    }
    // the canvas was painted after it was made, so it is uploaded now
    p.tex.refresh();
    // the squares a shadow reaches, each drawn as a frame of the canvas (the canvas is a whole number of them)
    const cell = CELL * this.density;
    const cols = Math.ceil(cw / cell);
    const rows = Math.ceil(ch / cell);
    const hit = new Set<number>();
    for (const d of draws) {
      const box = shadowBox(d.shadow);
      const x0 = Math.max(0, Math.floor((d.x + box.x) / cell));
      const x1 = Math.min(cols - 1, Math.floor((d.x + box.x + box.w - 1) / cell));
      const y0 = Math.max(0, Math.floor((d.y + box.y) / cell));
      const y1 = Math.min(rows - 1, Math.floor((d.y + box.y + box.h - 1) / cell));
      for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) hit.add(cy * cols + cx);
    }
    let used = 0;
    for (const n of hit) {
      const cx = n % cols;
      const cy = Math.floor(n / cols);
      const name = `${cx},${cy}`;
      if (!p.tex.has(name)) p.tex.add(name, 0, cx * cell, cy * cell, cell, cell);
      let img = p.cells[used];
      if (!img) {
        img = this.scene.add.image(0, 0, p.key, name).setOrigin(0).setDepth(p.depth);
        p.cells.push(img);
      }
      img.setTexture(p.key, name).setPosition(ox + cx * CELL, oy + cy * CELL).setScale(scale).setVisible(true);
      used++;
    }
    for (let i = used; i < p.cells.length; i++) p.cells[i]!.setVisible(false);
    p.used = used;
  }

  private inView(x: number, y: number, w: number, h: number, view: Phaser.Geom.Rectangle): boolean {
    return x + w >= view.x - 8 && x <= view.right + 8 && y + h >= view.y - 8 && y <= view.bottom + 8;
  }

  /** A mask's shadow under this sun, mirrored for a flipped sprite, kept until the shear moves. */
  private shadowFor(maskKey: string, frame: Phaser.Textures.Frame, density: number, flip: boolean, sun: Sun, own = ''): Shadow | null {
    const key = `${flip ? `${maskKey}~` : maskKey}${own}`;
    const hit = this.shadows.get(key);
    if (hit) return hit;
    let mask = this.maskFor(maskKey, frame, density);
    if (!mask || mask.feet < 0) return null;
    if (flip) mask = mirrorMask(mask);
    const shadow = shadowOf(mask, sun);
    this.shadows.set(key, shadow);
    return shadow;
  }

  /**
   * One mask per texture frame, read once from its alpha and brought onto the layer's grid;
   * null when the browser refuses the pixels.
   */
  private maskFor(key: string, frame: Phaser.Textures.Frame, density: number): Mask | null {
    const hit = this.masks.get(key);
    if (hit !== undefined) return hit;
    let mask: Mask | null = null;
    try {
      const source = frame.source.image as CanvasImageSource | null;
      if (source && frame.cutWidth > 0 && frame.cutHeight > 0) {
        const canvas = document.createElement('canvas');
        canvas.width = frame.cutWidth;
        canvas.height = frame.cutHeight;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(source, frame.cutX, frame.cutY, frame.cutWidth, frame.cutHeight, 0, 0, frame.cutWidth, frame.cutHeight);
          const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
          const alpha = new Uint8Array(canvas.width * canvas.height);
          for (let i = 0; i < alpha.length; i++) alpha[i] = (data[i * 4 + 3] ?? 0) >= 128 ? 1 : 0;
          const grid = downsampleAlpha(alpha, canvas.width, canvas.height, density / this.density);
          mask = maskOfAlpha(grid.alpha, grid.w, grid.h);
        }
      }
    } catch {
      mask = null;
    }
    this.masks.set(key, mask);
    return mask;
  }
}
