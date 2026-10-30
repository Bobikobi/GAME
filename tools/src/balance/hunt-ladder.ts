/**
 * The hunt ladder calculators (docs/design/HUNTING.md sections 5, 8 and 9;
 * HUNT_FAMILIES 3, 3.1 and 3a and CREATURE_BEHAVIOUR 5.1, #451): the tool
 * ladder, the value of a catch by family and tier, difficulty and rarity, the
 * pay cap in value units, the tiers, the gaps of the ladder, and the audit of
 * the professions' typed experience tables against the one curve of
 * curve.ts.
 *
 * It reads its own typed tables (hunt-ladder.json), never the creature schema,
 * so it stands on develop before the creature kinds carry hunt blocks. The
 * value of a catch is the solver's own: a kind is priced as a one-source
 * content through `activitiesOf` and `computeValues` (kernel/src/values.ts),
 * as a dig, the verb whose effort step the hunt starts on (#431 gives `hunt`
 * the same step). Whole numbers only, and the same output on every run.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { type Bundle, EFFORT_TIERS, type Params, activitiesOf, clamp, computeValues, effortTier, idiv, mulDiv, mulDivUp, payFor } from '@game/kernel';
import { TILE_TAGS } from '@game/schema';
import { thresholdsOf } from './curve';
import { RARITY_NAMES, type Rules } from './rules';

export const SIZES = ['small', 'medium', 'large'] as const;
export type Size = (typeof SIZES)[number];
/** The ways of BESTIARY_LANDS 1 (HUNT_WAYS in the schema of #431). */
export const WAYS = ['stalk', 'snare', 'lure', 'fish', 'fight'] as const;
export type Way = (typeof WAYS)[number];
/** A row takes an animal, drives one to a trap (the smoke bundle), helps a take (bait, a call, cover), or is a companion. */
export const USES = ['take', 'drive', 'aid', 'companion'] as const;
export type Use = (typeof USES)[number];
/** built: in content; planned: built by a pull request after the hunt foundations (#431); later: a proposed rung; proposed: waits on an owner's question. */
export const STATUSES = ['built', 'planned', 'later', 'proposed'] as const;
export type Status = (typeof STATUSES)[number];
/** The goods classes of HUNTING 6: an input named by its class comes from the hunt. */
export const GOODS = ['meat', 'hide', 'bone', 'sinew', 'feather'] as const;
export const LANDS = ['V', 'E', 'S'] as const;

export interface LadderTool {
  id: string;
  /** what the ladder prints */
  tool: string;
  tier: string;
  /** the rung's order: T0 0 to T5 5, the T2f branch 2 */
  rung: number;
  use: Use;
  /** the kinds' ways this row serves; empty unless use is take */
  ways: Exclude<Way, 'fight'>[];
  sizes: Size[];
  /** when set, the row serves these families only (the 3a rows) */
  families?: string[];
  range: number | null;
  unaware: boolean;
  passive: boolean;
  noise: number | null;
  craftTier: 1 | 2 | 3 | null;
  level: number | null;
  station: string | null;
  inputs: Record<string, number>;
  status: Status;
  /** false: never takes a larger animal (the stone: HUNTING 5 gives it small prey only); default true: a larger animal at grade minus 1 */
  mismatch: boolean;
  /** true: a smaller animal is taken at grade minus 1 too (arrows by size, HUNT_FAMILIES 9a) */
  oversize: boolean;
  /** an ammunition or arrow row of another tool: a kind's way_tools naming that tool admit it */
  variantOf?: string;
  source: string;
  note?: string;
}

export interface KindRow {
  id: string;
  name: string;
  family: string;
  land: (typeof LANDS)[number];
  size: Size;
  tier: number;
  danger: 0 | 1 | 2;
  take_s: number;
  ways: Way[];
  /** ways of the kind that wait for the fight (G35) */
  after_fight: Way[];
  /** the tools its source names for a way (BESTIARY_LANDS: "stalk (a sling)", "lure (a pit with bait)"); a way not listed takes any tool of that way */
  way_tools: Partial<Record<Way, string[]>>;
  drops: { item: string; qty: number; share_pct: number }[];
  cap_per_1000: number;
  refill_d: number;
  sight: number;
  /** as the source writes it: HUNTING 8, BESTIARY 1 and HUNT_FAMILIES 4 for the valley's kinds, BESTIARY_LANDS for the others (the scales disagree, HUNT_FAMILIES 1 and 9) */
  ear: number;
  smell: number | null;
  habitat_tag: (typeof TILE_TAGS)[number] | null;
  /** the map's tiles of the habitat tag, solid ones counted (CREATURE_BEHAVIOUR 3); never typed, counted by `onMap`; null with no tag or before `onMap` */
  habitat_tiles: number | null;
  /** solo / pair / small / large weights, CREATURE_BEHAVIOUR 5.1.6 */
  group: [number, number, number, number];
  /** the rarest drop's rank, 0 common to 3 legendary, for a kind that has spots; absent: no spots, no rarity bonus */
  rarity?: number;
  source: string;
}

export interface Material {
  rung: number;
  source: string;
  proposed: boolean;
}

export interface Family {
  id: string;
  name: string;
  source: string;
}

export interface Ladder {
  params: { dress_step_ms: number; pay_per_s_mg: number; rarity_rank_cuts: [number, number, number]; profession_levels: number };
  families: Family[];
  materials: Record<string, Material>;
  tools: LadderTool[];
  kinds: KindRow[];
}

export interface HuntParams {
  /** easy, medium, craft, hard (EFFORT_TIERS order) */
  effort_permille: number[];
  dress_step_ms: number;
  k_permille: number;
  k_craft_permille: number;
  r_mg_per_value_ms: number;
  /** common, uncommon, rare, legendary */
  rarity_bonus_ms: number[];
  rarity_budget_permille: number;
  day_length_ms: number;
  tier_min_level: number[];
  craft_chance_bp: number[];
  craft_level_step_bp: number;
  open_tiers: number;
  pay_per_s_mg: number;
  rarity_rank_cuts: [number, number, number];
  noise: Record<'still' | 'sneak' | 'walk' | 'run', number>;
  /** the content's own params, as the solver and `payFor` read them */
  solver: Params;
}

/** The calculators' numbers: the content's params where develop has them, the ladder's own where it does not yet. */
export function huntParams(params: Params, ladder: Ladder): HuntParams {
  return {
    effort_permille: EFFORT_TIERS.map((t) => params.effort_permille[t]),
    dress_step_ms: ladder.params.dress_step_ms,
    k_permille: params.k_permille,
    k_craft_permille: params.k_craft_permille,
    r_mg_per_value_ms: params.r_mg_per_value_ms,
    rarity_bonus_ms: RARITY_NAMES.map((r) => params.rarity_bonus_ms[r]),
    rarity_budget_permille: params.rarity_budget_permille,
    day_length_ms: params.day_length_ms,
    tier_min_level: [...params.tier_min_level],
    craft_chance_bp: [...params.craft_chance_bp],
    craft_level_step_bp: params.craft_level_step_bp,
    open_tiers: params.open_tiers,
    pay_per_s_mg: ladder.params.pay_per_s_mg,
    rarity_rank_cuts: ladder.params.rarity_rank_cuts,
    noise: { still: params.gait.noise_still, sneak: params.gait.noise_sneak, walk: params.gait.noise_walk, run: params.gait.noise_run },
    solver: params,
  };
}

// ---------------------------------------------------------------- the loader

type Obj = Record<string, unknown>;

function fail(path: string, message: string): never {
  throw new Error(`hunt-ladder.json ${path}: ${message}`);
}

function obj(v: unknown, path: string): Obj {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) fail(path, 'must be an object');
  return v as Obj;
}

function int(v: unknown, path: string, min: number, max: number): number {
  if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < min || v > max) fail(path, `must be a whole number from ${min} to ${max}`);
  return v;
}

function intOrNull(v: unknown, path: string, min: number, max: number): number | null {
  return v === null ? null : int(v, path, min, max);
}

function str(v: unknown, path: string): string {
  if (typeof v !== 'string' || v.length === 0) fail(path, 'must be a non-empty string');
  return v;
}

function strOrNull(v: unknown, path: string): string | null {
  return v === null ? null : str(v, path);
}

function bool(v: unknown, path: string): boolean {
  if (typeof v !== 'boolean') fail(path, 'must be true or false');
  return v;
}

function oneOf<T extends string>(v: unknown, list: readonly T[], path: string): T {
  if (typeof v !== 'string' || !(list as readonly string[]).includes(v)) fail(path, `must be one of ${list.join(', ')}`);
  return v as T;
}

function arr(v: unknown, path: string): unknown[] {
  if (!Array.isArray(v)) fail(path, 'must be a list');
  return v;
}

function strings(v: unknown, path: string): string[] {
  const out = arr(v, path).map((x, i) => str(x, `${path}.${i}`));
  if (new Set(out).size !== out.length) fail(path, 'holds a value twice');
  return out;
}

function known(v: unknown, keys: readonly string[], path: string): void {
  for (const k of Object.keys(obj(v, path))) if (!keys.includes(k)) fail(`${path}.${k}`, 'is not a field of this row');
}

const TOOL_KEYS = ['id', 'name', 'tier', 'rung', 'use', 'ways', 'sizes', 'families', 'range', 'unaware', 'passive', 'noise', 'craftTier', 'level', 'station', 'inputs', 'status', 'mismatch', 'oversize', 'variant_of', 'source', 'note'];
const KIND_KEYS = ['id', 'name', 'family', 'land', 'size', 'tier', 'danger', 'take_s', 'ways', 'after_fight', 'way_tools', 'drops', 'cap_per_1000', 'refill_d', 'sight', 'ear', 'smell', 'habitat_tag', 'group', 'rarity', 'source'];

function readTool(v: unknown, path: string): LadderTool {
  known(v, TOOL_KEYS, path);
  const o = obj(v, path);
  const use = oneOf(o.use, USES, `${path}.use`);
  const ways = strings(o.ways, `${path}.ways`).map((w, i) => oneOf(w, ['stalk', 'snare', 'lure', 'fish'] as const, `${path}.ways.${i}`));
  const sizes = strings(o.sizes, `${path}.sizes`).map((s, i) => oneOf(s, SIZES, `${path}.sizes.${i}`));
  if (use === 'take' && (ways.length === 0 || sizes.length === 0)) fail(path, 'a row that takes needs its ways and its sizes');
  if (use !== 'take' && (ways.length > 0 || sizes.length > 0)) fail(path, 'only a row that takes has ways and sizes');
  const inputs: Record<string, number> = {};
  for (const [item, qty] of Object.entries(obj(o.inputs, `${path}.inputs`))) inputs[item] = int(qty, `${path}.inputs.${item}`, 1, 99);
  const craftTier = intOrNull(o.craftTier, `${path}.craftTier`, 1, 3) as LadderTool['craftTier'];
  return {
    id: str(o.id, `${path}.id`),
    tool: str(o.name, `${path}.name`),
    tier: str(o.tier, `${path}.tier`),
    rung: int(o.rung, `${path}.rung`, 0, 20),
    use,
    ways,
    sizes,
    ...(o.families !== undefined ? { families: strings(o.families, `${path}.families`) } : {}),
    range: intOrNull(o.range, `${path}.range`, 0, 64),
    unaware: bool(o.unaware, `${path}.unaware`),
    passive: bool(o.passive, `${path}.passive`),
    noise: intOrNull(o.noise, `${path}.noise`, 0, 16),
    craftTier,
    level: intOrNull(o.level, `${path}.level`, 1, 20),
    station: strOrNull(o.station, `${path}.station`),
    inputs,
    status: oneOf(o.status, STATUSES, `${path}.status`),
    mismatch: o.mismatch === undefined ? true : bool(o.mismatch, `${path}.mismatch`),
    oversize: o.oversize === undefined ? false : bool(o.oversize, `${path}.oversize`),
    ...(o.variant_of !== undefined ? { variantOf: str(o.variant_of, `${path}.variant_of`) } : {}),
    source: str(o.source, `${path}.source`),
    ...(o.note !== undefined ? { note: str(o.note, `${path}.note`) } : {}),
  };
}

function readWayTools(v: unknown, path: string, ways: Way[]): Partial<Record<Way, string[]>> {
  if (v === undefined) return {};
  const out: Partial<Record<Way, string[]>> = {};
  for (const [w, list] of Object.entries(obj(v, path))) {
    const way = oneOf(w, WAYS, `${path}.${w}`);
    if (!ways.includes(way)) fail(`${path}.${w}`, 'is not one of the kind\'s ways');
    out[way] = arr(list, `${path}.${w}`).map((x, i) => str(x, `${path}.${w}.${i}`));
  }
  return out;
}

function readKind(v: unknown, path: string): KindRow {
  known(v, KIND_KEYS, path);
  const o = obj(v, path);
  const ways = strings(o.ways, `${path}.ways`).map((w, i) => oneOf(w, WAYS, `${path}.ways.${i}`));
  const afterFight = o.after_fight === undefined ? [] : strings(o.after_fight, `${path}.after_fight`).map((w, i) => oneOf(w, WAYS, `${path}.after_fight.${i}`));
  for (const w of afterFight) if (!ways.includes(w)) fail(`${path}.after_fight`, `${w} is not one of the kind's ways`);
  const drops = arr(o.drops, `${path}.drops`).map((d, i) => {
    const at = `${path}.drops.${i}`;
    known(d, ['item', 'qty', 'share_pct'], at);
    const x = obj(d, at);
    return { item: oneOf(x.item, GOODS, `${at}.item`), qty: int(x.qty, `${at}.qty`, 1, 9), share_pct: int(x.share_pct, `${at}.share_pct`, 1, 100) };
  });
  if (drops.length === 0 || drops.length > 5) fail(`${path}.drops`, 'one to five goods (BESTIARY_LANDS 1)');
  if (new Set(drops.map((d) => d.item)).size !== drops.length) fail(`${path}.drops`, 'a good is written twice');
  if (drops.reduce((s, d) => s + d.share_pct, 0) !== 100) fail(`${path}.drops`, 'the shares must sum to 100');
  const group = arr(o.group, `${path}.group`).map((g, i) => int(g, `${path}.group.${i}`, 0, 100));
  if (group.length !== 4 || group.reduce((s, g) => s + g, 0) !== 100) fail(`${path}.group`, 'four weights, solo / pair / small / large, that sum to 100');
  const tag = o.habitat_tag === null ? null : oneOf(o.habitat_tag, TILE_TAGS, `${path}.habitat_tag`);
  return {
    id: str(o.id, `${path}.id`),
    name: str(o.name, `${path}.name`),
    family: str(o.family, `${path}.family`),
    land: oneOf(o.land, LANDS, `${path}.land`),
    size: oneOf(o.size, SIZES, `${path}.size`),
    tier: int(o.tier, `${path}.tier`, 1, 20),
    danger: int(o.danger, `${path}.danger`, 0, 2) as KindRow['danger'],
    take_s: int(o.take_s, `${path}.take_s`, 1, 3600),
    ways,
    after_fight: afterFight,
    way_tools: readWayTools(o.way_tools, `${path}.way_tools`, ways),
    drops,
    cap_per_1000: int(o.cap_per_1000, `${path}.cap_per_1000`, 1, 12),
    refill_d: int(o.refill_d, `${path}.refill_d`, 1, 30),
    sight: int(o.sight, `${path}.sight`, 0, 16),
    ear: int(o.ear, `${path}.ear`, -2, 3),
    smell: intOrNull(o.smell, `${path}.smell`, 0, 16),
    habitat_tag: tag,
    habitat_tiles: null,
    group: group as KindRow['group'],
    ...(o.rarity !== undefined ? { rarity: int(o.rarity, `${path}.rarity`, 0, 3) } : {}),
    source: str(o.source, `${path}.source`),
  };
}

/** The ladder's tables, checked row by row and across rows; throws on the first bad value, naming its path. */
export function loadLadder(raw: unknown): Ladder {
  const root = obj(raw, '(root)');
  known(root, ['about', 'params', 'families', 'materials', 'tools', 'kinds'], '(root)');
  known(root.params, ['dress_step_ms', 'pay_per_s_mg', 'rarity_rank_cuts', 'profession_levels'], 'params');
  const p = obj(root.params, 'params');
  const value = (k: string) => obj(p[k], `params.${k}`).value;
  const cuts = arr(value('rarity_rank_cuts'), 'params.rarity_rank_cuts.value').map((c, i) => int(c, `params.rarity_rank_cuts.value.${i}`, 1, 100));
  if (cuts.length !== 3 || !(cuts[0]! > cuts[1]! && cuts[1]! > cuts[2]!)) fail('params.rarity_rank_cuts.value', 'three cuts, highest first');
  const params = {
    dress_step_ms: int(value('dress_step_ms'), 'params.dress_step_ms.value', 1, 10_000),
    pay_per_s_mg: int(value('pay_per_s_mg'), 'params.pay_per_s_mg.value', 1, 1_000_000),
    rarity_rank_cuts: cuts as [number, number, number],
    profession_levels: int(value('profession_levels'), 'params.profession_levels.value', 2, 99),
  };
  const families = arr(root.families, 'families').map((f, i) => {
    const at = `families.${i}`;
    known(f, ['id', 'name', 'source'], at);
    const o = obj(f, at);
    return { id: str(o.id, `${at}.id`), name: str(o.name, `${at}.name`), source: str(o.source, `${at}.source`) };
  });
  const familyIds = new Set(families.map((f) => f.id));
  if (familyIds.size !== families.length) fail('families', 'a family id is written twice');
  const materials: Record<string, Material> = {};
  for (const [id, m] of Object.entries(obj(root.materials, 'materials'))) {
    const at = `materials.${id}`;
    known(m, ['rung', 'source', 'proposed'], at);
    const o = obj(m, at);
    materials[id] = { rung: int(o.rung, `${at}.rung`, 0, 20), source: str(o.source, `${at}.source`), proposed: o.proposed === undefined ? false : bool(o.proposed, `${at}.proposed`) };
  }
  const tools = arr(root.tools, 'tools').map((t, i) => readTool(t, `tools.${i}`));
  const kinds = arr(root.kinds, 'kinds').map((k, i) => readKind(k, `kinds.${i}`));
  const toolIds = new Set<string>();
  tools.forEach((t, i) => {
    if (toolIds.has(t.id)) fail(`tools.${i}.id`, `${t.id} is written twice`);
    toolIds.add(t.id);
    for (const f of t.families ?? []) if (!familyIds.has(f)) fail(`tools.${i}.families`, `${f} is not a family`);
    for (const item of Object.keys(t.inputs)) {
      if (!materials[item] && !(GOODS as readonly string[]).includes(item)) fail(`tools.${i}.inputs.${item}`, 'is neither a material of the table nor a good of the hunt');
    }
  });
  tools.forEach((t, i) => {
    if (t.variantOf !== undefined && !toolIds.has(t.variantOf)) fail(`tools.${i}.variant_of`, `${t.variantOf} is not a tool`);
  });
  const toolById = new Map(tools.map((t) => [t.id, t]));
  // a named tool must serve the way it is named for, or `usable` would quietly close that way to every tool
  const serves = (t: LadderTool, w: Way) => (t.ways as Way[]).includes(w) || (t.variantOf !== undefined && (toolById.get(t.variantOf)!.ways as Way[]).includes(w));
  const kindIds = new Set<string>();
  kinds.forEach((k, i) => {
    if (kindIds.has(k.id)) fail(`kinds.${i}.id`, `${k.id} is written twice`);
    kindIds.add(k.id);
    if (!familyIds.has(k.family)) fail(`kinds.${i}.family`, `${k.family} is not a family`);
    for (const [w, list] of Object.entries(k.way_tools) as [Way, string[]][]) {
      for (const id of list) {
        const t = toolById.get(id);
        if (!t) fail(`kinds.${i}.way_tools.${w}`, `${id} is not a tool`);
        if (!serves(t, w)) fail(`kinds.${i}.way_tools.${w}`, `${id} cannot serve the ${w} way`);
      }
    }
  });
  return { params, families, materials, tools, kinds };
}

// ---------------------------------------------------------- the calculators

/** The effort step of a hunt at this tier: the dig's step (#431: hunt starts on medium, as dig does), one up a tier, hard at most. */
export function effortIndex(tier: number): number {
  return EFFORT_TIERS.indexOf(effortTier('dig', tier));
}

const DRESS_STEPS: Record<Size, number> = { small: 6, medium: 12, large: 24 };

/** HUNTING 6: 6, 12 or 24 dressing steps by size (#431 kernel/src/hunt.ts `dressMs`, restated until that file is on develop). */
export function dressMs(size: Size, p: HuntParams): number {
  return DRESS_STEPS[size] * p.dress_step_ms;
}

/** The active time the solver prices: the take and the dressing. */
export function loopMs(k: KindRow, p: HuntParams): number {
  return k.take_s * 1000 + dressMs(k.size, p);
}

type SoloContent = Parameters<typeof computeValues>[0];

/**
 * A kind as the one source of a content the solver reads: a dig of the loop's time whose finds are the drops, `qty`
 * written as the expected count (chance 100 per unit), with spots and the rarest drop's rarity when the kind has them.
 * The params are the content's own; an item and a treasure carry the fields `activitiesOf` reads, typed against the
 * kernel's own item and treasure, so a renamed field fails the typecheck here.
 */
function soloContent(k: KindRow, p: HuntParams): SoloContent {
  const rarity = RARITY_NAMES[k.rarity ?? 0]!;
  const items: Record<string, Pick<SoloContent['items'][string], 'tier' | 'rarity'>> = {};
  for (const d of k.drops) items[`${k.id}:${d.item}`] = { tier: k.tier, rarity };
  const spots = k.rarity !== undefined;
  const treasure: Pick<SoloContent['treasures'][string], 'finds' | 'active_ms' | 'count' | 'respawn_ms'> = {
    finds: k.drops.map((d) => ({ item: `${k.id}:${d.item}`, chance_pct: 100 * d.qty, share_pct: d.share_pct })),
    active_ms: loopMs(k, p),
    count: spots ? 1 : 0,
    respawn_ms: spots ? k.refill_d * p.day_length_ms : 0,
  };
  return { items, resources: {}, treasures: { [k.id]: treasure }, recipes: {}, params: p.solver } as SoloContent;
}

function soloActivity(k: KindRow, p: HuntParams) {
  return activitiesOf(soloContent(k, p))[0]!;
}

/** values.ts `rarityBonus`: min(bonus of the rarity, budget * w * t / 1e6), and only for a kind with spots. */
export function rarityBonusMs(k: KindRow, p: HuntParams): number {
  return soloActivity(k, p).b;
}

/** The value of one catch in value-ms: floor(w * t / 1000) + the rarity bonus, the cost the solver shares over the drops. */
export function catchValue(k: KindRow, p: HuntParams): number {
  const a = soloActivity(k, p);
  return mulDiv(a.w, a.t, 1000) + a.b;
}

/** Each drop's value per unit, as `computeValues` sets it: floor(share * (w*t + 1000 b) / (100 * 1000 * qty)). */
export function goodValues(k: KindRow, p: HuntParams): Record<string, number> {
  const { values } = computeValues(soloContent(k, p));
  const out: Record<string, number> = {};
  for (const d of k.drops) out[d.item] = values[`${k.id}:${d.item}`] ?? 0;
  return out;
}

/** What a shop pays for one catch's value, in mg (values.ts `payFor`, a raw good). */
export function payForCatch(k: KindRow, p: HuntParams): number {
  return payFor(p.solver, catchValue(k, p));
}

/** Value per active second of the loop: the effort weight w of the tier when the bonus is 0. */
export function valuePerSecond(k: KindRow, p: HuntParams): number {
  return idiv(catchValue(k, p) * 1000, loopMs(k, p));
}

/** BESTIARY_LANDS 4: floor(cap * habitat / 1000), one at least where there is any habitat; null with no tile count. */
export function standing(k: KindRow): number | null {
  if (k.habitat_tiles === null) return null;
  if (k.habitat_tiles === 0) return 0;
  return Math.max(1, mulDiv(k.cap_per_1000, k.habitat_tiles, 1000));
}

/** Takes a day: the standing count over the refill; per 1000 habitat tiles when the kind has no tile count. */
export function dailyYield(k: KindRow): { num: number; den: number; per1000: boolean } {
  const s = standing(k);
  return s === null ? { num: k.cap_per_1000, den: k.refill_d, per1000: true } : { num: s, den: k.refill_d, per1000: false };
}

/** The proposed rank by cap over refill: at or above the first cut 0 (common), the second 1, the third 2, else 3. */
export function rarityRank(k: KindRow, cuts: [number, number, number]): 0 | 1 | 2 | 3 {
  for (let i = 0; i < 3; i++) if (k.cap_per_1000 >= cuts[i]! * k.refill_d) return i as 0 | 1 | 2;
  return 3;
}

/** HUNTING 3: a gait is heard at its noise plus the ear; still, sneak, walk, run. */
export function noticeRow(k: KindRow, p: HuntParams): [number, number, number, number] {
  return [p.noise.still + k.ear, p.noise.sneak + k.ear, p.noise.walk + k.ear, p.noise.run + k.ear];
}

const sizeIndex = (s: Size) => SIZES.indexOf(s);

/** The grade shift a tool takes this kind at, or undefined when it cannot take it at all (HUNTING 5, HUNT_FAMILIES 9a). */
export function gradeShift(t: LadderTool, k: KindRow): 0 | -1 | undefined {
  if (t.sizes.includes(k.size)) return 0;
  const at = sizeIndex(k.size);
  if (at > Math.max(...t.sizes.map(sizeIndex))) return t.mismatch ? -1 : undefined;
  return t.oversize ? -1 : 0;
}

/** Whether a tool may be used on this kind: the use, the family, a shared way, the way's named tools, and the fight (G35). */
export function usable(t: LadderTool, k: KindRow, afterFight = false): boolean {
  if (t.use !== 'take') return false;
  const forFamily = t.families !== undefined;
  if (forFamily && !t.families!.includes(k.family)) return false;
  // before the fight: no contact with a defender or a hunter, and no way the kind keeps for after it; a trap is no contact
  if (!afterFight && k.danger > 0 && !t.passive) return false;
  const open = k.ways.filter((w) => w !== 'fight' && (afterFight || !k.after_fight.includes(w)));
  return t.ways.some((w) => {
    if (!open.includes(w)) return false;
    // a row proposed for the kind's family (HUNT_FAMILIES 3a) is a new way to it, beside what its source names
    const named = k.way_tools[w];
    if (!named || forFamily) return true;
    return named.includes(t.id) || (t.variantOf !== undefined && named.includes(t.variantOf));
  });
}

function byRung(tools: LadderTool[]): LadderTool[] {
  return tools.map((t, i) => ({ t, i })).sort((a, b) => a.t.rung - b.t.rung || a.i - b.i).map((x) => x.t);
}

/** The lowest rung that takes the kind, and its grade shift; or with `atGrade0`, the lowest that takes it at full grade. */
export function toolFor(k: KindRow, tools: LadderTool[], opts: { atGrade0?: boolean; afterFight?: boolean } = {}): { tool: LadderTool; gradeShift: 0 | -1 } | undefined {
  for (const t of byRung(tools)) {
    if (!usable(t, k, opts.afterFight)) continue;
    const shift = gradeShift(t, k);
    if (shift === undefined || (opts.atGrade0 && shift !== 0)) continue;
    return { tool: t, gradeShift: shift };
  }
  return undefined;
}

export interface MatrixRow {
  id: string;
  name: string;
  family: string;
  size: Size;
  tier: number;
  danger: number;
  take_s: number;
  dress_ms: number;
  loop_ms: number;
  w: number;
  bonus_ms: number;
  value: number;
  value_per_s: number;
  pay_mg: number;
  goods: { item: string; qty: number; value: number }[];
  sight: number;
  ear: number;
  notice: [number, number, number, number];
  lowest: { tool: string; tier: string; shift: 0 | -1 } | null;
  grade0: { tool: string; tier: string } | null;
  afterFight: { tool: string; tier: string; shift: 0 | -1 } | null;
  cap_per_1000: number;
  refill_d: number;
  standing: number | null;
  daily: { num: number; den: number; per1000: boolean };
  rarity_rank: 0 | 1 | 2 | 3;
  group: [number, number, number, number];
}

export function difficultyMatrix(kinds: KindRow[], tools: LadderTool[], p: HuntParams): MatrixRow[] {
  return kinds.map((k) => {
    const a = soloActivity(k, p);
    const goods = goodValues(k, p);
    const low = toolFor(k, tools);
    const g0 = toolFor(k, tools, { atGrade0: true });
    const after = low ? undefined : toolFor(k, tools, { afterFight: true });
    return {
      id: k.id,
      name: k.name,
      family: k.family,
      size: k.size,
      tier: k.tier,
      danger: k.danger,
      take_s: k.take_s,
      dress_ms: dressMs(k.size, p),
      loop_ms: loopMs(k, p),
      w: a.w,
      bonus_ms: a.b,
      value: catchValue(k, p),
      value_per_s: valuePerSecond(k, p),
      pay_mg: payForCatch(k, p),
      goods: k.drops.map((d) => ({ item: d.item, qty: d.qty, value: goods[d.item]! })),
      sight: k.sight,
      ear: k.ear,
      notice: noticeRow(k, p),
      lowest: low ? { tool: low.tool.id, tier: low.tool.tier, shift: low.gradeShift } : null,
      grade0: g0 ? { tool: g0.tool.id, tier: g0.tool.tier } : null,
      afterFight: after ? { tool: after.tool.id, tier: after.tool.tier, shift: after.gradeShift } : null,
      cap_per_1000: k.cap_per_1000,
      refill_d: k.refill_d,
      standing: standing(k),
      daily: dailyYield(k),
      rarity_rank: rarityRank(k, p.rarity_rank_cuts),
      group: k.group,
    };
  });
}

// ------------------------------------------------------------ the tiers

export interface TierRow {
  tier: number;
  min_level: number;
  /** the craft chance of a recipe of this tier at its tier's lowest level, by the maker's level 1 to `levels` (no luck) */
  chance_bp: number[];
  w: number;
  pay_per_s_mg: number;
  tools: string[];
}

/**
 * kernel/src/step.ts `craftChanceBp` without luck: the tier's chance, plus a level step for each level over the
 * recipe's and minus one for each missing, from 0 to 10000. The recipe sits at its tier's lowest level.
 */
export function craftChance(p: HuntParams, tier: number, level: number, recipeLevel = p.tier_min_level[tier - 1] ?? 1): number {
  const base = p.craft_chance_bp[Math.min(tier, p.craft_chance_bp.length) - 1] ?? 10_000;
  return clamp(base + (level - recipeLevel) * p.craft_level_step_bp, 0, 10_000);
}

export function tierTable(p: HuntParams, tools: LadderTool[], levels = 10): TierRow[] {
  const out: TierRow[] = [];
  for (let tier = 1; tier <= p.open_tiers; tier++) {
    const w = p.effort_permille[effortIndex(tier)]!;
    out.push({
      tier,
      min_level: p.tier_min_level[tier - 1] ?? 0,
      chance_bp: Array.from({ length: levels }, (_, i) => craftChance(p, tier, i + 1)),
      w,
      pay_per_s_mg: payFor(p.solver, w),
      tools: tools.filter((t) => t.craftTier === tier).map((t) => t.id),
    });
  }
  return out;
}

// ------------------------------------------------------------ the gaps

export interface LadderGap {
  what: 'input' | 'family';
  id: string;
  detail: string;
}

/** The rung a good of the hunt is first had at: the lowest rung that takes, before the fight, a kind that drops it. */
export function goodRungs(kinds: KindRow[], tools: LadderTool[]): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  for (const g of GOODS) {
    const rungs = kinds.filter((k) => k.drops.some((d) => d.item === g)).map((k) => toolFor(k, tools)?.tool.rung).filter((r): r is number => r !== undefined);
    out[g] = rungs.length > 0 ? Math.min(...rungs) : null;
  }
  return out;
}

/**
 * HUNTING 5 ("each tool's inputs come from the tier before it") read as at or below: an input first had above the
 * tool's rung is a gap. And every family needs a rung that takes one of its kinds at grade 0 before the fight.
 */
export function ladderGaps(ladder: Ladder): LadderGap[] {
  const gaps: LadderGap[] = [];
  const goods = goodRungs(ladder.kinds, ladder.tools);
  for (const t of byRung(ladder.tools)) {
    for (const item of Object.keys(t.inputs)) {
      const rung = ladder.materials[item]?.rung ?? goods[item] ?? null;
      if (rung === null) gaps.push({ what: 'input', id: t.id, detail: `${item} comes from no kind a rung takes before the fight` });
      else if (rung > t.rung) gaps.push({ what: 'input', id: t.id, detail: `${item} is first had at rung ${rung}, above the tool's ${t.tier} (rung ${t.rung})` });
    }
  }
  for (const f of ladder.families) {
    const members = ladder.kinds.filter((k) => k.family === f.id);
    if (members.length === 0) {
      gaps.push({ what: 'family', id: f.id, detail: 'no kind row: its kinds have no take time, or stand above the open tiers' });
      continue;
    }
    const before = members.map((k) => ({ k, t: toolFor(k, ladder.tools, { atGrade0: true }) })).filter((x) => x.t);
    if (before.length > 0) continue;
    const after = members.map((k) => ({ k, t: toolFor(k, ladder.tools, { atGrade0: true, afterFight: true }) })).find((x) => x.t);
    const loose = members.map((k) => ({ k, t: toolFor(k, ladder.tools) })).find((x) => x.t);
    if (after) gaps.push({ what: 'family', id: f.id, detail: `taken at grade 0 only after the fight (${after.k.name}: ${after.t!.tool.tool}, ${after.t!.tool.tier})` });
    else if (loose) gaps.push({ what: 'family', id: f.id, detail: `no rung takes it at grade 0; the lowest is ${loose.t!.tool.tool} at grade minus 1 (${loose.k.name})` });
    else if (members.some((k) => k.ways.includes('fight'))) gaps.push({ what: 'family', id: f.id, detail: 'no rung takes it: only the fight, once it exists (G35)' });
    else gaps.push({ what: 'family', id: f.id, detail: 'no rung takes any of its kinds' });
  }
  return gaps;
}

// ------------------------------------- the pay cap in value units (HUNTING 9)

export interface CapRow {
  id: string;
  /** value per active second with no rarity bonus */
  base: number;
  /** value per active second with the kind's rarity bonus */
  withBonus: number;
  /** effort_permille of hard: the cap in value units */
  cap: number;
  ok: boolean;
  /** HUNTING 9 as written: pay_per_s_mg times the loop's seconds, against what a shop pays for the catch */
  capMg: number;
  payMg: number;
  /** payMg over capMg, rounded down */
  times: number;
}

/**
 * HUNTING 9's cap rewritten in value units: a hunt's value per active second, its rarity bonus included, never above
 * effort_permille[hard]. Without the bonus the rate is the tier's w, at most hard's by construction (EFFORT_TIERS), so
 * the base is shown beside the check and only a bonus can make it fail.
 */
export function payCap(kinds: KindRow[], p: HuntParams): CapRow[] {
  const cap = p.effort_permille[EFFORT_TIERS.length - 1]!;
  return kinds.map((k) => {
    const plain = { ...k };
    delete plain.rarity;
    const base = valuePerSecond(plain, p);
    const capMg = mulDiv(p.pay_per_s_mg, loopMs(k, p), 1000);
    const payMg = payForCatch(plain, p);
    const withBonus = valuePerSecond(k, p);
    return { id: k.id, base, withBonus, cap, ok: withBonus <= cap, capMg, payMg, times: idiv(payMg, capMg) };
  });
}

// ------------------------------------------------------- the xp audit

export interface XpRow {
  profession: string;
  /** the level the entry reaches: entry k is level k + 2 */
  level: number;
  typed_ms: number;
  curve_ms: number;
  /** typed over curve, permille, rounded down */
  ratio_permille: number;
}

/** Each profession's typed `xp_levels` (active seconds) against the curve's threshold for the same level. */
export function xpAudit(levels: Record<string, number[]>, t1Ms: number, ratioPermille: number): XpRow[] {
  const out: XpRow[] = [];
  for (const profession of Object.keys(levels).sort()) {
    const typed = levels[profession]!;
    const curve = thresholdsOf(t1Ms, ratioPermille, typed.length);
    typed.forEach((s, i) => {
      const typedMs = s * 1000;
      out.push({ profession, level: i + 2, typed_ms: typedMs, curve_ms: curve[i]!, ratio_permille: mulDiv(typedMs, 1000, curve[i]!) });
    });
  }
  return out;
}

export interface XpProposal {
  about: string;
  t1_ms: number;
  ratio_permille: number;
  steps: number;
  /** the curve's thresholds in whole active seconds, rounded up so no level comes before the curve has it; entry k is level k + 2 */
  xp_levels: number[];
  /** what each profession types today, for the comparison */
  typed: Record<string, number[]>;
}

/** The regenerated table: every profession's `xp_levels` read off the one curve, `steps` thresholds. A proposal; content is not changed. */
export function xpProposal(levels: Record<string, number[]>, t1Ms: number, ratioPermille: number, steps: number): XpProposal {
  const typed: Record<string, number[]> = {};
  for (const id of Object.keys(levels).sort()) typed[id] = [...levels[id]!];
  return {
    about: 'Generated by tools/src/balance/hunt-ladder-cli.ts --write: a proposed xp_levels for every profession, read off the curve of curve.ts (PROGRESSION 3.2), one threshold for each level from 2 to the twenty a profession keeps (GROWTH 3.6, G87). Not applied to content; applying it is the owner\'s call (DECISIONS.md, 2026-10-30, the hunt ladder calculators).',
    t1_ms: t1Ms,
    ratio_permille: ratioPermille,
    steps,
    xp_levels: thresholdsOf(t1Ms, ratioPermille, steps).map((ms) => mulDivUp(ms, 1, 1000)),
    typed,
  };
}

// -------------------------------------------------------- the markdown

function table(head: string[], rows: (string | number)[][]): string[] {
  return [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.join(' | ')} |`)];
}

/** A whole number over another to two places, rounded half up: 5 / 3 reads 1.67. */
export function fmtRatio(num: number, den: number): string {
  if (num % den === 0) return String(num / den);
  const h = idiv(num * 200 + den, 2 * den);
  return `${idiv(h, 100)}.${String(h % 100).padStart(2, '0')}`;
}

const signed = (n: number) => (n > 0 ? `+${n}` : String(n));
const shiftText = (s: 0 | -1) => (s === 0 ? '0' : '-1');
const pctText = (bp: number) => `${idiv(bp, 100)}${bp % 100 === 0 ? '' : `.${String(bp % 100).padStart(2, '0')}`}%`;

export interface Report {
  ladder: Ladder;
  params: HuntParams;
  rows: MatrixRow[];
  tiers: TierRow[];
  gaps: LadderGap[];
  cap: CapRow[];
  xp: XpRow[];
}

export function renderMarkdown(rows: MatrixRow[], tools: LadderTool[], xp: XpRow[], more: Omit<Report, 'rows' | 'xp'>): string {
  const { ladder, params: p, tiers, gaps, cap } = more;
  const fam = (id: string) => ladder.families.find((f) => f.id === id)?.name ?? id;
  const L: string[] = [];
  L.push('# The hunt ladder: tools, value per catch, difficulty and rarity, the experience curve');
  L.push('');
  L.push('Generated by `pnpm exec tsx tools/src/balance/hunt-ladder-cli.ts --write` from `tools/src/balance/hunt-ladder.json` and `content/core`; do not edit by hand (a test fails when this page and the calculators disagree).');
  L.push('');
  L.push('Beyond the six tools of HUNTING 5, the smoke bundle of HUNT_FAMILIES 3.1 and the built fishing rod, every row of the tool ladder is a HUNT_FAMILIES 3a proposal (#451); the kinds are cited from BESTIARY_LANDS (#432), HUNTING 8, BESTIARY 1, HUNT_FAMILIES 4 and CREATURE_BEHAVIOUR 3 and 5.1.6 (#451). Nothing here is content.');
  L.push('');
  L.push('## 1. The tool ladder');
  L.push('');
  L.push('A tool smaller than the animal takes it at grade minus 1, floor 1 (HUNTING 5), except the thrown stone, whose row in HUNTING 5 takes small prey only; an arrow larger than the animal is minus 1 too (HUNT_FAMILIES 9a). Rows that take nothing (a drive, an aid, a companion) shape a take and are never the lowest tool.');
  L.push('');
  L.push(
    ...table(
      ['Tier', 'Tool', 'Status', 'Use', 'Takes', 'Families', 'Range', 'Unaware', 'Passive', 'Noise', 'Craft tier (level)', 'Station', 'Inputs', 'Source'],
      byRung(tools).map((t) => [
        t.tier,
        t.tool,
        t.status,
        t.use,
        t.use === 'take' ? `${t.sizes.join(', ')} (${t.ways.join(', ')})` : '-',
        t.families ? t.families.map(fam).join(', ') : 'all',
        t.range === null ? '-' : t.range === 0 ? 'its tile' : t.range,
        t.unaware ? 'yes' : 'no',
        t.passive ? 'yes' : 'no',
        t.noise ?? '-',
        t.craftTier === null ? '-' : `${t.craftTier} (${t.level ?? '-'})`,
        t.station ?? '-',
        Object.entries(t.inputs).map(([i, q]) => `${i} ${q}`).join(', ') || '-',
        t.source,
      ]),
    ),
  );
  L.push('');
  L.push('## 2. Value per catch');
  L.push('');
  L.push(`V = w * (take_s * 1000 + dress) / 1000 + bonus, w = effort_permille [${p.effort_permille.join(', ')}] at the hunt's effort step (tier 1 medium, tier 2 craft, tier 3 and above hard); dress = 6, 12 or 24 steps of ${p.dress_step_ms} ms; a shop pays ${p.k_permille} * ${p.r_mg_per_value_ms} * V / 1000 mg. Computed by the solver itself (activitiesOf, computeValues).`);
  L.push('');
  L.push(
    ...table(
      ['Kind', 'Family', 'Size', 'Tier', 'take_s', 'Dress ms', 'Loop s', 'w', 'Bonus ms', 'V per catch', 'V per second', 'payFor mg', 'Per good V (qty)'],
      rows.map((r) => [
        r.name,
        fam(r.family),
        r.size,
        r.tier,
        r.take_s,
        r.dress_ms,
        fmtRatio(r.loop_ms, 1000),
        r.w,
        r.bonus_ms,
        r.value,
        r.value_per_s,
        r.pay_mg,
        r.goods.map((g) => `${g.item} ${g.value} (${g.qty})`).join(', '),
      ]),
    ),
  );
  L.push('');
  L.push('Value per second depends only on the tier: a longer take or a higher rung scales the value of a catch, never its rate (HUNT_FAMILIES 4, harder never by richer drops).');
  L.push('');
  L.push('## 3. Difficulty and rarity');
  L.push('');
  L.push(`Notice per gait = noise (still ${p.noise.still}, sneak ${p.noise.sneak}, walk ${p.noise.walk}, run ${p.noise.run}) + ear, the ear as each source writes it (HUNTING 8, BESTIARY 1 and HUNT_FAMILIES 4 for the valley, BESTIARY_LANDS for the other lands; the scales disagree, HUNT_FAMILIES 1 and 9). Standing = cap * habitat tiles / 1000, at least 1, the habitat tiles counted on content/core/map.json at every run: every tile whose tag is the kind's, solid ones included, as CREATURE_BEHAVIOUR 3 counts them (a trout's water is all solid). Rarity rank by cap / refill: ${p.rarity_rank_cuts[0]} or more 0, ${p.rarity_rank_cuts[1]} or more 1, ${p.rarity_rank_cuts[2]} or more 2, else 3 (proposed). The lowest tool is before the fight (G35): no strike on a defender or a hunter, a trap allowed.`);
  L.push('');
  L.push(
    ...table(
      ['Kind', 'Danger', 'Sight', 'Ear', 'Notice still/sneak/walk/run', 'Lowest tool (grade shift)', 'At grade 0', 'take_s', 'Cap per 1000 / refill d', 'Standing (valley)', 'Daily yield', 'Rarity rank', 'Group S/P/Sm/L'],
      rows.map((r) => [
        r.name,
        r.danger,
        r.sight,
        signed(r.ear),
        r.notice.join('/'),
        r.lowest ? `${r.lowest.tier} ${ladder.tools.find((t) => t.id === r.lowest!.tool)!.tool} (${shiftText(r.lowest.shift)})` : r.afterFight ? `none until the fight; then ${r.afterFight.tier} ${ladder.tools.find((t) => t.id === r.afterFight!.tool)!.tool} (${shiftText(r.afterFight.shift)})` : 'none; only the fight',
        r.grade0 ? `${r.grade0.tier} ${ladder.tools.find((t) => t.id === r.grade0!.tool)!.tool}` : '-',
        r.take_s,
        `${r.cap_per_1000} / ${r.refill_d}`,
        r.standing === null ? '(no valley tile count)' : r.standing,
        r.daily.per1000 ? `${fmtRatio(r.daily.num, r.daily.den)} per 1000 a day` : fmtRatio(r.daily.num, r.daily.den),
        r.rarity_rank,
        r.group.join('/'),
      ]),
    ),
  );
  L.push('');
  L.push('## 4. The tiers');
  L.push('');
  L.push(`Tier min level and craft chance from content/core/params.json (tier_min_level, craft_chance_bp, craft_level_step_bp ${p.craft_level_step_bp}); the chance is a recipe at its tier's lowest level, made at levels 1 to ${tiers[0]?.chance_bp.length ?? 0}, before luck (kernel/src/step.ts craftChanceBp). Value per second is the hunt's w at that tier; pay per active second is what a shop pays for it.`);
  L.push('');
  const levels = tiers[0]?.chance_bp.length ?? 0;
  L.push(
    ...table(
      ['Tier', 'Min level', ...Array.from({ length: levels }, (_, i) => `Chance at L${i + 1}`), 'V per second', 'Pay mg per active second', 'Ladder rows of this craft tier'],
      tiers.map((t) => [t.tier, t.min_level, ...t.chance_bp.map(pctText), t.w, t.pay_per_s_mg, t.tools.join(', ') || '-']),
    ),
  );
  L.push('');
  L.push('## 5. The ladder\'s gaps');
  L.push('');
  L.push('Each tool\'s inputs come from rungs at or below it (a good of the hunt is first had at the lowest rung that takes a kind dropping it); each family needs a rung that takes one of its kinds at grade 0 before the fight.');
  L.push('');
  if (gaps.length === 0) L.push('None.');
  else L.push(...table(['Kind of gap', 'Row', 'Detail'], gaps.map((g) => [g.what, g.what === 'family' ? fam(g.id) : g.id, g.detail])));
  L.push('');
  L.push('## 6. The pay cap in value units (HUNTING 9)');
  L.push('');
  const hare = cap.find((c) => c.id === 'hare');
  L.push(
    `HUNTING 9 caps a hunt at combat.pay_per_s_mg (${p.pay_per_s_mg} mg) for each second of its loop. A shop pays ${idiv(p.k_permille * p.r_mg_per_value_ms, 1000)} mg for each value-ms, so one second at w = ${p.effort_permille[1]} is ${payFor(p.solver, p.effort_permille[1]!)} mg: the param as written is about ${idiv(payFor(p.solver, p.effort_permille[1]!), p.pay_per_s_mg)} times too small to be a cap on payFor${hare ? ` (the hare: cap ${hare.capMg} mg, payFor ${hare.payMg} mg)` : ''}. The proposed check is in value units: value per active second, the rarity bonus included, never above effort_permille[hard] = ${cap[0]?.cap ?? p.effort_permille[3]}. Without the bonus the rate is the tier's w, at most the hard tier's by construction, so only a rarity bonus can pass the cap; whether a bonus counts toward it is the owner's call.`,
  );
  L.push('');
  L.push(...table(['Kind', 'V per second', 'With the rarity bonus', 'Cap', 'Holds', 'HUNTING 9 cap mg', 'payFor mg', 'Times over'], cap.map((c) => [ladder.kinds.find((k) => k.id === c.id)!.name, c.base, c.withBonus, c.cap, c.ok ? 'yes' : 'no', c.capMg, c.payMg, c.times])));
  L.push('');
  L.push('## 7. The experience curve against the typed tables');
  L.push('');
  const profs = [...new Set(xp.map((x) => x.profession))];
  const maxLevel = Math.max(0, ...xp.map((x) => x.level));
  L.push('Each profession\'s `xp_levels` (active seconds to reach the level) against the one curve of curve.ts (t1 and ratio from params.balance and params.difficulty). A cell is the typed seconds and, in brackets, the typed over the curve in percent. A report, not a check row; the regenerated table, one threshold for each level up to the twenty a profession keeps (GROWTH 3.6), is tools/src/balance/xp-proposed.json.');
  L.push('');
  const rowsXp: (string | number)[][] = [];
  for (let level = 2; level <= maxLevel; level++) {
    const curve = xp.find((x) => x.level === level)!.curve_ms;
    rowsXp.push([level, fmtRatio(curve, 1000), ...profs.map((pr) => {
      const x = xp.find((y) => y.profession === pr && y.level === level);
      return x ? `${idiv(x.typed_ms, 1000)} (${idiv(x.ratio_permille, 10)}%)` : '-';
    })]);
  }
  L.push(...table(['Level', 'Curve s', ...profs], rowsXp));
  L.push('');
  return `${L.join('\n')}\n`;
}

/** Everything the CLI prints and writes, from the ladder, the content's params and professions, and the curve's rules. */
export function buildReport(ladder: Ladder, params: Params, professions: Record<string, number[]>, curve: { t1Ms: number; ratioPermille: number }): Report {
  const p = huntParams(params, ladder);
  return {
    ladder,
    params: p,
    rows: difficultyMatrix(ladder.kinds, ladder.tools, p),
    tiers: tierTable(p, ladder.tools),
    gaps: ladderGaps(ladder),
    cap: payCap(ladder.kinds, p),
    xp: xpAudit(professions, curve.t1Ms, curve.ratioPermille),
  };
}

export const LADDER_FILE = fileURLToPath(new URL('./hunt-ladder.json', import.meta.url));
export const MARKDOWN_FILE = fileURLToPath(new URL('../../../docs/design/HUNT_LADDER.md', import.meta.url));
export const XP_FILE = fileURLToPath(new URL('./xp-proposed.json', import.meta.url));

export function readLadder(file = LADDER_FILE): Ladder {
  return loadLadder(JSON.parse(readFileSync(file, 'utf8')));
}

/** CREATURE_BEHAVIOUR 3: the map's tiles of each ground tag, solid ones counted. */
export function tagTiles(map: Bundle['map']): Record<string, number> {
  const out: Record<string, number> = {};
  for (const row of map.ground) {
    for (const ch of row) {
      const tag = map.legend[ch]?.tag;
      if (tag !== undefined) out[tag] = (out[tag] ?? 0) + 1;
    }
  }
  return out;
}

/** The ladder with each kind's habitat tiles counted on the map, so a change of the map moves the standing and the yield. */
export function onMap(ladder: Ladder, map: Bundle['map']): Ladder {
  const tiles = tagTiles(map);
  return { ...ladder, kinds: ladder.kinds.map((k) => ({ ...k, habitat_tiles: k.habitat_tag === null ? null : (tiles[k.habitat_tag] ?? 0) })) };
}

/** The page and the proposed experience table, as the CLI writes them; the habitat is counted on the bundle's map. */
export function ladderOutputs(bundle: Bundle, rules: Rules, raw = readLadder()): { report: Report; markdown: string; xpJson: string } {
  const ladder = onMap(raw, bundle.map);
  const professions: Record<string, number[]> = {};
  for (const id of Object.keys(bundle.professions).sort()) professions[id] = [...bundle.professions[id]!.xp_levels];
  const report = buildReport(ladder, bundle.params, professions, { t1Ms: rules.t1Ms, ratioPermille: rules.ratioPermille });
  const { rows, xp, ...more } = report;
  const markdown = renderMarkdown(rows, ladder.tools, xp, more);
  const steps = ladder.params.profession_levels - 1;
  const xpJson = `${JSON.stringify(xpProposal(professions, rules.t1Ms, rules.ratioPermille, steps), null, 2)}\n`;
  return { report, markdown, xpJson };
}
