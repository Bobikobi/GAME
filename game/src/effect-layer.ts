/**
 * The scene half of the effects (effects.ts): lays a sheet's sprite on a spot at the rich scale, steps its frames by the scene's own
 * clock and clears it when its last frame has shown. Display only. A sheet that did not load plays nothing, and the caller falls back
 * to what it drew before (`has`).
 */
import type * as Phaser from 'phaser';
import { ART_PER_TILE, EFFECTS, EFFECT_IDS, LAY, frameAt, originOf, type EffectDef, type EffectId, type Spawn } from './effects';

interface Live {
  def: EffectDef;
  spr: Phaser.GameObjects.Sprite;
  born: number;
}

export class EffectLayer {
  private readonly live = new Set<Live>();

  /** `tile` is the world's units to a tile (16); an effect shows at `tile / 64` of its art pixels. */
  constructor(private readonly scene: Phaser.Scene, private readonly depth: number, private readonly tile: number) {}

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

  /** Steps every live one-shot to the frame its age asks for, and clears the ones that have played out. Called once a frame. */
  update(now: number): void {
    for (const e of this.live) {
      const f = frameAt(e.def, now - e.born);
      if (f === null) {
        e.spr.destroy();
        this.live.delete(e);
      } else if (e.spr.frame.name !== String(f)) e.spr.setFrame(f);
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

  /** Clears every one-shot (a new game or a loaded one). */
  clear(): void {
    for (const e of this.live) e.spr.destroy();
    this.live.clear();
  }

  /** Every effect's sheet the layer knows, for the loader. */
  static get all(): readonly EffectDef[] {
    return EFFECT_IDS.map((id) => EFFECTS[id]);
  }
}
