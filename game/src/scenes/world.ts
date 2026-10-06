/**
 * The overworld: the map, everything standing on it, and the player walking
 * tile by tile. Walking uses the kernel's own walkable() so the client never
 * lets a player stand where the kernel would refuse an action.
 */
import * as Phaser from 'phaser';
import {
  type Bundle,
  type GameEvent,
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
import { DIG_SPOT_SPRITE, FOG_SPRITE, STEP_MS, T } from '../config';
import { DIRS, type Dir } from '../input';
import { emptySlots, slotContent } from '../places';
import type { Session } from '../session';
import { hintDistance, itemName } from '../text';

const DEPTH = { ground: 0, restore: 1, flat: 2, dig: 3, fog: 9000, shade: 9500, fx: 9800 };
const NEIGHBOURS: readonly [number, number][] = [
  [0, -1], [1, 0], [0, 1], [-1, 0], [1, -1], [1, 1], [-1, 1], [-1, -1],
];

export interface Target {
  label: string;
  run: () => void;
}

interface Move {
  from: [number, number];
  to: [number, number];
  t: number;
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
  private nodes = new Map<string, Phaser.GameObjects.Image>();
  private digs = new Map<string, Phaser.GameObjects.Image>();
  private restoreArt = new Map<string, Phaser.GameObjects.Image[]>();
  private campArt = new Map<string, Phaser.GameObjects.Image>();
  private fogs: Phaser.GameObjects.TileSprite[] = [];
  private signs = new Map<string, string>();
  private npcAt = new Map<string, string>();
  private nodeAt = new Map<string, string>();
  private empty: Slot[] = [];
  private move: Move | null = null;
  private steps = 0;
  private busyFrom = 0;
  private busyMs = 0;
  private refreshIn = 0;
  private prompt = '';
  private hinted = new Set<string>();
  private attractT = 0;

  constructor() {
    super('world');
  }

  create(): void {
    this.b = app.bundle;
    this.walkable = makeWalkable(this.b);
    this.buildGround();
    this.buildProps();
    this.buildNodes();
    this.buildNpcs();
    this.buildRestores();
    this.buildCamp();
    this.buildFog();
    this.player = this.add.sprite(0, 0, this.playerFrame('down').key, 1).setOrigin(0.5, 1).setVisible(false);
    this.bar = this.add.graphics().setDepth(DEPTH.fx);
    this.shade = this.add.rectangle(0, 0, 10, 10, 0x172a52, 0).setOrigin(0).setScrollFactor(0).setDepth(DEPTH.shade);
    const cam = this.cameras.main;
    cam.setBounds(0, 0, this.b.map.width * T, this.b.map.height * T);
    cam.setRoundPixels(true);
    this.scale.on('resize', () => this.fit());
    this.fit();
    this.time.addEvent({ delay: 480, loop: true, callback: () => this.flipWater() });
    app.world = this;
    app.ui.worldReady();
  }

  // ------------------------------------------------------------ building

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
  }

  private flipWater(): void {
    this.waterFrame = 1 - this.waterFrame;
    this.ground.setTexture(`ground-${this.waterFrame}`);
  }

  private buildProps(): void {
    for (const p of this.b.map.props) {
      if (!this.b.sprites[p.sprite]) continue;
      const bottom = (p.y + p.h) * T;
      const img = this.add.image((p.x + p.w / 2) * T, bottom, p.sprite).setOrigin(0.5, 1);
      img.setDepth(p.solid ? bottom : DEPTH.flat);
      if (p.sign) {
        for (let y = p.y; y < p.y + p.h; y++) for (let x = p.x; x < p.x + p.w; x++) this.signs.set(key(x, y), p.sign);
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
      for (const [alpha, offset] of [[0.5, 0], [0.4, 16]] as const) {
        const fog = this.add.tileSprite(s.x * T, s.y * T, s.w * T, s.h * T, FOG_SPRITE).setOrigin(0).setDepth(DEPTH.fog).setAlpha(alpha);
        fog.setTilePosition(offset, offset);
        this.fogs.push(fog);
      }
    }
  }

  // ------------------------------------------------------------ session

  /** Show this session's world. Called for a new game and for a loaded one. */
  bind(session: Session): void {
    for (const off of this.unbind) off();
    this.session = session;
    this.move = null;
    this.hinted.clear();
    this.unbind = [
      session.on('busy', ({ ms }) => {
        this.busyFrom = session.tick;
        this.busyMs = ms;
      }),
      session.on('events', (events) => this.celebrate(events)),
      session.on('change', () => this.refresh()),
    ];
    this.player.setVisible(true);
    this.placePlayer(session.pos[0], session.pos[1]);
    this.faceFrame();
    this.cameras.main.startFollow(this.player, true);
    this.refresh();
  }

  private placePlayer(x: number, y: number): void {
    this.player.setPosition(x * T + T / 2, (y + 1) * T);
    this.player.setDepth((y + 1) * T + 1);
  }

  private playerFrame(dir: Dir): { key: string; flip: boolean } {
    const starter = this.session ? this.b.starters[this.session.state.player.starter] : undefined;
    const base = starter?.sprite ?? Object.values(this.b.starters)[0]?.sprite ?? '';
    const of = (d: string) => base.replace(/_down$/, `_${d}`);
    const has = (k: string) => k in this.b.sprites;
    if (dir === 'down') return { key: base, flip: false };
    if (dir === 'right' && !has(of('right'))) return { key: has(of('left')) ? of('left') : base, flip: true };
    return { key: has(of(dir)) ? of(dir) : base, flip: false };
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

  private refreshNodes(): void {
    const s = this.session;
    if (!s) return;
    const hour = hourOf(this.b, s.tick);
    for (const [id, img] of this.nodes) {
      const r = this.b.resources[this.b.instances[id]!.source]!;
      const ready = (s.state.nodes[id]?.readyAt ?? 0) <= s.tick;
      const inHours = !r.hours || (r.hours[0] < r.hours[1] ? hour >= r.hours[0] && hour < r.hours[1] : hour >= r.hours[0] || hour < r.hours[1]);
      if (!ready && r.sprite_empty) img.setTexture(r.sprite_empty).setAlpha(1);
      else img.setTexture(r.sprite).setAlpha(ready ? (inHours ? 1 : 0.55) : 0.35);
    }
    const reach = hintDistance(this.b, s.state);
    for (const [id, img] of this.digs) {
      const inst = this.b.instances[id]!;
      const d = Math.max(Math.abs(inst.x - s.pos[0]), Math.abs(inst.y - s.pos[1]));
      const ready = (s.state.nodes[id]?.readyAt ?? 0) <= s.tick;
      const want = d > reach ? 0 : ready ? 1 : 0.3;
      img.setAlpha(img.alpha + (want - img.alpha) * 0.5);
    }
  }

  // ------------------------------------------------------------ frame loop

  override update(_time: number, delta: number): void {
    this.fogs.forEach((fog, i) => (fog.tilePositionX += delta * (i % 2 === 0 ? 0.006 : -0.004)));
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
    }
    this.walk(s, delta);
    this.drawBusy(s);
    this.updatePrompt(s);
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

  canWalk(s: Session, x: number, y: number): boolean {
    return this.walkable(x, y, s.state.player);
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

  private shadeFor(s: Session): void {
    const m = minuteOfDay(this.b, s.tick) / 60;
    // dark from 21:00 to 4:00, fading over two hours on each side
    const night = m >= 21 || m < 4 ? 1 : m >= 19 ? (m - 19) / 2 : m < 6 ? (6 - m) / 2 : 0;
    this.shade.setFillStyle(0x172a52, 0.5 * night);
  }

  private drawBusy(s: Session): void {
    this.bar.clear();
    if (!s.busy) {
      if (this.busyMs > 0) {
        this.busyMs = 0;
        this.faceFrame();
      }
      return;
    }
    if (this.busyMs <= 0) return;
    const k = Math.min(1, (s.tick - this.busyFrom) / this.busyMs);
    const x = this.player.x - 9;
    const y = this.player.y - 29;
    this.bar.fillStyle(0x1b1a2e, 1).fillRect(x, y, 18, 4);
    this.bar.fillStyle(0xf8de62, 1).fillRect(x + 1, y + 1, Math.round(16 * k), 2);
    this.faceFrame(Math.floor(s.tick / 160) % 2 === 0 ? 0 : 2);
  }

  /** A little lift of every new item over the player's head. */
  private celebrate(events: GameEvent[]): void {
    this.faceFrame();
    let i = 0;
    for (const e of events) {
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
    const label = this.canControl(s) && !this.move ? (this.target(s)?.label ?? '') : '';
    if (label !== this.prompt) {
      this.prompt = label;
      app.ui.setPrompt(label);
    }
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
    const npc = this.npcAt.get(k);
    if (npc) return { label: `Talk to ${b.npcs[npc]?.name ?? npc}`, run: () => app.ui.talk(npc) };
    const nodeId = this.nodeAt.get(k);
    if (nodeId) {
      const inst = b.instances[nodeId]!;
      if (inst.kind === 'resource') {
        const r = b.resources[inst.source]!;
        return { label: `Gather ${itemName(b, r.output)}`, run: () => app.ui.gather(nodeId) };
      }
      const img = this.digs.get(nodeId);
      if (img && img.alpha > 0.2) return { label: 'Dig here', run: () => app.ui.dig(nodeId) };
    }
    for (const [id, c] of Object.entries(b.camps)) {
      const t = campTile(b, c.slot);
      if (!t || t[0] !== x || t[1] !== y) continue;
      if (p.camp.includes(id)) {
        if (c.provides) return { label: `Cook at the ${c.title}`, run: () => app.ui.craft(c.provides!) };
        return { label: c.title, run: () => app.ui.campInfo(id) };
      }
      // the kernel refuses to build under the player's feet, so offer it only from beside the spot
      const underfoot = x === s.pos[0] && y === s.pos[1];
      if (!underfoot && !p.camp.some((o) => b.camps[o]?.slot === c.slot)) return { label: `Build: ${c.title}`, run: () => app.ui.build(id) };
    }
    for (const [id, r] of Object.entries(b.restores)) {
      const slot = findSlot(b.map, r.place.slot);
      if (slot && inRect(x, y, slot) && !p.restored.includes(id)) return { label: `Mend the ${r.title}`, run: () => app.ui.restore(id) };
    }
    const sign = this.signs.get(k);
    if (sign) return { label: 'Read the sign', run: () => app.ui.sign(sign) };
    const fog = this.empty.find((slot) => inRect(x, y, slot));
    if (fog && x === s.pos[0] + DIRS[s.facing][0] && y === s.pos[1] + DIRS[s.facing][1]) {
      return { label: `Look at the ${fog.label ?? 'mist'}`, run: () => app.ui.sign(fog.id) };
    }
    return undefined;
  }

  /** Name on a sign: who filled the slot, or an invitation when nobody has. */
  signText(slotId: string): { title: string; lines: string[]; empty: boolean } {
    const b = this.b;
    const slot = findSlot(b.map, slotId);
    const p = this.session?.state.player;
    if (slot?.kind === 'camp') return { title: `${p?.name || 'Your'}'s camp`, lines: ['Build here: a fire first, more later.'], empty: false };
    const content = slotContent(b, slotId);
    if (!content) {
      return {
        title: slot?.label ?? 'An empty place',
        lines: [
          'Awaiting restoration.',
          'Nobody has brought this place back yet. Anyone can - with a short data file, a sprite and an AI tool if you like.',
        ],
        empty: true,
      };
    }
    const lines: string[] = [];
    if (content.kind === 'restore' && p?.restored.includes(content.id)) lines.push(`Mended by ${p.name}.`);
    lines.push(content.creator === 'core' ? 'Added by the core team.' : `Added by ${content.creator}.`);
    if (content.ai_tools?.length) lines.push(`Made with ${content.ai_tools.join(', ')}.`);
    return { title: content.title, lines, empty: false };
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
    const cam = this.cameras.main;
    return { x: (x * T + T / 2 - cam.worldView.x) * cam.zoom, y: (y * T - cam.worldView.y) * cam.zoom };
  }
}

function key(x: number, y: number): string {
  return `${x},${y}`;
}
