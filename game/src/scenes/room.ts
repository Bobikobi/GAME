/**
 * A shop you walk into (DECISIONS.md, 2026-10-11, the shop interior; frame C
 * is the compass): one room, the door at the bottom, a runner that leads to
 * the counter with the keeper behind it, and the back wall that shows the
 * trade. The keeper's place on the map is the shop's door; walking into it
 * opens this scene over the valley, and walking out of the door closes it.
 *
 * Nothing here is a kernel position. While the player is inside, the session
 * keeps them on the doorstep, so a trade across the counter is a trade at the
 * door, and the valley's clock runs on in the world scene behind.
 */
import * as Phaser from 'phaser';
import { type Bundle, minuteOfDay } from '@game/kernel';
import { app } from '../app';
import { RICH, STEP_MS, T } from '../config';
import { DIRS, type Dir } from '../input';
import type { Session } from '../session';

export const ROOM = 'room';

/** The room in tiles: the back wall takes three rows, the keeper's floor one, the counter the next. */
const COLS = 7;
const ROWS = 9;
/** The column of the door and the runner. */
const DOOR = 3;
/** Where the player stands on walking in. */
const ENTRY: [number, number] = [DOOR, ROWS - 1];
/** The rim of the outer wall around the room, in pixels. */
const RIM = 4;
const INK = 0x1b1a2e;
const WOOD = 0x6e4226;
const DARK_WOOD = 0x3d2618;
const CREAM = 0xebd3a2;

/** The look of each room, by the shop's `interior` (schema: ShopBody). */
export type Look = 'food';

/** The NPC a door tile leads to, by "x,y": the keepers of shops with an interior. */
export function doorsOf(b: Bundle, npcTileOf: (id: string) => [number, number] | undefined): Map<string, string> {
  const doors = new Map<string, string>();
  for (const [id, npc] of Object.entries(b.npcs)) {
    if (!npc.shop || !b.shops[npc.shop]?.interior) continue;
    const t = npcTileOf(id);
    if (t) doors.set(`${t[0]},${t[1]}`, id);
  }
  return doors;
}

interface Move {
  from: [number, number];
  to: [number, number];
  t: number;
}

export interface RoomData {
  npc: string;
  /** called once the player has walked out of the door */
  onLeave: () => void;
}

export class RoomScene extends Phaser.Scene {
  private b!: Bundle;
  private npcId = '';
  private onLeave: () => void = () => undefined;
  /** the player's tile inside the room, and where they face */
  pos: [number, number] = [...ENTRY];
  facing: Dir = 'up';
  move: Move | null = null;
  private solid = new Set<string>();
  private counter = new Set<string>();
  private player!: Phaser.GameObjects.Sprite;
  private keeper!: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite;
  private marker!: Phaser.GameObjects.Image;
  private hearth: Phaser.GameObjects.Sprite | undefined;
  private cat: Phaser.GameObjects.Sprite | undefined;
  private window: Phaser.GameObjects.Sprite | undefined;
  private light: Phaser.GameObjects.Graphics | undefined;
  private glow: Phaser.GameObjects.Image | undefined;
  private motes: Phaser.GameObjects.Particles.ParticleEmitter | undefined;
  private nextFlame = 0;
  private flame = 0;
  private nextCat = 0;
  private catUntil = 0;
  private nextKeeperBlink = 0;
  private keeperBlinkUntil = 0;
  private steps = 0;
  private prompt = '';
  private leaving = false;
  /** the direction held through the door: it walks nobody until it is let go */
  private held: Dir | null = null;
  private lastHour = -1;

  constructor() {
    super(ROOM);
  }

  init(data: RoomData): void {
    this.b = app.bundle;
    this.npcId = data.npc;
    this.onLeave = data.onLeave;
    this.pos = [...ENTRY];
    this.facing = 'up';
    this.move = null;
    this.leaving = false;
    this.held = app.controls.direction();
    this.prompt = '';
    this.lastHour = -1;
    this.solid.clear();
    this.counter.clear();
    this.hearth = this.cat = this.window = undefined;
    this.light = undefined;
    this.glow = undefined;
    this.motes = undefined;
  }

  create(): void {
    const npc = this.b.npcs[this.npcId]!;
    const look = (this.b.shops[npc.shop ?? '']?.interior ?? 'food') as Look;
    this.cameras.main.setBackgroundColor(INK);
    this.shell();
    if (look === 'food') this.furnishFood();
    this.player = this.add.sprite(0, 0, this.frameFor('up').key, 1).setOrigin(0.5, 1);
    this.placePlayer();
    this.faceFrame();
    this.marker = this.add.image(0, 0, 'fx-arrow').setOrigin(0.5, 1).setDepth(10_000).setVisible(false);
    this.tweens.add({ targets: this.marker, displayOriginY: 7, duration: 380, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    this.scale.on('resize', this.fit, this);
    this.events.once('shutdown', () => {
      this.scale.off('resize', this.fit, this);
      app.ui.setPrompt('');
    });
    this.fit();
    if (RICH.light) this.cameras.main.fadeIn(260, 27, 26, 46);
  }

  // ------------------------------------------------------------ building

  private ref(name: string): string {
    return `core/base-kit:${name}`;
  }

  private has(name: string): boolean {
    return this.textures.exists(this.ref(name));
  }

  /** A piece with its top-left corner at (x, y) in room pixels. */
  private at(name: string, x: number, y: number, depth: number, frame = 0): Phaser.GameObjects.Image | undefined {
    if (!this.has(name)) return undefined;
    return this.add.image(x, y, this.ref(name), frame).setOrigin(0).setDepth(depth);
  }

  /** A piece standing with its feet at (cx, bottom): it sorts with the player by its feet. */
  private stand(name: string, cx: number, bottom: number): Phaser.GameObjects.Image | undefined {
    if (!this.has(name)) return undefined;
    if (RICH.detail && this.textures.exists('fx-shadow')) {
      const w = this.textures.get(this.ref(name)).get(0).width;
      this.add.image(cx, bottom + 1, 'fx-shadow').setOrigin(0.5, 1).setAlpha(0.3).setDepth(1.5).setScale(Math.max(1, w / 12), 1);
    }
    return this.add.image(cx, bottom, this.ref(name)).setOrigin(0.5, 1).setDepth(bottom);
  }

  private block(x: number, y: number): void {
    this.solid.add(`${x},${y}`);
  }

  /** The outer wall around the room and the door gap at the bottom, shared by every look. */
  private shell(): void {
    const g = this.add.graphics().setDepth(5000);
    const w = COLS * T;
    const h = ROWS * T;
    g.fillStyle(INK).fillRect(-RIM, -RIM, w + 2 * RIM, RIM).fillRect(-RIM, h, w + 2 * RIM, RIM);
    g.fillRect(-RIM, 0, RIM, h).fillRect(w, 0, RIM, h);
    g.fillStyle(WOOD).fillRect(-RIM + 1, -RIM + 1, w + 2 * RIM - 2, RIM - 1).fillRect(-RIM + 1, h, w + 2 * RIM - 2, RIM - 1);
    g.fillRect(-RIM + 1, 0, RIM - 1, h).fillRect(w, 0, RIM - 1, h);
    g.fillStyle(DARK_WOOD).fillRect(-RIM + 1, -RIM + 1, w + 2 * RIM - 2, 1).fillRect(-RIM + 1, h + RIM - 2, w + 2 * RIM - 2, 1);
    // the doorway: a gap in the bottom wall with daylight on its sill
    const dx = DOOR * T - 2;
    g.fillStyle(INK).fillRect(dx, h, T + 4, RIM);
    g.fillStyle(DARK_WOOD).fillRect(dx + 1, h, T + 2, RIM - 1);
    g.fillStyle(CREAM).fillRect(dx + 1, h + RIM - 2, T + 2, 1);
    // the back three rows and the keeper's floor are no place for a customer
    for (let y = 0; y < 4; y++) for (let x = 0; x < COLS; x++) this.block(x, y);
  }

  /**
   * The food and medicine shop of frame C: plank walls, the brick chimney with
   * the lit stove, a window with its light on the floor, a shelf of jars, the
   * counter with the keeper, the stew, the tea and the cat, and the runner.
   */
  private furnishFood(): void {
    for (let y = 3; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const v = (x * 7 + y * 13) % 5;
        this.at(v === 1 ? 'tiles/planks_1' : v === 3 ? 'tiles/planks_2' : 'tiles/planks', x * T, y * T, 0);
      }
    }
    for (let x = 0; x < COLS; x++) this.at(x % 3 === 0 ? 'props/room_wall_1' : 'props/room_wall', x * T, 0, 1);
    // the wall's shade on the floor
    this.add.rectangle(0, 3 * T, COLS * T, 3, INK, 0.35).setOrigin(0).setDepth(1.2);

    if (this.has('props/hearth')) this.hearth = this.add.sprite(24, 0, this.ref('props/hearth'), 0).setOrigin(0).setDepth(2);
    if (this.has('props/shop_window')) this.window = this.add.sprite(1, 12, this.ref('props/shop_window'), 0).setOrigin(0).setDepth(2);
    this.at('props/jar_shelf', 89, 20, 2);

    // the runner from the door to the counter, and the mat inside the door
    const rx = DOOR * T + T / 2 - 12;
    this.at('props/runner_top', rx, 5 * T + 2, 1);
    for (let y = 6; y < ROWS - 1; y++) this.at('props/runner', rx, y * T + 2, 1);
    this.at('props/runner_end', rx, (ROWS - 1) * T, 1);
    this.at('props/door_mat', DOOR * T, ROWS * T - 8, 1.1);

    // the keeper behind the counter, then the counter in front of them
    const npc = this.b.npcs[this.npcId]!;
    const blink = `${npc.sprite}_blink`;
    const kx = DOOR * T + T / 2;
    const ky = 4 * T + 2;
    this.keeper =
      RICH.motion && this.textures.exists(blink) && (this.b.sprites[blink]?.frames ?? 1) > 1
        ? this.add.sprite(kx, ky, blink, 0)
        : this.add.image(kx, ky, npc.sprite);
    this.keeper.setOrigin(0.5, 1).setDepth(3);
    if (RICH.motion) this.tweens.add({ targets: this.keeper, scaleY: 1.03, duration: 1000, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    this.add.rectangle(T, 5 * T, 5 * T, 4, INK, 0.3).setOrigin(0).setDepth(1.2);
    for (let x = 1; x <= 5; x++) {
      this.at(x === 1 ? 'props/counter_left' : x === 5 ? 'props/counter_right' : 'props/counter', x * T, 4 * T - 2, 4);
      this.block(x, 4);
      this.counter.add(`${x},4`);
    }
    // on the counter: the scale, the stew and the tea it sells, the cat asleep at the end
    this.at('props/scale', 18, 4 * T - 8, 4.1);
    for (const [item, cx] of [['core/herb-stew', 38], ['core/herb-tea', 74]] as const) {
      const ref = this.b.items[item]?.sprite;
      if (ref && this.textures.exists(ref)) this.add.image(cx, 4 * T + 4, ref).setOrigin(0.5, 1).setDepth(4.1);
    }
    if (this.has('props/shop_cat')) this.cat = this.add.sprite(88, 4 * T + 1, this.ref('props/shop_cat'), 0).setOrigin(0.5, 1).setDepth(4.1);

    // the goods on the floor: pears and mushrooms on the left, a herb and the flour on the right
    for (const [name, cx, x] of [['props/pear_barrel', 8, 0], ['props/mushroom_crate', 24, 1], ['props/potted_herb', 88, 5], ['props/flour_sack', 104, 6]] as const) {
      this.stand(name, cx, 7 * T);
      this.block(x, 6);
    }

    // the light: a patch from the window that follows the sun, the stove's glow, dust in the beam
    if (RICH.light) {
      this.light = this.add.graphics().setDepth(1.3).setBlendMode(Phaser.BlendModes.ADD);
      if (this.textures.exists('fx-glow')) {
        this.glow = this.add.image(24 + 25, 36, 'fx-glow').setBlendMode(Phaser.BlendModes.ADD).setDepth(2.1).setScale(1.6);
      }
    }
    if (RICH.motion && this.textures.exists('fx-mote')) {
      this.motes = this.add
        .particles(0, 0, 'fx-mote', {
          x: { min: 6, max: 40 },
          y: { min: 52, max: 96 },
          speedX: { min: 1, max: 3 },
          speedY: { min: -2, max: 2 },
          lifespan: { min: 2500, max: 4500 },
          alpha: { values: [0, 0.6, 0] },
          frequency: 500,
          maxAliveParticles: 8,
        })
        .setDepth(1.4);
    }
    if (RICH.motion && this.textures.exists('fx-smoke')) {
      // steam from the kettle on the stove
      this.add
        .particles(24 + 21, 19, 'fx-smoke', {
          speedY: { min: -6, max: -3 },
          speedX: { min: -1, max: 2 },
          lifespan: { min: 1200, max: 2000 },
          alpha: { values: [0.6, 0.3, 0] },
          frequency: 600,
          maxAliveParticles: 4,
        })
        .setDepth(2.2);
    }
  }

  // ------------------------------------------------------------ the day outside

  /** The window's light on the floor leans with the sun and fades at dusk; the stove's glow takes over. */
  private daylight(s: Session, time: number): void {
    const night = app.world?.darkness ?? 0;
    const hour = Math.floor(minuteOfDay(this.b, s.tick) / 60);
    this.window?.setFrame(night > 0.5 ? 1 : 0);
    if (this.light && hour !== this.lastHour) {
      this.lastHour = hour;
      // morning light falls steep and long to the right, evening light short; two panes of the window
      const lean = 6 + Math.max(0, Math.min(14, 18 - hour));
      const g = this.light.clear();
      const alpha = 0.32 * (1 - night);
      if (alpha > 0.01) {
        g.fillStyle(CREAM, alpha);
        for (const ox of [4, 13]) {
          g.fillPoints([new Phaser.Math.Vector2(ox, 3 * T + 2), new Phaser.Math.Vector2(ox + 7, 3 * T + 2), new Phaser.Math.Vector2(ox + 7 + lean, 3 * T + 40), new Phaser.Math.Vector2(ox + lean, 3 * T + 40)], true);
        }
      }
    }
    if (this.glow) {
      const flicker = 0.5 + 0.5 * Math.sin(time / 170) * Math.sin(time / 430);
      this.glow.setAlpha((0.35 + 0.45 * night) * (0.85 + 0.15 * flicker));
    }
    if (this.motes) this.motes.emitting = night < 0.5;
  }

  // ------------------------------------------------------------ small life

  private animate(time: number): void {
    if (!RICH.motion) return;
    if (this.hearth && time >= this.nextFlame) {
      this.nextFlame = time + 120 + Math.random() * 60;
      this.flame = (this.flame + 1 + Math.floor(Math.random() * 2)) % 3;
      this.hearth.setFrame(this.flame);
    }
    if (this.cat) {
      if (this.catUntil > 0 && time >= this.catUntil) {
        this.catUntil = 0;
        this.cat.setFrame(0);
      } else if (this.catUntil === 0 && time >= this.nextCat) {
        // mostly a slow blink, now and then an ear that flicks
        const ear = Math.random() < 0.3;
        this.cat.setFrame(ear ? 2 : 1);
        this.catUntil = time + (ear ? 220 : 600);
        this.nextCat = time + 2500 + Math.random() * 4000;
      }
    }
    if (this.keeper instanceof Phaser.GameObjects.Sprite) {
      if (this.keeperBlinkUntil > 0 && time >= this.keeperBlinkUntil) {
        this.keeperBlinkUntil = 0;
        this.keeper.setFrame(0);
      } else if (this.keeperBlinkUntil === 0 && time >= this.nextKeeperBlink) {
        this.keeper.setFrame(1);
        this.keeperBlinkUntil = time + 120;
        this.nextKeeperBlink = time + 3000 + Math.random() * 3000;
      }
    }
  }

  // ------------------------------------------------------------ the player

  private frameFor(dir: Dir): { key: string; flip: boolean } {
    return app.world?.playerFrame(dir) ?? { key: '', flip: false };
  }

  private faceFrame(frame?: number): void {
    const { key, flip } = this.frameFor(this.facing);
    if (!key) return;
    const frames = this.b.sprites[key]?.frames ?? 1;
    if (frames === 1) this.player.setTexture(key);
    else this.player.setTexture(key, Math.min(frames - 1, frame ?? (frames >= 3 ? 1 : 0)));
    this.player.setFlipX(flip);
  }

  private placePlayer(): void {
    this.player.setPosition(this.pos[0] * T + T / 2, (this.pos[1] + 1) * T);
    this.player.setDepth((this.pos[1] + 1) * T + 1);
  }

  /** Inside the walls, off the counter and the goods. */
  canWalk(x: number, y: number): boolean {
    return x >= 0 && x < COLS && y >= 0 && y < ROWS && !this.solid.has(`${x},${y}`);
  }

  private canControl(s: Session): boolean {
    return !this.leaving && !s.paused && !s.busy && !app.ui.blocking;
  }

  override update(time: number): void {
    const s = app.session;
    if (!s) return;
    this.animate(time);
    this.daylight(s, time);
    this.walk(s, this.game.loop.delta);
    this.updatePrompt(s);
  }

  private walk(s: Session, delta: number): void {
    if (this.move) {
      this.move.t += delta;
      const k = Math.min(1, this.move.t / STEP_MS);
      const [fx, fy] = this.move.from;
      const [tx, ty] = this.move.to;
      this.player.setPosition(Math.round((fx + (tx - fx) * k) * T + T / 2), Math.round((fy + (ty - fy) * k + 1) * T));
      this.player.setDepth(Math.round((Math.max(fy, ty) + 1) * T + 1));
      this.faceFrame(k < 0.5 ? (this.steps % 2 === 0 ? 0 : 2) : undefined);
      if (k < 1) return;
      const carry = this.move.t - STEP_MS;
      this.pos = [tx, ty];
      this.move = null;
      if (!this.tryStep(s, carry)) this.faceFrame();
      return;
    }
    if (this.canControl(s)) this.tryStep(s, 0);
  }

  private tryStep(s: Session, carry: number): boolean {
    if (!this.canControl(s)) return false;
    const dir = app.controls.direction();
    if (dir !== this.held) this.held = null;
    if (!dir || dir === this.held) return false;
    if (this.facing !== dir) {
      this.facing = dir;
      this.faceFrame();
    }
    const [dx, dy] = DIRS[dir];
    const to: [number, number] = [this.pos[0] + dx, this.pos[1] + dy];
    // out through the door
    if (dir === 'down' && this.pos[0] === DOOR && this.pos[1] === ROWS - 1) {
      this.leave();
      return false;
    }
    if (!this.canWalk(to[0], to[1])) return false;
    this.steps++;
    this.move = { from: [this.pos[0], this.pos[1]], to, t: carry };
    return true;
  }

  /** The tile in front of the player, if it is the counter: talking across it reaches the keeper. */
  private facesCounter(): boolean {
    const [dx, dy] = DIRS[this.facing];
    return this.counter.has(`${this.pos[0] + dx},${this.pos[1] + dy}`);
  }

  private updatePrompt(s: Session): void {
    const show = this.canControl(s) && !this.move && this.facesCounter();
    const label = show ? `Talk to ${this.b.npcs[this.npcId]?.name ?? this.npcId}` : this.atDoor() && this.canControl(s) && !this.move ? 'Leave the shop' : '';
    if (label !== this.prompt) {
      this.prompt = label;
      app.ui.setPrompt(label);
    }
    this.marker.setVisible(show);
    if (show) this.marker.setPosition(this.keeper.x, this.keeper.y - this.keeper.height - 1);
  }

  private atDoor(): boolean {
    return this.pos[0] === DOOR && this.pos[1] === ROWS - 1;
  }

  /** The A button inside: talk across the counter, or step out from the door. */
  interact(): void {
    const s = app.session;
    if (!s || this.move || !this.canControl(s)) return;
    if (this.facesCounter()) void app.ui.talk(this.npcId);
    else if (this.atDoor()) this.leave();
  }

  leave(): void {
    if (this.leaving) return;
    this.leaving = true;
    app.ui.setPrompt('');
    const done = () => {
      this.scene.stop();
      this.onLeave();
    };
    if (RICH.light) {
      this.cameras.main.fadeOut(200, 27, 26, 46);
      this.cameras.main.once('camerafadeoutcomplete', done);
    } else done();
  }

  // ------------------------------------------------------------ view

  private fit(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    const roomW = COLS * T + 2 * RIM;
    const roomH = ROWS * T + 2 * RIM;
    // the whole room on screen, as large as whole pixels allow, never smaller than 2x
    const zoom = Math.max(2, Math.min(6, Math.floor(Math.min(w / (roomW + 8), h / (roomH + 24)))));
    const cam = this.cameras.main;
    cam.setZoom(zoom);
    cam.centerOn((COLS * T) / 2, (ROWS * T) / 2);
    cam.setRoundPixels(true);
  }
}
