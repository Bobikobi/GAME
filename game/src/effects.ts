/**
 * The first effects of the valley (DECISIONS 2026-11-23, the SpriteCast trial's CC0 pack): a spark on a landed hit, a starburst on a
 * bite or a critical blow, a puff of dust where a jump or a thrown stone lands, and a camp fire's own flame. Four sheets of PVFX
 * Foundry (CC0 1.0, Pixel VFX Studio), laid at the rich scale, 64 art pixels to a tile; `game/public/fx/pvfx/SOURCE.md` names where
 * each came from.
 *
 * A client-only layer, display only: nothing here reads back into the kernel, and each effect is a pure function of its age
 * (`frameAt`), so a still and a clip of the same run agree. The pure half (which event plays which effect, where, and which frame
 * is up at an age) is here and tested on its own; the scene half is `effect-layer.ts`.
 */
import type { GameEvent } from '@game/kernel';

export type EffectId = 'hit-spark' | 'crit-hit' | 'landing-dust' | 'campfire';

/** Art pixels to a tile side: the rich grid (kit density 4). The world keeps 16 units to a tile, so an effect shows at 16 / 64 of its pixels. */
export const ART_PER_TILE = 64;

export interface EffectDef {
  id: EffectId;
  /** the Phaser texture key and the sheet's url, served next to the page (`game/public`) */
  texture: string;
  url: string;
  /** one frame's size in art pixels, the frames in all, and how many lie in a row of the sheet (the rest wrap, left to right) */
  frame: readonly [number, number];
  frames: number;
  cols: number;
  /** how long one frame shows */
  ms: number;
  /** a loop never ends (the camp fire); the rest play once and clear */
  loop: boolean;
  /** the point of the frame that sits on the spot the effect is laid on, in art pixels (the pack's own `pivot`) */
  pivot: readonly [number, number];
}

const sheet = (id: EffectId, frame: readonly [number, number], frames: number, cols: number, ms: number, loop: boolean, pivot: readonly [number, number]): EffectDef => ({
  id, texture: `fx-pvfx-${id}`, url: `fx/pvfx/${id}.png`, frame, frames, cols, ms, loop, pivot,
});

/** The numbers are the pack's own manifests (`manifest.json` of each effect); `test/effects.test.ts` holds them to the sheets' real sizes. */
export const EFFECTS: Readonly<Record<EffectId, EffectDef>> = {
  'hit-spark': sheet('hit-spark', [64, 64], 8, 8, 80, false, [32, 32]),
  'crit-hit': sheet('crit-hit', [96, 80], 11, 8, 70, false, [48, 40]),
  'landing-dust': sheet('landing-dust', [88, 46], 12, 8, 70, false, [44, 40]),
  campfire: sheet('campfire', [40, 56], 12, 8, 75, true, [20, 50]),
};

export const EFFECT_IDS = Object.keys(EFFECTS) as EffectId[];

/** How long an effect plays once, in ms. */
export function lifeMs(def: EffectDef): number {
  return def.frames * def.ms;
}

/** The frame up `ageMs` after the effect began; a loop wraps, the rest give `null` once their last frame has shown (and before they begin). */
export function frameAt(def: EffectDef, ageMs: number): number | null {
  if (!(ageMs >= 0)) return null;
  const n = Math.floor(ageMs / def.ms);
  if (def.loop) return n % def.frames;
  return n < def.frames ? n : null;
}

/** An effect's whole frame in tiles (width, height): what it measures beside a figure. */
export function sizeInTiles(def: EffectDef): [number, number] {
  return [def.frame[0] / ART_PER_TILE, def.frame[1] / ART_PER_TILE];
}

/** The origin Phaser puts on the sprite so the pack's pivot lies on the spot (shares of the frame). */
export function originOf(def: EffectDef): [number, number] {
  return [def.pivot[0] / def.frame[0], def.pivot[1] / def.frame[1]];
}

/** The sheet's row and column of a frame, for a check that the sheet holds them all. */
export function cellOf(def: EffectDef, frame: number): [number, number] {
  return [frame % def.cols, Math.floor(frame / def.cols)];
}

/** The sheet's size in art pixels that `frames` frames wrapped `cols` to a row make. */
export function sheetSize(def: EffectDef): [number, number] {
  const rows = Math.ceil(def.frames / def.cols);
  return [Math.min(def.frames, def.cols) * def.frame[0], rows * def.frame[1]];
}

/** One effect an event asks for: which, and on which tile (the point on it is the layer's, by the effect). */
export interface Spawn {
  id: EffectId;
  tile: readonly [number, number];
}

/**
 * The effects a batch of the kernel's events starts:
 * - `hit` by the player: a spark on the struck foe's tile, a starburst when the blow is critical;
 * - `hit` by a foe, and `hurt` by a predator (the chase's bite): a starburst on the player's tile, the bite landing.
 * A fight's bite and the chase's bite that fall in one batch on one tile show once. A miss, a guard and a dodge play nothing.
 * The landing dust is not here: a jump and a thrown stone land later than they are told, so the scene lays it when they touch down
 * (`landingDust`).
 */
export function spawnsOf(events: readonly GameEvent[], player: readonly [number, number]): Spawn[] {
  const out: Spawn[] = [];
  const bitten = new Set<string>();
  const add = (id: EffectId, tile: readonly [number, number]): void => {
    if (id === 'crit-hit') {
      const k = `${tile[0]},${tile[1]}`;
      if (bitten.has(k)) return;
      bitten.add(k);
    }
    out.push({ id, tile: [tile[0], tile[1]] });
  };
  for (const e of events) {
    if (e.e === 'hit') {
      if (e.striker.side === 'player') add(e.kind === 'critical' ? 'crit-hit' : 'hit-spark', e.at);
      else add('crit-hit', e.at);
    } else if (e.e === 'hurt' && e.by === 'predator') add('crit-hit', player);
  }
  return out;
}

/** The ground a landing may raise dust from: the dry kinds of the valley (its path, its bank, its town, its ruin). A meadow throws leaves, water nothing. */
export const DUST_GROUND: ReadonlySet<string> = new Set(['path', 'riverbank', 'town', 'ruin']);

/** Whether a landing on this ground tag raises the dust effect (and the old puff steps aside). */
export function landingDust(tag: string | undefined): boolean {
  return tag !== undefined && DUST_GROUND.has(tag);
}

/** Where on its tile each effect is laid, as shares of a tile from its top-left: a blow at chest height, the dust on the ground, the fire on its hearth. */
export const LAY: Readonly<Record<EffectId, readonly [number, number]>> = {
  'hit-spark': [0.5, 0.35],
  'crit-hit': [0.5, 0.35],
  'landing-dust': [0.5, 0.65],
  campfire: [0.5, 1],
};

// ------------------------------------------------------------ moments: the code-drawn effects (VALLEY_EFFECTS.md)

/** The scene's own pixel textures a burst may throw (world.ts `makeFx`): no picture beyond them. */
export type BurstTexture = 'fx-dust' | 'fx-spark' | 'fx-chip' | 'fx-leaf' | 'fx-dirt' | 'fx-drop' | 'fx-mote' | 'fx-smoke' | 'fx-puff' | 'fx-grit';

/**
 * How a burst's bits fly: `fan` up and out and falling back (the work's chips), `ground` low and sideways along the ground (a stone
 * set down, a body landing), `rise` slowly up and fading (a light's motes, smoke), `step` a little at the feet as a step starts.
 */
export type BurstStyle = 'fan' | 'ground' | 'rise' | 'step';

/**
 * One part of a moment, laid on the moment's spot:
 * - `burst`: `n` bits of a texture, `up` world units above the spot;
 * - `ground`: `n` bits of the ground's own kind under the spot (dust on a path, leaves on a meadow, grit in a ruin, nothing on water);
 * - `ring`: the rings of `ring.ts` spreading on water;
 * - `light`: the soft light a success has (jolt.ts `SUCCESS_LIGHT`), `scale` times the glow's size, `up` world units above the spot;
 * - `flash`: the figure on the spot shows white for `ms` (a hit's flash on the body struck: danger only, DECISIONS 2026-10-18).
 */
export type Part =
  | { fx: 'burst'; texture: BurstTexture; n: number; style: BurstStyle; up: number }
  | { fx: 'ground'; n: number; style: BurstStyle }
  | { fx: 'ring' }
  | { fx: 'light'; scale: number; up: number }
  | { fx: 'flash'; ms: number };

export type MomentId =
  | 'jump-off'
  | 'hard-landing'
  | 'stone-lift'
  | 'stone-down'
  | 'stone-push'
  | 'fish-catch'
  | 'eat'
  | 'tool-broke'
  | 'level'
  | 'safe'
  | 'hurt'
  | 'foe-hurt'
  | 'dodge'
  | 'guard'
  | 'foe-fall';

export interface Moment {
  parts: readonly Part[];
  /** a moment of danger may flash a body; a success never does (and no moment moves the camera: that is jolt.ts's alone) */
  danger: boolean;
}

const burst = (texture: BurstTexture, n: number, style: BurstStyle, up = 0): Part => ({ fx: 'burst', texture, n, style, up });
const ground = (n: number, style: BurstStyle = 'ground'): Part => ({ fx: 'ground', n, style });

/** Every moment's parts. The counts are bits of 1 to 3 world pixels: a moment is read at the game's zoom, not a close-up. */
export const MOMENTS: Readonly<Record<MomentId, Moment>> = {
  // the feet leave the ground: a little of it kicked back
  'jump-off': { parts: [ground(4)], danger: false },
  // a fall of two levels or more: more ground thrown out under the landing dust (the hurt's own flash and shake are jolt.ts's)
  'hard-landing': { parts: [ground(8), burst('fx-dust', 4, 'ground')], danger: true },
  // a stone leaves the ground it lay on
  'stone-lift': { parts: [ground(3, 'fan')], danger: false },
  // a large stone set down: a thud of ground out to both sides
  'stone-down': { parts: [ground(7), burst('fx-dust', 3, 'ground')], danger: false },
  // a pushed stone scrapes onto its new tile
  'stone-push': { parts: [ground(5)], danger: false },
  // the fish comes out of the water: a ring and a few drops thrown up
  'fish-catch': { parts: [{ fx: 'ring' }, burst('fx-drop', 5, 'fan', 1)], danger: false },
  // food: a few motes rise off the body
  eat: { parts: [burst('fx-mote', 5, 'rise', 8)], danger: false },
  // a tool breaks in the hand: splinters and a spark
  'tool-broke': { parts: [burst('fx-chip', 6, 'fan', 9), burst('fx-spark', 2, 'fan', 9)], danger: false },
  // a level: a light on the one who rose, sparks and motes going up (the banner and the jingle are the screen's)
  level: { parts: [{ fx: 'light', scale: 2.5, up: 12 }, burst('fx-spark', 10, 'rise', 10), burst('fx-mote', 6, 'rise', 14)], danger: false },
  // a hunt ends in a safe place: a small light, a breath out
  safe: { parts: [{ fx: 'light', scale: 1.5, up: 10 }], danger: false },
  // the player's body is struck (a bite, a hazard, a hard landing, a foe's blow): it shows white a moment
  hurt: { parts: [{ fx: 'flash', ms: 90 }], danger: true },
  // a foe's body is struck by the player
  'foe-hurt': { parts: [{ fx: 'flash', ms: 80 }], danger: true },
  // a blow dodged: the dodger's feet kick up the ground
  dodge: { parts: [ground(4)], danger: true },
  // a blow guarded: sparks off the guard
  guard: { parts: [burst('fx-spark', 5, 'fan', 7)], danger: true },
  // a foe falls: the ground it hits
  'foe-fall': { parts: [ground(10), burst('fx-dust', 6, 'ground')], danger: true },
};

export const MOMENT_IDS = Object.keys(MOMENTS) as MomentId[];

/** Where a moment is laid: on the player, on a tile, on a fire (its hearth), or on a foe's figure (its tile when it is not drawn). */
export type MomentAt =
  | { on: 'player' }
  | { on: 'tile'; tile: readonly [number, number] }
  | { on: 'fire'; id: string }
  | { on: 'foe'; id: string; tile: readonly [number, number] };

export interface MomentSpawn {
  id: MomentId;
  at: MomentAt;
  /** the hurt of a landing: the scene lays it when the feet come down, as jolt.ts's flash and shake are */
  landing?: boolean;
}

/**
 * The moments a batch of the kernel's events starts. A stone lifted, set down or pushed (`lift`, `setdown`, `push`); food eaten; a
 * tool broken; a level; a quest done; a fire out; a hunt ended in a safe place; a hurt of the player's body (`hurt`, or a foe's
 * `hit`), once a batch; a foe's body hit by the player; a blow dodged or guarded; a foe fallen. The jump's takeoff and landing and
 * the fish's catch are the scene's (they happen later than they are told, as the landing dust does).
 */
export function momentsOf(events: readonly GameEvent[]): MomentSpawn[] {
  const out: MomentSpawn[] = [];
  const once = new Set<string>();
  const add = (s: MomentSpawn, key?: string): void => {
    if (key !== undefined) {
      if (once.has(key)) return;
      once.add(key);
    }
    out.push(s);
  };
  const tile = (t: readonly [number, number]): MomentAt => ({ on: 'tile', tile: [t[0], t[1]] });
  for (const e of events) {
    switch (e.e) {
      case 'lift':
        add({ id: 'stone-lift', at: tile(e.at) });
        break;
      case 'setdown':
        add({ id: 'stone-down', at: tile(e.at) });
        break;
      case 'push':
        add({ id: 'stone-push', at: tile(e.at) });
        break;
      case 'eat':
        add({ id: 'eat', at: { on: 'player' } }, 'eat');
        break;
      case 'tool_broke':
        add({ id: 'tool-broke', at: { on: 'player' } }, 'tool');
        break;
      case 'level':
        add({ id: 'level', at: { on: 'player' } }, 'level');
        break;
      case 'safe':
        add({ id: 'safe', at: { on: 'player' } }, 'safe');
        break;
      case 'hurt':
        add({ id: 'hurt', at: { on: 'player' }, ...(e.by === 'fall' ? { landing: true } : {}) }, 'hurt');
        break;
      case 'hit':
        if (e.struck.side === 'player') add({ id: 'hurt', at: { on: 'player' } }, 'hurt');
        else add({ id: 'foe-hurt', at: { on: 'foe', id: e.struck.id, tile: [e.at[0], e.at[1]] } }, `foe:${e.struck.id}`);
        break;
      case 'fight_dodge':
        add({ id: 'dodge', at: tile(e.at) });
        break;
      case 'fight_guard':
        add({ id: 'guard', at: tile(e.at) });
        break;
      case 'foe_fall':
        add({ id: 'foe-fall', at: tile(e.at) }, `fall:${e.foe}`);
        break;
    }
  }
  return out;
}

/** The ground's own bits a `ground` part throws, by the ground's tag: dust on dry ground, leaves on grass, grit in a ruin, nothing on water. */
export function groundBits(tag: string | undefined): BurstTexture | undefined {
  if (tag === 'path' || tag === 'riverbank' || tag === 'town') return 'fx-puff';
  if (tag === 'meadow' || tag === 'grove') return 'fx-leaf';
  if (tag === 'ruin') return 'fx-grit';
  return undefined;
}

/** A burst's flight by its style, in the shape Phaser's emitter takes (the `fan` is the work's chips as world.ts threw them before). */
export const BURST_FLIGHT: Readonly<Record<BurstStyle, { lifespan: [number, number]; speed: [number, number]; angle: [number, number]; gravityY: number; scaleEnd: number }>> = {
  fan: { lifespan: [300, 600], speed: [14, 42], angle: [200, 340], gravityY: 70, scaleEnd: 0.6 },
  ground: { lifespan: [220, 420], speed: [10, 26], angle: [185, 355], gravityY: 40, scaleEnd: 0.6 },
  rise: { lifespan: [600, 1000], speed: [6, 16], angle: [250, 290], gravityY: -8, scaleEnd: 0.8 },
  // the walk's own puff, as world.ts `puffAt` threw it before
  step: { lifespan: [240, 400], speed: [5, 12], angle: [230, 310], gravityY: 0, scaleEnd: 1 },
};
