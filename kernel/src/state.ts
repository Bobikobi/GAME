/**
 * The game state and the derived numbers every screen shows. The state holds
 * integers, strings, arrays and plain objects only, so its canonical text is
 * stable and a save is just that text.
 */
import type { Bundle, Verb } from './bundle';
import { clamp, idiv, idivUp, mulDiv } from './num';
import { tagAt, worldAt } from './world';

export const KERNEL_VERSION = '0.15.0';

/** Same list as the schema's ATTRIBUTES (a test keeps them equal); kept here so the kernel needs no runtime import. */
export const ATTRIBUTES = ['might', 'senses', 'agility', 'luck', 'stamina', 'spirit'] as const;
export type Attribute = (typeof ATTRIBUTES)[number];
/**
 * The shape of a saved state. Format 2 (kernel 0.14, the races): `attrs.carry` is `attrs.might`,
 * `attrs.spirit` is new, and the player's `starter` became a `race` and a wake `pocket`.
 * `migrateState` brings a format 1 save forward; a save always loads.
 */
export const STATE_FORMAT = 2;

/**
 * The three starters of format 1 and what each became (DECISIONS.md, 2026-10-22): the race it reads
 * as, the pocket it woke in, and its old profile (`carry` read as `might`). A replayed `start` that
 * still names a starter plays as it did: that profile, that pocket, the pocket's tools in the bag.
 */
export const LEGACY_STARTERS: Readonly<Record<string, { race: string; pocket: string; attrs: Readonly<Record<Attribute, number>> }>> = {
  'core/explorer': { race: 'core/human', pocket: 'core/north-meadow', attrs: { might: 0, senses: 2, agility: 1, luck: 2, stamina: 1, spirit: 0 } },
  'core/forager': { race: 'core/elf', pocket: 'core/west-bank', attrs: { might: 2, senses: 1, agility: 2, luck: 0, stamina: 1, spirit: 0 } },
  'core/digger': { race: 'core/skeleton', pocket: 'core/slid-bank', attrs: { might: 1, senses: 1, agility: 0, luck: 2, stamina: 2, spirit: 0 } },
};

/**
 * Content ids the races renamed (format 1 to 2): the slid bank's dig spot became `core/slid-bank-dig`
 * when its wake pocket took the old id. A node is keyed `<source>#<n>`, so a save's spent spot and a
 * logged dig keep pointing at the same place through `legacyNodeId`.
 */
export const LEGACY_NODE_SOURCES: Readonly<Record<string, string>> = { 'core/slid-bank': 'core/slid-bank-dig' };

/** A node id of format 1 as it reads now (LEGACY_NODE_SOURCES); any other id as it is. */
export function legacyNodeId(id: string): string {
  const hash = id.lastIndexOf('#');
  const now = hash > 0 ? LEGACY_NODE_SOURCES[id.slice(0, hash)] : undefined;
  return now === undefined ? id : now + id.slice(hash);
}

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
  /**
   * The dawn of a night an earlier burn kept, when the fire was lit again by day while that vigil
   * held: a new burn does not undo a night already kept, so the vigil still holds until the next
   * dusk. Absent otherwise, and in saves from before kernel 0.10 (DECISIONS.md, 2026-10-16).
   */
  kept?: number;
}

/** The id a `feed` action and a `tend` step give the fire the player kindled themselves (`Player.own`). No prop id has this shape: an id has a slash. */
export const OWN_FIRE = 'own';

/**
 * The one fire the player kindled outside the town (DECISIONS.md, 2026-10-19): it burns like a map fire, on the same
 * `lit`, `until` and `kept`, and also keeps its tile and the game milliseconds one log of it lasts, fixed when it was
 * kindled from the danger of the ground it stands on, so `until` and `nextLogAt` stay single numbers.
 */
export interface OwnFire extends FireState {
  at: [number, number];
  log: number;
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
  /** the race picked at the title; '' until the character is chosen */
  race: string;
  /** the wake pocket the seed drew at the start; '' until the character is chosen */
  pocket: string;
  /** 0 for the race's sprite, 1 for its sprite_alt (another look of the same race) */
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
  /** the fire the player kindled outside the town, if any; one stands at a time (null in saves from before kernel 0.12) */
  own: OwnFire | null;
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

/** The state as a screen or a reply sees it: the seed is the server's alone (kernel-review R4). */
export type PublicState = Omit<State, 'seed'>;

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
      race: '',
      pocket: '',
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
      own: null,
      expeditions: {},
      falls: 0,
      movedAt: 0,
    },
    nodes: {},
    ledger: { minted: 0, burned: 0 },
  };
}

/**
 * Brings a saved state of an older format forward (format 1 to 2: the races). Pure: returns a new
 * object and leaves the input as it was. `carry` is read as `might`, `spirit` starts at 0, and the
 * starter becomes its race and its pocket (LEGACY_STARTERS); an unknown starter keeps its id as the
 * race with no pocket, and the caller decides whether the content still holds it. The old six-point
 * total stays as it is: the seven is a content rule, not a save rule.
 */
export function migrateState(saved: State): State {
  const s = structuredClone(saved) as State & { player: Player & { starter?: string; attrs: Record<string, number> } };
  if ((s.format ?? 1) >= STATE_FORMAT) return s;
  const p = s.player;
  const attrs = p.attrs ?? {};
  if (attrs.might === undefined) attrs.might = attrs.carry ?? 0;
  delete attrs.carry;
  for (const a of ATTRIBUTES) attrs[a] ??= 0;
  p.attrs = attrs as Record<Attribute, number>;
  if (p.race === undefined) {
    const old = p.starter ?? '';
    const now = LEGACY_STARTERS[old];
    p.race = now?.race ?? old;
    p.pocket = now?.pocket ?? '';
  }
  p.pocket ??= '';
  delete p.starter;
  // a spot whose source was renamed keeps what was done to it (a dug bank stays dug)
  for (const id of Object.keys(s.nodes ?? {})) {
    const now = legacyNodeId(id);
    if (now === id) continue;
    s.nodes[now] ??= s.nodes[id]!;
    delete s.nodes[id];
  }
  s.format = STATE_FORMAT;
  return s;
}

// ------------------------------------------------------------ derived numbers

/**
 * How the world under the player shifts one attribute (DECISIONS.md, 2026-10-22): +1 or -1 on the
 * race's two home attributes where a world grades the race strong or weak, else 0. The valley is
 * neutral, so today it is 0 everywhere.
 */
export function gradeShift(bundle: Bundle, state: PublicState, attr: Attribute, at: readonly [number, number] = state.player.at): number {
  const race = bundle.races[state.player.race];
  if (!race || !race.home.includes(attr)) return 0;
  const grade = race.grades?.[worldAt(bundle.map, at[0], at[1])];
  return grade === 'strong' ? 1 : grade === 'weak' ? -1 : 0;
}

/**
 * The one calculator's attribute side: the points an attribute counts for now. The race gives the
 * base (copied into `attrs` at the start, raised by spent points), the region's grade shifts the
 * home pair, never below 0. Every rule that reads an attribute reads it here; spending reads the base.
 */
export function attrAt(bundle: Bundle, state: PublicState, attr: Attribute): number {
  return Math.max(0, (state.player.attrs[attr] ?? 0) + gradeShift(bundle, state, attr));
}

export function satietyCap(bundle: Bundle, state: PublicState): number {
  return (bundle.params.satiety_cap + bundle.params.per_point.stamina * attrAt(bundle, state, 'stamina')) * 1000;
}

/** Satiety at a tick: it drains with play time and stops at zero. */
export function satietyAt(bundle: Bundle, state: PublicState, tick: number): number {
  const p = state.player;
  const elapsed = Math.max(0, tick - p.satietyAt);
  return Math.max(0, p.satiety - mulDiv(elapsed, bundle.params.satiety_drain_per_min, 60_000));
}

export function bagUsed(state: PublicState): number {
  let n = 0;
  for (const k of Object.keys(state.player.bag)) n += state.player.bag[k] ?? 0;
  return n;
}

/** Whether a camp part stands, itself or under an upgrade built over it. */
export function campBuilt(bundle: Bundle, state: PublicState, campId: string): boolean {
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

export function bagCapacity(bundle: Bundle, state: PublicState): number {
  let cap = bundle.params.bag_base + bundle.params.per_point.might * attrAt(bundle, state, 'might');
  for (const id of state.player.camp) cap += bundle.camps[id]?.bag_bonus ?? 0;
  return cap;
}

export function professionLevel(bundle: Bundle, state: PublicState, professionId: string): number {
  const prof = bundle.professions[professionId];
  if (!prof) return 1;
  const xp = state.player.xp[professionId] ?? 0;
  let level = 1;
  for (const seconds of prof.xp_levels) if (xp >= seconds * 1000) level++;
  return level;
}

export function verbLevel(bundle: Bundle, state: PublicState, verb: Verb): number {
  return professionLevel(bundle, state, bundle.verbs[verb]);
}

/** The verb a node trains: a node worked with an axe is felled, any other is gathered. */
export function nodeVerb(resource: { tool?: string }): Verb {
  return resource.tool === 'axe' ? 'fell' : 'gather';
}

/** Character level: one more for every profession level gained. */
export function characterLevel(bundle: Bundle, state: PublicState): number {
  let level = 1;
  for (const id of Object.keys(bundle.professions)) level += professionLevel(bundle, state, id) - 1;
  return level;
}

export function skillPoints(bundle: Bundle, state: PublicState): number {
  return characterLevel(bundle, state) - 1 - state.player.spent;
}

/** Rule R9: the one clamp on every rate multiplier, by character level. */
export function powerCap(bundle: Bundle, state: PublicState): number {
  const caps = bundle.params.power_cap_permille;
  const i = clamp(characterLevel(bundle, state), 1, caps.length) - 1;
  return caps[i] ?? 1000;
}

/** Sum of a technique effect the player has unlocked through profession levels; `only` counts one profession's. */
export function techniqueValue(bundle: Bundle, state: PublicState, effect: string, only?: string): number {
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
export function setComplete(bundle: Bundle, state: PublicState, set: string): boolean {
  const pieces = setPieces(bundle)[set] ?? [];
  const worn = Object.values(state.player.worn);
  return pieces.length > 1 && pieces.every((id) => worn.includes(id));
}

/** Sum of an effect from the work clothes: each worn piece once, and a full set a little more (rounded down). */
export function wornValue(bundle: Bundle, state: PublicState, effect: string): number {
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
 * clamps the rate it feeds under the power cap (rule R9). Its attribute side is
 * `attrAt`: the race's profile and the region's grade (DECISIONS.md, 2026-10-22).
 */
export function effectValue(bundle: Bundle, state: PublicState, effect: string, profession?: string): number {
  return techniqueValue(bundle, state, effect, profession) + wornValue(bundle, state, effect);
}

/**
 * Worn items stay in the bag: take off every one the bag no longer holds
 * enough units of, or that no longer fits its place. `only` looks at one item.
 * Returns what came off, so the caller can tell the player.
 */
export function fitWorn(bundle: Bundle, state: PublicState, only?: string): { item: string; slot: WearSlot; look: boolean }[] {
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

/** The tended fire an id names: a map fire by its prop id, or the player's own by `OWN_FIRE`. Saves from before the fields existed read as none. */
export function fireOf(state: PublicState, id: string): FireState | undefined {
  return id === OWN_FIRE ? (state.player.own ?? undefined) : state.player.fires?.[id];
}

/** Whether a tended fire still burns at this game tick. */
export function fireBurns(state: PublicState, id: string, tick: number): boolean {
  return (fireOf(state, id)?.until ?? 0) > tick;
}

/** Game milliseconds one log lasts in a tended fire: `fire.log_ms`, and for the player's own fire what it was kindled with. */
export function logMsOf(bundle: Bundle, state: PublicState, id: string): number {
  return id === OWN_FIRE ? (state.player.own?.log ?? bundle.params.fire.log_ms) : bundle.params.fire.log_ms;
}

/** Whether an item feeds a fire: its class is wood, or a class an extension declares under wood. */
export function burnsAsWood(bundle: Bundle, itemId: string): boolean {
  const cls = bundle.items[itemId]?.class;
  return cls === 'wood' || (cls !== undefined && bundle.classes[cls]?.base === 'wood');
}

/**
 * Whether a fire has kept a `tend` step's vigil at this tick: the night of the last dusk at or
 * before it is over (the tick is at or after that night's dawn), and the fire was lit by that dusk
 * and burned without a gap to that dawn, or kept that night before it was lit again by day (`kept`).
 * Before dawn it does not hold, however much wood the fire has; by day it holds until the next dusk,
 * relit or not (DECISIONS.md, 2026-10-16: the vigil closes at dawn).
 */
export function tendHolds(bundle: Bundle, state: PublicState, id: string, tick: number): boolean {
  const fire = fireOf(state, id);
  // the player's own fire keeps a vigil only while it stands outside the town
  if (id === OWN_FIRE && state.player.own !== null && tagAt(bundle.map, state.player.own.at[0], state.player.own.at[1]) === 'town') return false;
  const dusk = lastDusk(bundle, tick);
  const dawn = nightEnds(bundle, dusk);
  return fire !== undefined && tick >= dawn && (fire.kept === dawn || (fire.lit <= dusk && fire.until >= dawn));
}

/**
 * The first tick from `tick` on at which a fire takes another log whole: at once while it is
 * out or a whole log still fits under its cap (`fire.cap` logs ahead of the tick), else once
 * enough of its wood has burned down. A log goes in whole or not at all, so no feed wastes wood.
 */
export function nextLogAt(bundle: Bundle, state: PublicState, id: string, tick: number): number {
  const until = fireOf(state, id)?.until ?? tick;
  return Math.max(tick, until - (bundle.params.fire.cap - 1) * logMsOf(bundle, state, id));
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
