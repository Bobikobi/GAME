/**
 * The shadow pass (STYLE section 4): every caster's own alpha, sheared away from the sun and
 * laid on the ground. The scene registers images and sprites; the pass reads their texture,
 * frame and place each frame, so a node that grows, a fire whose flame steps and a body that
 * walks all keep their shadow without a second list.
 *
 * The shadows of a frame are painted opaque into one canvas the size of the camera's view,
 * then drawn once at the table's alpha. Overlaps are therefore one shadow, not two, and the
 * whole pass is two canvas uploads a frame. The contact line under the feet is separate, at
 * the decided 45%.
 */
import * as Phaser from 'phaser';

import { type Mask, type Shadow, type SunTable, SHADOW, maskOfAlpha, shadowOf, sunAt } from './cast';

export type CastLayerName = 'under' | 'standing';

/** One thing that casts: a world image or sprite, and how strongly it casts now. */
export interface Caster {
  readonly image: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite;
  readonly layer: CastLayerName;
  /** the sprite's own density: 1 at 16 px art, 4 at 64 px; the mask is at the drawn grid */
  readonly density: number;
  enabled: boolean;
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

export class CastLayer {
  private readonly scene: Phaser.Scene;
  private readonly sun: SunTable;
  private readonly density: number;
  private readonly underTex: Phaser.Textures.CanvasTexture;
  private readonly standingTex: Phaser.Textures.CanvasTexture;
  private readonly underImage: Phaser.GameObjects.Image;
  private readonly standingImage: Phaser.GameObjects.Image;
  private readonly contactStanding: Phaser.GameObjects.Graphics;
  private readonly contactUnder: Phaser.GameObjects.Graphics;
  private readonly casters: Caster[] = [];
  /** alpha masks by `texture#frame`, built once and kept: a sprite's shape does not move */
  private readonly masks = new Map<string, Mask | null>();

  constructor(scene: Phaser.Scene, sun: SunTable, density = 1) {
    this.scene = scene;
    this.sun = sun;
    this.density = Math.max(1, Math.round(density));
    const textures = scene.textures;
    for (const key of [UNDER_KEY, STANDING_KEY]) if (textures.exists(key)) textures.remove(key);
    this.underTex = textures.createCanvas(UNDER_KEY, 1, 1) as Phaser.Textures.CanvasTexture;
    this.standingTex = textures.createCanvas(STANDING_KEY, 1, 1) as Phaser.Textures.CanvasTexture;
    for (const tex of [this.underTex, this.standingTex]) tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.underImage = scene.add.image(0, 0, UNDER_KEY).setOrigin(0).setDepth(CAST_DEPTH.under).setVisible(false);
    this.standingImage = scene.add.image(0, 0, STANDING_KEY).setOrigin(0).setDepth(CAST_DEPTH.standing).setVisible(false);
    this.contactUnder = scene.add.graphics().setDepth(CAST_DEPTH.under + CAST_DEPTH.contact).setVisible(false);
    this.contactStanding = scene.add.graphics().setDepth(CAST_DEPTH.standing + CAST_DEPTH.contact).setVisible(false);
  }

  /** Registers one thing that casts; the scene keeps the returned caster to turn it off. */
  add(image: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite, layer: CastLayerName, density = this.density): Caster {
    const caster: Caster = { image, layer, density, enabled: true };
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
  }

  /**
   * Paints the shadows of this minute into the two layers, in the view of the camera. Every
   * caster's runs are painted opaque, so two shadows that meet are one shape; the layer is
   * then drawn once at the table's alpha.
   */
  update(minute: number, view?: Phaser.Geom.Rectangle): void {
    const sun = sunAt(this.sun, minute);
    if (!sun.up) {
      this.hide();
      return;
    }
    const v = view ?? this.scene.cameras.main.worldView;
    const vw = Math.max(1, Math.ceil(v.width * this.density));
    const vh = Math.max(1, Math.ceil(v.height * this.density));
    if (this.underTex.width !== vw || this.underTex.height !== vh) {
      this.underTex.setSize(vw, vh);
      this.standingTex.setSize(vw, vh);
    }
    const under = this.underTex.getContext();
    const standing = this.standingTex.getContext();
    for (const ctx of [under, standing]) {
      ctx.clearRect(0, 0, vw, vh);
      ctx.fillStyle = INK;
    }
    this.contactStanding.clear();
    this.contactUnder.clear();
    for (const caster of this.casters) {
      if (!caster.enabled) continue;
      const img = caster.image;
      if (!img.visible || img.alpha <= MIN_ALPHA) continue;
      const frame = img.frame;
      const key = frame ? `${img.texture.key}#${frame.name}` : '';
      if (key === '') continue;
      const mask = this.maskFor(key, frame);
      if (!mask || mask.feet < 0) continue;
      const shadow = shadowOf(mask, sun);
      if (shadow.spans.length === 0) continue;
      const width = frame.cutWidth / caster.density;
      const height = frame.cutHeight / caster.density;
      const left = img.x - width / 2;
      const feet = img.y;
      if (!this.inView(left, feet - height, width, height, v)) continue;
      const ctx = caster.layer === 'standing' ? standing : under;
      const baseX = (left - v.x) * this.density;
      const baseY = (feet - v.y) * this.density;
      for (const span of shadow.spans) {
        ctx.fillRect(Math.round(baseX + span.x), Math.round(baseY + span.y), span.w, 1);
      }
      this.drawContact(caster, shadow, left, feet);
    }
    // the canvases were painted after they were made, so they are uploaded now
    this.underTex.refresh();
    this.standingTex.refresh();
    for (const image of [this.underImage, this.standingImage]) {
      image.setPosition(v.x, v.y).setScale(1 / this.density).setAlpha(sun.alpha).setVisible(true);
    }
    this.contactStanding.setVisible(true);
    this.contactUnder.setVisible(true);
  }

  /** Turns the pass off, for the night and for a scene that is leaving. */
  hide(): void {
    this.underImage.setVisible(false);
    this.standingImage.setVisible(false);
    this.contactStanding.clear().setVisible(false);
    this.contactUnder.clear().setVisible(false);
  }

  destroy(): void {
    this.underImage.destroy();
    this.standingImage.destroy();
    this.contactStanding.destroy();
    this.contactUnder.destroy();
    for (const key of [UNDER_KEY, STANDING_KEY]) if (this.scene.textures.exists(key)) this.scene.textures.remove(key);
  }

  /** The contact line under the feet: the decided 45%, one world pixel deep. */
  private drawContact(caster: Caster, shadow: Shadow, left: number, feet: number): void {
    const g = caster.layer === 'standing' ? this.contactStanding : this.contactUnder;
    g.fillStyle(SHADOW.ink, SHADOW.contact);
    const scale = 1 / caster.density;
    for (const [a, b] of shadow.contact) {
      const x = left + a * scale;
      const w = Math.max(1, Math.round((b - a + 1) * scale));
      g.fillRect(Math.round(x), Math.round(feet), w, 1);
    }
  }

  private inView(x: number, y: number, w: number, h: number, view: Phaser.Geom.Rectangle): boolean {
    return x + w >= view.x - 8 && x <= view.right + 8 && y + h >= view.y - 8 && y <= view.bottom + 8;
  }

  /** One mask per texture frame, read once from its alpha; null when the browser refuses the pixels. */
  private maskFor(key: string, frame: Phaser.Textures.Frame): Mask | null {
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
          mask = maskOfAlpha(alpha, canvas.width, canvas.height);
        }
      }
    } catch {
      mask = null;
    }
    this.masks.set(key, mask);
    return mask;
  }
}
