/** Words for numbers and events. Display only: the kernel never sees these. */
import {
  type Attribute,
  type Bundle,
  type GameEvent,
  type State,
  type WearSlot,
  bagCapacity,
  bagUsed,
  campBuilt,
  campTile,
  findSlot,
  hazardsOf,
  isNight,
  isSafe,
  missKeepBp,
  nightEnds,
  nightFalls,
  offeredTo,
  powerCap,
  questSatisfied,
  riddleKey,
  rareFindPermille,
  salePrice,
  satietyCap,
  slotsFor,
  senseReach,
  techniqueValue,
} from '@game/kernel';

export function itemName(b: Bundle, id: string): string {
  return b.items[id]?.name ?? id;
}

/** The verb on a node's prompt and its minigame: a tree is felled, anything else gathered. */
export function nodeAction(b: Bundle, r: Bundle['resources'][string]): string {
  return r.tool === 'axe' ? 'Fell tree' : `Gather ${itemName(b, r.output)}`;
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
  carry: 'Bag space',
  senses: 'Keen eyes',
  agility: 'Steady hands',
  luck: 'Luck',
  stamina: 'Stamina',
};

export const ATTRIBUTE_TEXT: Record<string, string> = {
  carry: 'Bag space: carry more',
  senses: 'Keen eyes: see hidden finds from farther away',
  agility: 'Steady hands: easier timing in every minigame',
  luck: 'Luck: a miss keeps something more often, and rare finds come more',
  stamina: 'Stamina: eat less often',
};

/** The most points one attribute can take (the kernel refuses more). */
export const ATTRIBUTE_MAX = 10;

/** How wide the minigame windows are, in percent of the base. */
export function windowScalePct(b: Bundle, s: State): number {
  return 100 + b.params.per_point.agility_pct * s.player.attrs.agility + techniqueValue(b, s, 'timing_window_pct');
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
export function attributeEffects(b: Bundle, s: State): AttributeEffect[] {
  const plus = (a: Attribute): State => ({ ...s, player: { ...s.player, attrs: { ...s.player.attrs, [a]: s.player.attrs[a] + 1 } } });
  // with no hunger clock (G32) a point of stamina is health, not minutes of work
  const drain = b.params.satiety_drain_per_min;
  const minutes = (st: State) => Math.floor(satietyCap(b, st) / (drain > 0 ? drain : 1000));
  const pct = (bp: number) => `${Math.round(bp / 100)}%`;
  const times = (permille: number) => `x${(permille / 1000).toFixed(2).replace(/0$/, '')}`;
  const luckNext = plus('luck');
  const capped = rareFindPermille(b, luckNext) === rareFindPermille(b, s) && rareFindPermille(b, s) >= powerCap(b, s);
  return [
    { attr: 'carry', name: 'Bag space', what: 'Your bag holds', now: `${bagCapacity(b, s)}`, next: `${bagCapacity(b, plus('carry'))} things` },
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
      what: drain > 0 ? 'Work before you must eat' : 'Your health holds',
      now: `${minutes(s)}`,
      next: `${minutes(plus('stamina'))} ${drain > 0 ? 'minutes' : 'points'}`,
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

/** One line per quest step, with a tick when it is done; `short` is what the tracker shows when the line is a clue. */
export function questSteps(b: Bundle, s: State, questId: string): { text: string; done: boolean; short?: string }[] {
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
    }
    return { text: '', done: false };
  });
}

/**
 * What a restore with no inputs says when the player faces it: it opens only as
 * a quest's reward, so the line points at that quest's next step while it is open.
 */
export function restoreHint(b: Bundle, s: State, restoreId: string): string {
  const q = Object.values(b.quests).find((x) => (x.reward.opens ?? []).includes(restoreId));
  const next = q && s.player.quests[q.id] === 'active' ? questSteps(b, s, q.id).find((st) => !st.done) : undefined;
  return next ? `It does not open by hand. ${next.text}` : 'It does not open by hand.';
}

export function activeQuests(b: Bundle, s: State): string[] {
  return Object.keys(s.player.quests)
    .filter((id) => s.player.quests[id] === 'active' && b.quests[id])
    .sort((x, y) => questOrder(b, x) - questOrder(b, y) || x.localeCompare(y));
}

/** Quests that need nobody else come first: they carry the story. */
function questOrder(b: Bundle, id: string): number {
  return b.quests[id]?.giver ? 1 : 0;
}

export function readyToHandIn(b: Bundle, s: State, questId: string): boolean {
  return s.player.quests[questId] === 'active' && questSatisfied(b, s, questId);
}

/**
 * Which HUD buttons have earned their place (progressive disclosure, FTUE): the bag once
 * something was picked up, the journal once the first restoration wrote its entry or a
 * task was finished, and both as soon as a skill point waits to be spent there. Read
 * from the state, so a reload shows the same buttons; the keys work from the start.
 */
export function hudUnlocks(s: State, points = 0): { bag: boolean; log: boolean } {
  const p = s.player;
  const log = p.journal.length > 0 || points > 0 || Object.values(p.quests).some((q) => q === 'done');
  return { bag: log || bagUsed(s) > 0, log };
}

/** An active quest still waits on a riddle that a dig at another spot than `treasure` answers: this is the wrong place. */
export function digRiddleOpen(b: Bundle, s: State, treasure: string): boolean {
  return Object.keys(s.player.quests).some((id) => {
    if (s.player.quests[id] !== 'active') return false;
    return (b.quests[id]?.steps ?? []).some(
      (st, i) => st.kind === 'riddle' && st.answer.kind === 'dig' && st.answer.treasure !== treasure && !s.player.solved.includes(riddleKey(id, i)),
    );
  });
}

export function hintDistance(b: Bundle, s: State): number {
  return senseReach(b, s.player.attrs.senses) + (techniqueValue(b, s, 'second_hint') > 0 ? 2 : 0);
}

export function campSpotOf(b: Bundle, campId: string): [number, number] | undefined {
  const c = b.camps[campId];
  return c ? campTile(b, c.slot) : undefined;
}

/** What a trader buys from the bag, by name, at the kernel's price for one unit: a worn tool that is the last unit pays less, and what pays nothing stays out. */
export function sellable(b: Bundle, s: State): { item: string; each: number }[] {
  return Object.keys(s.player.bag)
    .map((item) => ({ item, each: salePrice(b, s, item, 1) ?? 0 }))
    .filter((row) => row.each >= 1)
    .sort((x, y) => itemName(b, x.item).localeCompare(itemName(b, y.item)));
}

/** Where an item is worn now, on the layer it goes on (looks apart from work clothes), or undefined. */
export function wornAt(b: Bundle, s: State, itemId: string): { slot: WearSlot; look: boolean } | undefined {
  const w = b.items[itemId]?.wear;
  if (!w) return undefined;
  const look = w.look === true;
  const layer = look ? s.player.looks : s.player.worn;
  const slot = slotsFor(w.slot).find((k) => layer[k] === itemId);
  return slot === undefined ? undefined : { slot, look };
}

/** The camp parts built over a standing part that provides this station: its next step up. */
export function stationUpgrades(b: Bundle, s: State, station: string): string[] {
  const standing = s.player.camp.filter((id) => b.camps[id]?.provides === station);
  return Object.keys(b.camps)
    .filter((id) => {
      const base = b.camps[id]!.upgrades;
      return base !== undefined && standing.includes(base);
    })
    .sort();
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
  const food = b.items[id]?.food;
  if (!food) return 'Eat';
  const parts = [food.satiety > 0 ? `+${food.satiety}` : '', food.hurt ? `-${food.hurt}` : ''].filter(Boolean);
  return parts.length > 0 ? `Eat (${parts.join(', ')})` : 'Eat';
}

/**
 * The countdown at the screen's edge (G31): while the player stands outside a
 * safe place by day in a world that has hazards, how long until dark, in the
 * game's own time. Undefined on safe ground, after dark, and in a world where
 * nothing hunts. The mist's coming joins it with the mist (GRUNT P-6).
 */
export function nightCountdown(b: Bundle, s: State, at: readonly [number, number], tick: number): { text: string; soon: boolean } | undefined {
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
export function lanternNight(b: Bundle, s: State, at: readonly [number, number], tick: number): number | undefined {
  if (hazardsOf(b).length === 0 || !isNight(b, tick) || isSafe(b, s, [at[0], at[1]])) return undefined;
  return nightEnds(b, tick);
}

export function describe(b: Bundle, s: State, e: GameEvent): { text: string; icon?: string; tone?: 'good' | 'bad' | 'info' } | undefined {
  switch (e.e) {
    case 'gain':
      return { text: `+${e.qty} ${itemName(b, e.item)}`, icon: b.items[e.item]?.sprite, tone: 'good' };
    case 'bag_full':
      return { text: `Bag full - ${e.qty} ${itemName(b, e.item)} left behind`, tone: 'bad' };
    case 'gold':
      return { text: `${e.delta > 0 ? '+' : '-'}${gold(Math.abs(e.delta))} gold`, tone: e.delta > 0 ? 'good' : 'info' };
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
    case 'eat':
      return { text: `You ate ${itemName(b, e.item)}`, icon: b.items[e.item]?.sprite, tone: b.items[e.item]?.food?.hurt ? 'info' : 'good' };
    case 'hurt':
      return { text: HURT_TEXT[e.by] ?? 'That hurt', tone: 'bad' };
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
      return { text: 'Jackpot! Three times the experience', tone: 'good' };
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
export function toolOpens(b: Bundle, s: State, kind: string): string[] {
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
    // two patches of the same plant read as one; a start's own spot is no dig site of the trowel's
    const resources = [...new Set(Object.values(b.resources)
      .filter((resource) => resource.tool === it.tool?.kind)
      .map((resource) => resource.title.toLowerCase()))]
      .sort();
    const digSites = it.tool.kind === 'trowel'
      ? Object.values(b.treasures)
          .filter((treasure) => treasure.tool === it.tool?.kind && treasure.starter === undefined)
          .map((treasure) => treasure.title.toLowerCase())
          .sort()
      : [];
    const unlocks = [
      resources.length ? `${it.tool.kind === 'axe' ? 'fells' : 'gathers'} ${resources.join(' & ')}` : '',
      digSites.length ? `digs ${digSites.join(' & ')}` : '',
    ].filter(Boolean).join(' · ') || `tool for ${it.tool.kind}`;
    return `${tier} · ${unlocks} · ${uses}${speed}`;
  }
  if (it.food) {
    // food is in whole points of health; while a hunger clock runs it drains thousandths of a point a minute
    const parts: string[] = [];
    const drain = b.params.satiety_drain_per_min;
    if (it.food.satiety > 0) parts.push(`+${it.food.satiety} health`);
    if (it.food.hurt) parts.push(`hurts: -${it.food.hurt} health`);
    if (it.food.satiety > 0 && drain > 0) {
      const workMs = Math.round((it.food.satiety * 1000 * 60_000) / drain);
      parts.push(`about ${workMs >= 60_000 ? `${Math.round(workMs / 60_000)} min` : `${Math.round(workMs / 1000)} s`} of work`);
    }
    return parts.join(' · ');
  }
  if (it.fragment) {
    return `Unlocks recipe: ${b.recipes[it.fragment.unlocks]?.title ?? it.fragment.unlocks}`;
  }
  return it.description ?? '';
}
