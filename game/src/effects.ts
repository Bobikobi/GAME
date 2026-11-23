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
