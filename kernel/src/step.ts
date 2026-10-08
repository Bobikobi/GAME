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
 */
import type { Bundle, Verb } from './bundle';
import { canonical } from './canon';
import { clamp, idivUp, mulDiv, mulDivUp } from './num';
import { drawBasisPoints } from './rng';
import {
  ATTRIBUTES,
  type Attribute,
  type State,
  bagCapacity,
  bagUsed,
  hourOf,
  isNight,
  powerCap,
  professionLevel,
  satietyAt,
  satietyCap,
  skillPoints,
  techniqueValue,
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
  | { t: 'spend'; attr: Attribute };

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
  | { e: 'attr'; attr: Attribute; value: number };

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

/** The multiplier on rare and legendary dig chances, in permille: luck and techniques, inside the power cap. */
export function rareFindPermille(bundle: Bundle, state: State): number {
  const raw = 1000 + bundle.params.per_point.luck_permille * state.player.attrs.luck + 10 * techniqueValue(bundle, state, 'rare_find_pct');
  return clamp(raw, 1000, powerCap(bundle, state));
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
}

export function step(bundle: Bundle, state: State, action: Action, tick: number): StepResult {
  if (!Number.isSafeInteger(tick) || tick < state.tick) return { ok: false, error: 'Time cannot run backwards.' };
  if (state.content !== bundle.tag) return { ok: false, error: 'This save belongs to different game content.' };
  const ctx: Ctx = { b: bundle, s: structuredClone(state), tick, events: [] };
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
  if (ctx.tick < s.player.busyUntil) refuse('You are still busy.');
  // satiety is kept lazily: bring it up to now before anything reads it
  s.player.satiety = satietyAt(ctx.b, s, ctx.tick);
  s.player.satietyAt = ctx.tick;
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
  s.player.recipes = Object.keys(b.recipes)
    .filter((id) => b.recipes[id]!.known === 'start')
    .sort();
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
  if (verbLevel(b, s, 'gather') < r.level) refuse(`Needs ${b.professions[b.verbs.gather]?.name ?? 'gathering'} level ${r.level}.`);
  const tool = r.tool ? requireTool(ctx, r.tool) : undefined;
  if (bagCapacity(b, s) - bagUsed(s) <= 0) refuse('Your bag is full.');

  const ms = duration(ctx, r.active_ms, speedPermille(ctx, tool ? 150 * (toolTier(ctx, tool) - 1) : 0));
  let qty = gradeYield(r.yield, grade);
  if (grade === 0) {
    if (drawBasisPoints(s.seed, nodeId, node.draws) < missKeepBp(b, s)) qty = 1;
    node.draws += 1;
  }
  if (qty > 0) addItem(ctx, r.output, qty);
  else ctx.events.push({ e: 'nothing', verb: 'gather' });
  if (tool) wearTool(ctx, tool);
  node.readyAt = ctx.tick + ms + r.respawn_ms;
  s.nodes[nodeId] = node;
  busy(ctx, 'gather', ms);
  gainXp(ctx, 'gather', grade === 4 ? r.active_ms * JACKPOT_XP : r.active_ms);
  if (grade === 4) ctx.events.push({ e: 'jackpot', verb: 'gather' });
}

function dig(ctx: Ctx, spotId: string, grade: Grade, at: Tile): void {
  const { b, s } = ctx;
  const inst = b.instances[spotId];
  if (!inst || inst.kind !== 'treasure') refuse('There is nothing to dig here.');
  const d = b.treasures[inst.source]!;
  checkAt(ctx, at, { x: inst.x, y: inst.y, w: 1, h: 1 });
  checkGrade(grade);
  const node = s.nodes[spotId] ?? { readyAt: 0, draws: 0 };
  if (ctx.tick < node.readyAt) refuse('This spot was dug up recently.');
  if (verbLevel(b, s, 'dig') < d.level) refuse(`Needs ${b.professions[b.verbs.dig]?.name ?? 'digging'} level ${d.level}.`);
  const tool = requireTool(ctx, d.tool);
  if (bagCapacity(b, s) - bagUsed(s) <= 0) refuse('Your bag is full.');

  const ms = duration(ctx, d.active_ms, speedPermille(ctx, 150 * (toolTier(ctx, tool) - 1)));
  // luck and the rare-find technique raise only rare and legendary chances, inside the power cap
  const luck = rareFindPermille(b, s);
  const roll = drawBasisPoints(s.seed, spotId, node.draws);
  node.draws += 1;
  let edge = 0;
  let found: string | undefined;
  for (const f of d.finds) {
    let bp = mulDiv(f.chance_pct * 100, GRADE_PCT[grade], 100);
    if (rarityRank(b.items[f.item]?.rarity ?? 'common') >= 2) bp = mulDiv(bp, luck, 1000);
    edge = Math.min(10_000, edge + bp);
    if (roll < edge) {
      found = f.item;
      break;
    }
  }
  if (found) addItem(ctx, found, 1);
  else ctx.events.push({ e: 'nothing', verb: 'dig' });
  wearTool(ctx, tool);
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
  const station = Object.keys(b.camps)
    .sort()
    .find((id) => s.player.camp.includes(id) && b.camps[id]!.provides === c.station);
  if (!station) refuse(c.station === 'fire' ? 'You need a campfire to cook.' : `You need a ${c.station}.`);
  const tile = campTile(b, b.camps[station]!.slot);
  if (!tile) refuse('The camp is missing from the map.');
  checkAt(ctx, at, { x: tile[0], y: tile[1], w: 1, h: 1 });
  if (verbLevel(b, s, 'craft') < c.level) refuse(`Needs ${b.professions[b.verbs.craft]?.name ?? 'crafting'} level ${c.level}.`);
  for (const input of c.inputs) {
    if ((s.player.bag[input.item] ?? 0) < input.qty) refuse(`You need ${input.qty} ${b.items[input.item]?.name ?? input.item}.`);
  }
  const growth = c.outputs.reduce((n, o) => n + o.qty, 0) - c.inputs.reduce((n, i) => n + i.qty, 0);
  if (growth > bagCapacity(b, s) - bagUsed(s)) refuse('Your bag is too full for what this makes.');

  const ms = duration(ctx, c.active_ms, speedPermille(ctx, 10 * techniqueValue(b, s, 'craft_speed_pct')));
  for (const input of c.inputs) removeItem(ctx, input.item, input.qty);
  for (const out of c.outputs) addItem(ctx, out.item, out.qty);
  s.player.made[recipeId] = (s.player.made[recipeId] ?? 0) + 1;
  busy(ctx, 'craft', ms);
  gainXp(ctx, 'craft', c.active_ms);
}

function eat(ctx: Ctx, itemId: string): void {
  const { b, s } = ctx;
  const item = b.items[itemId];
  if (!item?.food) refuse('That is not something to eat.');
  if ((s.player.bag[itemId] ?? 0) < 1) refuse('You do not have that.');
  const cap = satietyCap(b, s);
  if (s.player.satiety >= cap) refuse('You are full.');
  const fill = mulDiv(item.food.satiety * 1000, 100 + techniqueValue(b, s, 'meal_fill_pct'), 100);
  removeItem(ctx, itemId, 1);
  s.player.satiety = Math.min(cap, s.player.satiety + fill);
  ctx.events.push({ e: 'eat', item: itemId, satiety: s.player.satiety });
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
  if (s.player.camp.includes(campId)) refuse('It is already built.');
  if (s.player.camp.some((id) => b.camps[id]?.slot === camp.slot)) refuse('Something already stands there.');
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
  s.player.camp = [...s.player.camp, campId].sort();
  ctx.events.push({ e: 'build', camp: campId });
  busy(ctx, 'build', ms);
}

function accept(ctx: Ctx, questId: string, at: Tile): void {
  const { b, s } = ctx;
  const q = b.quests[questId];
  if (!q?.giver) refuse('Nobody offers that task.');
  if (s.player.quests[questId]) refuse('You already took that task.');
  if (!(q.requires ?? []).every((r) => s.player.quests[r] === 'done')) refuse('Not yet.');
  const tile = npcTile(b, q.giver);
  if (!tile) refuse('Nobody offers that task.');
  checkAt(ctx, at, { x: tile[0], y: tile[1], w: 1, h: 1 });
  s.player.quests[questId] = 'active';
  ctx.events.push({ e: 'quest', quest: questId, state: 'active' });
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
        bring[st.item] = (bring[st.item] ?? 0) + 1;
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
        if (!p.camp.includes(st.camp)) return false;
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
  for (const st of q.steps) {
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
  for (const stack of reward.items ?? []) addItem(ctx, stack.item, stack.qty);
  for (const recipe of reward.recipes ?? []) learnRecipe(ctx, recipe);
  s.player.quests[questId] = 'done';
  ctx.events.push({ e: 'quest', quest: questId, state: 'done' });
}

/** Quests with no giver start by themselves and finish by themselves. */
function autoQuests(ctx: Ctx): void {
  const { b, s } = ctx;
  if (s.player.starter === '') return;
  for (let guard = 0; guard < 20; guard++) {
    let moved = false;
    for (const id of Object.keys(b.quests).sort()) {
      const q = b.quests[id]!;
      if (q.giver) continue;
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

function spend(ctx: Ctx, attr: Attribute): void {
  const { b, s } = ctx;
  if (!ATTRIBUTES.includes(attr)) refuse('Unknown attribute.');
  if (skillPoints(b, s) < 1) refuse('No skill points left.');
  if (s.player.attrs[attr] >= 10) refuse('That attribute is at its limit.');
  s.player.attrs[attr] += 1;
  s.player.spent += 1;
  ctx.events.push({ e: 'attr', attr, value: s.player.attrs[attr] });
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
  if (ctx.s.player.satiety === 0) ms = idivUp(ms * 3, 2);
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
  if (!best) refuse(`You need a ${kind} for this.`);
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

function addItem(ctx: Ctx, itemId: string, qty: number): void {
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
}

function removeItem(ctx: Ctx, itemId: string, qty: number): void {
  const bag = ctx.s.player.bag;
  const left = (bag[itemId] ?? 0) - qty;
  if (left < 0) refuse('You do not have enough.');
  if (left === 0) delete bag[itemId];
  else bag[itemId] = left;
  ctx.events.push({ e: 'spend', item: itemId, qty });
}

function learnRecipe(ctx: Ctx, recipeId: string): void {
  const p = ctx.s.player;
  if (!ctx.b.recipes[recipeId] || p.recipes.includes(recipeId)) return;
  p.recipes = [...p.recipes, recipeId].sort();
  ctx.events.push({ e: 'learn', recipe: recipeId });
}

function gainXp(ctx: Ctx, verb: Verb, ms: number): void {
  const { b, s } = ctx;
  const id = b.verbs[verb];
  const before = professionLevel(b, s, id);
  s.player.xp[id] = (s.player.xp[id] ?? 0) + ms;
  const after = professionLevel(b, s, id);
  if (after > before) ctx.events.push({ e: 'level', profession: id, level: after });
}

/** Stable text of a state, for saves and for comparing two runs. */
export function serialize(state: State): string {
  return canonical(state);
}
