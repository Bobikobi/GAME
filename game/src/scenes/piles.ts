/**
 * What the player put down (DECISIONS.md, 2026-10-23): it lies on its tile until picked up again. One
 * picture a tile, the first thing of the pile by id, so the same save draws the same ground.
 */
import type * as Phaser from 'phaser';
import type { Bundle, PublicState } from '@game/kernel';
import { kitImage } from '../kitart';
import { T } from '../config';

/** The thing a pick-up on this tile takes first, or undefined with nothing there. */
export function pileAt(state: PublicState, x: number, y: number): string | undefined {
  const pile = state.player.ground?.[`${x},${y}`];
  return pile ? Object.keys(pile).filter((id) => (pile[id] ?? 0) > 0).sort()[0] : undefined;
}

export class Piles {
  private readonly shown = new Map<string, { ref: string; img: Phaser.GameObjects.Image }>();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly b: Bundle,
    private readonly depth: number,
    private readonly fallback: string,
  ) {}

  refresh(state: PublicState): void {
    const want = new Map<string, string>();
    for (const k of Object.keys(state.player.ground ?? {})) {
      const [x, y] = k.split(',').map(Number) as [number, number];
      const id = pileAt(state, x, y);
      if (id) want.set(k, this.b.items[id]?.sprite ?? this.fallback);
    }
    for (const [k, v] of this.shown) {
      if (want.get(k) === v.ref) continue;
      v.img.destroy();
      this.shown.delete(k);
    }
    for (const [k, ref] of want) {
      if (this.shown.has(k)) continue;
      const [x, y] = k.split(',').map(Number) as [number, number];
      const img = kitImage(this.scene, (x + 0.5) * T, (y + 1) * T - 2, ref).setOrigin(0.5, 1).setDepth(this.depth);
      this.shown.set(k, { ref, img });
    }
  }
}
