/**
 * The game state and the derived numbers every screen shows. The state holds
 * integers, strings, arrays and plain objects only, so its canonical text is
 * stable and a save is just that text.
 */
import type { Bundle, Verb } from './bundle';
import { clamp, idiv, mulDiv } from './num';

export const KERNEL_VERSION = '0.2.0';

/** Same list as the schema's ATTRIBUTES (a test keeps them equal); kept here so the kernel needs no runtime import. */
export const ATTRIBUTES = ['carry', 'senses', 'agility', 'luck', 'stamina'] as const;
export type Attribute = (typeof ATTRIBUTES)[number];
export const STATE_FORMAT = 1;

export interface NodeState {
  /** tick from which the node can be used again */
  readyAt: number;
  /** draws taken from this entity so far (rule R4) */
  draws: number;
}

export interface Player {
  name: string;
  /** '' until the player picks a starter */
  starter: string;
  /** 0 for the starter's sprite, 1 for its sprite_alt (another look of the same character) */
  look: number;
  at: [number, number];
  /** milli-gold */
  gold: number;
  bag: Record<string, number>;
  /** uses already taken from the tool unit in hand, per tool item */
  wear: Record<string, number>;
  /** milli-points, as of tick satietyAt */
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
      starter: '',
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
    },
    nodes: {},
    ledger: { minted: 0, burned: 0 },
  };
}

// ------------------------------------------------------------ derived numbers

export function satietyCap(bundle: Bundle, state: State): number {
  return (bundle.params.satiety_cap + bundle.params.per_point.stamina * state.player.attrs.stamina) * 1000;
}

/** Satiety at a tick: it drains with play time and stops at zero. */
export function satietyAt(bundle: Bundle, state: State, tick: number): number {
  const p = state.player;
  const elapsed = Math.max(0, tick - p.satietyAt);
  return Math.max(0, p.satiety - mulDiv(elapsed, bundle.params.satiety_drain_per_min, 60_000));
}

export function bagUsed(state: State): number {
  let n = 0;
  for (const k of Object.keys(state.player.bag)) n += state.player.bag[k] ?? 0;
  return n;
}

export function bagCapacity(bundle: Bundle, state: State): number {
  let cap = bundle.params.bag_base + bundle.params.per_point.carry * state.player.attrs.carry;
  for (const id of state.player.camp) cap += bundle.camps[id]?.bag_bonus ?? 0;
  return cap;
}

export function professionLevel(bundle: Bundle, state: State, professionId: string): number {
  const prof = bundle.professions[professionId];
  if (!prof) return 1;
  const xp = state.player.xp[professionId] ?? 0;
  let level = 1;
  for (const seconds of prof.xp_levels) if (xp >= seconds * 1000) level++;
  return level;
}

export function verbLevel(bundle: Bundle, state: State, verb: Verb): number {
  return professionLevel(bundle, state, bundle.verbs[verb]);
}

/** Character level: one more for every profession level gained. */
export function characterLevel(bundle: Bundle, state: State): number {
  let level = 1;
  for (const id of Object.keys(bundle.professions)) level += professionLevel(bundle, state, id) - 1;
  return level;
}

export function skillPoints(bundle: Bundle, state: State): number {
  return characterLevel(bundle, state) - 1 - state.player.spent;
}

/** Rule R9: the one clamp on every rate multiplier, by character level. */
export function powerCap(bundle: Bundle, state: State): number {
  const caps = bundle.params.power_cap_permille;
  const i = clamp(characterLevel(bundle, state), 1, caps.length) - 1;
  return caps[i] ?? 1000;
}

/** Sum of a technique effect the player has unlocked through profession levels. */
export function techniqueValue(bundle: Bundle, state: State, effect: string): number {
  let total = 0;
  for (const id of Object.keys(bundle.professions).sort()) {
    const prof = bundle.professions[id]!;
    const level = professionLevel(bundle, state, id);
    for (const t of prof.techniques) if (t.effect === effect && level >= t.level) total += Math.max(1, t.value);
  }
  return total;
}

/** In-game hour 0..23. Tick 0 is 6:00 in the morning. */
export function hourOf(bundle: Bundle, tick: number): number {
  const day = bundle.params.day_length_ms;
  const t = (tick + idiv(day, 4)) % day;
  return idiv(t * 24, day);
}

/** Minutes past midnight, for the clock on screen. */
export function minuteOfDay(bundle: Bundle, tick: number): number {
  const day = bundle.params.day_length_ms;
  const t = (tick + idiv(day, 4)) % day;
  return mulDiv(t, 24 * 60, day);
}

export function repTier(points: number): 'stranger' | 'acquaintance' | 'friend' | 'family' {
  if (points >= 60) return 'family';
  if (points >= 30) return 'friend';
  if (points >= 10) return 'acquaintance';
  return 'stranger';
}
