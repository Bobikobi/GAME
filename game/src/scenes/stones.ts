/**
 * Loose stones in the world (DECISIONS 2026-11-22, #831): the stones that lie on their tiles, by count (a lone stone, two or
 * three, a heap), and the flight of a thrown one. A small stone is its own drawing, a large one the item picture scaled (REUSE: the
 * existing stone), a heap of four or more small ones the kit's rubble heap,
 * the motion is code (stone-art.ts), the shadow is an ellipse under it. A stone that was just thrown is held back from its
 * resting tile until its flight ends, so the landing is seen and not announced.
 */
import type * as Phaser from 'phaser';
import { type Bundle, type PublicState, type Tile, lyingAt, settled, stoneSpots } from '@game/kernel';
import { T } from '../config';
import { baseOf, kitImage } from '../kitart';
import { ARMS_STONE_KIND, HAND_STONE_KIND, SMALL_STONE_SCALE, STONE_CENTRE, STONE_SCALE, type Throw, pileLayout, stoneMotion } from '../stone-art';

/** The ink of every shadow in the world (the cast layer's own). */
const INK = 0x1b1a2e;

interface Shown {
  sig: string;
  images: Phaser.GameObjects.Image[];
}

export interface Held {
  key: string;
  kind: string;
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
  private last?: { state: PublicState; tick: number };

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly b: Bundle,
    private readonly depth: number,
  ) {}

  /** The tiles with a stone on them: the spots that still have theirs, and every tile where stones were set down or fell. */
  private tiles(state: PublicState): Set<string> {
    const keys = new Set<string>();
    const taken = state.player.stones?.taken ?? {};
    stoneSpots(this.b).forEach((s, i) => {
      if (!taken[i]) keys.add(`${s.x},${s.y}`);
    });
    for (const [k, pile] of Object.entries(state.player.ground ?? {})) if (Object.keys(pile).some((kind) => this.b.params.liftables[kind]?.class === 'hand')) keys.add(k);
    for (const k of Object.keys(state.player.stones?.placed ?? {})) keys.add(k);
    return keys;
  }

  /** Draws the stones as the state has them at `tick` (the returns that are due are already home), minus any still in the air. */
  refresh(state: PublicState, tick: number): void {
    this.last = { state, tick };
    const view = settled(this.b, state, tick);
    const want = new Map<string, string[]>();
    for (const k of this.tiles(view)) {
      const [x, y] = k.split(',').map(Number) as [number, number];
      const { placed, spot } = lyingAt(this.b, view, [x, y]);
      if (spot) placed[spot] = (placed[spot] ?? 0) + 1;
      for (const h of this.held) if (h.key === k) placed[h.kind] = Math.max(0, (placed[h.kind] ?? 0) - 1);
      const kinds = Object.keys(placed).sort((a, b) => Number(a === HAND_STONE_KIND) - Number(b === HAND_STONE_KIND) || (a < b ? -1 : a > b ? 1 : 0));
      const pile = kinds.flatMap((kind) => Array<string>(Math.min(placed[kind]!, 5)).fill(kind));
      if (pile.length > 0) want.set(k, pile);
    }
    for (const [k, v] of this.shown) {
      if (v.sig === want.get(k)?.join(',')) continue;
      for (const img of v.images) img.destroy();
      this.shown.delete(k);
    }
    for (const [k, kinds] of want) {
      if (this.shown.has(k)) continue;
      const [x, y] = k.split(',').map(Number) as [number, number];
      const others = kinds.filter((kind) => kind !== HAND_STONE_KIND).length;
      const images = pileLayout(kinds.length, others).map((slot, i) => {
        const kind = kinds[i % kinds.length]!;
        const ref = slot.picture === 'heap' ? 'core/base-kit:props/rock_stones' : this.b.params.liftables[kind]!.sprite;
        const img = kitImage(this.scene, (x + 0.5 + slot.dx) * T, (y + 1 - slot.dy) * T - 2, ref).setOrigin(0.5, 1).setDepth(this.depth);
        const scale = slot.size === 'large' && kind !== ARMS_STONE_KIND ? slot.scale / STONE_SCALE.large : slot.scale;
        img.setScale(baseOf(img) * scale);
        return img;
      });
      this.shown.set(k, { sig: kinds.join(','), images });
    }
  }

  /**
   * Holds one stone of `kind` back from the tile `key` for `ms`: the tile shows the pile without it until the stone it lands
   * is seen to land (the flight below), then the tile is drawn again as it is.
   */
  hold(key: string, kind: string, now: number, ms: number): Held {
    const h: Held = { key, kind, until: now + ms };
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

  /** The stone in the hand before it is thrown, if any: the picture and its size's share of the flying one. */
  private inHand?: { image: Phaser.GameObjects.Image; scale: number };

  /**
   * Puts a stone in the figure's hand: drawn at `share` of its flying size, moved with `moveInHand` every frame until `letGo`
   * (the flight begins where it was let go). One at a time; a second takes the first's place.
   */
  takeInHand(kind: string, share = 1): void {
    this.letGo();
    const image = this.throwImage(kind);
    const scale = baseOf(image) * (kind === ARMS_STONE_KIND ? STONE_SCALE.large : SMALL_STONE_SCALE) * share;
    image.setScale(scale);
    image.setVisible(false);
    this.inHand = { image, scale };
  }

  private throwImage(kind: string): Phaser.GameObjects.Image {
    const image = kitImage(this.scene, 0, 0, this.b.params.liftables[kind]!.sprite);
    if (kind === ARMS_STONE_KIND) return image.setOrigin(...STONE_CENTRE.large);
    if (kind === HAND_STONE_KIND) return image.setOrigin(...STONE_CENTRE.small);
    return image.setOrigin(0.5);
  }

  /** Lays the stone in the hand at a world point (pixels), in front of the figure whose feet are on `footY`. */
  moveInHand(x: number, y: number, footY: number): void {
    const h = this.inHand;
    if (!h) return;
    h.image.setPosition(x, y).setVisible(true).setDepth(Math.round(footY + T / 2) + 2);
  }

  /** Whether a stone is in the hand. */
  get gripped(): boolean {
    return this.inHand !== undefined;
  }

  /** The hand opens: the picture goes (the flight, if there is one, draws its own). */
  letGo(): void {
    this.inHand?.image.destroy();
    this.inHand = undefined;
  }

  /** Starts the flight of a thrown stone from the hand; `onTouch` is told once, where it first comes down (a puff, a splash). */
  fly(throwEv: Throw & { kind: string }, now: number, onTouch: (tile: Tile, sank: boolean) => void): void {
    const motion = stoneMotion(throwEv);
    const image = this.throwImage(throwEv.kind);
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
    this.letGo();
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
