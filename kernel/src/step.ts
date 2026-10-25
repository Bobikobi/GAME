/**
 * The one simulation (rule R1): step(bundle, state, action, tick) returns the
 * next state, or a refusal in words a player can read. No clock, no random
 * source, no timers: time is the `tick` the caller passes (game ms, which
 * only advances while playing) and luck is a draw from rng.ts.
 *
 * An action happens at once and keeps the player busy until busyUntil; the
 * client plays the animation for that long. The timing grade (0-4) comes
 * from the minigame and can only lower the goods below perfect play (D2), so
 * a client that always claims "perfect" earns what the economy already
 * assumes. Grade 4, the jackpot, is a thin strip inside "perfect": the same
 * goods, three times the experience. Experience is not part of item values,
 * so the jackpot speeds up levels and nothing else.
 *
 * A craft can miss (G40): skill against the recipe's level sets the chance,
 * luck only tilts it, and a miss keeps something. The value table prices a
 * recipe at perfect execution, and nothing lifts a craft above it (R9).
 */
import type { Bundle, QuestDef, RecipeDef, Verb } from './bundle';
import { canonical } from './canon';
import { bitesAfter, dangerAt, distanceTo, fireArea, harmOf, hazardsOf, isSafe, isTownTile, reappearTile, sees, townAt, watchedAt, windowOpen, windowShuts } from './danger';
import { bellTicks, inside as insideExpedition, lastBellAt, visitNight, windowOpen as expeditionWindowOpen } from './expedition';
import { clamp, idiv, idivUp, mulDiv, mulDivUp } from './num';
import { appearSlot, cuesOnStep, placedAt, reactionHolds, resourceOf, waitPermille } from './reactions';
import { drawBasisPoints } from './rng';
import {
  ATTRIBUTES,
  type Attribute,
  type FireState,
  LEGACY_STARTERS,
  legacyNodeId,
  OWN_FIRE,
  type OwnFire,
  type State,
  WEAR_SLOTS,
  type WearSlot,
  attrAt,
  bagCapacity,
  bagUsed,
  burnsAsWood,
  campBuilt,
  effectValue,
  fitWorn,
  fireBurns,
  fireOf,
  gradeShift,
  hourOf,
  isNight,
  lastDusk,
  logMsOf,
  nextLogAt,
  nightEnds,
  nodeVerb,
  powerCap,
  professionLevel,
  satietyAt,
  satietyCap,
  nodeCost,
  nodeRefusal,
  skillPoints,
  slotsFor,
  slotsOpen,
  treeNode,
  tendHolds,
  verbLevel,
  type PublicState,
} from './state';
import { rarityRank, payFor } from './values';
import { campTile, findSlot, inRect, makeWalkable, near, npcTile, type Rect } from './world';

export type Tile = [number, number];
export type Grade = 0 | 1 | 2 | 3 | 4;

export type Action =
  /**
   * Pick the race and begin: the seed draws the wake pocket. `starter` is the format 1 word, still
   * read so a logged game replays: it names the race and the pocket the old starter became.
   */
  | { t: 'start'; race?: string; starter?: string; name: string; look?: number }
  | { t: 'carve'; name: string }
  | { t: 'gather'; node: string; grade: Grade; at: Tile }
  | { t: 'dig'; spot: string; grade: Grade; at: Tile }
  | { t: 'craft'; recipe: string; at: Tile }
  | { t: 'eat'; item: string }
  | { t: 'feed'; fire: string; item: string; at: Tile }
  /** build the player's own fire on `fire`, a free tile beside `at`, outside the town (G30) */
  | { t: 'kindle'; fire: Tile; at: Tile }
  | { t: 'buy'; npc: string; item: string; qty: number; at: Tile }
  | { t: 'sell'; npc: string; item: string; qty: number; at: Tile }
  | { t: 'restore'; restore: string; at: Tile }
  | { t: 'build'; camp: string; at: Tile }
  | { t: 'accept'; quest: string; at: Tile }
  | { t: 'turnin'; quest: string; at: Tile }
  | { t: 'visit'; slot: string; at: Tile }
  | { t: 'learn'; item: string }
  | { t: 'spend'; attr: Attribute }
  /** the skill tree (docs/design/GROWTH.md section 4.3): learn a node, and put a technique in a slot of the build or take it out, at a safe place */
  | { t: 'learn_node'; node: string; at: Tile }
  | { t: 'equip'; node: string; slot: number; at: Tile }
  | { t: 'unequip'; slot: number; at: Tile }
  | { t: 'wear'; item: string; slot?: WearSlot }
  | { t: 'unwear'; slot: WearSlot; look?: boolean }
  | { t: 'move'; at: Tile };

export type GameEvent =
  | { e: 'gain'; item: string; qty: number }
  | { e: 'spend'; item: string; qty: number }
  | { e: 'bag_full'; item: string; qty: number }
  | { e: 'gold'; delta: number }
  /** the bound starting gold moved (milli-gold); the purse's own movements are `gold` */
  | { e: 'bound'; delta: number }
  | { e: 'level'; profession: string; level: number }
  | { e: 'discover'; item: string }
  | { e: 'learn'; recipe: string }
  | { e: 'quest'; quest: string; state: 'active' | 'done' }
  | { e: 'riddle'; quest: string }
  | { e: 'restore'; restore: string }
  | { e: 'build'; camp: string }
  | { e: 'eat'; item: string; satiety: number }
  | { e: 'fire'; id: string; until: number }
  /** a fire a `tend` step of an open quest keeps went out in the night it was keeping, so that night is lost: once per burn, at the first step at or after its `until` */
  | { e: 'fire_out'; id: string }
  | { e: 'busy'; verb: string; ms: number }
  | { e: 'nothing'; verb: string }
  | { e: 'jackpot'; verb: string }
  | { e: 'tool_broke'; item: string }
  | { e: 'visit'; slot: string }
  | { e: 'attr'; attr: Attribute; value: number }
  /** a node of the tree was learned, for `cost` skill points */
  | { e: 'node'; node: string; cost: number }
  /** a technique went into a slot of the build, or came out of one */
  | { e: 'equip'; node: string; slot: number }
  | { e: 'unequip'; node: string; slot: number }
  /** the player stepped into a world that grades their race otherwise: a home attribute now counts `value` (DECISIONS.md, 2026-10-22) */
  | { e: 'grade'; attr: Attribute; value: number }
  | { e: 'miss'; recipe: string }
  | { e: 'wear'; item: string; slot: WearSlot; look: boolean }
  | { e: 'unwear'; item: string; slot: WearSlot; look: boolean }
  /** health went down: `by` is a hazard kind or "food"; `id` the hazard prop; `hp` what is left, in milli-points */
  | { e: 'hurt'; by: string; id?: string; hp: number }
  /** health reached zero (G33): the player fell at `from`, lost `lost` (what the outing brought), and woke at `at` */
  | { e: 'fall'; from: Tile; at: Tile; lost: { item: string; qty: number }[] }
  /** a predator noticed the player and a hunt began: once, at the step that starts it; `id` is the predator prop */
  | { e: 'seen'; id: string }
  /** a hunt ended because the player reached a safe place (G30), not at dawn, in a fall or at a walk-out (G49); `bitten` when it bit at least once */
  | { e: 'safe'; id: string; bitten: boolean }
  | { e: 'bell'; expedition: string; n: number }
  | { e: 'walked_out'; expedition: string }
  | { e: 'climax'; expedition: string }
  /** a sign the world raised on this step (REACTIONS.md section 5): drawn and heard, never a number or a word */
  | { e: 'cue'; cue: string; reaction: string; anchor: string; x: number; y: number };

export type StepResult = { ok: true; state: State; events: GameEvent[] } | { ok: false; error: string };

export interface StepOptions {
  /** Enforce server-side four-way reachability for reported and action tiles (G56). */
  validateTravel?: boolean;
}

/** Output share per timing grade: miss, ok, good, perfect, jackpot. A missed dig keeps a quarter of its chances. */
export const GRADE_PCT = [25, 50, 80, 100, 100] as const;
/** A missed gather still brings one unit home this often, in basis points, before luck: a miss is a gamble, not a wall. */
export const MISS_KEEP_BP = 5000;
/** Luck never makes a miss a sure thing. */
export const MISS_KEEP_MAX_BP = 9000;
/** Experience for a jackpot, as a multiple of a normal action's. */
export const JACKPOT_XP = 3;

/** How often a missed gather still brings one unit home, in basis points: luck raises it. */
export function missKeepBp(bundle: Bundle, state: PublicState): number {
  return Math.min(MISS_KEEP_MAX_BP, MISS_KEEP_BP + 10 * bundle.params.per_point.luck_permille * attrAt(bundle, state, 'luck'));
}

/** The multiplier on rare and legendary dig chances, in permille: luck, techniques and worn items, inside the power cap. */
export function rareFindPermille(bundle: Bundle, state: PublicState): number {
  const raw = 1000 + bundle.params.per_point.luck_permille * attrAt(bundle, state, 'luck') + 10 * effectValue(bundle, state, 'rare_find_pct');
  return clamp(raw, 1000, powerCap(bundle, state));
}

/** The profession that gates a recipe and that it trains: its own, else its station's (DECISIONS.md, 2026-10-09). */
export function recipeProfession(bundle: Bundle, recipe: RecipeDef): string {
  return recipe.profession ?? bundle.stations[recipe.station] ?? bundle.verbs.craft;
}

/** A recipe's tier: the highest tier among its outputs. It needs a station of that tier. */
export function recipeTier(bundle: Bundle, recipe: RecipeDef): number {
  return Math.max(1, ...recipe.outputs.map((o) => bundle.items[o.item]?.tier ?? 1));
}

/**
 * How much of the gap to a sure craft luck closes, in permille: the
 * character's luck and the craft-chance effect (a luck stone is a worn piece
 * that carries it), inside the power cap and never past
 * craft_luck_max_permille. Luck tilts; it never decides.
 */
export function craftLuckPermille(bundle: Bundle, state: State, profession: string): number {
  const raw =
    1000 + bundle.params.per_point.luck_permille * attrAt(bundle, state, 'luck') + 10 * effectValue(bundle, state, 'craft_chance_pct', profession);
  return Math.min(bundle.params.craft_luck_max_permille, clamp(raw, 1000, powerCap(bundle, state)) - 1000);
}

/** The chance a craft succeeds now, in basis points (G40): skill against the recipe's level, then luck closes part of the gap. */
export function craftChanceBp(bundle: Bundle, state: State, recipeId: string): number {
  const c = bundle.recipes[recipeId];
  if (!c) return 0;
  const p = bundle.params;
  const byTier = p.craft_chance_bp;
  const base = byTier[Math.min(recipeTier(bundle, c), byTier.length) - 1] ?? 10_000;
  const profession = recipeProfession(bundle, c);
  // no level wall (CR-17): each level over the recipe's adds a step and each missing level takes one off, down to nothing
  const skill = clamp(base + (professionLevel(bundle, state, profession) - c.level) * p.craft_level_step_bp, 0, 10_000);
  // a try at nothing runs and misses: luck closes part of a gap, it never opens one
  if (skill === 0) return 0;
  return skill + mulDiv(10_000 - skill, craftLuckPermille(bundle, state, profession), 1000);
}

/**
 * What a missed craft leaves (G40): part of the inputs and nothing else.
 * `keep` is aligned with the recipe's inputs, each its share rounded down.
 * When that would leave nothing, one unit of the most valuable input comes
 * back.
 */
export function missOutcome(bundle: Bundle, recipe: RecipeDef): { keep: { item: string; qty: number }[] } {
  const pct = recipe.miss?.keep_pct ?? bundle.params.craft_miss_keep_pct;
  const keep = recipe.inputs.map((s) => ({ item: s.item, qty: mulDiv(s.qty, pct, 100) }));
  if (keep.every((k) => k.qty === 0)) {
    let best = 0;
    recipe.inputs.forEach((s, i) => {
      if ((bundle.values[s.item] ?? 0) > (bundle.values[recipe.inputs[best]!.item] ?? 0)) best = i;
    });
    keep[best]!.qty = 1;
  }
  return { keep };
}

class Refusal extends Error {}
function refuse(message: string): never {
  throw new Refusal(message);
}

const walkableCache = new WeakMap<Bundle, ReturnType<typeof makeWalkable>>();
function walkableFor(bundle: Bundle) {
  let fn = walkableCache.get(bundle);
  if (!fn) {
    fn = makeWalkable(bundle);
    walkableCache.set(bundle, fn);
  }
  return fn;
}

/** The shortest four-way path to a tile, limited to a square and a maximum number of steps. */
export function walkDistance(bundle: Bundle, state: State, from: Tile, target: Tile, maxSteps: number): number | undefined {
  const validTile = (tile: Tile): boolean =>
    Array.isArray(tile) && tile.length === 2 && tile.every(Number.isSafeInteger);
  if (!validTile(from) || !validTile(target) || !Number.isSafeInteger(maxSteps) || maxSteps < 0) return undefined;
  const walkable = walkableFor(bundle);
  if (!walkable(target[0], target[1], state.player)) return undefined;
  if (from[0] === target[0] && from[1] === target[1]) return 0;

  const side = 2 * maxSteps + 1;
  const minX = from[0] - maxSteps;
  const minY = from[1] - maxSteps;
  const key = (x: number, y: number): number => (y - minY) * side + (x - minX);
  const seen = new Set<number>([key(from[0], from[1])]);
  const queue: Array<{ x: number; y: number; steps: number }> = [{ x: from[0], y: from[1], steps: 0 }];
  const directions: readonly Tile[] = [[0, -1], [1, 0], [0, 1], [-1, 0]];

  for (let head = 0; head < queue.length; head++) {
    const current = queue[head]!;
    if (current.steps >= maxSteps) continue;
    for (const [stepX, stepY] of directions) {
      const x = current.x + stepX;
      const y = current.y + stepY;
      if (x < minX || x > from[0] + maxSteps || y < minY || y > from[1] + maxSteps) continue;
      const nextKey = key(x, y);
      if (seen.has(nextKey) || !walkable(x, y, state.player)) continue;
      const steps = current.steps + 1;
      if (x === target[0] && y === target[1]) return steps;
      seen.add(nextKey);
      queue.push({ x, y, steps });
    }
  }
  return undefined;
}

/** A four-way step, in thousandths of a step: what a straight step costs the movement credit (G56). */
export const STEP_MILLI = 1000;
/** Two four-way steps that turn a corner are one diagonal step, `1414 / 1000`: the octile length of the walk (G56). */
export const DIAGONAL_PAIR_MILLI = 1414;

/**
 * What a reported walk costs, in thousandths of a step: the octile length of its four-way path (G56). A free walk
 * on a diagonal reports a staircase of single steps, and a step that turns off a single step still unpaired closes
 * a diagonal pair, which costs `DIAGONAL_PAIR_MILLI` for the two. `leg` is that unpaired step's direction, and the
 * answer carries the next one: `null` once a pair is closed, after a report of more than one step, or when there
 * is none. A report of several steps pairs as many as its two axes share. The reach is four-way and unchanged:
 * `undefined` when `walkDistance` finds no path.
 */
export function walkCharge(
  bundle: Bundle,
  state: State,
  from: Tile,
  target: Tile,
  maxSteps: number,
  leg: Tile | null,
): { milli: number; leg: Tile | null } | undefined {
  const steps = walkDistance(bundle, state, from, target, maxSteps);
  if (steps === undefined) return undefined;
  if (steps === 0) return { milli: 0, leg };
  const dx = target[0] - from[0];
  const dy = target[1] - from[1];
  if (steps === 1) {
    // a step across the unpaired one before it closes the pair: 1414 for the two, 1000 of it already paid
    if (leg !== null && leg[0] * dx + leg[1] * dy === 0) return { milli: DIAGONAL_PAIR_MILLI - STEP_MILLI, leg: null };
    return { milli: STEP_MILLI, leg: [dx, dy] };
  }
  const pairs = Math.min(Math.abs(dx), Math.abs(dy));
  return { milli: steps * STEP_MILLI - pairs * (2 * STEP_MILLI - DIAGONAL_PAIR_MILLI), leg: null };
}

interface Ctx {
  b: Bundle;
  s: State;
  tick: number;
  events: GameEvent[];
  /** something took health in this step: only then can zero health be a fall (G33) */
  hurt: boolean;
  /** the player fell in this step (G33) */
  fell: boolean;
  /** the expedition visit whose last bell rang since the step before, and that bell: the world acts on the player as it stood at that bell (G49) */
  walkOut?: { expedition: string; bell: number };
}

export function step(bundle: Bundle, state: State, action: Action, tick: number, options: StepOptions = {}): StepResult {
  if (!Number.isSafeInteger(tick) || tick < state.tick) return { ok: false, error: 'Time cannot run backwards.' };
  if (state.content !== bundle.tag) return { ok: false, error: 'This save belongs to different game content.' };
  const ctx: Ctx = { b: bundle, s: structuredClone(state), tick, events: [], hurt: false, fell: false };
  // Quest reads use the state's clock; advance the clone before an explicit or automatic turn-in reads it.
  ctx.s.tick = tick;
  ctx.s.player.fires ??= {};
  ctx.s.player.own ??= null;
  ctx.s.player.expeditions ??= {};
  ctx.s.player.bitten ??= [];
  try {
    ctx.walkOut = walkOutDue(ctx);
    firesOut(ctx, state.tick);
    apply(ctx, action, options);
    autoQuests(ctx);
    expeditions(ctx);
    return { ok: true, state: ctx.s, events: ctx.events };
  } catch (err) {
    if (err instanceof Refusal) return { ok: false, error: err.message };
    throw err;
  }
}

/** Run a list of actions from a fresh state; stops at the first refusal. */
export function replay(
  bundle: Bundle,
  start: State,
  log: readonly { a: Action; tick: number }[],
  options: StepOptions = {},
): { state: State; events: GameEvent[]; error?: string; at?: number } {
  let state = start;
  const events: GameEvent[] = [];
  for (let i = 0; i < log.length; i++) {
    const entry = log[i]!;
    const r = step(bundle, state, entry.a, entry.tick, options);
    if (!r.ok) return { state, events, error: r.error, at: i };
    state = r.state;
    events.push(...r.events);
  }
  return { state, events };
}

// ------------------------------------------------------------------ actions

function apply(ctx: Ctx, a: Action, options: StepOptions): void {
  const { s } = ctx;
  if (a.t === 'start') return start(ctx, a);
  if (s.player.race === '') refuse('Pick a character first.');
  // a position report and a carved name are not work: they go through while the player is busy
  if (a.t !== 'move' && a.t !== 'carve' && ctx.tick < s.player.busyUntil) refuse('You are still busy.');
  // satiety is kept lazily: bring it up to now before anything reads it
  s.player.satiety = satietyAt(ctx.b, s, ctx.tick);
  s.player.satietyAt = ctx.tick;
  if (a.t === 'move') return moveTo(ctx, a.at, options.validateTravel === true);
  // past an expedition's last bell the mist walks the player out first: the action is not made, and its tile is not read (G49)
  if (ctx.walkOut !== undefined) {
    arrive(ctx, s.player.at);
    return;
  }
  if (options.validateTravel) {
    checkTravel(ctx, tileOf(a, s.player.at));
    if (a.t === 'kindle') checkTravel(ctx, a.fire);
  }
  // wherever the action is made, the world acts on the player first; a fall ends the step and the action does not happen
  if (arrive(ctx, tileOf(a, s.player.at))) return;
  perform(ctx, a);
  // a camp part built under their feet makes this tile safe: the hunt and the outing end with it
  if (isSafe(ctx.b, s, s.player.at)) reachSafety(ctx);
  fallIfDown(ctx);
}

/** The tile an action says the player stands on, else the tile they were last on. */
function tileOf(a: Action, last: Tile): Tile {
  return 'at' in a && Array.isArray(a.at) && a.at.length === 2 && Number.isSafeInteger(a.at[0]) && Number.isSafeInteger(a.at[1]) ? a.at : last;
}

function perform(ctx: Ctx, a: Action): void {
  switch (a.t) {
    case 'gather':
      return gather(ctx, a.node, a.grade, a.at);
    case 'dig':
      // a logged dig from format 1 may name a spot by its old source id
      return dig(ctx, ctx.b.instances[a.spot] ? a.spot : legacyNodeId(a.spot), a.grade, a.at);
    case 'craft':
      return craft(ctx, a.recipe, a.at);
    case 'eat':
      return eat(ctx, a.item);
    case 'feed':
      return feed(ctx, a.fire, a.item, a.at);
    case 'kindle':
      return kindle(ctx, a.fire, a.at);
    case 'buy':
      return buy(ctx, a.npc, a.item, a.qty, a.at);
    case 'sell':
      return sell(ctx, a.npc, a.item, a.qty, a.at);
    case 'restore':
      return restore(ctx, a.restore, a.at);
    case 'build':
      return build(ctx, a.camp, a.at);
    case 'accept':
      return accept(ctx, a.quest, a.at);
    case 'turnin':
      return turnIn(ctx, a.quest, a.at, true);
    case 'visit':
      return visit(ctx, a.slot, a.at);
    case 'learn':
      return learn(ctx, a.item);
    case 'carve':
      return carve(ctx, a.name);
    case 'spend':
      return spend(ctx, a.attr);
    case 'learn_node':
      return learnNode(ctx, a.node);
    case 'equip':
      return equip(ctx, a.node, a.slot);
    case 'unequip':
      return unequip(ctx, a.slot);
    case 'wear':
      return wear(ctx, a.item, a.slot);
    case 'unwear':
      return unwear(ctx, a.slot, a.look === true);
    default:
      refuse('Unknown action.');
  }
}

function checkName(name: string): void {
  if (!/^[A-Za-z0-9 _-]{1,16}$/.test(name) || name.trim() === '') {
    refuse('A name is 1 to 16 letters, digits, spaces, "_" or "-".');
  }
}

/** Sets the name of a character that has none yet; a name already set is kept. */
function carve(ctx: Ctx, name: string): void {
  const p = ctx.s.player;
  if (p.name !== '') refuse('The name is already carved.');
  checkName(name);
  p.name = name.trim();
}

/**
 * The wake pocket the world's seed draws for a new game (DECISIONS.md, 2026-10-22): one of the
 * bundle's pockets, by id order, never chosen and never the race's. '' when the content has none.
 */
export function wakePocket(bundle: Bundle, seed: number): string {
  const ids = Object.keys(bundle.pockets).sort();
  if (ids.length === 0) return '';
  return ids[idiv(drawBasisPoints(seed >>> 0, 'pocket', 0) * ids.length, 10_000)]!;
}

/**
 * The placed spots that lay a pocket's tools on the ground by its wake: a spot of that pocket that
 * asks no tool and finds nothing but the pocket's ground items. A pocket's own task spot (a glint, a
 * slid bank) is not one of them, even when it asks no tool.
 */
export function groundSpots(bundle: Bundle, pocketId: string): string[] {
  const ground = new Set((bundle.pockets[pocketId]?.ground ?? []).map((k) => k.item));
  return Object.entries(bundle.instances)
    .filter(([, inst]) => {
      const t = inst.kind === 'treasure' ? bundle.treasures[inst.source] : undefined;
      return t !== undefined && t.pocket === pocketId && t.tool === undefined && t.finds.every((f) => ground.has(f.item));
    })
    .map(([id]) => id)
    .sort();
}

function start(ctx: Ctx, a: Extract<Action, { t: 'start' }>): void {
  const { b, s } = ctx;
  if (s.player.race !== '') refuse('The character is already chosen.');
  // a format 1 start names a starter: it becomes the race and the pocket that starter turned into, with its old profile and kit, so a logged game replays as it played
  const legacy = a.race === undefined && a.starter !== undefined ? LEGACY_STARTERS[a.starter] : undefined;
  const raceId = a.race ?? legacy?.race ?? '';
  const race = b.races[raceId];
  if (!race) refuse('Unknown character.');
  let look = a.look ?? 0;
  if (legacy && look === 1 && !race.sprite_alt) look = 0;
  if (look !== 0 && !(look === 1 && race.sprite_alt)) refuse('Unknown look.');
  const pocketId = legacy?.pocket ?? wakePocket(b, s.seed);
  const pocket = b.pockets[pocketId];
  if (!pocket) refuse('There is nowhere to wake.');
  // an empty name is allowed: the player carves it at the bridge's stone (carve)
  const name = a.name ?? '';
  if (name.trim() !== '') checkName(name);
  s.player.name = name.trim();
  s.player.race = raceId;
  s.player.pocket = pocketId;
  s.player.look = look;
  s.player.attrs = legacy ? { ...legacy.attrs } : { ...race.attributes };
  // the wake tile first: the grade of the world under it counts in the health cap below
  s.player.at = [pocket.wake.x, pocket.wake.y];
  // the starting gold is a bound balance beside the purse, not purse gold (DECISIONS.md, 2026-10-10)
  s.player.boundGold = b.params.starting_gold_mg;
  if (b.params.starting_gold_mg > 0) s.ledger.minted += b.params.starting_gold_mg;
  s.player.satiety = satietyCap(b, s);
  s.player.satietyAt = ctx.tick;
  s.player.movedAt = ctx.tick;
  s.player.recipes = Object.keys(b.recipes)
    .filter((id) => b.recipes[id]!.known === 'start')
    .sort();
  // the race's outfit is worn from the first morning; the pocket's tools lie on the ground by the wake tile (its own spots), never in the bag
  // a format 1 starter carried only its kit (its pocket's tools, now in the bag, their spots spent) and no race outfit, so a logged game rolls as it did
  const firstMorning = legacy ? [...pocket.ground] : [...(race.outfit ?? [])];
  if (legacy) for (const id of groundSpots(b, pocketId)) s.nodes[id] = { readyAt: 0, draws: 1 };
  for (const stack of firstMorning) addItem(ctx, stack.item, stack.qty);
  for (const stack of firstMorning) {
    const w = b.items[stack.item]?.wear;
    if (w && w.look !== true && (s.player.bag[stack.item] ?? 0) > 0 && !Object.values(s.player.worn).includes(stack.item)) wear(ctx, stack.item, undefined);
  }
}

function gather(ctx: Ctx, nodeId: string, grade: Grade, at: Tile): void {
  const { b, s } = ctx;
  // a placed node, or one a reaction makes appear beside it (docs/design/REACTIONS.md)
  const inst = placedAt(b, nodeId);
  if (!inst || inst.kind !== 'resource') refuse('There is nothing to gather here.');
  const r = resourceOf(b, nodeId)!;
  checkAt(ctx, at, { x: inst.x, y: inst.y, w: 1, h: 1 });
  checkGrade(grade);
  if (nodeLocked(b, s, r)) refuse('Something else catches the light first.');
  const appear = appearSlot(b, nodeId);
  if (appear && !reactionHolds(b, s, appear.reaction, appear.parent, ctx.tick)) refuse('Nothing is there now.');
  // the waits on its respawn are read before the gather changes the node
  const wait = waitPermille(b, s, nodeId, ctx.tick);
  const node = s.nodes[nodeId] ?? { readyAt: 0, draws: 0 };
  if (ctx.tick < node.readyAt) refuse('It has not grown back yet.');
  if (r.hours && !inHours(hourOf(b, ctx.tick), r.hours)) {
    refuse(`It can only be gathered between ${r.hours[0]}:00 and ${r.hours[1]}:00.`);
  }
  const verb = nodeVerb(r);
  if (verbLevel(b, s, verb) < r.level) refuse(`Needs ${b.professions[b.verbs[verb]]?.name ?? 'gathering'} level ${r.level}.`);
  const tool = r.tool ? requireTool(ctx, r.tool) : undefined;
  // a mined node takes bare hands, and a pick or a hammer in the bag breaks it faster (the best one; it wears as any tool)
  const helper = !r.tool && r.work === 'mine' ? bestTool(ctx, MINE_TOOLS) : undefined;
  if (bagCapacity(b, s) - bagUsed(s) <= 0) refuse('Your bag is full.');

  const toolBonus = tool ? 150 * (toolTier(ctx, tool) - 1) : helper ? 150 * toolTier(ctx, helper) : 0;
  const ms = duration(ctx, r.active_ms, speedPermille(ctx, toolBonus + 10 * effectValue(b, s, 'gather_speed_pct')));
  let qty = gradeYield(r.yield, grade);
  if (grade === 0) {
    if (drawBasisPoints(s.seed, nodeId, node.draws) < missKeepBp(b, s)) qty = 1;
    node.draws += 1;
  }
  if (qty > 0) take(ctx, r.output, qty);
  else ctx.events.push({ e: 'nothing', verb: 'gather' });
  if (tool) wearTool(ctx, tool);
  if (helper) wearTool(ctx, helper);
  node.readyAt = ctx.tick + ms + mulDiv(r.respawn_ms, wait, 1000);
  s.nodes[nodeId] = node;
  busy(ctx, 'gather', ms);
  gainXp(ctx, verb, grade === 4 ? r.active_ms * JACKPOT_XP : r.active_ms);
  if (grade === 4) ctx.events.push({ e: 'jackpot', verb: 'gather' });
}

function dig(ctx: Ctx, spotId: string, grade: Grade, at: Tile): void {
  const { b, s } = ctx;
  const inst = b.instances[spotId];
  if (!inst || inst.kind !== 'treasure') refuse('There is nothing to dig here.');
  const d = b.treasures[inst.source]!;
  if (d.pocket !== undefined && d.pocket !== s.player.pocket) refuse('There is nothing to dig here.');
  checkAt(ctx, at, { x: inst.x, y: inst.y, w: 1, h: 1 });
  checkGrade(grade);
  const wait = waitPermille(b, s, spotId, ctx.tick);
  const node = s.nodes[spotId] ?? { readyAt: 0, draws: 0 };
  if (!spotOpen(b, s, spotId)) refuse('There is nothing more here.');
  if (ctx.tick < node.readyAt) refuse('This spot was dug up recently.');
  if (verbLevel(b, s, 'dig') < d.level) refuse(`Needs ${b.professions[b.verbs.dig]?.name ?? 'digging'} level ${d.level}.`);
  // a find picked up by hand asks for no tool and wears none
  const tool = d.tool ? requireTool(ctx, d.tool) : undefined;
  if (bagCapacity(b, s) - bagUsed(s) <= 0) refuse('Your bag is full.');

  const ms = duration(ctx, d.active_ms, speedPermille(ctx, (tool ? 150 * (toolTier(ctx, tool) - 1) : 0) + 10 * effectValue(b, s, 'dig_speed_pct')));
  // luck and the rare-find technique raise only rare and legendary chances, inside the power cap
  const luck = rareFindPermille(b, s);
  const roll = drawBasisPoints(s.seed, spotId, node.draws);
  node.draws += 1;
  let edge = 0;
  // a pocket's own spot always gives its one find, whatever the timing: no start ends at a wall
  let found: string | undefined = d.pocket !== undefined ? d.finds[0]?.item : undefined;
  for (const f of found ? [] : d.finds) {
    let bp = mulDiv(f.chance_pct * 100, GRADE_PCT[grade], 100);
    if (rarityRank(b.items[f.item]?.rarity ?? 'common') >= 2) bp = mulDiv(bp, luck, 1000);
    edge = Math.min(10_000, edge + bp);
    if (roll < edge) {
      found = f.item;
      break;
    }
  }
  if (found) take(ctx, found, 1);
  else ctx.events.push({ e: 'nothing', verb: 'dig' });
  if (tool) wearTool(ctx, tool);
  node.readyAt = ctx.tick + ms + mulDiv(d.respawn_ms, wait, 1000);
  s.nodes[spotId] = node;
  busy(ctx, 'dig', ms);
  gainXp(ctx, 'dig', grade === 4 ? d.active_ms * JACKPOT_XP : d.active_ms);
  if (grade === 4) ctx.events.push({ e: 'jackpot', verb: 'dig' });
  solveRiddles(ctx, { kind: 'dig', treasure: inst.source });
}

function craft(ctx: Ctx, recipeId: string, at: Tile): void {
  const { b, s } = ctx;
  const c = b.recipes[recipeId];
  if (!c) refuse('Unknown recipe.');
  if (!s.player.recipes.includes(recipeId)) refuse('You do not know this recipe yet.');
  const built = Object.keys(b.camps)
    .sort()
    .filter((id) => s.player.camp.includes(id) && b.camps[id]!.provides === c.station);
  if (built.length === 0) refuse(c.station === 'fire' ? 'You need a campfire to cook.' : `You need a ${c.station}.`);
  const tier = recipeTier(b, c);
  const fit = built.filter((id) => (b.camps[id]!.tier ?? 1) >= tier);
  if (fit.length === 0) refuse(`This needs a ${c.station} of tier ${tier}.`);
  // two parts can work one station from different spots: the one the player stands at does the craft
  const spot = (id: string): Rect | undefined => {
    const t = campTile(b, b.camps[id]!.slot);
    return t ? { x: t[0], y: t[1], w: 1, h: 1 } : undefined;
  };
  const station =
    fit.find((id) => {
      const r = spot(id);
      return r !== undefined && Array.isArray(at) && near(at, r);
    }) ?? fit[0]!;
  const tile = spot(station);
  if (!tile) refuse('The camp is missing from the map.');
  checkAt(ctx, at, tile);
  // no level wall (CR-17): below the recipe's level the chance falls, and only the station refuses
  const profession = recipeProfession(b, c);
  for (const input of c.inputs) {
    if ((s.player.bag[input.item] ?? 0) < input.qty) refuse(`You need ${input.qty} ${b.items[input.item]?.name ?? input.item}.`);
  }
  // the bag must hold what either outcome leaves
  const miss = missOutcome(b, c);
  const used = c.inputs.reduce((n, i) => n + i.qty, 0);
  const growth = Math.max(
    c.outputs.reduce((n, o) => n + o.qty, 0) - used,
    miss.keep.reduce((n, k) => n + k.qty, 0) - used,
  );
  if (growth > bagCapacity(b, s) - bagUsed(s)) refuse('Your bag is too full for what this makes.');

  const ms = duration(ctx, c.active_ms, speedPermille(ctx, 10 * effectValue(b, s, 'craft_speed_pct', profession)));
  // one draw per try of this recipe (rule R4); a sure craft takes its turn of the counter too
  const chance = craftChanceBp(b, s, recipeId);
  const tries = s.player.tries[recipeId] ?? 0;
  s.player.tries[recipeId] = tries + 1;
  if (chance >= 10_000 || drawBasisPoints(s.seed, `craft:${recipeId}`, tries) < chance) {
    for (const input of c.inputs) removeItem(ctx, input.item, input.qty);
    for (const out of c.outputs) addItem(ctx, out.item, out.qty);
    s.player.made[recipeId] = (s.player.made[recipeId] ?? 0) + 1;
  } else {
    ctx.events.push({ e: 'miss', recipe: recipeId });
    c.inputs.forEach((input, i) => {
      const lost = input.qty - (miss.keep[i]?.qty ?? 0);
      if (lost > 0) removeItem(ctx, input.item, lost);
    });
  }
  busy(ctx, 'craft', ms);
  // effort is never wasted (pillar 5): a miss trains as much as a success
  gainProfessionXp(ctx, profession, c.active_ms);
}

function eat(ctx: Ctx, itemId: string): void {
  const { b, s } = ctx;
  const item = b.items[itemId];
  if (!item?.food) refuse('That is not something to eat.');
  if ((s.player.bag[itemId] ?? 0) < 1) refuse('You do not have that.');
  const cap = satietyCap(b, s);
  // only a food that does nothing but good can be too much; a bad fruit is eaten full or not
  const hurts = item.food.hurt ?? 0;
  if (hurts === 0 && s.player.satiety >= cap) refuse('You are full.');
  // a hearty eater gets more from a meal, not from a bandage
  const fill = mulDiv(item.food.satiety * 1000, 100 + (item.kind === 'food' ? effectValue(b, s, 'meal_fill_pct') : 0), 100);
  removeItem(ctx, itemId, 1);
  s.player.satiety = Math.min(cap, s.player.satiety + fill);
  ctx.events.push({ e: 'eat', item: itemId, satiety: s.player.satiety });
  if (hurts > 0) hurt(ctx, hurts * 1000, 'food');
}

function feed(ctx: Ctx, fireId: string, itemId: string, at: Tile): void {
  const { b, s, tick } = ctx;
  const own = fireId === OWN_FIRE ? s.player.own : null;
  const prop = fireId === OWN_FIRE ? undefined : b.map.props.find((p) => p.id === fireId && p.fire === true);
  if (own === null && !prop) refuse('There is no fire there.');
  checkAt(ctx, at, own === null ? prop! : { x: own.at[0], y: own.at[1], w: 1, h: 1 });
  if (!burnsAsWood(b, itemId)) refuse('That is not wood.');
  if ((s.player.bag[itemId] ?? 0) < 1) refuse('You do not have any.');
  // a log goes in whole or not at all: a fire with less than a log's room under its cap refuses it
  if (nextLogAt(b, s, fireId, tick) > tick) refuse('The fire is already full.');
  const burning = fireBurns(s, fireId, tick);
  const current = fireOf(s, fireId);
  const log = logMsOf(b, s, fireId);
  const next: FireState = burning ? { ...current!, until: current!.until + log } : { lit: tick, until: tick + log };
  // the player's own fire is kept where it stands and with the log it was kindled with, burning or not
  if (own !== null) Object.assign(next, { at: own.at, log: own.log });
  // lit again by day after a night it kept: the new burn carries that night's dawn, so the vigil still holds until the next dusk
  if (!burning && tendHolds(b, s, fireId, tick)) next.kept = nightEnds(b, lastDusk(b, tick));
  removeItem(ctx, itemId, 1);
  if (own !== null) s.player.own = next as OwnFire;
  else s.player.fires[fireId] = next;
  ctx.events.push({ e: 'fire', id: fireId, until: next.until });
}

/** The camp part whose logs and time build the player's own fire: the same two logs as the camp's fire (NEXT 21). */
const KINDLE_FROM = 'core/campfire';

/**
 * The player's own fire (G30; DECISIONS.md, 2026-10-19): built on a free tile beside them, outside the town and every
 * slot, never during a hunt and never where a predator's round watches the ground it would make safe, so it is a stay
 * the player plans and never a way out. Every refusal comes before the logs leave the bag. One stands at a time:
 * kindling another puts the first out and takes its place, carrying a night the first had kept (G48, as a relit
 * fire does). A log of it lasts `fire.log_ms` shortened by the danger of its ground, fixed here so the rest stays whole numbers.
 */
function kindle(ctx: Ctx, fire: Tile, at: Tile): void {
  const { b, s, tick } = ctx;
  const camp = b.camps[KINDLE_FROM];
  if (!camp) refuse('There is nothing to kindle a fire with.');
  if (!Array.isArray(fire) || fire.length !== 2 || !Number.isSafeInteger(fire[0]) || !Number.isSafeInteger(fire[1])) refuse('Where would the fire go?');
  checkAt(ctx, at, { x: fire[0], y: fire[1], w: 1, h: 1 });
  if (at[0] === fire[0] && at[1] === fire[1]) refuse('Step off that spot first.');
  if (s.player.chase !== null) refuse('Not with the wolf at your heels.');
  if (!walkableFor(b)(fire[0], fire[1], s.player)) refuse('Nothing here will hold a fire.');
  if (isTownTile(b, fire)) refuse('The town has its own fires.');
  if (b.map.slots.some((slot) => inRect(fire[0], fire[1], slot))) refuse('A fire has no place here.');
  if (Object.values(b.instances).some((inst) => inst.x === fire[0] && inst.y === fire[1]) || b.map.props.some((p) => p.fire === true && inRect(fire[0], fire[1], p))) {
    refuse('Something is already there.');
  }
  if (fireArea(b, fire).some((tile) => watchedAt(b, tile))) refuse('A wolf watches this ground. Not here.');
  for (const input of camp.inputs) {
    if ((s.player.bag[input.item] ?? 0) < input.qty) refuse(`You need ${input.qty} ${b.items[input.item]?.name ?? input.item}.`);
  }
  const ms = duration(ctx, camp.active_ms, 1000);
  const log = mulDiv(b.params.fire.log_ms, 100, 100 + b.params.fire.burn_pct_per_d * dangerAt(b, fire));
  const next: OwnFire = { at: [fire[0], fire[1]], lit: tick, until: tick + log, log };
  // a night the fire it replaces had kept stays kept until the next dusk: moving the fire by day does not undo it
  if (tendHolds(b, s, OWN_FIRE, tick)) next.kept = nightEnds(b, lastDusk(b, tick));
  for (const input of camp.inputs) removeItem(ctx, input.item, input.qty);
  s.player.own = next;
  ctx.events.push({ e: 'fire', id: OWN_FIRE, until: next.until });
  busy(ctx, 'kindle', ms);
}

/**
 * A fire that a `tend` step of an open quest keeps, gone out in the night it was keeping: it burned
 * at that night's dusk (lit by it and fed since) and went out before its dawn, so the vigil of that
 * night is lost (G48; DECISIONS.md, 2026-10-13: a step holds when the fire burned without going out
 * from one dusk to the dawn after it). An out at or after dawn ends a night already kept, and an out
 * by day or before dusk loses no night (a fire relit before dusk still keeps it), so neither is told;
 * nor is the out of a fire lit after dusk, whose night was lost at dusk. It is told once, at the first
 * step at or after its `until`, like a bell, but unlike a bell before the action's own events: a step
 * tells the outs after the step before it (`since`) and at or before its own tick. Each `until` falls
 * in one such gap, so a burn is told once, and a save from before 0.9 is never told of an out before
 * its last step. The clock and the fire ledger decide, so a replay tells the same (R4). A fire no open
 * quest keeps is not told: no rule reads its going out yet.
 */
function firesOut(ctx: Ctx, since: number): void {
  const { b, s, tick } = ctx;
  const kept = new Set<string>();
  for (const id of Object.keys(s.player.quests)) {
    if (s.player.quests[id] !== 'active') continue;
    for (const st of b.quests[id]?.steps ?? []) if (st.kind === 'tend') kept.add(st.fire);
  }
  for (const id of [...kept].sort()) {
    const fire = fireOf(s, id);
    if (fire === undefined || fire.until <= since || fire.until > tick) continue;
    const dusk = lastDusk(b, fire.until);
    if (fire.lit <= dusk && fire.until < nightEnds(b, dusk)) ctx.events.push({ e: 'fire_out', id });
  }
}

function shopOf(ctx: Ctx, npcId: string, at: Tile) {
  const { b } = ctx;
  const npc = b.npcs[npcId];
  const shop = npc?.shop ? b.shops[npc.shop] : undefined;
  if (!npc || !shop) refuse('Nobody is trading here.');
  const tile = npcTile(b, npcId)!;
  checkAt(ctx, at, { x: tile[0], y: tile[1], w: 1, h: 1 });
  return shop;
}

function checkQty(qty: number): void {
  if (!Number.isSafeInteger(qty) || qty < 1 || qty > 99) refuse('Pick between 1 and 99.');
}

function buy(ctx: Ctx, npcId: string, itemId: string, qty: number, at: Tile): void {
  const { b, s } = ctx;
  checkQty(qty);
  const shop = shopOf(ctx, npcId, at);
  const offer = shop.sells.find((o) => o.item === itemId);
  if (!offer) refuse('That is not for sale here.');
  const total = offer.price_mg * qty;
  if (s.player.boundGold + s.player.gold < total) refuse('You do not have enough gold.');
  if (bagCapacity(b, s) - bagUsed(s) < qty) refuse('Your bag is too full.');
  // the bound starting gold pays first, the purse the rest; this is the only place the bound balance is spent
  const fromBound = Math.min(s.player.boundGold, total);
  const fromPurse = total - fromBound;
  s.player.boundGold -= fromBound;
  s.player.gold -= fromPurse;
  s.ledger.burned += total;
  if (fromBound > 0) ctx.events.push({ e: 'bound', delta: -fromBound });
  if (fromPurse > 0) ctx.events.push({ e: 'gold', delta: -fromPurse });
  addItem(ctx, itemId, qty);
}

function sell(ctx: Ctx, npcId: string, itemId: string, qty: number, at: Tile): void {
  const { b, s } = ctx;
  checkQty(qty);
  const shop = shopOf(ctx, npcId, at);
  if (!shop.buys) refuse('This trader does not buy anything.');
  if ((s.player.bag[itemId] ?? 0) < qty) refuse('You do not have that many.');
  const total = salePrice(b, s, itemId, qty);
  // a tool with no value (one the shop sells) is never bought back
  if (total === undefined) refuse('The trader does not want that.');
  if (total < 1) refuse('That is worth less than a coin.');
  removeItem(ctx, itemId, qty);
  s.player.gold += total;
  s.ledger.minted += total;
  ctx.events.push({ e: 'gold', delta: total });
}

/**
 * What a trader pays for `qty` units of an item from this bag (rule R8), or
 * undefined when nobody buys it. A tool sells for the share of its uses left
 * (DECISIONS.md, 2026-10-09: the crafting economy): the unit in hand goes
 * last, so only a sale of every unit sells it short, and a lasting tool
 * loses nothing. The client shows this price; the sale pays it.
 */
export function salePrice(bundle: Bundle, state: PublicState, itemId: string, qty: number): number | undefined {
  const value = bundle.values[itemId];
  if (value === undefined || !bundle.items[itemId]) return undefined;
  const each = payFor(bundle.params, value, bundle.made.includes(itemId));
  const uses = bundle.items[itemId]!.tool?.uses;
  const spent = state.player.wear[itemId] ?? 0;
  if (uses === undefined || spent < 1 || qty < (state.player.bag[itemId] ?? 0)) return each * qty;
  return each * (qty - 1) + mulDiv(each, Math.max(0, uses - spent), uses);
}

function restore(ctx: Ctx, restoreId: string, at: Tile): void {
  const { b, s } = ctx;
  const r = b.restores[restoreId];
  if (!r) refuse('Nothing to restore here.');
  if (s.player.restored.includes(restoreId)) refuse('It is already restored.');
  const slot = findSlot(b.map, r.place.slot);
  if (!slot) refuse('Its place is missing from the map.');
  checkAt(ctx, at, slot);
  // a restore with no inputs opens only as a quest's reward (reward.opens)
  if (r.inputs.length === 0) refuse('This does not open by hand.');
  for (const input of r.inputs) {
    if ((s.player.bag[input.item] ?? 0) < input.qty) refuse(`You need ${input.qty} ${b.items[input.item]?.name ?? input.item}.`);
  }
  const ms = duration(ctx, r.active_ms, 1000);
  for (const input of r.inputs) removeItem(ctx, input.item, input.qty);
  s.player.restored = [...s.player.restored, restoreId].sort();
  ctx.events.push({ e: 'restore', restore: restoreId });
  busy(ctx, 'restore', ms);
}

function build(ctx: Ctx, campId: string, at: Tile): void {
  const { b, s } = ctx;
  const camp = b.camps[campId];
  if (!camp) refuse('Unknown camp part.');
  if (campBuilt(b, s, campId)) refuse('It is already built.');
  // an upgrade is built over the part it names, which must stand, and replaces it
  const base = camp.upgrades;
  if (base !== undefined && !s.player.camp.includes(base)) refuse(`Build the ${b.camps[base]?.title ?? base} first.`);
  if (s.player.camp.some((id) => id !== base && b.camps[id]?.slot === camp.slot)) refuse('Something already stands there.');
  const tile = campTile(b, camp.slot);
  if (!tile) refuse('The camp is missing from the map.');
  checkAt(ctx, at, { x: tile[0], y: tile[1], w: 1, h: 1 });
  // a built part blocks its tile, so building under your own feet would strand you
  if (at[0] === tile[0] && at[1] === tile[1]) refuse('Step off that spot first.');
  for (const input of camp.inputs) {
    if ((s.player.bag[input.item] ?? 0) < input.qty) refuse(`You need ${input.qty} ${b.items[input.item]?.name ?? input.item}.`);
  }
  const ms = duration(ctx, camp.active_ms, 1000);
  for (const input of camp.inputs) removeItem(ctx, input.item, input.qty);
  s.player.camp = [...s.player.camp.filter((id) => id !== base), campId].sort();
  ctx.events.push({ e: 'build', camp: campId });
  busy(ctx, 'build', ms);
}

function accept(ctx: Ctx, questId: string, at: Tile): void {
  const { b, s } = ctx;
  const q = b.quests[questId];
  if (!q?.giver || !offeredTo(q, s)) refuse('Nobody offers that task.');
  if (s.player.quests[questId]) refuse('You already took that task.');
  if (!(q.requires ?? []).every((r) => s.player.quests[r] === 'done')) refuse('Not yet.');
  const tile = npcTile(b, q.giver);
  if (!tile) refuse('Nobody offers that task.');
  checkAt(ctx, at, { x: tile[0], y: tile[1], w: 1, h: 1 });
  s.player.quests[questId] = 'active';
  ctx.events.push({ e: 'quest', quest: questId, state: 'active' });
}

/**
 * The item a reward gives this character: what the reward names, or its `instead`
 * when the character's wake pocket lays it on the ground (DECISIONS.md, 2026-10-10: whom to help first).
 */
export function rewardItem(bundle: Bundle, pocket: string, stack: { item: string; instead?: string }): string {
  const ground = bundle.pockets[pocket]?.ground ?? [];
  return stack.instead !== undefined && ground.some((k) => k.item === stack.item) ? stack.instead : stack.item;
}

export function questSatisfied(bundle: Bundle, state: PublicState, questId: string): boolean {
  const q = bundle.quests[questId];
  if (!q) return false;
  const p = state.player;
  const bring: Record<string, number> = {};
  for (const [i, st] of q.steps.entries()) {
    switch (st.kind) {
      case 'bring':
        bring[st.item] = (bring[st.item] ?? 0) + st.qty;
        break;
      case 'find':
        // with no giver there is nobody to hand it to: found once is found
        if (!q.giver) {
          if (!p.journal.includes(st.item)) return false;
        } else bring[st.item] = (bring[st.item] ?? 0) + 1;
        break;
      case 'riddle':
        if (!p.solved.includes(riddleKey(questId, i))) return false;
        break;
      case 'make':
        if ((p.made[st.recipe] ?? 0) < 1) return false;
        break;
      case 'restore':
        if (!p.restored.includes(st.restore)) return false;
        break;
      case 'build':
        if (!campBuilt(bundle, state, st.camp)) return false;
        break;
      case 'visit':
        if (!p.visited.includes(st.slot)) return false;
        break;
      case 'tend':
        if (!tendHolds(bundle, state, st.fire, state.tick)) return false;
        break;
    }
  }
  return Object.keys(bring).every((item) => (p.bag[item] ?? 0) >= (bring[item] ?? 0));
}

function turnIn(ctx: Ctx, questId: string, at: Tile | undefined, explicit: boolean): void {
  const { b, s } = ctx;
  const q = b.quests[questId];
  if (!q || s.player.quests[questId] !== 'active') refuse('That task is not open.');
  if (!questSatisfied(b, s, questId)) refuse('That task is not finished yet.');
  if (q.giver && explicit) {
    const tile = npcTile(b, q.giver);
    if (!tile || !at) refuse('Bring it to whoever asked.');
    checkAt(ctx, at, { x: tile[0], y: tile[1], w: 1, h: 1 });
  }
  // a task nobody gave is handed to nobody: what it asked for stays in the bag
  for (const st of q.giver ? q.steps : []) {
    if (st.kind === 'bring') removeItem(ctx, st.item, st.qty);
    if (st.kind === 'find') removeItem(ctx, st.item, 1);
  }
  const reward = q.reward;
  if (q.giver && reward.rep > 0) s.player.rep[q.giver] = (s.player.rep[q.giver] ?? 0) + reward.rep;
  if (reward.gold_mg) {
    s.player.gold += reward.gold_mg;
    s.ledger.minted += reward.gold_mg;
    ctx.events.push({ e: 'gold', delta: reward.gold_mg });
  }
  applyReward(ctx, reward);
  s.player.quests[questId] = 'done';
  ctx.events.push({ e: 'quest', quest: questId, state: 'done' });
}

/** The non-currency part shared by quest and expedition rewards. */
function applyReward(ctx: Ctx, reward: Pick<QuestDef['reward'], 'items' | 'recipes' | 'opens'>): void {
  const { b, s } = ctx;
  for (const stack of reward.items ?? []) addItem(ctx, rewardItem(b, s.player.pocket, stack), stack.qty);
  for (const recipe of reward.recipes ?? []) learnRecipe(ctx, recipe);
  for (const place of reward.opens ?? []) {
    if (s.player.restored.includes(place)) continue;
    s.player.restored = [...s.player.restored, place].sort();
    ctx.events.push({ e: 'restore', restore: place });
  }
}

/** A quest that names a wake pocket is offered to a character who woke there only. No quest names a race. */
export function offeredTo(q: { pocket?: string }, s: PublicState): boolean {
  return q.pocket === undefined || q.pocket === s.player.pocket;
}

/**
 * A node with `opens_after` waits for that quest, but only for a character the
 * quest is offered to: another start strikes it as ever.
 */
export function nodeLocked(bundle: Bundle, state: State, node: { opens_after?: string }): boolean {
  const q = node.opens_after === undefined ? undefined : bundle.quests[node.opens_after];
  return q !== undefined && offeredTo(q, state) && state.player.quests[q.id] !== 'done';
}

/**
 * Whether this character can dig the spot at all: a pocket's own spot is there
 * only for a character who woke in that pocket, and only until it gave its find.
 * A spot that grows back is open again later; the clock is checked apart.
 */
export function spotOpen(bundle: Bundle, state: PublicState, spotId: string): boolean {
  const inst = bundle.instances[spotId];
  const d = inst?.kind === 'treasure' ? bundle.treasures[inst.source] : undefined;
  if (!d) return false;
  if (d.pocket === undefined) return true;
  return d.pocket === state.player.pocket && (state.nodes[spotId]?.draws ?? 0) === 0;
}

/** Quests with no giver start by themselves and finish by themselves. */
function autoQuests(ctx: Ctx): void {
  const { b, s } = ctx;
  if (s.player.race === '') return;
  for (let guard = 0; guard < 20; guard++) {
    let moved = false;
    for (const id of Object.keys(b.quests).sort()) {
      const q = b.quests[id]!;
      if (q.giver || !offeredTo(q, s)) continue;
      const state = s.player.quests[id];
      const chains = Object.values(b.expeditions).filter((x) => x.chain.includes(id));
      const chainOpen =
        chains.length === 0 || chains.some((x) => insideExpedition(b, s, x) && expeditionWindowOpen(b, x, ctx.tick));
      if (!state && chainOpen && (q.requires ?? []).every((r) => s.player.quests[r] === 'done')) {
        s.player.quests[id] = 'active';
        ctx.events.push({ e: 'quest', quest: id, state: 'active' });
        moved = true;
      } else if (state === 'active' && questSatisfied(b, s, id)) {
        turnIn(ctx, id, undefined, false);
        moved = true;
      }
    }
    if (!moved) return;
  }
}

/**
 * The visit whose last bell rang since the step before, found before the action
 * runs: the player stood inside at the end of that step (`entered` is set) and
 * the last bell of the visit's night has rung. Every new tile is reported, so
 * the player stood there when the bell rang, and the mist walked them out then
 * (G49), wherever this action is made: inside the place or a step beyond it.
 * The world acts on the player as they stood at that bell (a hunt bites for the
 * time up to it only, nothing wakes under the tile reported after it), and
 * `expeditions` sets them on the exit. Of two such visits the earlier bell ends
 * both.
 */
function walkOutDue(ctx: Ctx): { expedition: string; bell: number } | undefined {
  const { b, s, tick } = ctx;
  let due: { expedition: string; bell: number } | undefined;
  for (const x of Object.values(b.expeditions)) {
    const entered = s.player.expeditions[x.id]?.entered;
    if (entered === undefined) continue;
    const bell = lastBellAt(b, x, visitNight(b, x, entered));
    if (tick >= bell && (due === undefined || bell < due.bell)) due = { expedition: x.id, bell };
  }
  return due;
}

/** Bells, soft failure and the once-only climax, after quests have advanced for this action. */
function expeditions(ctx: Ctx): void {
  const { b, s, tick } = ctx;
  // The visit whose last bell has rung walks out first, wherever the action was made.
  // After a fall in this step the player wakes in town instead, and the visit just ends.
  const ending = ctx.fell || ctx.walkOut === undefined ? undefined : b.expeditions[ctx.walkOut.expedition];
  const others = Object.values(b.expeditions).filter((x) => x !== ending);
  for (const x of ending === undefined ? others : [ending, ...others]) {
    let progress = s.player.expeditions[x.id];
    if (x !== ending && !insideExpedition(b, s, x)) {
      if (progress) {
        delete progress.entered;
        progress.rung = 0;
      }
      continue;
    }

    progress ??= s.player.expeditions[x.id] = { climax: false, rung: 0 };
    progress.entered ??= tick;
    // A visit counts the bells of one night: its own until that night's last bell, else the coming one.
    // Bells that rang before the visit began are counted as rung and never reported.
    const bells = bellTicks(b, x, visitNight(b, x, progress.entered));
    const entered = progress.entered;
    const rungNow = bells.filter((bell) => bell <= tick).length;
    progress.rung = Math.max(progress.rung, bells.filter((bell) => bell <= entered).length);
    for (let n = progress.rung + 1; n <= rungNow; n++) {
      ctx.events.push({ e: 'bell', expedition: x.id, n });
      progress.rung = n;
    }

    // At or after that night's last bell, however late the next action comes and wherever it is made, the player is walked out.
    if (tick >= bells[bells.length - 1]!) {
      const exit = findSlot(b.map, x.exit);
      if (exit) s.player.at = [exit.x, exit.y];
      s.player.movedAt = tick;
      s.player.chase = null;
      closeOuting(ctx);
      ctx.events.push({ e: 'walked_out', expedition: x.id });
      delete progress.entered;
      progress.rung = 0;
      continue;
    }

    const climax = findSlot(b.map, x.climax.slot);
    if (
      !progress.climax &&
      expeditionWindowOpen(b, x, tick) &&
      climax !== undefined &&
      inRect(s.player.at[0], s.player.at[1], climax) &&
      x.chain.every((id) => s.player.quests[id] === 'done')
    ) {
      progress.climax = true;
      ctx.events.push({ e: 'climax', expedition: x.id });
      applyReward(ctx, x.reward);
    }
  }
}

function visit(ctx: Ctx, slotId: string, at: Tile): void {
  const { b, s } = ctx;
  const slot = findSlot(b.map, slotId);
  if (!slot) refuse('Unknown place.');
  if (!inRect(at[0], at[1], slot)) refuse('You are not there.');
  checkAt(ctx, at, slot);
  solveRiddles(ctx, { kind: 'visit', slot: slotId, at: isNight(b, ctx.tick) ? 'night' : 'day' });
  if (s.player.visited.includes(slotId)) return;
  s.player.visited = [...s.player.visited, slotId].sort();
  s.player.outing?.visited.push(slotId);
  ctx.events.push({ e: 'visit', slot: slotId });
}

/** The state key of a riddle step. */
export function riddleKey(questId: string, step: number): string {
  return `${questId}#${step}`;
}

type RiddleHit = { kind: 'dig'; treasure: string } | { kind: 'visit'; slot: string; at: 'day' | 'night' };

/** A riddle completes on its answer's event and on nothing else (GRUNT P-2). */
function solveRiddles(ctx: Ctx, got: RiddleHit): void {
  const { b, s } = ctx;
  for (const id of Object.keys(s.player.quests).sort()) {
    if (s.player.quests[id] !== 'active') continue;
    const q = b.quests[id];
    if (!q) continue;
    q.steps.forEach((st, i) => {
      if (st.kind !== 'riddle') return;
      const key = riddleKey(id, i);
      if (s.player.solved.includes(key)) return;
      const a = st.answer;
      const hit =
        (a.kind === 'dig' && got.kind === 'dig' && a.treasure === got.treasure) ||
        (a.kind === 'visit' && got.kind === 'visit' && a.slot === got.slot && a.at === got.at);
      if (!hit) return;
      s.player.solved = [...s.player.solved, key].sort();
      s.player.outing?.solved.push(key);
      ctx.events.push({ e: 'riddle', quest: id });
    });
  }
}

/** Slots an open riddle answers by standing there: the client sends a visit on every entry, visited before or not. */
export function riddleSlots(bundle: Bundle, state: PublicState): Set<string> {
  const out = new Set<string>();
  for (const id of Object.keys(state.player.quests)) {
    if (state.player.quests[id] !== 'active') continue;
    bundle.quests[id]?.steps.forEach((st, i) => {
      if (st.kind === 'riddle' && st.answer.kind === 'visit' && !state.player.solved.includes(riddleKey(id, i))) out.add(st.answer.slot);
    });
  }
  return out;
}

function learn(ctx: Ctx, itemId: string): void {
  const { b, s } = ctx;
  const item = b.items[itemId];
  if (!item?.fragment) refuse('There is nothing to learn from that.');
  if ((s.player.bag[itemId] ?? 0) < 1) refuse('You do not have that.');
  if (s.player.recipes.includes(item.fragment.unlocks)) refuse('You already know this recipe.');
  removeItem(ctx, itemId, 1);
  learnRecipe(ctx, item.fragment.unlocks);
}

/**
 * Put on a worn item (DECISIONS.md, 2026-10-09: the upgrade). It stays in the
 * bag; a look goes on the look layer, anything else on the work layer. An
 * outfit takes the top and the legs off, and a top or trousers the outfit.
 */
function wear(ctx: Ctx, itemId: string, slot: WearSlot | undefined): void {
  const { b, s } = ctx;
  const w = b.items[itemId]?.wear;
  if (!w) refuse('That is not something to wear.');
  const have = s.player.bag[itemId] ?? 0;
  if (have < 1) refuse('You do not have that.');
  const look = w.look === true;
  const layer = look ? s.player.looks : s.player.worn;
  const fits = slotsFor(w.slot);
  if (slot !== undefined && !fits.includes(slot)) refuse('It does not go there.');
  const target = slot ?? fits.find((k) => layer[k] === undefined) ?? fits[0];
  if (target === undefined) refuse('It does not go there.');
  if (layer[target] === itemId) refuse('You are already wearing that.');
  const elsewhere = WEAR_SLOTS.filter((k) => k !== target && layer[k] === itemId).length;
  if (elsewhere + 1 > have) refuse('You are already wearing every one you have.');
  const clears: WearSlot[] = target === 'outfit' ? ['top', 'legs'] : target === 'top' || target === 'legs' ? ['outfit'] : [];
  for (const k of [target, ...clears]) {
    const old = layer[k];
    if (old === undefined) continue;
    delete layer[k];
    ctx.events.push({ e: 'unwear', item: old, slot: k, look });
  }
  layer[target] = itemId;
  ctx.events.push({ e: 'wear', item: itemId, slot: target, look });
}

function unwear(ctx: Ctx, slot: WearSlot, look: boolean): void {
  if (!(WEAR_SLOTS as readonly string[]).includes(slot)) refuse('Nothing is worn there.');
  const layer = look ? ctx.s.player.looks : ctx.s.player.worn;
  const id = layer[slot];
  if (id === undefined) refuse('Nothing is worn there.');
  delete layer[slot];
  ctx.events.push({ e: 'unwear', item: id, slot, look });
}

function spend(ctx: Ctx, attr: Attribute): void {
  const { b, s } = ctx;
  if (!ATTRIBUTES.includes(attr)) refuse('Unknown attribute.');
  if (skillPoints(b, s) < 1) refuse('No skill points left.');
  if (s.player.attrs[attr] >= 10) refuse('That attribute is at its limit.');
  s.player.attrs[attr] += 1;
  s.player.spent += 1;
  ctx.events.push({ e: 'attr', attr, value: s.player.attrs[attr] });
}

/** The tree is learned and the build changed at a safe place only: a fire, a camp or a town (GROWTH sections 3.2, 3.3). */
function atSafePlace(ctx: Ctx, what: string): void {
  if (!isSafe(ctx.b, ctx.s, ctx.s.player.at, ctx.tick)) refuse(`${what} at a fire, a camp or in town.`);
}

/** Learn a node of the tree: its path before it, its keys met, the points paid (GROWTH section 4.3, `learn_node`). */
function learnNode(ctx: Ctx, key: string): void {
  const { b, s } = ctx;
  const why = nodeRefusal(b, s, key);
  if (why !== undefined) refuse(why);
  atSafePlace(ctx, 'Learn');
  const cost = nodeCost(b, treeNode(b, key)!.node.size);
  s.player.nodes = [...(s.player.nodes ?? []), key].sort();
  s.player.spent += cost;
  ctx.events.push({ e: 'node', node: key, cost });
}

/** Put a learned technique in a slot of the build: an open slot, the next empty one at most; a technique sits in one slot. */
function equip(ctx: Ctx, key: string, slot: number): void {
  const { b, s } = ctx;
  const found = treeNode(b, key);
  if (!found || !(s.player.nodes ?? []).includes(key)) refuse('You have not learned that.');
  if (found.node.slot !== true) refuse('That is always on: it needs no slot.');
  const build = [...(s.player.build ?? [])];
  const open = slotsOpen(b, s);
  if (!Number.isSafeInteger(slot) || slot < 0 || slot >= open) refuse(open === 0 ? 'No slot is open yet.' : 'That slot is not open yet.');
  if (build[slot] === key) refuse('It is in that slot already.');
  atSafePlace(ctx, 'Change the build');
  const from = build.indexOf(key);
  if (from >= 0) {
    build.splice(from, 1);
    ctx.events.push({ e: 'unequip', node: key, slot: from });
  }
  const to = Math.min(slot, build.length);
  if (to < build.length) {
    ctx.events.push({ e: 'unequip', node: build[to]!, slot: to });
    build[to] = key;
  } else build.push(key);
  s.player.build = build;
  ctx.events.push({ e: 'equip', node: key, slot: to });
}

/** Take a technique out of its slot; the ones after it move up one. */
function unequip(ctx: Ctx, slot: number): void {
  const { s } = ctx;
  const build = [...(s.player.build ?? [])];
  const key = Number.isSafeInteger(slot) && slot >= 0 ? build[slot] : undefined;
  if (key === undefined) refuse('That slot is empty.');
  atSafePlace(ctx, 'Change the build');
  build.splice(slot, 1);
  s.player.build = build;
  ctx.events.push({ e: 'unequip', node: key, slot });
}

/** A step into a world that grades the race otherwise: one event per home attribute that moved, so its pips glow or dim on entry. */
function gradeEvents(ctx: Ctx, from: readonly [number, number]): void {
  const { b, s } = ctx;
  for (const attr of b.races[s.player.race]?.home ?? []) {
    if (gradeShift(b, s, attr, from) !== gradeShift(b, s, attr)) ctx.events.push({ e: 'grade', attr, value: attrAt(b, s, attr) });
  }
}

// ------------------------------------------------------------------ danger

/** A position report (DECISIONS.md, 2026-10-10): the tile the player stands on now. It is the one place travel is checked. */
function moveTo(ctx: Ctx, at: Tile, validateTravel: boolean): void {
  if (validateTravel) {
    checkTravel(ctx, at);
    arrive(ctx, at);
    return;
  }
  const { b, s } = ctx;
  if (!Array.isArray(at) || at.length !== 2 || !Number.isSafeInteger(at[0]) || !Number.isSafeInteger(at[1])) refuse('Where are you?');
  if (!walkableFor(b)(at[0], at[1], s.player)) refuse('You cannot stand there.');
  const reach = 2 + idiv(ctx.tick - s.player.movedAt, b.params.walk_step_ms);
  if (Math.max(Math.abs(at[0] - s.player.at[0]), Math.abs(at[1] - s.player.at[1])) > reach) refuse('That is further than a walk goes in that time.');
  arrive(ctx, at);
}

/** G56: travel and action tiles must be reachable by a four-way walk inside the elapsed-time square. */
function checkTravel(ctx: Ctx, target: Tile): void {
  const { b, s, tick } = ctx;
  const from = s.player.at;
  if (!Array.isArray(target) || target.length !== 2 || !target.every(Number.isSafeInteger)) refuse('Where are you?');
  const elapsed = Math.max(0, tick - s.player.movedAt);
  const reach = Math.min(2 + idiv(elapsed, b.params.walk_step_ms), b.params.move_reach_max);
  const dx = target[0] - from[0];
  const dy = target[1] - from[1];
  if (Math.abs(dx) > reach || Math.abs(dy) > reach) refuse('That is further than a walk goes in that time.');
  if (walkDistance(b, s, from, target, reach) === undefined) {
    if (!walkableFor(b)(target[0], target[1], s.player)) refuse('You cannot stand there.');
    refuse('That is further than a walk goes in that time.');
  }
}

/**
 * The player stands on `at` at this tick, and the world acts on that (G30-G33):
 * a hunt in progress bites for the time that has passed, a safe tile ends the
 * hunt and the outing, a hazard that wakes under their feet hurts, and at zero
 * health they fall. Returns true when they fell: that step does nothing else.
 */
function arrive(ctx: Ctx, at: Tile): boolean {
  const { b, s, tick } = ctx;
  const p = s.player;
  const before = p.at;
  chaseBites(ctx);
  // a bite that took the last of the health lands where the player stood, before they reach any safe tile
  if (fallIfDown(ctx)) return true;
  p.at = [at[0], at[1]];
  p.movedAt = tick;
  gradeEvents(ctx, before);
  if (isSafe(b, s, at)) {
    if (ctx.walkOut === undefined) reachSafety(ctx);
    else {
      // past an expedition's last bell the player stood inside at that bell, and the mist ended the hunt there (G49): nothing is told and nothing given
      p.chase = null;
      closeOuting(ctx);
    }
    if (isTownTile(b, at)) p.town = townAt(b, at) || p.town;
  } else {
    p.outing ??= { gained: {}, solved: [], visited: [] };
    // past an expedition's last bell the mist walks the player out: nothing wakes under this tile (G49)
    if (ctx.walkOut === undefined) strike(ctx, before, at);
  }
  // the signs this step raised, told here so a phone that holds no seed can show them too (REACTIONS 5)
  if (before[0] !== at[0] || before[1] !== at[1]) {
    for (const hit of cuesOnStep(b, s, tick, before, at)) {
      ctx.events.push({ e: 'cue', cue: hit.cue, reaction: hit.reaction, anchor: hit.anchor, x: hit.x, y: hit.y });
    }
  }
  return fallIfDown(ctx);
}

/**
 * What wakes where the player stands now: a pit, a trap or deep water they stepped onto, then a
 * predator that has noticed them. Ground that took the last of the health is a fall (G33), and no
 * hunt begins over it, so nothing is told seen as the player falls.
 */
function strike(ctx: Ctx, before: Tile, at: Tile): void {
  const { b, s, tick } = ctx;
  const cap = satietyCap(b, s);
  const awake = hazardsOf(b).filter((h) => windowOpen(b, h, tick));
  for (const h of awake) {
    if (h.kind !== 'predator' && inRect(at[0], at[1], h.rect) && !inRect(before[0], before[1], h.rect)) {
      hurt(ctx, harmOf(b, cap, h.kind), h.kind, h.id);
    }
  }
  if (ctx.hurt && s.player.satiety === 0) return;
  for (const h of awake) {
    if (h.kind !== 'predator' || s.player.chase !== null) continue;
    if (h.round ? sees(b, h, tick, at) : distanceTo(at, h.rect) <= h.reach) {
      s.player.chase = { hazard: h.id, since: tick, bites: 0 };
      ctx.events.push({ e: 'seen', id: h.id });
    }
  }
}

/** A hunt bites by the clock, not by the reports: the bites due since it began, up to the end of the night it began in. */
function chaseBites(ctx: Ctx): void {
  const { b, s, tick } = ctx;
  const chase = s.player.chase;
  if (chase === null) return;
  const h = hazardsOf(b).find((x) => x.id === chase.hazard);
  if (!h) {
    s.player.chase = null;
    return;
  }
  const shut = windowShuts(b, h, chase.since);
  // the night's last tick is the one before `shut`, which is the first tick of day; a walk-out stops the clock at its bell (G49)
  const due = bitesAfter(b, Math.min(tick, shut - 1, ctx.walkOut?.bell ?? tick) - chase.since);
  if (due > chase.bites) {
    hurt(ctx, (due - chase.bites) * harmOf(b, satietyCap(b, s), 'predator'), 'predator', h.id);
    chase.bites = due;
    markBitten(ctx);
  }
  if (tick >= shut) s.player.chase = null;
}

/** Two lists of ids as one sorted list, each id once. */
function joined(have: readonly string[], more: readonly string[]): string[] {
  return [...new Set([...have, ...more])].sort();
}

/**
 * A bite marks every quest open when it lands, on the outing it lands on: the outing brings the
 * marks home when it ends safe (`closeOuting`), and a fall drops them with the rest of it (G33),
 * so the giver's line at the hand-in (`talk.done_bitten`) follows the outings that came home. A
 * bite with no outing to carry it (a hunt kept from a state with none) is recorded at once.
 */
function markBitten(ctx: Ctx): void {
  const p = ctx.s.player;
  const open = Object.keys(p.quests).filter((id) => p.quests[id] === 'active');
  if (open.length === 0) return;
  if (p.outing) p.outing.bitten = joined(p.outing.bitten ?? [], open);
  else p.bitten = joined(p.bitten, open);
}

/** The outing ends without a fall, on safe ground or at a walk-out: the bites it carried join the record. */
function closeOuting(ctx: Ctx): void {
  const p = ctx.s.player;
  if (p.outing?.bitten?.length) p.bitten = joined(p.bitten, p.outing.bitten);
  p.outing = null;
}

/**
 * The player stands somewhere safe (G30): the outing is over, and a hunt ends here. A hunt outrun
 * gives back what its bites took, up to `refill_bp` of the health cap, and never takes health away
 * (G32): what was lost before the hunt, or to anything but its bites, stays food's to give back, so
 * stepping in and out of a predator's reach heals nothing. A hunt that ended before (at dawn, in a
 * fall, at a walk-out, or with its predator gone) is over already: nothing is told and nothing given.
 */
function reachSafety(ctx: Ctx): void {
  const { b, s } = ctx;
  const p = s.player;
  const chase = p.chase;
  p.chase = null;
  closeOuting(ctx);
  if (chase === null) return;
  const cap = satietyCap(b, s);
  const floor = mulDiv(cap, b.params.hazard.predator.refill_bp, 10_000);
  p.satiety = Math.max(p.satiety, Math.min(floor, p.satiety + chase.bites * harmOf(b, cap, 'predator')));
  ctx.events.push({ e: 'safe', id: chase.hazard, bitten: chase.bites > 0 });
}

function hurt(ctx: Ctx, amount: number, by: string, id?: string): void {
  const p = ctx.s.player;
  p.satiety = Math.max(0, p.satiety - amount);
  ctx.hurt = true;
  ctx.events.push(id === undefined ? { e: 'hurt', by, hp: p.satiety } : { e: 'hurt', by, id, hp: p.satiety });
}

/** Zero health after something took health is a fall (G33). Hunger alone never is. Returns whether the player fell. */
function fallIfDown(ctx: Ctx): boolean {
  if (!ctx.hurt || ctx.s.player.satiety > 0) return false;
  fall(ctx);
  return true;
}

/**
 * A fall is clear, and it costs the outing (G33): what the outing brought is
 * gone from the bag, and the riddles it solved and the places it first saw are
 * undone, so a quest it advanced starts again from where it stood before. Gold,
 * levels, the camp, what was made and mended, and what was spent are untouched.
 * The player wakes whole in the town they were last in, and nothing marks where.
 */
function fall(ctx: Ctx): void {
  const { b, s } = ctx;
  const p = s.player;
  const from: Tile = [p.at[0], p.at[1]];
  const lost: { item: string; qty: number }[] = [];
  const outing = p.outing;
  if (outing) {
    for (const item of Object.keys(outing.gained).sort()) {
      const qty = Math.min(outing.gained[item] ?? 0, p.bag[item] ?? 0);
      if (qty < 1) continue;
      removeItem(ctx, item, qty, true);
      lost.push({ item, qty });
    }
    p.solved = p.solved.filter((key) => !outing.solved.includes(key));
    p.visited = p.visited.filter((slot) => !outing.visited.includes(slot));
  }
  const at = reappearTile(b, s, walkableFor(b));
  p.falls += 1;
  p.at = at;
  p.movedAt = ctx.tick;
  p.busyUntil = ctx.tick;
  p.satiety = satietyCap(b, s);
  p.satietyAt = ctx.tick;
  p.chase = null;
  p.outing = null;
  ctx.fell = true;
  ctx.events.push({ e: 'fall', from, at, lost });
}

// ------------------------------------------------------------------ helpers

function checkGrade(grade: number): void {
  if (!Number.isSafeInteger(grade) || grade < 0 || grade > 4) refuse('Bad timing grade.');
}

function checkAt(ctx: Ctx, at: Tile, target: Rect): void {
  if (!Array.isArray(at) || at.length !== 2 || !Number.isSafeInteger(at[0]) || !Number.isSafeInteger(at[1])) {
    refuse('Where are you?');
  }
  const walkable = walkableFor(ctx.b);
  if (!walkable(at[0], at[1], ctx.s.player)) refuse('You cannot stand there.');
  if (!near(at, target)) refuse('That is too far away.');
  ctx.s.player.at = [at[0], at[1]];
}

function inHours(hour: number, [from, to]: readonly [number, number]): boolean {
  return from < to ? hour >= from && hour < to : hour >= from || hour < to;
}

/** Units for a grade; a miss is 0 here, and gather() may still bring one home. */
export function gradeYield(base: number, grade: Grade): number {
  if (grade === 0) return 0;
  return Math.max(1, mulDiv(base, GRADE_PCT[grade], 100));
}

/** Rule R9: every speed bonus goes through this one clamp. */
function speedPermille(ctx: Ctx, bonusPermille: number): number {
  return clamp(1000 + bonusPermille, 1000, powerCap(ctx.b, ctx.s));
}

function duration(ctx: Ctx, baseMs: number, speed: number): number {
  let ms = Math.max(ctx.b.params.t_min_ms, mulDivUp(baseMs, 1000, speed));
  // low health slows work (G32): at or below hp_low_pct of the bar, and 0 means only when it is empty
  if (ctx.s.player.satiety * 100 <= satietyCap(ctx.b, ctx.s) * ctx.b.params.hp_low_pct) ms = idivUp(ms * 3, 2);
  return ms;
}

function busy(ctx: Ctx, verb: string, ms: number): void {
  ctx.s.player.busyUntil = ctx.tick + ms;
  ctx.events.push({ e: 'busy', verb, ms });
}

function toolTier(ctx: Ctx, itemId: string): number {
  return ctx.b.items[itemId]?.tool?.tier ?? 1;
}

/** The tool kinds that help break a mined node; none is needed. */
const MINE_TOOLS: readonly string[] = ['pick', 'hammer'];

/** The highest-tier tool of these kinds in the bag (by id on a tie), or none. */
function bestTool(ctx: Ctx, kinds: readonly string[]): string | undefined {
  const { b, s } = ctx;
  let best: string | undefined;
  for (const id of Object.keys(s.player.bag).sort()) {
    const tool = b.items[id]?.tool;
    if (!tool || !kinds.includes(tool.kind) || (s.player.bag[id] ?? 0) < 1) continue;
    if (!best || tool.tier > toolTier(ctx, best)) best = id;
  }
  return best;
}

function requireTool(ctx: Ctx, kind: string): string {
  const best = bestTool(ctx, [kind]);
  if (!best) refuse(`You need ${/^[aeiou]/.test(kind) ? 'an' : 'a'} ${kind} for this.`);
  return best;
}

function wearTool(ctx: Ctx, itemId: string): void {
  const { b, s } = ctx;
  const uses = b.items[itemId]?.tool?.uses;
  // a tool with no uses lasts (DECISIONS.md, 2026-10-09: the crafting economy)
  if (uses === undefined) return;
  const worn = (s.player.wear[itemId] ?? 0) + 1;
  if (worn >= uses) {
    removeItem(ctx, itemId, 1);
    delete s.player.wear[itemId];
    ctx.events.push({ e: 'tool_broke', item: itemId });
  } else {
    s.player.wear[itemId] = worn;
  }
}

/** Put something into the bag; returns how many fit. */
function addItem(ctx: Ctx, itemId: string, qty: number): number {
  const { b, s } = ctx;
  const room = Math.max(0, bagCapacity(b, s) - bagUsed(s));
  const kept = Math.min(qty, room);
  if (kept > 0) {
    s.player.bag[itemId] = (s.player.bag[itemId] ?? 0) + kept;
    ctx.events.push({ e: 'gain', item: itemId, qty: kept });
    if (!s.player.journal.includes(itemId)) {
      s.player.journal = [...s.player.journal, itemId].sort();
      ctx.events.push({ e: 'discover', item: itemId });
    }
  }
  if (kept < qty) ctx.events.push({ e: 'bag_full', item: itemId, qty: qty - kept });
  return kept;
}

/** What the world gives (gathering, digging): into the bag, and onto the outing's account when the player is out (G33). */
function take(ctx: Ctx, itemId: string, qty: number): void {
  const kept = addItem(ctx, itemId, qty);
  const outing = ctx.s.player.outing;
  if (outing && kept > 0) outing.gained[itemId] = (outing.gained[itemId] ?? 0) + kept;
}

function removeItem(ctx: Ctx, itemId: string, qty: number, quiet = false): void {
  const bag = ctx.s.player.bag;
  const left = (bag[itemId] ?? 0) - qty;
  if (left < 0) refuse('You do not have enough.');
  if (left === 0) {
    delete bag[itemId];
    // the uses spent leave with the last unit
    delete ctx.s.player.wear[itemId];
  } else bag[itemId] = left;
  // what is spent comes out of the outing's finds first, so a fall never takes back more than is left of them
  const outing = ctx.s.player.outing;
  const gained = outing?.gained[itemId];
  if (outing && gained !== undefined) {
    if (gained > qty) outing.gained[itemId] = gained - qty;
    else delete outing.gained[itemId];
  }
  if (!quiet) ctx.events.push({ e: 'spend', item: itemId, qty });
  // a worn unit that leaves the bag comes off
  for (const off of fitWorn(ctx.b, ctx.s, itemId)) ctx.events.push({ e: 'unwear', ...off });
}

function learnRecipe(ctx: Ctx, recipeId: string): void {
  const p = ctx.s.player;
  if (!ctx.b.recipes[recipeId] || p.recipes.includes(recipeId)) return;
  p.recipes = [...p.recipes, recipeId].sort();
  ctx.events.push({ e: 'learn', recipe: recipeId });
}

function gainXp(ctx: Ctx, verb: Verb, ms: number): void {
  gainProfessionXp(ctx, ctx.b.verbs[verb], ms);
}

function gainProfessionXp(ctx: Ctx, id: string, ms: number): void {
  const { b, s } = ctx;
  const before = professionLevel(b, s, id);
  s.player.xp[id] = (s.player.xp[id] ?? 0) + ms;
  const after = professionLevel(b, s, id);
  if (after > before) ctx.events.push({ e: 'level', profession: id, level: after });
}

/** Stable text of a state, for saves and for comparing two runs. */
export function serialize(state: State): string {
  return canonical(state);
}
