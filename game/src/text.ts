/** Words for numbers and events. Display only: the kernel never sees these. */
import {
  type Bundle,
  type GameEvent,
  type State,
  campTile,
  findSlot,
  questSatisfied,
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
  agility: 'Agility - a wider timing window',
  luck: 'Luck - better odds of rare finds',
  stamina: 'Stamina - a bigger satiety meter',
};

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
  return 2 + s.player.attrs.senses + (techniqueValue(b, s, 'second_hint') > 0 ? 2 : 0);
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
    case 'visit': {
      const slot = findSlot(b.map, e.slot);
      return slot?.label ? { text: `You reached the ${slot.label}`, tone: 'info' } : undefined;
    }
    default:
      return undefined;
  }
}
