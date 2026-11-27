/**
 * The valley's animals on the screen (public #916): the kernel steps them (`wildStep`, DECISIONS 2026-11-27) in a world this layer
 * holds for the session, and each one shown is drawn from its kind's sheets in the kit (`creature_clip`), the sheet of its heading,
 * walk while it moves and idle while it stands, the way the drawn wolf is (DECISIONS 2026-11-27 "The drawn wolf stands in the
 * valley"). A kind whose sheets are not all loaded draws its still (`still_of`) when the kit has one, else nothing; a sheet that lands
 * in the kit later is picked up with no code change. Display only: every rule is the kernel's.
 */
import type * as Phaser from 'phaser';
import { type Bundle, type PublicState, THINK_MS, type WildEvent, type WildSense, type WildWorld, wildShown, wildStep, wildWorld } from '@game/kernel';
import { type CreatureSprites, WalkWatch, clipFrame, creatureClipFor, creatureSheets, creatureX, viewOfHeading } from '../clips';
import { T } from '../config';
import type { Dir } from '../input';
import { baseOf, kitSprite, retex } from '../kitart';
import { wildDrawnAt } from '../wild-view';

interface Drawn {
  spr: Phaser.GameObjects.Sprite;
  watch: WalkWatch;
  dir: Dir;
  verb: 'walk' | 'idle';
  start: number;
  key?: string;
}

/** A shown animal where it is drawn now, in tiles: what the hunt's target points at. */
export interface ShownAnimal {
  spot: number;
  kind: string;
  /** the whole tile it stands on in the kernel */
  tile: [number, number];
  /** where it is drawn, fractional */
  at: [number, number];
  state: string;
}

export class WildLife {
  private world: WildWorld;
  private readonly drawn = new Map<number, Drawn>();
  /** per kind: 'sheets' when every sheet loaded, the still's key, or none */
  private readonly looks = new Map<string, { sheets: true } | { still: string } | undefined>();
  /** the brain's events of the last steps, for a sound or a test */
  readonly events: WildEvent[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly b: Bundle,
    /** registers a new image as a walking caster of the shadow layer */
    private readonly onSprite: (spr: Phaser.GameObjects.Sprite) => void,
  ) {
    this.world = wildWorld(b);
  }

  /** A new session or a load: the world starts again at its anchors, which is what a long gap gives anyway. */
  reset(): void {
    this.world = wildWorld(this.b);
    for (const d of this.drawn.values()) d.spr.setVisible(false);
  }

  /** The kernel's world, read only: the e2e and the tests read the animals' tiles from it. */
  get state(): Readonly<WildWorld> {
    return this.world;
  }

  /** Steps the kernel's world to game ms `tick` and places every animal; `now` is the scene's clock for the sheets' frames. */
  update(state: PublicState, sense: WildSense, tick: number, now: number): void {
    const ev = wildStep(this.b, this.world, state, sense, tick);
    if (ev.length) {
      this.events.push(...ev);
      if (this.events.length > 64) this.events.splice(0, this.events.length - 64);
    }
    for (const a of this.world.animals) {
      const show = wildShown(a);
      let d = this.drawn.get(a.spot);
      if (!show) {
        d?.spr.setVisible(false);
        continue;
      }
      const look = this.lookOf(a.kind);
      if (!look) continue;
      if (!d) {
        const key = 'still' in look ? look.still : creatureSheets(this.b.sprites as CreatureSprites, a.kind)[0]!;
        const spr = kitSprite(this.scene, 0, 0, key, 0).setOrigin(0.5, 1);
        d = { spr, watch: new WalkWatch(), dir: 'down', verb: 'idle', start: now };
        this.drawn.set(a.spot, d);
        this.onSprite(spr);
      }
      const drawn = wildDrawnAt(a, tick);
      const x = (drawn.at[0] + 0.5) * T;
      const y = (drawn.at[1] + 1) * T;
      if ('sheets' in look) this.dress(d, a.kind, now, drawn.at, drawn.heading, drawn.tiles, x, y);
      else d.spr.setPosition(Math.round(x), Math.round(y));
      d.spr.setDepth(Math.round(y)).setVisible(true);
    }
  }

  /** The animals shown now, nearest first to a tile. */
  shown(near?: readonly [number, number]): ShownAnimal[] {
    const out: ShownAnimal[] = [];
    const tick = this.world.pulse * this.b.params.wild.tick_ms;
    for (const a of this.world.animals) {
      if (!wildShown(a)) continue;
      out.push({ spot: a.spot, kind: a.kind, tile: [a.c.at[0], a.c.at[1]], at: wildDrawnAt(a, tick).at, state: a.c.state });
    }
    if (near) {
      const d = (s: ShownAnimal) => (s.tile[0] - near[0]) ** 2 + (s.tile[1] - near[1]) ** 2;
      out.sort((p, q) => d(p) - d(q) || p.spot - q.spot);
    }
    return out;
  }

  /** How a kind is drawn: its sheets when every one loaded (all or none, as the wolf), else its still, else nothing. */
  private lookOf(kind: string): { sheets: true } | { still: string } | undefined {
    if (this.looks.has(kind)) return this.looks.get(kind);
    const sprites = this.b.sprites as CreatureSprites;
    const keys = creatureSheets(sprites, kind);
    const textures = this.scene.textures;
    let look: { sheets: true } | { still: string } | undefined;
    if (keys.length > 0 && keys.every((k) => textures.exists(k))) look = { sheets: true };
    else {
      const still = Object.entries(sprites).find(([key, info]) => info.still_of === kind && textures.exists(key))?.[0];
      look = still ? { still } : undefined;
    }
    this.looks.set(kind, look);
    return look;
  }

  /**
   * The sheet of the way it heads (a right-facing animal is the left sheet flipped), walk while its drawn place moves and idle
   * while it stands; a flight plays the walk faster, by the tiles it covers in a think over a walk's. Its feet on (x, y).
   */
  private dress(d: Drawn, kind: string, now: number, at: readonly [number, number], heading: readonly [number, number], tiles: number, x: number, y: number): void {
    const verb = d.watch.walking(now, at) ? 'walk' : 'idle';
    const face = viewOfHeading(heading, d.dir);
    if (face) d.dir = face.dir;
    const found = creatureClipFor(this.b.sprites as CreatureSprites, kind, verb, d.dir);
    if (!found) return;
    if (verb !== d.verb) {
      d.verb = verb;
      d.start = now;
    }
    if (d.key !== found.key) {
      retex(d.spr, found.key, 0);
      d.spr.setOrigin(0.5, found.anchor[1] / found.h);
      d.key = found.key;
    }
    const walkTiles = THINK_MS / this.b.params.walk_step_ms;
    const quick = verb === 'walk' && tiles > walkTiles ? walkTiles / tiles : 1;
    d.spr.setFrame(clipFrame(now - d.start, found.frames, found.frame_ms * quick, Infinity) ?? 0).setFlipX(found.flip);
    // a quarter of a world unit is one art pixel: the image is placed on that grid
    const at4 = (v: number) => Math.round(v * 4) / 4;
    d.spr.setPosition(at4(creatureX(x, found, baseOf(d.spr))), Math.round(y));
  }
}
