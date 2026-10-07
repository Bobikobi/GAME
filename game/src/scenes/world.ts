/**
 * The overworld: the map, everything standing on it, and the player walking
 * tile by tile. Walking uses the kernel's own walkable() so the client never
 * lets a player stand where the kernel would refuse an action; on top of it,
 * a plant or stone that is ready blocks the way until it is gathered.
 */
import * as Phaser from 'phaser';
import {
  type Bundle,
  type GameEvent,
  type Grade,
  type Slot,
  campTile,
  findSlot,
  hourOf,
  inRect,
  makeWalkable,
  minuteOfDay,
  npcTile,
} from '@game/kernel';
import { app } from '../app';
import { sound, type SfxId } from '../audio';
import { DIG_SPOT_SPRITE, FOG_SPRITE, STEP_MS, T } from '../config';
import { DIRS, type Dir } from '../input';
import { ECHOES, WHISPERS, pickOf } from '../lore';
import { emptySlots, slotContent } from '../places';
import type { Session } from '../session';
import { hintDistance, itemName } from '../text';
import type { WorkKind } from '../ui/ui';

const DEPTH = { ground: 0, restore: 1, flat: 2, dig: 3, mist: 8000, fog: 9000, motes: 9100, shade: 9500, glow: 9600, fx: 9800, marker: 9850 };
const NEIGHBOURS: readonly [number, number][] = [
  [0, -1], [1, 0], [0, 1], [-1, 0], [1, -1], [1, 1], [-1, 1], [-1, -1],
];
/** One swing of the arm while working. */
const SWING_MS = 520;
/** Signatures show over signs this close to the player, in tiles. */
const SIGN_REACH = 5;
const PALETTE = { ink: 0x1b1a2e, cream: 0xebd3a2, paper: 0xf5f4ef, green3: 0x84c450, green4: 0xc8e88a, wood2: 0x9e6b3c, wood: 0x6e4226, yellow: 0xf8de62, red2: 0xe2533f, grey2: 0x8f94a8 };

export interface Target {
  label: string;
  run: () => void;
  /** the tile the marker points at, and how tall the thing standing there is */
  tile: [number, number];
  top: number;
}

interface Move {
  from: [number, number];
  to: [number, number];
  t: number;
}

interface SignSpot {
  slot: string;
  x: number;
  y: number;
  label: HTMLElement;
}

/** A page element pinned to a point of the world, moved with the camera. */
interface Pinned {
  el: HTMLElement;
  x: number;
  y: number;
}

export class WorldScene extends Phaser.Scene {
  private b!: Bundle;
  private walkable!: ReturnType<typeof makeWalkable>;
  private session: Session | undefined;
  private unbind: (() => void)[] = [];
  private ground!: Phaser.GameObjects.Image;
  private waterFrame = 0;
  private player!: Phaser.GameObjects.Sprite;
  private shade!: Phaser.GameObjects.Rectangle;
  private bar!: Phaser.GameObjects.Graphics;
  private marker!: Phaser.GameObjects.Image;
  private mist!: Phaser.GameObjects.TileSprite;
  private motes!: Phaser.GameObjects.Particles.ParticleEmitter;
  private flies!: Phaser.GameObjects.Particles.ParticleEmitter;
  private bursts = new Map<string, Phaser.GameObjects.Particles.ParticleEmitter>();
  private vignette: Phaser.Filters.Vignette | undefined;
  private nodes = new Map<string, Phaser.GameObjects.Image>();
  private digs = new Map<string, Phaser.GameObjects.Image>();
  private restoreArt = new Map<string, Phaser.GameObjects.Image[]>();
  private campArt = new Map<string, Phaser.GameObjects.Image>();
  private fogs: Phaser.GameObjects.TileSprite[] = [];
  private signs = new Map<string, string>();
  private signSpots: SignSpot[] = [];
  private notes = new Map<string, { text: string; name: string; top: number }>();
  private tops = new Map<string, number>();
  private npcAt = new Map<string, string>();
  private nodeAt = new Map<string, string>();
  private empty: Slot[] = [];
  private eyeSpots: [number, number][] = [];
  private eyes = new Set<Phaser.GameObjects.Image>();
  private labels!: HTMLElement;
  private pinned = new Set<Pinned>();
  private move: Move | null = null;
  private steps = 0;
  private busyFrom = 0;
  private busyMs = 0;
  private work: { node: string; kind: WorkKind } | null = null;
  private swingUntil = 0;
  private nextSwing = 0;
  private refreshIn = 0;
  private prompt = '';
  private hinted = new Set<string>();
  private attractT = 0;
  private night = 0;
  private wasNight: boolean | undefined;
  private nextEyes = 0;
  private nextWhisper = 0;

  constructor() {
    super('world');
  }

  create(): void {
    this.b = app.bundle;
    this.walkable = makeWalkable(this.b);
    this.labels = document.createElement('div');
    this.labels.className = 'world-labels';
    app.ui.root.prepend(this.labels);
    this.makeFx();
    this.buildGround();
    this.buildProps();
    this.buildNodes();
    this.buildNpcs();
    this.buildRestores();
    this.buildCamp();
    this.buildFog();
    this.buildSigns();
    this.buildAtmosphere();
    this.player = this.add.sprite(0, 0, this.playerFrame('down').key, 1).setOrigin(0.5, 1).setVisible(false);
    this.bar = this.add.graphics().setDepth(DEPTH.fx);
    this.marker = this.add.image(0, 0, 'fx-arrow').setOrigin(0.5, 1).setDepth(DEPTH.marker).setVisible(false);
    this.tweens.add({ targets: this.marker, displayOriginY: 7, duration: 380, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    this.shade = this.add.rectangle(0, 0, 10, 10, 0x172a52, 0).setOrigin(0).setScrollFactor(0).setDepth(DEPTH.shade);
    const cam = this.cameras.main;
    cam.setBounds(0, 0, this.b.map.width * T, this.b.map.height * T);
    cam.setRoundPixels(true);
    this.addFilters(cam);
    this.scale.on('resize', () => this.fit());
    this.fit();
    this.time.addEvent({ delay: 480, loop: true, callback: () => this.flipWater() });
    sound.installUnlock();
    sound.music('valley', 1500);
    app.world = this;
    app.ui.worldReady();
  }

  // ------------------------------------------------------------ building

  /** Tiny pixel textures for dust, sparks, motes, eyes and the target arrow. */
  private makeFx(): void {
    const g = this.add.graphics();
    const make = (key: string, w: number, hgt: number, draw: () => void) => {
      g.clear();
      draw();
      g.generateTexture(key, w, hgt);
    };
    const px = (color: number, x: number, y: number, w = 1, hh = 1) => g.fillStyle(color, 1).fillRect(x, y, w, hh);
    make('fx-dust', 3, 3, () => {
      px(PALETTE.cream, 1, 0);
      px(PALETTE.cream, 0, 1, 3);
      px(PALETTE.cream, 1, 2);
    });
    make('fx-leaf', 2, 2, () => px(PALETTE.green3, 0, 0, 2, 2));
    make('fx-chip', 2, 1, () => px(PALETTE.wood2, 0, 0, 2));
    make('fx-dirt', 2, 2, () => px(PALETTE.wood, 0, 0, 2, 2));
    make('fx-spark', 1, 1, () => px(PALETTE.yellow, 0, 0));
    make('fx-mote', 1, 1, () => px(PALETTE.paper, 0, 0));
    make('fx-fly', 2, 2, () => px(PALETTE.green4, 0, 0, 2, 2));
    make('fx-eye', 4, 1, () => {
      px(PALETTE.red2, 0, 0);
      px(PALETTE.red2, 3, 0);
    });
    make('fx-arrow', 7, 5, () => {
      px(PALETTE.ink, 0, 0, 7);
      px(PALETTE.ink, 0, 1);
      px(PALETTE.yellow, 1, 1, 5);
      px(PALETTE.ink, 6, 1);
      px(PALETTE.ink, 1, 2);
      px(PALETTE.yellow, 2, 2, 3);
      px(PALETTE.ink, 5, 2);
      px(PALETTE.ink, 2, 3);
      px(PALETTE.yellow, 3, 3);
      px(PALETTE.ink, 4, 3);
      px(PALETTE.ink, 3, 4);
    });
    g.destroy();
  }

  private buildGround(): void {
    const m = this.b.map;
    for (const frame of [0, 1]) {
      const tex = this.textures.createCanvas(`ground-${frame}`, m.width * T, m.height * T);
      if (!tex) continue;
      for (let y = 0; y < m.height; y++) {
        const row = m.ground[y] ?? '';
        for (let x = 0; x < m.width; x++) {
          const tile = m.legend[row[x] ?? ''];
          const info = tile && this.b.sprites[tile.sprite];
          if (!tile || !info) continue;
          tex.drawFrame(tile.sprite, info.frames > 1 ? frame % info.frames : undefined, x * T, y * T, false);
        }
      }
      tex.refresh();
    }
    this.ground = this.add.image(0, 0, 'ground-0').setOrigin(0).setDepth(DEPTH.ground);
    // eyes watch from the edge of the forest and from the rubble, never from open ground
    for (let y = 1; y < m.height - 1; y++) {
      for (let x = 1; x < m.width - 1; x++) {
        const here = m.ground[y]?.[x];
        if (here !== 'T' && here !== '%') continue;
        const open = DIRS_4.some(([dx, dy]) => {
          const t = m.legend[m.ground[y + dy]?.[x + dx] ?? ''];
          return t && !t.solid;
        });
        if (open) this.eyeSpots.push([x, y]);
      }
    }
  }

  private flipWater(): void {
    this.waterFrame = 1 - this.waterFrame;
    this.ground.setTexture(`ground-${this.waterFrame}`);
  }

  private buildProps(): void {
    for (const p of this.b.map.props) {
      const info = this.b.sprites[p.sprite];
      if (!info) continue;
      const bottom = (p.y + p.h) * T;
      const img = this.add.image((p.x + p.w / 2) * T, bottom, p.sprite).setOrigin(0.5, 1);
      img.setDepth(p.solid ? bottom : DEPTH.flat);
      for (let y = p.y; y < p.y + p.h; y++) {
        for (let x = p.x; x < p.x + p.w; x++) {
          if (p.sign) this.signs.set(key(x, y), p.sign);
          if (p.note) this.notes.set(key(x, y), { text: p.note, name: spriteName(p.sprite), top: info.h });
          this.tops.set(key(x, y), info.h);
        }
      }
    }
  }

  private buildNodes(): void {
    for (const [id, inst] of Object.entries(this.b.instances)) {
      const cx = inst.x * T + T / 2;
      const bottom = (inst.y + 1) * T;
      if (inst.kind === 'resource') {
        const r = this.b.resources[inst.source];
        if (!r) continue;
        this.nodes.set(id, this.add.image(cx, bottom, r.sprite).setOrigin(0.5, 1).setDepth(bottom));
      } else {
        this.digs.set(id, this.add.image(cx, bottom, DIG_SPOT_SPRITE).setOrigin(0.5, 1).setDepth(DEPTH.dig).setAlpha(0));
      }
      this.nodeAt.set(key(inst.x, inst.y), id);
    }
  }

  private buildNpcs(): void {
    for (const [id, npc] of Object.entries(this.b.npcs)) {
      const t = npcTile(this.b, id);
      if (!t) continue;
      const bottom = (t[1] + 1) * T;
      const img = this.add.image(t[0] * T + T / 2, bottom, npc.sprite).setOrigin(0.5, 1).setDepth(bottom);
      // a slow breath so people read as alive
      this.tweens.add({ targets: img, scaleY: 1.04, duration: 900 + (id.length % 5) * 120, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      this.npcAt.set(key(t[0], t[1]), id);
      this.tops.set(key(t[0], t[1]), this.b.sprites[npc.sprite]?.h ?? 24);
    }
  }

  private buildRestores(): void {
    for (const [id, r] of Object.entries(this.b.restores)) {
      const slot = findSlot(this.b.map, r.place.slot);
      const info = this.b.sprites[r.before];
      if (!slot || !info) continue;
      const art: Phaser.GameObjects.Image[] = [];
      if (info.w === T && info.h === T) {
        for (let y = slot.y; y < slot.y + slot.h; y++) {
          for (let x = slot.x; x < slot.x + slot.w; x++) {
            art.push(this.add.image(x * T, y * T, r.before).setOrigin(0).setDepth(DEPTH.restore));
          }
        }
      } else {
        const bottom = (slot.y + slot.h) * T;
        art.push(this.add.image((slot.x + slot.w / 2) * T, bottom, r.before).setOrigin(0.5, 1).setDepth(bottom));
      }
      this.restoreArt.set(id, art);
    }
  }

  private buildCamp(): void {
    for (const [id, c] of Object.entries(this.b.camps)) {
      const t = campTile(this.b, c.slot);
      if (!t) continue;
      const bottom = (t[1] + 1) * T;
      this.campArt.set(id, this.add.image(t[0] * T + T / 2, bottom, c.sprite).setOrigin(0.5, 1).setDepth(bottom).setAlpha(0));
    }
  }

  private buildFog(): void {
    this.empty = emptySlots(this.b);
    for (const s of this.empty) {
      // two thin layers drifting against each other read as mist, not as clouds
      for (const [alpha, offset] of [[0.55, 0], [0.45, 16]] as const) {
        const fog = this.add.tileSprite(s.x * T, s.y * T, s.w * T, s.h * T, FOG_SPRITE).setOrigin(0).setDepth(DEPTH.fog).setAlpha(alpha);
        fog.setTilePosition(offset, offset);
        this.fogs.push(fog);
      }
    }
  }

  /**
   * Every sign on the map, plus one for each place a creator filled where the
   * map has none. Above each, the creator's signature, shown without a click.
   */
  private buildSigns(): void {
    const covered = new Set(this.signs.values());
    for (const p of this.b.map.props) {
      if (p.sign) this.signSpots.push({ slot: p.sign, x: p.x + p.w / 2, y: p.y, label: this.signatureEl(p.sign) });
    }
    for (const slot of this.b.map.slots) {
      const content = slotContent(this.b, slot.id);
      if (!content || content.creator === 'core' || covered.has(slot.id)) continue;
      const at = this.freeTileBeside(slot);
      if (!at) continue;
      this.add.image(at[0] * T + T / 2, (at[1] + 1) * T, SIGN_SPRITE).setOrigin(0.5, 1).setDepth(DEPTH.flat);
      this.signs.set(key(at[0], at[1]), slot.id);
      this.tops.set(key(at[0], at[1]), T);
      this.signSpots.push({ slot: slot.id, x: at[0] + 0.5, y: at[1], label: this.signatureEl(slot.id) });
    }
    for (const spot of this.signSpots) this.labels.append(spot.label);
  }

  /** A tile next to a slot where a sign can stand without blocking anything. */
  private freeTileBeside(slot: Slot): [number, number] | undefined {
    const view = { camp: [], restored: [] };
    const candidates: [number, number][] = [];
    for (let y = slot.y; y < slot.y + slot.h; y++) candidates.push([slot.x - 1, y], [slot.x + slot.w, y]);
    for (let x = slot.x; x < slot.x + slot.w; x++) candidates.push([x, slot.y - 1], [x, slot.y + slot.h]);
    return candidates.find(([x, y]) => this.walkable(x, y, view) && !this.nodeAt.has(key(x, y)) && !this.signs.has(key(x, y)) && !this.tops.has(key(x, y)));
  }

  private signatureEl(slotId: string): HTMLElement {
    const content = slotContent(this.b, slotId);
    const el = document.createElement('div');
    if (!content) {
      el.className = 'signature sig-ink empty';
      el.textContent = 'Awaiting restoration';
      return el;
    }
    const profile = this.b.creators[content.creator];
    const sig = profile?.signature;
    el.className = `signature sig-${sig?.style ?? 'ink'}`;
    if (sig?.glyph && sig.glyph !== 'none') {
      const glyph = document.createElement('i');
      glyph.className = `glyph g-${sig.glyph}`;
      el.append(glyph);
    }
    el.append(sig?.text ?? profile?.name ?? content.creator);
    return el;
  }

  /** Mist over the whole valley, dust in the light, fireflies after dark. */
  private buildAtmosphere(): void {
    const w = this.b.map.width * T;
    const hgt = this.b.map.height * T;
    this.mist = this.add.tileSprite(0, 0, w, hgt, FOG_SPRITE).setOrigin(0).setDepth(DEPTH.mist).setAlpha(0.1).setTileScale(2);
    const area = new Phaser.Geom.Rectangle(0, 0, w, hgt);
    this.motes = this.add
      .particles(0, 0, 'fx-mote', {
        emitZone: { type: 'random', source: area, quantity: 1 },
        lifespan: { min: 4000, max: 7000 },
        speedX: { min: -3, max: 3 },
        speedY: { min: -6, max: -2 },
        alpha: { values: [0, 0.65, 0] },
        frequency: 70,
      })
      .setDepth(DEPTH.motes);
    this.flies = this.add
      .particles(0, 0, 'fx-fly', {
        emitZone: { type: 'random', source: area, quantity: 1 },
        lifespan: { min: 3000, max: 5000 },
        speedX: { min: -5, max: 5 },
        speedY: { min: -5, max: 5 },
        alpha: { values: [0, 1, 0.2, 1, 0] },
        frequency: 120,
        blendMode: 'ADD',
        emitting: false,
      })
      .setDepth(DEPTH.glow);
  }

  /** An old, worn picture: a little less colour, a dark frame that closes in at night. WebGL only. */
  private addFilters(cam: Phaser.Cameras.Scene2D.Camera): void {
    if (this.renderer.type !== Phaser.WEBGL) return;
    try {
      const cm = cam.filters.external.addColorMatrix();
      cm.colorMatrix.saturate(-0.16).contrast(0.07, true);
      this.vignette = cam.filters.external.addVignette(0.5, 0.5, 0.8, 0.3, PALETTE.ink);
    } catch {
      // a renderer without filters still plays; it only looks newer
      this.vignette = undefined;
    }
  }

  // ------------------------------------------------------------ session

  /** Show this session's world. Called for a new game and for a loaded one. */
  bind(session: Session): void {
    for (const off of this.unbind) off();
    this.session = session;
    this.move = null;
    this.work = null;
    this.hinted.clear();
    this.unbind = [
      session.on('busy', ({ ms }) => {
        this.busyFrom = session.tick;
        this.busyMs = ms;
        this.nextSwing = 0;
      }),
      session.on('events', (events) => this.celebrate(events)),
      session.on('change', () => this.refresh()),
    ];
    this.player.setVisible(true);
    this.placePlayer(session.pos[0], session.pos[1]);
    this.faceFrame();
    this.cameras.main.startFollow(this.player, true);
    this.wasNight = undefined;
    this.refresh();
  }

  private placePlayer(x: number, y: number): void {
    this.player.setPosition(x * T + T / 2, (y + 1) * T);
    this.player.setDepth((y + 1) * T + 1);
  }

  /** The starter's sprite for a direction, in the look the player picked. */
  private playerFrame(dir: Dir, pose: 'walk' | 'work' = 'walk'): { key: string; flip: boolean } {
    const p = this.session?.state.player;
    const starter = p ? this.b.starters[p.starter] : undefined;
    const first = Object.values(this.b.starters)[0];
    const base = (p?.look === 1 && starter?.sprite_alt) || starter?.sprite || first?.sprite || '';
    const stem = pose === 'work' ? base.replace(/_down$/, '_work_down') : base;
    const of = (d: string) => stem.replace(/_down$/, `_${d}`);
    const has = (k: string) => k in this.b.sprites;
    if (pose === 'work' && !has(stem)) return { key: '', flip: false };
    if (dir === 'down') return { key: stem, flip: false };
    if (dir === 'right' && !has(of('right'))) {
      if (has(of('left'))) return { key: of('left'), flip: true };
      return pose === 'work' ? { key: '', flip: false } : { key: stem, flip: false };
    }
    if (has(of(dir))) return { key: of(dir), flip: false };
    return pose === 'work' ? { key: '', flip: false } : { key: stem, flip: false };
  }

  private faceFrame(frame?: number): void {
    const s = this.session;
    if (!s) return;
    const { key: k, flip } = this.playerFrame(s.facing);
    const frames = this.b.sprites[k]?.frames ?? 1;
    if (frames === 1) this.player.setTexture(k);
    else this.player.setTexture(k, Math.min(frames - 1, frame ?? (frames >= 3 ? 1 : 0)));
    this.player.setFlipX(flip);
  }

  /** The work pose: arm up (frame 0) or down on the thing (frame 1). Falls back to a bob when the art is missing. */
  private workFrame(down: boolean): void {
    const s = this.session;
    if (!s) return;
    const { key: k, flip } = this.playerFrame(s.facing, 'work');
    if (!k) return this.faceFrame(down ? 0 : 2);
    this.player.setTexture(k, down ? 1 : 0);
    this.player.setFlipX(flip);
  }

  /** Redraw what depends on the state: bridges, camp, plants, dig spots. */
  refresh(): void {
    const s = this.session;
    if (!s) return;
    const p = s.state.player;
    for (const [id, art] of this.restoreArt) {
      const r = this.b.restores[id]!;
      const done = p.restored.includes(id);
      for (const img of art) img.setTexture(done ? r.after : r.before);
    }
    for (const [id, img] of this.campArt) {
      const built = p.camp.includes(id);
      const taken = !built && p.camp.some((c) => this.b.camps[c]?.slot === this.b.camps[id]?.slot);
      this.tweens.killTweensOf(img);
      if (built) img.setAlpha(1);
      else if (taken) img.setAlpha(0);
      else {
        img.setAlpha(0.3);
        this.tweens.add({ targets: img, alpha: 0.6, duration: 800, yoyo: true, repeat: -1 });
      }
    }
    this.refreshNodes();
  }

  private ready(s: Session, id: string): boolean {
    return (s.state.nodes[id]?.readyAt ?? 0) <= s.tick;
  }

  private refreshNodes(): void {
    const s = this.session;
    if (!s) return;
    const hour = hourOf(this.b, s.tick);
    for (const [id, img] of this.nodes) {
      const r = this.b.resources[this.b.instances[id]!.source]!;
      const ready = this.ready(s, id);
      const inHours = !r.hours || (r.hours[0] < r.hours[1] ? hour >= r.hours[0] && hour < r.hours[1] : hour >= r.hours[0] || hour < r.hours[1]);
      // a gathered node lies flat and faded: the way over it is open
      if (!ready && r.sprite_empty) img.setTexture(r.sprite_empty).setAlpha(0.8).setDepth(DEPTH.flat);
      else if (!ready) img.setTexture(r.sprite).setAlpha(0.3).setDepth(DEPTH.flat);
      else img.setTexture(r.sprite).setAlpha(inHours ? 1 : 0.55).setDepth(img.y);
    }
    const reach = hintDistance(this.b, s.state);
    for (const [id, img] of this.digs) {
      const inst = this.b.instances[id]!;
      const d = Math.max(Math.abs(inst.x - s.pos[0]), Math.abs(inst.y - s.pos[1]));
      const want = d > reach ? 0 : this.ready(s, id) ? 1 : 0.3;
      img.setAlpha(img.alpha + (want - img.alpha) * 0.5);
    }
  }

  // ------------------------------------------------------------ frame loop

  override update(time: number, delta: number): void {
    this.fogs.forEach((fog, i) => (fog.tilePositionX += delta * (i % 2 === 0 ? 0.006 : -0.004)));
    this.mist.tilePositionX += delta * 0.002;
    this.mist.tilePositionY += delta * 0.0008;
    this.placePinned();
    const s = this.session;
    if (!s || !s.started) {
      this.attract(delta);
      return;
    }
    s.advance(delta);
    this.refreshIn -= delta;
    if (this.refreshIn <= 0) {
      this.refreshIn = 250;
      this.refreshNodes();
      this.shadeFor(s);
      this.showSignatures(s);
    }
    this.walk(s, delta);
    this.drawBusy(s, time);
    this.updatePrompt(s);
    this.haunt(s, time);
  }

  private attract(delta: number): void {
    this.attractT += delta;
    const cam = this.cameras.main;
    const cx = 22 * T + Math.sin(this.attractT / 9000) * 10 * T;
    const cy = 15 * T + Math.cos(this.attractT / 13000) * 5 * T;
    cam.centerOn(Math.round(cx), Math.round(cy));
  }

  private canControl(s: Session): boolean {
    return !s.paused && !s.busy && !app.ui.blocking;
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
      s.pos = [tx, ty];
      this.move = null;
      this.arrive(s);
      if (!this.tryStep(s, carry)) this.faceFrame();
      return;
    }
    if (this.canControl(s)) this.tryStep(s, 0);
  }

  /** Start walking one tile if a direction is held. Returns true if moving. */
  private tryStep(s: Session, carry: number): boolean {
    if (!this.canControl(s)) return false;
    const dir = app.controls.direction();
    if (!dir) return false;
    if (s.facing !== dir) {
      s.facing = dir;
      this.faceFrame();
    }
    const [dx, dy] = DIRS[dir];
    const to: [number, number] = [s.pos[0] + dx, s.pos[1] + dy];
    if (!this.canWalk(s, to[0], to[1])) return false;
    this.steps++;
    this.move = { from: [s.pos[0], s.pos[1]], to, t: carry };
    return true;
  }

  /** The kernel's rule, and a plant or stone that is ready stands in the way. */
  canWalk(s: Session, x: number, y: number): boolean {
    if (!this.walkable(x, y, s.state.player)) return false;
    const node = this.nodeAt.get(key(x, y));
    return !(node && this.b.instances[node]?.kind === 'resource' && this.ready(s, node));
  }

  private arrive(s: Session): void {
    const [x, y] = s.pos;
    for (const slot of this.b.map.slots) {
      if (!inRect(x, y, slot)) continue;
      if (slot.kind === 'area' && !s.state.player.visited.includes(slot.id)) {
        s.act({ t: 'visit', slot: slot.id, at: [x, y] });
      }
      if (slot.kind === 'ruin' && !this.hinted.has(slot.id)) {
        const t = Object.values(this.b.treasures).find((d) => d.place.slot === slot.id);
        if (t) {
          this.hinted.add(slot.id);
          app.ui.toast(`Hint: ${t.hint}`, 'info');
        }
      }
    }
    this.refreshNodes();
  }

  // ------------------------------------------------------------ day, night and the things in the dark

  private shadeFor(s: Session): void {
    const m = minuteOfDay(this.b, s.tick) / 60;
    // dark from 21:00 to 4:00, fading over two hours on each side
    this.night = m >= 21 || m < 4 ? 1 : m >= 19 ? (m - 19) / 2 : m < 6 ? (6 - m) / 2 : 0;
    this.shade.setFillStyle(0x172a52, 0.5 * this.night);
    this.mist.setAlpha(0.08 + 0.16 * this.night);
    if (this.vignette) {
      this.vignette.strength = 0.3 + 0.3 * this.night;
      this.vignette.radius = 0.8 - 0.15 * this.night;
    }
    const isNight = this.night >= 0.5;
    if (isNight !== this.wasNight) {
      this.wasNight = isNight;
      sound.music(isNight ? 'night' : 'valley', 4000);
      sound.ambience(isNight ? 'night' : 'day');
      if (isNight) {
        this.flies.start();
        this.motes.stop();
      } else {
        this.flies.stop();
        this.motes.start();
      }
    }
  }

  /** At night: eyes at the edge of the forest that close when you come near, and whispers by the ruins. */
  private haunt(s: Session, time: number): void {
    const [px, py] = s.pos;
    for (const eye of this.eyes) {
      const ex = Math.floor(eye.x / T);
      const ey = Math.floor(eye.y / T);
      if (Math.max(Math.abs(ex - px), Math.abs(ey - py)) <= 3 && !eye.getData('leaving')) {
        eye.setData('leaving', true);
        this.tweens.killTweensOf(eye);
        this.tweens.add({ targets: eye, alpha: 0, duration: 140, onComplete: () => this.dropEye(eye) });
      }
    }
    if (this.night < 0.6 || app.ui.blocking) return;
    if (time >= this.nextEyes) {
      this.nextEyes = time + 5000 + Math.random() * 7000;
      if (this.eyes.size < 2) this.openEyes(px, py);
    }
    if (time >= this.nextWhisper) {
      this.nextWhisper = time + 18_000 + Math.random() * 17_000;
      this.whisper(px, py);
    }
  }

  private openEyes(px: number, py: number): void {
    const view = this.cameras.main.worldView;
    const spots = this.eyeSpots.filter(([x, y]) => {
      const d = Math.max(Math.abs(x - px), Math.abs(y - py));
      return d >= 5 && d <= 9 && view.contains(x * T + T / 2, y * T + T / 2);
    });
    if (spots.length === 0) return;
    const [x, y] = pickOf(spots);
    const eye = this.add.image(x * T + 4 + Math.floor(Math.random() * 8), y * T + 5 + Math.floor(Math.random() * 6), 'fx-eye').setOrigin(0).setDepth(DEPTH.glow).setAlpha(0);
    this.eyes.add(eye);
    const hold = 1500 + Math.random() * 2000;
    this.tweens.chain({
      targets: eye,
      tweens: [
        { alpha: 0.9, duration: 400 },
        { alpha: 0, duration: 90, delay: hold / 2, yoyo: true },
        { alpha: 0, duration: 500, delay: hold / 2 },
      ],
      onComplete: () => this.dropEye(eye),
    });
  }

  private dropEye(eye: Phaser.GameObjects.Image): void {
    this.eyes.delete(eye);
    eye.destroy();
  }

  private whisper(px: number, py: number): void {
    const near = [...this.b.map.slots.filter((s) => s.kind === 'ruin'), ...this.empty]
      .map((slot) => ({ slot, d: Math.max(Math.abs(slot.x + slot.w / 2 - px), Math.abs(slot.y + slot.h / 2 - py)) }))
      .filter((n) => n.d <= 9)
      .sort((a, b) => a.d - b.d)[0];
    if (!near) return;
    const { slot } = near;
    const wx = (slot.x + Math.random() * slot.w) * T;
    const wy = (slot.y + Math.random() * slot.h) * T;
    const pan = Math.max(-0.8, Math.min(0.8, (wx / T - px) / 8));
    sound.sfx('whisper', { pan });
    const el = document.createElement('div');
    el.className = 'whisper';
    el.textContent = pickOf(WHISPERS);
    this.pin(el, wx, wy, 3600);
  }

  // ------------------------------------------------------------ page elements over the world

  private worldToPage(x: number, y: number): { x: number; y: number } {
    const cam = this.cameras.main;
    return { x: (x - cam.worldView.x) * cam.zoom, y: (y - cam.worldView.y) * cam.zoom };
  }

  /** Shows a page element over a world point for a while. */
  private pin(el: HTMLElement, x: number, y: number, ms: number): void {
    const p: Pinned = { el, x, y };
    this.labels.append(el);
    this.pinned.add(p);
    this.placePinned();
    window.setTimeout(() => {
      this.pinned.delete(p);
      el.remove();
    }, ms);
  }

  private placePinned(): void {
    for (const p of this.pinned) {
      const at = this.worldToPage(p.x, p.y);
      p.el.style.transform = `translate(${Math.round(at.x)}px, ${Math.round(at.y)}px)`;
    }
    for (const spot of this.signSpots) {
      if (!spot.label.classList.contains('on')) continue;
      const at = this.worldToPage(spot.x * T, spot.y * T - 2);
      spot.label.style.transform = `translate(${Math.round(at.x)}px, ${Math.round(at.y)}px)`;
    }
  }

  private showSignatures(s: Session): void {
    const blocked = app.ui.blocking;
    for (const spot of this.signSpots) {
      const d = Math.max(Math.abs(spot.x - 0.5 - s.pos[0]), Math.abs(spot.y - s.pos[1]));
      spot.label.classList.toggle('on', !blocked && d <= SIGN_REACH);
    }
  }

  // ------------------------------------------------------------ working

  /** One beat of a minigame: the arm comes down, the thing shakes and sounds, dust flies. */
  beat(nodeId: string, kind: WorkKind, grade: Grade): void {
    const s = this.session;
    if (!s) return;
    this.work = { node: nodeId, kind };
    this.faceNode(s, nodeId);
    this.workFrame(true);
    this.swingUntil = this.time.now + 160;
    this.impact(nodeId, kind, grade);
  }

  private faceNode(s: Session, nodeId: string): void {
    const inst = this.b.instances[nodeId];
    if (!inst) return;
    const dx = inst.x - s.pos[0];
    const dy = inst.y - s.pos[1];
    if (dx === 0 && dy === 0) return;
    const dir: Dir = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
    s.facing = dir;
  }

  private impact(nodeId: string, kind: WorkKind, grade?: Grade): void {
    const inst = this.b.instances[nodeId];
    if (!inst) return;
    const x = inst.x * T + T / 2;
    const y = inst.y * T + T * 0.6;
    const at = this.worldToPage(x, y);
    const pan = Math.max(-0.8, Math.min(0.8, (at.x / Math.max(1, this.scale.width) - 0.5) * 1.2));
    sound.sfx(WORK_SOUND[kind], { pan, gain: grade === 0 ? 0.6 : 1 });
    if (grade === 0) sound.sfx('miss', { pan, gain: 0.5 });
    if (grade === 4) sound.sfx('perfect', { pan });
    this.burst(WORK_DUST[kind], x, y, grade === 0 ? 3 : 7);
    if (grade !== undefined && grade >= 3) this.burst('fx-spark', x, y - 4, grade === 4 ? 10 : 4);
    const img = this.nodes.get(nodeId) ?? this.digs.get(nodeId);
    if (img) {
      this.tweens.killTweensOf(img);
      const x0 = inst.x * T + T / 2;
      img.x = x0;
      this.tweens.add({ targets: img, x: x0 + (kind === 'pick' ? 0 : 1), scaleY: kind === 'pick' ? 0.92 : 1, duration: 50, yoyo: true, repeat: 1, onComplete: () => img.setX(x0).setScale(1) });
    }
  }

  private burst(texture: string, x: number, y: number, n: number): void {
    let emitter = this.bursts.get(texture);
    if (!emitter) {
      emitter = this.add
        .particles(0, 0, texture, {
          lifespan: { min: 300, max: 600 },
          speed: { min: 14, max: 42 },
          angle: { min: 200, max: 340 },
          gravityY: texture === 'fx-spark' ? 0 : 70,
          alpha: { start: 1, end: 0 },
          scale: { start: 1, end: 0.6 },
          emitting: false,
        })
        .setDepth(DEPTH.fx);
      this.bursts.set(texture, emitter);
    }
    emitter.explode(n, x, y);
  }

  private drawBusy(s: Session, time: number): void {
    this.bar.clear();
    if (!s.busy) {
      if (this.busyMs > 0) {
        this.busyMs = 0;
        this.work = null;
        this.faceFrame();
      } else if (this.swingUntil > 0 && time >= this.swingUntil) {
        // the arm goes back up after a minigame beat
        this.swingUntil = 0;
        if (app.ui.blocking && this.work) this.workFrame(false);
        else this.faceFrame();
      }
      return;
    }
    if (this.busyMs <= 0) return;
    const k = Math.min(1, (s.tick - this.busyFrom) / this.busyMs);
    const x = this.player.x - 9;
    const y = this.player.y - 31;
    this.bar.fillStyle(0x1b1a2e, 1).fillRect(x, y, 18, 4);
    this.bar.fillStyle(0xf8de62, 1).fillRect(x + 1, y + 1, Math.round(16 * k), 2);
    if (!this.work) return this.faceFrame(Math.floor(s.tick / 160) % 2 === 0 ? 0 : 2);
    // a steady rhythm of blows while the work lasts
    const phase = (s.tick - this.busyFrom) % SWING_MS;
    const down = phase > SWING_MS * 0.55;
    this.workFrame(down);
    if (time >= this.nextSwing && down) {
      this.nextSwing = time + SWING_MS * 0.9;
      this.impact(this.work.node, this.work.kind);
    }
  }

  /** A little lift of every new item over the player's head, and a cloud when something is built. */
  private celebrate(events: GameEvent[]): void {
    this.faceFrame();
    let i = 0;
    for (const e of events) {
      if (e.e === 'restore' || e.e === 'build') {
        const slot = e.e === 'restore' ? findSlot(this.b.map, this.b.restores[e.restore]?.place.slot ?? '') : undefined;
        const camp = e.e === 'build' ? campTile(this.b, this.b.camps[e.camp]?.slot ?? 'fire') : undefined;
        const cx = slot ? (slot.x + slot.w / 2) * T : camp ? camp[0] * T + T / 2 : this.player.x;
        const cy = slot ? (slot.y + slot.h / 2) * T : camp ? camp[1] * T + T / 2 : this.player.y;
        this.burst('fx-dust', cx, cy, 18);
        this.burst('fx-spark', cx, cy - 6, 12);
        this.cameras.main.shake(160, 0.004);
      }
      if (e.e !== 'gain') continue;
      const ref = this.b.items[e.item]?.sprite;
      if (!ref || !this.b.sprites[ref]) continue;
      const img = this.add.image(this.player.x, this.player.y - 24, ref).setDepth(DEPTH.fx);
      this.tweens.add({ targets: img, y: img.y - 14, alpha: 0, delay: i * 120, duration: 900, onComplete: () => img.destroy() });
      i++;
    }
  }

  // ------------------------------------------------------------ interaction

  private updatePrompt(s: Session): void {
    const t = this.canControl(s) && !this.move ? this.target(s) : undefined;
    const label = t?.label ?? '';
    if (label !== this.prompt) {
      this.prompt = label;
      app.ui.setPrompt(label);
    }
    this.marker.setVisible(!!t);
    if (t) this.marker.setPosition(t.tile[0] * T + T / 2, (t.tile[1] + 1) * T - t.top - 1);
  }

  /** The A button: act on what the player faces, stands on, or stands next to. */
  interact(): void {
    const s = this.session;
    if (!s || this.move || !this.canControl(s)) return;
    this.target(s)?.run();
  }

  private target(s: Session): Target | undefined {
    const [x, y] = s.pos;
    const [fx, fy] = DIRS[s.facing];
    const order: [number, number][] = [[x + fx, y + fy], [x, y]];
    for (const [dx, dy] of NEIGHBOURS) {
      if (dx === fx && dy === fy) continue;
      order.push([x + dx, y + dy]);
    }
    for (const [tx, ty] of order) {
      const t = this.targetAt(s, tx, ty);
      if (t) return t;
    }
    return undefined;
  }

  private targetAt(s: Session, x: number, y: number): Target | undefined {
    const b = this.b;
    const p = s.state.player;
    const k = key(x, y);
    const tile: [number, number] = [x, y];
    const top = this.tops.get(k) ?? T;
    const npc = this.npcAt.get(k);
    if (npc) return { label: `Talk to ${b.npcs[npc]?.name ?? npc}`, run: () => app.ui.talk(npc), tile, top };
    const nodeId = this.nodeAt.get(k);
    if (nodeId) {
      const inst = b.instances[nodeId]!;
      if (inst.kind === 'resource') {
        const r = b.resources[inst.source]!;
        // a gathered node is only ground until it grows back
        if (this.ready(s, nodeId)) {
          return { label: `Gather ${itemName(b, r.output)}`, run: () => app.ui.gather(nodeId), tile, top: this.b.sprites[r.sprite]?.h ?? T };
        }
      } else {
        const img = this.digs.get(nodeId);
        if (img && img.alpha > 0.2) return { label: 'Dig here', run: () => app.ui.dig(nodeId), tile, top: T };
      }
    }
    for (const [id, c] of Object.entries(b.camps)) {
      const t = campTile(b, c.slot);
      if (!t || t[0] !== x || t[1] !== y) continue;
      if (p.camp.includes(id)) {
        if (c.provides) return { label: `Cook at the ${c.title}`, run: () => app.ui.craft(c.provides!), tile, top: T };
        return { label: c.title, run: () => app.ui.campInfo(id), tile, top: T };
      }
      // the kernel refuses to build under the player's feet, so offer it only from beside the spot
      const underfoot = x === s.pos[0] && y === s.pos[1];
      if (!underfoot && !p.camp.some((o) => b.camps[o]?.slot === c.slot)) return { label: `Build: ${c.title}`, run: () => app.ui.build(id), tile, top: T };
    }
    for (const [id, r] of Object.entries(b.restores)) {
      const slot = findSlot(b.map, r.place.slot);
      if (slot && inRect(x, y, slot) && !p.restored.includes(id)) return { label: `Mend the ${r.title}`, run: () => app.ui.restore(id), tile, top: T };
    }
    const sign = this.signs.get(k);
    if (sign) return { label: 'Read the sign', run: () => app.ui.sign(sign), tile, top };
    const note = this.notes.get(k);
    if (note) return { label: `Look at the ${note.name}`, run: () => app.ui.note(note.text), tile, top: note.top };
    const fog = this.empty.find((slot) => inRect(x, y, slot));
    if (fog && x === s.pos[0] + DIRS[s.facing][0] && y === s.pos[1] + DIRS[s.facing][1]) {
      return { label: `Look at the ${fog.label ?? 'mist'}`, run: () => app.ui.sign(fog.id), tile, top: T };
    }
    return undefined;
  }

  /** What a sign says: who made the place, how much they gave, or an invitation when nobody has yet. */
  signText(slotId: string): SignInfo {
    const b = this.b;
    const slot = findSlot(b.map, slotId);
    const p = this.session?.state.player;
    if (slot?.kind === 'camp') return { title: `${p?.name || 'Your'}'s camp`, lines: ['Build here: a fire first, more later.'], empty: false };
    const content = slotContent(b, slotId);
    if (!content) {
      return {
        title: slot?.label ?? 'An empty place',
        lines: [
          pickOf(ECHOES),
          'Awaiting restoration. Nobody has brought this place back yet. Anyone can - with a short data file, a sprite and an AI tool if you like.',
        ],
        empty: true,
      };
    }
    const lines: string[] = [];
    if (content.kind === 'restore' && p?.restored.includes(content.id)) lines.push(`Mended by ${p.name}.`);
    const profile = b.creators[content.creator];
    const entry = b.board[content.creator];
    const name = profile?.name ?? (content.creator === 'core' ? 'the core team' : content.creator);
    const role = profile?.role ? ` (${profile.role})` : '';
    lines.push(`Added by ${name}${role}.`);
    if (entry) {
      lines.push(`${entry.points} creator points · ~${entry.hours}h invested`);
    }
    if (content.ai_tools?.length) {
      lines.push(`Made with: ${content.ai_tools.join(', ')}.`);
    }
    return {
      title: content.title,
      lines,
      empty: false,
      creator: {
        name,
        role: profile?.role,
        signature: profile?.signature,
        points: entry?.points,
        hours: entry?.hours,
        ai: content.ai_tools ?? [],
      },
    };
  }

  // ------------------------------------------------------------ view

  private fit(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    // about the 15 x 10 tiles of a handheld screen, never smaller than 2x
    const zoom = Math.max(2, Math.min(6, Math.floor(Math.min(w / (15 * T), h / (10 * T)))));
    this.cameras.main.setZoom(zoom);
    this.shade.setSize(w, h);
  }

  /** Where a tile is on the page, for UI that points at the world. */
  screenOf(x: number, y: number): { x: number; y: number } {
    return this.worldToPage(x * T + T / 2, y * T);
  }
}

export interface SignInfo {
  title: string;
  lines: string[];
  empty: boolean;
  creator?: {
    name: string;
    role?: string;
    signature?: { text: string; style: string; glyph?: string };
    points?: number;
    hours?: number;
    ai: string[];
  };
}

const SIGN_SPRITE = 'core/base-kit:props/sign';
const DIRS_4: readonly [number, number][] = [[0, -1], [1, 0], [0, 1], [-1, 0]];

const WORK_SOUND: Record<WorkKind, SfxId> = { strike: 'strike', pick: 'pluck', snap: 'tug', timing: 'rustle', dig: 'dig' };
const WORK_DUST: Record<WorkKind, string> = { strike: 'fx-dust', pick: 'fx-leaf', snap: 'fx-chip', timing: 'fx-leaf', dig: 'fx-dirt' };

function key(x: number, y: number): string {
  return `${x},${y}`;
}

/** "core/base-kit:props/standing_stone" -> "standing stone" */
function spriteName(ref: string): string {
  return (ref.split('/').pop() ?? ref).replace(/_/g, ' ');
}
