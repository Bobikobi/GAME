/**
 * One driver for pieces that drift (ANIMATION.md 3.1, #660): a chimney's smoke, a fire's embers, leaves, ash, a flurry.
 * It takes a sheet and a behaviour, and each piece steps through the sheet's frames while it rises and fades, or falls
 * and drifts. The picture is the artist's; the driver adds no art. The numbers are data (`DriftSpec`), so a new piece
 * of the same kind is a sheet and a line, not a new emitter.
 *
 * Display only, like the rest of the motion group: nothing here reads back into the kernel, and every piece is a pure
 * function of its seed and its age (`spawn`, `stateAt`), so a still and a clip of the same run agree.
 *
 * The chimney smoke uses it only behind `?drift=sheet` (`driftOn`) while its sheet is a stand-in: the kit's own 2x2
 * puff stays the default until the owner has judged the two side by side.
 */
import type * as Phaser from 'phaser';
import { seeded } from './flicker';

/** How a piece moves: it rises and fades (smoke, embers), or falls and drifts (leaves, ash, snow). */
export type Behaviour = 'rise' | 'fall';

/** What one kind of drifting piece does. Distances in world px, times in ms, speeds in px a second. */
export interface DriftSpec {
  behaviour: Behaviour;
  /** Sheet frames a piece shows through its life, in order. */
  frames: readonly number[];
  /** A piece lives this long (min, max). */
  life: readonly [number, number];
  /** Time between two pieces, and the most alive at once. */
  every: number;
  max: number;
  /** The speed a piece starts with along its way: up for `rise`, down for `fall` (min, max). */
  speed: readonly [number, number];
  /** Sideways speed, positive to the right (min, max). */
  sideways: readonly [number, number];
  /** A pull along the way, px a second squared: a fall quickens, a rise slows or quickens. */
  pull: number;
  /** Opacity through the life, evenly spaced keys; the last is where the piece ends. */
  alpha: readonly number[];
  /** Scale at birth and at the end of life. */
  scale: readonly [number, number];
}

/** The sheet: where it is served, how big a cell is, and where in it the pieces' frames lie. */
export interface DriftSheet {
  url: string;
  cell: readonly [number, number];
}

/** One live piece: all its randomness, drawn once at birth. */
export interface Piece {
  born: number;
  life: number;
  speed: number;
  sideways: number;
  /** A sideways wobble's phase, so no two pieces swing together. */
  phase: number;
}

/** Where a piece is, relative to its source, at one moment. */
export interface PieceState {
  dx: number;
  dy: number;
  alpha: number;
  scale: number;
  frame: number;
}

const between = (rng: () => number, [lo, hi]: readonly [number, number]): number => lo + rng() * (hi - lo);

/** A new piece born at `now`, from the generator `rng`. */
export function spawn(rng: () => number, spec: DriftSpec, now: number): Piece {
  return {
    born: now,
    life: between(rng, spec.life),
    speed: between(rng, spec.speed),
    sideways: between(rng, spec.sideways),
    phase: rng() * Math.PI * 2,
  };
}

/** The value of `keys` (evenly spaced) at `u` in 0..1. */
export function across(keys: readonly number[], u: number): number {
  if (keys.length === 0) return 1;
  if (keys.length === 1) return keys[0]!;
  const at = Math.min(Math.max(u, 0), 1) * (keys.length - 1);
  const i = Math.min(Math.floor(at), keys.length - 2);
  return keys[i]! + (keys[i + 1]! - keys[i]!) * (at - i);
}

/** Positions rest on the art-pixel grid, a quarter of a world px, like every sprite of the world. */
const snap = (v: number): number => Math.round(v * 4) / 4;

/**
 * The piece at `now`, or undefined once its life is over. A rise goes up from its source, bending sideways and
 * swelling; a fall starts slow, quickens under its pull and sways as it comes down.
 */
export function stateAt(spec: DriftSpec, p: Piece, now: number): PieceState | undefined {
  const t = (now - p.born) / 1000;
  const u = (now - p.born) / p.life;
  if (u < 0 || u >= 1) return undefined;
  const sign = spec.behaviour === 'rise' ? -1 : 1;
  const sway = spec.behaviour === 'fall' ? Math.sin(t * 2.2 + p.phase) * 2 : Math.sin(t * 1.1 + p.phase) * 0.8;
  return {
    dx: snap(p.sideways * t + sway),
    dy: snap(sign * p.speed * t + 0.5 * spec.pull * t * t),
    alpha: across(spec.alpha, u),
    scale: spec.scale[0] + (spec.scale[1] - spec.scale[0]) * u,
    frame: spec.frames[Math.min(Math.floor(u * spec.frames.length), spec.frames.length - 1)] ?? 0,
  };
}

/** Whether `?drift=sheet` asks for the driver's pieces in place of the kit's own (default: off). */
export function driftOn(query: string): boolean {
  return new URLSearchParams(query).get('drift') === 'sheet';
}

/** The chimney's smoke on the driver. The sheet is a stand-in until the real one is drawn: its cell and frames change with the file. */
export const CHIMNEY_SMOKE: { sheet: DriftSheet; spec: DriftSpec } = {
  sheet: { url: 'fx/smoke.png', cell: [80, 80] },
  spec: {
    behaviour: 'rise',
    frames: [23, 24, 25, 26],
    life: [2500, 4000],
    every: 420,
    max: 10,
    speed: [3, 7],
    sideways: [1, 3],
    pull: 0,
    alpha: [0.7, 0.45, 0],
    scale: [0.07, 0.13],
  },
};

/** The texture key the sheet is loaded under. */
export const DRIFT_TEXTURE = 'fx-drift';

interface Live {
  piece: Piece;
  img: Phaser.GameObjects.Image;
}

/**
 * The pieces of one source: born every `spec.every` while it is on, moved every frame, put back in the pool when
 * their life is over. The same on/off surface as a particle emitter (`emitting`, `start`, `stop`), so the scene's
 * "only while on screen" rule takes it as it is.
 */
export class Drifters {
  private live: Live[] = [];
  private pool: Phaser.GameObjects.Image[] = [];
  private rng: () => number;
  private next = 0;
  emitting = false;

  constructor(
    private scene: Phaser.Scene,
    private spec: DriftSpec,
    private x: number,
    private y: number,
    private depth: number,
    seed: number,
  ) {
    this.rng = seeded(seed);
  }

  start(): this {
    this.emitting = true;
    return this;
  }

  stop(): this {
    this.emitting = false;
    return this;
  }

  setPosition(x: number, y: number): this {
    this.x = x;
    this.y = y;
    return this;
  }

  setDepth(depth: number): this {
    this.depth = depth;
    for (const l of this.live) l.img.setDepth(depth);
    return this;
  }

  /** Births while on, and moves everything alive to `now` (ms). */
  update(now: number): void {
    if (this.emitting && now >= this.next && this.live.length < this.spec.max) {
      this.next = now + this.spec.every;
      const img = (this.pool.pop() ?? this.scene.add.image(0, 0, DRIFT_TEXTURE)).setVisible(true).setDepth(this.depth);
      this.live.push({ piece: spawn(this.rng, this.spec, now), img });
    }
    for (let i = this.live.length - 1; i >= 0; i--) {
      const l = this.live[i]!;
      const s = stateAt(this.spec, l.piece, now);
      if (!s) {
        l.img.setVisible(false);
        this.pool.push(l.img);
        this.live.splice(i, 1);
        continue;
      }
      l.img.setFrame(s.frame).setPosition(this.x + s.dx, this.y + s.dy).setAlpha(s.alpha).setScale(s.scale);
    }
  }

  destroy(): void {
    for (const l of this.live) l.img.destroy();
    for (const img of this.pool) img.destroy();
    this.live = [];
    this.pool = [];
  }
}
