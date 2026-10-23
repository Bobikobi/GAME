/**
 * The game state and the derived numbers every screen shows. The state holds
 * integers, strings, arrays and plain objects only, so its canonical text is
 * stable and a save is just that text.
 */
import type { SchoolNodeDef } from '@game/schema';
import type { BodyEffectName, Bundle, SchoolDef, Verb } from './bundle';
import { clamp, idiv, idivUp, mulDiv } from './num';
import { widenSeed, type Seed } from './rng';
import { tagAt, worldAt } from './world';

export const KERNEL_VERSION = '0.21.0';

/** Same list as the schema's ATTRIBUTES (a test keeps them equal); kept here so the kernel needs no runtime import. */
export const ATTRIBUTES = ['might', 'senses', 'agility', 'luck', 'stamina', 'spirit'] as const;
export type Attribute = (typeof ATTRIBUTES)[number];
/**
 * The shape of a saved state. Format 2 (kernel 0.14, the races): `attrs.carry` is `attrs.might`,
 * `attrs.spirit` is new, and the player's `starter` became a `race` and a wake `pocket`.
 * Format 3 (kernel 0.20, the keyed luck): the seed is a 128-bit key, four 32-bit words (`Seed`), where it
 * was one 32-bit number. `migrateState` brings an older save forward; a save always loads.
 */
export const STATE_FORMAT = 3;

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

/** Places on the character (DECISIONS.md, 2026-10-09: the upgrade). An outfit takes the top and the legs; the back holds a bag or a quiver (2026-10-23). */
export const WEAR_SLOTS = ['head', 'top', 'legs', 'outfit', 'feet', 'jewelry1', 'jewelry2', 'hand', 'back'] as const;
export type WearSlot = (typeof WEAR_SLOTS)[number];

const SLOTS_OF: Record<string, readonly WearSlot[]> = {
  head: ['head'],
  top: ['top'],
  legs: ['legs'],
  outfit: ['outfit'],
  feet: ['feet'],
  jewelry: ['jewelry1', 'jewelry2'],
  hand: ['hand'],
  back: ['back'],
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
  /**
   * The starting gold, in milli-gold, kept apart from the purse (DECISIONS.md, 2026-10-10: starting gold is bound).
   * A purchase at a shop takes from it first; nothing else reads or moves it, and it is never paid to a player or
   * listed. Absent in saves from before kernel 0.15, read as 0 (`migrateState`).
   */
  boundGold: number;
  bag: Record<string, number>;
  /** uses already taken from the tool unit in hand, per tool item */
  wear: Record<string, number>;
  /**
   * The health bar, in milli-points. It began as a food bar named satiety that a hunger drain emptied by the clock;
   * hazards take from it, food and a fall's reappearance give it back, and nothing drains it by the clock (G28;
   * DECISIONS.md, 2026-10-08 and 2026-10-10). A save from before kernel 0.19 carries its satiety over (`migrateState`).
   */
  hp: number;
  busyUntil: number;
  /** active ms per profession id */
  xp: Record<string, number>;
  attrs: Record<Attribute, number>;
  /** skill points spent: on attribute pips and on the nodes of the tree */
  spent: number;
  /** the learned nodes of the skill tree, "<school id>/<node id>", sorted; absent until the first one (saves from before kernel 0.16) */
  nodes?: string[];
  /** the build: the techniques in the active slots, in slot order; absent until the first one is put in */
  build?: string[];
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
  /** what the player dropped, by tile (`groundKey`): it stays there until picked up again (DECISIONS.md, 2026-10-23) */
  ground?: Record<string, Record<string, number>>;
  /** the fire the player kindled outside the town, if any; one stands at a time (null in saves from before kernel 0.12) */
  own: OwnFire | null;
  /** Expedition progress by expedition id. Chain quests persist separately in `quests`. */
  expeditions: Record<string, ExpeditionState>;
  /** falls so far: the draw counter of the tile they wake on (rule R4) */
  falls: number;
  /** tick of the last arrival: a position report, or an action at a tile */
  movedAt: number;
}

/**
 * What a searchable holds (docs/design/SEARCH.md): the rows drawn for one dawn, one item per row, in table order.
 * Taking a row removes it; nothing is drawn again before the next dawn, so an emptied searchable stays empty all day.
 */
export interface SearchState {
  /** the dawn these rows were drawn for (`searchDawn`) */
  dawn: number;
  rows: string[];
}

export interface State {
  format: number;
  kernel: string;
  content: string;
  /** the world's secret key (rule R4): every draw is keyed by it. Never on a screen or in a reply (`PublicState`) */
  seed: Seed;
  tick: number;
  player: Player;
  nodes: Record<string, NodeState>;
  /** what each searchable the player has searched holds, by searchable id; a save from before kernel 0.17 has none and reads as empty */
  searched: Record<string, SearchState>;
  /** every milli-gold that entered or left the world (rule R6: one ledger); the purse and the bound balance together are minted less burned */
  ledger: { minted: number; burned: number };
}

/** The state as a screen or a reply sees it: the seed is the server's alone (kernel-review R4). */
export type PublicState = Omit<State, 'seed'>;

/**
 * A world at its start. The key is a `Seed`; a plain number is a 32-bit seed of the kind kernel 0.19 kept,
 * widened as an old save is (`widenSeed`): a test's or a debug link's fixed world, never a live secret.
 */
export function newState(bundle: Bundle, seed: Seed | number): State {
  const attrs = Object.fromEntries(ATTRIBUTES.map((a) => [a, 0])) as Record<Attribute, number>;
  return {
    format: STATE_FORMAT,
    kernel: KERNEL_VERSION,
    content: bundle.tag,
    seed: typeof seed === 'number' ? widenSeed(seed) : [seed[0], seed[1], seed[2], seed[3]],
    tick: 0,
    player: {
      name: '',
      race: '',
      pocket: '',
      look: 0,
      at: [bundle.map.spawn.x, bundle.map.spawn.y],
      gold: 0,
      boundGold: 0,
      bag: {},
      wear: {},
      hp: 0,
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
    searched: {},
    ledger: { minted: 0, burned: 0 },
  };
}

/**
 * Brings a saved state of an older format forward (format 1 to 2: the races; 2 to 3: the seed widens
 * to a key, `widenSeed`, the same key wherever the save is loaded). Pure: returns a new
 * object and leaves the input as it was. `carry` is read as `might`, `spirit` starts at 0, and the
 * starter becomes its race and its pocket (LEGACY_STARTERS); an unknown starter keeps its id as the
 * race with no pocket, and the caller decides whether the content still holds it. The old six-point
 * total stays as it is: the seven is a content rule, not a save rule.
 */
export function migrateState(saved: State): State {
  const s = structuredClone(saved) as State & { player: Player & { starter?: string; attrs: Record<string, number> } };
  // kernel 0.15: the bound balance is a field of its own; a save without it holds none
  s.player.boundGold ??= 0;
  // a save from before kernel 0.17 has searched nothing: it reads as empty, whatever its format
  s.searched ??= {};
  // kernel 0.19: the health bar is named hp and has no clock; a save from before it carries its satiety over
  // (the core drained nothing since P-5c, so the stored value is the value now), whatever its format
  const named = s.player as Player & { satiety?: number; satietyAt?: number };
  if (named.satiety !== undefined) {
    named.hp ??= named.satiety;
    delete named.satiety;
  }
  delete named.satietyAt;
  const format = s.format ?? 1;
  if (format < 2) toFormat2(s);
  // kernel 0.20: the 32-bit seed widens to a 128-bit key; its draws differ from before, as every draw does.
  // A state the server stored has no seed at all (its key is a column of its own): it stays without one.
  const seed: unknown = s.seed;
  if (typeof seed === 'number') s.seed = widenSeed(seed);
  if (format < STATE_FORMAT) s.format = STATE_FORMAT;
  return s;
}

/** Format 1 to 2, in place: the races. */
function toFormat2(s: State & { player: Player & { starter?: string; attrs: Record<string, number> } }): void {
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

/** The health bar's top, in milli-points: the base cap plus what stamina adds. */
export function hpCap(bundle: Bundle, state: PublicState): number {
  return (bundle.params.hp_cap + bundle.params.per_point.stamina * attrAt(bundle, state, 'stamina')) * 1000;
}

/**
 * The places the bag's things take (DECISIONS.md, 2026-10-23): things of one kind share a place, up to
 * `place_stack` of them, so a place holds a stack. What is on the body takes none: the units worn on
 * either layer, the tool in the hand and ONE tool at the belt - the owner's answer of 23.10, not one of
 * each kind. A hand with no tool worn in it holds one of the bag's tools. Every other tool goes in the
 * places. Weight still counts every unit (`loadWeight`).
 */
export function bagUsed(bundle: Bundle, state: PublicState): number {
  return placesWith(bundle, state, {});
}

/** The places the bag would take with `delta` units added to (or taken from) it. */
export function placesWith(bundle: Bundle, state: PublicState, delta: Record<string, number>): number {
  const p = state.player;
  const stack = Math.max(1, bundle.params.place_stack);
  const worn = onBodyCounts(state);
  let n = 0;
  let single = 0;
  for (const id of new Set([...Object.keys(p.bag), ...Object.keys(delta)])) {
    const loose = Math.max(0, (p.bag[id] ?? 0) + (delta[id] ?? 0) - (worn[id] ?? 0));
    n += idivUp(loose, stack);
    // a tool carried on the body saves a place where that tool's last stack holds just one
    if (bundle.items[id]?.tool !== undefined && loose % stack === 1) single++;
  }
  // the belt holds one tool, and the hand one more unless a tool is worn there already
  const onBody = p.worn.hand === undefined ? 2 : 1;
  return n - Math.min(onBody, single);
}

/** How many more units of one kind fit in the places: up to the free places, or into what is left of its own stacks when over. */
export function placeRoom(bundle: Bundle, state: PublicState, itemId: string): number {
  const ceiling = Math.max(bagCapacity(bundle, state), bagUsed(bundle, state));
  const stack = Math.max(1, bundle.params.place_stack);
  let lo = 0;
  let hi = (ceiling + 2) * stack;
  while (lo < hi) {
    const mid = hi - idiv(hi - lo, 2);
    if (placesWith(bundle, state, { [itemId]: mid }) <= ceiling) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/** The key of a tile in `player.ground`. */
export function groundKey(at: readonly [number, number]): string {
  return `${at[0]},${at[1]}`;
}

function onBodyCounts(state: PublicState): Record<string, number> {
  const p = state.player;
  const worn: Record<string, number> = {};
  for (const layer of [p.worn, p.looks]) for (const id of Object.values(layer)) if (id !== undefined) worn[id] = (worn[id] ?? 0) + 1;
  return worn;
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

/**
 * The places the player has (DECISIONS.md, 2026-10-23): what is on the back decides, `bag_base` with
 * nothing there (hands and belt) and the bag's own `wear.places` with a bag, plus the race's
 * `bag_places` in any bag (never bare hands), plus a camp chest's `bag_bonus`. Might no longer adds
 * places: it raises the weight limit (`loadLimit`).
 */
export function bagCapacity(bundle: Bundle, state: PublicState): number {
  const places = backBag(bundle, state)?.places;
  let cap = places === undefined ? bundle.params.bag_base : places + bodyValue(bundle, state, 'bag_places', 0);
  for (const id of state.player.camp) cap += bundle.camps[id]?.bag_bonus ?? 0;
  return cap;
}

/** The bag on the back's work layer: its places and what it adds to the weight limit, or undefined with none there. */
export function backBag(bundle: Bundle, state: PublicState): { item: string; places: number; load_bonus: number } | undefined {
  const id = state.player.worn.back;
  const w = id === undefined ? undefined : bundle.items[id]?.wear;
  if (!w || w.look || w.places === undefined) return undefined;
  return { item: id!, places: w.places, load_bonus: w.load_bonus ?? 0 };
}

/** One effect of the race's body fact (DECISIONS.md, 2026-10-23), or `fallback` when its body names none. */
export function bodyValue(bundle: Bundle, state: PublicState, effect: BodyEffectName, fallback: number): number {
  return bundle.races[state.player.race]?.body?.effects.find((e) => e.effect === effect)?.value ?? fallback;
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

/** The verb a node trains: a node worked with an axe is felled, one worked with a rod is fished, a mined one trains digging, any other is gathered. */
export function nodeVerb(resource: { tool?: string; work?: string }): Verb {
  if (resource.tool === 'axe') return 'fell';
  if (resource.tool === 'rod') return 'fish';
  return resource.work === 'mine' ? 'dig' : 'gather';
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

/**
 * Sum of a technique effect: the ones the player has unlocked through profession levels, and the
 * learned nodes of the tree (a small node always, a technique only while it sits in the build);
 * `only` counts one profession's.
 */
export function techniqueValue(bundle: Bundle, state: PublicState, effect: string, only?: string): number {
  let total = 0;
  for (const id of Object.keys(bundle.professions).sort()) {
    if (only !== undefined && id !== only) continue;
    const prof = bundle.professions[id]!;
    const level = professionLevel(bundle, state, id);
    for (const t of prof.techniques) if (t.effect === effect && level >= t.level) total += Math.max(1, t.value);
  }
  const build = state.player.build ?? [];
  for (const key of state.player.nodes ?? []) {
    const found = treeNode(bundle, key);
    if (!found || found.node.effect !== effect) continue;
    if (only !== undefined && found.school.profession !== only) continue;
    if (found.node.slot === true && !build.includes(key)) continue;
    total += Math.max(1, found.node.value);
  }
  return total;
}

// ------------------------------------------------------------------ the skill tree

/** A node of the tree as a player keeps it: "<school id>/<node id>". */
export function nodeKey(school: string, node: string): string {
  return `${school}/${node}`;
}

/** The school and the node a key names, if the content has them. */
export function treeNode(bundle: Bundle, key: string): { school: SchoolDef; node: SchoolNodeDef } | undefined {
  const cut = key.lastIndexOf('/');
  if (cut < 0) return undefined;
  const school = bundle.schools?.[key.slice(0, cut)];
  const node = school?.nodes.find((n) => n.id === key.slice(cut + 1));
  return school && node ? { school, node } : undefined;
}

/** The skill points a node costs: its own price, or its size's; a tree with no growth params costs nothing it can sell. */
export function nodeCost(bundle: Bundle, node: Pick<SchoolNodeDef, 'size' | 'cost'>): number {
  if (!bundle.params.growth) return 0;
  return node.cost ?? bundle.params.growth.cost[node.size] ?? 0;
}

/** The key of a node a need names: a node of the same school by its id, or of another by "<school id>/<node id>". */
export function needKey(school: string, need: string): string {
  return need.includes('/') ? need : nodeKey(school, need);
}

/** How many active slots the build has open at the player's character level. */
export function slotsOpen(bundle: Bundle, state: PublicState): number {
  const level = characterLevel(bundle, state);
  return (bundle.params.growth?.slot_levels ?? []).filter((l) => l <= level).length;
}

/** Whether a node is the player's to see: a corner belongs to one race, every other node to all. */
export function nodeIsOurs(state: PublicState, node: SchoolNodeDef): boolean {
  return node.size !== 'corner' || node.race === state.player.race;
}

/**
 * Why the player cannot learn this node now, in the kernel's own words, or undefined when they can.
 * The place is not asked here (the action asks it): this is what the tree screen shows on a node.
 */
export function nodeRefusal(bundle: Bundle, state: PublicState, key: string): string | undefined {
  const found = treeNode(bundle, key);
  if (!found || !bundle.params.growth) return 'There is no such thing to learn.';
  const { school, node } = found;
  const p = state.player;
  if ((p.nodes ?? []).includes(key)) return 'You know this already.';
  if (!nodeIsOurs(state, node)) return 'That belongs to another race.';
  const missing = (node.needs ?? []).map((n) => needKey(school.id, n)).filter((k) => !(p.nodes ?? []).includes(k));
  if (missing.length > 0) {
    const names = missing.map((k) => treeNode(bundle, k)?.node.name ?? k);
    return `Learn ${names.join(' and ')} first.`;
  }
  for (const attr of ATTRIBUTES) {
    const want = node.key?.[attr];
    if (want !== undefined && (p.attrs[attr] ?? 0) < want) return `Needs ${attr} ${want} - you have ${p.attrs[attr] ?? 0}.`;
  }
  const cost = nodeCost(bundle, node);
  if (skillPoints(bundle, state) < cost) return cost === 1 ? 'Needs a skill point.' : `Needs ${cost} skill points.`;
  return undefined;
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

/**
 * The count of dawns (05:00) the world has seen at this tick: 0 until the first dawn, then one more at each. A searchable
 * is drawn fresh when this number has moved since it was last drawn (docs/design/SEARCH.md rule 5). It flips at dawn, not at
 * noon like `dayOf`, and tick 0 is noon.
 */
export function searchDawn(bundle: Bundle, tick: number): number {
  const day = bundle.params.day_length_ms;
  return idiv(tick + idiv(day, 2) - idivUp(5 * day, 24), day);
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
