/**
 * The pack a fall left (G33, G81; public #922): what the outing gathered lies in the grass on the tile where the body fell, drawn as the
 * kit's basket, the thing the player carries their finds in, until its game day is over. Display only: the kernel holds the pack
 * (`player.packs`), `packsAt` says which still lie at this tick, and "Take your pack" is the target's (targets.ts `packAt`).
 * No new picture: the basket is `core/base-kit:items/basket`.
 */
import type * as Phaser from 'phaser';
import { packsAt, type Bundle, type PublicState } from '@game/kernel';
import { T } from '../config';
import { kitImage } from '../kitart';

/** The kit picture a pack lies as. */
export const PACK_SPRITE = 'core/base-kit:items/basket';

export class PackLayer {
  private readonly shown = new Map<number, Phaser.GameObjects.Image>();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly b: Bundle,
  ) {}

  /** The ids of the packs drawn now (what a test or an e2e reads). */
  get ids(): number[] {
    return [...this.shown.keys()].sort((a, c) => a - c);
  }

  /** Lays the packs that lie at this tick on their tiles; one taken or past its day is taken off. */
  refresh(state: PublicState, tick: number): void {
    const lying = new Map(packsAt(state, tick).map((p) => [p.id, p]));
    for (const [id, img] of this.shown) {
      if (lying.has(id)) continue;
      img.destroy();
      this.shown.delete(id);
    }
    if (!this.b.sprites[PACK_SPRITE]) return;
    for (const pack of lying.values()) {
      if (this.shown.has(pack.id)) continue;
      const foot = (pack.at[1] + 1) * T - 2;
      const img = kitImage(this.scene, Math.round((pack.at[0] + 0.5) * T), foot, PACK_SPRITE).setOrigin(0.5, 1).setDepth(Math.round(foot));
      this.shown.set(pack.id, img);
    }
  }

  destroy(): void {
    for (const img of this.shown.values()) img.destroy();
    this.shown.clear();
  }
}
