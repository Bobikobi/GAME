/**
 * The game state and the derived numbers every screen shows. The state holds
 * integers, strings, arrays and plain objects only, so its canonical text is
 * stable and a save is just that text.
 */
import type { Bundle, Verb } from './bundle';
import { clamp, idiv, idivUp, mulDiv } from './num';

export const KERNEL_VERSION = '0.10.0';

/** Same list as the schema's ATTRIBUTES (a test keeps them equal); kept here so the kernel needs no runtime import. */
export const ATTRIBUTES = ['carry', 'senses', 'agility', 'luck', 'stamina'] as const;
export type Attribute = (typeof ATTRIBUTES)[number];
export const STATE_FORMAT = 1;

/** Places on the character (DECISIONS.md, 2026-10-09: the upgrade). An outfit takes the top and the legs. */
export const WEAR_SLOTS = ['head', 'top', 'legs', 'outfit', 'feet', 'jewelry1', 'jewelry2', 'hand'] as const;
export type WearSlot = (typeof WEAR_SLOTS)[number];

const SLOTS_OF: Record<string, readonly WearSlot[]> = {
  head: ['head'],
  top: ['top'],
  legs: ['legs'],
  outfit: ['outfit'],
  feet: ['feet'],
  jewelry: ['jewelry1', 'jewelry2'],
  hand: ['hand'],
};

/** The places an item's wear slot fits: jewelry takes either of two. */
export function slotsFor(slot: string): readonly WearSlot[] {
  return SLOTS_OF[slot] ?? [];
}

export interface NodeState {
  /** tick from which the node can be used again */
  readyAt: number;
  /** draws taken from this entity so far (rule R4) */
  draws: number;
}

/**
 * What one outing has brought in so far (G33): the player's account of a walk
 * from the last safe place. A fall takes back exactly this and nothing else.
 */
export interface Outing {
  /** items the world gave on this outing and the bag still holds, by item; spending uses these first */
  gained: Record<string, number>;
  /** riddle steps solved on this outing, "<quest id>#<step index>" */
  solved: string[];
  /** places first visited on this outing */
  visited: string[];
  /** quests open when a predator bit on this outing, sorted: they join `Player.bitten` when it ends safe, and a fall drops them */
  bitten?: string[];
}

/** A hunt in progress: the predator that has the player's scent. It bites by the clock until a safe place or dawn. */
export interface Chase {
  /** id of the predator prop */
  hazard: string;
  /** tick the hunt began */
  since: number;
  /** bites already taken */
  bites: number;
}

export interface FireState {
  /** tick at which this uninterrupted burn began */
  lit: number;
  /** first tick at which the fire no longer burns */
  until: number;
}

export interface ExpeditionState {
  climax: boolean;
  /** Tick of the first action or report inside the place on this visit. */
  entered?: number;
  /** Bells accounted for on this visit; bells before entry are never reported. */
  rung: number;
}

export interface Player {
  name: string;
  /** '' until the player picks a starter */
  starter: string;
  /** 0 for the starter's sprite, 1 for its sprite_alt (another look of the same character) */
  look: number;
  at: [number, number];
  /** milli-gold */
  gold: number;
  bag: Record<string, number>;
  /** uses already taken from the tool unit in hand, per tool item */
  wear: Record<string, number>;
  /**
   * The health bar, in milli-points, as of tick satietyAt. It began as a food bar that a hunger drain empties by the clock;
   * hazards take from it too (DECISIONS.md, 2026-10-10), and the name waits for the rename.
   */
  satiety: number;
  satietyAt: number;
  busyUntil: number;
  /** active ms per profession id */
  xp: Record<string, number>;
  attrs: Record<Attribute, number>;
  /** skill points spent */
  spent: number;
  recipes: string[];
  journal: string[];
  made: Record<string, number>;
  visited: string[];
  restored: string[];
  camp: string[];
  rep: Record<string, number>;
  quests: Record<string, 'active' | 'done'>;
  /** riddle steps solved, "<quest id>#<step index>", sorted */
  solved: string[];
  /** the work clothes by place: their effects count. A worn item stays in the bag. */
  worn: Partial<Record<WearSlot, string>>;
  /** the look layer on the same places: shown, never counted */
  looks: Partial<Record<WearSlot, string>>;
  /** crafts tried per recipe: the draw counter of the craft chance (rule R4) */
  tries: Record<string, number>;
  /** the town square the player was last in: where a fall wakes them. '' before the first town. */
  town: string;
  /** null while the player stands somewhere safe; else the account of this walk out (G33) */
  outing: Outing | null;
  /** the hunt the player is in, if any */
  chase: Chase | null;
  /** quests that were open when a predator bit the player on an outing that came home (not in a fall), sorted: the giver's line at the hand-in may say so */
  bitten: string[];
  /** tended fires by map prop id */
  fires: Record<string, FireState>;
  /** Expedition progress by expedition id. Chain quests persist separately in `quests`. */
  expeditions: Record<string, ExpeditionState>;
  /** falls so far: the draw counter of the tile they wake on (rule R4) */
  falls: number;
  /** tick of the last arrival: a position report, or an action at a tile */
  movedAt: number;
}

export interface State {
  format: number;
  kernel: string;
  content: string;
  seed: number;
  tick: number;
  player: Player;
  nodes: Record<string, NodeState>;
  /** every milli-gold that entered or left the world (rule R6: one ledger) */
  ledger: { minted: number; burned: number };
}

export function newState(bundle: Bundle, seed: number): State {
  const attrs = Object.fromEntries(ATTRIBUTES.map((a) => [a, 0])) as Record<Attribute, number>;
  return {
    format: STATE_FORMAT,
    kernel: KERNEL_VERSION,
    content: bundle.tag,
    seed: seed >>> 0,
    tick: 0,
    player: {
      name: '',
      starter: '',
      look: 0,
      at: [bundle.map.spawn.x, bundle.map.spawn.y],
      gold: 0,
      bag: {},
      wear: {},
      satiety: 0,
      satietyAt: 0,
      busyUntil: 0,
      xp: {},
      attrs,
      spent: 0,
      recipes: [],
      journal: [],
      made: {},
      visited: [],
      restored: [],
      camp: [],
      rep: {},
      quests: {},
      solved: [],
      worn: {},
      looks: {},
      tries: {},
      town: '',
      outing: null,
      chase: null,
      bitten: [],
      fires: {},
      expeditions: {},
      falls: 0,
      movedAt: 0,
    },
    nodes: {},
    ledger: { minted: 0, burned: 0 },
  };
}

// ------------------------------------------------------------ derived numbers

export function satietyCap(bundle: Bundle, state: State): number {
  return (bundle.params.satiety_cap + bundle.params.per_point.stamina * state.player.attrs.stamina) * 1000;
}

/** Satiety at a tick: it drains with play time and stops at zero. */
export function satietyAt(bundle: Bundle, state: State, tick: number): number {
  const p = state.player;
  const elapsed = Math.max(0, tick - p.satietyAt);
  return Math.max(0, p.satiety - mulDiv(elapsed, bundle.params.satiety_drain_per_min, 60_000));
}

export function bagUsed(state: State): number {
  let n = 0;
  for (const k of Object.keys(state.player.bag)) n += state.player.bag[k] ?? 0;
  return n;
}

/** Whether a camp part stands, itself or under an upgrade built over it. */
export function campBuilt(bundle: Bundle, state: State, campId: string): boolean {
  for (const id of state.player.camp) {
    let cur: string | undefined = id;
    for (let guard = 0; cur !== undefined && guard < 20; guard++) {
      if (cur === campId) return true;
      cur = bundle.camps[cur]?.upgrades;
    }
  }
  return false;
}

/** How far, in tiles, a character with these senses sees a hidden place: a dig spot, or a find lying in the grass. */
export function senseReach(bundle: Bundle, senses: number): number {
  return 2 + bundle.params.per_point.senses * senses;
}

export function bagCapacity(bundle: Bundle, state: State): number {
  let cap = bundle.params.bag_base + bundle.params.per_point.carry * state.player.attrs.carry;
  for (const id of state.player.camp) cap += bundle.camps[id]?.bag_bonus ?? 0;
  return cap;
}

export function professionLevel(bundle: Bundle, state: State, professionId: string): number {
  const prof = bundle.professions[professionId];
  if (!prof) return 1;
  const xp = state.player.xp[professionId] ?? 0;
  let level = 1;
  for (const seconds of prof.xp_levels) if (xp >= seconds * 1000) level++;
  return level;
}

export function verbLevel(bundle: Bundle, state: State, verb: Verb): number {
  return professionLevel(bundle, state, bundle.verbs[verb]);
}

/** The verb a node trains: a node worked with an axe is felled, any other is gathered. */
export function nodeVerb(resource: { tool?: string }): Verb {
  return resource.tool === 'axe' ? 'fell' : 'gather';
}

/** Character level: one more for every profession level gained. */
export function characterLevel(bundle: Bundle, state: State): number {
  let level = 1;
  for (const id of Object.keys(bundle.professions)) level += professionLevel(bundle, state, id) - 1;
  return level;
}

export function skillPoints(bundle: Bundle, state: State): number {
  return characterLevel(bundle, state) - 1 - state.player.spent;
}

/** Rule R9: the one clamp on every rate multiplier, by character level. */
export function powerCap(bundle: Bundle, state: State): number {
  const caps = bundle.params.power_cap_permille;
  const i = clamp(characterLevel(bundle, state), 1, caps.length) - 1;
  return caps[i] ?? 1000;
}

/** Sum of a technique effect the player has unlocked through profession levels; `only` counts one profession's. */
export function techniqueValue(bundle: Bundle, state: State, effect: string, only?: string): number {
  let total = 0;
  for (const id of Object.keys(bundle.professions).sort()) {
    if (only !== undefined && id !== only) continue;
    const prof = bundle.professions[id]!;
    const level = professionLevel(bundle, state, id);
    for (const t of prof.techniques) if (t.effect === effect && level >= t.level) total += Math.max(1, t.value);
  }
  return total;
}

const setCache = new WeakMap<Bundle, Record<string, string[]>>();

/** The work pieces of each set, by set id, in id order. */
export function setPieces(bundle: Bundle): Record<string, string[]> {
  let sets = setCache.get(bundle);
  if (!sets) {
    sets = {};
    for (const id of Object.keys(bundle.items).sort()) {
      const w = bundle.items[id]!.wear;
      if (w?.set && !w.look) (sets[w.set] ??= []).push(id);
    }
    setCache.set(bundle, sets);
  }
  return sets;
}

/** Whether every piece of a set is worn on the work layer. */
export function setComplete(bundle: Bundle, state: State, set: string): boolean {
  const pieces = setPieces(bundle)[set] ?? [];
  const worn = Object.values(state.player.worn);
  return pieces.length > 1 && pieces.every((id) => worn.includes(id));
}

/** Sum of an effect from the work clothes: each worn piece once, and a full set a little more (rounded down). */
export function wornValue(bundle: Bundle, state: State, effect: string): number {
  let total = 0;
  const bySet: Record<string, number> = {};
  for (const slot of WEAR_SLOTS) {
    const id = state.player.worn[slot];
    const w = id === undefined ? undefined : bundle.items[id]?.wear;
    if (!w || w.look) continue;
    for (const e of w.effects ?? []) {
      if (e.effect !== effect) continue;
      total += e.value;
      if (w.set) bySet[w.set] = (bySet[w.set] ?? 0) + e.value;
    }
  }
  for (const set of Object.keys(bySet).sort()) {
    if (setComplete(bundle, state, set)) total += mulDiv(bySet[set]!, bundle.params.wear_set_bonus_pct, 100);
  }
  return total;
}

/**
 * The one calculator (spec section 15): an effect from techniques and from the
 * work clothes together. A craft effect passes the recipe's profession, so a
 * technique helps the recipes of its own profession only. Every caller still
 * clamps the rate it feeds under the power cap (rule R9).
 */
export function effectValue(bundle: Bundle, state: State, effect: string, profession?: string): number {
  return techniqueValue(bundle, state, effect, profession) + wornValue(bundle, state, effect);
}

/**
 * Worn items stay in the bag: take off every one the bag no longer holds
 * enough units of, or that no longer fits its place. `only` looks at one item.
 * Returns what came off, so the caller can tell the player.
 */
export function fitWorn(bundle: Bundle, state: State, only?: string): { item: string; slot: WearSlot; look: boolean }[] {
  const p = state.player;
  const off: { item: string; slot: WearSlot; look: boolean }[] = [];
  for (const look of [false, true]) {
    const layer = look ? p.looks : p.worn;
    const count: Record<string, number> = {};
    for (const slot of WEAR_SLOTS) {
      const id = layer[slot];
      if (id === undefined || (only !== undefined && id !== only)) continue;
      const w = bundle.items[id]?.wear;
      count[id] = (count[id] ?? 0) + 1;
      if (!w || (w.look === true) !== look || !slotsFor(w.slot).includes(slot) || count[id] > (p.bag[id] ?? 0)) {
        delete layer[slot];
        off.push({ item: id, slot, look });
      }
    }
  }
  return off;
}

/**
 * In-game hour 0..23. Tick 0 is noon, so the first dusk falls inside the
 * first session (DECISIONS.md, 2026-10-10: the opening recut B as built).
 */
export function hourOf(bundle: Bundle, tick: number): number {
  const day = bundle.params.day_length_ms;
  const t = (tick + idiv(day, 2)) % day;
  return idiv(t * 24, day);
}

/** Night for the rules: 20:00 to 05:00, the hours the client darkens fully and plays the night song. */
export function isNight(bundle: Bundle, tick: number): boolean {
  const hour = hourOf(bundle, tick);
  return hour >= 20 || hour < 5;
}

/** Whether a tended fire still burns at this game tick. */
export function fireBurns(state: State, id: string, tick: number): boolean {
  return (state.player.fires?.[id]?.until ?? 0) > tick;
}

/** Whether an item feeds a fire: its class is wood, or a class an extension declares under wood. */
export function burnsAsWood(bundle: Bundle, itemId: string): boolean {
  const cls = bundle.items[itemId]?.class;
  return cls === 'wood' || (cls !== undefined && bundle.classes[cls]?.base === 'wood');
}

/**
 * Whether a fire has kept a `tend` step's vigil at this tick: the night of the last dusk at or
 * before it is over (the tick is at or after that night's dawn), and the fire was lit by that dusk
 * and burned without a gap to that dawn. Before dawn it does not hold, however much wood the fire
 * has; by day it holds until the next dusk (DECISIONS.md, 2026-10-16: the vigil closes at dawn).
 */
export function tendHolds(bundle: Bundle, state: State, id: string, tick: number): boolean {
  const fire = state.player.fires?.[id];
  const dusk = lastDusk(bundle, tick);
  const dawn = nightEnds(bundle, dusk);
  return fire !== undefined && tick >= dawn && fire.lit <= dusk && fire.until >= dawn;
}

/**
 * The first tick from `tick` on at which a fire takes another log whole: at once while it is
 * out or a whole log still fits under its cap (`fire.cap` logs ahead of the tick), else once
 * enough of its wood has burned down. A log goes in whole or not at all, so no feed wastes wood.
 */
export function nextLogAt(bundle: Bundle, state: State, id: string, tick: number): number {
  const until = state.player.fires?.[id]?.until ?? tick;
  return Math.max(tick, until - (bundle.params.fire.cap - 1) * bundle.params.fire.log_ms);
}

/** Where a tick falls in its day: 0 at midnight (tick 0 is noon, half way in; same start as hourOf). */
function phaseOf(bundle: Bundle, tick: number): number {
  const day = bundle.params.day_length_ms;
  return (tick + idiv(day, 2)) % day;
}

/** The first tick from `tick` on that is night (the tick itself when it already is): when the dark arrives. */
export function nightFalls(bundle: Bundle, tick: number): number {
  const day = bundle.params.day_length_ms;
  const phase = phaseOf(bundle, tick);
  const dawn = idivUp(5 * day, 24);
  const dusk = idivUp(20 * day, 24);
  return phase >= dawn && phase < dusk ? tick + (dusk - phase) : tick;
}

/** The most recent dusk at or before `tick`: this night's dusk after dark, and the previous night's by day. */
export function lastDusk(bundle: Bundle, tick: number): number {
  const day = bundle.params.day_length_ms;
  const half = idiv(day, 2);
  const dusk = idivUp(20 * day, 24);
  const cycle = idiv(tick + half - dusk, day);
  return cycle * day + dusk - half;
}

/** The first tick from `tick` on that is not night (the tick itself when it already is not): when the dark ends. */
export function nightEnds(bundle: Bundle, tick: number): number {
  const day = bundle.params.day_length_ms;
  const phase = phaseOf(bundle, tick);
  const dawn = idivUp(5 * day, 24);
  const dusk = idivUp(20 * day, 24);
  if (phase >= dusk) return tick + (day - phase) + dawn;
  return phase < dawn ? tick + (dawn - phase) : tick;
}

/** Minutes past midnight, for the clock on screen. */
export function minuteOfDay(bundle: Bundle, tick: number): number {
  const day = bundle.params.day_length_ms;
  const t = (tick + idiv(day, 2)) % day;
  return mulDiv(t, 24 * 60, day);
}

export function repTier(points: number): 'stranger' | 'acquaintance' | 'friend' | 'family' {
  if (points >= 60) return 'family';
  if (points >= 30) return 'friend';
  if (points >= 10) return 'acquaintance';
  return 'stranger';
}
