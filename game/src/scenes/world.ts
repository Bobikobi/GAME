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
  attrAt,
  type Hazard,
  type Slot,
  appearSlots,
  campTile,
  coverAt,
  findSlot,
  OWN_FIRE,
  fireBurns,
  hazardsOf,
  headingOf,
  hourOf,
  inRect,
  isNight,
  isTownTile,
  makeWalkable,
  minuteOfDay,
  npcTile,
  placedAt,
  predatorAt,
  resourceOf,
  riddleSlots,
  sees,
  spotOpen,
  walkStepMs,
  windowOpen,
} from '@game/kernel';
import { app } from '../app';
import { Piles, pileAt } from './piles';
import { sound, type SfxId, type SongId } from '../audio';
import { DIG_SPOT_SPRITE, FOG_SPRITE, RICH, T } from '../config';
import { FAR_BELL, SMOKE_PUFFS, farBellDue, nearestChimney, smokeAlpha, smokeAt } from '../hookbridge';
import { sunTableOf } from '../cast';
import { CastLayer } from '../cast-layer';
import { HOLE, LIGHT_POOL, dappleAt, frameAt, nightAt, shadeAt, tableOf, washAt } from '../light';
import { STONE_GLIDE_MS, STONE_STEPS, type StoneView, stoneView } from '../stone';
import { type Clear, mistClears, mistDensity, mistPixels, mistRadius, mistStep, moteAt } from '../mist';
import { FOG_ATLAS, FOG_ATLAS_W, FOG_FEATHER, FOG_OFFSETS, FOG_TILE, fogPixels } from '../fog';
import { AIR_DENSITY, BANK_AT, BANK_DRIFT, BANK_NIGHT_LIFT, BANK_PERIOD, BANK_TILE, BANK_WEIGHT, CLOUD_BUCKETS, CLOUD_TILE, bankPixels, cloudBucket, cloudCover, cloudDrift, cloudPixels, fogStrength } from '../sky';
import { DIRS, type Dir } from '../input';
import { ECHOES, WHISPERS, pickOf } from '../lore';
import { TOO_DARK, type FireStage, feedTooLate, fireName, fireSpot, fireStage, holdsKindling, readable, woodToFeed } from '../fires';
import { emptySlots, slotContent } from '../places';
import { canopyGroups, hash, remapTone, toneField, type Tone } from '../richground';
import {LONGEST_FRAME_MS} from '../session';
import type { GameSession } from '../session-surface';
import { type Run, WOLF_EYES, bangAt, denMarks, flareAt, glowPixels, huntGround, huntSong, songFade, wolfDrawn, wolfDrawnAt } from '../predator';
import { SUCCESS_LIGHT, joltOf } from '../jolt';
import { soundscape } from '../soundscape';
import { SensesFind, makeTextures as makeSensesTextures } from '../senses';
import { questTargets } from '../targets';
import { BIRDS, CUE_LOOK, cueGain } from '../cues';
import { nodeLook } from '../growth';
import { peekOnStep, type Tile } from '../peek';
import { MazePeek } from './peek';
import { FishingView } from './fishing-view';
import type { FishPhase } from '../ui/games/shared';
import { hintDistance, lanternNight, nodeAction, searchableOn } from '../text';
import type { WorkKind } from '../ui/ui';
import { type AutoKind, POSES, beatAt, blowsDue, resourceKind, strideFrame, treasureKind } from '../work';
import { ART_PX, type Facing8, StandingReports, Walker, agrees, canEnter, diagonalSheet, facedTile, facing8For, facingFor, landStep } from '../walking';
import { GroundChunks } from '../groundchunks';
import { adopt, baseOf, densityOf, drawScaled, kitImage, kitSprite, rel, retex, setRel, unitOf } from '../kitart';
import { cameraZoom, pixelRatio, worldToPage } from '../view';
import { ROOM, doorsOf, type RoomScene } from './room';

/** px from the view's edge that the smoke marker keeps, so its column fits above the base. */
const SMOKE_INSET = 30;
const DEPTH = { ground: 0, restore: 1, flat: 2, shadow: 2.5, dig: 3, puff: 3.5, mist: 8000, fog: 9000, motes: 9100, shade: 9500, glow: 9600, fx: 9800, marker: 9850 };
/** the lantern's pool, now held with the rest of the light; LIGHT stays as the name world.ts reads */
const LIGHT = LIGHT_POOL;
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
  /** the logs and stones, cold when the fire is out, and the kit's own burning look while it is full */
  spr: Phaser.GameObjects.Sprite;
  /** the kit's flame frames, stepping only while the fire is full or steady (with motion on) */
  cycle: Cycle | undefined;
  /** the prop's cold look, and the kit's burning one */
  unlit: string;
  lit: string;
  /** a drawn tongue above the logs while the wood runs low: the kit's flame cannot show less than itself (NEXT 21b) */
  flame: Phaser.GameObjects.Image;
  /** the warm pool the fire puts over the night's shade, so its ring is lit, not only haloed */
  nightLight: Phaser.GameObjects.Image;
  glow: Glow | undefined;
  /** how much wood is left, by quarters of the fire's own log (NEXT 21b) */
  stage: FireStage;
  /** the tile's own depth, where the fire sits by day */
  baseDepth: number;
  /** the stage's size, before the flicker of animate() */
  baseX: number;
  baseY: number;
  /** where this fire's flicker starts, so two fires never beat as one */
  phase: number;
  /** the tint now on the flame, kept so a change from one tint to another is not missed */
  tint: number | undefined;
  /** a few sparks rising while it burns (with motion on), and a thin smoke above them */
  sparks: Emitter | undefined;
  smoke: Emitter | undefined;
}

/** The burning look of a fire prop, from the base kit, and the cold look of the fire the player kindles. */
const FIRE_LIT_SPRITE = 'core/base-kit:props/campfire_lit';
const FIRE_UNLIT_SPRITE = 'core/base-kit:props/campfire_unlit';
/** A flame's frame time: the kit's three frames while the fire is full. */
const FLAME_MS = 120;
/** How strongly a fire's warm pool sits over the night's shade, by stage: the safe ring is lit, not merely haloed. */
const NIGHT_LIGHT: Record<FireStage, number> = { full: 0.9, steady: 0.75, low: 0.52, embers: 0.28, out: 0 };
/** The ember tint at the burn's end: the flame cools before it goes. */
const EMBER_TINT = 0xe09050;
/**
 * How each stage of a burn shows (NEXT 21b): the kit's own campfire while the wood is full or steady, then a drawn
 * tongue that shrinks as the last logs go, and the light with it. Nothing here counts logs or minutes.
 */
const STAGE_LOOK: Record<FireStage, { alpha: number; scale: number; glow: number; tint?: number }> = {
  full: { alpha: 1, scale: 1, glow: 0.45 },
  steady: { alpha: 1, scale: 0.88, glow: 0.32 },
  low: { alpha: 0.95, scale: 0.62, glow: 0.22, tint: 0xf0b060 },
  embers: { alpha: 0.8, scale: 0.36, glow: 0.12, tint: EMBER_TINT },
  out: { alpha: 0, scale: 0, glow: 0 },
};

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
  /** how strongly it shows while lit: a fire's light dims with its last wood (NEXT 21b) */
  strength?: number;
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
  private session: GameSession | undefined;
  private unbind: (() => void)[] = [];
  private ground!: Phaser.GameObjects.Image;
  /** the ground in chunks, once any ground sprite is at density 4 (groundchunks.ts); `ground` is then unused */
  private chunks: GroundChunks | undefined;
  private groundFrames = 2;
  private waterFrame = 0;
  private player!: Phaser.GameObjects.Sprite;
  /** the decided cast shadows, every caster's own alpha sheared away from the sun */
  private cast: CastLayer | undefined;
  private readonly noCast = new Set<Phaser.GameObjects.GameObject>();
  private shade!: Phaser.GameObjects.Rectangle;
  private dusk: Phaser.GameObjects.Rectangle | undefined;
  private bar!: Phaser.GameObjects.Graphics;
  private marker!: Phaser.GameObjects.Image;
  /** B2's mist: the whole map as one image of dots, redrawn only when the places it leaves clear change */
  private mist!: Phaser.GameObjects.Image;
  private mistKey = '';
  /** the radius each clear place is drawn at: it moves toward what the save says, 2 tiles a second */
  private mistShown = new Map<string, number>();
  private mistReady = false;
  /** the town's chimney tops in world px, and the one column of single puffs that stands for the town's smoke (NEXT 16 d) */
  private chimneys: { x: number; y: number }[] = [];
  private smokeMark: Phaser.GameObjects.Image[] = [];
  /** the explorer's mote of light: leads through the mist to a find picked up by hand */
  private mote: Phaser.GameObjects.Image | undefined;
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
  /** the zoom the screen's size asks for, and whether the camera is held close on the returners' stone instead */
  private baseZoom = 2;
  private stoneHeld = false;
  private nodes = new Map<string, Phaser.GameObjects.Sprite>();
  private digs = new Map<string, Phaser.GameObjects.Image>();
  private restoreArt = new Map<string, Phaser.GameObjects.Image[]>();
  private campArt = new Map<string, Phaser.GameObjects.Sprite>();
  private campCycles = new Map<string, Cycle>();
  private campGlows = new Map<string, Glow>();
  private embers = new Map<string, Emitter>();
  private fogs: Phaser.GameObjects.Image[] = [];
  /** the cloud shade over the ground by day, one patch repeated, and the fog banks that lie in the valley (sky.ts) */
  private clouds: Phaser.GameObjects.Image[] = [];
  /** the sky's weight today: an index into CLOUD_BUCKETS, and 0 is a clear day with the patches hidden */
  private cloudDay = -1;
  /** a sky picked by `?debug&cloud=0..3`, for a still or a test; unset in play */
  private cloudForce: number | null = null;
  private banks: { img: Phaser.GameObjects.Image; key: string; tile: number; seed: number; drift: number; at: number; periods: number; moved: number }[] = [];
  /** the view's width the banks were last cut for, so a wider view rebuilds them instead of ending mid-screen */
  private bankView = 0;
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
  /** the tiles of a prop that can be searched, to the searchable's id (docs/design/SEARCH.md) */
  private searches = new Map<string, string>();
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
  /** the keepers who trade inside, by the door tile that leads to them */
  private doors = new Map<string, string>();
  /** the shop the player is inside, while they are */
  room: RoomScene | undefined;
  /** a door was pushed and the room is opening: nothing walks meanwhile */
  entering = false;
  private nodeAt = new Map<string, string>();
  /** nodes a reaction makes appear (docs/design/REACTIONS.md): hidden until their condition holds */
  private appearing = new Set<string>();
  private empty: Slot[] = [];
  private eyeSpots: [number, number][] = [];
  private eyes = new Set<Phaser.GameObjects.Image>();
  private labels!: HTMLElement;
  private pinned = new Set<Pinned>();
  /** the body walking freely between tiles (walking.ts); the session keeps the tile under its feet */
  readonly body = new Walker();
  /** what the body is drawn facing: one of eight, leaning on the four-way facing the faced tile is read from */
  private look: Facing8 = 'down';
  private busyFrom = 0;
  private busyMs = 0;
  private work: { node: string; kind: WorkKind } | null = null;
  /** the line, float and fish shapes of fishing, drawn in code */
  private fishing?: FishingView;
  /** the fishing spots, found once */
  private fishSpots?: string[];
  private swingUntil = 0;
  private auto: Auto | null = null;
  /** nodes whose look the work keeps: a tree stays a tree until it falls */
  private held = new Set<string>();
  private nextSwing = 0;
  private refreshIn = 0;
  /** what the player put down, drawn on its tiles */
  private piles?: Piles;
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
  /** the hour table from params, read once: the colour the valley is washed in, by the clock */
  /** the hour table, read once the bundle is here: a field initializer would run before it */
  private lightTable: ReturnType<typeof tableOf> = [];
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
    /** what stays of a predator by day: its den mouth and the prints along its round */
    marks?: Phaser.GameObjects.Image[];
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
    this.lightTable = tableOf(this.b.params.light?.keys ?? []);
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
    this.player = kitSprite(this, 0, 0, this.playerFrame('down').key, 1).setOrigin(0.5, 1).setVisible(false);
    if (RICH.detail) this.buildCasters();
    // the haze is one layer over the valley; addFilters cuts the player out of it, so the mist covers the
    // ground, the props and the other figures but never the player or what the player holds
    this.events.on(Phaser.Scenes.Events.POST_UPDATE, () => this.cutPlayer());
    this.veil = this.add.container(0, 0, [this.mist, ...this.banks.map((b) => b.img), ...this.fogs, ...this.fogMotes]).setDepth(DEPTH.mist);
    this.bar = this.add.graphics().setDepth(DEPTH.fx);
    this.fishing = new FishingView(this, { under: DEPTH.flat + 0.1, over: DEPTH.fx - 1 }, { ink: PALETTE.ink, paper: PALETTE.paper, red: PALETTE.red2, wood: PALETTE.wood });
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
    // a drop of water thrown up by a fish on the line
    make('fx-drop', 1, 2, () => px(PALETTE.paper, 0, 0, 1, 2));
    make('fx-spark', 1, 1, () => px(PALETTE.yellow, 0, 0));
    // the flame of a tended fire, drawn so its four stages read by size (NEXT 21b): a red rim, gold body, yellow heart
    make('fx-flame', 7, 15, () => {
      const rows = [
        '...#...', '...#...', '...#...', '..###..', '..###..', '..###..', '.#####.', '.#####.',
        '#######', '##.#.##', '#######', '.#####.', '..###..', '..###..', '...#...',
      ];
      const lit = (x: number, y: number): boolean => rows[y]?.[x] === '#';
      // the body, then a warmer heart low in it, in the kit's own two flame colours
      for (let y = 0; y < rows.length; y++) for (let x = 0; x < 7; x++) if (lit(x, y)) px(PALETTE.gold, x, y);
      for (let y = 5; y < 14; y++) for (let x = 2; x <= 4; x++) if (lit(x, y)) px(PALETTE.yellow, x, y);
      // a rim of darker red around every lit pixel that meets the air
      const rim: [number, number][] = [];
      for (let y = 0; y < rows.length; y++) {
        for (let x = 0; x < 7; x++) {
          if (!lit(x, y)) continue;
          if (!lit(x - 1, y) || !lit(x + 1, y) || !lit(x, y - 1) || !lit(x, y + 1)) rim.push([x, y]);
        }
      }
      for (const [x, y] of rim) px(PALETTE.red2, x, y);
    });
    // a fire's pool of light: a soft warm disc three tiles wide, stepped in eighths so it stays pixel art
    make('fx-firelight', 48, 48, () => {
      const half = 23.5;
      for (let y = 0; y < 48; y++) {
        for (let x = 0; x < 48; x++) {
          const d = Math.hypot(x - half, y - half) / 24;
          if (d >= 1) continue;
          const alpha = Math.round((1 - d) * (1 - d) * 8) / 8 * 0.6;
          if (alpha > 0) g.fillStyle(0xffb060, alpha).fillRect(x, y, 1, 1);
        }
      }
    });
    make('fx-mote', 1, 1, () => px(PALETTE.paper, 0, 0));
    make('fx-fly', 2, 2, () => px(PALETTE.green4, 0, 0, 2, 2));
    make('fx-eye', 4, 1, () => {
      px(PALETTE.red2, 0, 0);
      px(PALETTE.red2, 3, 0);
    });
    // the bank wolf's eyes (WOLF_EYES): the pair, its steady glow, and the flare as it sees the player
    const { red, size, gap } = WOLF_EYES;
    // what stays of the wolf by day: the mouth of its den, and a paw print (pad and three toes) along its round
    make('fx-den', 14, 9, () => {
      px(PALETTE.wood, 2, 0, 10);
      px(PALETTE.wood, 0, 1, 14, 6);
      px(PALETTE.wood, 2, 7, 10);
      px(PALETTE.ink, 3, 1, 8, 1);
      px(PALETTE.ink, 2, 2, 10, 5);
      px(PALETTE.ink, 3, 7, 8);
    });
    make('fx-paw', 7, 6, () => {
      for (const x of [0, 2, 4, 6]) px(PALETTE.ink, x, x === 0 || x === 6 ? 1 : 0, 1, 2);
      px(PALETTE.ink, 2, 2, 3);
      px(PALETTE.ink, 1, 3, 5, 3);
    });
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
    // a fish rising: one ring on still water, 11x5
    make('fx-ripple', 11, 5, () => {
      px(PALETTE.paper, 3, 0, 5);
      px(PALETTE.paper, 1, 1, 2);
      px(PALETTE.paper, 8, 1, 2);
      px(PALETTE.paper, 0, 2);
      px(PALETTE.paper, 10, 2);
      px(PALETTE.paper, 1, 3, 2);
      px(PALETTE.paper, 8, 3, 2);
      px(PALETTE.paper, 3, 4, 5);
    });
    // three birds lifting, held still: the shape of the cue when nothing moves, 11x6
    make('fx-birds', 11, 6, () => {
      for (const [x, y] of [[0, 3], [4, 0], [8, 2]] as const) {
        px(PALETTE.ink, x, y);
        px(PALETTE.ink, x + 2, y);
        px(PALETTE.ink, x + 1, y + 1);
      }
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
    make('fx-smoke-mark', 1, 1, () => px(PALETTE.paper, 0, 0, 1, 1));
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
    if (RICH.motion) {
      for (let y = 0; y < m.height; y++) {
        for (let x = 0; x < m.width; x++) {
          const tag = at(x, y)?.tag;
          if (tag === 'meadow') meadow.push(x, y);
          else if (tag === 'grove') grove.push(x, y);
        }
      }
    }
    // texture pixels per world unit: 1 while every ground sprite is a density-1 one, 4 once one is density 4
    const gd = Math.max(1, ...Object.entries(this.b.sprites).filter(([ref]) => /(^|:)(tiles\/|props\/canopy_)/.test(ref)).map(([, i]) => i.density));
    const put = (tex: Phaser.Textures.CanvasTexture, ref: string, frame: number | undefined, density: number, x: number, y: number) => {
      if (gd === 1) tex.drawFrame(ref, frame, x, y, false);
      else drawScaled(tex, ref, frame, x * gd, y * gd, gd / density);
    };
    // paints the tiles of a rectangle of the map into a canvas whose corner is that rectangle's; true when any is animated
    const paint = (tex: Phaser.Textures.CanvasTexture, frame: number, tx0: number, ty0: number, tw: number, th: number): boolean => {
      let animated = false;
      for (let y = ty0; y < ty0 + th; y++) {
        const row = m.ground[y] ?? '';
        for (let x = tx0; x < tx0 + tw; x++) {
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
          if (info.frames > 1) animated = true;
          put(tex, key, info.frames > 1 ? frame % info.frames : undefined, info.density, (x - tx0) * T, (y - ty0) * T);
          if (RICH.detail && this.drawEdges(put, tex, x - tx0, y - ty0, x, y, tile.sprite, tile.tag, frame)) animated = true;
        }
      }
      // one crown over each block of four forest tiles; the eyes still watch from the forest's edge
      for (const c of canopies) {
        const ref = `${canopyKit}props/canopy_${c.i + 1}`;
        const unit = unitOf(ref);
        if (!unit || !this.has(ref)) continue;
        if (c.x * T >= (tx0 + tw) * T || c.y * T >= (ty0 + th) * T || (c.x * T + unit.w) <= tx0 * T || (c.y * T + unit.h) <= ty0 * T) continue;
        put(tex, ref, undefined, densityOf(ref), (c.x - tx0) * T, (c.y - ty0) * T);
      }
      return animated;
    };
    if (gd === 1) {
      for (let frame = 0; frame < this.groundFrames; frame++) {
        const tex = this.textures.createCanvas(`ground-${frame}`, m.width * T, m.height * T);
        if (!tex) continue;
        paint(tex, frame, 0, 0, m.width, m.height);
        tex.refresh();
      }
      this.ground = this.add.image(0, 0, 'ground-0').setOrigin(0).setDepth(DEPTH.ground);
    } else {
      // built as the camera moves (update), so nothing is held for the map's far corners
      this.chunks = new GroundChunks(this, m.width, m.height, gd, T, this.groundFrames, DEPTH.ground, paint);
    }
    if (RICH.motion) {
      this.meadowZone = new TileZone(meadow);
      this.groveZone = new TileZone(grove);
    }
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
  private drawEdges(
    put: (tex: Phaser.Textures.CanvasTexture, ref: string, frame: number | undefined, density: number, x: number, y: number) => void,
    tex: Phaser.Textures.CanvasTexture,
    lx: number,
    ly: number,
    x: number,
    y: number,
    sprite: string,
    tag: string,
    frame: number,
  ): boolean {
    const m = this.b.map;
    const kit = kitOf(sprite);
    const floor = tag === 'ruin' && baseName(sprite) === 'ruin_floor';
    const kind = tag === 'water' ? 'bank' : tag === 'path' || tag === 'town' || tag === 'riverbank' || floor ? 'fringe' : undefined;
    if (!kind) return false;
    let animated = false;
    for (const [side, dx, dy] of SIDES) {
      const near = m.legend[m.ground[y + dy]?.[x + dx] ?? ''];
      if (!near) continue;
      let ref: string | undefined;
      if (kind === 'bank' && near.tag !== 'water') ref = `${kit}tiles/bank_${side}`;
      else if (kind === 'fringe' && (near.tag === 'meadow' || near.tag === 'grove')) ref = `${kit}tiles/fringe_${side}`;
      else if (tag === 'riverbank' && near.tag === 'water') ref = `${kit}tiles/shore_${side}`;
      if (!ref || !this.has(ref)) continue;
      const frames = this.b.sprites[ref]?.frames ?? 1;
      if (frames > 1) animated = true;
      put(tex, ref, frames > 1 ? frame % frames : undefined, densityOf(ref), lx * T, ly * T);
    }
    return animated;
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
    if (this.chunks) this.chunks.setFrame(this.waterFrame);
    else this.ground.setTexture(`ground-${this.waterFrame}`);
  }

  private buildProps(): void {
    for (const p of this.b.map.props) {
      const unit = unitOf(p.sprite);
      if (!unit) continue;
      const bottom = (p.y + p.h) * T;
      const cx = (p.x + p.w / 2) * T;
      const name = baseName(p.sprite);
      if (p.hazard) {
        // a hazard steps through no cycle: its frame and its showing follow the hour (shadeFor)
        const spr = kitSprite(this, cx, bottom, p.sprite, 0).setOrigin(0.5, 1).setDepth(p.solid ? bottom : DEPTH.flat);
        const rule = p.id === undefined ? undefined : hazardsOf(this.b).find((h) => h.id === p.id);
        // a walking wolf shows only its eyes at night: the pair over its glow, and the flare as it sees the player
        const glow = (tex: string, depth: number) =>
          this.add.image(cx, bottom - unit.h / 2, tex).setOrigin(0.5).setDepth(depth).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
        const eyes = rule?.round ? this.add.image(cx, bottom - unit.h / 2, 'fx-wolf-eyes').setOrigin(0.5).setDepth(DEPTH.glow).setVisible(false) : undefined;
        const halo = rule?.round ? glow('fx-wolf-halo', DEPTH.glow - 0.5) : undefined;
        const flare = rule?.round ? glow('fx-wolf-flare', DEPTH.glow - 0.25) : undefined;
        // its den and its tracks stay by day (denMarks): flat on the ground under everything that walks
        const marks: Phaser.GameObjects.Image[] = [];
        if (rule && p.hazard.kind === 'predator') {
          const { den, paws } = denMarks(rule);
          marks.push(this.add.image((den[0] + 0.5) * T, (den[1] + 0.75) * T, 'fx-den').setDepth(DEPTH.flat + 0.2));
          for (const paw of paws) {
            const [hx, hy] = paw.heading;
            // a foot to each side of the path, the toes toward where the wolf was going
            const x = Math.round((paw.at[0] + 0.5) * T - hy * 3 * paw.side);
            const y = Math.round((paw.at[1] + 0.5) * T + hx * 3 * paw.side);
            marks.push(this.add.image(x, y, 'fx-paw').setDepth(DEPTH.flat + 0.2).setAlpha(0.7).setAngle(hx === 0 ? (hy > 0 ? 180 : 0) : hx > 0 ? 90 : -90));
          }
        }
        // a pit and a trap lie in the ground; only the wolf stands and casts
        if (p.hazard.kind !== 'predator') this.noCast.add(spr);
        this.hazards.push({ spr, kind: p.hazard.kind, rule, eyes, halo, flare, marks });
        continue;
      }
      if (p.fire === true && p.id !== undefined) {
        this.buildFire(p.id, p, cx, bottom);
      } else {
        const img = this.standing(p.sprite, cx, bottom, hash(p.x, p.y));
        img.setDepth(p.solid ? bottom : DEPTH.flat);
        // the lamp head is the top 8 px of the post
        if (RICH.light && name === 'lantern_post') this.glows.push(this.glow(cx, bottom - unit.h + 4, true));
        if (name === 'house_small') this.chimneys.push({ x: cx - unit.w / 2 + CHIMNEY.x, y: bottom - unit.h + CHIMNEY.y });
        if (RICH.motion && name === 'house_small') this.smoke(cx - unit.w / 2 + CHIMNEY.x, bottom - unit.h + CHIMNEY.y, bottom + 1);
      }
      for (let y = p.y; y < p.y + p.h; y++) {
        for (let x = p.x; x < p.x + p.w; x++) {
          if (p.sign) this.signs.set(key(x, y), p.sign);
          if (p.note) this.notes.set(key(x, y), { text: p.note, name: spriteName(p.sprite), top: unit.h });
          const searchable = p.id === undefined ? undefined : searchableOn(this.b, p.id);
          if (searchable) this.searches.set(key(x, y), searchable);
          if (p.lit_by) this.litBy.set(key(x, y), p.lit_by);
          if (p.fire === true && p.id !== undefined) this.fireAt.set(key(x, y), p.id);
          this.tops.set(key(x, y), unit.h);
        }
      }
    }
  }

  /**
   * A fire the player feeds by hand: always a sprite, so refreshFires() can swap the cold
   * hearth for the burning one; its flames and glow wait for the kernel's burn.
   */
  private buildFire(id: string, p: { w: number; solid: boolean; sprite: string }, cx: number, bottom: number): void {
    const depth = p.solid ? bottom : DEPTH.flat;
    const spr = kitSprite(this, cx, bottom, p.sprite, 0).setOrigin(0.5, 1).setDepth(depth);
    this.fires.set(id, this.fireAtTile(spr, p.sprite, depth));
  }

  /** The kit's burning look, the drawn low flame, the glow and the burn stage over a sprite already on its tile. A fire's light covers its safe ring. */
  private fireAtTile(spr: Phaser.GameObjects.Sprite, unlit: string, depth: number): Fire {
    let cycle: Cycle | undefined;
    if (RICH.motion) {
      cycle = { spr, min: FLAME_MS, max: FLAME_MS, next: 0, frame: 0, active: false };
      this.cycles.push(cycle);
    }
    const flame = this.add
      .image(spr.x, spr.y - 3, 'fx-flame')
      .setOrigin(0.5, 1)
      .setDepth(depth + 0.01)
      .setVisible(false);
    // a normal-blend pool above the night's shade: the fire's ring is lit ground, not a halo over the dark
    // three tiles wide: the safe ring, and no bigger
    const ring = ((this.b.params.fire.safe_tiles * 2 + 1) * T) / 48;
    const nightLight = this.add
      .image(spr.x, spr.y - 4, 'fx-firelight')
      .setBlendMode(Phaser.BlendModes.NORMAL)
      .setScale(ring)
      .setDepth(DEPTH.shade + 0.5)
      .setAlpha(0);
    let glow: Glow | undefined;
    if (RICH.light) {
      // the light pools on the ground around the fire, not over the flame
      glow = this.glow(spr.x, spr.y - 4, false, 'fx-firelight', ring * 0.72);
      this.glows.push(glow);
    }
    let sparks: Emitter | undefined;
    let smoke: Emitter | undefined;
    if (RICH.motion) {
      sparks = this.add
        .particles(spr.x, spr.y - 6, 'fx-spark', {
          speedY: { min: -16, max: -6 },
          speedX: { min: -4, max: 4 },
          lifespan: { min: 450, max: 900 },
          alpha: { start: 1, end: 0 },
          frequency: 700,
          maxAliveParticles: 8,
          blendMode: 'ADD',
          emitting: false,
        })
        .setDepth(depth + 0.02);
      smoke = this.smokePuffs(spr.x, spr.y - 12, depth + 0.005, {
        speedY: { min: -9, max: -4 },
        speedX: { min: -3, max: 3 },
        lifespan: { min: 2200, max: 3800 },
        scale: { start: 1, end: 2.5 },
        alpha: { values: [0.7, 0.35, 0] },
        frequency: 900,
        maxAliveParticles: 6,
      });
    }
    spr.setDepth(depth);
    return {
      spr,
      cycle,
      unlit,
      lit: this.has(FIRE_LIT_SPRITE) ? FIRE_LIT_SPRITE : unlit,
      flame,
      nightLight,
      glow,
      stage: 'out',
      baseDepth: depth,
      baseX: 0,
      baseY: 0,
      phase: Math.random() * Math.PI * 2,
      tint: undefined,
      sparks,
      smoke,
    };
  }

  /**
   * The fire the player kindled (NEXT 21b): one sprite that follows the tile the kernel names, cold until it is
   * lit. It is not a map prop, so nothing builds it at bind time; refreshFires() calls this first.
   */
  private ensureOwnFire(s: GameSession): Fire | undefined {
    const own = s.state.player.own;
    let f = this.fires.get(OWN_FIRE);
    if (own === null) {
      f?.spr.setVisible(false);
      f?.flame.setVisible(false);
      if (f?.glow) f.glow.lit = false;
      return undefined;
    }
    const at = fireSpot(own.at, T);
    if (!f) {
      const spr = kitSprite(this, at.x, at.bottom, FIRE_UNLIT_SPRITE, 0).setOrigin(0.5, 1);
      f = this.fireAtTile(spr, FIRE_UNLIT_SPRITE, at.bottom);
      this.fires.set(OWN_FIRE, f);
    }
    // a re-kindled fire moves every part with its tile: the depth it falls back to by day and the smoke's column too
    f.baseDepth = at.depth;
    f.spr.setVisible(true).setPosition(at.x, at.bottom).setDepth(at.depth);
    f.flame.setPosition(at.x, at.flameY).setDepth(at.flameDepth);
    f.nightLight.setPosition(at.x, at.lightY);
    f.glow?.img.setPosition(at.x, at.lightY);
    f.sparks?.setPosition(at.x, at.sparksY).setDepth(at.sparksDepth);
    f.smoke?.setPosition(at.x, at.smokeY).setDepth(at.smokeDepth);
    return f;
  }

  /** Flames only while the kernel says the fire burns; in a burn's last minutes the embers dim and slow. */
  private refreshFires(s: GameSession): void {
    this.ensureOwnFire(s);
    for (const [id, f] of this.fires) {
      const stage = fireStage(this.b, s.state, id, s.tick);
      const l = STAGE_LOOK[stage];
      const full = stage === 'full' || stage === 'steady';
      // by day the kit's own flame shows while the wood is full; at night the shade would hide it, so the drawn tongue
      // carries the flame over the dark at every stage
      const night = this.night > 0.15;
      const drawn = stage === 'low' || stage === 'embers' || (night && full);
      const look = full ? f.lit : f.unlit;
      if (f.spr.texture.key !== look) {
        retex(f.spr, look, 0);
        if (f.cycle) f.cycle.frame = 0;
      }
      if (f.cycle) {
        f.cycle.active = full;
        f.cycle.min = f.cycle.max = FLAME_MS;
      }
      // the full fire is the kit's campfire, a little smaller when it settles; the last wood is a drawn tongue
      f.spr.setAlpha(1).setScale(full ? (stage === 'full' ? 1 : 0.9) : 1);
      // at night the fire itself, its flame and its sparks are lifted over the shade, so the light has a source
      const nightFull = night && full;
      const sx = nightFull ? (stage === 'full' ? 1.2 : 1.1) : 1;
      const sy = nightFull ? (stage === 'full' ? 0.85 : 0.72) : l.scale;
      f.flame.setVisible(drawn);
      f.flame.setAlpha(l.alpha).setScale(sx, sy);
      f.baseX = sx;
      f.baseY = sy;
      f.spr.setDepth(night ? DEPTH.shade + 0.8 : f.baseDepth);
      f.flame.setDepth(night ? DEPTH.shade + 1 : f.baseDepth + 0.01);
      f.sparks?.setDepth(night ? DEPTH.shade + 0.9 : f.baseDepth + 0.02);
      f.nightLight.setAlpha(NIGHT_LIGHT[stage] * this.night);
      // the last wood cools the tongue; a change from one tint to another (low to embers) is a tint too
      if (f.tint !== l.tint) {
        f.tint = l.tint;
        if (l.tint === undefined) f.flame.clearTint();
        else f.flame.setTint(l.tint);
      }
      if (f.glow) {
        f.glow.lit = stage !== 'out';
        f.glow.strength = l.glow;
      }
      if (f.sparks) {
        f.sparks.emitting = stage !== 'out' && stage !== 'embers';
        f.sparks.frequency = stage === 'full' ? 550 : stage === 'steady' ? 800 : 1300;
      }
      if (f.smoke) {
        f.smoke.emitting = stage === 'full' || stage === 'steady' || stage === 'low';
        f.smoke.setDepth(night ? DEPTH.shade + 0.7 : f.baseDepth + 0.005);
      }
      f.stage = stage;
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

  /** How a fire is drawn now, for a test and for the walk-out proof: its sprite, its burn, its wood stage and its strength. */
  fireLook(id: string): { sprite: string; burning: boolean; alpha: number; scale: number; stage: FireStage } | undefined {
    const f = this.fires.get(id);
    if (!f) return undefined;
    const drawn = f.flame.visible;
    return {
      sprite: f.spr.texture.key,
      burning: f.stage !== 'out',
      alpha: drawn ? f.flame.alpha : f.spr.alpha,
      scale: drawn ? f.baseY : f.spr.scaleX,
      stage: f.stage,
    };
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
    if (!RICH.motion || frames < 2) return kitImage(this, cx, bottom, ref).setOrigin(0.5, 1);
    const spr = kitSprite(this, cx, bottom, ref, 0).setOrigin(0.5, 1);
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

  /**
   * Registers every thing the scene drew as a caster of the decided shadow (STYLE 4), from its
   * own alpha, so a kind of thing added later casts without a second list. The ground, the flat
   * props, the digs and the overlays are not casters; a thing that lies in the ground is in
   * `noCast`.
   */
  private buildCasters(): void {
    // a density-4 prop casts at the size it is drawn: the layer reads each texture's density
    this.cast = new CastLayer(this, sunTableOf(this.b.params.light?.sun), 1, densityOf);
    // nothing that changes every frame is painted into a layer (cast-layer.ts): a thing that walks casts
    // through its own image, a thing on a beat (a sway, a flame, a blink) from its first frame
    const walks = new Set<Phaser.GameObjects.GameObject>(this.hazards.map((h) => h.spr));
    const beats = new Set<Phaser.GameObjects.GameObject>([...this.cycles.map((c) => c.spr), ...this.blinks.map((b) => b.spr)]);
    for (const obj of this.children.list) {
      if (!(obj instanceof Phaser.GameObjects.Image) && !(obj instanceof Phaser.GameObjects.Sprite)) continue;
      if (obj === this.player || obj === this.cutout) continue;
      if (obj instanceof Phaser.GameObjects.RenderTexture) continue;
      if (!obj.visible || this.noCast.has(obj)) continue;
      const key = obj.texture.key;
      if (!key || key.startsWith('fx-') || key.startsWith('senses-') || key.startsWith('cast-') || key.startsWith('cast:')) continue;
      if (key === '__DEFAULT' || key === '__WHITE' || key.startsWith('ground-')) continue;
      if (FLAT.has(baseName(key))) continue;
      const depth = obj.depth;
      if (depth < DEPTH.flat || depth > 1000) continue;
      // a dig spot and a puff lie at 3 and 3.5; the props and the people stand at their own feet
      if (depth > DEPTH.flat && depth <= DEPTH.puff) continue;
      this.cast.add(obj, depth === DEPTH.flat ? 'under' : 'standing', walks.has(obj) ? 'moving' : beats.has(obj) ? 'rest' : 'drawn');
    }
    this.cast.add(this.player, 'standing', 'moving');
  }

  private glow(x: number, y: number, lit: boolean, key = 'fx-glow', scale = 1): Glow {
    const img = this.add
      .image(x, y, key)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(DEPTH.glow)
      .setScale(scale)
      .setAlpha(0);
    return { img, phase: Math.random() * Math.PI * 2, lit };
  }

  /** The one smoke emitter, the 'fx-smoke' puff, off until its owner switches it on: a chimney's thread and a fire's column differ only in the numbers. */
  private smokePuffs(x: number, y: number, depth: number, config: Omit<Phaser.Types.GameObjects.Particles.ParticleEmitterConfig, 'emitting'>): Emitter {
    return this.add.particles(x, y, 'fx-smoke', { ...config, emitting: false }).setDepth(depth);
  }

  /** A thin thread of smoke rising from (x, y), only while that chimney is on screen. */
  private smoke(x: number, y: number, depth: number): void {
    const emitter = this.smokePuffs(x, y, depth, {
      speedY: { min: -7, max: -3 },
      speedX: { min: 1, max: 3 },
      lifespan: { min: 2500, max: 4000 },
      alpha: { values: [0.7, 0.45, 0] },
      frequency: 420,
      maxAliveParticles: 10,
    });
    this.locals.push({ emitter, rect: new Phaser.Geom.Rectangle(x - 16, y - 40, 48, 56) });
  }

  private buildNodes(): void {
    for (const [id, inst] of Object.entries(this.b.instances)) {
      const cx = inst.x * T + T / 2;
      const bottom = (inst.y + 1) * T;
      if (inst.kind === 'resource') {
        const r = this.b.resources[inst.source];
        if (!r) continue;
        const spr = kitSprite(this, cx, bottom, r.sprite).setOrigin(0.5, 1).setDepth(bottom);
        this.nodes.set(id, spr);
        const animated = [r.sprite, r.sprite_empty].some((ref) => ref && (this.b.sprites[ref]?.frames ?? 1) > 1);
        if (RICH.motion && animated) this.cycles.push(this.sway(spr, hash(inst.x, inst.y)));
      } else {
        const t = this.b.treasures[inst.source];
        // a find picked up by hand lies half-buried, and the senses lead to it
        const look = t && !t.tool
          ? new SensesFind(this, cx, bottom, this.b.items[t.finds[0]!.item]?.sprite ?? DIG_SPOT_SPRITE, DEPTH.dig, () => this.player, RICH.motion).find
          : kitImage(this, cx, bottom, DIG_SPOT_SPRITE).setOrigin(0.5, 1).setDepth(DEPTH.dig);
        this.digs.set(id, look.setAlpha(0));
      }
      this.nodeAt.set(key(inst.x, inst.y), id);
    }
    // a node a reaction makes appear stands hidden on its own tile until the condition holds
    for (const slot of appearSlots(this.b).values()) {
      const bottom = (slot.y + 1) * T;
      const spr = kitSprite(this, slot.x * T + T / 2, bottom, slot.def.sprite).setOrigin(0.5, 1).setDepth(bottom).setAlpha(0);
      this.nodes.set(slot.id, spr);
      this.appearing.add(slot.id);
      this.nodeAt.set(key(slot.x, slot.y), slot.id);
    }
  }

  private buildNpcs(): void {
    this.doors = doorsOf(this.b, (id) => npcTile(this.b, id));
    for (const [id, npc] of Object.entries(this.b.npcs)) {
      const t = npcTile(this.b, id);
      if (!t) continue;
      // a keeper with a shop to walk into stands inside it; their place on the map is the door
      if (this.doors.get(key(t[0], t[1])) === id) {
        this.tops.set(key(t[0], t[1]), T * 2);
        continue;
      }
      const bottom = (t[1] + 1) * T;
      const cx = t[0] * T + T / 2;
      // a blink sheet (frame 0 = the plain sprite, frame 1 = eyes closed) replaces the image when it exists
      const blinkRef = `${npc.sprite}_blink`;
      let img: Standing;
      if (RICH.motion && this.has(blinkRef) && (this.b.sprites[blinkRef]?.frames ?? 1) > 1) {
        const spr = kitSprite(this, cx, bottom, blinkRef, 0);
        this.blinks.push({ spr, next: this.time.now + 3000 + Math.random() * 3000, until: 0 });
        img = spr;
      } else {
        img = kitImage(this, cx, bottom, npc.sprite);
      }
      img.setOrigin(0.5, 1).setDepth(bottom);
      const fire = this.b.map.props.find((p) => p.fire === true && p.id !== undefined && Math.max(Math.abs(p.x - t[0]), Math.abs(p.y - t[1])) <= 2);
      const cut = fire?.id === undefined ? undefined : adopt(new Phaser.GameObjects.Image(this, cx, bottom, img.texture.key, img.frame.name)).setOrigin(0.5, 1).setVisible(false);
      if (cut && fire?.id !== undefined) this.fireSide.push({ img, cut, fire: fire.id });
      // a slow breath so people read as alive
      this.tweens.add({ targets: cut ? [img, cut] : img, scaleY: rel(img, 1, 1.04).y, duration: 900 + (id.length % 5) * 120, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      this.npcAt.set(key(t[0], t[1]), id);
      this.tops.set(key(t[0], t[1]), unitOf(npc.sprite)?.h ?? 24);
    }
  }

  private buildRestores(): void {
    for (const [id, r] of Object.entries(this.b.restores)) {
      const slot = findSlot(this.b.map, r.place.slot);
      const unit = unitOf(r.before);
      if (!slot || !unit) continue;
      const art: Phaser.GameObjects.Image[] = [];
      if (unit.w === T && unit.h === T) {
        for (let y = slot.y; y < slot.y + slot.h; y++) {
          for (let x = slot.x; x < slot.x + slot.w; x++) {
            art.push(kitImage(this, x * T, y * T, r.before).setOrigin(0).setDepth(DEPTH.restore));
          }
        }
      } else {
        const bottom = (slot.y + slot.h) * T;
        art.push(kitImage(this, (slot.x + slot.w / 2) * T, bottom, r.before).setOrigin(0.5, 1).setDepth(bottom));
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
      const spr = kitSprite(this, cx, bottom, c.sprite).setOrigin(0.5, 1).setDepth(bottom).setAlpha(0);
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

  /**
   * The fog of every empty slot, baked once into one texture (so the fog draws in one batch, not one per
   * slot): for each slot and each of its two layers, the fog tile (shifted by `offset`) over the slot and
   * FOG_FEATHER px past it, cut to a rounded shape whose edge thins out through a 4x4 ordered dither, the
   * way the night hole's edge steps. A frame of the texture is named `<slot id>:<offset>`. False when the
   * kit has no fog tile.
   */
  private bakeFog(): boolean {
    if (this.textures.exists(FOG_ATLAS)) return true;
    if (!this.textures.exists(FOG_SPRITE)) return false;
    const src = this.textures.get(FOG_SPRITE).getSourceImage() as CanvasImageSource;
    const tile = document.createElement('canvas');
    tile.width = tile.height = FOG_TILE;
    const tc = tile.getContext('2d');
    if (!tc) return false;
    tc.drawImage(src, 0, 0, FOG_TILE, FOG_TILE);
    const px = tc.getImageData(0, 0, FOG_TILE, FOG_TILE).data;
    // shelf-pack the patches, a row at a time
    const patches: { name: string; x: number; y: number; w: number; h: number; data: Uint8ClampedArray<ArrayBuffer> }[] = [];
    let x = 0;
    let y = 0;
    let rowH = 0;
    for (const s of this.empty) {
      for (const offset of FOG_OFFSETS) {
        const w = s.w * T + 2 * FOG_FEATHER;
        const h = s.h * T + 2 * FOG_FEATHER;
        if (x + w > FOG_ATLAS_W) {
          x = 0;
          y += rowH;
          rowH = 0;
        }
        patches.push({ name: `${s.id}:${offset}`, x, y, w, h, data: fogPixels(px, s.w * T, s.h * T, offset) });
        x += w;
        rowH = Math.max(rowH, h);
      }
    }
    const tex = this.textures.createCanvas(FOG_ATLAS, FOG_ATLAS_W, Math.max(1, y + rowH));
    if (!tex) return false;
    const ctx = tex.getContext();
    for (const q of patches) {
      ctx.putImageData(new ImageData(q.data, q.w, q.h), q.x, q.y);
      tex.add(q.name, 0, q.x, q.y, q.w, q.h);
    }
    tex.refresh();
    return true;
  }

  private buildFog(): void {
    this.empty = emptySlots(this.b);
    const baked = this.bakeFog();
    for (const s of this.empty) {
      // two thin layers swaying against each other read as mist, not as clouds; each is baked with a soft,
      // dithered edge, so a slot's fog is a patch of mist and not a rectangle of the tile
      for (const [alpha, offset] of [[0.55, FOG_OFFSETS[0]], [0.45, FOG_OFFSETS[1]]] as const) {
        if (!baked) continue;
        const fog = this.add.image(s.x * T - FOG_FEATHER, s.y * T - FOG_FEATHER, FOG_ATLAS, `${s.id}:${offset}`).setOrigin(0).setDepth(DEPTH.fog).setAlpha(alpha);
        fog.setData('home', fog.x);
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
      kitImage(this, cx, bottom, SIGN_SPRITE).setOrigin(0.5, 1).setDepth(DEPTH.flat);
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
    this.buildAir();
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

  /**
   * The air over the valley (sky.ts, STYLE section 7 cue 3): one patch of ink at 12% that drifts across the ground
   * by day, and two pale banks that gather before dawn and after dusk. Both are drawn under the mist's veil, so the
   * player is cut out of them as the player is cut out of the haze.
   */
  private buildAir(): void {
    if (!RICH.light) return;
    // both textures are baked at the world's own density, so a texel lands on a screen pixel and no shape is
    // drawn twice its size; a tile is then a quarter of its own pixels, which tileScale says
    const side = CLOUD_TILE * AIR_DENSITY;
    // one patch per weight of sky, so a clear day has none, a still day one, and a heavy day many
    CLOUD_BUCKETS.forEach((cover, k) => {
      const tex = this.textures.createCanvas(`fx-cloud-${k}`, side, side);
      if (!tex) return;
      const img = tex.getContext().createImageData(side, side);
      img.data.set(cloudPixels(side, cover));
      tex.getContext().putImageData(img, 0, 0);
      tex.refresh();
    });
    if (new URLSearchParams(location.search).has('debug')) {
      const asked = Number(new URLSearchParams(location.search).get('cloud'));
      if (Number.isInteger(asked) && asked >= 0 && asked < CLOUD_BUCKETS.length) this.cloudForce = asked;
    }
    if (this.textures.exists('fx-cloud-0')) {
      // three by three copies of one patch: a tile sprite drew its overlapping edge twice and doubled the shade
      for (let j = 0; j < 3; j++) {
        for (let i = 0; i < 3; i++) {
          const img = this.add.image(0, 0, 'fx-cloud-0').setOrigin(0).setScale(1 / AIR_DENSITY).setDepth(DEPTH.flat - 0.3).setAlpha(0);
          this.clouds.push(img);
        }
      }
    }
    const banks = [
      { key: 'fx-bank-high', tile: BANK_TILE.high, drift: BANK_DRIFT.high, seed: 1.7 },
      { key: 'fx-bank-thin', tile: BANK_TILE.thin, drift: BANK_DRIFT.thin, seed: 3.1 },
      { key: 'fx-bank-low', tile: BANK_TILE.low, drift: BANK_DRIFT.low, seed: 4.3 },
    ];
    banks.forEach((b, i) => {
      const img = this.add.image(0, 0, '__DEFAULT').setOrigin(0).setScale(1 / AIR_DENSITY).setAlpha(0);
      this.banks.push({ img, key: b.key, tile: b.tile, seed: b.seed, drift: b.drift, at: BANK_AT[i] ?? 0.5, periods: 0, moved: 0 });
    });
    this.cutBanks(this.cameras.main.worldView.width);
  }

  /**
   * Cuts each bank to the view: whole periods of its own pattern, the view's width and one period of margin past
   * each end, so a wide screen never meets a vertical edge and the drift wraps without a seam.
   */
  private cutBanks(viewWidth: number): void {
    const need = viewWidth + 2 * BANK_PERIOD;
    for (const b of this.banks) {
      const periods = Math.ceil(need / BANK_PERIOD) + 1;
      if (periods === b.periods) continue;
      b.periods = periods;
      const px = periods * BANK_PERIOD * AIR_DENSITY;
      const ph = b.tile * AIR_DENSITY;
      const key = `${b.key}-${periods}`;
      if (!this.textures.exists(key)) {
        const tex = this.textures.createCanvas(key, px, ph);
        if (!tex) continue;
        const img = tex.getContext().createImageData(px, ph);
        img.data.set(bankPixels(px, ph, b.seed, true, BANK_PERIOD * AIR_DENSITY));
        tex.getContext().putImageData(img, 0, 0);
        tex.refresh();
      }
      b.img.setTexture(key);
    }
    this.bankView = viewWidth;
  }

  /**
   * The air keeps the view and drifts on the valley's wind: the cloud patch is anchored in the world, so walking
   * under it moves it the other way, and a bank slides along its own length a little faster than the one above.
   */
  private driftAir(time: number, delta: number): void {
    const view = this.cameras.main.worldView;
    if (this.clouds.length > 0) {
      // the patch is anchored in the world and wraps at its own edge, so the copies hand the cloud on to each other
      const off = cloudDrift(time, RICH.motion);
      const dx = ((off.x % CLOUD_TILE) + CLOUD_TILE) % CLOUD_TILE;
      const dy = ((off.y % CLOUD_TILE) + CLOUD_TILE) % CLOUD_TILE;
      const left = Math.floor(view.x) - CLOUD_TILE + dx;
      const top = Math.floor(view.y) - CLOUD_TILE + dy;
      this.clouds.forEach((img, k) => img.setPosition(left + (k % 3) * CLOUD_TILE, top + Math.floor(k / 3) * CLOUD_TILE));
    }
    if (view.width !== this.bankView) this.cutBanks(view.width);
    for (const b of this.banks) {
      // a reader who asked for reduced motion keeps the banks and loses only their drift (G29)
      if (RICH.motion) b.moved += (b.drift * delta) / 1000;
      const drift = ((b.moved % BANK_PERIOD) + BANK_PERIOD) % BANK_PERIOD;
      b.img.setPosition(view.x - BANK_PERIOD + drift, view.y + view.height * b.at - b.tile / 2);
    }
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
    c.setVisible(p.visible).setTexture(p.texture.key, p.frame.name).setPosition(p.x, p.y).setFlipX(p.flipX).setAngle(p.angle).setScale(p.scaleX, p.scaleY);
  }

  /**
   * The dark frame closing in from the edges: the Vignette filter's curve (a sine of the distance from the
   * middle, toward ink), drawn at a quarter of the screen and smoothed up. Redrawn only when it changes.
   */
  private drawFrame(): void {
    const img = this.vignette;
    if (!img) return;
    const { strength, radius } = this.frameLook;
    // a quarter of the screen in CSS pixels, so the work does not grow with the device's density
    const w = Math.max(8, Math.ceil(this.scale.width / (4 * pixelRatio())));
    const h = Math.max(8, Math.ceil(this.scale.height / (4 * pixelRatio())));
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
  bind(session: GameSession): void {
    for (const off of this.unbind) off();
    if (this.room) {
      this.scene.stop(ROOM);
      this.outside();
    }
    this.session = session;
    this.work = null;
    this.auto = null;
    this.held.clear();
    this.look = session.facing;
    this.falling = false;
    this.stoneHeld = false;
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
      session.on('events', (events) => {
        this.celebrate(events);
        for (const event of events) if (event.e === 'cue') this.playCue(event);
      }),
      session.on('change', () => this.refresh()),
    ];
    this.player.setVisible(true);
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
    this.body.place([x, y]);
    this.drawBody();
  }

  /** The sprite where the body stands, on the art's pixel grid: standing in a tile's middle, it stands on the tile's foot as before. */
  private drawBody(): void {
    const unit = T / ART_PX;
    const x = Math.round(this.body.x) * unit;
    const y = Math.round(this.body.y) * unit + T / 2;
    this.player.setPosition(x, y);
    this.player.setDepth(Math.round(y) + 1);
    // the cast layer draws the player's shadow (buildCasters); light-cast has no fx-shadow ellipse
  }

  /** The race's sprite for a direction, in the look the player picked (races wear today's sheets until their own art). */
  playerFrame(dir: Dir, pose = 'walk', look?: Facing8): { key: string; flip: boolean } {
    const p = this.session?.state.player;
    const race = p ? this.b.races[p.race] : undefined;
    const first = Object.values(this.b.races)[0];
    const base = (p?.look === 1 && race?.sprite_alt) || race?.sprite || first?.sprite || '';
    const stem = pose === 'walk' ? base : base.replace(/_down$/, `_${pose}_down`);
    const of = (d: string) => stem.replace(/_down$/, `_${d}`);
    const has = (k: string) => k in this.b.sprites;
    const none = { key: '', flip: false };
    if (pose !== 'walk' && !has(stem)) return none;
    // the rig's diagonals (23.10) for the walk and the blink; work poses stay four-way
    const diagonal = look && (pose === 'walk' || pose === 'idle') ? diagonalSheet(stem, look, dir, has) : undefined;
    if (diagonal) return diagonal;
    if (dir === 'down') return { key: stem, flip: false };
    if (dir === 'right' && !has(of('right'))) {
      if (has(of('left'))) return { key: of('left'), flip: true };
      return pose !== 'walk' ? none : { key: stem, flip: false };
    }
    if (has(of(dir))) return { key: of(dir), flip: false };
    return pose !== 'walk' ? none : { key: stem, flip: false };
  }

  /** The drawn facing, or the four-way one when something else turned the player (a load, a turn in place). */
  private lookOf(s: GameSession): Facing8 {
    return agrees(this.look, s.facing) ? this.look : s.facing;
  }

  private faceFrame(frame?: number): void {
    const s = this.session;
    if (!s) return;
    const { key: k, flip } = this.playerFrame(s.facing, 'walk', this.lookOf(s));
    const frames = this.b.sprites[k]?.frames ?? 1;
    if (frames === 1) retex(this.player, k);
    else retex(this.player, k, Math.min(frames - 1, frame ?? (frames >= 3 ? 1 : 0)));
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
    retex(this.player, k, down ? 1 : 0);
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
      for (const img of art) retex(img, done ? r.after : r.before);
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
    (this.piles ??= new Piles(this, this.b, DEPTH.dig, DIG_SPOT_SPRITE)).refresh(s.state);
    if (RICH.motion) this.refreshGlints(s);
  }

  private ready(s: GameSession, id: string): boolean {
    if (this.appearing.has(id)) return s.appears(id);
    return (s.state.nodes[id]?.readyAt ?? 0) <= s.tick;
  }

  /**
   * A few yellow sparks rise over every target of the first open step of the main task (the
   * nodes that give the item, the site to mend, the camp to build, the place to visit, the
   * giver once the task is ready to hand in), so the next place to go reads from the map
   * itself. Rebuilt only when the targets change; off with the rest of the motion group.
   */
  private refreshGlints(s: GameSession): void {
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
      if (this.appearing.has(id)) {
        // it fades in while its condition holds, and out once it is taken or the condition ends
        const want = this.ready(s, id) ? 1 : 0;
        img.setAlpha(Math.abs(want - img.alpha) < 0.02 ? want : img.alpha + (want - img.alpha) * 0.5);
        continue;
      }
      const r = this.b.resources[this.b.instances[id]!.source]!;
      const ready = this.ready(s, id);
      const inHours = !r.hours || (r.hours[0] < r.hours[1] ? hour >= r.hours[0] && hour < r.hours[1] : hour >= r.hours[0] || hour < r.hours[1]);
      // a gathered node lies flat and faded, the way over it open; a tree is a stump, a sapling and a young tree on its way back, upright
      const look = nodeLook(r, (s.state.nodes[id]?.readyAt ?? 0) - s.tick);
      // the texture is set only when it changes, so a frame the sway picked stays
      if (img.texture.key !== look.sprite) retex(img, look.sprite);
      if (look.flat) img.setAlpha(look.alpha).setDepth(DEPTH.flat);
      else img.setAlpha(ready && !inHours ? 0.55 : look.alpha).setDepth(img.y);
      const caster = this.cast?.of(img);
      if (caster) caster.enabled = ready;
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
    // a slot's fog sways only while it is in view: off screen it is neither moved nor drawn
    const view = this.cameras.main.worldView;
    this.fogs.forEach((fog, i) => {
      const home = fog.getData('home') as number;
      const seen = home + fog.width + 3 > view.x && home - 3 < view.right && fog.y + fog.height > view.y && fog.y < view.bottom;
      fog.setVisible(seen);
      if (seen) fog.x = home + Math.sin(time * 0.0004 + i) * (i % 2 === 0 ? 3 : -3);
    });
    this.animate(time, delta);
    this.chunks?.update(this.cameras.main.worldView);
    this.placePinned();
    const s = this.session;
    if (!s || !s.started) {
      sound.crackle(0);
      this.attract(delta);
      return;
    }
    // the world keeps the wall clock, as the 3D door does. Phaser's delta is not it: for 120 frames after the game starts
    // or the page regains focus it is held to 16.7 ms, and a frame over 200 ms counts as an older, shorter one. A desktop
    // view under software GL draws ~9 frames a second, so the world crawled at a sixth of its speed (DECISIONS.md, 2026-10-18)
    const real = Math.min(LONGEST_FRAME_MS, this.game.loop.rawDelta);
    s.advance(real);
    const clears = this.drawMist(s, real);
    this.placeMote(s, clears, time);
    this.placeSmoke(s, clears, time);
    this.placePredators(s);
    this.refreshIn -= real;
    if (this.refreshIn <= 0) {
      this.refreshIn = 250;
      this.refreshNodes();
      this.refreshFires(s);
      this.shadeFor(s);
      this.showSignatures(s);
      this.hearPlace(s);
    }
    this.walk(s, real);
    this.cast?.update(minuteOfDay(this.b, s.tick), this.cameras.main.worldView);
    const playerCaster = this.cast?.of(this.player);
    if (playerCaster) playerCaster.enabled = !this.falling;
    this.dimInCover(s);
    this.stillReports.frame(this.b, s, this.hazards, !this.body.moving && !this.falling, app.ui.blocking);
    this.playSong(s);
    this.placeLantern(s);
    if (RICH.motion) this.idle(s, time);
    this.workTick(s);
    this.drawFishing(s, time);
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
    this.driftAir(time, delta);
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
    // a burning flame breathes: a small sway and a flicker in its size, never a count of anything.
    // the valley's wind leans it, the same slow gust on every fire, while the burn itself is untouched (G48)
    if (RICH.motion) {
      const wind = Math.sin(time / 1700) * 0.6 + Math.sin(time / 4700 + 1.3) * 0.4;
      for (const f of this.fires.values()) {
        if (!f.flame.visible) continue;
        f.flame.setScale(
          f.baseX * (1 + 0.07 * Math.sin(time / 130 + f.phase)),
          f.baseY * (1 + 0.05 * Math.sin(time / 170 + f.phase * 1.3)),
        );
        f.flame.x = f.spr.x + 0.6 * Math.sin(time / 210 + f.phase) + wind * 1.6;
        // new smoke and embers leave the fire a little downwind, so the flame's lean and the drift agree
        f.smoke?.setPosition(f.spr.x + wind * 1.5, f.spr.y - 12);
        f.sparks?.setPosition(f.spr.x + wind * 1.2, f.spr.y - 6);
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
        g.img.setAlpha(level * (g.strength ?? 1) * (0.8 + 0.2 * flicker));
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

  /**
   * The cues a step starts (docs/design/REACTIONS.md, section 5): the kernel names them on the edge of
   * their reach and sends them with the step's events, so a phone that holds no seed draws the same ones.
   */
  private playCue(hit: { cue: string; x: number; y: number }): void {
    const look = CUE_LOOK[hit.cue as keyof typeof CUE_LOOK];
    if (!look) return;
    const s = this.session;
    if (!s) return;
    const x = hit.x * T + T / 2;
    const y = hit.y * T + T / 2;
    const at = this.worldToPage(x, y);
    const pan = Math.max(-0.8, Math.min(0.8, (at.x / Math.max(1, this.scale.width / pixelRatio()) - 0.5) * 1.2));
    const far = Math.max(Math.abs(hit.x - s.pos[0]), Math.abs(hit.y - s.pos[1]));
    sound.sfx(look.sfx, { pan, gain: cueGain(far) });
    const depth = look.over ? DEPTH.motes + 1 : DEPTH.flat;
    if (hit.cue === 'birds_lift') this.liftBirds(x, y, look.ms, depth);
    else this.ripple(x, y + 3, look.ms, depth);
  }

  /** A few birds lift from the tile and climb away, flapping; with the motion group off, the flock is a still shape. */
  private liftBirds(x: number, y: number, ms: number, depth: number): void {
    if (!RICH.motion) {
      const still = this.add.image(x, y - 8, 'fx-birds').setDepth(depth);
      this.tweens.add({ targets: still, alpha: 0, delay: ms * 0.6, duration: ms * 0.4, onComplete: () => still.destroy() });
      return;
    }
    for (const bird of BIRDS) {
      const img = this.add.image(x + bird.dx, y, 'fx-bird-0').setDepth(depth).setAlpha(0);
      const flap = this.time.addEvent({ delay: 90, loop: true, callback: () => img.setTexture(img.texture.key === 'fx-bird-0' ? 'fx-bird-1' : 'fx-bird-0') });
      this.tweens.addCounter({
        from: 0,
        to: 1,
        duration: ms,
        delay: bird.delay,
        onUpdate: (tw) => {
          const k = tw.getValue() ?? 0;
          // whole pixels, rising fast at first; seen a moment, then gone into the sky
          img.setPosition(Math.round(x + bird.dx + bird.drift * k), Math.round(y - bird.rise * Math.sqrt(k)));
          img.setAlpha(k < 0.1 ? k * 10 : k > 0.7 ? (1 - k) / 0.3 : 1);
        },
        onComplete: () => {
          flap.remove();
          img.destroy();
        },
      });
    }
  }

  /** A fish rises: a ring on the water that widens and fades; with the motion group off, one ring that fades where it is. */
  private ripple(x: number, y: number, ms: number, depth: number): void {
    const ring = this.add.image(x, y, 'fx-ripple').setDepth(depth).setAlpha(0.9);
    if (!RICH.motion) {
      this.tweens.add({ targets: ring, alpha: 0, delay: ms * 0.6, duration: ms * 0.4, onComplete: () => ring.destroy() });
      return;
    }
    ring.setScale(0.4);
    this.tweens.add({ targets: ring, scale: 1.4, alpha: 0, duration: ms, ease: 'Sine.out', onComplete: () => ring.destroy() });
  }

  /** Standing still for 3 s, the player blinks every 3-5 s: frame 1 of the idle sheet for 120 ms. */
  private idle(s: GameSession, time: number): void {
    if (this.falling) return;
    const still = !this.body.moving && !s.busy && !this.work && !this.auto && this.swingUntil === 0;
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
    const { key: k, flip } = this.playerFrame(s.facing, 'idle', this.lookOf(s));
    if (!k || (this.b.sprites[k]?.frames ?? 1) < 2) return;
    retex(this.player, k, 1);
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

  private canControl(s: GameSession): boolean {
    // while an action waits for the server the player has no control: nothing is sent twice
    return !this.entering && !this.room && !s.paused && !s.busy && !s.waiting && !app.ui.blocking && !this.peek.active;
  }

  /**
   * The free walk (NEXT 22 a): the body moves with the held input and slides along what it meets, and each tile
   * its feet enter is the player's, told to the kernel in order. The facing follows the motion's leading axis.
   */
  private walk(s: GameSession, delta: number): void {
    if (this.falling) return;
    // the session may have put the player elsewhere: a load, a fall, the server's tile taken back
    const moved = this.body.follow(s.pos);
    const was = this.body.moving;
    const input: [number, number] = this.canControl(s) ? app.controls.vector() : [0, 0];
    const facing = facingFor(input, s.facing);
    const look = facing8For(input, this.lookOf(s));
    const turned = facing !== s.facing || look !== this.look;
    s.facing = facing;
    this.look = agrees(look, facing) ? look : facing;
    for (const tile of this.body.frame(input, delta, walkStepMs(this.b, s.state), (x, y) => this.canWalk(s, x, y))) {
      if (RICH.motion) this.puffAt(s.pos[0], s.pos[1]);
      // the kernel hears of each new tile; a hazard there may hurt, and a fall ends the walk
      landStep(s, tile);
      if (this.falling) return;
      this.arrive(s);
    }
    // pushing up into a shop's door from the step in front of it walks in, once the body has stopped against it:
    // a walk that only passes over the step, or a turn, does not open the door
    const door = input[1] < 0 && s.facing === 'up' && !this.body.moving ? this.doors.get(key(s.pos[0], s.pos[1] - 1)) : undefined;
    if (door) {
      this.enter(door);
      return;
    }
    if (!this.body.moving && !was && !turned && !moved) return;
    this.drawBody();
    const walked = this.body.walked / ART_PX;
    if (this.body.moving) this.faceFrame(strideFrame(walked % 1, Math.floor(walked), this.b.sprites[this.playerFrame(s.facing, 'walk', this.look).key]?.frames ?? 1));
    else this.faceFrame();
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
  canWalk(s: GameSession, x: number, y: number): boolean {
    return canEnter(this.b, this.walkable, this.nodeAt, s, x, y);
  }

  private arrive(s: GameSession): void {
    const [x, y] = s.pos;
    (s as { seeAt?: () => void }).seeAt?.();
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
        const t = Object.values(this.b.treasures).find((d) => d.place.slot === slot.id && (d.pocket ?? s.state.player.pocket) === s.state.player.pocket);
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
  private enterMaze(s: GameSession): void {
    const from = this.lastAt;
    this.lastAt = [...s.pos];
    if (!from || s.state.player.chase) return;
    const p = s.state.player;
    const peek = peekOnStep(this.b, (q) => p.quests[q] === 'done', (x, y) => this.walkable(x, y, p), from, s.pos);
    if (peek) this.peek.show(peek);
  }

  // ------------------------------------------------------------ day, night and the things in the dark

  /** The campfire, the stream, the ruins and a burning fire sound as loud as the player is near them (soundscape.ts). */
  private hearPlace(s: GameSession): void {
    const scape = soundscape(this.b, s.state, s.tick, this.player.x / T, this.player.y / T - 0.5);
    for (const id of ['fire', 'stream', 'dread'] as const) sound.bed(id, scape[id].level, scape[id].pan);
    sound.crackle(scape.crackle.level, scape.crackle.pan);
  }

  /** Draws B2's mist for the places the save leaves clear (src/mist.ts); a new texture only when they change, and a growing one in steps. */
  private drawMist(s: GameSession, delta: number): Clear[] {
    const first = !this.mistReady;
    this.mistReady = true;
    const clears = mistClears(this.b, s.state).map((c) => {
      const at = `${c.x},${c.y}`;
      // a place mended while the scene runs opens from nothing; one already in the save (a reload) is drawn open
      const r = mistRadius(this.mistShown.get(at) ?? (first || c.rate === undefined ? c.r : 0), c.r, delta, c.rate);
      this.mistShown.set(at, r);
      return { ...c, r: mistStep(r) };
    });
    const key = JSON.stringify(clears);
    if (key === this.mistKey) return clears;
    this.mistKey = key;
    const { width, height } = this.b.map;
    const name = 'fx-mist';
    const tex = this.textures.exists(name) ? (this.textures.get(name) as Phaser.Textures.CanvasTexture) : this.textures.createCanvas(name, width * T, height * T);
    if (!tex) return clears;
    tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
    const ctx = tex.getContext();
    ctx.putImageData(new ImageData(mistPixels(clears, width, height, T), width * T, height * T), 0, 0);
    tex.refresh();
    this.mist.setTexture(name).setVisible(true);
    return clears;
  }


  /**
   * The explorer's mote (NEXT 16 c): a find picked up by hand that this start can see in the mist's thickening or
   * beyond lies hidden, so a mote of light stands on the way to it, at the pocket's edge from where the character is,
   * and on the find itself once it is near. Gone once the find is taken, or when the find stands in the clear.
   */
  private placeMote(s: GameSession, clears: Clear[], time: number): void {
    let want: { x: number; y: number } | undefined;
    if (attrAt(this.b, s.state, 'senses') > 0) {
      for (const id of this.digs.keys()) {
        const inst = this.b.instances[id]!;
        const t = this.b.treasures[inst.source];
        if (!t || t.tool || !spotOpen(this.b, s.state, id) || !this.ready(s, id)) continue;
        if (mistDensity(clears, this.b.map.width, this.b.map.height, inst.x + 0.5, inst.y + 0.5) === 0) continue;
        want = moteAt(s.pos, [inst.x, inst.y], clears[0]?.r ?? 5);
        break;
      }
    }
    if (!want) {
      this.mote?.setVisible(false);
      return;
    }
    if (!this.mote) {
      makeSensesTextures(this);
      this.mote = this.add.image(0, 0, 'senses-glint').setDepth(DEPTH.motes).setScale(2);
    }
    // the twinkle is slow and small: a sign, not an alarm
    this.mote.setPosition(want.x * T, want.y * T).setVisible(true).setAlpha(RICH.motion ? 0.7 + 0.3 * Math.sin(time / 380) : 1);
  }

  /**
   * The town's smoke as a marker (NEXT 16 d, frames hook-3-day-edge and hook-3-night-edge): one column of single
   * puffs bending at the top, held on the view's edge toward the nearest chimney while that is off screen, and
   * drawn at the chimney while it is in view but still under the mist (always, when the chimney has no smoke of its
   * own). It shows once the bridge is mended. It dims with the night.
   */
  private placeSmoke(s: GameSession, clears: Clear[], time: number): void {
    // the smoke is the bridge's pay: it shows once the first mend is in the save
    const chimney = s.state.player.restored.length > 0 ? nearestChimney(this.chimneys, { x: s.pos[0] * T, y: s.pos[1] * T }) : undefined;
    if (!chimney) {
      this.smokeMark.forEach((img) => img.setVisible(false));
      return;
    }
    if (this.smokeMark.length === 0) {
      this.smokeMark = SMOKE_PUFFS.map((p) => this.add.image(0, 0, 'fx-smoke-mark').setOrigin(0.5, 1).setScale(p.size).setDepth(DEPTH.motes + 1));
    }
    const at = smokeAt(this.cameras.main.worldView, chimney, SMOKE_INSET);
    // in view with the mist gone from it, the chimney's own thread of smoke is the cue
    const hidden = RICH.motion && !at.edge && mistDensity(clears, this.b.map.width, this.b.map.height, chimney.x / T, chimney.y / T) === 0;
    const alpha = smokeAlpha(this.night);
    const sway = RICH.motion ? Math.sin(time / 900) : 0;
    this.smokeMark.forEach((img, i) => {
      const p = SMOKE_PUFFS[i]!;
      img.setVisible(!hidden).setPosition(Math.round(at.x + p.dx + sway * (p.dx / 3)), Math.round(at.y + p.dy)).setAlpha(alpha * (1 - i * 0.12));
    });
  }

  private shadeFor(s: GameSession): void {
    const minute = minuteOfDay(this.b, s.tick);
    this.night = nightAt(minute);
    this.shade.setFillStyle(0x172a52, shadeAt(this.night));
    this.frameLook = frameAt(this.night, RICH.light);
    this.drawFrame();
    if (this.dusk) {
      // the hour's wash from params: cool before sunrise, none at noon, warm by 16:30, dusk at 19:00
      const wash = washAt(this.lightTable, minute);
      this.dusk.setFillStyle(wash.tint, wash.alpha);
    }
    for (const d of this.dapples) d.setAlpha(dappleAt(this.night));
    // the cloud shade goes with the sun; the banks gather before dawn and after dusk (sky.ts)
    const fog = fogStrength(minute);
    // the day's own sky: clear on some days, one cloud on others, heavy on a few
    const day = Math.floor(s.tick / this.b.params.day_length_ms);
    const k = this.cloudForce ?? cloudBucket(cloudCover(day));
    if (k !== this.cloudDay) {
      this.cloudDay = k;
      for (const c of this.clouds) c.setTexture(`fx-cloud-${k}`);
    }
    const clear = k === 0 ? 0 : 1 - this.night;
    for (const c of this.clouds) c.setAlpha(clear);
    // the banks keep their pale tone through the dark, so the night's one shade does not swallow them
    this.banks.forEach((b, i) =>
      b.img.setAlpha(Math.min(BANK_NIGHT_LIFT.cap, fog * (BANK_WEIGHT[i] ?? 0.9) * (1 + BANK_NIGHT_LIFT.gain * this.night))),
    );
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
  private haunt(s: GameSession, time: number): void {
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

  /** How dark the valley is now: 0 by day, 1 at night. */
  get darkness(): number {
    return this.night;
  }

  private worldToPage(x: number, y: number): { x: number; y: number } {
    const cam = this.cameras.main;
    // the page is laid out in CSS pixels, the canvas is in the device's
    return worldToPage(cam.worldView, cam.zoom, pixelRatio(), x, y);
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

  private showSignatures(s: GameSession): void {
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

  /** A cast moved on: the player faces the water, the arm comes over on the cast, and the view draws the rest. */
  fishPhase(nodeId: string, phase: FishPhase): void {
    const s = this.session;
    if (!s) return;
    this.faceNode(s, nodeId);
    if (phase === 'cast' || phase === 'reel') {
      this.work = { node: nodeId, kind: 'fish' };
      this.workFrame(true);
      this.swingUntil = this.time.now + 220;
    }
    this.fishing?.phase(nodeId, phase, this.time.now);
  }

  /** The dark shapes under every fishing spot that has fish, and the line while a cast is on. */
  private drawFishing(s: GameSession, time: number): void {
    if (!this.fishing) return;
    this.fishSpots ??= Object.keys(this.b.instances).filter((id) => this.b.resources[this.b.instances[id]!.source]?.game === 'fish');
    const view = this.cameras.main.worldView;
    const spots: { id: string; at: { x: number; y: number } }[] = [];
    for (const id of this.fishSpots) {
      const inst = this.b.instances[id]!;
      const x = inst.x * T + T / 2;
      const y = inst.y * T + T / 2;
      if (x < view.x - T || x > view.right + T || y < view.y - T || y > view.bottom + T) continue;
      if (this.ready(s, id) || this.work?.node === id) spots.push({ id, at: { x, y } });
    }
    const node = this.work?.kind === 'fish' ? placedAt(this.b, this.work.node) : undefined;
    const toward = node && node.x * T + T / 2 < this.player.x ? -1 : 1;
    this.fishing.draw(time, spots, { x: this.player.x + toward * 3, y: this.player.y - 9 }, toward);
  }

  private faceNode(s: GameSession, nodeId: string): void {
    const inst = placedAt(this.b, nodeId);
    if (!inst) return;
    const dx = inst.x - s.pos[0];
    const dy = inst.y - s.pos[1];
    if (dx === 0 && dy === 0) return;
    const dir: Dir = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
    s.facing = dir;
  }

  private impact(nodeId: string, kind: WorkKind, grade?: Grade): void {
    const inst = placedAt(this.b, nodeId);
    if (!inst) return;
    const x = inst.x * T + T / 2;
    const y = inst.y * T + T * 0.6;
    const at = this.worldToPage(x, y);
    const pan = Math.max(-0.8, Math.min(0.8, (at.x / Math.max(1, this.scale.width / pixelRatio()) - 0.5) * 1.2));
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
      this.tweens.add({ targets: img, x: x0 + (kind === 'pick' ? 0 : 1), scaleY: rel(img, 1, kind === 'pick' ? 0.92 : 1).y, duration: 50, yoyo: true, repeat: 1, onComplete: () => setRel(img.setX(x0), 1) });
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

  private drawBusy(s: GameSession, time: number): void {
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
  private showHazards(s: GameSession): void {
    const night = isNight(this.b, s.tick);
    for (const h of this.hazards) {
      const { spr, kind, rule, eyes, halo } = h;
      if (kind === 'predator') {
        const frame = night && spr.texture.frameTotal > 2 ? 1 : 0;
        if (Number(spr.frame.name) !== frame) spr.setFrame(frame);
        const awake = rule !== undefined && windowOpen(this.b, rule, s.tick);
        spr.setVisible(this.wolfShown(h, s));
        eyes?.setVisible(awake);
        halo?.setVisible(awake);
      } else {
        spr.setAlpha(night ? 0.12 : 1);
      }
    }
  }

  /** Whether a predator is drawn now: by day it is away and only its den and tracks show (`wolfDrawnAt`). */
  private wolfShown(h: { rule?: Hazard; run?: Run }, s: GameSession): boolean {
    const chase = s.state.player.chase;
    const awake = h.rule !== undefined && windowOpen(this.b, h.rule, s.tick);
    return wolfDrawnAt(awake, chase !== null && chase.hazard === h.rule?.id, h.run !== undefined);
  }

  /**
   * Draw a walking predator from the kernel's clock and round, and while the kernel's hunt names
   * it, running after the player and then back to its round (`wolfDrawn`): drawn only, as the kernel
   * keeps it on its round and bites by its own clock. The moment a predator sees the player a "!"
   * stands over it, and a walking wolf's eyes flare (`SEEN`).
   */
  private placePredators(s: GameSession): void {
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
      spr.setPosition(Math.round((x + 0.5) * T), Math.round(bottom)).setDepth(Math.round(bottom)).setVisible(this.wolfShown(h, s));
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
  private huntWalk(s: GameSession): (x: number, y: number) => boolean {
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
  private playSong(s: GameSession): void {
    if (this.wasNight === undefined) return;
    const song = huntSong(s.state.player.chase !== null, this.wasNight);
    if (song === this.song) return;
    sound.music(song, songFade(this.song, song));
    this.song = song;
  }

  /** Reeds and tall grass marked as cover soften the player, then release them at the next tile. */
  private dimInCover(s: GameSession): void {
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
  private placeLantern(s: GameSession): void {
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
    this.work = null;
    this.swingUntil = 0;
    // the fall ends any work: nothing may put the standing frame back while the body sinks
    this.busyMs = 0;
    this.placePlayer(from[0], from[1]);
    const { key: k, flip } = this.playerFrame('down');
    retex(this.player, k, (this.b.sprites[k]?.frames ?? 1) >= 3 ? 1 : 0).setFlipX(flip);
    // the eyes of a 16x24 body sit on its sixth row, three pixels apart
    const top = this.player.y - this.player.displayHeight;
    const eyes = [-3, 2].map((dx) => this.add.image(this.player.x + dx, top + 6, 'fx-cross').setOrigin(0.5).setDepth(this.player.depth + 0.5));
    const baseY = this.player.y;
    // the body's height in world units; the crop is in the texture's own pixels
    const height = this.player.displayHeight;
    const back = 1 / baseOf(this.player);
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
        this.player.setY(baseY + sunk).setCrop(0, 0, this.player.width, (height - sunk) * back);
        this.cutout?.setCrop(0, 0, this.player.width, (height - sunk) * back);
        for (const eye of eyes) eye.setY(top + 6 + sunk).setVisible(sunk < 6);
      },
      onComplete: () => {
        for (const eye of eyes) eye.destroy();
        this.cameras.main.fadeOut(300, 27, 26, 46);
        this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
          this.player.setCrop();
          this.cutout?.setCrop();
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
   * it. A step away takes the action back (GameSession.cancelWork), so nothing was yielded.
   */
  async startWork(nodeId: string, onDone?: () => void): Promise<void> {
    const s = this.session;
    const inst = placedAt(this.b, nodeId);
    if (!s || !inst || this.auto) return;
    const kind = inst.kind === 'resource' ? resourceKind(resourceOf(this.b, nodeId)!) : treasureKind(this.b.treasures[inst.source]!);
    if (!kind) return;
    const action: Action = inst.kind === 'resource' ? { t: 'gather', node: nodeId, grade: 3, at: s.pos } : { t: 'dig', spot: nodeId, grade: 3, at: s.pos };
    // an action on the server waits for its reply, so the work starts when the answer comes
    const res = await s.act(action);
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

  private workTick(s: GameSession): void {
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
  private stopWork(s: GameSession, w: Auto): void {
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
      setRel(img.setAngle(0), 1);
      img.x = (placedAt(this.b, w.node)!.x + 0.5) * T;
    }
  }

  private finishWork(s: GameSession, w: Auto): void {
    const img = this.nodes.get(w.node);
    // the tree that falls is a copy of the standing one, so the stump can be there under it at once
    const ghost = w.kind === 'fell' && img ? kitSprite(this, img.x, img.y, img.texture.key, img.frame.name).setOrigin(0.5, 1).setDepth(img.depth + 1).setAngle(img.angle) : undefined;
    this.endWork(w);
    this.refreshNodes();
    this.faceFrame();
    if (ghost) this.fall(ghost, w.facing, w.node);
    else if (w.kind === 'mine') this.breakStone(w.node);
    else this.burst(w.kind === 'dig' ? 'fx-dirt' : 'fx-dust', (placedAt(this.b, w.node)!.x + 0.5) * T, (placedAt(this.b, w.node)!.y + 0.6) * T, 8);
    w.onDone?.();
  }

  /** One blow: the arm lands, the thing sounds, shakes and throws bits; a tree leans a little more each time. */
  private blow(w: Auto, progress: number): void {
    const inst = placedAt(this.b, w.node);
    if (!inst) return;
    const x = inst.x * T + T / 2;
    const y = inst.y * T + T * 0.6;
    const at = this.worldToPage(x, y);
    const pan = Math.max(-0.8, Math.min(0.8, (at.x / Math.max(1, this.scale.width / pixelRatio()) - 0.5) * 1.2));
    const img = this.nodes.get(w.node) ?? this.digs.get(w.node);
    if (w.kind === 'fell') {
      sound.sfx('thud', { pan });
      // the wood starts to give: a crack under the blows past the middle
      if (progress > 0.5) sound.sfx('crack', { pan, gain: 0.25 + 0.5 * progress });
      this.burst('fx-chip', x, y, 6);
      if (progress > 0.4 && img) this.burst('fx-leaf', x, y - img.displayHeight * 0.6, 2 + Math.round(progress * 4));
    } else if (w.kind === 'mine') {
      sound.sfx('strike', { pan });
      // the stone starts to give as the wood does: a crack under the blows past the middle, more chips each time
      if (progress > 0.5) sound.sfx('crack', { pan, gain: 0.2 + 0.4 * progress });
      this.burst('fx-dust', x, y, 5);
      this.burst('fx-spark', x, y - 4, 3);
      this.burst('fx-chip', x, y - 2, 2 + Math.round(progress * 4));
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
    this.tweens.add({ targets: img, x: x0 + shake, scaleY: rel(img, 1, w.kind === 'dig' ? 0.92 : 1).y, angle: lean, duration: 50, yoyo: true, repeat: 1, onComplete: () => setRel(img.setX(x0), 1).setAngle(lean) });
  }

  /** The last blow splits the stone: a sharp crack, chips and dust thrown wide, and a small jolt as a tree's fall has. */
  private breakStone(id: string): void {
    const inst = placedAt(this.b, id)!;
    const x = (inst.x + 0.5) * T;
    const y = (inst.y + 0.6) * T;
    sound.sfx('crack', { gain: 0.8 });
    this.burst('fx-chip', x, y - 2, 10);
    this.burst('fx-dust', x, y, 10);
    this.burst('fx-spark', x, y - 4, 4);
    this.cameras.main.shake(90, 0.002);
  }

  /** The tree goes over, away from the one who cut it, and lies there a moment before it fades. */
  private fall(ghost: Phaser.GameObjects.Sprite, dir: Dir, id: string): void {
    const inst = placedAt(this.b, id)!;
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
        scaleY: rel(ghost, 1, 0.18).y,
        y: dir === 'down' ? ghost.y + 5 : ghost.y,
        duration: 520,
        ease: 'Quad.easeIn',
        onComplete: land,
      });
    }
  }

  /** A soft light on the thing just made: it rises, holds and fades within `SUCCESS_LIGHT_MS`, then is gone. */
  private successLight(x: number, y: number): void {
    const img = this.add.image(x, y, 'fx-glow').setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.fx).setAlpha(0).setScale(2);
    this.tweens.chain({
      targets: img,
      tweens: [
        { alpha: SUCCESS_LIGHT.alpha, duration: SUCCESS_LIGHT.rise },
        { alpha: SUCCESS_LIGHT.alpha, duration: SUCCESS_LIGHT.hold },
        { alpha: 0, duration: SUCCESS_LIGHT.fade },
      ],
      onComplete: () => img.destroy(),
    });
  }

  /** A little lift of every new item over the player's head, and a cloud when something is built. */
  private celebrate(events: GameEvent[]): void {
    if (!this.falling) this.faceFrame();
    let i = 0;
    for (const e of events) {
      // the jolt and the flash belong to danger (joltOf); a success moves no camera and flashes nothing
      const jolt = joltOf(e, RICH.motion);
      if (jolt?.flash) this.cameras.main.flash(jolt.flash.ms, ...jolt.flash.rgb);
      if (jolt?.shake) this.cameras.main.shake(jolt.shake.ms, jolt.shake.intensity);
      if (e.e === 'fall') this.fallDown(e.from, e.at);
      if (e.e === 'restore' || e.e === 'build') {
        const slot = e.e === 'restore' ? findSlot(this.b.map, this.b.restores[e.restore]?.place.slot ?? '') : undefined;
        const camp = e.e === 'build' ? campTile(this.b, this.b.camps[e.camp]?.slot ?? 'fire') : undefined;
        const cx = slot ? (slot.x + slot.w / 2) * T : camp ? camp[0] * T + T / 2 : this.player.x;
        const cy = slot ? (slot.y + slot.h / 2) * T : camp ? camp[1] * T + T / 2 : this.player.y;
        this.burst('fx-dust', cx, cy, 18);
        this.burst('fx-spark', cx, cy - 6, 12);
        this.successLight(cx, cy);
      }
      // the far bell, once: after the first mend a save has ever had, never before it and never on a reload
      if (e.e === 'restore' && this.session && farBellDue(this.session.state.player.restored, e.restore)) {
        this.time.delayedCall(FAR_BELL.delayMs, () => sound.sfx('bell', { gain: FAR_BELL.gain, lowpass: FAR_BELL.lowpass, detune: FAR_BELL.detune }));
      }
      if (e.e === 'fire') {
        // the fire the player just kindled has no sprite until the next refresh: build it now, so its sparks land on it
        if (e.id === OWN_FIRE && this.session) this.ensureOwnFire(this.session);
        const f = this.fires.get(e.id);
        const s = this.session;
        // lit after its night was lost: no sparks of cheer
        if (f && !(s && feedTooLate(this.b, s.state, e.id, s.state.tick))) this.burst('fx-spark', f.spr.x, f.spr.y - 8, 10);
      }
      if (e.e !== 'gain') continue;
      const ref = this.b.items[e.item]?.sprite;
      if (!ref || !this.b.sprites[ref]) continue;
      const img = kitImage(this, this.player.x, this.player.y - 24, ref).setDepth(DEPTH.fx);
      this.tweens.add({ targets: img, y: img.y - 14, alpha: 0, delay: i * 120, duration: 900, onComplete: () => img.destroy() });
      i++;
    }
  }

  // ------------------------------------------------------------ interaction

  private updatePrompt(s: GameSession): void {
    const t = this.canControl(s) ? this.target(s) : undefined;
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
    if (this.room) return this.room.interact();
    if (!s || !this.canControl(s)) return;
    this.target(s)?.run();
  }

  /** Walk in through a shop's door: the room opens over the valley, which waits behind with its clock running. */
  private enter(npcId: string): void {
    const s = this.session;
    if (!s || this.room || this.entering) return;
    this.prompt = '';
    app.ui.setPrompt('');
    this.marker.setVisible(false);
    sound.sfx('step');
    this.entering = true;
    const go = () => {
      this.entering = false;
      this.cameras.main.setVisible(false);
      this.labels.style.visibility = 'hidden';
      this.scene.launch(ROOM, { npc: npcId, world: this, onLeave: () => this.outside() });
      this.room = this.scene.get(ROOM) as RoomScene;
    };
    if (RICH.light) {
      this.cameras.main.fadeOut(200, 27, 26, 46);
      this.cameras.main.once('camerafadeoutcomplete', go);
    } else go();
  }

  /** Back on the doorstep, facing out. */
  private outside(): void {
    this.room = undefined;
    const s = this.session;
    const cam = this.cameras.main;
    cam.setVisible(true);
    this.labels.style.visibility = '';
    if (s) {
      s.facing = 'down';
      this.look = 'down';
      this.placePlayer(s.pos[0], s.pos[1]);
      this.faceFrame();
    }
    if (RICH.light) cam.fadeIn(260, 27, 26, 46);
    else cam.resetFX();
  }

  private target(s: GameSession): Target | undefined {
    const [x, y] = s.pos;
    const [fx, fy] = DIRS[s.facing];
    const order: [number, number][] = [facedTile(s), [x, y]];
    for (const [dx, dy] of NEIGHBOURS) {
      if (dx === fx && dy === fy) continue;
      order.push([x + dx, y + dy]);
    }
    for (const [tx, ty] of order) {
      const t = this.targetAt(s, tx, ty);
      if (t) return t;
    }
    // nothing else to do here: with two logs and outside the town, the ground ahead takes a fire (NEXT 21b).
    // It comes after every other target, so a fire never hides a thing the player already faces.
    return this.kindleTarget(s);
  }

  /**
   * The Build a fire button, where Build sits: on the tile the player faces, while the bag holds what kindling
   * takes and that tile lies outside the town. The kernel decides the rest and keeps the logs on a refusal.
   */
  private kindleTarget(s: GameSession): Target | undefined {
    if (!holdsKindling(this.b, s.state)) return undefined;
    const tile = facedTile(s);
    // the kernel tests the fire's tile, not the player's: one tile inside the edge facing out is allowed
    if (isTownTile(this.b, tile)) return undefined;
    return { label: 'Build a fire', run: () => app.ui.kindle(tile), tile, top: T };
  }

  private targetAt(s: GameSession, x: number, y: number): Target | undefined {
    const b = this.b;
    const p = s.state.player;
    const k = key(x, y);
    const tile: [number, number] = [x, y];
    const top = this.tops.get(k) ?? T;
    // a pile the player put down, under their feet
    const dropped = x === s.pos[0] && y === s.pos[1] ? pileAt(s.state, x, y) : undefined;
    if (dropped) return { label: `Pick up ${b.items[dropped]?.name ?? dropped}`, run: () => app.ui.pickUp(dropped), tile, top: T };
    const door = this.doors.get(k);
    if (door) {
      // the door is used from the step in front of it, facing in
      if (s.pos[0] !== x || s.pos[1] !== y + 1 || s.facing !== 'up') return undefined;
      const shop = b.shops[b.npcs[door]?.shop ?? ''];
      return { label: `Enter ${shop?.title ?? 'the shop'}`, run: () => this.enter(door), tile, top };
    }
    const npc = this.npcAt.get(k);
    if (npc) return { label: `Talk to ${b.npcs[npc]?.name ?? npc}`, run: () => app.ui.talk(npc), tile, top };
    const nodeId = this.nodeAt.get(k);
    if (nodeId) {
      const inst = placedAt(b, nodeId)!;
      if (inst.kind === 'resource') {
        const r = resourceOf(b, nodeId)!;
        // a gathered node is only ground until it grows back
        if (this.ready(s, nodeId)) {
          return { label: nodeAction(b, r), run: () => app.ui.gather(nodeId), tile, top: unitOf(r.sprite)?.h ?? T };
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
    // the fire of one's own stands on no prop: its tile is offered the same way (NEXT 21b)
    const own = s.state.player.own;
    if (own !== null && own.at[0] === x && own.at[1] === y && woodToFeed(b, s.state)) {
      return { label: `Feed the ${fireName(OWN_FIRE)}`, run: () => app.ui.feed(OWN_FIRE), tile, top };
    }
    // a prop lit by a fire reads only while that fire burns (lit_by)
    const lit = () => readable(s.state, this.litBy.get(k), s.tick);
    const sign = this.signs.get(k);
    if (sign) return { label: 'Read the sign', run: () => (lit() ? app.ui.sign(sign) : app.ui.note(TOO_DARK)), tile, top };
    const note = this.notes.get(k);
    if (note) return { label: `Look at the ${note.name}`, run: () => app.ui.note(lit() ? note.text : TOO_DARK), tile, top: note.top };
    const searchable = this.searches.get(k);
    if (searchable) return { label: 'Search', run: () => void app.ui.search(searchable), tile, top };
    const fog = this.empty.find((slot) => inRect(x, y, slot));
    const faced = facedTile(s);
    if (fog && x === faced[0] && y === faced[1]) {
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
    const stone = content.kind === 'restore' && p ? stoneView(b.restores[content.id], p.restored, p.name) : undefined;
    if (content.kind === 'restore' && p?.restored.includes(content.id) && !stone) lines.push(`Mended by ${p.name}.`);
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
        mendedBy: content.kind === 'restore' && p?.restored.includes(content.id) && !stone ? p.name : undefined,
        stone,
      },
    };
  }

  // ------------------------------------------------------------ view

  private fit(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    // 4j canvas pixels per unit, j whole (view.ts): the whole step at or above 1.5 times the screen's own
    const zoom = cameraZoom(Math.min(w, h));
    this.baseZoom = zoom;
    // a hold on the stone keeps its own zoom through a resize
    this.cameras.main.setZoom(this.stoneHeld ? this.heldZoom() : zoom);
    this.shade.setSize(w, h);
    this.dusk?.setSize(w, h);
    this.frameKey = '';
    this.drawFrame();
  }

  /** Where a tile is on the page, for UI that points at the world. */
  screenOf(x: number, y: number): { x: number; y: number } {
    return this.worldToPage(x * T + T / 2, y * T);
  }

  /**
   * The camera comes down to the returners' stone and holds close on it (NEXT 16 e, frame hook-2-stop-close). It
   * resolves when the glide is done, or at once when the player asked for reduced motion.
   */
  stoneStop(slotId: string): Promise<void> {
    const slot = findSlot(this.b.map, slotId);
    if (!slot) return Promise.resolve();
    const cam = this.cameras.main;
    const ms = RICH.motion ? STONE_GLIDE_MS : 0;
    this.stoneHeld = true;
    cam.stopFollow();
    const from = { z: cam.zoom };
    const sizeFrame = () => this.vignette?.setDisplaySize(this.scale.width / cam.zoom, this.scale.height / cam.zoom);
    if (ms === 0) {
      cam.setZoom(this.heldZoom());
      cam.centerOn((slot.x + slot.w / 2) * T, (slot.y + slot.h / 2) * T);
      sizeFrame();
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      cam.pan((slot.x + slot.w / 2) * T, (slot.y + slot.h / 2) * T, ms, 'Sine.easeInOut', true);
      this.tweens.add({
        targets: from,
        z: this.heldZoom(),
        duration: ms,
        ease: 'Sine.easeInOut',
        onUpdate: () => {
          if (!this.stoneHeld) return;
          cam.setZoom(from.z);
          sizeFrame();
        },
        onComplete: () => resolve(),
      });
    });
  }

  /** The stone's zoom: the world's own, STONE_STEPS whole camera steps closer, so its art pixels stay whole device pixels. */
  private heldZoom(): number {
    return cameraZoom(Math.min(this.scale.width, this.scale.height)) + 4 * STONE_STEPS;
  }

  /** The hold is over: the zoom comes back to the world's own and the camera follows the player again. */
  stoneRelease(): void {
    if (!this.stoneHeld) return;
    this.stoneHeld = false;
    const cam = this.cameras.main;
    cam.setZoom(this.baseZoom);
    this.vignette?.setDisplaySize(this.scale.width / cam.zoom, this.scale.height / cam.zoom);
    cam.startFollow(this.player, true, 0.12, 0.12);
    this.time.delayedCall(1200, () => cam.setLerp(1, 1));
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
    /** the returners' stone: set for the bridge once it is mended, in place of mendedBy */
    stone?: StoneView;
  };
}

const SIGN_SPRITE = 'core/base-kit:props/sign';
const DIRS_4: readonly [number, number][] = [[0, -1], [1, 0], [0, 1], [-1, 0]];

const WORK_SOUND: Record<WorkKind, SfxId> = { strike: 'strike', pick: 'pluck', snap: 'tug', timing: 'rustle', dig: 'dig', fish: 'plop' };
const WORK_DUST: Record<WorkKind, string> = { strike: 'fx-dust', pick: 'fx-leaf', snap: 'fx-chip', timing: 'fx-leaf', dig: 'fx-dirt', fish: 'fx-drop' };

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
