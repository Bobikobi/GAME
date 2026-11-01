/** Words for numbers and events. Display only: the kernel never sees these. */
import {
  OWN_FIRE,
  type Attribute,
  attrAt,
  type Bundle,
  type GameEvent,
  type RecipeDef,
  type WearSlot,
  loadLimit,
  campBuilt,
  campTile,
  findSlot,
  hazardsOf,
  hintReach,
  isNight,
  isSafe,
  minuteOfDay,
  missKeepBp,
  nightEnds,
  nightFalls,
  offeredTo,
  powerCap,
  questSatisfied,
  recipeTier,
  riddleKey,
  rareFindPermille,
  searchDawn,
  salePrice,
  hpCap,
  slotsFor,
  techniqueValue, type PublicState } from '@game/kernel';
import { feedTooLate, fireName, tendLine } from './fires';

export function itemName(b: Bundle, id: string): string {
  return b.items[id]?.name ?? id;
}

/** The verb on a node's prompt and its minigame: a tree is felled, anything else gathered. */
export function nodeAction(b: Bundle, r: Bundle['resources'][string]): string {
  if (r.tool === 'axe') return 'Fell tree';
  if (r.tool === 'rod') return 'Fish';
  return r.work === 'mine' ? `Mine ${itemName(b, r.output)}` : `Gather ${itemName(b, r.output)}`;
}

/** milli-gold as gold, at most two decimals: 2500 -> "2.5" */
export function gold(mg: number): string {
  const cents = Math.floor(mg / 10);
  const whole = Math.floor(cents / 100);
  const rest = cents % 100;
  if (rest === 0) return String(whole);
  return `${whole}.${String(rest).padStart(2, '0').replace(/0$/, '')}`;
}

export function seconds(ms: number): string {
  const s = ms / 1000;
  return Number.isInteger(s) ? `${s}s` : `${s.toFixed(1)}s`;
}

export function clock(minuteOfDay: number): string {
  const hh = Math.floor(minuteOfDay / 60);
  const mm = minuteOfDay % 60;
  return `${hh}:${String(mm).padStart(2, '0')}`;
}

/** One plain word or two per attribute, as the start cards show it (the owner's finding of 10.10: as simple as other games). */
export const ATTRIBUTE_LABEL: Record<string, string> = {
  might: 'Might',
  senses: 'Keen eyes',
  agility: 'Steady hands',
  luck: 'Luck',
  stamina: 'Stamina',
  spirit: 'Spirit',
};

export const ATTRIBUTE_TEXT: Record<string, string> = {
  might: 'Might: a bigger bag, carry more',
  senses: 'Keen eyes: see hidden finds from farther away',
  agility: 'Steady hands: easier timing in every minigame',
  luck: 'Luck: a miss keeps something more often, and rare finds come more',
  stamina: 'Stamina: eat less often',
  spirit: 'Spirit: counts for nothing yet; its first use comes in a later update',
};

/** The most points one attribute can take (the kernel refuses more). */
export const ATTRIBUTE_MAX = 10;

/** How wide the minigame windows are, in percent of the base. */
export function windowScalePct(b: Bundle, s: PublicState): number {
  return 100 + b.params.per_point.agility_pct * attrAt(b, s, 'agility') + techniqueValue(b, s, 'timing_window_pct');
}

export interface AttributeEffect {
  attr: Attribute;
  name: string;
  /** what the number measures, for example "Bag" */
  what: string;
  now: string;
  next: string;
  /** a short honest note, for example when the level cap holds luck back */
  note?: string;
}

/** What one more point in each attribute really changes, as numbers. */
export function attributeEffects(b: Bundle, s: PublicState): AttributeEffect[] {
  const plus = (a: Attribute): PublicState => ({ ...s, player: { ...s.player, attrs: { ...s.player.attrs, [a]: s.player.attrs[a] + 1 } } });
  // with no hunger clock (G28, G32) a point of stamina is health, not minutes of work
  const points = (st: PublicState) => Math.floor(hpCap(b, st) / 1000);
  const pct = (bp: number) => `${Math.round(bp / 100)}%`;
  const times = (permille: number) => `x${(permille / 1000).toFixed(2).replace(/0$/, '')}`;
  const luckNext = plus('luck');
  const capped = rareFindPermille(b, luckNext) === rareFindPermille(b, s) && rareFindPermille(b, s) >= powerCap(b, s);
  return [
    // might carries weight, not places (DECISIONS.md, 2026-10-23): the bag on the back gives the places
    { attr: 'might', name: 'Might', what: 'Your load limit', now: `${loadLimit(b, s)}`, next: `${loadLimit(b, plus('might'))}` },
    { attr: 'senses', name: 'Keen eyes', what: 'You see hidden finds from', now: `${hintDistance(b, s)}`, next: `${hintDistance(b, plus('senses'))} steps away` },
    { attr: 'agility', name: 'Steady hands', what: 'The good zone in a minigame', now: `${windowScalePct(b, s)}%`, next: `${windowScalePct(b, plus('agility'))}% wide` },
    {
      attr: 'luck',
      name: 'Luck',
      what: 'A miss still gives you 1',
      now: `${pct(missKeepBp(b, s))}`,
      next: `${pct(missKeepBp(b, luckNext))} of misses`,
      note: `Rare finds ${times(rareFindPermille(b, s))} -> ${times(rareFindPermille(b, luckNext))}${capped ? ' (held by your level: level up to raise it)' : ''}`,
    },
    {
      attr: 'stamina',
      name: 'Stamina',
      what: 'Your health holds',
      now: `${points(s)}`,
      next: `${points(plus('stamina'))} points`,
    },
    // spirit has no rule that reads it yet (schema per_point): the row shows the points and says so plainly
    {
      attr: 'spirit',
      name: 'Spirit',
      what: 'Your spirit',
      now: `${attrAt(b, s, 'spirit')}`,
      next: `${attrAt(b, plus('spirit'), 'spirit')} points`,
      note: 'Counts for nothing yet: its first use comes in a later update',
    },
  ];
}

export function stacks(b: Bundle, list: readonly { item: string; qty: number }[]): string {
  return list.map((s) => `${s.qty} ${itemName(b, s.item)}`).join(', ');
}

/** The first sentence of a clue, for the tracker. */
export function firstLine(text: string): string {
  const line = text.split('\n')[0] ?? text;
  return line.split(/(?<=[.!?])\s/)[0] ?? line;
}

/**
 * One line per quest step, with a tick when it is done; `short` is what the tracker shows when the line is a clue.
 * `tick` is the live game tick (the session's), which a tend step reads; it defaults to the state's own.
 */
export function questSteps(b: Bundle, s: PublicState, questId: string, tick = s.tick): { text: string; done: boolean; short?: string }[] {
  const q = b.quests[questId];
  if (!q) return [];
  const p = s.player;
  // what a find step of the same quest asks for is never shown again as a count (the find shows its clue)
  const finds = new Set(q.steps.flatMap((st) => (st.kind === 'find' ? [st.item] : [])));
  const need = (inputs: readonly { item: string; qty: number }[], then: string): string => {
    const counts = inputs.filter((i) => !finds.has(i.item)).map((i) => `${itemName(b, i.item)} ${Math.min(i.qty, p.bag[i.item] ?? 0)}/${i.qty}`);
    return counts.length > 0 ? `${counts.join(', ')} - then ${then}` : `Then ${then}`;
  };
  return q.steps.map((st, i) => {
    switch (st.kind) {
      case 'find': {
        // with no giver, found once is found (the kernel's questSatisfied)
        const done = q.giver ? (p.bag[st.item] ?? 0) >= 1 : p.journal.includes(st.item);
        return { text: done ? `${itemName(b, st.item)}: found` : st.clue, done, short: firstLine(st.clue) };
      }
      case 'riddle':
        return { text: st.clue, done: p.solved.includes(riddleKey(questId, i)), short: firstLine(st.clue) };
      case 'bring': {
        const have = Math.min(st.qty, p.bag[st.item] ?? 0);
        return { text: `${itemName(b, st.item)} ${have}/${st.qty}`, done: have >= st.qty };
      }
      case 'make': {
        const r = b.recipes[st.recipe];
        return { text: `Make ${r?.title ?? st.recipe}`, done: (p.made[st.recipe] ?? 0) > 0 };
      }
      case 'restore': {
        const r = b.restores[st.restore];
        const done = p.restored.includes(st.restore);
        return { text: done ? `Mend the ${r?.title ?? st.restore}` : need(r?.inputs ?? [], `mend the ${r?.title ?? st.restore}`), done };
      }
      case 'build': {
        const c = b.camps[st.camp];
        const done = campBuilt(b, s, st.camp);
        return { text: done ? `Build a ${c?.title ?? st.camp}` : need(c?.inputs ?? [], `build a ${c?.title ?? st.camp}`), done };
      }
      case 'visit': {
        const slot = findSlot(b.map, st.slot);
        return { text: `Go to the ${slot?.label ?? st.slot}`, done: p.visited.includes(st.slot) };
      }
      case 'tend':
        return tendLine(b, s, st.fire, tick);
    }
    return { text: '', done: false };
  });
}

/**
 * What a restore with no inputs says when the player faces it: it opens only as
 * a quest's reward, so the line points at that quest's next step while it is open.
 */
export function restoreHint(b: Bundle, s: PublicState, restoreId: string, tick = s.tick): string {
  const q = Object.values(b.quests).find((x) => (x.reward.opens ?? []).includes(restoreId));
  const next = q && s.player.quests[q.id] === 'active' ? questSteps(b, s, q.id, tick).find((st) => !st.done) : undefined;
  return next ? `It does not open by hand. ${next.text}` : 'It does not open by hand.';
}

export function activeQuests(b: Bundle, s: PublicState): string[] {
  return Object.keys(s.player.quests)
    .filter((id) => s.player.quests[id] === 'active' && b.quests[id])
    .sort((x, y) => questOrder(b, x) - questOrder(b, y) || x.localeCompare(y));
}

/** Quests that need nobody else come first: they carry the story. */
function questOrder(b: Bundle, id: string): number {
  return b.quests[id]?.giver ? 1 : 0;
}

/** Whether the giver takes the quest now; `tick` is the live game tick (a tend step reads the clock), the state's own by default. */
export function readyToHandIn(b: Bundle, s: PublicState, questId: string, tick = s.tick): boolean {
  return s.player.quests[questId] === 'active' && questSatisfied(b, tick === s.tick ? s : { ...s, tick }, questId);
}

/**
 * Which HUD buttons have earned their place (progressive disclosure, FTUE): the bag once
 * something was picked up, the journal once the first restoration wrote its entry or a
 * task was finished, and both as soon as a skill point waits to be spent there. Read
 * from the state, so a reload shows the same buttons; the keys work from the start.
 */
export function hudUnlocks(s: PublicState, points = 0): { bag: boolean; log: boolean } {
  const p = s.player;
  const log = p.journal.length > 0 || points > 0 || Object.values(p.quests).some((q) => q === 'done');
  // anything in the bag, worn things too: a worn piece takes no place (2026-10-23) but is still carried
  return { bag: log || Object.values(p.bag).some((q) => q > 0), log };
}

/** An active quest still waits on a riddle that a dig at another spot than `treasure` answers: this is the wrong place. */
export function digRiddleOpen(b: Bundle, s: PublicState, treasure: string): boolean {
  return Object.keys(s.player.quests).some((id) => {
    if (s.player.quests[id] !== 'active') return false;
    return (b.quests[id]?.steps ?? []).some(
      (st, i) => st.kind === 'riddle' && st.answer.kind === 'dig' && st.answer.treasure !== treasure && !s.player.solved.includes(riddleKey(id, i)),
    );
  });
}

/** How far a hidden find shows: the kernel's reach, so the birds over a find and the find itself agree. */
export function hintDistance(b: Bundle, s: PublicState): number {
  return hintReach(b, s);
}

export function campSpotOf(b: Bundle, campId: string): [number, number] | undefined {
  const c = b.camps[campId];
  return c ? campTile(b, c.slot) : undefined;
}

/** What a trader buys from the bag, by name, at the kernel's price for one unit: a worn tool that is the last unit pays less, and what pays nothing stays out. */
export function sellable(b: Bundle, s: PublicState): { item: string; each: number }[] {
  return Object.keys(s.player.bag)
    .map((item) => ({ item, each: salePrice(b, s, item, 1) ?? 0 }))
    .filter((row) => row.each >= 1)
    .sort((x, y) => itemName(b, x.item).localeCompare(itemName(b, y.item)));
}

/** Where an item is worn now, on the layer it goes on (looks apart from work clothes), or undefined. */
export function wornAt(b: Bundle, s: PublicState, itemId: string): { slot: WearSlot; look: boolean } | undefined {
  const w = b.items[itemId]?.wear;
  if (!w) return undefined;
  const look = w.look === true;
  const layer = look ? s.player.looks : s.player.worn;
  const slot = slotsFor(w.slot).find((k) => layer[k] === itemId);
  return slot === undefined ? undefined : { slot, look };
}

/** The camp parts built over a standing part that provides this station: its next step up. */
export function stationUpgrades(b: Bundle, s: PublicState, station: string): string[] {
  const standing = s.player.camp.filter((id) => b.camps[id]?.provides === station);
  return Object.keys(b.camps)
    .filter((id) => {
      const base = b.camps[id]!.upgrades;
      return base !== undefined && standing.includes(base);
    })
    .sort();
}

/** A class as a player reads it: a base class by its word, an extension's own class by its name. */
export function className(b: Bundle, cls: string | undefined): string {
  if (!cls) return 'Other';
  return b.classes[cls]?.name ?? `${cls[0]!.toUpperCase()}${cls.slice(1)}`;
}

/** An item's class, family and tier in one line, for example "Plant (berry), tier 1". */
export function classLine(b: Bundle, id: string): string {
  const it = b.items[id];
  const tier = it?.tier ?? 1;
  if (!it?.class) return `Tier ${tier}`;
  return `${className(b, it.class)}${it.family ? ` (${it.family})` : ''}, tier ${tier}`;
}

/** The bag's categories (D-CRAFT-6), in the order it shows them. */
const BAG_GROUPS = [
  ['food', 'Food'],
  ['material', 'Materials'],
  ['tool', 'Tools'],
  ['wear', 'To wear'],
  ['treasure', 'Treasures'],
  ['fragment', 'Recipe scraps'],
] as const;

/** The bag by kind, each category sorted by name; a worn thing that is not a tool goes under "To wear", and an empty category is left out. */
export function bagGroups(b: Bundle, ids: readonly string[]): { label: string; ids: string[] }[] {
  const keys: readonly string[] = BAG_GROUPS.map(([key]) => key);
  const keyOf = (id: string): string => {
    const it = b.items[id];
    const key = it && it.kind !== 'tool' && it.wear ? 'wear' : (it?.kind ?? 'material');
    // a kind the bag has no category for yet still shows, with the materials
    return keys.includes(key) ? key : 'material';
  };
  return BAG_GROUPS.map(([key, label]) => ({
    label,
    ids: ids.filter((id) => keyOf(id) === key).sort((x, y) => itemName(b, x).localeCompare(itemName(b, y))),
  })).filter((g) => g.ids.length > 0);
}

/** The journal's items by class (C12): one group per class, by name, each with a row for the items of no family first and then a row per family. */
export function journalGroups(b: Bundle): { label: string; rows: { family?: string; ids: string[] }[] }[] {
  const byName = (x: string, y: string) => itemName(b, x).localeCompare(itemName(b, y));
  const groups = new Map<string, string[]>();
  for (const id of Object.keys(b.items)) {
    const label = className(b, b.items[id]!.class);
    groups.set(label, [...(groups.get(label) ?? []), id]);
  }
  return [...groups.entries()]
    .sort(([x], [y]) => x.localeCompare(y))
    .map(([label, ids]) => ({
      label,
      rows: [...new Set(ids.map((id) => b.items[id]!.family ?? ''))].sort().map((family) => ({
        ...(family ? { family } : {}),
        ids: ids.filter((id) => (b.items[id]!.family ?? '') === family).sort(byName),
      })),
    }));
}

/** Where a recipe is made: "the workshop", or "a workshop of tier 2" past the first tier. */
export function stationText(b: Bundle, recipe: RecipeDef): string {
  const tier = recipeTier(b, recipe);
  return tier > 1 ? `a ${recipe.station} of tier ${tier}` : `the ${recipe.station}`;
}

/**
 * The gate that blocks a recipe, the only one since CR-17: every part built
 * for its station is below the recipe's tier. Names the lowest part that
 * fits. Undefined when a built part fits, or when none is built yet.
 */
export function stationGate(b: Bundle, s: PublicState, recipe: RecipeDef): string | undefined {
  const tier = recipeTier(b, recipe);
  const tierOf = (id: string) => b.camps[id]!.tier ?? 1;
  const parts = Object.keys(b.camps).filter((id) => b.camps[id]!.provides === recipe.station);
  const built = parts.filter((id) => s.player.camp.includes(id));
  if (built.length === 0 || built.some((id) => tierOf(id) >= tier)) return undefined;
  const next = parts.filter((id) => tierOf(id) >= tier).sort((x, y) => tierOf(x) - tierOf(y) || x.localeCompare(y))[0];
  return `Needs a ${recipe.station} of tier ${tier}${next ? `: the ${b.camps[next]!.title.toLowerCase()}` : ''}.`;
}

/** A short sentence for each event a player should notice. */
/** What a hurt says, by what did it (the kernel's hazard kinds, and food). */
const HURT_TEXT: Readonly<Record<string, string>> = {
  predator: 'Bitten! Run for a safe place',
  pit: 'The floor gave way under you',
  trap: 'A trap snapped shut on your foot',
  deep_water: 'The deep water dragged at you',
  food: 'That did not agree with you',
};

/** The Eat button's label: what a food gives, and what it takes when it hurts. */
export function eatLabel(b: Bundle, id: string): string {
  const item = b.items[id];
  const food = item?.food;
  // a bandage or a first-aid kit heals the same way, but nobody eats it
  const verb = item && item.kind !== 'food' ? 'Use' : 'Eat';
  if (!food) return verb;
  const parts = [food.satiety > 0 ? `+${food.satiety}` : '', food.hurt ? `-${food.hurt}` : ''].filter(Boolean);
  return parts.length > 0 ? `${verb} (${parts.join(', ')})` : verb;
}

/**
 * The countdown at the screen's edge (G31): while the player stands outside a
 * safe place by day in a world that has hazards, how long until dark, in the
 * game's own time. Undefined on safe ground, after dark, and in a world where
 * nothing hunts. The mist's coming joins it with the mist (GRUNT P-6).
 */
export function nightCountdown(b: Bundle, s: PublicState, at: readonly [number, number], tick: number): { text: string; soon: boolean } | undefined {
  if (hazardsOf(b).length === 0 || isNight(b, tick) || isSafe(b, s, [at[0], at[1]])) return undefined;
  const ms = nightFalls(b, tick) - tick;
  const sec = Math.ceil(ms / 1000);
  return { text: `Dark in ${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`, soon: ms <= 60_000 };
}

/**
 * Which night the lantern warning belongs to (G31): the tick that night ends,
 * while it is dark and the player stands outside a safe place in a world that
 * has hazards; undefined otherwise. The warning opens once for each value.
 */
export function lanternNight(b: Bundle, s: PublicState, at: readonly [number, number], tick: number): number | undefined {
  if (hazardsOf(b).length === 0 || !isNight(b, tick) || isSafe(b, s, [at[0], at[1]])) return undefined;
  return nightEnds(b, tick);
}

/** The searchable that hangs on a map prop, by the prop's id (docs/design/SEARCH.md). */
export function searchableOn(b: Bundle, propId: string): string | undefined {
  return Object.values(b.searchables).find((sr) => sr.place.prop === propId)?.id;
}

/** What an empty searchable's window says: one line (G14). */
export const SEARCH_EMPTY = 'Nothing here.';

/** The line under a window when the character's luck tilts the rare rows, in words (decision 39). */
export const SEARCH_LUCK_LINE = 'You have a feel for hidden things.';

export interface SearchRow {
  /** the place in the searchable's list, the `row` a take names */
  index: number;
  item: string;
  name: string;
  sprite: string | undefined;
}

/** The rows a searchable holds now: those drawn for today's dawn and not yet taken, in the order the kernel keeps them. */
export function searchRows(b: Bundle, s: PublicState, tick: number, spotId: string): SearchRow[] {
  const held = s.searched?.[spotId];
  if (!held || held.dawn !== searchDawn(b, tick)) return [];
  return held.rows.map((item, index) => ({ index, item, name: itemName(b, item), sprite: b.items[item]?.sprite }));
}

export function describe(b: Bundle, s: PublicState, e: GameEvent): { text: string; icon?: string; tone?: 'good' | 'bad' | 'info' } | undefined {
  switch (e.e) {
    case 'gain':
      return { text: `+${e.qty} ${itemName(b, e.item)}`, icon: b.items[e.item]?.sprite, tone: 'good' };
    case 'bag_full':
      return { text: `Bag full - ${e.qty} ${itemName(b, e.item)} left behind`, tone: 'bad' };
    case 'drop':
      return { text: `Put down ${e.qty} ${itemName(b, e.item)}`, icon: b.items[e.item]?.sprite, tone: 'info' };
    case 'gold':
      return { text: `${e.delta > 0 ? '+' : '-'}${gold(Math.abs(e.delta))} gold`, tone: e.delta > 0 ? 'good' : 'info' };
    case 'bound':
      return { text: `${e.delta > 0 ? '+' : '-'}${gold(Math.abs(e.delta))} starter gold`, tone: e.delta > 0 ? 'good' : 'info' };
    case 'level': {
      const prof = b.professions[e.profession];
      const tech = prof?.techniques.find((t) => t.level === e.level);
      const extra = tech ? ` New technique: ${tech.name}.` : '';
      return { text: `${prof?.name ?? e.profession} level ${e.level}! You gained a skill point.${extra}`, tone: 'good' };
    }
    case 'discover':
      return { text: `New in your journal: ${itemName(b, e.item)}`, icon: b.items[e.item]?.sprite, tone: 'info' };
    case 'learn':
      return { text: `New recipe: ${b.recipes[e.recipe]?.title ?? e.recipe}`, tone: 'good' };
    case 'quest':
      return e.state === 'active'
        ? { text: `New task: ${b.quests[e.quest]?.title ?? e.quest}`, tone: 'info' }
        : { text: `Task done: ${b.quests[e.quest]?.title ?? e.quest}`, tone: 'good' };
    case 'restore': {
      const r = b.restores[e.restore];
      // a restore with no inputs is a place a quest opens, not one the player mended
      if (r && r.inputs.length === 0) return { text: `${r.title}: the way is open`, tone: 'good' };
      return { text: `${r?.title ?? e.restore} restored`, tone: 'good' };
    }
    case 'build':
      return { text: `${b.camps[e.camp]?.title ?? e.camp} built`, tone: 'good' };
    case 'fire': {
      const name = fireName(e.id);
      // lit after the night it keeps was lost: plain, not cheered
      if (feedTooLate(b, s, e.id, s.tick)) return { text: `The ${name} burns, but tonight is lost.`, tone: 'info' };
      // the player's own fire tells no clock: no minute of its burn is shown (NEXT 21b)
      if (e.id === OWN_FIRE) return { text: `The ${name} takes.`, tone: 'good' };
      return { text: `The ${name} burns until ${clock(minuteOfDay(b, e.until))}.`, tone: 'good' };
    }
    case 'fire_out':
      return { text: `The ${fireName(e.id)} went out - tonight is lost. Try again before the next dusk.`, tone: 'bad' };
    case 'eat':
      return { text: `${b.items[e.item]?.kind === 'food' ? 'You ate' : 'You used'} ${itemName(b, e.item)}`, icon: b.items[e.item]?.sprite, tone: b.items[e.item]?.food?.hurt ? 'info' : 'good' };
    case 'hurt':
      return { text: HURT_TEXT[e.by] ?? 'That hurt', tone: 'bad' };
    case 'seen':
      return { text: 'Seen! Run for a safe place', tone: 'bad' };
    case 'safe':
      return { text: 'Safe.', tone: 'good' };
    case 'nothing':
      return { text: e.verb === 'dig' ? 'Nothing this time.' : 'Missed - nothing this time.', tone: 'bad' };
    case 'miss':
      return { text: `${b.recipes[e.recipe]?.title ?? e.recipe} did not come out this time - part of it is left`, tone: 'bad' };
    case 'wear':
      return { text: `You put on ${itemName(b, e.item)}`, icon: b.items[e.item]?.sprite, tone: 'info' };
    case 'unwear':
      return { text: `You took off ${itemName(b, e.item)}`, tone: 'info' };
    case 'tool_broke':
      return { text: `Your ${itemName(b, e.item)} broke`, tone: 'bad' };
    case 'attr':
      return { text: `${e.attr[0]?.toUpperCase()}${e.attr.slice(1)} is now ${e.value}`, tone: 'good' };
    case 'jackpot':
      return { text: 'Jackpot! Better than perfect', tone: 'good' };
    case 'riddle':
      return { text: `That was it: ${b.quests[e.quest]?.title ?? e.quest}`, tone: 'good' };
    case 'visit': {
      const slot = findSlot(b.map, e.slot);
      return slot?.label ? { text: `You reached the ${slot.label}`, tone: 'info' } : undefined;
    }
    default:
      return undefined;
  }
}

/**
 * Titles of the quests a tool kind opens for this player: open or ready to take,
 * with a step whose find or dig needs that tool. The stall shows them, so a
 * tool is bought for a road the player can already see.
 */
export function toolOpens(b: Bundle, s: PublicState, kind: string): string[] {
  const p = s.player;
  const needs = new Set<string>();
  for (const r of Object.values(b.resources)) if (r.tool === kind) needs.add(r.output);
  for (const t of Object.values(b.treasures)) if (t.tool === kind) for (const f of t.finds) needs.add(f.item);
  const digs = new Set(Object.values(b.treasures).filter((t) => t.tool === kind).map((t) => t.id));
  return Object.values(b.quests)
    .filter((q) => {
      const state = p.quests[q.id];
      if (state === 'done' || !offeredTo(q, s)) return false;
      if (state !== 'active' && !(q.requires ?? []).every((r) => p.quests[r] === 'done')) return false;
      return q.steps.some(
        (st) =>
          (st.kind === 'find' && needs.has(st.item)) ||
          (st.kind === 'riddle' && st.answer.kind === 'dig' && digs.has(st.answer.treasure)),
      );
    })
    .map((q) => q.title)
    .sort();
}

/** Concrete effect/benefit of an item: tool speed & durability, the health a food gives or takes, recipe learned, or description. */
export function itemBenefit(b: Bundle, id: string): string {
  const it = b.items[id];
  if (!it) return '';
  if (it.tool) {
    const tier = `Tier ${it.tool.tier} ${it.tool.kind}`;
    // a tool with no uses never wears out
    const uses = it.tool.uses === undefined ? 'lasts' : `${it.tool.uses} uses`;
    const speed = it.tool.tier > 1 ? ` · +${15 * (it.tool.tier - 1)}% gathering speed` : '';
    // two patches of the same plant read as one; a wake pocket's own spot is no dig site of the trowel's
    const resources = [...new Set(Object.values(b.resources)
      .filter((resource) => resource.tool === it.tool?.kind)
      .map((resource) => resource.title.toLowerCase()))]
      .sort();
    const digSites = it.tool.kind === 'trowel'
      ? Object.values(b.treasures)
          .filter((treasure) => treasure.tool === it.tool?.kind && treasure.pocket === undefined)
          .map((treasure) => treasure.title.toLowerCase())
          .sort()
      : [];
    const unlocks = [
      resources.length ? `${it.tool.kind === 'axe' ? 'fells' : it.tool.kind === 'rod' ? 'fishes for' : 'gathers'} ${resources.join(' & ')}` : '',
      digSites.length ? `digs ${digSites.join(' & ')}` : '',
    ].filter(Boolean).join(' · ') || `tool for ${it.tool.kind}`;
    return `${tier} · ${unlocks} · ${uses}${speed}`;
  }
  if (it.food) {
    // food is in whole points of health (`food.satiety` in the content); nothing drains the bar by the clock (G28)
    const parts: string[] = [];
    if (it.food.satiety > 0) parts.push(`+${it.food.satiety} health`);
    if (it.food.hurt) parts.push(`hurts: -${it.food.hurt} health`);
    return parts.join(' · ');
  }
  if (it.wear?.places !== undefined) {
    const bonus = it.wear.load_bonus ? ` · carries ${it.wear.load_bonus} more weight` : '';
    return `On the back: ${it.wear.places} places${bonus}`;
  }
  if (it.fragment) {
    return `Unlocks recipe: ${b.recipes[it.fragment.unlocks]?.title ?? it.fragment.unlocks}`;
  }
  return it.description ?? '';
}
