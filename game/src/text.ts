/** Words for numbers and events. Display only: the kernel never sees these. */
import {
  type Attribute,
  type Bundle,
  type GameEvent,
  type State,
  bagCapacity,
  campTile,
  findSlot,
  missKeepBp,
  powerCap,
  questSatisfied,
  rareFindPermille,
  satietyCap,
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

/** One line per quest step, with a tick when it is done. */
export function questSteps(b: Bundle, s: State, questId: string): { text: string; done: boolean }[] {
  const q = b.quests[questId];
  if (!q) return [];
  const p = s.player;
  return q.steps.map((st) => {
    switch (st.kind) {
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
        const done = p.camp.includes(st.camp);
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

export function hintDistance(b: Bundle, s: State): number {
  return 2 + b.params.per_point.senses * s.player.attrs.senses + (techniqueValue(b, s, 'second_hint') > 0 ? 2 : 0);
}

export function campSpotOf(b: Bundle, campId: string): [number, number] | undefined {
  const c = b.camps[campId];
  return c ? campTile(b, c.slot) : undefined;
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
    case 'tool_broke':
      return { text: `Your ${itemName(b, e.item)} broke`, tone: 'bad' };
    case 'attr':
      return { text: `${e.attr[0]?.toUpperCase()}${e.attr.slice(1)} is now ${e.value}`, tone: 'good' };
    case 'jackpot':
      return { text: 'Jackpot! Three times the experience', tone: 'good' };
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
    const uses = `${it.tool.uses} uses`;
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
