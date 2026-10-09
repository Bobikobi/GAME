/** Words for numbers and events. Display only: the kernel never sees these. */
import {
  type Attribute,
  type Bundle,
  type GameEvent,
  type RecipeDef,
  type State,
  type WearSlot,
  bagCapacity,
  bagUsed,
  campBuilt,
  campTile,
  findSlot,
  missKeepBp,
  powerCap,
  questSatisfied,
  recipeTier,
  riddleKey,
  rareFindPermille,
  salePrice,
  satietyCap,
  slotsFor,
  techniqueValue,
} from '@game/kernel';

export function itemName(b: Bundle, id: string): string {
  return b.items[id]?.name ?? id;
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

export const ATTRIBUTE_TEXT: Record<string, string> = {
  carry: 'Carry - room in your bag',
  senses: 'Senses - spot dig sites from farther away',
  agility: 'Agility - wider zones in every minigame',
  luck: 'Luck - a miss keeps something more often, and rarer finds',
  stamina: 'Stamina - a bigger food meter, so you eat less often',
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
  const minutes = (st: State) => Math.floor(satietyCap(b, st) / b.params.satiety_drain_per_min);
  const pct = (bp: number) => `${Math.round(bp / 100)}%`;
  const times = (permille: number) => `x${(permille / 1000).toFixed(2).replace(/0$/, '')}`;
  const luckNext = plus('luck');
  const capped = rareFindPermille(b, luckNext) === rareFindPermille(b, s) && rareFindPermille(b, s) >= powerCap(b, s);
  return [
    { attr: 'carry', name: 'Carry', what: 'Bag', now: `${bagCapacity(b, s)} places`, next: `${bagCapacity(b, plus('carry'))} places` },
    { attr: 'senses', name: 'Senses', what: 'See dig sites', now: `${hintDistance(b, s)} tiles away`, next: `${hintDistance(b, plus('senses'))} tiles away` },
    { attr: 'agility', name: 'Agility', what: 'Minigame zones', now: `${windowScalePct(b, s)}% wide`, next: `${windowScalePct(b, plus('agility'))}% wide` },
    {
      attr: 'luck',
      name: 'Luck',
      what: 'A miss still keeps 1',
      now: `${pct(missKeepBp(b, s))} of the time`,
      next: `${pct(missKeepBp(b, luckNext))} of the time`,
      note: `Rare finds ${times(rareFindPermille(b, s))} -> ${times(rareFindPermille(b, luckNext))}${capped ? ' (held by your level: level up to raise it)' : ''}`,
    },
    {
      attr: 'stamina',
      name: 'Stamina',
      what: 'Food meter',
      now: `${satietyCap(b, s) / 1000} (${minutes(s)} min of work)`,
      next: `${satietyCap(b, plus('stamina')) / 1000} (${minutes(plus('stamina'))} min)`,
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
  return q.steps.map((st, i) => {
    switch (st.kind) {
      case 'find': {
        const done = (p.bag[st.item] ?? 0) >= 1;
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
        const need = r?.inputs.map((i) => `${itemName(b, i.item)} ${Math.min(i.qty, p.bag[i.item] ?? 0)}/${i.qty}`).join(', ');
        return { text: done ? `Mend the ${r?.title ?? st.restore}` : `${need} - then mend the ${r?.title ?? st.restore}`, done };
      }
      case 'build': {
        const c = b.camps[st.camp];
        const done = campBuilt(b, s, st.camp);
        const need = c?.inputs.map((i) => `${itemName(b, i.item)} ${Math.min(i.qty, p.bag[i.item] ?? 0)}/${i.qty}`).join(', ');
        return { text: done ? `Build a ${c?.title ?? st.camp}` : `${need} - then build a ${c?.title ?? st.camp}`, done };
      }
      case 'visit': {
        const slot = findSlot(b.map, st.slot);
        return { text: `Go to the ${slot?.label ?? st.slot}`, done: p.visited.includes(st.slot) };
      }
    }
    return { text: '', done: false };
  });
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
  return 2 + b.params.per_point.senses * s.player.attrs.senses + (techniqueValue(b, s, 'second_hint') > 0 ? 2 : 0);
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
export function stationGate(b: Bundle, s: State, recipe: RecipeDef): string | undefined {
  const tier = recipeTier(b, recipe);
  const tierOf = (id: string) => b.camps[id]!.tier ?? 1;
  const parts = Object.keys(b.camps).filter((id) => b.camps[id]!.provides === recipe.station);
  const built = parts.filter((id) => s.player.camp.includes(id));
  if (built.length === 0 || built.some((id) => tierOf(id) >= tier)) return undefined;
  const next = parts.filter((id) => tierOf(id) >= tier).sort((x, y) => tierOf(x) - tierOf(y) || x.localeCompare(y))[0];
  return `Needs a ${recipe.station} of tier ${tier}${next ? `: the ${b.camps[next]!.title.toLowerCase()}` : ''}.`;
}

/** A short sentence for each event a player should notice. */
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
    case 'restore':
      return { text: `${b.restores[e.restore]?.title ?? e.restore} restored`, tone: 'good' };
    case 'build':
      return { text: `${b.camps[e.camp]?.title ?? e.camp} built`, tone: 'good' };
    case 'eat':
      return { text: `You ate ${itemName(b, e.item)}`, icon: b.items[e.item]?.sprite, tone: 'good' };
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

/** Concrete effect/benefit of an item: tool speed & durability, food satiety minutes, recipe learned, or description. */
export function itemBenefit(b: Bundle, id: string): string {
  const it = b.items[id];
  if (!it) return '';
  if (it.tool) {
    const tier = `Tier ${it.tool.tier} ${it.tool.kind}`;
    // a tool with no uses never wears out
    const uses = it.tool.uses === undefined ? 'lasts' : `${it.tool.uses} uses`;
    const speed = it.tool.tier > 1 ? ` · +${15 * (it.tool.tier - 1)}% gathering speed` : '';
    const resources = Object.values(b.resources)
      .filter((resource) => resource.tool === it.tool?.kind)
      .map((resource) => resource.title.toLowerCase())
      .sort();
    const digSites = it.tool.kind === 'trowel'
      ? Object.values(b.treasures)
          .filter((treasure) => treasure.tool === it.tool?.kind)
          .map((treasure) => treasure.title.toLowerCase())
          .sort()
      : [];
    const unlocks = [
      resources.length ? `gathers ${resources.join(' & ')}` : '',
      digSites.length ? `digs ${digSites.join(' & ')}` : '',
    ].filter(Boolean).join(' · ') || `tool for ${it.tool.kind}`;
    return `${tier} · ${unlocks} · ${uses}${speed}`;
  }
  if (it.food) {
    // food is in whole meter points; the kernel drains thousandths of a point per minute of work
    const workMs = Math.round((it.food.satiety * 1000 * 60_000) / b.params.satiety_drain_per_min);
    const lasts = workMs >= 60_000 ? `${Math.round(workMs / 60_000)} min` : `${Math.round(workMs / 1000)} s`;
    return `+${it.food.satiety} food · about ${lasts} of work`;
  }
  if (it.fragment) {
    return `Unlocks recipe: ${b.recipes[it.fragment.unlocks]?.title ?? it.fragment.unlocks}`;
  }
  return it.description ?? '';
}
