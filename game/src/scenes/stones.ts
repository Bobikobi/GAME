/**
 * Loose stones in the world (DECISIONS 2026-11-22, #831): the stones that lie on their tiles, by count (a lone stone, two or
 * three, a heap), and the flight of a thrown one. A small stone is its own drawing, a large one the item picture scaled (REUSE: the
 * existing stone), a heap of four or more small ones the kit's rubble heap,
 * the motion is code (stone-art.ts), the shadow is an ellipse under it. A stone that was just thrown is held back from its
 * resting tile until its flight ends, so the landing is seen and not announced.
 */
import type * as Phaser from 'phaser';
import { type Bundle, type PublicState, type Tile, STONE_ITEM, lyingAt, settled, stoneSpots } from '@game/kernel';
import { T } from '../config';
import { baseOf, kitImage } from '../kitart';
import { SMALL_STONE_SCALE, STONE_SCALE, type StonePicture, type StoneSize, type Throw, pileLayout, stoneMotion } from '../stone-art';

/** The ink of every shadow in the world (the cast layer's own). */
const INK = 0x1b1a2e;

interface Shown {
  sig: string;
  images: Phaser.GameObjects.Image[];
}

export interface Held {
  key: string;
  size: StoneSize;
  until: number;
}

interface Flying {
  image: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Ellipse;
  throwEv: Throw;
  motion: ReturnType<typeof stoneMotion>;
  start: number;
  touched: boolean;
  onTouch: (tile: Tile, sank: boolean) => void;
}

export class StoneLayer {
  private readonly shown = new Map<string, Shown>();
  private readonly held: Held[] = [];
  private readonly flying: Flying[] = [];
  /** the pictures by kind: the item's (a large stone), the small stone's own drawing and the rubble heap */
  private readonly refs: Readonly<Record<StonePicture, string>>;
  private last?: { state: PublicState; tick: number };

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly b: Bundle,
    private readonly depth: number,
  ) {
    const large = b.items[STONE_ITEM]?.sprite ?? 'core/base-kit:items/stone';
    this.refs = { large, small: 'core/base-kit:items/stone_small', heap: 'core/base-kit:props/rock_stones' };
  }

  /** The tiles with a stone on them: the spots that still have theirs, and every tile where stones were set down or fell. */
  private tiles(state: PublicState): Set<string> {
    const keys = new Set<string>();
    const taken = state.player.stones?.taken ?? {};
    stoneSpots(this.b).forEach((s, i) => {
      if (!taken[i]) keys.add(`${s.x},${s.y}`);
    });
    for (const [k, pile] of Object.entries(state.player.ground ?? {})) if ((pile[STONE_ITEM] ?? 0) > 0) keys.add(k);
    for (const [k, n] of Object.entries(state.player.stones?.large ?? {})) if (n > 0) keys.add(k);
    return keys;
  }

  /** Draws the stones as the state has them at `tick` (the returns that are due are already home), minus any still in the air. */
  refresh(state: PublicState, tick: number): void {
    this.last = { state, tick };
    const view = settled(this.b, state, tick);
    const want = new Map<string, { small: number; large: number }>();
    for (const k of this.tiles(view)) {
      const [x, y] = k.split(',').map(Number) as [number, number];
      const here = lyingAt(this.b, view, [x, y]);
      let small = here.small + (here.spot === 'small' ? 1 : 0);
      let large = here.large + (here.spot === 'large' ? 1 : 0);
      for (const h of this.held) {
        if (h.key !== k) continue;
        if (h.size === 'small') small = Math.max(0, small - 1);
        else large = Math.max(0, large - 1);
      }
      if (small + large > 0) want.set(k, { small, large });
    }
    for (const [k, v] of this.shown) {
      if (want.has(k) && v.sig === this.sig(want.get(k)!)) continue;
      for (const img of v.images) img.destroy();
      this.shown.delete(k);
    }
    for (const [k, n] of want) {
      if (this.shown.has(k)) continue;
      const [x, y] = k.split(',').map(Number) as [number, number];
      const images = pileLayout(n.small + n.large, n.large).map((slot) => {
        const img = kitImage(this.scene, (x + 0.5 + slot.dx) * T, (y + 1 - slot.dy) * T - 2, this.refs[slot.picture]).setOrigin(0.5, 1).setDepth(this.depth);
        img.setScale(baseOf(img) * slot.scale);
        return img;
      });
      this.shown.set(k, { sig: this.sig(n), images });
    }
  }

  private sig(n: { small: number; large: number }): string {
    return `${n.small}/${n.large}`;
  }

  /**
   * Holds one stone of `size` back from the tile `key` for `ms`: the tile shows the pile without it until the stone it lands
   * is seen to land (the flight below), then the tile is drawn again as it is.
   */
  hold(key: string, size: StoneSize, now: number, ms: number): Held {
    const h: Held = { key, size, until: now + ms };
    this.held.push(h);
    if (this.last) this.refresh(this.last.state, this.last.tick);
    return h;
  }

  /** Sets when a hold ends, once the flight it waits for has begun (`hold` with an endless time): the flight's start is the one clock. */
  holdUntil(h: Held, until: number): void {
    h.until = until;
  }

  /** The stones as they are drawn on a tile now, for a test or a check. */
  countAt(key: string): number {
    const v = this.shown.get(key);
    return v ? v.images.length : 0;
  }

  /** Starts the flight of a thrown stone from the hand; `onTouch` is told once, where it first comes down (a puff, a splash). */
  fly(throwEv: Throw, now: number, onTouch: (tile: Tile, sank: boolean) => void): void {
    const motion = stoneMotion(throwEv);
    const image = kitImage(this.scene, 0, 0, this.refs[throwEv.size]).setOrigin(0.5, 0.5);
    image.setData('scale', baseOf(image) * (throwEv.size === 'large' ? STONE_SCALE.large : SMALL_STONE_SCALE));
    const shadow = this.scene.add.ellipse(0, 0, 8, 4, INK, 0.35);
    this.flying.push({ image, shadow, throwEv, motion, start: now, touched: false, onTouch });
    this.frame(now);
  }

  /** One frame: the stones in the air move, and a hold that has run out lets its stone be drawn where it landed. */
  frame(now: number): void {
    for (let i = this.flying.length - 1; i >= 0; i--) {
      const f = this.flying[i]!;
      const pose = f.motion.at(now - f.start);
      const px = pose.x * T;
      const ground = pose.y * T;
      const base = f.image.getData('scale') as number;
      f.image.setPosition(px, ground - pose.lift * T);
      f.image.setScale(base * pose.shrink);
      f.image.setRotation(pose.spin);
      f.image.setAlpha(pose.alpha);
      // the foot line of its tile, as a figure's depth is: a stone in the hand of the thrower on that tile is in front of the thrower
      f.image.setDepth(Math.round(ground + T / 2) + 2);
      // the shadow stays on the ground and thins as the stone rises
      const rise = Math.min(1, pose.lift / 1.2);
      f.shadow.setPosition(px, ground + 1);
      f.shadow.setSize((f.throwEv.size === 'large' ? 11 : 6) * (1 - 0.35 * rise), f.throwEv.size === 'large' ? 5 : 3);
      f.shadow.setAlpha(0.35 * (1 - 0.6 * rise) * pose.alpha);
      f.shadow.setDepth(Math.round(ground) + 1);
      if (pose.touched && !f.touched) {
        f.touched = true;
        f.onTouch(f.throwEv.touch, f.throwEv.at === null);
      }
      if (pose.done) {
        f.image.destroy();
        f.shadow.destroy();
        this.flying.splice(i, 1);
      }
    }
    let freed = false;
    for (let i = this.held.length - 1; i >= 0; i--) {
      if (this.held[i]!.until > now) continue;
      this.held.splice(i, 1);
      freed = true;
    }
    if (freed && this.last) this.refresh(this.last.state, this.last.tick);
  }

  /** Whether a stone is still in the air. */
  get busy(): boolean {
    return this.flying.length > 0;
  }

  destroy(): void {
    for (const v of this.shown.values()) for (const img of v.images) img.destroy();
    this.shown.clear();
    for (const f of this.flying) {
      f.image.destroy();
      f.shadow.destroy();
    }
    this.flying.length = 0;
    this.held.length = 0;
  }
}
