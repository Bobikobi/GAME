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
import type { Bundle, RecipeDef, Verb } from './bundle';
import { canonical } from './canon';
import { bitesAfter, distanceTo, harmOf, hazardsOf, isSafe, isTownTile, reappearTile, townAt, windowOpen, windowShuts } from './danger';
import { clamp, idiv, idivUp, mulDiv, mulDivUp } from './num';
import { drawBasisPoints } from './rng';
import {
  ATTRIBUTES,
  type Attribute,
  type State,
  WEAR_SLOTS,
  type WearSlot,
  bagCapacity,
  bagUsed,
  campBuilt,
  effectValue,
  fitWorn,
  hourOf,
  isNight,
  nodeVerb,
  powerCap,
  professionLevel,
  satietyAt,
  satietyCap,
  skillPoints,
  slotsFor,
  verbLevel,
} from './state';
import { rarityRank, payFor } from './values';
import { campTile, findSlot, inRect, makeWalkable, near, npcTile, type Rect } from './world';

export type Tile = [number, number];
export type Grade = 0 | 1 | 2 | 3 | 4;

export type Action =
  | { t: 'start'; starter: string; name: string; look?: number }
  | { t: 'gather'; node: string; grade: Grade; at: Tile }
  | { t: 'dig'; spot: string; grade: Grade; at: Tile }
  | { t: 'craft'; recipe: string; at: Tile }
  | { t: 'eat'; item: string }
  | { t: 'buy'; npc: string; item: string; qty: number; at: Tile }
  | { t: 'sell'; npc: string; item: string; qty: number; at: Tile }
  | { t: 'restore'; restore: string; at: Tile }
  | { t: 'build'; camp: string; at: Tile }
  | { t: 'accept'; quest: string; at: Tile }
  | { t: 'turnin'; quest: string; at: Tile }
  | { t: 'visit'; slot: string; at: Tile }
  | { t: 'learn'; item: string }
  | { t: 'spend'; attr: Attribute }
  | { t: 'wear'; item: string; slot?: WearSlot }
  | { t: 'unwear'; slot: WearSlot; look?: boolean }
  | { t: 'move'; at: Tile };

export type GameEvent =
  | { e: 'gain'; item: string; qty: number }
  | { e: 'spend'; item: string; qty: number }
  | { e: 'bag_full'; item: string; qty: number }
  | { e: 'gold'; delta: number }
  | { e: 'level'; profession: string; level: number }
  | { e: 'discover'; item: string }
  | { e: 'learn'; recipe: string }
  | { e: 'quest'; quest: string; state: 'active' | 'done' }
  | { e: 'riddle'; quest: string }
  | { e: 'restore'; restore: string }
  | { e: 'build'; camp: string }
  | { e: 'eat'; item: string; satiety: number }
  | { e: 'busy'; verb: string; ms: number }
  | { e: 'nothing'; verb: string }
  | { e: 'jackpot'; verb: string }
  | { e: 'tool_broke'; item: string }
  | { e: 'visit'; slot: string }
  | { e: 'attr'; attr: Attribute; value: number }
  | { e: 'miss'; recipe: string }
  | { e: 'wear'; item: string; slot: WearSlot; look: boolean }
  | { e: 'unwear'; item: string; slot: WearSlot; look: boolean }
  /** health went down: `by` is a hazard kind or "food"; `id` the hazard prop; `hp` what is left, in milli-points */
  | { e: 'hurt'; by: string; id?: string; hp: number }
  /** health reached zero (G33): the player fell at `from`, lost `lost` (what the outing brought), and woke at `at` */
  | { e: 'fall'; from: Tile; at: Tile; lost: { item: string; qty: number }[] };

export type StepResult = { ok: true; state: State; events: GameEvent[] } | { ok: false; error: string };

/** Output share per timing grade: miss, ok, good, perfect, jackpot. A missed dig keeps a quarter of its chances. */
export const GRADE_PCT = [25, 50, 80, 100, 100] as const;
/** A missed gather still brings one unit home this often, in basis points, before luck: a miss is a gamble, not a wall. */
export const MISS_KEEP_BP = 5000;
/** Luck never makes a miss a sure thing. */
export const MISS_KEEP_MAX_BP = 9000;
/** Experience for a jackpot, as a multiple of a normal action's. */
export const JACKPOT_XP = 3;

/** How often a missed gather still brings one unit home, in basis points: luck raises it. */
export function missKeepBp(bundle: Bundle, state: State): number {
  return Math.min(MISS_KEEP_MAX_BP, MISS_KEEP_BP + 10 * bundle.params.per_point.luck_permille * state.player.attrs.luck);
}

/** The multiplier on rare and legendary dig chances, in permille: luck, techniques and worn items, inside the power cap. */
export function rareFindPermille(bundle: Bundle, state: State): number {
  const raw = 1000 + bundle.params.per_point.luck_permille * state.player.attrs.luck + 10 * effectValue(bundle, state, 'rare_find_pct');
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
    1000 + bundle.params.per_point.luck_permille * state.player.attrs.luck + 10 * effectValue(bundle, state, 'craft_chance_pct', profession);
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
  const over = Math.max(0, professionLevel(bundle, state, profession) - c.level);
  const skill = Math.min(10_000, base + over * p.craft_level_step_bp);
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

interface Ctx {
  b: Bundle;
  s: State;
  tick: number;
  events: GameEvent[];
  /** something took health in this step: only then can zero health be a fall (G33) */
  hurt: boolean;
}

export function step(bundle: Bundle, state: State, action: Action, tick: number): StepResult {
  if (!Number.isSafeInteger(tick) || tick < state.tick) return { ok: false, error: 'Time cannot run backwards.' };
  if (state.content !== bundle.tag) return { ok: false, error: 'This save belongs to different game content.' };
  const ctx: Ctx = { b: bundle, s: structuredClone(state), tick, events: [], hurt: false };
  try {
    apply(ctx, action);
    autoQuests(ctx);
    ctx.s.tick = tick;
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
): { state: State; events: GameEvent[]; error?: string; at?: number } {
  let state = start;
  const events: GameEvent[] = [];
  for (let i = 0; i < log.length; i++) {
    const entry = log[i]!;
    const r = step(bundle, state, entry.a, entry.tick);
    if (!r.ok) return { state, events, error: r.error, at: i };
    state = r.state;
    events.push(...r.events);
  }
  return { state, events };
}

// ------------------------------------------------------------------ actions

function apply(ctx: Ctx, a: Action): void {
  const { s } = ctx;
  if (a.t === 'start') return start(ctx, a.starter, a.name, a.look ?? 0);
  if (s.player.starter === '') refuse('Pick a character first.');
  // a position report is not work: it goes through while the player is busy
  if (a.t !== 'move' && ctx.tick < s.player.busyUntil) refuse('You are still busy.');
  // satiety is kept lazily: bring it up to now before anything reads it
  s.player.satiety = satietyAt(ctx.b, s, ctx.tick);
  s.player.satietyAt = ctx.tick;
  if (a.t === 'move') return moveTo(ctx, a.at);
  // wherever the action is made, the world acts on the player first; a fall ends the step and the action does not happen
  if (arrive(ctx, tileOf(a, s.player.at))) return;
  perform(ctx, a);
  // a camp part built under their feet makes this tile safe: the hunt and the outing end with it
  if (isSafe(ctx.b, s, s.player.at)) {
    s.player.chase = null;
    s.player.outing = null;
  }
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
      return dig(ctx, a.spot, a.grade, a.at);
    case 'craft':
      return craft(ctx, a.recipe, a.at);
    case 'eat':
      return eat(ctx, a.item);
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
    case 'spend':
      return spend(ctx, a.attr);
    case 'wear':
      return wear(ctx, a.item, a.slot);
    case 'unwear':
      return unwear(ctx, a.slot, a.look === true);
    default:
      refuse('Unknown action.');
  }
}

function start(ctx: Ctx, starterId: string, name: string, look: number): void {
  const { b, s } = ctx;
  if (s.player.starter !== '') refuse('The character is already chosen.');
  const starter = b.starters[starterId];
  if (!starter) refuse('Unknown character.');
  if (look !== 0 && !(look === 1 && starter.sprite_alt)) refuse('Unknown look.');
  if (!/^[A-Za-z0-9 _-]{1,16}$/.test(name) || name.trim() === '') {
    refuse('A name is 1 to 16 letters, digits, spaces, "_" or "-".');
  }
  s.player.name = name.trim();
  s.player.starter = starterId;
  s.player.look = look;
  s.player.attrs = { ...starter.attributes };
  s.player.gold = b.params.starting_gold_mg;
  if (b.params.starting_gold_mg > 0) s.ledger.minted += b.params.starting_gold_mg;
  s.player.satiety = satietyCap(b, s);
  s.player.satietyAt = ctx.tick;
  s.player.movedAt = ctx.tick;
  s.player.recipes = Object.keys(b.recipes)
    .filter((id) => b.recipes[id]!.known === 'start')
    .sort();
  if (starter.wake) s.player.at = [starter.wake.x, starter.wake.y];
  for (const stack of starter.kit ?? []) addItem(ctx, stack.item, stack.qty);
  // a kit piece worn for its work goes on from the first morning
  for (const stack of starter.kit ?? []) {
    const w = b.items[stack.item]?.wear;
    if (w && w.look !== true && (s.player.bag[stack.item] ?? 0) > 0) wear(ctx, stack.item, undefined);
  }
}

function gather(ctx: Ctx, nodeId: string, grade: Grade, at: Tile): void {
  const { b, s } = ctx;
  const inst = b.instances[nodeId];
  if (!inst || inst.kind !== 'resource') refuse('There is nothing to gather here.');
  const r = b.resources[inst.source]!;
  checkAt(ctx, at, { x: inst.x, y: inst.y, w: 1, h: 1 });
  checkGrade(grade);
  const node = s.nodes[nodeId] ?? { readyAt: 0, draws: 0 };
  if (ctx.tick < node.readyAt) refuse('It has not grown back yet.');
  if (r.hours && !inHours(hourOf(b, ctx.tick), r.hours)) {
    refuse(`It can only be gathered between ${r.hours[0]}:00 and ${r.hours[1]}:00.`);
  }
  const verb = nodeVerb(r);
  if (verbLevel(b, s, verb) < r.level) refuse(`Needs ${b.professions[b.verbs[verb]]?.name ?? 'gathering'} level ${r.level}.`);
  const tool = r.tool ? requireTool(ctx, r.tool) : undefined;
  if (bagCapacity(b, s) - bagUsed(s) <= 0) refuse('Your bag is full.');

  const ms = duration(ctx, r.active_ms, speedPermille(ctx, (tool ? 150 * (toolTier(ctx, tool) - 1) : 0) + 10 * effectValue(b, s, 'gather_speed_pct')));
  let qty = gradeYield(r.yield, grade);
  if (grade === 0) {
    if (drawBasisPoints(s.seed, nodeId, node.draws) < missKeepBp(b, s)) qty = 1;
    node.draws += 1;
  }
  if (qty > 0) take(ctx, r.output, qty);
  else ctx.events.push({ e: 'nothing', verb: 'gather' });
  if (tool) wearTool(ctx, tool);
  node.readyAt = ctx.tick + ms + r.respawn_ms;
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
  if (d.starter !== undefined && d.starter !== s.player.starter) refuse('There is nothing to dig here.');
  checkAt(ctx, at, { x: inst.x, y: inst.y, w: 1, h: 1 });
  checkGrade(grade);
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
  // a start's own spot always gives its one find, whatever the timing: no start ends at a wall
  let found: string | undefined = d.starter !== undefined ? d.finds[0]?.item : undefined;
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
  node.readyAt = ctx.tick + ms + d.respawn_ms;
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
  const station = built.find((id) => (b.camps[id]!.tier ?? 1) >= tier);
  if (!station) refuse(`This needs a ${c.station} of tier ${tier}.`);
  const tile = campTile(b, b.camps[station]!.slot);
  if (!tile) refuse('The camp is missing from the map.');
  checkAt(ctx, at, { x: tile[0], y: tile[1], w: 1, h: 1 });
  const profession = recipeProfession(b, c);
  if (professionLevel(b, s, profession) < c.level) refuse(`Needs ${b.professions[profession]?.name ?? 'crafting'} level ${c.level}.`);
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
  const fill = mulDiv(item.food.satiety * 1000, 100 + effectValue(b, s, 'meal_fill_pct'), 100);
  removeItem(ctx, itemId, 1);
  s.player.satiety = Math.min(cap, s.player.satiety + fill);
  ctx.events.push({ e: 'eat', item: itemId, satiety: s.player.satiety });
  if (hurts > 0) hurt(ctx, hurts * 1000, 'food');
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
  if (s.player.gold < total) refuse('You do not have enough gold.');
  if (bagCapacity(b, s) - bagUsed(s) < qty) refuse('Your bag is too full.');
  s.player.gold -= total;
  s.ledger.burned += total;
  ctx.events.push({ e: 'gold', delta: -total });
  addItem(ctx, itemId, qty);
}

function sell(ctx: Ctx, npcId: string, itemId: string, qty: number, at: Tile): void {
  const { b, s } = ctx;
  checkQty(qty);
  const shop = shopOf(ctx, npcId, at);
  if (!shop.buys) refuse('This trader does not buy anything.');
  if ((s.player.bag[itemId] ?? 0) < qty) refuse('You do not have that many.');
  const value = b.values[itemId];
  const item = b.items[itemId];
  if (value === undefined || !item || item.kind === 'tool') refuse('The trader does not want that.');
  const each = payFor(b.params, value);
  if (each < 1) refuse('That is worth less than a coin.');
  removeItem(ctx, itemId, qty);
  s.player.gold += each * qty;
  s.ledger.minted += each * qty;
  ctx.events.push({ e: 'gold', delta: each * qty });
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
 * The item a reward gives this start: what the reward names, or its `instead`
 * when the start's kit already holds it (DECISIONS.md, 2026-10-10: whom to help first).
 */
export function rewardItem(bundle: Bundle, starter: string, stack: { item: string; instead?: string }): string {
  const kit = bundle.starters[starter]?.kit ?? [];
  return stack.instead !== undefined && kit.some((k) => k.item === stack.item) ? stack.instead : stack.item;
}

export function questSatisfied(bundle: Bundle, state: State, questId: string): boolean {
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
  for (const stack of reward.items ?? []) addItem(ctx, rewardItem(b, s.player.starter, stack), stack.qty);
  for (const recipe of reward.recipes ?? []) learnRecipe(ctx, recipe);
  for (const place of reward.opens ?? []) {
    if (s.player.restored.includes(place)) continue;
    s.player.restored = [...s.player.restored, place].sort();
    ctx.events.push({ e: 'restore', restore: place });
  }
  s.player.quests[questId] = 'done';
  ctx.events.push({ e: 'quest', quest: questId, state: 'done' });
}

/** A quest that names a starter is offered to a character of that starter only. */
export function offeredTo(q: { starter?: string }, s: State): boolean {
  return q.starter === undefined || q.starter === s.player.starter;
}

/**
 * Whether this character can dig the spot at all: a start's own spot is there
 * only for its starter, and only until it gave its find. A spot that grows
 * back is open again later; the clock is checked apart.
 */
export function spotOpen(bundle: Bundle, state: State, spotId: string): boolean {
  const inst = bundle.instances[spotId];
  const d = inst?.kind === 'treasure' ? bundle.treasures[inst.source] : undefined;
  if (!d) return false;
  if (d.starter === undefined) return true;
  return d.starter === state.player.starter && (state.nodes[spotId]?.draws ?? 0) === 0;
}

/** Quests with no giver start by themselves and finish by themselves. */
function autoQuests(ctx: Ctx): void {
  const { b, s } = ctx;
  if (s.player.starter === '') return;
  for (let guard = 0; guard < 20; guard++) {
    let moved = false;
    for (const id of Object.keys(b.quests).sort()) {
      const q = b.quests[id]!;
      if (q.giver || !offeredTo(q, s)) continue;
      const state = s.player.quests[id];
      if (!state && (q.requires ?? []).every((r) => s.player.quests[r] === 'done')) {
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
export function riddleSlots(bundle: Bundle, state: State): Set<string> {
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

// ------------------------------------------------------------------ danger

/** A position report (DECISIONS.md, 2026-10-10): the tile the player stands on now. It is the one place travel is checked. */
function moveTo(ctx: Ctx, at: Tile): void {
  const { b, s } = ctx;
  if (!Array.isArray(at) || at.length !== 2 || !Number.isSafeInteger(at[0]) || !Number.isSafeInteger(at[1])) refuse('Where are you?');
  if (!walkableFor(b)(at[0], at[1], s.player)) refuse('You cannot stand there.');
  const p = s.player;
  const reach = 2 + idiv(ctx.tick - p.movedAt, b.params.walk_step_ms);
  if (Math.max(Math.abs(at[0] - p.at[0]), Math.abs(at[1] - p.at[1])) > reach) refuse('That is further than a walk goes in that time.');
  arrive(ctx, at);
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
  if (isSafe(b, s, at)) {
    p.chase = null;
    p.outing = null;
    if (isTownTile(b, at)) p.town = townAt(b, at) || p.town;
  } else {
    p.outing ??= { gained: {}, solved: [], visited: [] };
    strike(ctx, before, at);
  }
  return fallIfDown(ctx);
}

/** What wakes where the player stands now: a pit, a trap or deep water they stepped onto, a predator that has noticed them. */
function strike(ctx: Ctx, before: Tile, at: Tile): void {
  const { b, s, tick } = ctx;
  const cap = satietyCap(b, s);
  for (const h of hazardsOf(b)) {
    if (!windowOpen(b, h, tick)) continue;
    if (h.kind === 'predator') {
      if (s.player.chase === null && distanceTo(at, h.rect) <= h.reach) s.player.chase = { hazard: h.id, since: tick, bites: 0 };
    } else if (inRect(at[0], at[1], h.rect) && !inRect(before[0], before[1], h.rect)) {
      hurt(ctx, harmOf(b, cap, h.kind), h.kind, h.id);
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
  // the night's last tick is the one before `shut`, which is the first tick of day
  const due = bitesAfter(b, Math.min(tick, shut - 1) - chase.since);
  if (due > chase.bites) {
    hurt(ctx, (due - chase.bites) * harmOf(b, satietyCap(b, s), 'predator'), 'predator', h.id);
    chase.bites = due;
  }
  if (tick >= shut) s.player.chase = null;
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

function requireTool(ctx: Ctx, kind: string): string {
  const { b, s } = ctx;
  let best: string | undefined;
  for (const id of Object.keys(s.player.bag).sort()) {
    const tool = b.items[id]?.tool;
    if (!tool || tool.kind !== kind || (s.player.bag[id] ?? 0) < 1) continue;
    if (!best || tool.tier > toolTier(ctx, best)) best = id;
  }
  if (!best) refuse(`You need ${/^[aeiou]/.test(kind) ? 'an' : 'a'} ${kind} for this.`);
  return best;
}

function wearTool(ctx: Ctx, itemId: string): void {
  const { b, s } = ctx;
  const uses = b.items[itemId]?.tool?.uses ?? 1;
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
  if (left === 0) delete bag[itemId];
  else bag[itemId] = left;
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
