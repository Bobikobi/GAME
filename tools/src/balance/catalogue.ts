/**
 * What the balance prover reads: a catalogue of things a player can wear,
 * eat and grow, the places proven as walls, and the edges between effects.
 * Two sources fill it: the content as it stands (`realCatalogue`) and the
 * stand-in of fixture.ts until the first full catalogue lands.
 */
import { type Bundle, payFor } from '@game/kernel';
import { EFFECTS, WORN_EFFECTS, WORN_SLOTS } from '@game/schema';
import { CATEGORIES, type Category, RARITY_NAMES, type Rules } from './rules';

export interface Effect {
  kind: string;
  /** the ceiling category it sums into; null: none (a chance, a sight) */
  cat: Category | null;
  value: number;
}

export interface Piece {
  id: string;
  slot: string;
  tier: number;
  /** 0 common, 1 uncommon, 2 rare, 3 legendary */
  rarity: number;
  master: boolean;
  effects: Effect[];
  trait?: string;
  /** the school that makes it, for the effect graph */
  maker?: string;
}

export interface Dish {
  id: string;
  tier: number;
  rarity: number;
  /** a place answer is an effect of category `place` named after its trait */
  effects: Effect[];
  /** the condition its place answer lowers, if any */
  answers?: string;
  maker?: string;
}

export interface Wall {
  id: string;
  band: number;
  conditions: string[];
  grade: number;
  /** game minutes of the walk (or the work) at an even pace */
  lengthMin: number;
  by: 'move' | 'work';
  timerMin?: number;
  needsLevel?: number;
  witness?: { pieces: string[]; dishes: string[] };
}

export interface Trait {
  name: string;
  answers: string;
  slots: string[];
}

export interface School {
  id: string;
  masteryMs: number;
  /** in the first full catalogue (PROGRESSION 4.2) */
  first: boolean;
}

export interface Catalogue {
  source: 'content' | 'fixture';
  schools: School[];
  slots: { id: string; count: number }[];
  traits: Trait[];
  pieces: Piece[];
  dishes: Dish[];
  walls: Wall[];
  /** what the tree's nodes add by band, per category */
  tree: Record<Category, number[]>;
  /** effect kind -> what it raises: another kind, or `strength:<school>` (what the school makes) */
  edges: [string, string][];
  /** experience sources beside the work itself, in permille of the player's own */
  xpSources: { source: string; permille: number }[];
  /** every effect and stat name a thing or node may carry, for the experience scan */
  names: string[];
  /** an effect kind's smallest step: its tier-1 value (5.7) */
  steps: Record<string, number>;
  /** an effect kind's full strength by tier, where a page fixes it: the rarity bands read it */
  full: Record<string, number[]>;
}

const zeros = (): Record<Category, number[]> => Object.fromEntries(CATEGORIES.map((c) => [c, [0, 0, 0, 0, 0]])) as Record<Category, number[]>;

/** The ceiling category of a worn effect as built (PROGRESSION 4.7): the work speeds sum in `work`, rare finds in `find`; the craft chance is a chance, in none. */
export function categoryOfWorn(effect: string): Category | null {
  if (effect === 'gather_speed_pct' || effect === 'dig_speed_pct' || effect === 'craft_speed_pct') return 'work';
  if (effect === 'rare_find_pct') return 'find';
  return null;
}

function recipeSchool(b: Bundle, id: string): string {
  const r = b.recipes[id]!;
  return r.profession ?? b.stations[r.station] ?? b.verbs.craft;
}

/** The content as it stands, read as a catalogue: the built schools, the worn items, the foods. No walls, traits or dishes exist yet. */
export function realCatalogue(b: Bundle, rules: Rules): Catalogue {
  const maker = new Map<string, string>();
  for (const r of Object.values(b.recipes)) for (const o of r.outputs) maker.set(o.item, recipeSchool(b, r.id));
  const rank = (r: string | undefined) => Math.max(0, RARITY_NAMES.indexOf((r ?? 'common') as (typeof RARITY_NAMES)[number]));
  const pieces: Piece[] = [];
  const dishes: Dish[] = [];
  for (const [id, item] of Object.entries(b.items).sort(([a], [c]) => a.localeCompare(c))) {
    if (item.wear && !item.wear.look) {
      pieces.push({
        id,
        slot: item.wear.slot,
        tier: item.tier ?? 1,
        rarity: rank(item.rarity),
        master: false,
        effects: (item.wear.effects ?? []).map((e) => ({ kind: e.effect, cat: categoryOfWorn(e.effect), value: e.value })),
        ...(maker.has(id) ? { maker: maker.get(id)! } : {}),
      });
    }
    if (item.food) dishes.push({ id, tier: item.tier ?? 1, rarity: rank(item.rarity), effects: [], ...(maker.has(id) ? { maker: maker.get(id)! } : {}) });
  }
  const nodeEffects = Object.values(b.schools).flatMap((s) => (s.nodes ?? []).map((n) => n.effect));
  return {
    source: 'content',
    schools: Object.values(b.professions)
      .map((p) => ({ id: p.id, masteryMs: (p.xp_levels.at(-1) ?? 0) * 1000, first: true }))
      .sort((a, c) => a.id.localeCompare(c.id)),
    slots: WORN_SLOTS.map((s) => ({ id: s, count: s === 'jewelry' ? 2 : 1 })),
    traits: [],
    pieces,
    dishes,
    walls: [],
    tree: zeros(),
    edges: [],
    xpSources: [],
    names: [...new Set([...EFFECTS, ...WORN_EFFECTS, ...nodeEffects])].sort(),
    steps: Object.fromEntries(WORN_EFFECTS.map((e) => [e, rules.wearStepPct])),
    full: {},
  };
}

export interface Loop {
  what: string;
  costMg: number;
  payMg: number;
  profitMg: number;
}

/**
 * Red line A at the vendor: every buy, craft and sell cycle, priced with a sure
 * craft (the most a player could make). An item's cost is the cheapest way to
 * have it with gold alone: a shop's price, or a recipe of things bought; a
 * gathered input costs time, not gold, and is no loop. The trader pays the
 * kernel's own price (payFor).
 */
export function vendorLoops(b: Bundle): Loop[] {
  const cost = new Map<string, number>();
  for (const shop of Object.values(b.shops)) {
    for (const o of shop.sells) cost.set(o.item, Math.min(cost.get(o.item) ?? Number.MAX_SAFE_INTEGER, o.price_mg));
  }
  const inputCost = (i: { item?: string; class?: string; qty: number }): number | undefined => {
    if (i.item !== undefined) {
      const c = cost.get(i.item);
      return c === undefined ? undefined : c * i.qty;
    }
    const of = Object.entries(b.items)
      .filter(([, it]) => it.class === i.class)
      .map(([id]) => cost.get(id))
      .filter((c): c is number => c !== undefined);
    return of.length === 0 ? undefined : Math.min(...of) * i.qty;
  };
  const recipeCost = (id: string): number | undefined => {
    let sum = 0;
    for (const i of b.recipes[id]!.inputs) {
      const c = inputCost(i as { item?: string; class?: string; qty: number });
      if (c === undefined) return undefined;
      sum += c;
    }
    return sum;
  };
  // made things bought with gold alone: the cheapest way, until nothing gets cheaper
  for (let round = 0; round < Object.keys(b.recipes).length + 1; round++) {
    let changed = false;
    for (const r of Object.values(b.recipes)) {
      const c = recipeCost(r.id);
      const out = r.outputs[0];
      if (c === undefined || !out) continue;
      const each = Math.trunc((c + out.qty - 1) / out.qty);
      if (each < (cost.get(out.item) ?? Number.MAX_SAFE_INTEGER)) {
        cost.set(out.item, each);
        changed = true;
      }
    }
    if (!changed) break;
  }
  const pay = (item: string): number | undefined => {
    const value = b.values[item];
    return value === undefined || !b.items[item] ? undefined : payFor(b.params, value, b.made.includes(item));
  };
  const loops: Loop[] = [];
  for (const shop of Object.values(b.shops)) {
    for (const o of shop.sells) {
      const p = pay(o.item);
      if (p !== undefined) loops.push({ what: `buy ${o.item} at ${shop.id}, sell it back`, costMg: o.price_mg, payMg: p, profitMg: p - o.price_mg });
    }
  }
  for (const r of Object.values(b.recipes).sort((a, c) => a.id.localeCompare(c.id))) {
    const c = recipeCost(r.id);
    if (c === undefined) continue;
    let p = 0;
    for (const o of r.outputs) p += (pay(o.item) ?? 0) * o.qty;
    loops.push({ what: `buy the inputs of ${r.id}, make it, sell ${r.outputs.map((o) => `${o.qty} ${o.item}`).join(' and ')}`, costMg: c, payMg: p, profitMg: p - c });
  }
  return loops.sort((a, c) => c.profitMg - a.profitMg || a.what.localeCompare(c.what));
}
