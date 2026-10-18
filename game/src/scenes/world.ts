/**
 * The overworld: the map, everything standing on it, and the player walking
 * tile by tile. Walking uses the kernel's own walkable() so the client never
 * lets a player stand where the kernel would refuse an action; on top of it,
 * a plant or stone that is ready blocks the way until it is gathered.
 *
 * Everything cosmetic on top of the plain valley sits behind RICH (config.ts):
 * detail (tile variants, tone patches, canopies, edge strips, shadows), motion
 * (frames, sway, ambient life, footstep dust, idles) and light (dusk, glows,
 * dapple, mist, fades).
 * With every group off the scene is the plain valley, object for object.
 */
import * as Phaser from 'phaser';
import {
  type Action,
  type Bundle,
  type GameEvent,
  type Grade,
  type Hazard,
  type Slot,
  campTile,
  coverAt,
  findSlot,
  fireBurns,
  hazardsOf,
  headingOf,
  hourOf,
  inRect,
  isNight,
  makeWalkable,
  minuteOfDay,
  npcTile,
  predatorAt,
  riddleSlots,
  sees,
  spotOpen,
  windowOpen,
} from '@game/kernel';
import { app } from '../app';
import { sound, type SfxId, type SongId } from '../audio';
import { DIG_SPOT_SPRITE, FOG_SPRITE, RICH, STEP_MS, T } from '../config';
import { mistClears, mistPixels } from '../mist';
import { DIRS, type Dir } from '../input';
import { ECHOES, WHISPERS, pickOf } from '../lore';
import { TOO_DARK, feedTooLate, fireLow, fireName, readable, woodToFeed } from '../fires';
import { emptySlots, slotContent } from '../places';
import { canopyGroups, hash, remapTone, toneField, type Tone } from '../richground';
import type { Session } from '../session';
import { type Run, WOLF_EYES, bangAt, flareAt, glowPixels, huntGround, huntSong, songFade, wolfDrawn } from '../predator';
import { soundscape } from '../soundscape';
import { SensesFind } from '../senses';
import { questTargets } from '../targets';
import { nodeLook } from '../growth';
import { peekOnStep, type Tile } from '../peek';
import { MazePeek } from './peek';
import { hintDistance, lanternNight, nodeAction } from '../text';
import type { WorkKind } from '../ui/ui';
import { type AutoKind, POSES, beatAt, blowsDue, resourceKind, strideFrame, treasureKind } from '../work';
import { StandingReports, canEnter, landStep } from '../walking';

const DEPTH = { ground: 0, restore: 1, flat: 2, shadow: 2.5, dig: 3, puff: 3.5, mist: 8000, fog: 9000, motes: 9100, shade: 9500, glow: 9600, fx: 9800, marker: 9850 };
/** the lantern's pool of light at night, in world px: clear inside, a short edge in whole-pixel steps, the dark outside */
const LIGHT = { r: 34, edge: 2, dark: 0.7, tint: 0xf0dcc0 };
const HOLE = 2 * (LIGHT.r + LIGHT.edge + 1);
const NEIGHBOURS: readonly [number, number][] = [
  [0, -1], [1, 0], [0, 1], [-1, 0], [1, -1], [1, 1], [-1, 1], [-1, -1],
];
/** One swing of the arm while working. */
const SWING_MS = 520;
/** Signatures show over signs this close to the player, in tiles. */
const SIGN_REACH = 5;
const PALETTE = {
  ink: 0x1b1a2e,
  cream: 0xebd3a2,
  paper: 0xf5f4ef,
  green2: 0x4c9a3f,
  green3: 0x84c450,
  green4: 0xc8e88a,
  wood2: 0x9e6b3c,
  wood: 0x6e4226,
  yellow: 0xf8de62,
  gold: 0xeda83a,
  red2: 0xe2533f,
  grey: 0x5d6177,
  grey2: 0x8f94a8,
};
/** How dark the ground shadows are. */
const SHADOW_ALPHA = 0.22;
/** Props that lie on the ground and cast no shadow, by sprite name. */
const FLAT = new Set([
  'flowers', 'flowers_white', 'flowers_blue', 'glow_mushrooms', 'mushrooms_small', 'mushroom_patch', 'rubble', 'pebbles', 'fallen_branches',
  'log_fallen', 'log_mossy', 'grass_tall', 'dig_spot', 'fog', 'reeds', 'herb_plant', 'fence', 'fence_post', 'campfire_lit', 'campfire_unlit',
]);
/** Where the smoke leaves house_small: the chimney top, in pixels of the 48x48 sprite (read from the art). */
const CHIMNEY = { x: 37, y: 6 };
/** Edge strips are named by the side of the tile they sit on. */
const SIDES: readonly [string, number, number][] = [['n', 0, -1], ['e', 1, 0], ['s', 0, 1], ['w', -1, 0]];

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

/** Work that runs by itself after one press: a tree being felled, a spot being dug (game/src/work.ts). */
interface Auto {
  node: string;
  kind: AutoKind;
  start: number;
  ms: number;
  /** blows landed so far */
  hits: number;
  /** the way the player faces the thing; a different direction held is a step away */
  facing: Dir;
  /** the thing is on the player's own tile, so any direction held is a step away */
  underfoot: boolean;
  onDone?: () => void;
}

interface SignSpot {
  slot: string;
  x: number;
  y: number;
  label: HTMLElement;
  /** the fire whose light this sign reads by, if any (`lit_by`) */
  litBy?: string;
}

/** A tended fire on the map (NEXT 13): its flame and glow follow the kernel's burn, never a clock of the client's. */
interface Fire {
  spr: Phaser.GameObjects.Sprite;
  /** the flame frames, stepping only while it burns (with motion on) */
  cycle: Cycle | undefined;
  glow: Glow | undefined;
  /** the prop's own sprite, shown while the fire is out, and the burning one */
  unlit: string;
  lit: string;
}

/** The burning look of a fire prop, from the base kit. */
const FIRE_LIT_SPRITE = 'core/base-kit:props/campfire_lit';
/** A flame's frame time, and the slower one of embers running down in a burn's last minutes. */
const FLAME_MS = 120;
const EMBER_MS = 260;
/** How strongly the embers show in a burn's last minutes. */
const EMBER_ALPHA = 0.6;

/** A page element pinned to a point of the world, moved with the camera. */
interface Pinned {
  el: HTMLElement;
  x: number;
  y: number;
}

type Standing = Phaser.GameObjects.Image | Phaser.GameObjects.Sprite;
type Emitter = Phaser.GameObjects.Particles.ParticleEmitter;

/** A sprite stepping through its frames on its own clock: sway, flicker, flames. */
interface Cycle {
  spr: Phaser.GameObjects.Sprite;
  min: number;
  max: number;
  next: number;
  frame: number;
  active: boolean;
}

/** A character that closes its eyes now and then (frame 1 of its blink sheet). */
interface Blink {
  spr: Phaser.GameObjects.Sprite;
  next: number;
  until: number;
}

/** A soft light that comes up with the night and flickers. */
interface Glow {
  img: Phaser.GameObjects.Image;
  phase: number;
  lit: boolean;
}

/** An emitter that only runs while its patch of the valley is on screen. */
interface Local {
  emitter: Emitter;
  rect: Phaser.Geom.Rectangle;
}

/** Random points over the tiles of one kind that the camera sees now. */
class TileZone {
  private inView: number[] = [];

  constructor(private readonly tiles: readonly number[]) {}

  get count(): number {
    return this.inView.length / 2;
  }

  refresh(view: Phaser.Geom.Rectangle): void {
    const x0 = Math.floor(view.x / T) - 1;
    const x1 = Math.ceil(view.right / T) + 1;
    const y0 = Math.floor(view.y / T) - 1;
    const y1 = Math.ceil(view.bottom / T) + 1;
    this.inView.length = 0;
    for (let i = 0; i < this.tiles.length; i += 2) {
      const x = this.tiles[i]!;
      const y = this.tiles[i + 1]!;
      if (x >= x0 && x <= x1 && y >= y0 && y <= y1) this.inView.push(x, y);
    }
  }

  getRandomPoint(point: Phaser.Types.Math.Vector2Like): void {
    const n = this.count;
    if (n === 0) {
      point.x = -T;
      point.y = -T;
      return;
    }
    const i = Math.floor(Math.random() * n) * 2;
    point.x = this.inView[i]! * T + Math.random() * T;
    point.y = this.inView[i + 1]! * T + Math.random() * T;
  }
}

export class WorldScene extends Phaser.Scene {
  private b!: Bundle;
  private walkable!: ReturnType<typeof makeWalkable>;
  private session: Session | undefined;
  private unbind: (() => void)[] = [];
  private ground!: Phaser.GameObjects.Image;
  private groundFrames = 2;
  private waterFrame = 0;
  private player!: Phaser.GameObjects.Sprite;
  private playerShadow: Phaser.GameObjects.Image | undefined;
  private shade!: Phaser.GameObjects.Rectangle;
  private dusk: Phaser.GameObjects.Rectangle | undefined;
  private bar!: Phaser.GameObjects.Graphics;
  private marker!: Phaser.GameObjects.Image;
  /** B2's mist: the whole map as one image of dots, redrawn only when the places it leaves clear change */
  private mist!: Phaser.GameObjects.Image;
  private mistKey = '';
  /** the mist and the fogs as one layer; the player is cut out of it and of the dark frame (WebGL) */
  private veil!: Phaser.GameObjects.Container;
  /** the player's shape in the stencil that keeps the haze and the frame off the player, a copy of every frame */
  private cutout: Phaser.GameObjects.Sprite | undefined;
  /** where the cut ends while no lantern burns; with the lantern lit it runs on through the night and the glow */
  private uncut: Phaser.GameObjects.Stencil | undefined;
  /** the night outside the lantern's light, around a hole the size of the light */
  private dark!: Phaser.GameObjects.Container;
  private motes!: Emitter;
  private flies!: Emitter;
  private butterflies: Emitter | undefined;
  private leaves: Emitter | undefined;
  private bursts = new Map<string, Emitter>();
  private puffs = new Map<string, Emitter>();
  /** the old picture's dark frame, drawn under the cut-out instead of as a filter over everything (WebGL) */
  private vignette: Phaser.GameObjects.Image | undefined;
  private frameLook = { strength: 0.3, radius: 0.8 };
  private frameKey = '';
  private nodes = new Map<string, Phaser.GameObjects.Sprite>();
  private nodeShadows = new Map<string, Phaser.GameObjects.Image>();
  private digs = new Map<string, Phaser.GameObjects.Image>();
  private restoreArt = new Map<string, Phaser.GameObjects.Image[]>();
  private campArt = new Map<string, Phaser.GameObjects.Sprite>();
  private campCycles = new Map<string, Cycle>();
  private campGlows = new Map<string, Glow>();
  private embers = new Map<string, Emitter>();
  private fogs: Phaser.GameObjects.TileSprite[] = [];
  private fogMotes: Emitter[] = [];
  private dapples: Phaser.GameObjects.TileSprite[] = [];
  private cycles: Cycle[] = [];
  private blinks: Blink[] = [];
  private glows: Glow[] = [];
  private locals: Local[] = [];
  /** sparks over the targets of the first open step of the main task; rebuilt by refresh() */
  private glints: Local[] = [];
  private glintKey = '';
  private viewRect = new Phaser.Geom.Rectangle(0, 0, T, T);
  private meadowZone: TileZone | undefined;
  private groveZone: TileZone | undefined;
  private signs = new Map<string, string>();
  private signSpots: SignSpot[] = [];
  private notes = new Map<string, { text: string; name: string; top: number }>();
  /** tended fires by prop id, the fire on each of their tiles, and the fire each fire-lit tile reads by */
  private fires = new Map<string, Fire>();
  /** people beside a fire prop: a copy of each for the stencil, so that fire's light keeps the night's haze off them while it burns */
  private fireSide: { img: Standing; cut: Phaser.GameObjects.Image; fire: string }[] = [];
  private fireAt = new Map<string, string>();
  private litBy = new Map<string, string>();
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
  private auto: Auto | null = null;
  /** nodes whose look the work keeps: a tree stays a tree until it falls */
  private held = new Set<string>();
  private nextSwing = 0;
  private refreshIn = 0;
  private zoneIn = 0;
  private nextBird = 0;
  private idleSince = 0;
  private nextBlink = 0;
  private blinkUntil = 0;
  private prompt = '';
  private hinted = new Set<string>();
  /** slots the player stands in now, so a riddle's slot is tried once per entry */
  private inside = new Set<string>();
  /** the peek at a maze's entrance, and the tile the player last arrived on, to tell a step in from outside */
  private peek!: MazePeek;
  private lastAt: Tile | undefined;
  private attractT = 0;
  private night = 0;
  private wasNight: boolean | undefined;
  private nextEyes = 0;
  private nextWhisper = 0;
  /**
   * the hazard props (G30-G35): a wolf asleep by day and awake at night, a pit or a trap that shows only by day;
   * a walking wolf's eyes, their glow and their flare, and its run while it hunts
   */
  private hazards: {
    spr: Phaser.GameObjects.Sprite;
    kind: string;
    rule?: Hazard;
    eyes?: Phaser.GameObjects.Image;
    halo?: Phaser.GameObjects.Image;
    flare?: Phaser.GameObjects.Image;
    run?: Run;
  }[] = [];
  /** the reports a player standing still owes the kernel while a predator watches or a hunt runs */
  private readonly stillReports = new StandingReports();
  /** the lantern's light around the player, and the night it was lit for (G31) */
  private lantern: Phaser.GameObjects.Image | undefined;
  private lanternFor: number | undefined;
  /** while the fall plays: no walking, and the player's sprite belongs to the animation */
  private falling = false;
  /** the "!" over a predator that has just seen the player */
  private bang!: Phaser.GameObjects.Image;
  /** the ground a drawn wolf runs on, and the mends and camp it was worked out for */
  private wolfGround: { key: string; walk: (x: number, y: number) => boolean } | undefined;
  /** the song asked for last */
  private song: SongId | undefined;

  constructor() {
    super('world');
  }

  create(): void {
    this.b = app.bundle;
    this.walkable = makeWalkable(this.b);
    this.labels = document.createElement('div');
    this.labels.className = 'world-labels';
    app.ui.root.prepend(this.labels);
    this.peek = new MazePeek(this, DEPTH.mist - 1, this.labels);
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
    if (RICH.light) this.buildDapple();
    if (RICH.detail) this.playerShadow = this.shadow(0, 0, 1).setVisible(false);
    this.player = this.add.sprite(0, 0, this.playerFrame('down').key, 1).setOrigin(0.5, 1).setVisible(false);
    // the haze is one layer over the valley; addFilters cuts the player out of it, so the mist covers the
    // ground, the props and the other figures but never the player or what the player holds
    this.events.on(Phaser.Scenes.Events.POST_UPDATE, () => this.cutPlayer());
    this.veil = this.add.container(0, 0, [this.mist, ...this.fogs, ...this.fogMotes]).setDepth(DEPTH.mist);
    this.bar = this.add.graphics().setDepth(DEPTH.fx);
    this.marker = this.add.image(0, 0, 'fx-arrow').setOrigin(0.5, 1).setDepth(DEPTH.marker).setVisible(false);
    this.tweens.add({ targets: this.marker, displayOriginY: 7, duration: 380, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    this.bang = this.add.image(0, 0, 'fx-bang').setOrigin(0.5, 1).setDepth(DEPTH.fx).setVisible(false);
    if (RICH.light) {
      // a warm wash under the blue shade: multiplied in, so it tints what is there instead of covering it
      this.dusk = this.add.rectangle(0, 0, 10, 10, PALETTE.gold, 0).setOrigin(0).setScrollFactor(0).setDepth(DEPTH.shade - 1).setBlendMode(Phaser.BlendModes.MULTIPLY);
    }
    this.shade = this.add.rectangle(0, 0, 10, 10, 0x172a52, 0).setOrigin(0).setScrollFactor(0).setDepth(DEPTH.shade);
    // the night outside the lantern's light: the hole is the light, the dark reaches past any screen
    const far = 2048;
    const h = HOLE / 2;
    // multiplied in, so what lies out there keeps its colour and only goes dim
    const multiply = Phaser.BlendModes.MULTIPLY;
    const ink = (x: number, y: number, w: number, hh: number) => this.add.rectangle(x, y, w, hh, PALETTE.ink).setOrigin(0).setBlendMode(multiply);
    this.dark = this.add
      .container(0, 0, [
        this.add.image(0, 0, 'fx-dark').setBlendMode(multiply),
        ink(-far, -far, 2 * far, far - h),
        ink(-far, h, 2 * far, far - h),
        ink(-far, -h, far - h, HOLE),
        ink(h, -h, far - h, HOLE),
      ])
      .setDepth(DEPTH.shade + 10)
      .setVisible(false);
    const cam = this.cameras.main;
    cam.setBounds(0, 0, this.b.map.width * T, this.b.map.height * T);
    cam.setRoundPixels(true);
    this.addFilters(cam);
    this.scale.on('resize', () => this.fit());
    this.fit();
    this.time.addEvent({ delay: 480, loop: true, callback: () => this.flipWater() });
    sound.installUnlock();
    sound.music('valley', 1500);
    // the crackle holds its nodes only while heard: none outlives the world
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => sound.crackle(0));
    app.world = this;
    app.ui.worldReady();
  }

  // ------------------------------------------------------------ building

  /** Tiny pixel textures for dust, sparks, motes, eyes and the target arrow, and the soft ones the rich groups add. */
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
    // the bank wolf's eyes (WOLF_EYES): the pair, its steady glow, and the flare as it sees the player
    const { red, size, gap } = WOLF_EYES;
    make('fx-wolf-eyes', 2 * size + gap, size, () => {
      px(red, 0, 0, size, size);
      px(red, size + gap, 0, size, size);
    });
    for (const [tex, rings] of [['fx-wolf-halo', WOLF_EYES.halo], ['fx-wolf-flare', WOLF_EYES.flare]] as const) {
      const glow = glowPixels(rings);
      make(tex, glow.w, glow.h, () => {
        for (const p of glow.px) g.fillStyle(red, p.a).fillRect(p.x, p.y, 1, 1);
      });
    }
    // the "!" over a predator that has just seen the player: paper in a dark outline, so it reads by night and by day
    make('fx-bang', 4, 10, () => {
      px(PALETTE.ink, 1, 0, 2);
      px(PALETTE.ink, 0, 1, 1, 4);
      px(PALETTE.paper, 1, 1, 2, 4);
      px(PALETTE.ink, 3, 1, 1, 4);
      px(PALETTE.ink, 1, 5, 2);
      px(PALETTE.ink, 1, 7, 2);
      px(PALETTE.ink, 0, 8);
      px(PALETTE.paper, 1, 8, 2);
      px(PALETTE.ink, 3, 8);
      px(PALETTE.ink, 1, 9, 2);
    });
    // a pale X for each eye of a fallen player (G33): it has to read on a face in the dark
    make('fx-cross', 3, 3, () => {
      px(PALETTE.paper, 0, 0);
      px(PALETTE.paper, 2, 0);
      px(PALETTE.paper, 1, 1);
      px(PALETTE.paper, 0, 2);
      px(PALETTE.paper, 2, 2);
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
    if (RICH.detail) {
      // a whole-pixel ellipse, 12x5: the ground shadow under anything that stands
      make('fx-shadow', 12, 5, () => {
        px(PALETTE.ink, 3, 0, 6);
        px(PALETTE.ink, 1, 1, 10);
        px(PALETTE.ink, 0, 2, 12);
        px(PALETTE.ink, 1, 3, 10);
        px(PALETTE.ink, 3, 4, 6);
      });
    }
    if (RICH.motion) {
      make('fx-puff', 2, 2, () => px(PALETTE.cream, 0, 0, 2, 2));
      make('fx-grit', 2, 2, () => px(PALETTE.grey, 0, 0, 2, 2));
      make('fx-smoke', 2, 2, () => {
        px(PALETTE.grey2, 0, 0, 2, 2);
        px(PALETTE.paper, 1, 0);
      });
      make('fx-butterfly', 2, 2, () => {
        px(PALETTE.yellow, 0, 0);
        px(PALETTE.paper, 1, 0);
        px(PALETTE.paper, 0, 1);
        px(PALETTE.yellow, 1, 1);
      });
      make('fx-leaf-fall', 1, 2, () => {
        px(PALETTE.green2, 0, 0);
        px(PALETTE.wood2, 0, 1);
      });
      // two wing poses of a bird seen from below, 3x2
      make('fx-bird-0', 3, 2, () => {
        px(PALETTE.ink, 0, 0);
        px(PALETTE.ink, 2, 0);
        px(PALETTE.ink, 1, 1);
      });
      make('fx-bird-1', 3, 2, () => {
        px(PALETTE.ink, 1, 0);
        px(PALETTE.ink, 0, 1);
        px(PALETTE.ink, 2, 1);
      });
    }
    // three whole-pixel discs on top of each other: a glow that is brightest at its heart; the lantern
    // is a sign of the night (G31), so it is drawn in the plain valley too
    const disc = (r: number, color: number, alpha: number) => {
      g.fillStyle(color, alpha);
      for (let dy = -r; dy <= r; dy++) {
        const half = Math.floor(Math.sqrt(r * r - dy * dy));
        g.fillRect(12 - half, 12 + dy, 2 * half + 1, 1);
      }
    };
    make('fx-glow', 25, 25, () => {
      disc(12, PALETTE.gold, 0.1);
      disc(8, PALETTE.gold, 0.16);
      disc(5, PALETTE.yellow, 0.24);
    });
    // the dark around the lantern's light: clear inside, then an edge of two whole-pixel steps, opaque at the border
    make('fx-dark', HOLE, HOLE, () => {
      const c = HOLE / 2;
      for (let y = 0; y < HOLE; y++) {
        for (let x = 0; x < HOLE; x++) {
          const step = Math.floor(Math.hypot(x + 0.5 - c, y + 0.5 - c) - LIGHT.r) + 1;
          if (step > 0) g.fillStyle(PALETTE.ink, Math.min(1, step / (LIGHT.edge + 1))).fillRect(x, y, 1, 1);
        }
      }
    });
    if (RICH.light) {
      // specks of light through the leaves, tiled over the groves
      make('fx-dapple', 32, 32, () => {
        for (const [x, y, w, hh] of [[3, 4, 2, 2], [12, 2, 3, 2], [22, 6, 2, 2], [6, 14, 3, 3], [18, 17, 2, 2], [27, 13, 2, 3], [2, 25, 2, 2], [13, 27, 3, 2], [24, 26, 2, 2], [29, 22, 2, 2]] as const) {
          px(PALETTE.paper, x, y, w, hh);
        }
      });
    }
    g.destroy();
  }

  /** A sprite the bundle names and the loader brought in. */
  private has(ref: string): boolean {
    return ref in this.b.sprites && this.textures.exists(ref);
  }

  private buildGround(): void {
    const m = this.b.map;
    const tiles = Object.values(m.legend);
    const most = Math.max(1, ...tiles.map((t) => this.b.sprites[t.sprite]?.frames ?? 1));
    // one full-map canvas per frame; the plain valley keeps its two
    this.groundFrames = RICH.motion ? most : 2;
    const variants = new Map<string, string[]>();
    const at = (x: number, y: number) => m.legend[m.ground[y]?.[x] ?? ''];
    // the meadow's shaded and sunlit patches, and the blocks of four forest tiles a canopy covers: both fixed by the map
    const tones = RICH.detail ? toneField(m.width, m.height, (x, y) => at(x, y)?.tag === 'meadow') : undefined;
    const forest = tiles.find((t) => baseName(t.sprite) === 'forest');
    const canopies = RICH.detail && forest ? canopyGroups(m.width, m.height, (x, y) => at(x, y)?.sprite === forest.sprite) : [];
    const canopyKit = forest ? kitOf(forest.sprite) : '';
    if (RICH.detail) {
      for (const t of tiles) variants.set(t.sprite, [1, 2, 3].map((i) => `${t.sprite}_${i}`).filter((ref) => this.has(ref)));
    }
    const meadow: number[] = [];
    const grove: number[] = [];
    for (let frame = 0; frame < this.groundFrames; frame++) {
      const tex = this.textures.createCanvas(`ground-${frame}`, m.width * T, m.height * T);
      if (!tex) continue;
      for (let y = 0; y < m.height; y++) {
        const row = m.ground[y] ?? '';
        for (let x = 0; x < m.width; x++) {
          const tile = m.legend[row[x] ?? ''];
          if (!tile) continue;
          const picks = variants.get(tile.sprite);
          const h = hash(x, y);
          // about two tiles in five take a variant, always the same one for the same tile
          const sprite = picks && picks.length > 0 && h % 100 < 40 ? picks[Math.floor(h / 100) % picks.length]! : tile.sprite;
          const info = this.b.sprites[sprite];
          if (!info) continue;
          // a shaded or sunlit meadow tile draws from a toned copy of its sprite
          const tone = tones?.[y * m.width + x] ?? 0;
          const key = tone === 1 || tone === 2 ? (this.toned(sprite, tone) ?? sprite) : sprite;
          tex.drawFrame(key, info.frames > 1 ? frame % info.frames : undefined, x * T, y * T, false);
          if (RICH.detail) this.drawEdges(tex, x, y, tile.sprite, tile.tag, frame);
          if (frame === 0 && RICH.motion) {
            if (tile.tag === 'meadow') meadow.push(x, y);
            else if (tile.tag === 'grove') grove.push(x, y);
          }
        }
      }
      // one crown over each block of four forest tiles; the eyes still watch from the forest's edge
      for (const c of canopies) {
        const ref = `${canopyKit}props/canopy_${c.i + 1}`;
        if (this.has(ref)) tex.drawFrame(ref, undefined, c.x * T, c.y * T, false);
      }
      tex.refresh();
    }
    if (RICH.motion) {
      this.meadowZone = new TileZone(meadow);
      this.groveZone = new TileZone(grove);
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

  /**
   * Edge strips over a tile, one per side, read from the four neighbours: a bank
   * where water meets land, a fringe of grass over a path, cobble, sand or ruin floor
   * tile that touches meadow or grove, and a shore line where sand meets water. Each
   * strip is a kit sprite named after the side it sits on; a missing one is simply not drawn.
   */
  private drawEdges(tex: Phaser.Textures.CanvasTexture, x: number, y: number, sprite: string, tag: string, frame: number): void {
    const m = this.b.map;
    const kit = kitOf(sprite);
    const floor = tag === 'ruin' && baseName(sprite) === 'ruin_floor';
    const kind = tag === 'water' ? 'bank' : tag === 'path' || tag === 'town' || tag === 'riverbank' || floor ? 'fringe' : undefined;
    if (!kind) return;
    for (const [side, dx, dy] of SIDES) {
      const near = m.legend[m.ground[y + dy]?.[x + dx] ?? ''];
      if (!near) continue;
      let ref: string | undefined;
      if (kind === 'bank' && near.tag !== 'water') ref = `${kit}tiles/bank_${side}`;
      else if (kind === 'fringe' && (near.tag === 'meadow' || near.tag === 'grove')) ref = `${kit}tiles/fringe_${side}`;
      else if (tag === 'riverbank' && near.tag === 'water') ref = `${kit}tiles/shore_${side}`;
      if (!ref || !this.has(ref)) continue;
      const frames = this.b.sprites[ref]?.frames ?? 1;
      tex.drawFrame(ref, frames > 1 ? frame % frames : undefined, x * T, y * T, false);
    }
  }

  /**
   * A copy of a grass tile's frames remapped to one tone, kept as a canvas texture with
   * the same frame layout and made once per sprite and tone. Nothing when the sprite is
   * not loaded, so the tile falls back to its plain self.
   */
  private toned(ref: string, tone: Tone): string | undefined {
    const key = `${ref}#tone${tone}`;
    if (this.textures.exists(key)) return key;
    const info = this.b.sprites[ref];
    if (!info || !this.textures.exists(ref)) return undefined;
    const tex = this.textures.createCanvas(key, info.w * info.frames, info.h);
    if (!tex) return undefined;
    for (let f = 0; f < info.frames; f++) tex.drawFrame(ref, info.frames > 1 ? f : undefined, f * info.w, 0, false);
    const pixels = tex.getData(0, 0, tex.width, tex.height);
    remapTone(pixels.data, tex.width, tone, info.w);
    tex.putData(pixels, 0, 0);
    tex.refresh();
    if (info.frames > 1) for (let f = 0; f < info.frames; f++) tex.add(f, 0, f * info.w, 0, info.w, info.h);
    return key;
  }

  private flipWater(): void {
    this.waterFrame = (this.waterFrame + 1) % this.groundFrames;
    this.ground.setTexture(`ground-${this.waterFrame}`);
  }

  private buildProps(): void {
    for (const p of this.b.map.props) {
      const info = this.b.sprites[p.sprite];
      if (!info) continue;
      const bottom = (p.y + p.h) * T;
      const cx = (p.x + p.w / 2) * T;
      const name = baseName(p.sprite);
      if (p.hazard) {
        // a hazard steps through no cycle: its frame and its showing follow the hour (shadeFor)
        const spr = this.add.sprite(cx, bottom, p.sprite, 0).setOrigin(0.5, 1).setDepth(p.solid ? bottom : DEPTH.flat);
        const rule = p.id === undefined ? undefined : hazardsOf(this.b).find((h) => h.id === p.id);
        // a walking wolf shows only its eyes at night: the pair over its glow, and the flare as it sees the player
        const glow = (tex: string, depth: number) =>
          this.add.image(cx, bottom - info.h / 2, tex).setOrigin(0.5).setDepth(depth).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
        const eyes = rule?.round ? this.add.image(cx, bottom - info.h / 2, 'fx-wolf-eyes').setOrigin(0.5).setDepth(DEPTH.glow).setVisible(false) : undefined;
        const halo = rule?.round ? glow('fx-wolf-halo', DEPTH.glow - 0.5) : undefined;
        const flare = rule?.round ? glow('fx-wolf-flare', DEPTH.glow - 0.25) : undefined;
        this.hazards.push({ spr, kind: p.hazard.kind, rule, eyes, halo, flare });
        continue;
      }
      if (p.fire === true && p.id !== undefined) {
        this.buildFire(p.id, p, cx, bottom);
      } else {
        const img = this.standing(p.sprite, cx, bottom, hash(p.x, p.y));
        img.setDepth(p.solid ? bottom : DEPTH.flat);
        if (RICH.detail && !FLAT.has(name)) this.shadow(cx, bottom, p.w, p.solid ? DEPTH.shadow : DEPTH.flat - 0.5);
        // the lamp head is the top 8 px of the post
        if (RICH.light && name === 'lantern_post') this.glows.push(this.glow(cx, bottom - info.h + 4, true));
        if (RICH.motion && name === 'house_small') this.smoke(cx - info.w / 2 + CHIMNEY.x, bottom - info.h + CHIMNEY.y, bottom + 1);
      }
      for (let y = p.y; y < p.y + p.h; y++) {
        for (let x = p.x; x < p.x + p.w; x++) {
          if (p.sign) this.signs.set(key(x, y), p.sign);
          if (p.note) this.notes.set(key(x, y), { text: p.note, name: spriteName(p.sprite), top: info.h });
          if (p.lit_by) this.litBy.set(key(x, y), p.lit_by);
          if (p.fire === true && p.id !== undefined) this.fireAt.set(key(x, y), p.id);
          this.tops.set(key(x, y), info.h);
        }
      }
    }
  }

  /**
   * A fire the player feeds by hand: always a sprite, so refreshFires() can swap the cold
   * hearth for the burning one; its flames and glow wait for the kernel's burn.
   */
  private buildFire(id: string, p: { w: number; solid: boolean; sprite: string }, cx: number, bottom: number): void {
    const spr = this.add.sprite(cx, bottom, p.sprite, 0).setOrigin(0.5, 1).setDepth(p.solid ? bottom : DEPTH.flat);
    if (RICH.detail && !FLAT.has(baseName(p.sprite))) this.shadow(cx, bottom, p.w, p.solid ? DEPTH.shadow : DEPTH.flat - 0.5);
    let cycle: Cycle | undefined;
    if (RICH.motion) {
      cycle = { spr, min: FLAME_MS, max: FLAME_MS, next: 0, frame: 0, active: false };
      this.cycles.push(cycle);
    }
    let glow: Glow | undefined;
    if (RICH.light) {
      glow = this.glow(cx, bottom - 8, false);
      this.glows.push(glow);
    }
    this.fires.set(id, { spr, cycle, glow, unlit: p.sprite, lit: this.has(FIRE_LIT_SPRITE) ? FIRE_LIT_SPRITE : p.sprite });
  }

  /** Flames only while the kernel says the fire burns; in a burn's last minutes the embers dim and slow. */
  private refreshFires(s: Session): void {
    for (const [id, f] of this.fires) {
      const burns = fireBurns(s.state, id, s.tick);
      const low = burns && fireLow(this.b, s.state, id, s.tick);
      const look = burns ? f.lit : f.unlit;
      if (f.spr.texture.key !== look) {
        f.spr.setTexture(look, 0);
        if (f.cycle) f.cycle.frame = 0;
      }
      if (f.cycle) {
        f.cycle.active = burns;
        f.cycle.min = f.cycle.max = low ? EMBER_MS : FLAME_MS;
      }
      const alpha = low ? EMBER_ALPHA : 1;
      if (f.spr.alpha !== alpha) f.spr.setAlpha(alpha);
      if (f.glow) f.glow.lit = burns;
    }
    // beside a fire burning at night: in its light, cut out of the haze and the frame like the player, and warm
    for (const n of this.fireSide) {
      const lit = this.night > 0 && fireBurns(s.state, n.fire, s.tick);
      if (n.cut.visible === lit) continue;
      n.cut.setVisible(lit);
      if (lit) n.img.setTint(LIGHT.tint);
      else n.img.clearTint();
    }
  }

  /** How a fire is drawn now, for a test: its sprite, whether that is the burning one, and how strongly it shows. */
  fireLook(id: string): { sprite: string; burning: boolean; alpha: number } | undefined {
    const f = this.fires.get(id);
    return f && { sprite: f.spr.texture.key, burning: f.spr.texture.key === f.lit && f.lit !== f.unlit, alpha: f.spr.alpha };
  }

  /** Whether a rectangle of tiles is on the screen now. */
  sees(r: { x: number; y: number; w: number; h: number }): boolean {
    const v = this.cameras.main.worldView;
    return r.x * T < v.right && (r.x + r.w) * T > v.x && r.y * T < v.bottom && (r.y + r.h) * T > v.y;
  }

  /**
   * A thing at the centre-bottom of its footprint: a plain image, or, with motion on
   * and frames in the kit, a sprite stepping through them - flames every 120 ms,
   * a lantern flickering, everything else swaying on its own slow beat.
   */
  private standing(ref: string, cx: number, bottom: number, seed: number): Standing {
    const frames = this.b.sprites[ref]?.frames ?? 1;
    if (!RICH.motion || frames < 2) return this.add.image(cx, bottom, ref).setOrigin(0.5, 1);
    const spr = this.add.sprite(cx, bottom, ref, 0).setOrigin(0.5, 1);
    const name = baseName(ref);
    if (name === 'lantern_post') this.cycles.push({ spr, min: 150, max: 250, next: 0, frame: 0, active: true });
    else if (name.startsWith('campfire')) this.cycles.push({ spr, min: 120, max: 120, next: 0, frame: 0, active: true });
    else this.cycles.push(this.sway(spr, seed));
    return spr;
  }

  /** A slow 0/1 beat of 700-1100 ms, its phase and period set by where the thing stands. */
  private sway(spr: Phaser.GameObjects.Sprite, seed: number): Cycle {
    const period = 700 + (seed % 401);
    return { spr, min: period, max: period, next: this.time.now + (seed % period), frame: 0, active: true };
  }

  /** The ground shadow under something standing at (cx, bottom), as wide as its footprint in tiles. */
  private shadow(cx: number, bottom: number, tiles: number, depth = DEPTH.shadow): Phaser.GameObjects.Image {
    return this.add.image(cx, bottom + 2, 'fx-shadow').setOrigin(0.5, 1).setAlpha(SHADOW_ALPHA).setDepth(depth).setScale(Math.max(1, Math.round(tiles)), 1);
  }

  private glow(x: number, y: number, lit: boolean): Glow {
    const img = this.add.image(x, y, 'fx-glow').setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.glow).setAlpha(0);
    return { img, phase: Math.random() * Math.PI * 2, lit };
  }

  /** A thin thread of smoke rising from (x, y), only while that chimney is on screen. */
  private smoke(x: number, y: number, depth: number): void {
    const emitter = this.add
      .particles(x, y, 'fx-smoke', {
        speedY: { min: -7, max: -3 },
        speedX: { min: 1, max: 3 },
        lifespan: { min: 2500, max: 4000 },
        alpha: { values: [0.7, 0.45, 0] },
        frequency: 420,
        maxAliveParticles: 10,
        emitting: false,
      })
      .setDepth(depth);
    this.locals.push({ emitter, rect: new Phaser.Geom.Rectangle(x - 16, y - 40, 48, 56) });
  }

  private buildNodes(): void {
    for (const [id, inst] of Object.entries(this.b.instances)) {
      const cx = inst.x * T + T / 2;
      const bottom = (inst.y + 1) * T;
      if (inst.kind === 'resource') {
        const r = this.b.resources[inst.source];
        if (!r) continue;
        const spr = this.add.sprite(cx, bottom, r.sprite).setOrigin(0.5, 1).setDepth(bottom);
        this.nodes.set(id, spr);
        const animated = [r.sprite, r.sprite_empty].some((ref) => ref && (this.b.sprites[ref]?.frames ?? 1) > 1);
        if (RICH.motion && animated) this.cycles.push(this.sway(spr, hash(inst.x, inst.y)));
        if (RICH.detail && !FLAT.has(baseName(r.sprite))) {
          this.nodeShadows.set(id, this.shadow(cx, bottom, Math.round((this.b.sprites[r.sprite]?.w ?? T) / T)));
        }
      } else {
        const t = this.b.treasures[inst.source];
        // a find picked up by hand lies half-buried, and the senses lead to it
        const look = t && !t.tool
          ? new SensesFind(this, cx, bottom, this.b.items[t.finds[0]!.item]?.sprite ?? DIG_SPOT_SPRITE, DEPTH.dig, () => this.player, RICH.motion).find
          : this.add.image(cx, bottom, DIG_SPOT_SPRITE).setOrigin(0.5, 1).setDepth(DEPTH.dig);
        this.digs.set(id, look.setAlpha(0));
      }
      this.nodeAt.set(key(inst.x, inst.y), id);
    }
  }

  private buildNpcs(): void {
    for (const [id, npc] of Object.entries(this.b.npcs)) {
      const t = npcTile(this.b, id);
      if (!t) continue;
      const bottom = (t[1] + 1) * T;
      const cx = t[0] * T + T / 2;
      // a blink sheet (frame 0 = the plain sprite, frame 1 = eyes closed) replaces the image when it exists
      const blinkRef = `${npc.sprite}_blink`;
      let img: Standing;
      if (RICH.motion && this.has(blinkRef) && (this.b.sprites[blinkRef]?.frames ?? 1) > 1) {
        const spr = this.add.sprite(cx, bottom, blinkRef, 0);
        this.blinks.push({ spr, next: this.time.now + 3000 + Math.random() * 3000, until: 0 });
        img = spr;
      } else {
        img = this.add.image(cx, bottom, npc.sprite);
      }
      img.setOrigin(0.5, 1).setDepth(bottom);
      const fire = this.b.map.props.find((p) => p.fire === true && p.id !== undefined && Math.max(Math.abs(p.x - t[0]), Math.abs(p.y - t[1])) <= 2);
      const cut = fire?.id === undefined ? undefined : new Phaser.GameObjects.Image(this, cx, bottom, img.texture.key, img.frame.name).setOrigin(0.5, 1).setVisible(false);
      if (cut && fire?.id !== undefined) this.fireSide.push({ img, cut, fire: fire.id });
      // a slow breath so people read as alive
      this.tweens.add({ targets: cut ? [img, cut] : img, scaleY: 1.04, duration: 900 + (id.length % 5) * 120, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      if (RICH.detail) this.shadow(cx, bottom, 1);
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
      const cx = t[0] * T + T / 2;
      const spr = this.add.sprite(cx, bottom, c.sprite).setOrigin(0.5, 1).setDepth(bottom).setAlpha(0);
      this.campArt.set(id, spr);
      // flames step through their frames only while the fire is built; refresh() sets that
      if (RICH.motion && (this.b.sprites[c.sprite]?.frames ?? 1) > 1) {
        const cycle: Cycle = { spr, min: 120, max: 120, next: 0, frame: 0, active: false };
        this.cycles.push(cycle);
        this.campCycles.set(id, cycle);
      }
      if (c.slot !== 'fire') continue;
      if (RICH.motion) {
        const embers = this.add
          .particles(cx, bottom - 10, 'fx-spark', {
            speedY: { min: -14, max: -5 },
            speedX: { min: -4, max: 4 },
            lifespan: { min: 400, max: 800 },
            alpha: { start: 1, end: 0 },
            frequency: 110,
            maxAliveParticles: 12,
            blendMode: 'ADD',
            emitting: false,
          })
          .setDepth(DEPTH.glow);
        this.embers.set(id, embers);
      }
      if (RICH.light) {
        const glow = this.glow(cx, bottom - 8, false);
        this.glows.push(glow);
        this.campGlows.set(id, glow);
      }
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
        if (RICH.light) {
          this.tweens.add({ targets: fog, alpha: alpha + 0.12, duration: 3400 + offset * 40 + (s.x % 3) * 500, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
        }
      }
      if (RICH.light) {
        // a few pale specks drifting through the mist, while the slot is on screen
        const rect = new Phaser.Geom.Rectangle(s.x * T, s.y * T, s.w * T, s.h * T);
        const emitter = this.add
          .particles(0, 0, 'fx-mote', {
            emitZone: { type: 'random', source: rect, quantity: 1 },
            speedX: { min: 2, max: 5 },
            speedY: { min: -1, max: 1 },
            lifespan: { min: 3000, max: 6000 },
            alpha: { values: [0, 0.5, 0] },
            frequency: 260,
            maxAliveParticles: 12,
            emitting: false,
          })
          .setDepth(DEPTH.fog + 1);
        this.fogMotes.push(emitter);
        this.locals.push({ emitter, rect });
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
      if (p.sign) this.signSpots.push({ slot: p.sign, x: p.x + p.w / 2, y: p.y, label: this.signatureEl(p.sign), litBy: p.lit_by });
    }
    for (const slot of this.b.map.slots) {
      const content = slotContent(this.b, slot.id);
      if (!content || content.creator === 'core' || covered.has(slot.id)) continue;
      const at = this.freeTileBeside(slot);
      if (!at) continue;
      const cx = at[0] * T + T / 2;
      const bottom = (at[1] + 1) * T;
      this.add.image(cx, bottom, SIGN_SPRITE).setOrigin(0.5, 1).setDepth(DEPTH.flat);
      if (RICH.detail) this.shadow(cx, bottom, 1, DEPTH.flat - 0.5);
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

  /**
   * Mist over the whole valley, dust in the light, fireflies after dark. With
   * motion on, every emitter works only inside the camera's view (refreshZones
   * keeps the zones there) and butterflies, falling leaves and birds join in.
   */
  private buildAtmosphere(): void {
    const w = this.b.map.width * T;
    const hgt = this.b.map.height * T;
    this.mist = this.add.image(0, 0, '__DEFAULT').setOrigin(0).setDepth(DEPTH.mist).setVisible(false);
    const area = RICH.motion ? this.viewRect : new Phaser.Geom.Rectangle(0, 0, w, hgt);
    this.motes = this.add
      .particles(0, 0, 'fx-mote', {
        emitZone: { type: 'random', source: area, quantity: 1 },
        lifespan: { min: 4000, max: 7000 },
        speedX: { min: -3, max: 3 },
        speedY: { min: -6, max: -2 },
        alpha: { values: [0, 0.65, 0] },
        frequency: RICH.motion ? 400 : 70,
        ...(RICH.motion ? { maxAliveParticles: 14 } : {}),
      })
      .setDepth(DEPTH.motes);
    this.flies = this.add
      .particles(0, 0, 'fx-fly', {
        emitZone: { type: 'random', source: area, quantity: 1 },
        lifespan: { min: 3000, max: 5000 },
        speedX: { min: -5, max: 5 },
        speedY: { min: -5, max: 5 },
        alpha: { values: [0, 1, 0.2, 1, 0] },
        frequency: RICH.motion ? 600 : 120,
        blendMode: 'ADD',
        emitting: false,
        ...(RICH.motion ? { maxAliveParticles: 8 } : {}),
      })
      .setDepth(DEPTH.glow);
    if (!RICH.motion || !this.meadowZone || !this.groveZone) return;
    this.butterflies = this.add
      .particles(0, 0, 'fx-butterfly', {
        emitZone: { type: 'random', source: this.meadowZone, quantity: 1 },
        lifespan: { min: 4000, max: 7000 },
        speedX: { min: -12, max: 12 },
        speedY: { min: -8, max: 8 },
        accelerationX: { min: -6, max: 6 },
        accelerationY: { min: -5, max: 5 },
        maxVelocityX: 16,
        maxVelocityY: 12,
        alpha: { values: [0, 1, 0.5, 1, 0.5, 1, 0] },
        frequency: 900,
        maxAliveParticles: 6,
        emitting: false,
      })
      .setDepth(DEPTH.motes);
    this.leaves = this.add
      .particles(0, 0, 'fx-leaf-fall', {
        emitZone: { type: 'random', source: this.groveZone, quantity: 1 },
        lifespan: { min: 3000, max: 5000 },
        speedX: { min: -5, max: 5 },
        speedY: { min: 5, max: 11 },
        accelerationX: { min: -4, max: 4 },
        maxVelocityX: 8,
        alpha: { values: [0, 1, 1, 0] },
        frequency: 600,
        maxAliveParticles: 10,
        emitting: false,
      })
      .setDepth(DEPTH.motes);
  }

  /** Dappled light over the groves by day: one tiled layer of specks per rectangle of grove or forest tiles. */
  private buildDapple(): void {
    for (const r of groveRects(this.b.map)) {
      const d = this.add.tileSprite(r.x, r.y, r.width, r.height, 'fx-dapple').setOrigin(0).setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.mist - 1).setAlpha(0.08);
      d.setTilePosition(hash(r.x, r.y) % 32, hash(r.y, r.x) % 32);
      this.dapples.push(d);
    }
  }

  /** An old, worn picture: a little less colour, a dark frame that closes in at night. WebGL only. */
  private addFilters(cam: Phaser.Cameras.Scene2D.Camera): void {
    if (this.renderer.type !== Phaser.WEBGL) return;
    try {
      const cm = cam.filters.external.addColorMatrix();
      cm.colorMatrix.saturate(-0.16).contrast(0.07, true);
    } catch {
      // a renderer without filters still plays; it only looks newer
      return;
    }
    // the player is cut out of the haze and the frame: a stencil of the player's shape goes down before the
    // mist, and is cleared once the frame is drawn. A filter on the haze layer would do it too, but a filtered
    // see-through layer comes out brighter than it is
    this.cutout = new Phaser.GameObjects.Sprite(this, 0, 0, this.player.texture.key).setOrigin(0.5, 1).setVisible(false);
    this.add.stencil(0, 0, [this.cutout, ...this.fireSide.map((f) => f.cut)], { stencilAlphaStrategy: 0.5 }).setDepth(DEPTH.mist - 0.5);
    this.vignette = this.add.image(0, 0, '__DEFAULT').setScrollFactor(0).setDepth(DEPTH.fog + 2);
    this.uncut = this.add.stencil(0, 0, [], { stencilLayerMode: 'clear' }).setDepth(DEPTH.fog + 3);
    this.add.stencil(0, 0, [], { stencilLayerMode: 'clear' }).setDepth(DEPTH.glow + 1);
  }

  /** The stencil's copy of the player takes the player's frame, place, flip and crop, every frame. */
  private cutPlayer(): void {
    const c = this.cutout;
    if (!c) return;
    const p = this.player;
    c.setVisible(p.visible).setTexture(p.texture.key, p.frame.name).setPosition(p.x, p.y).setFlipX(p.flipX).setAngle(p.angle);
  }

  /**
   * The dark frame closing in from the edges: the Vignette filter's curve (a sine of the distance from the
   * middle, toward ink), drawn at a quarter of the screen and smoothed up. Redrawn only when it changes.
   */
  private drawFrame(): void {
    const img = this.vignette;
    if (!img) return;
    const { strength, radius } = this.frameLook;
    const w = Math.max(8, Math.ceil(this.scale.width / 4));
    const h = Math.max(8, Math.ceil(this.scale.height / 4));
    const key = `${w}x${h}:${strength.toFixed(2)}:${radius.toFixed(2)}`;
    if (key === this.frameKey) return;
    this.frameKey = key;
    let tex = this.textures.exists('fx-frame') ? (this.textures.get('fx-frame') as Phaser.Textures.CanvasTexture) : undefined;
    if (!tex) {
      tex = this.textures.createCanvas('fx-frame', w, h) ?? undefined;
      if (!tex) return;
      tex.setFilter(Phaser.Textures.FilterMode.LINEAR);
    } else if (tex.width !== w || tex.height !== h) tex.setSize(w, h);
    const ctx = tex.getContext();
    const data = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const d = Math.hypot((x + 0.5) / w - 0.5, (y + 0.5) / h - 0.5);
        const i = 4 * (y * w + x);
        data.data[i] = (PALETTE.ink >> 16) & 255;
        data.data[i + 1] = (PALETTE.ink >> 8) & 255;
        data.data[i + 2] = PALETTE.ink & 255;
        data.data[i + 3] = Math.round(255 * (d <= radius ? Math.max(0, Math.sin((d / radius) * 3.14 * strength)) : 1));
      }
    }
    ctx.putImageData(data, 0, 0);
    tex.refresh();
    const zoom = this.cameras.main.zoom;
    // a fixed layer is still zoomed about the middle of the screen, so it is sized down by the zoom
    img.setTexture('fx-frame').setPosition(this.scale.width / 2, this.scale.height / 2).setDisplaySize(this.scale.width / zoom, this.scale.height / zoom);
  }

  // ------------------------------------------------------------ session

  /** Show this session's world. Called for a new game and for a loaded one. */
  bind(session: Session): void {
    for (const off of this.unbind) off();
    this.session = session;
    this.move = null;
    this.work = null;
    this.auto = null;
    this.held.clear();
    this.falling = false;
    this.stillReports.reset();
    for (const h of this.hazards) h.run = undefined;
    this.wolfGround = undefined;
    this.song = undefined;
    this.lanternFor = undefined;
    this.hinted.clear();
    this.inside.clear();
    this.peek.end();
    this.lastAt = [...session.pos];
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
    this.playerShadow?.setVisible(true);
    this.placePlayer(session.pos[0], session.pos[1]);
    this.faceFrame();
    this.idleSince = this.time.now;
    this.blinkUntil = 0;
    this.cameras.main.startFollow(this.player, true);
    // waking up: the valley comes out of the dark
    if (RICH.light) this.cameras.main.fadeIn(600, 27, 26, 46);
    this.wasNight = undefined;
    this.refresh();
  }

  private placePlayer(x: number, y: number): void {
    this.player.setPosition(x * T + T / 2, (y + 1) * T);
    this.player.setDepth((y + 1) * T + 1);
    this.playerShadow?.setPosition(this.player.x, this.player.y + 2);
  }

  /** The starter's sprite for a direction, in the look the player picked. */
  private playerFrame(dir: Dir, pose = 'walk'): { key: string; flip: boolean } {
    const p = this.session?.state.player;
    const starter = p ? this.b.starters[p.starter] : undefined;
    const first = Object.values(this.b.starters)[0];
    const base = (p?.look === 1 && starter?.sprite_alt) || starter?.sprite || first?.sprite || '';
    const stem = pose === 'walk' ? base : base.replace(/_down$/, `_${pose}_down`);
    const of = (d: string) => stem.replace(/_down$/, `_${d}`);
    const has = (k: string) => k in this.b.sprites;
    const none = { key: '', flip: false };
    if (pose !== 'walk' && !has(stem)) return none;
    if (dir === 'down') return { key: stem, flip: false };
    if (dir === 'right' && !has(of('right'))) {
      if (has(of('left'))) return { key: of('left'), flip: true };
      return pose !== 'walk' ? none : { key: stem, flip: false };
    }
    if (has(of(dir))) return { key: of(dir), flip: false };
    return pose !== 'walk' ? none : { key: stem, flip: false };
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
    // a tool has its own swing when the art has one, the axe swing otherwise
    let found = { key: '', flip: false };
    for (const pose of this.auto ? POSES[this.auto.kind] : ['work']) {
      found = this.playerFrame(s.facing, pose);
      if (found.key) break;
    }
    const { key: k, flip } = found;
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
      const cycle = this.campCycles.get(id);
      if (cycle) {
        cycle.active = built;
        if (!built && cycle.frame !== 0) {
          cycle.frame = 0;
          img.setFrame(0);
        }
      }
      const embers = this.embers.get(id);
      if (embers) this.setEmitting(embers, built);
      const glow = this.campGlows.get(id);
      if (glow) glow.lit = built;
    }
    this.refreshNodes();
    this.refreshFires(s);
    if (RICH.motion) this.refreshGlints(s);
  }

  private ready(s: Session, id: string): boolean {
    return (s.state.nodes[id]?.readyAt ?? 0) <= s.tick;
  }

  /**
   * A few yellow sparks rise over every target of the first open step of the main task (the
   * nodes that give the item, the site to mend, the camp to build, the place to visit, the
   * giver once the task is ready to hand in), so the next place to go reads from the map
   * itself. Rebuilt only when the targets change; off with the rest of the motion group.
   */
  private refreshGlints(s: Session): void {
    const targets = questTargets(this.b, s.state, s.tick);
    const key = JSON.stringify(targets);
    if (key === this.glintKey) return;
    this.glintKey = key;
    for (const g of this.glints) {
      g.emitter.destroy();
      const i = this.locals.indexOf(g);
      if (i >= 0) this.locals.splice(i, 1);
    }
    this.glints = [];
    for (const t of targets) {
      const cx = Math.round((t.x + 0.5) * T);
      const top = Math.round((t.y + 1) * T - t.h);
      const emitter = this.add
        .particles(cx, top, 'fx-spark', {
          x: { min: -6, max: 6 },
          y: { min: -2, max: 2 },
          speedY: { min: -10, max: -5 },
          speedX: { min: -2, max: 2 },
          lifespan: { min: 600, max: 1000 },
          frequency: 150,
          maxAliveParticles: 6,
          emitting: false,
        })
        .setDepth(DEPTH.fx);
      const g: Local = { emitter, rect: new Phaser.Geom.Rectangle(cx - 12, top - 16, 24, 24 + t.h) };
      this.glints.push(g);
      this.locals.push(g);
    }
  }

  private refreshNodes(): void {
    const s = this.session;
    if (!s) return;
    const hour = hourOf(this.b, s.tick);
    for (const [id, img] of this.nodes) {
      if (this.held.has(id)) continue;
      const r = this.b.resources[this.b.instances[id]!.source]!;
      const ready = this.ready(s, id);
      const inHours = !r.hours || (r.hours[0] < r.hours[1] ? hour >= r.hours[0] && hour < r.hours[1] : hour >= r.hours[0] || hour < r.hours[1]);
      // a gathered node lies flat and faded, the way over it open; a tree is a stump, a sapling and a young tree on its way back, upright
      const look = nodeLook(r, (s.state.nodes[id]?.readyAt ?? 0) - s.tick);
      // the texture is set only when it changes, so a frame the sway picked stays
      if (img.texture.key !== look.sprite) img.setTexture(look.sprite);
      if (look.flat) img.setAlpha(look.alpha).setDepth(DEPTH.flat);
      else img.setAlpha(ready && !inHours ? 0.55 : look.alpha).setDepth(img.y);
      this.nodeShadows.get(id)?.setAlpha(ready ? SHADOW_ALPHA : 0);
    }
    const reach = hintDistance(this.b, s.state);
    for (const [id, img] of this.digs) {
      if (this.held.has(id)) continue;
      const inst = this.b.instances[id]!;
      const d = Math.max(Math.abs(inst.x - s.pos[0]), Math.abs(inst.y - s.pos[1]));
      // a start's own spot shows to that start alone, until it is dug
      const want = d > reach || !spotOpen(this.b, s.state, id) ? 0 : this.ready(s, id) ? 1 : 0.3;
      img.setAlpha(img.alpha + (want - img.alpha) * 0.5);
    }
  }

  // ------------------------------------------------------------ frame loop

  override update(time: number, delta: number): void {
    this.fogs.forEach((fog, i) => (fog.tilePositionX += delta * (i % 2 === 0 ? 0.006 : -0.004)));
    this.animate(time, delta);
    this.placePinned();
    const s = this.session;
    if (!s || !s.started) {
      sound.crackle(0);
      this.attract(delta);
      return;
    }
    s.advance(delta);
    this.placePredators(s);
    this.refreshIn -= delta;
    if (this.refreshIn <= 0) {
      this.refreshIn = 250;
      this.refreshNodes();
      this.refreshFires(s);
      this.shadeFor(s);
      this.showSignatures(s);
      this.hearPlace(s);
    }
    this.walk(s, delta);
    this.dimInCover(s);
    this.stillReports.frame(this.b, s, this.hazards, !this.move && !this.falling, app.ui.blocking);
    this.playSong(s);
    this.placeLantern(s);
    if (RICH.motion) this.idle(s, time);
    this.workTick(s);
    this.drawBusy(s, time);
    this.updatePrompt(s);
    this.haunt(s, time);
  }

  /**
   * Everything that moves by itself, on the wall clock so it goes on through menus:
   * frames stepping, blinks, glow flicker, the dapple drifting, the emit zones
   * following the camera, birds now and then. Empty lists cost nothing.
   */
  private animate(time: number, delta: number): void {
    for (const c of this.cycles) {
      if (!c.active || time < c.next) continue;
      c.next = time + c.min + (c.max > c.min ? Math.random() * (c.max - c.min) : 0);
      const frames = this.b.sprites[c.spr.texture.key]?.frames ?? 1;
      if (frames < 2) continue;
      c.frame = (c.frame + 1) % frames;
      c.spr.setFrame(c.frame);
    }
    for (const b of this.blinks) {
      if (b.until > 0) {
        if (time >= b.until) {
          b.until = 0;
          b.spr.setFrame(0);
        }
      } else if (time >= b.next) {
        b.until = time + 120;
        b.next = time + 3000 + Math.random() * 3000;
        b.spr.setFrame(1);
      }
    }
    if (this.glows.length > 0) {
      const level = 0.9 * this.night;
      for (const g of this.glows) {
        if (!g.lit || level <= 0) {
          if (g.img.alpha !== 0) g.img.setAlpha(0);
          continue;
        }
        const flicker = 0.5 + 0.5 * Math.sin(time / 173 + g.phase) * Math.sin(time / 419 + g.phase * 1.7);
        g.img.setAlpha(level * (0.8 + 0.2 * flicker));
      }
    }
    for (const d of this.dapples) {
      d.tilePositionX += delta * 0.003;
      d.tilePositionY += delta * 0.0015;
    }
    this.zoneIn -= delta;
    if (this.zoneIn <= 0) {
      this.zoneIn = 250;
      this.refreshZones();
    }
    if (RICH.motion) this.flyBirds(time);
  }

  /** The emit zones follow the camera, and an emitter whose patch left the screen rests. */
  private refreshZones(): void {
    const view = this.cameras.main.worldView;
    this.viewRect.setTo(view.x - 8, view.y - 8, view.width + 16, view.height + 16);
    const day = this.night < 0.5;
    if (this.meadowZone && this.butterflies) {
      this.meadowZone.refresh(view);
      this.setEmitting(this.butterflies, day && this.meadowZone.count > 0);
    }
    if (this.groveZone && this.leaves) {
      this.groveZone.refresh(view);
      this.setEmitting(this.leaves, this.groveZone.count > 0);
    }
    for (const l of this.locals) this.setEmitting(l.emitter, Phaser.Geom.Rectangle.Overlaps(l.rect, this.viewRect));
  }

  private setEmitting(emitter: Emitter, on: boolean): void {
    if (emitter.emitting === on) return;
    if (on) emitter.start();
    else emitter.stop();
  }

  /** One or two birds cross the view by day, every 20-40 s. */
  private flyBirds(time: number): void {
    if (time < this.nextBird) return;
    this.nextBird = time + 20_000 + Math.random() * 20_000;
    if (this.night >= 0.5) return;
    const view = this.cameras.main.worldView;
    if (view.width < T) return;
    const flock = Math.random() < 0.5 ? 2 : 1;
    const ltr = Math.random() < 0.5;
    const y = Math.round(view.y + view.height * (0.1 + Math.random() * 0.3));
    for (let i = 0; i < flock; i++) this.bird(view, ltr, y + i * 3, i);
  }

  /** A 3x2 silhouette flapping straight across the view, one whole pixel at a time. */
  private bird(view: Phaser.Geom.Rectangle, ltr: boolean, y: number, i: number): void {
    const x0 = ltr ? view.x - 8 - i * 6 : view.right + 8 + i * 6;
    const x1 = ltr ? view.right + 8 : view.x - 8;
    const img = this.add.image(x0, y, 'fx-bird-0').setDepth(DEPTH.motes + 1).setFlipX(!ltr);
    const flap = this.time.addEvent({ delay: 140, loop: true, callback: () => img.setTexture(img.texture.key === 'fx-bird-0' ? 'fx-bird-1' : 'fx-bird-0') });
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: (Math.abs(x1 - x0) / 28) * 1000,
      delay: i * 250,
      onUpdate: (tw) => img.setX(Math.round(x0 + (x1 - x0) * (tw.getValue() ?? 0))),
      onComplete: () => {
        flap.remove();
        img.destroy();
      },
    });
  }

  /** Standing still for 3 s, the player blinks every 3-5 s: frame 1 of the idle sheet for 120 ms. */
  private idle(s: Session, time: number): void {
    if (this.falling) return;
    const still = !this.move && !s.busy && !this.work && !this.auto && this.swingUntil === 0;
    if (!still) {
      this.idleSince = time;
      this.blinkUntil = 0;
      return;
    }
    if (this.blinkUntil > 0) {
      if (time >= this.blinkUntil) {
        this.blinkUntil = 0;
        this.faceFrame();
      }
      return;
    }
    if (time - this.idleSince < 3000 || time < this.nextBlink) return;
    this.nextBlink = time + 3000 + Math.random() * 2000;
    const { key: k, flip } = this.playerFrame(s.facing, 'idle');
    if (!k || (this.b.sprites[k]?.frames ?? 1) < 2) return;
    this.player.setTexture(k, 1);
    this.player.setFlipX(flip);
    this.blinkUntil = time + 120;
  }

  private attract(delta: number): void {
    this.attractT += delta;
    const cam = this.cameras.main;
    const cx = 22 * T + Math.sin(this.attractT / 9000) * 10 * T;
    const cy = 15 * T + Math.cos(this.attractT / 13000) * 5 * T;
    cam.centerOn(Math.round(cx), Math.round(cy));
  }

  private canControl(s: Session): boolean {
    return !s.paused && !s.busy && !app.ui.blocking && !this.peek.active;
  }

  private walk(s: Session, delta: number): void {
    if (this.falling) return;
    if (this.move) {
      this.move.t += delta;
      const k = Math.min(1, this.move.t / STEP_MS);
      const [fx, fy] = this.move.from;
      const [tx, ty] = this.move.to;
      this.player.setPosition(Math.round((fx + (tx - fx) * k) * T + T / 2), Math.round((fy + (ty - fy) * k + 1) * T));
      this.player.setDepth(Math.round((Math.max(fy, ty) + 1) * T + 1));
      this.playerShadow?.setPosition(this.player.x, this.player.y + 2);
      this.faceFrame(strideFrame(k, this.steps, this.b.sprites[this.playerFrame(s.facing).key]?.frames ?? 1));
      if (k < 1) return;
      const carry = this.move.t - STEP_MS;
      this.move = null;
      // the kernel hears of each new tile; a hazard there may hurt, and a fall ends the walk
      landStep(s, [tx, ty]);
      if (this.falling) return;
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
    if (RICH.motion) this.puffAt(s.pos[0], s.pos[1]);
    this.move = { from: [s.pos[0], s.pos[1]], to, t: carry };
    return true;
  }

  /** A little dust at the feet as a step starts, in the colour of the ground left behind. */
  private puffAt(x: number, y: number): void {
    const tag = this.b.map.legend[this.b.map.ground[y]?.[x] ?? '']?.tag;
    const texture =
      tag === 'path' || tag === 'riverbank' || tag === 'town' ? 'fx-puff' : tag === 'meadow' || tag === 'grove' ? 'fx-leaf' : tag === 'ruin' ? 'fx-grit' : undefined;
    if (!texture) return;
    let emitter = this.puffs.get(texture);
    if (!emitter) {
      emitter = this.add
        .particles(0, 0, texture, {
          lifespan: { min: 240, max: 400 },
          speed: { min: 5, max: 12 },
          angle: { min: 230, max: 310 },
          alpha: { start: 1, end: 0 },
          emitting: false,
        })
        .setDepth(DEPTH.puff);
      this.puffs.set(texture, emitter);
    }
    emitter.explode(texture === 'fx-leaf' ? 1 : 2 + Math.floor(Math.random() * 2), this.player.x, this.player.y - 1);
  }

  /** The kernel's rule, and a plant or stone that is ready stands in the way (walking.ts). */
  canWalk(s: Session, x: number, y: number): boolean {
    return canEnter(this.b, this.walkable, this.nodeAt, s, x, y);
  }

  private arrive(s: Session): void {
    const [x, y] = s.pos;
    const riddles = riddleSlots(this.b, s.state);
    for (const slot of this.b.map.slots) {
      if (!inRect(x, y, slot)) {
        this.inside.delete(slot.id);
        continue;
      }
      const entered = !this.inside.has(slot.id);
      this.inside.add(slot.id);
      // an area counts once; a slot an open riddle names is tried on every entry, by day or by night (P-2)
      if ((slot.kind === 'area' && !s.state.player.visited.includes(slot.id)) || (entered && riddles.has(slot.id))) {
        s.act({ t: 'visit', slot: slot.id, at: [x, y] });
      }
      if (slot.kind === 'ruin' && !this.hinted.has(slot.id)) {
        const t = Object.values(this.b.treasures).find((d) => d.place.slot === slot.id && (d.starter ?? s.state.player.starter) === s.state.player.starter);
        if (t) {
          this.hinted.add(slot.id);
          app.ui.toast(`Hint: ${t.hint}`, 'info');
        }
      }
    }
    this.enterMaze(s);
    this.refreshNodes();
  }

  /** A step into a maze from outside shows it from above first (NEXT 9); never while a hunt runs. */
  private enterMaze(s: Session): void {
    const from = this.lastAt;
    this.lastAt = [...s.pos];
    if (!from || s.state.player.chase) return;
    const p = s.state.player;
    const peek = peekOnStep(this.b, (q) => p.quests[q] === 'done', (x, y) => this.walkable(x, y, p), from, s.pos);
    if (peek) this.peek.show(peek);
  }

  // ------------------------------------------------------------ day, night and the things in the dark

  /** The campfire, the stream, the ruins and a burning fire sound as loud as the player is near them (soundscape.ts). */
  private hearPlace(s: Session): void {
    const scape = soundscape(this.b, s.state, s.tick, this.player.x / T, this.player.y / T - 0.5);
    for (const id of ['fire', 'stream', 'dread'] as const) sound.bed(id, scape[id].level, scape[id].pan);
    sound.crackle(scape.crackle.level, scape.crackle.pan);
  }

  /** Draws B2's mist for the places the save leaves clear (src/mist.ts); a new texture only when they change. */
  private drawMist(s: Session): void {
    const clears = mistClears(this.b, s.state);
    const key = JSON.stringify(clears);
    if (key === this.mistKey) return;
    this.mistKey = key;
    const { width, height } = this.b.map;
    const name = 'fx-mist';
    const tex = this.textures.exists(name) ? (this.textures.get(name) as Phaser.Textures.CanvasTexture) : this.textures.createCanvas(name, width * T, height * T);
    if (!tex) return;
    tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
    const ctx = tex.getContext();
    ctx.putImageData(new ImageData(mistPixels(clears, width, height, T), width * T, height * T), 0, 0);
    tex.refresh();
    this.mist.setTexture(name).setVisible(true);
  }

  private shadeFor(s: Session): void {
    const m = minuteOfDay(this.b, s.tick) / 60;
    // dark from 21:00 to 4:00, fading over two hours on each side
    this.night = m >= 21 || m < 4 ? 1 : m >= 19 ? (m - 19) / 2 : m < 6 ? (6 - m) / 2 : 0;
    this.shade.setFillStyle(0x172a52, 0.5 * this.night);
    this.drawMist(s);
    this.frameLook = { strength: 0.3 + (RICH.light ? 0.45 : 0.3) * this.night, radius: 0.8 - 0.15 * this.night };
    this.drawFrame();
    if (this.dusk) {
      // gold over the valley around 20:00 and again around 05:30; the kernel's hours are untouched
      this.dusk.setFillStyle(PALETTE.gold, 0.4 * Math.max(warmth(m, 20), warmth(m, 5.5)));
    }
    for (const d of this.dapples) d.setAlpha(0.08 * (1 - this.night));
    this.showHazards(s);
    const isNight = this.night >= 0.5;
    if (isNight !== this.wasNight) {
      const flipped = this.wasNight !== undefined;
      this.wasNight = isNight;
      if (flipped) {
        // a riddle answered by night or by day: the slot the player stands in is entered again at the flip
        this.inside.clear();
        this.arrive(s);
      }
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
      // a sign read by a fire's light shows its signature only while that fire burns
      const dark = spot.litBy !== undefined && !readable(s.state, spot.litBy, s.tick);
      spot.label.classList.toggle('on', !blocked && !dark && d <= SIGN_REACH);
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
    if (this.auto) return;
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

  // ------------------------------------------------------------ danger

  /**
   * By day a hazard shows and can be walked around: the wolf sleeps, the trap
   * and the pit are plain to see. At night the wolf is awake and the pit and
   * the trap are lost in the dark (G30). The hour is the kernel's, not the shade's.
   */
  private showHazards(s: Session): void {
    const night = isNight(this.b, s.tick);
    for (const { spr, kind, rule, eyes, halo } of this.hazards) {
      if (kind === 'predator') {
        const frame = night && spr.texture.frameTotal > 2 ? 1 : 0;
        if (Number(spr.frame.name) !== frame) spr.setFrame(frame);
        const awake = rule !== undefined && windowOpen(this.b, rule, s.tick);
        eyes?.setVisible(awake);
        halo?.setVisible(awake);
      } else {
        spr.setAlpha(night ? 0.12 : 1);
      }
    }
  }

  /**
   * Draw a walking predator from the kernel's clock and round, and while the kernel's hunt names
   * it, running after the player and then back to its round (`wolfDrawn`): drawn only, as the kernel
   * keeps it on its round and bites by its own clock. The moment a predator sees the player a "!"
   * stands over it, and a walking wolf's eyes flare (`SEEN`).
   */
  private placePredators(s: Session): void {
    const chase = s.state.player.chase;
    const since = chase ? s.tick - chase.since : -1;
    let alarmed: Phaser.GameObjects.Sprite | undefined;
    for (const h of this.hazards) {
      const { spr, rule, eyes, halo, flare } = h;
      const hunting = chase !== null && chase.hazard === rule?.id;
      if (hunting && bangAt(since)) alarmed = spr;
      if (!rule?.round) continue;
      const awake = windowOpen(this.b, rule, s.tick);
      const drawn = wolfDrawn(this.b, rule, s.state, s.tick, h.run, this.huntWalk(s));
      h.run = drawn.run;
      const [x, y] = drawn.at;
      const [hx, hy] = drawn.heading;
      const bottom = (y + 1) * T;
      spr.setPosition(Math.round((x + 0.5) * T), Math.round(bottom)).setDepth(Math.round(bottom));
      if (!eyes) continue;
      const faceY = spr.y - spr.displayHeight * 0.55;
      // steady at full strength while awake (the owner's pick): no pulse, no blink
      eyes.setPosition(Math.round(spr.x + hx * 4), Math.round(faceY + hy * 3)).setAngle(hx === 0 ? 0 : 90).setVisible(awake);
      halo?.setPosition(eyes.x, eyes.y).setAngle(eyes.angle).setVisible(awake);
      const flared = awake && hunting ? flareAt(since) : 0;
      flare?.setPosition(eyes.x, eyes.y).setAngle(eyes.angle).setAlpha(flared).setVisible(flared > 0);
    }
    this.bang.setVisible(alarmed !== undefined);
    if (alarmed) this.bang.setPosition(Math.round(alarmed.x), Math.round(alarmed.y - alarmed.displayHeight - 2));
  }

  /** The ground a drawn wolf runs on (`huntGround`), worked out again only when a mend or the camp changes it. */
  private huntWalk(s: Session): (x: number, y: number) => boolean {
    const p = s.state.player;
    const key = `${p.restored.join()}|${p.camp.join()}`;
    if (this.wolfGround?.key !== key) this.wolfGround = { key, walk: huntGround(this.b, s.state, this.walkable) };
    return this.wolfGround.walk;
  }

  /**
   * The music follows the hunt and the hour (`huntSong`): the hunt's own the moment the kernel's
   * hunt begins, and back when it ends, however it ends. The hour is the shade's, so the song waits
   * for the shade's first look at this session's hour.
   */
  private playSong(s: Session): void {
    if (this.wasNight === undefined) return;
    const song = huntSong(s.state.player.chase !== null, this.wasNight);
    if (song === this.song) return;
    sound.music(song, songFade(this.song, song));
    this.song = song;
  }

  /** Reeds and tall grass marked as cover soften the player, then release them at the next tile. */
  private dimInCover(s: Session): void {
    const at = this.falling ? s.state.player.at : s.pos;
    this.player.setAlpha(!this.falling && coverAt(this.b, at) ? 0.72 : 1);
  }

  /** Deterministic predator state for the browser proof harness. */
  predator(id: string, at?: [number, number]): { at: [number, number]; heading: [number, number]; seesPlayer: boolean } | undefined {
    const s = this.session;
    const rule = this.hazards.find((h) => h.rule?.id === id)?.rule;
    if (!s || !rule?.round) return undefined;
    return { at: predatorAt(this.b, rule, s.tick), heading: headingOf(this.b, rule, s.tick), seesPlayer: sees(this.b, rule, s.tick, at ?? s.pos) };
  }

  /** Light the lantern for this night (G31): the UI calls it with the warning box. */
  lightLantern(): void {
    const s = this.session;
    if (!s) return;
    this.lanternFor = lanternNight(this.b, s.state, s.pos, s.tick);
    this.lantern ??= this.add.image(0, 0, 'fx-glow').setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.glow).setScale(2);
  }

  /** The lantern burns around the player while they are out in the night it was lit for; in town or by day it is out. */
  private placeLantern(s: Session): void {
    if (!this.lantern) return;
    const lit = !this.falling && this.lanternFor !== undefined && lanternNight(this.b, s.state, s.pos, s.tick) === this.lanternFor;
    this.lantern.setVisible(lit);
    this.dark.setVisible(lit);
    if (this.cutout) {
      // the lantern lights the one who holds it: no night, no dark and no glow wash over the player, only its warmth
      this.uncut?.setVisible(!lit);
      if (lit) this.player.setTint(LIGHT.tint);
      else this.player.clearTint();
    }
    if (lit) {
      const flicker = 0.5 + 0.5 * Math.sin(this.time.now / 173) * Math.sin(this.time.now / 419);
      this.lantern.setPosition(this.player.x, this.player.y - 10).setAlpha(0.85 + 0.15 * flicker);
      // whole pixels, so the edge of the light stays one clean step
      this.dark.setPosition(Math.round(this.player.x), Math.round(this.player.y - 10)).setAlpha(LIGHT.dark * this.night);
    }
  }

  /**
   * A fall (G33): crosses for eyes, the body sinks into the ground, and the
   * player wakes in town. The box that says what happened is the UI's; nothing
   * is left where it was.
   */
  private fallDown(from: readonly [number, number], to: readonly [number, number]): void {
    const s = this.session;
    if (!s) return;
    this.falling = true;
    // work under way is not taken back: it is simply over (the session drops its undo)
    if (this.auto) this.endWork(this.auto);
    this.move = null;
    this.work = null;
    this.swingUntil = 0;
    // the fall ends any work: nothing may put the standing frame back while the body sinks
    this.busyMs = 0;
    this.placePlayer(from[0], from[1]);
    const { key: k, flip } = this.playerFrame('down');
    this.player.setTexture(k, (this.b.sprites[k]?.frames ?? 1) >= 3 ? 1 : 0).setFlipX(flip);
    // the eyes of a 16x24 body sit on its sixth row, three pixels apart
    const top = this.player.y - this.player.height;
    const eyes = [-3, 2].map((dx) => this.add.image(this.player.x + dx, top + 6, 'fx-cross').setOrigin(0.5).setDepth(this.player.depth + 0.5));
    const baseY = this.player.y;
    const height = this.player.height;
    this.tweens.addCounter({
      from: 0,
      to: 1,
      delay: 500,
      duration: 1100,
      ease: 'Sine.in',
      onUpdate: (tw) => {
        const k = tw.getValue() ?? 0;
        const sunk = Math.round(k * height);
        // the part below the ground line is cut away as the body goes down
        this.player.setY(baseY + sunk).setCrop(0, 0, this.player.width, height - sunk);
        this.cutout?.setCrop(0, 0, this.player.width, height - sunk);
        this.playerShadow?.setAlpha(SHADOW_ALPHA * (1 - k));
        for (const eye of eyes) eye.setY(top + 6 + sunk).setVisible(sunk < 6);
      },
      onComplete: () => {
        for (const eye of eyes) eye.destroy();
        this.cameras.main.fadeOut(300, 27, 26, 46);
        this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
          this.player.setCrop();
          this.cutout?.setCrop();
          this.playerShadow?.setAlpha(SHADOW_ALPHA);
          s.facing = 'down';
          this.placePlayer(to[0], to[1]);
          this.faceFrame();
          this.inside.clear();
          this.falling = false;
          this.cameras.main.fadeIn(700, 27, 26, 46);
        });
      },
    });
  }

  // ------------------------------------------------------------ work that runs by itself

  /**
   * One press starts the work (DECISIONS.md, 2026-10-11): the kernel takes the action now and keeps
   * the player busy for as long as it lasts, and the swings, chips and the thing's own shaking show
   * it. A step away takes the action back (Session.cancelWork), so nothing was yielded.
   */
  startWork(nodeId: string, onDone?: () => void): void {
    const s = this.session;
    const inst = this.b.instances[nodeId];
    if (!s || !inst || this.auto) return;
    const kind = inst.kind === 'resource' ? resourceKind(this.b.resources[inst.source]!) : treasureKind(this.b.treasures[inst.source]!);
    if (!kind) return;
    const action: Action = inst.kind === 'resource' ? { t: 'gather', node: nodeId, grade: 3, at: s.pos } : { t: 'dig', spot: nodeId, grade: 3, at: s.pos };
    const res = s.act(action);
    if (!res.ok) return app.ui.toast(res.error, 'bad');
    const busy = res.events.find((e) => e.e === 'busy');
    if (!busy || busy.e !== 'busy') return;
    this.faceNode(s, nodeId);
    // a dig spot under the feet has no side to face: every direction is a step away from it
    const underfoot = inst.x === s.pos[0] && inst.y === s.pos[1];
    // a dig that solved a riddle says nothing of the catch (G6)
    const solved = res.events.some((e) => e.e === 'riddle');
    this.auto = { node: nodeId, kind, start: s.tick, ms: busy.ms, hits: 0, facing: s.facing, underfoot, onDone: solved ? undefined : onDone };
    this.held.add(nodeId);
    this.workFrame(false);
  }

  /** Drops the work under way, if any, before a panel reads the state. */
  dropWork(): void {
    const s = this.session;
    if (s && this.auto) this.stopWork(s, this.auto);
  }

  /** Whether work started by one press is under way. */
  get working(): boolean {
    return this.auto !== null;
  }

  private workTick(s: Session): void {
    const w = this.auto;
    if (!w) return;
    const elapsed = s.tick - w.start;
    // the end comes first: a level-up window opening as the work ends must not undo it
    if (elapsed >= w.ms) return this.finishWork(s, w);
    const dir = app.controls.direction();
    if (s.paused || app.ui.blocking || (dir !== null && (w.underfoot || dir !== w.facing))) return this.stopWork(s, w);
    const beat = beatAt(elapsed, w.ms);
    this.workFrame(beat.down);
    if (blowsDue(beat) > w.hits) {
      w.hits = blowsDue(beat);
      this.blow(w, beat.progress);
    }
  }

  /** Walked away, or something opened: the work is dropped as if it had not begun. */
  private stopWork(s: Session, w: Auto): void {
    this.endWork(w);
    s.cancelWork();
    this.faceFrame();
  }

  private endWork(w: Auto): void {
    this.auto = null;
    this.busyMs = 0;
    this.held.delete(w.node);
    const img = this.nodes.get(w.node) ?? this.digs.get(w.node);
    if (img) {
      this.tweens.killTweensOf(img);
      img.setAngle(0).setScale(1);
      img.x = (this.b.instances[w.node]!.x + 0.5) * T;
    }
  }

  private finishWork(s: Session, w: Auto): void {
    const img = this.nodes.get(w.node);
    // the tree that falls is a copy of the standing one, so the stump can be there under it at once
    const ghost = w.kind === 'fell' && img ? this.add.sprite(img.x, img.y, img.texture.key, img.frame.name).setOrigin(0.5, 1).setDepth(img.depth + 1).setAngle(img.angle) : undefined;
    this.endWork(w);
    this.refreshNodes();
    this.faceFrame();
    if (ghost) this.fall(ghost, w.facing, w.node);
    else this.burst(w.kind === 'dig' ? 'fx-dirt' : 'fx-dust', (this.b.instances[w.node]!.x + 0.5) * T, (this.b.instances[w.node]!.y + 0.6) * T, 8);
    w.onDone?.();
  }

  /** One blow: the arm lands, the thing sounds, shakes and throws bits; a tree leans a little more each time. */
  private blow(w: Auto, progress: number): void {
    const inst = this.b.instances[w.node];
    if (!inst) return;
    const x = inst.x * T + T / 2;
    const y = inst.y * T + T * 0.6;
    const at = this.worldToPage(x, y);
    const pan = Math.max(-0.8, Math.min(0.8, (at.x / Math.max(1, this.scale.width) - 0.5) * 1.2));
    const img = this.nodes.get(w.node) ?? this.digs.get(w.node);
    if (w.kind === 'fell') {
      sound.sfx('thud', { pan });
      // the wood starts to give: a crack under the blows past the middle
      if (progress > 0.5) sound.sfx('crack', { pan, gain: 0.25 + 0.5 * progress });
      this.burst('fx-chip', x, y, 6);
      if (progress > 0.4 && img) this.burst('fx-leaf', x, y - img.height * 0.6, 2 + Math.round(progress * 4));
    } else if (w.kind === 'mine') {
      sound.sfx('strike', { pan });
      this.burst('fx-dust', x, y, 5);
      this.burst('fx-spark', x, y - 4, 3);
    } else {
      sound.sfx('dig', { pan });
      this.burst('fx-dirt', x, y, 6);
    }
    if (!img) return;
    this.tweens.killTweensOf(img);
    const x0 = x;
    img.x = x0;
    // the shake grows with the work: one pixel at first, two near the end
    const shake = w.kind === 'dig' ? 0 : progress > 0.6 ? 2 : 1;
    const lean = w.kind === 'fell' && (w.facing === 'left' || w.facing === 'right') ? (w.facing === 'left' ? -1 : 1) * progress * 3 : 0;
    this.tweens.add({ targets: img, x: x0 + shake, scaleY: w.kind === 'dig' ? 0.92 : 1, angle: lean, duration: 50, yoyo: true, repeat: 1, onComplete: () => img.setX(x0).setScale(1).setAngle(lean) });
  }

  /** The tree goes over, away from the one who cut it, and lies there a moment before it fades. */
  private fall(ghost: Phaser.GameObjects.Sprite, dir: Dir, id: string): void {
    const inst = this.b.instances[id]!;
    const x = (inst.x + 0.5) * T;
    const y = (inst.y + 0.9) * T;
    sound.sfx('crack', { gain: 0.9 });
    const land = (): void => {
      sound.sfx('thud', { gain: 1 });
      this.burst('fx-leaf', ghost.x + (dir === 'left' ? -14 : dir === 'right' ? 14 : 0), y - 4, 10);
      this.burst('fx-dust', x, y, 6);
      this.cameras.main.shake(140, 0.003);
      this.tweens.add({ targets: ghost, alpha: 0, delay: 400, duration: 350, onComplete: () => ghost.destroy() });
    };
    if (dir === 'left' || dir === 'right') {
      const sign = dir === 'left' ? -1 : 1;
      this.tweens.add({
        targets: ghost,
        angle: sign * 88,
        duration: 520,
        ease: 'Quad.easeIn',
        onComplete: () => {
          land();
          this.tweens.add({ targets: ghost, angle: sign * 83, duration: 70, yoyo: true });
        },
      });
    } else {
      // away from the player or toward them, a tree cannot lie on the screen: it shortens into the ground
      this.tweens.add({
        targets: ghost,
        scaleY: 0.18,
        y: dir === 'down' ? ghost.y + 5 : ghost.y,
        duration: 520,
        ease: 'Quad.easeIn',
        onComplete: land,
      });
    }
  }

  /** A little lift of every new item over the player's head, and a cloud when something is built. */
  private celebrate(events: GameEvent[]): void {
    if (!this.falling) this.faceFrame();
    let i = 0;
    for (const e of events) {
      if (e.e === 'hurt') {
        this.cameras.main.flash(180, 168, 48, 47);
        this.cameras.main.shake(140, 0.005);
      }
      if (e.e === 'fall') this.fallDown(e.from, e.at);
      // seen: a short jolt, left out when the player asked for reduced motion (RICH.motion)
      if (e.e === 'seen' && RICH.motion) this.cameras.main.shake(180, 0.004);
      if (e.e === 'restore' || e.e === 'build') {
        const slot = e.e === 'restore' ? findSlot(this.b.map, this.b.restores[e.restore]?.place.slot ?? '') : undefined;
        const camp = e.e === 'build' ? campTile(this.b, this.b.camps[e.camp]?.slot ?? 'fire') : undefined;
        const cx = slot ? (slot.x + slot.w / 2) * T : camp ? camp[0] * T + T / 2 : this.player.x;
        const cy = slot ? (slot.y + slot.h / 2) * T : camp ? camp[1] * T + T / 2 : this.player.y;
        this.burst('fx-dust', cx, cy, 18);
        this.burst('fx-spark', cx, cy - 6, 12);
        this.cameras.main.shake(160, 0.004);
      }
      if (e.e === 'fire') {
        const f = this.fires.get(e.id);
        const s = this.session;
        // lit after its night was lost: no sparks of cheer
        if (f && !(s && feedTooLate(this.b, s.state, e.id, s.state.tick))) this.burst('fx-spark', f.spr.x, f.spr.y - 8, 10);
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
          return { label: nodeAction(b, r), run: () => app.ui.gather(nodeId), tile, top: this.b.sprites[r.sprite]?.h ?? T };
        }
      } else {
        const img = this.digs.get(nodeId);
        if (img && img.alpha > 0.2) return { label: b.treasures[inst.source]?.tool ? 'Dig here' : 'Pick up', run: () => app.ui.dig(nodeId), tile, top: T };
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
      if (!slot || !inRect(x, y, slot) || p.restored.includes(id)) continue;
      // a restore with no inputs opens only as a quest's reward: nothing to mend by hand
      return { label: r.inputs.length === 0 ? `Look at the ${r.title}` : `Mend the ${r.title}`, run: () => app.ui.restore(id), tile, top: T };
    }
    // a fire takes wood from beside it, where Build and Mend are offered
    const fire = this.fireAt.get(k);
    if (fire && woodToFeed(b, s.state)) return { label: `Feed the ${fireName(fire)}`, run: () => app.ui.feed(fire), tile, top };
    // a prop lit by a fire reads only while that fire burns (lit_by)
    const lit = () => readable(s.state, this.litBy.get(k), s.tick);
    const sign = this.signs.get(k);
    if (sign) return { label: 'Read the sign', run: () => (lit() ? app.ui.sign(sign) : app.ui.note(TOO_DARK)), tile, top };
    const note = this.notes.get(k);
    if (note) return { label: `Look at the ${note.name}`, run: () => app.ui.note(lit() ? note.text : TOO_DARK), tile, top: note.top };
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
      lines.push(`${entry.points} creator points · ${entry.commits} commits`);
    }
    if (content.ai_tools?.length) {
      lines.push(`Made with: ${content.ai_tools.join(', ')}.`);
    }
    return {
      title: content.title,
      lines,
      empty: false,
      record: content.id,
      creator: {
        name,
        role: profile?.role,
        signature: profile?.signature,
        points: entry?.points,
        commits: entry?.commits,
        ai: content.ai_tools ?? [],
        mendedBy: content.kind === 'restore' && p?.restored.includes(content.id) ? p.name : undefined,
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
    this.dusk?.setSize(w, h);
    this.frameKey = '';
    this.drawFrame();
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
  /** the id of the record that fills the place */
  record?: string;
  creator?: {
    name: string;
    role?: string;
    signature?: { text: string; style: string; glyph?: string };
    points?: number;
    commits?: number;
    ai: string[];
    /** the player, when this place is one they mended */
    mendedBy?: string;
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

/** "core/base-kit:props/standing_stone" -> "standing_stone" */
function baseName(ref: string): string {
  return ref.split('/').pop() ?? ref;
}

/** "core/base-kit:props/standing_stone" -> "core/base-kit:" */
function kitOf(ref: string): string {
  return ref.slice(0, ref.indexOf(':') + 1);
}

/** 1 within half an hour of the centre, falling to 0 over the next 45 minutes on either side. */
function warmth(hour: number, centre: number): number {
  return Math.max(0, Math.min(1, 1 - Math.max(0, Math.abs(hour - centre) - 0.5) / 0.75));
}

/**
 * Rectangles covering the grove and forest tiles, in world pixels: each is grown right
 * then down over tiles not yet covered, and only the roomy ones (six tiles or more,
 * at most twenty) are kept - a few large patches are enough for a layer of light.
 */
function groveRects(map: Bundle['map']): Phaser.Geom.Rectangle[] {
  const w = map.width;
  const h = map.height;
  const grove = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (map.legend[map.ground[y]?.[x] ?? '']?.tag === 'grove') grove[y * w + x] = 1;
    }
  }
  const used = new Uint8Array(w * h);
  const free = (x: number, y: number) => grove[y * w + x] === 1 && used[y * w + x] === 0;
  const rects: Phaser.Geom.Rectangle[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!free(x, y)) continue;
      let rw = 0;
      while (x + rw < w && free(x + rw, y)) rw++;
      let rh = 1;
      while (y + rh < h) {
        let whole = true;
        for (let k = 0; k < rw; k++) {
          if (!free(x + k, y + rh)) {
            whole = false;
            break;
          }
        }
        if (!whole) break;
        rh++;
      }
      for (let yy = y; yy < y + rh; yy++) for (let xx = x; xx < x + rw; xx++) used[yy * w + xx] = 1;
      if (rw * rh >= 6) rects.push(new Phaser.Geom.Rectangle(x * T, y * T, rw * T, rh * T));
    }
  }
  return rects.sort((a, b) => b.width * b.height - a.width * a.height).slice(0, 20);
}
