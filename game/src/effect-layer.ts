/**
 * The scene half of the effects (effects.ts): the one layer every effect of the world plays through (VALLEY_EFFECTS.md).
 *
 * - The pack's sheets: lays a sheet's sprite on a spot at the rich scale, steps its frames by the scene's own clock and clears it when
 *   its last frame has shown. A sheet that did not load plays nothing, and the caller falls back to what it drew before (`has`).
 * - The code-drawn parts of a moment (`MOMENTS`): bursts of the scene's own pixel textures, the water's rings, the soft light of a
 *   success, and a struck body's white flash. Each burst texture and flight has one emitter, made the first time it is asked for.
 *
 * Display only: nothing here reads back into the kernel.
 */
import * as Phaser from 'phaser';
import {
  ART_PER_TILE, BURST_FLIGHT, EFFECTS, EFFECT_IDS, LAY, MOMENTS, frameAt, originOf,
  type BurstStyle, type BurstTexture, type EffectDef, type EffectId, type MomentId, type Part, type Spawn,
} from './effects';
import { SUCCESS_LIGHT } from './jolt';
import { RING_TOTAL_MS, ringPixels, ringsAt } from './ring';

interface Live {
  def: EffectDef;
  spr: Phaser.GameObjects.Sprite;
  born: number;
}

interface Ring {
  g: Phaser.GameObjects.Graphics;
  born: number;
}

interface Flash {
  /** the body that was struck, and a white copy of it laid over it */
  of: Phaser.GameObjects.Sprite;
  copy: Phaser.GameObjects.Sprite;
  born: number;
  ms: number;
}

/** Where a moment's parts are laid: a spot of the world (units), the ground's own bits there, and the body on it (for a flash). */
export interface MomentSpot {
  x: number;
  y: number;
  /** the bits the ground under the spot throws (effects.ts `groundBits`), none on water */
  ground?: BurstTexture;
  /** the figure standing on the spot, for a `flash` */
  body?: Phaser.GameObjects.Sprite;
}

export interface LayerDepths {
  /** over the world: sparks, chips, the ground's bits a moment throws, lights, the pack's sheets (a body hides what lies under it at its feet) */
  fx: number;
  /** on the water, under the effects: the rings */
  water: number;
}

/** How far out from the feet, in tiles, a moment throws what rises off the ground. */
const FEET_SPREAD = 0.35;

/** The ring's colour (the core palette's paper, as `splashAt` drew it). */
const RING_RGB = 0xf5f4ef;

export class EffectLayer {
  private readonly live = new Set<Live>();
  private readonly rings = new Set<Ring>();
  private readonly flashes = new Set<Flash>();
  private readonly emitters = new Map<string, Phaser.GameObjects.Particles.ParticleEmitter>();
  private readonly depths: LayerDepths;
  /** every moment played, oldest first, with the parts it could lay (for a test and the e2e); cleared with the layer */
  readonly played: { id: MomentId; at: number; parts: Part['fx'][] }[] = [];

  /** `tile` is the world's units to a tile (16); an effect shows at `tile / 64` of its art pixels. `depth` is the fx depth, or all three. */
  constructor(private readonly scene: Phaser.Scene, depth: number | LayerDepths, private readonly tile: number) {
    this.depths = typeof depth === 'number' ? { fx: depth, water: depth - 1 } : depth;
  }

  private get depth(): number {
    return this.depths.fx;
  }

  /** Whether the effect's sheet is loaded. */
  has(id: EffectId): boolean {
    return this.scene.textures.exists(EFFECTS[id].texture);
  }

  /** The scale an effect shows at: the world's units to a tile over the art pixels to a tile. */
  get scale(): number {
    return this.tile / ART_PER_TILE;
  }

  /** Lays a one-shot effect on a spot of the world (units) at `now` (the scene clock); returns the sprite, or undefined when its sheet is missing. */
  play(id: EffectId, x: number, y: number, now: number, depth = this.depth): Phaser.GameObjects.Sprite | undefined {
    const def = EFFECTS[id];
    if (!this.has(id)) return undefined;
    const [ox, oy] = originOf(def);
    const spr = this.scene.add.sprite(x, y, def.texture, 0).setOrigin(ox, oy).setScale(this.scale).setDepth(depth);
    this.live.add({ def, spr, born: now });
    return spr;
  }

  /** The effect an event started, laid by its own spot on its tile. */
  playSpawn(spawn: Spawn, now: number, depth = this.depth): Phaser.GameObjects.Sprite | undefined {
    const [lx, ly] = LAY[spawn.id];
    return this.play(spawn.id, (spawn.tile[0] + lx) * this.tile, (spawn.tile[1] + ly) * this.tile, now, depth);
  }

  /** A looping effect (the camp fire): made once, shown and hidden by its owner, stepped by `loop`. */
  make(id: EffectId, x: number, y: number, depth: number): Phaser.GameObjects.Sprite | undefined {
    const def = EFFECTS[id];
    if (!this.has(id)) return undefined;
    const [ox, oy] = originOf(def);
    return this.scene.add.sprite(x, y, def.texture, 0).setOrigin(ox, oy).setScale(this.scale).setDepth(depth);
  }

  /** The frame of a looping effect at the scene clock `now`; `phase` sets where in the loop it starts so two never beat as one. */
  loop(spr: Phaser.GameObjects.Sprite, id: EffectId, now: number, phase = 0): void {
    const f = frameAt(EFFECTS[id], now + phase);
    if (f !== null && spr.frame.name !== String(f)) spr.setFrame(f);
  }

  // ------------------------------------------------------------ the code-drawn parts

  /**
   * `n` bits of one of the scene's pixel textures thrown from a spot, by a flight (`BURST_FLIGHT`); a texture the scene did not make
   * throws nothing. The sparks of a fan do not fall: they are light, not matter.
   */
  burst(texture: BurstTexture, x: number, y: number, n: number, style: BurstStyle = 'fan', depth = this.depth): boolean {
    if (!this.scene.textures.exists(texture)) return false;
    const k = `${texture}|${style}|${depth}`;
    let emitter = this.emitters.get(k);
    if (!emitter) {
      const f = BURST_FLIGHT[style];
      emitter = this.scene.add
        .particles(0, 0, texture, {
          lifespan: { min: f.lifespan[0], max: f.lifespan[1] },
          speed: { min: f.speed[0], max: f.speed[1] },
          angle: { min: f.angle[0], max: f.angle[1] },
          gravityY: texture === 'fx-spark' && style === 'fan' ? 0 : f.gravityY,
          alpha: { start: 1, end: 0 },
          scale: { start: 1, end: f.scaleEnd },
          emitting: false,
        })
        .setDepth(depth);
      this.emitters.set(k, emitter);
    }
    emitter.explode(n, x, y);
    return true;
  }

  /** The rings of `ring.ts` spreading on water from a spot (world units), drawn on the pixel grid, stepped by `update`. */
  ring(x: number, y: number, now: number): void {
    const g = this.scene.add.graphics().setPosition(x, y).setDepth(this.depths.water);
    const r = { g, born: now };
    this.rings.add(r);
    this.drawRing(r, now);
  }

  private drawRing(r: Ring, now: number): void {
    r.g.clear();
    for (const shape of ringsAt(now - r.born)) {
      r.g.fillStyle(RING_RGB, shape.alpha);
      for (const [x, y] of ringPixels(shape)) r.g.fillRect(x, y, 1, 1);
    }
  }

  /** The soft light on a thing just made or a body that rose: it rises, holds and fades within `SUCCESS_LIGHT_MS`, then is gone. */
  light(x: number, y: number, scale = 2): Phaser.GameObjects.Image | undefined {
    if (!this.scene.textures.exists('fx-glow')) return undefined;
    const img = this.scene.add.image(x, y, 'fx-glow').setBlendMode(Phaser.BlendModes.ADD).setDepth(this.depth).setAlpha(0).setScale(scale);
    this.scene.tweens.chain({
      targets: img,
      tweens: [
        { alpha: SUCCESS_LIGHT.alpha, duration: SUCCESS_LIGHT.rise },
        { alpha: SUCCESS_LIGHT.alpha, duration: SUCCESS_LIGHT.hold },
        { alpha: 0, duration: SUCCESS_LIGHT.fade },
      ],
      onComplete: () => img.destroy(),
    });
    return img;
  }

  /** A struck body shows white for `ms`: a white copy follows its frame and place over it, fading, and goes (the body's own tint is untouched). */
  flash(body: Phaser.GameObjects.Sprite, ms: number, now: number): void {
    for (const f of this.flashes) if (f.of === body) {
      f.born = now;
      f.ms = ms;
      return;
    }
    const copy = this.scene.add.sprite(body.x, body.y, body.texture.key, body.frame.name).setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    const f = { of: body, copy, born: now, ms };
    this.flashes.add(f);
    this.follow(f, now);
  }

  private follow(f: Flash, now: number): void {
    const { of, copy } = f;
    if (copy.texture.key !== of.texture.key || copy.frame.name !== of.frame.name) copy.setTexture(of.texture.key, of.frame.name);
    copy
      .setPosition(of.x, of.y)
      .setOrigin(of.originX, of.originY)
      .setScale(of.scaleX, of.scaleY)
      .setFlip(of.flipX, of.flipY)
      .setDepth(of.depth + 0.01)
      .setVisible(of.visible)
      .setAlpha(0.85 * (1 - (now - f.born) / f.ms));
  }

  /**
   * A burst as a moment throws it. What rises off the ground (the `ground` flight) is thrown from both sides of the feet, a third of a tile
   * out, the larger half to the left: a body standing on the spot would hide it behind the legs (player eye on the clips, 27.11).
   */
  private thrown(texture: BurstTexture, x: number, y: number, n: number, style: BurstStyle, depth: number): boolean {
    if (style !== 'ground') return this.burst(texture, x, y, n, style, depth);
    const out = FEET_SPREAD * this.tile;
    const left = Math.ceil(n / 2);
    if (!this.burst(texture, x - out, y, left, style, depth)) return false;
    if (n - left > 0) this.burst(texture, x + out, y, n - left, style, depth);
    return true;
  }

  /** Lays a moment's parts on its spot and returns the ones it laid: a `ground` part on water, a flash with no body, a texture not made lay nothing. */
  moment(id: MomentId, spot: MomentSpot, now: number, motion: boolean): Part['fx'][] {
    const laid: Part['fx'][] = [];
    for (const part of MOMENTS[id].parts) {
      // a burst and a ring are motion: with the motion group off only the light and the flash play
      if (!motion && (part.fx === 'burst' || part.fx === 'ground' || part.fx === 'ring')) continue;
      if (part.fx === 'burst') {
        if (this.thrown(part.texture, spot.x, spot.y - part.up, part.n, part.style, this.depth)) laid.push('burst');
      } else if (part.fx === 'ground') {
        if (spot.ground && this.thrown(spot.ground, spot.x, spot.y, part.n, part.style, this.depth)) laid.push('ground');
      } else if (part.fx === 'ring') {
        this.ring(spot.x, spot.y, now);
        laid.push('ring');
      } else if (part.fx === 'light') {
        if (this.light(spot.x, spot.y - part.up, part.scale)) laid.push('light');
      } else if (spot.body) {
        this.flash(spot.body, part.ms, now);
        laid.push('flash');
      }
    }
    this.played.push({ id, at: now, parts: laid });
    if (this.played.length > 64) this.played.shift();
    return laid;
  }

  /** Steps every live one-shot to the frame its age asks for, and clears the ones that have played out. Called once a frame. */
  update(now: number): void {
    for (const e of this.live) {
      const f = frameAt(e.def, now - e.born);
      if (f === null) {
        e.spr.destroy();
        this.live.delete(e);
      } else if (e.spr.frame.name !== String(f)) e.spr.setFrame(f);
    }
    for (const r of this.rings) {
      if (now - r.born >= RING_TOTAL_MS) {
        r.g.destroy();
        this.rings.delete(r);
      } else this.drawRing(r, now);
    }
    for (const f of this.flashes) {
      if (now - f.born >= f.ms || !f.of.active) {
        f.copy.destroy();
        this.flashes.delete(f);
      } else this.follow(f, now);
    }
  }

  /** How many one-shots are playing now (for a test). */
  get playing(): number {
    return this.live.size;
  }

  /** The ids of the one-shots playing now, oldest first (for a test and the e2e). */
  playingIds(): EffectId[] {
    return [...this.live].map((e) => e.def.id);
  }

  /** How many rings and flashes are showing now (for a test and the e2e). */
  get showing(): { rings: number; flashes: number } {
    return { rings: this.rings.size, flashes: this.flashes.size };
  }

  /** Clears every one-shot, ring and flash (a new game or a loaded one); the emitters stay for the next. */
  clear(): void {
    for (const e of this.live) e.spr.destroy();
    this.live.clear();
    for (const r of this.rings) r.g.destroy();
    this.rings.clear();
    for (const f of this.flashes) f.copy.destroy();
    this.flashes.clear();
    this.played.length = 0;
  }

  /** Every effect's sheet the layer knows, for the loader. */
  static get all(): readonly EffectDef[] {
    return EFFECT_IDS.map((id) => EFFECTS[id]);
  }
}
