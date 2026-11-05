/**
 * The weapon matrix report (docs/design/WEAPON_MATRIX.md): expands the source
 * (weapon-matrix.json: a form by tier into hands, parts and ammunition), prices
 * each block from WEAPONS 4's (#609) cell line and reads its hit at the built
 * `bare_base` (a restatement until the kernel's own hand function lands with
 * combat, G35), runs the checks of WEAPON_MATRIX 13, counts, and prints the
 * page's tables. Pure: the built values (bare_base, the swing ticks, the bare
 * wind-up, the power caps, the bands) come from the bundle the caller loads,
 * never from the source's copy of them; WM-BUILT holds the copy equal.
 *
 * Integer arithmetic only (idiv is floor division), so the print is the same
 * on every machine; nothing here is content, and nothing is written to content
 * before combat.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { type Bundle, idiv, idivUp } from '@game/kernel';
import type { ParamsBody } from '@game/schema';
import { REPO_ROOT } from '../load';

export const WEAPON_SOURCE_FILE = fileURLToPath(new URL('./weapon-matrix.json', import.meta.url));
export const WEAPON_PAGE_FILE = fileURLToPath(new URL('../../../docs/design/WEAPON_MATRIX.md', import.meta.url));
/** The raw params file: WM-BUILT reads the anchored line's text, which the bundle no longer carries. */
export const PARAMS_FILE = join(REPO_ROOT, 'content', 'core', 'params.json');

export const VARIANTS = ['default', 'stop-at-9', 'no-crossbows', 'rate-10-3000', 'all-to-10', 'freeze-at-5'] as const;
export type Variant = (typeof VARIANTS)[number];
export const isVariant = (s: string): s is Variant => (VARIANTS as readonly string[]).includes(s);

export const TEMPOS = ['quick', 'standard', 'heavy'] as const;
export type Tempo = (typeof TEMPOS)[number];
/** The close classes: the rest are ranged (the thrown class, bows and slings). */
export const CLOSE: ReadonlySet<string> = new Set(['blade', 'blunt', 'spear', 'staff']);
/** A profession's station kind (WEAPON_MATRIX 3): the Smithing rows at the forge, every other at a workshop. */
export const STATION: Readonly<Record<string, string>> = { handcraft: 'workshop', woodcraft: 'workshop', leatherwork: 'workshop', smithing: 'forge' };
const WORD = /^[a-z0-9_-]+$/;

// ---------------------------------------------------------------------------
// The source's shape

export interface BuiltParam {
  value: number | number[];
  min?: number;
  max?: number;
  at: string;
}

interface SpecBase {
  tiers: [number, number];
  step: number;
  teach: string;
  make: [string, string];
  line?: string;
  mat?: Record<string, string>;
  ids?: Record<string, string>;
  early?: Record<string, string[]>;
  late?: string[];
  sold?: boolean;
  skeleton_exception?: Record<string, string>;
}

export interface FormSpec extends SpecBase {
  form: string;
  class: string;
  tempo: Tempo;
  feel: string;
  noise: string;
  reach?: number;
  range?: number;
  ammo?: string;
  dual?: number;
  all_to_10?: { about: string; make?: [string, string]; late?: string[]; mat?: Record<string, string>; early?: Record<string, string[]> };
}

export interface PartSpec extends SpecBase {
  part: string;
  source?: string;
}

export interface AmmoSpec extends SpecBase {
  ammo: string;
  class: string;
  head: string;
  shots: number;
  range_add?: number;
}

export type RowSpec = FormSpec | PartSpec | AmmoSpec;

export interface WeaponSource {
  about: string;
  status: string;
  params: {
    built: Record<string, BuiltParam>;
    weapons: { hand_offset: number; hand_rate_max_permille: number[]; range_rate_permille: number; dual_use_max: number };
    matrix: {
      hand_rate_max_permille_tier_10: { value: number; at: string };
      power_cap_permille_level_15: { value: number; at: string };
      clamp: { priced: boolean; cap_exception: number[]; at: string };
      hit_reading: { base: string; sensitivity: number[]; at: string };
      hit_ties_open: { about: string; pairs: [number, string, string][] };
      anchors: {
        about: string;
        bands_bare: Record<string, [number, number]>;
        band_health: Record<string, [number, number]>;
        hands: Record<string, [number, number]>;
        weapons_4_states: Record<string, number>;
        top_health: Record<string, Record<string, [number, number]>>;
      };
      tier_min_level: number[];
      level_top: number;
      feels: Record<Tempo, Record<string, number>>;
      noise: Record<string, number>;
      price: { feel: Record<string, number>; noise: Record<string, number>; reach_2: number; range_per_step: number };
      share_floor: number;
      counts_target: { tiers_1_3: [number, number]; tiers_4_10: [number, number] };
      skeleton_max_swap: number;
      try_inputs: { min: number; max: number; at: string };
    };
  };
  classes: Record<string, { close: boolean; reach?: number[]; ranges?: number[]; tempos: Tempo[]; ammo?: string[]; first: number }>;
  ammo_classes: Record<string, { for: string; key: Tempo; heads: string[] }>;
  professions: Record<string, { entry_tier: number; station: string; top_today: number | null }>;
  stations: Record<string, { camp_tiers: [number, number] | null; past_camp: string }>;
  /** id without the `core/` prefix: [tier, where it stands] */
  items: Record<string, [number, string]>;
  lines: Record<string, Record<string, string>>;
  line_items: Record<string, string>;
  forms: FormSpec[];
  parts: PartSpec[];
  ammo: AmmoSpec[];
  teachers: Record<string, { tiers: [number, number]; max: number; what: string }>;
  shops: { sold_tier_max: number; at: string };
  first_slice: { about: string; rows: Record<string, [string[], number, number]> };
}

// ---------------------------------------------------------------------------
// What the content holds (read from the bundle, never from the source)

export interface BuiltRecipe {
  id: string;
  station: string;
  level: number;
  known: string;
  inputs: Map<string, number>;
  outputs: string[];
}

export interface Built {
  /** the core's item tiers by id without the `core/` prefix (an extension's ids live in their own space and are no weapon input) */
  items: Map<string, number>;
  /** the core's own recipes (a template's expansions are not files, and an extension's recipes are not the core's) */
  recipes: BuiltRecipe[];
  /** a profession's top level: xp_levels + 1 */
  tops: Map<string, number>;
  /** the params file's body as written: `{value, min, max}` wrappers and bare values */
  params: ParamsBody;
  /** the params file's lines, for the anchors of WM-BUILT */
  lines: string[];
}

const shortId = (id: string): string => id.slice(id.indexOf('/') + 1);
const isCore = (id: string): boolean => id.startsWith('core/');

export function builtFromWorld(bundle: Bundle, params: ParamsBody, paramsText: string): Built {
  const items = new Map<string, number>();
  for (const [id, item] of Object.entries(bundle.items)) {
    if (isCore(id) && typeof item.tier === 'number') items.set(shortId(id), item.tier);
  }
  const recipes: BuiltRecipe[] = Object.values(bundle.recipes)
    .filter((r) => isCore(r.id) && r.template === undefined)
    .sort((a, b) => (a.id < b.id ? -1 : 1))
    .map((r) => ({
      id: shortId(r.id),
      station: r.station,
      level: r.level,
      known: r.known,
      inputs: new Map(r.inputs.map((s): [string, number] => [shortId(s.item), s.qty])),
      outputs: r.outputs.map((o) => shortId(o.item)),
    }));
  const tops = new Map<string, number>();
  for (const [id, p] of Object.entries(bundle.professions)) tops.set(shortId(id), p.xp_levels.length + 1);
  return { items, recipes, tops, params, lines: paramsText.split('\n') };
}

/** The first value under key `name` anywhere in a nested params object (lists are not entered), or undefined. */
export function findKey(x: unknown, name: string): unknown {
  if (typeof x !== 'object' || x === null || Array.isArray(x)) return undefined;
  const o = x as Record<string, unknown>;
  if (name in o) return o[name];
  for (const v of Object.values(o)) {
    const got = findKey(v, name);
    if (got !== undefined) return got;
  }
  return undefined;
}

const unwrap = (got: unknown): unknown => (typeof got === 'object' && got !== null && !Array.isArray(got) && 'value' in got ? (got as { value: unknown }).value : got);

// ---------------------------------------------------------------------------
// The expansion

export type Kind = 'hand' | 'part' | 'ammo';
/** (tempo, wind-up, reach, harm, range, ammunition class, noise): WEAPON_MATRIX 2's block. */
export type Block = [Tempo, number, number, number, number | null, string | null, number];
const blockKey = (b: Block): string => JSON.stringify(b);

export interface Row {
  id: string;
  kind: Kind;
  /** the family word: the form, part or ammunition row */
  row: string;
  tier: number;
  inputs: Map<string, number>;
  prof: string;
  station: string;
  level: number;
  band: [number, number];
  known: string;
  src: RowSpec;
  /** an ammunition row's harm over the launcher's own (the head); 0 elsewhere */
  harm_add: number;
}

export interface Hand extends Row {
  kind: 'hand';
  form: FormSpec;
  cls: string;
  cell: number;
  price: number;
  priced: number;
  harm: number;
  pair: number;
  windup: number;
  block: Block;
}

export interface AmmoRow extends Row {
  kind: 'ammo';
  spec: AmmoSpec;
}

export const isHand = (r: Row): r is Hand => r.kind === 'hand';
export const isAmmo = (r: Row): r is AmmoRow => r.kind === 'ammo';

export interface Ctx {
  src: WeaponSource;
  variant: Variant;
  built: Built;
  topTier: number;
  values: Map<string, unknown>;
}

export function makeCtx(src: WeaponSource, variant: Variant, built: Built): Ctx {
  return { src, variant, built, topTier: variant === 'stop-at-9' ? 9 : 10, values: new Map() };
}

function must<T>(v: T | undefined, what: string): T {
  if (v === undefined) throw new Error(`weapon matrix: ${what}`);
  return v;
}

/** A built value of the content under `name` (the bundle's params), unwrapped. */
export function builtRaw(ctx: Ctx, name: string): unknown {
  if (!ctx.values.has(name)) ctx.values.set(name, unwrap(findKey(ctx.built.params, name)));
  return ctx.values.get(name);
}

export function builtValue(ctx: Ctx, name: string): number {
  const v = builtRaw(ctx, name);
  if (typeof v !== 'number') throw new Error(`weapon matrix: content/core/params.json has no number ${name}`);
  return v;
}

export function builtList(ctx: Ctx, name: string): number[] {
  const v = builtRaw(ctx, name);
  if (!Array.isArray(v) || !v.every((n) => typeof n === 'number')) throw new Error(`weapon matrix: content/core/params.json has no list ${name}`);
  return v as number[];
}

/** WEAPONS 4's hand rate at tier `t`, per mille of the bare hand (the tenth tier is the matrix's proposal). */
export function rateAt(ctx: Ctx, tier: number): number {
  const t = ctx.variant === 'freeze-at-5' ? Math.min(tier, 5) : tier;
  const r = ctx.src.params.weapons.hand_rate_max_permille;
  if (t <= r.length) return must(r[t - 1], `no rate at tier ${t}`);
  return ctx.variant === 'rate-10-3000' ? must(r[r.length - 1], 'an empty rate table') : ctx.src.params.matrix.hand_rate_max_permille_tier_10.value;
}

/** #598's built swing ticks: the matrix reads them, never proposes them. */
export const swingOf = (ctx: Ctx, tempo: Tempo): number => builtValue(ctx, `swing_${tempo}_t`);
export const bareBase = (ctx: Ctx): number => builtValue(ctx, 'bare_base');

/** WEAPONS 4: harmAt(share(r), t) with a floor of 0; a ranged hand reads the range share first. */
export function harmAt(ctx: Ctx, rate: number, tempo: Tempo, ranged: boolean): number {
  const W = ctx.src.params.weapons;
  const r = ranged ? idiv(rate * W.range_rate_permille, 1000) : rate;
  return Math.max(0, idiv(r * W.hand_offset * swingOf(ctx, tempo), 1000 * swingOf(ctx, 'quick')) - W.hand_offset);
}

export const cellAt = (ctx: Ctx, t: number, tempo: Tempo, ranged: boolean): number => harmAt(ctx, rateAt(ctx, t), tempo, ranged);

/** WEAPONS 4 (#609): hit = bare_base * (eff_harm + hand_offset) div hand_offset; kernel/src/fightmath.ts reads bare hands alone until combat lands. */
export function hitOf(ctx: Ctx, harm: number, bb: number = bareBase(ctx)): number {
  const off = ctx.src.params.weapons.hand_offset;
  return idiv(bb * (harm + off), off);
}

/** WEAPONS 4 as amended (WEAPON_MATRIX 2): eff_harm = min(pair, priced(clamp cell)); `priced` false reads WEAPONS 4 as written. */
export function effHarm(ctx: Ctx, h: Hand, clampRate: number, priced?: boolean): number {
  let c = harmAt(ctx, clampRate, h.block[0], !CLOSE.has(h.cls));
  if (priced ?? ctx.src.params.matrix.clamp.priced) c = idiv(c * (1000 - h.price), 1000);
  return Math.min(h.pair, c);
}

/** The price of a shape in per mille of the cell: feel, noise, the second reach step, the range steps. */
export function priceOf(ctx: Ctx, f: FormSpec): number {
  const pr = ctx.src.params.matrix.price;
  let p = must(pr.feel[f.feel], `no feel ${f.feel}`) + must(pr.noise[f.noise], `no noise ${f.noise}`);
  if ((f.reach ?? 1) === 2) p += pr.reach_2;
  if (f.range !== undefined) {
    const ranges = must(ctx.src.classes[f.class], `no class ${f.class}`).ranges ?? [];
    p += pr.range_per_step * idiv(f.range - Math.min(...ranges), 2);
  }
  return p;
}

/** The top shot of an ammunition class at tier `t`: the upper half of the class's key cell. */
export function topOf(ctx: Ctx, t: number, ammoClass: string): number {
  const k = cellAt(ctx, t, must(ctx.src.ammo_classes[ammoClass], `no ammunition class ${ammoClass}`).key, true);
  return k - idiv(k, 2);
}

export function harmAdd(ctx: Ctx, head: string, t: number, ammoClass: string): number {
  const top = topOf(ctx, t, ammoClass);
  if (head === 'barbed' || head === 'shaped') return top;
  if (head === 'broad') return idiv(top, 2);
  return 0;
}

/** The level band of tier `t` for a profession, by its entry tier (tier_min_level extended to tier 10; 21 past the table). */
export function bandOf(ctx: Ctx, t: number, prof: string): [number, number] {
  const i = t - must(ctx.src.professions[prof], `no profession ${prof}`).entry_tier + 1;
  const s = ctx.src.params.matrix.tier_min_level;
  const lo = i - 1 < s.length ? must(s[i - 1], 'band') : 21;
  const hi = (i < s.length ? must(s[i], 'band') : 21) - 1;
  return [lo, hi];
}

export function lineItem(ctx: Ctx, line: string, t: number): string {
  const mat = must(must(ctx.src.lines[line], `no line ${line}`)[String(t)], `line ${line} has no tier ${t}`);
  return must(ctx.src.line_items[line], `no line item ${line}`).replace('{m}', mat);
}

export function matName(ctx: Ctx, row: RowSpec, t: number): string {
  if (t <= 3) return must(row.mat?.[String(t)], `${rowName(row)}: no material at tier ${t}`);
  const line = must(row.line, `${rowName(row)}: no line`);
  return must(must(must(ctx.src.lines[line], `no line ${line}`)[String(t)], `line ${line} has no tier ${t}`).split('-')[0], 'material');
}

const rowName = (r: RowSpec): string => ('form' in r ? r.form : 'part' in r ? r.part : r.ammo);

/** "2 core/x" style input: the quantity before the id, 1 when absent. */
export function stack(s: string): { item: string; qty: number } {
  const i = s.indexOf(' ');
  if (i > 0 && /^[0-9]+$/.test(s.slice(0, i))) return { item: s.slice(i + 1), qty: Number(s.slice(0, i)) };
  return { item: s, qty: 1 };
}

/** The seven-field block of a form at tier `t`, with its price and cell. */
export function blockOf(ctx: Ctx, f: FormSpec, t: number): Pick<Hand, 'cls' | 'cell' | 'price' | 'priced' | 'harm' | 'pair' | 'windup' | 'block'> {
  const X = ctx.src.params.matrix;
  const ranged = !CLOSE.has(f.class);
  const cell = cellAt(ctx, t, f.tempo, ranged);
  const price = priceOf(ctx, f);
  const priced = idiv(cell * (1000 - price), 1000);
  const top = f.ammo !== undefined ? topOf(ctx, t, f.ammo) : 0;
  const harm = priced - top;
  const pair = harm + top;
  const windup = must(X.feels[f.tempo][f.feel], `no wind-up for ${f.tempo} ${f.feel}`);
  const block: Block = [f.tempo, windup, f.reach ?? 1, harm, f.range ?? null, f.ammo ?? null, must(X.noise[f.noise], `no noise ${f.noise}`)];
  return { cls: f.class, cell, price, priced, harm, pair, windup, block };
}

/** Every row of the variant: parts, then ammunition, then hands; each form over its tiers. */
export function expand(ctx: Ctx): Row[] {
  const { src, variant } = ctx;
  const out: Row[] = [];
  const partId = new Map<string, string>();
  let rows: [Kind, RowSpec][] = [
    ...src.parts.map((r): [Kind, RowSpec] => ['part', r]),
    ...src.ammo.map((r): [Kind, RowSpec] => ['ammo', r]),
    ...src.forms.map((r): [Kind, RowSpec] => ['hand', r]),
  ];
  if (variant === 'no-crossbows') {
    rows = rows.filter(([kind, r]) => !((kind === 'hand' && (r as FormSpec).ammo === 'bolt') || (kind === 'ammo' && (r as AmmoSpec).class === 'bolt')));
  }
  for (const [kind, given] of rows) {
    let r = given;
    const name = rowName(r);
    const [lo, hiGiven] = r.tiers;
    let hi = hiGiven;
    if (variant === 'all-to-10' && kind === 'hand') {
      hi = 10;
      const f = r as FormSpec;
      if (f.all_to_10) {
        const v = f.all_to_10;
        r = { ...f, make: v.make ?? f.make, late: v.late ?? f.late, mat: { ...f.mat, ...v.mat }, early: { ...f.early, ...v.early } };
      }
    }
    for (let t = lo; t <= Math.min(hi, ctx.topTier); t++) {
      const spec = must(t <= 3 ? r.early?.[String(t)] : r.late, `${name}: no inputs at tier ${t}`);
      const prof = t <= 3 ? r.make[0] : r.make[1];
      const rid = r.ids?.[String(t)] ?? `${matName(ctx, r, t)}-${name}`;
      const inputs = new Map<string, number>();
      for (const s of spec) {
        const { item: given, qty } = stack(s);
        let item = given;
        if (item.startsWith('@')) {
          const ref = item.slice(1);
          item = ref in src.lines ? lineItem(ctx, ref, t) : must(partId.get(`${ref}|${t}`), `${rid}: no part ${ref} at tier ${t}`);
        }
        inputs.set(item, (inputs.get(item) ?? 0) + qty);
      }
      const [bLo, bHi] = bandOf(ctx, t, prof);
      const base: Row = {
        id: rid,
        kind,
        row: name,
        tier: t,
        inputs,
        prof,
        station: must(STATION[prof], `no station for ${prof}`),
        level: Math.min(bHi, bLo + r.step),
        band: [bLo, bHi],
        known: t === lo ? r.teach : 'try',
        src: r,
        harm_add: 0,
      };
      if (kind === 'part') {
        partId.set(`${name}|${t}`, rid);
        out.push(base);
      } else if (kind === 'hand') {
        const f = r as FormSpec;
        const hand: Hand = { ...base, kind: 'hand', form: f, ...blockOf(ctx, f, t) };
        out.push(hand);
      } else {
        const a = r as AmmoSpec;
        const ammo: AmmoRow = { ...base, kind: 'ammo', spec: a, harm_add: harmAdd(ctx, a.head, t, a.class) };
        out.push(ammo);
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// The checks (WEAPON_MATRIX 13)

/** python-style text of a value, for the messages the page quotes: strings quoted, null as None, lists in brackets. */
export const pyAtom = (v: unknown): string =>
  v === null || v === undefined ? 'None' : typeof v === 'string' ? `'${v}'` : typeof v === 'boolean' ? (v ? 'True' : 'False') : Array.isArray(v) ? pyList(v) : String(v);
export const pyList = (xs: readonly unknown[]): string => `[${xs.map(pyAtom).join(', ')}]`;
export const pyTuple = (xs: readonly unknown[]): string => (xs.length === 1 ? `(${pyAtom(xs[0])},)` : `(${xs.map(pyAtom).join(', ')})`);

/** The try reads distinct ids only: quantities do not count (WEAPON_MATRIX 7). */
export const inputKey = (inputs: Map<string, number>): string => JSON.stringify([...inputs.keys()].sort());

export function byTierOf(hands: Hand[]): Map<number, Hand[]> {
  const m = new Map<number, Hand[]>();
  for (const h of hands) {
    const list = m.get(h.tier);
    if (list) list.push(h);
    else m.set(h.tier, [h]);
  }
  return m;
}

export type Pair = [number, string, string];

/**
 * Pairs (tier, a, b) inside one class, tier, tempo and ammunition class where a matches or beats b on every field:
 * f (harm, hit or eff_harm) higher or equal, wind-up shorter or equal, reach and range longer or equal, noise lower or
 * equal; two different blocks.
 */
export function dominated(byTier: Map<number, Hand[]>, f: (h: Hand) => number): Pair[] {
  const out: Pair[] = [];
  for (const t of [...byTier.keys()].sort((a, b) => a - b)) {
    const grp = new Map<string, Hand[]>();
    for (const h of must(byTier.get(t), 'tier')) {
      const k = JSON.stringify([h.cls, h.block[0], h.block[5]]);
      const g = grp.get(k);
      if (g) g.push(h);
      else grp.set(k, [h]);
    }
    for (const g of grp.values()) {
      for (const a of g) {
        for (const b of g) {
          if (a === b) continue;
          const A = a.block;
          const B = b.block;
          if (blockKey(A) !== blockKey(B) && f(a) >= f(b) && A[1] <= B[1] && A[2] >= B[2] && (A[4] ?? 0) >= (B[4] ?? 0) && A[6] <= B[6]) {
            out.push([t, a.id, b.id]);
          }
        }
      }
    }
  }
  return out;
}

const pairKey = (p: Pair): string => JSON.stringify(p);
const pairOrder = (a: Pair, b: Pair): number => (a[0] !== b[0] ? a[0] - b[0] : a[1] !== b[1] ? (a[1] < b[1] ? -1 : 1) : a[2] < b[2] ? -1 : a[2] > b[2] ? 1 : 0);

export interface ClampSweep {
  soft: Map<number, number>;
  cap: Map<number, Map<number, number>>;
  caps: number[];
}

export interface HitAnchors {
  bare: number;
  health: Map<string, [number, number]>;
  handHits: Map<string, [number, number]>;
  /** keyed `${tier}|${hand set}` */
  topCounts: Map<string, [number, number]>;
}

export interface Notes {
  hitTies: number;
  taughtDups: string[];
  launcherPairs: number;
  builtRecipes: number;
  checksRun: string[];
  builtCompared: number;
}

export interface Checks {
  errors: string[];
  notes: Notes;
  clamp: ClampSweep;
  anchors: HitAnchors;
}

const HAND_SETS: [string, (h: Hand) => boolean][] = [
  ['t1_standard', (h) => h.tier === 1 && CLOSE.has(h.cls) && h.block[0] === 'standard'],
  ['t1_heavy', (h) => h.tier === 1 && CLOSE.has(h.cls) && h.block[0] === 'heavy'],
  ['t2_standard', (h) => h.tier === 2 && CLOSE.has(h.cls) && h.block[0] === 'standard'],
  ['t3_standard', (h) => h.tier === 3 && CLOSE.has(h.cls) && h.block[0] === 'standard'],
  ['t3_bow_top_shot', (h) => h.tier === 3 && h.row === 'bow'],
];

const bump = (m: Map<number, number>, k: number): void => {
  m.set(k, (m.get(k) ?? 0) + 1);
};

export function runChecks(ctx: Ctx, recs: Row[]): Checks {
  const { src: m, built } = ctx;
  const X = m.params.matrix;
  const W = m.params.weapons;
  const errors: string[] = [];
  const tier = new Map<string, number>();
  for (const [k, v] of Object.entries(m.items)) tier.set(k, v[0]);
  for (const [k, v] of built.items) if (!tier.has(k)) tier.set(k, v);
  for (const r of recs) tier.set(r.id, r.tier);
  const hands = recs.filter(isHand);
  const byTier = byTierOf(hands);

  for (const r of recs) {
    const f = r.src;
    const t = r.tier;
    const rid = r.id;
    if (!WORD.test(rid) || r.row.length > 24) errors.push(`${rid}: id or family word out of pattern (schema/src/index.ts:18, :117)`);
    const missing = [...r.inputs.keys()].filter((i) => !tier.has(i));
    if (missing.length > 0) {
      errors.push(`${rid}: unknown inputs ${pyList(missing)}`);
      continue;
    }
    const topIn = Math.max(...[...r.inputs.keys()].map((i) => must(tier.get(i), i)));
    if (t > topIn + 1) errors.push(`${rid}: tier ${t} from a highest input of tier ${topIn} (climb, tools/src/check.ts:421)`);
    const [lo, hi] = r.band;
    if (!(lo <= r.level && r.level <= hi) || r.level > X.level_top) errors.push(`${rid}: level ${r.level} outside band ${lo}-${hi}`);
    const handTop = built.tops.get('handcraft');
    if (r.prof === 'handcraft' && handTop !== undefined && handTop > 0 && r.level > handTop) errors.push(`${rid}: Handcraft stops at level ${handTop} (tools/src/check.ts:429)`);
    const bars = [...r.inputs.keys()].filter((i) => i.endsWith('-bar'));
    if (bars.length > 0 && r.prof !== 'smithing') errors.push(`${rid}: takes metal ${pyList(bars)} outside Smithing`);
    if (t >= 4 && isHand(r) && ['bow', 'staff', 'spear'].includes(r.cls) && r.prof !== 'woodcraft') errors.push(`${rid}: a bow, staff or spear past tier 3 is Woodcraft's`);
    if (isHand(r)) {
      const blk = r.block;
      if (1000 - r.price < X.share_floor) errors.push(`${rid}: price ${r.price} under the share floor`);
      const inBounds = 2 <= blk[1] && blk[1] <= 10 && 1 <= blk[2] && blk[2] <= 2 && 0 <= blk[3] && blk[3] <= 1000 && 0 <= blk[6] && blk[6] <= 12;
      if (!inBounds || (blk[4] !== null && !(2 <= blk[4] && blk[4] <= 12))) errors.push(`${rid}: block ${pyTuple(blk)} out of the field bounds`);
      // WM-GRID: a form's wind-up is never under the bare hand's (#598's bare_windup_t) and ends before its tempo's swing
      const bw = builtValue(ctx, 'bare_windup_t');
      if (!(bw <= blk[1] && blk[1] < swingOf(ctx, blk[0]))) errors.push(`${rid}: wind-up ${blk[1]} outside bare_windup_t ${bw} to swing_${blk[0]}_t ${swingOf(ctx, blk[0])}`);
      if (r.harm > r.cell) errors.push(`${rid}: harm ${r.harm} over its cell ${r.cell}`);
      if (r.harm < 0) errors.push(`${rid}: launcher harm below 0`);
      if (CLOSE.has(r.cls)) {
        const sw = swingOf(ctx, r.form.tempo);
        if (idiv((r.harm + W.hand_offset) * (1000 * swingOf(ctx, 'quick')), W.hand_offset * sw) < 1000) errors.push(`${rid}: close rate under the bare hand`);
      }
    }
    if (f.sold && t === f.tiers[0] && t > m.shops.sold_tier_max) errors.push(`${rid}: sold at tier ${t}`);
    if (r.known === 'start' && t !== 1) errors.push(`${rid}: start-known above tier 1`);
  }

  // WM-BLOCK: one block per tier, across classes; no dominance inside (class, tier, tempo, ammo), read in hits at the
  // built bare_base (a launcher with its own tier's top shot); the measured ties are listed in the source
  // (hit_ties_open) and any other pair fails
  for (const [t, hs] of byTier) {
    const seen = new Map<string, string>();
    for (const h of hs) {
      const k = blockKey(h.block);
      const other = seen.get(k);
      if (other !== undefined) errors.push(`tier ${t}: ${h.id} and ${other} share a block`);
      seen.set(k, h.id);
    }
  }
  const bb = bareBase(ctx);
  const ties = dominated(byTier, (h) => hitOf(ctx, h.pair, bb));
  const tieKeys = new Set(ties.map(pairKey));
  const listed = X.hit_ties_open.pairs;
  const listedKeys = new Set(listed.map(pairKey));
  const ids = new Set(hands.map((h) => h.id));
  for (const p of ties) {
    if (!listedKeys.has(pairKey(p))) errors.push(`WM-BLOCK: tier ${p[0]}: ${p[1]} matches or beats ${p[2]} in hits at bare_base ${bb} (not listed in hit_ties_open)`);
  }
  for (const p of listed.filter((q) => !tieKeys.has(pairKey(q))).sort(pairOrder)) {
    if (ctx.variant === 'default' && ids.has(p[1]) && ids.has(p[2])) errors.push(`WM-BLOCK: hit_ties_open lists tier ${p[0]} ${p[1]} over ${p[2]}, which no longer ties: drop it`);
  }
  const hitTies = ties.length;
  for (const p of dominated(byTier, (h) => h.pair)) errors.push(`WM-BLOCK: tier ${p[0]}: ${p[1]} matches or beats ${p[2]} in harm`);

  // WM-CLAMP: the dominance test on eff_harm under the soft requirement (own tier 1 to t-2) and under every power cap
  // entry (and the level-15 option); only caps 1000 and 1100 may leave pairs
  const caps = [...builtList(ctx, 'power_cap_permille'), X.power_cap_permille_level_15.value];
  const exc = new Set(X.clamp.cap_exception);
  const clamp: ClampSweep = { soft: new Map(), cap: new Map(), caps };
  for (const [t, hs] of byTier) {
    const single = new Map([[t, hs]]);
    for (let own = 1; own < t - 1; own++) {
      const r = rateAt(ctx, own + 1);
      for (const p of dominated(single, (h) => effHarm(ctx, h, r))) {
        bump(clamp.soft, t);
        errors.push(`WM-CLAMP: tier ${t}, own tier ${own}: ${p[1]} matches or beats ${p[2]} after the clamp`);
      }
    }
    for (const cap of caps) {
      for (const p of dominated(single, (h) => effHarm(ctx, h, cap))) {
        let byCap = clamp.cap.get(cap);
        if (!byCap) {
          byCap = new Map();
          clamp.cap.set(cap, byCap);
        }
        bump(byCap, t);
        if (!exc.has(cap)) errors.push(`WM-CLAMP: tier ${t}, power cap ${cap}: ${p[1]} matches or beats ${p[2]} after the clamp`);
      }
    }
  }

  // WM-HITS: #598's bands in bare-hand hits (FIGHT_TIER_HITS; hitsToFell) at the built bare_base, and what the matrix
  // adds over them: the hits of its own blocks at full harm, and each band's top health counted against them. A hand
  // shortens the count and never replaces the reading: the starter hand is bare hands (decision 42), not a matrix row.
  const A = X.anchors;
  const bare = hitOf(ctx, 0, bb);
  if (bare !== bb) errors.push(`WM-HITS: bare hands hit ${bare}, not bare_base ${bb}`);
  const health = new Map<string, [number, number]>();
  for (const [tierS, [lo, hi]] of Object.entries(A.bands_bare)) {
    const hLo = (lo - 1) * bb + 1;
    const hHi = hi * bb;
    health.set(tierS, [hLo, hHi]);
    const stated = must(A.band_health[tierS], `band_health ${tierS}`);
    if (stated[0] !== hLo || stated[1] !== hHi || idivUp(hLo, bb) !== lo || idivUp(hHi, bb) !== hi) {
      errors.push(`WM-HITS: T${tierS} band ${lo} to ${hi} bare-hand hits is ${hLo} to ${hHi} health at bare_base ${bb}, not ${pyList(stated)}`);
    }
  }
  const handHits = new Map<string, [number, number]>();
  for (const [k, pred] of HAND_SETS) {
    const v = [...new Set(hands.filter(pred).map((h) => hitOf(ctx, h.pair, bb)))].sort((a, b) => a - b);
    const first = v[0];
    const last = v[v.length - 1];
    if (first === undefined || last === undefined) {
      errors.push(`WM-HITS: no hand for ${k}`);
      continue;
    }
    handHits.set(k, [first, last]);
    const stated = must(A.hands[k], `hands ${k}`);
    if (stated[0] !== first || stated[1] !== last) errors.push(`WM-HITS: ${k} hits ${first} to ${last} from the matrix, the source says ${pyList(stated)}`);
    if (first < bare) errors.push(`WM-HITS: ${k} hits ${first}, under bare hands (${bare})`);
  }
  const topCounts = new Map<string, [number, number]>();
  for (const [tierS, sets] of Object.entries(A.top_health)) {
    const hHi = must(health.get(tierS), `health ${tierS}`)[1];
    for (const [k, stated] of Object.entries(sets)) {
      const hh = handHits.get(k);
      if (!hh) continue;
      const [loH, hiH] = hh;
      const got: [number, number] = [idivUp(hHi, hiH), idivUp(hHi, loH)];
      topCounts.set(`${tierS}|${k}`, got);
      if (got[0] !== stated[0] || got[1] !== stated[1]) errors.push(`WM-HITS: a ${hHi}-health T${tierS} foe takes ${pyList(got)} hits of ${k}, the source says ${pyList(stated)}`);
      const bareTop = must(A.bands_bare[tierS], `bands_bare ${tierS}`)[1];
      if (got[1] > bareTop) errors.push(`WM-HITS: a ${hHi}-health T${tierS} foe takes ${got[1]} hits of ${k}, more than the ${bareTop} of bare hands`);
    }
  }
  const anchors: HitAnchors = { bare, health, handHits, topCounts };

  // skeleton, teachers, reachability
  const rowsOf = new Map<string, Row[]>();
  for (const r of recs) {
    const k = `${r.kind}|${r.row}`;
    const list = rowsOf.get(k);
    if (list) list.push(r);
    else rowsOf.set(k, [r]);
  }
  const taught = new Map<string, [string, number][]>();
  for (const rs of rowsOf.values()) {
    rs.sort((a, b) => a.tier - b.tier);
    const entry = must(rs[0], 'row');
    const name = entry.row;
    const ents = taught.get(entry.known);
    if (ents) ents.push([name, entry.tier]);
    else taught.set(entry.known, [[name, entry.tier]]);
    for (let i = 1; i < rs.length; i++) {
      const a = must(rs[i - 1], 'row');
      const b = must(rs[i], 'row');
      const aIn = [...a.inputs.keys()];
      const bIn = [...b.inputs.keys()];
      const swap = Math.max(aIn.filter((x) => !b.inputs.has(x)).length, bIn.filter((x) => !a.inputs.has(x)).length);
      const exception = entry.src.skeleton_exception?.[String(b.tier)];
      if (swap > X.skeleton_max_swap && !exception) errors.push(`${b.id}: swaps ${swap} items from ${a.id} (skeleton)`);
      if (b.tier !== a.tier + 1) errors.push(`${name}: tier gap ${a.tier} to ${b.tier}`);
    }
  }
  for (const [k, ents] of taught) {
    if (k === 'start' || k === 'try') continue;
    const T = m.teachers[k];
    if (T === undefined) {
      errors.push(`teacher ${k} unknown`);
      continue;
    }
    if (ents.length > T.max) errors.push(`teacher ${k}: ${ents.length} entries, at most ${T.max}`);
    for (const [name, t] of ents) {
      if (!(T.tiers[0] <= t && t <= T.tiers[1])) errors.push(`teacher ${k}: ${name} enters at tier ${t}, outside ${pyList(T.tiers)}`);
    }
  }

  // WM-TRY-SIZE: a try takes 2 to 4 distinct items (WEAPON_MATRIX 7)
  const { min: loN, max: hiN } = X.try_inputs;
  for (const r of recs) {
    if (r.known === 'try' && !(loN <= r.inputs.size && r.inputs.size <= hiN)) errors.push(`WM-TRY-SIZE: ${r.id} has ${r.inputs.size} distinct inputs`);
  }
  // WM-TRY-SET: a try-found recipe's input set is unique at its station kind, across tiers and built recipes
  const sets = new Map<string, { station: string; ids: [string, string][] }>();
  const addSet = (station: string, inputs: Map<string, number>, id: string, known: string): void => {
    const k = JSON.stringify([station, inputKey(inputs)]);
    const s = sets.get(k);
    if (s) s.ids.push([id, known]);
    else sets.set(k, { station, ids: [[id, known]] });
  };
  for (const r of recs) addSet(r.station, r.inputs, r.id, r.known);
  for (const r of built.recipes) addSet(r.station, r.inputs, `${r.id} (built)`, r.known);
  const taughtDups: string[] = [];
  for (const { station, ids: members } of sets.values()) {
    if (members.length > 1) {
      if (members.some(([, k]) => k === 'try')) errors.push(`WM-TRY-SET: ${members.map(([i]) => i).join(', ')} share one input set at the ${station}`);
      else taughtDups.push(`${members.map(([i]) => i).join(' = ')} (${station})`);
    }
  }

  // ammunition
  const launchers = hands.filter((h) => h.form.ammo !== undefined);
  const ammo = recs.filter(isAmmo);
  for (const a of ammo) {
    const c = a.spec.class;
    if (!launchers.some((l) => l.form.ammo === c && l.tier >= a.tier)) errors.push(`${a.id}: no launcher of tier ${a.tier} or more fires it`);
  }
  let launcherPairs = 0;
  for (const l of launchers) {
    const c = must(l.form.ammo, 'launcher');
    const withTop = l.harm + topOf(ctx, l.tier, c);
    if (withTop !== l.priced) errors.push(`${l.id}: with its own tier's top shot the pair is ${withTop}, not its priced cell ${l.priced}`);
    const fires = ammo.filter((a) => a.spec.class === c && a.tier <= l.tier);
    if (fires.length === 0 && c !== 'sling-stone') errors.push(`${l.id}: nothing to fire`);
    for (const a of fires) {
      launcherPairs += 1;
      if (l.harm + a.harm_add > l.priced) errors.push(`${l.id} + ${a.id}: ${l.harm + a.harm_add} over ${l.priced}`);
      if ((l.block[4] ?? 0) + (a.spec.range_add ?? 0) > 12) errors.push(`${l.id} + ${a.id}: range over 12`);
    }
  }

  // duals
  const duals = m.forms.filter((f) => f.dual !== undefined).map((f): [string, number] => [f.form, f.dual ?? 0]);
  if (duals.length > W.dual_use_max || duals.some(([, t]) => t > 5)) errors.push(`duals [${duals.map((d) => pyTuple(d)).join(', ')}]: over dual_use_max or past tool.tier 5`);

  // Q-5 coverage: every tier gives every close tempo, a ranged hand, and wind-ups from 4 or less to 8 or more
  for (const t of [...byTier.keys()].sort((a, b) => a - b)) {
    const hs = must(byTier.get(t), 'tier');
    const tempos = new Set(hs.filter((h) => CLOSE.has(h.cls)).map((h) => h.block[0]));
    const ws = hs.map((h) => h.windup);
    const minW = Math.min(...ws);
    const maxW = Math.max(...ws);
    const all = tempos.size === 3 && TEMPOS.every((x) => tempos.has(x));
    if (!all || !hs.some((h) => !CLOSE.has(h.cls)) || minW > 4 || maxW < 8) {
      errors.push(`tier ${t}: Q-5 coverage fails (${pyList([...tempos].sort())}, wind-ups ${minW}-${maxW})`);
    }
  }

  // built recipes under the extended bands
  for (const r of built.recipes) {
    const t = Math.max(1, ...r.outputs.map((o) => built.items.get(o) ?? 1));
    const [lo, hi] = bandOf(ctx, t, 'handcraft');
    if (!(lo <= r.level && r.level <= hi)) errors.push(`built ${r.id}: tier ${t} level ${r.level} outside the extended band ${lo}-${hi}`);
  }
  const notes: Notes = {
    hitTies,
    taughtDups,
    launcherPairs,
    builtRecipes: built.recipes.length,
    checksRun: [
      'ids and family words (schema/src/index.ts:18, :117)',
      'inputs known',
      'one-tier climb (tools/src/check.ts:421)',
      'level in the band, by entry tier (check.ts:334, :423-424)',
      'Handcraft top (check.ts:429)',
      'metal only by Smithing',
      'bows, staves and spears past tier 3 by Woodcraft',
      'share floor',
      'block field bounds',
      "wind-up from bare_windup_t to under the tempo's swing (WM-GRID; #598's built values)",
      'harm under the cell',
      'launcher harm 0 or more',
      'close rate at or over the bare hand',
      'sold only at tier 1',
      'start only at tier 1',
      'one block per tier across classes',
      'no dominance in harm inside class, tier, tempo and ammunition',
      `no dominance in hits at bare_base ${bb} but the listed ties (WM-BLOCK)`,
      'WM-CLAMP: no dominance after the clamp, own tier 1 to t-2 and every power cap but 1000 and 1100',
      "WM-HITS: #598's bands in bare-hand hits hold at bare_base; the matrix's hands hit as the source states, never under bare hands; each band's top health falls in fewer hits of a hand than of bare hands",
      'skeleton swap',
      'no tier gap in a row',
      'teacher tiers and sizes',
      'WM-TRY-SIZE',
      'WM-TRY-SET against matrix and built recipes (sets)',
      'every ammunition has a launcher',
      'every launcher has a shot',
      'every pair under its priced cell',
      "every launcher with its own tier's top shot equals its priced cell",
      'range with range_add at most 12',
      'duals',
      'Q-5 coverage per tier',
      'built recipes in the extended bands',
      'WM-BUILT: every built value of the source equals content/core/params.json at its line',
      'WM-COUNT: counts in the direction, this variant',
    ],
    builtCompared: 0,
  };
  return { errors, notes, clamp, anchors };
}

/**
 * WM-BUILT: every `built` value of the source whose anchor is content/core/params.json equals the content's value
 * under that key (value, and min/max where the source carries them), and the anchored line names the key. Returns
 * how many were compared.
 */
export function checkBuilt(ctx: Ctx, errors: string[]): number {
  const { lines, params } = ctx.built;
  let n = 0;
  for (const [name, spec] of Object.entries(ctx.src.params.built)) {
    const at = spec.at;
    const mt = /^content\/core\/params\.json:(\d+)/.exec(at);
    if (!mt) continue;
    n += 1;
    const lineNo = Number(mt[1]);
    const line = lineNo <= lines.length ? must(lines[lineNo - 1], 'line') : '';
    if (!line.includes(`"${name}"`)) errors.push(`WM-BUILT: ${name}: ${at.split(' ')[0]} does not name it (the line reads: ${line.trim()})`);
    const got = findKey(params, name);
    if (got === undefined || got === null) {
      errors.push(`WM-BUILT: ${name}: not in content/core/params.json`);
      continue;
    }
    const value = unwrap(got);
    if (JSON.stringify(value) !== JSON.stringify(spec.value)) errors.push(`WM-BUILT: ${name}: the source says ${pyAtom(spec.value)}, content says ${pyAtom(value)}`);
    const wrapped = typeof got === 'object' && !Array.isArray(got) ? (got as Record<string, unknown>) : undefined;
    for (const bound of ['min', 'max'] as const) {
      if (spec[bound] !== undefined && wrapped && wrapped[bound] !== spec[bound]) errors.push(`WM-BUILT: ${name}: ${bound} ${spec[bound]} in the source, ${pyAtom(wrapped[bound])} in content`);
    }
  }
  return n;
}

// ---------------------------------------------------------------------------
// Counts and the verdict

export type Counts = Map<string, number>;
const bandOfTier = (t: number): string => (t <= 3 ? 'T1-3' : 'T4-10');

export function counts(rows: Row[]): Counts {
  const c: Counts = new Map();
  for (const r of rows) {
    const k = `${bandOfTier(r.tier)} ${r.kind}`;
    c.set(k, (c.get(k) ?? 0) + 1);
  }
  return c;
}

export function bandCounts(c: Counts): [number, number] {
  let lo3 = 0;
  let hi3 = 0;
  for (const [k, n] of c) {
    if (k.startsWith('T1-3 ')) lo3 += n;
    else hi3 += n;
  }
  return [lo3, hi3];
}

export function verdict(src: WeaponSource, lo3: number, hi3: number): string {
  const tgt = src.params.matrix.counts_target;
  const out: string[] = [];
  for (const [n, [a, b], band] of [
    [lo3, tgt.tiers_1_3, 'T1-3'],
    [hi3, tgt.tiers_4_10, 'T4-10'],
  ] as const) {
    if (n < a) out.push(`${band} under ${a}`);
    else if (n > b) out.push(`${band} over ${b}`);
  }
  return out.length === 0 ? 'in the direction' : `${out.join(', ')}: leaves the direction`;
}

export interface VariantLine {
  variant: Variant;
  lo3: number;
  hi3: number;
  verdict: string;
  extra: string;
  line: string;
}

/** One line of the variants block: the counts, WM-COUNT's verdict and what the variant repeats. */
export function variantLine(src: WeaponSource, built: Built, v: Variant): VariantLine {
  const vr = expand(makeCtx(src, v, built));
  const [lo3, hi3] = bandCounts(counts(vr));
  const vh = new Map<string, string>();
  for (const h of vr.filter(isHand)) vh.set(`${h.row}|${h.tier}`, blockKey(h.block));
  let extra = '';
  if (v === 'rate-10-3000') {
    let same = 0;
    for (const [k, b] of vh) {
      const [f, t] = k.split('|');
      if (t === '10' && vh.get(`${f}|9`) === b) same += 1;
    }
    extra = `; ${same} tier-10 hands repeat their tier-9 block`;
  }
  if (v === 'freeze-at-5') {
    const late6 = [...vh.keys()].filter((k) => Number(k.split('|')[1]) >= 6);
    let rep = 0;
    for (const k of late6) {
      const [f, tS] = k.split('|');
      const t = Number(tS);
      let found = false;
      for (let u = 1; u < t; u++) if (vh.get(`${f}|${u}`) === vh.get(k)) found = true;
      if (found) rep += 1;
    }
    extra = `; ${rep} of ${late6.length} tier 6-10 hands repeat an earlier tier's block of their form`;
  }
  const vd = verdict(src, lo3, hi3);
  return { variant: v, lo3, hi3, verdict: vd, extra, line: `${v}: ${lo3} / ${hi3} (${vd})${extra}` };
}

// ---------------------------------------------------------------------------
// The print

const padL = (v: number | string, w: number): string => String(v).padStart(w);
const padR = (v: number | string, w: number): string => String(v).padEnd(w);
const rng = (v: [number, number]): string => (v[0] === v[1] ? `${v[0]}` : `${v[0]} to ${v[1]}`);
const HAND_LABEL: [string, string][] = [
  ['t1_standard', 'T1 standard'],
  ['t1_heavy', 'T1 heavy'],
  ['t2_standard', 'T2 standard'],
  ['t3_standard', 'T3 standard'],
  ['t3_bow_top_shot', 'T3 bow, top shot'],
];

/** The first slice (WEAPONS 5.2, 5.4, 6.2) against the matrix: a line per row, and an error for a row the matrix lost. */
export function firstSlice(ctx: Ctx, recs: Row[]): { lines: string[]; errors: string[] } {
  const lines: string[] = [];
  const errors: string[] = [];
  const byId = new Map(recs.map((r) => [r.id, r]));
  for (const [wid, [inp, level, st]] of Object.entries(ctx.src.first_slice.rows)) {
    const r = byId.get(wid);
    if (r === undefined) {
      errors.push(`first slice ${wid}: no matrix row`);
      continue;
    }
    const old = new Map<string, number>();
    for (const s of inp) {
      const { item, qty } = stack(s);
      old.set(item, (old.get(item) ?? 0) + qty);
    }
    const moves: string[] = [];
    const same = old.size === r.inputs.size && [...old].every(([i, n]) => r.inputs.get(i) === n);
    if (!same) {
      const sorted = [...r.inputs].sort(([a], [b]) => (a < b ? -1 : 1));
      moves.push('inputs ' + sorted.map(([i, n]) => `${n} ${i}`).join(', '));
    }
    if (level !== r.level) moves.push(`level ${level} to ${r.level}`);
    if (st !== r.tier) moves.push(`station tier ${st} to ${r.tier}`);
    lines.push(`${wid}: ${r.kind} ${r.row} T${r.tier}, level ${r.level}, ${r.known}` + (moves.length > 0 ? ` | ${moves.join('; ')}` : ' | as written'));
  }
  return { lines, errors };
}

export function renderReport(ctx: Ctx, recs: Row[], checks: Checks, sliceLines: string[], variants: VariantLine[], tables: boolean): string {
  const { src: m } = ctx;
  const X = m.params.matrix;
  const out: string[] = [];
  const p = (s: string): void => {
    out.push(s);
  };
  const section = (title: string): void => {
    out.push('');
    out.push(title);
  };
  const tiers = Array.from({ length: ctx.topTier }, (_, i) => i + 1);
  const hands = recs.filter(isHand);
  const byTier = byTierOf(hands);
  const bb = bareBase(ctx);

  p(`== weapon matrix, variant ${ctx.variant} (every number proposed)`);
  section('-- cells (WEAPONS 4): close q/s/h | ranged q/s/h | top arrow,bolt / sling-stone');
  for (const t of tiers) {
    const cl = TEMPOS.map((x) => padL(cellAt(ctx, t, x, false), 3)).join(' ');
    const rg = TEMPOS.map((x) => padL(cellAt(ctx, t, x, true), 3)).join(' ');
    p(`T${padR(t, 2)} rate ${rateAt(ctx, t)}: ${cl} | ${rg} | ${padL(topOf(ctx, t, 'arrow'), 3)} / ${padL(topOf(ctx, t, 'sling-stone'), 3)}`);
  }

  const c = counts(recs);
  section('-- counts by tier band and kind');
  for (const band of ['T1-3', 'T4-10']) {
    const h = c.get(`${band} hand`) ?? 0;
    const pa = c.get(`${band} part`) ?? 0;
    const am = c.get(`${band} ammo`) ?? 0;
    p(`${band}: ${h} hands + ${pa} parts + ${am} ammunition = ${h + pa + am}`);
  }
  p(`all: ${recs.length} recipes, ${m.forms.length} forms, ${m.parts.length} part rows, ${m.ammo.length} ammunition rows`);

  section('-- hands by class and band');
  const classes = Object.keys(m.classes);
  p('band   ' + classes.map((k) => padL(k, 6)).join(' '));
  for (const [band, lo, hi] of [
    ['T1-3', 1, 3],
    ['T4-10', 4, 10],
  ] as const) {
    p(`${padR(band, 6)} ` + classes.map((k) => padL(hands.filter((h) => h.cls === k && lo <= h.tier && h.tier <= hi).length, 6)).join(' '));
  }

  section('-- by tier: hands, parts, ammunition; distinct blocks; distinct harms; near pairs (one field apart) by block and in hits');
  const hblock = (h: Hand): Block => {
    const b: Block = [...h.block];
    b[3] = hitOf(ctx, h.pair);
    return b;
  };
  const apart = (x: Block, y: Block): number => x.filter((v, i) => v !== y[i]).length;
  for (const t of tiers) {
    const hs = hands.filter((h) => h.tier === t);
    let near = 0;
    let nearH = 0;
    for (let i = 0; i < hs.length; i++) {
      for (let j = i + 1; j < hs.length; j++) {
        const x = must(hs[i], 'hand');
        const y = must(hs[j], 'hand');
        if (apart(x.block, y.block) === 1) near += 1;
        if (apart(hblock(x), hblock(y)) === 1) nearH += 1;
      }
    }
    const parts = recs.filter((r) => r.tier === t && r.kind === 'part').length;
    const ammo = recs.filter((r) => r.tier === t && r.kind === 'ammo').length;
    const blocks = new Set(hs.map((h) => blockKey(h.block))).size;
    const harms = new Set(hs.map((h) => h.harm)).size;
    p(`T${padR(t, 2)} ${padL(hs.length, 3)} ${padL(parts, 3)} ${padL(ammo, 3)} | blocks ${padL(blocks, 3)} harms ${padL(harms, 3)} near ${padL(near, 3)} near in hits ${padL(nearH, 3)}`);
  }

  const bbs = [...new Set([bb, ...X.hit_reading.sensitivity])].sort((a, b) => a - b);
  section(`-- WM-BLOCK in hits: pairs where a shape buys nothing in hits (same class, tier, tempo, ammunition), by bare_base (built ${bb}; its range's ends beside it)`);
  const tie = new Map<number, Map<number, number>>();
  for (const b of bbs) {
    const cnt = new Map<number, number>();
    for (const [t] of dominated(byTier, (h) => hitOf(ctx, h.pair, b))) bump(cnt, t);
    tie.set(b, cnt);
  }
  p('tier  ' + bbs.map((b) => `bb${padR(b, 3)}`).join(' '));
  for (const t of tiers) p(`T${padR(t, 4)} ` + bbs.map((b) => padL(tie.get(b)?.get(t) ?? 0, 5)).join(' '));
  p('all   ' + bbs.map((b) => padL([...(tie.get(b)?.values() ?? [])].reduce((s, n) => s + n, 0), 5)).join(' '));
  for (const [t, x, y] of dominated(byTier, (h) => hitOf(ctx, h.pair))) {
    const hs = must(byTier.get(t), 'tier');
    const hx = must(hs.find((h) => h.id === x), x);
    const hy = must(hs.find((h) => h.id === y), y);
    p(`  T${t} ${x} (${hitOf(ctx, hx.pair)}, wind-up ${hx.windup}, noise ${hx.block[6]}) over ${y} (${hitOf(ctx, hy.pair)}, wind-up ${hy.windup}, noise ${hy.block[6]})`);
  }

  const { soft, cap: capd, caps } = checks.clamp;
  section('-- WM-CLAMP: dominated pairs after the priced clamp (soft requirement: own tier 1 to t-2; power cap by entry)');
  p('tier  soft ' + caps.map((x) => padL(x, 5)).join(' '));
  for (const t of tiers) p(`T${padR(t, 4)} ${padL(soft.get(t) ?? 0, 4)} ` + caps.map((x) => padL(capd.get(x)?.get(t) ?? 0, 5)).join(' '));
  const sum = (it: Iterable<number>): number => [...it].reduce((s, n) => s + n, 0);
  p('all   ' + `${padL(sum(soft.values()), 4)} ` + caps.map((x) => padL(sum(capd.get(x)?.values() ?? []), 5)).join(' '));
  let hsSoft = 0;
  for (const [t, hs] of byTier) {
    const single = new Map([[t, hs]]);
    for (let own = 1; own < t - 1; own++) {
      const r = rateAt(ctx, own + 1);
      hsSoft += dominated(single, (h) => hitOf(ctx, effHarm(ctx, h, r), bb)).length;
    }
  }
  const hsCap = caps.map((x) => dominated(byTier, (h) => hitOf(ctx, effHarm(ctx, h, x), bb)).length);
  p('hits  ' + `${padL(hsSoft, 4)} ` + hsCap.map((n) => padL(n, 5)).join(' ') + `   (the same sweep read in hits at bare_base ${bb}: reported, not a check)`);
  let unSoft = 0;
  for (const [t, hs] of byTier) {
    if (t < 3) continue;
    const r = rateAt(ctx, t - 1);
    unSoft += dominated(new Map([[t, hs]]), (h) => effHarm(ctx, h, r, false)).length;
  }
  const cap0 = must(caps[0], 'a power cap');
  const unCap = dominated(byTier, (h) => effHarm(ctx, h, cap0, false)).length;
  p(`WEAPONS 4 as written (the clamp unpriced): ${unSoft} pairs one tier short (own tier t-2), ${unCap} at cap ${cap0}`);
  p(`stated exception: caps ${X.clamp.cap_exception.join(', ')} (character levels 1 and 2)`);

  const { bare, health, handHits, topCounts } = checks.anchors;
  const A = X.anchors;
  section(`-- WM-HITS: #598's bands in bare-hand hits at bare_base ${bb} (FIGHT_TIER_HITS), and the matrix's hands over them (full harm)`);
  const bands = Object.entries(A.bands_bare).map(([t, [lo, hi]]) => `T${t} ` + (lo === hi ? 'exactly ' : '') + `${rng([lo, hi])} hits (${rng(must(health.get(t), t))} health)`);
  p(`bare hands ${bare} a hit: ` + bands.join('; '));
  const matrixHands = HAND_LABEL.filter(([k]) => handHits.has(k)).map(([k, label]) => `${label} ${rng(must(handHits.get(k), k))}`);
  const states = HAND_LABEL.map(([k]) => String(A.weapons_4_states[k])).join('; ');
  p('matrix hands: ' + matrixHands.join('; ') + `   (WEAPONS 4 (#609) states ${states})`);
  const topLines: string[] = [];
  for (const [t, sets] of Object.entries(A.top_health)) {
    for (const k of Object.keys(sets)) {
      const got = topCounts.get(`${t}|${k}`);
      if (!got) continue;
      const label = must(HAND_LABEL.find(([x]) => x === k), k)[1];
      topLines.push(`a ${must(health.get(t), t)[1]}-health T${t} foe ${rng(got)} hits of a ${label} hand (${must(A.bands_bare[t], t)[1]} bare)`);
    }
  }
  p('top health: ' + topLines.join('; '));

  section("-- launchers by tier: the pair with its own tier's top shot (= its priced cell), highest first; the price in brackets");
  for (const t of tiers) {
    const ls = hands.filter((h) => h.tier === t && h.form.ammo !== undefined).sort((a, b) => (a.pair !== b.pair ? b.pair - a.pair : a.row < b.row ? -1 : a.row > b.row ? 1 : 0));
    if (ls.length > 0) p(`T${padR(t, 2)} ` + ls.map((h) => `${h.row} ${h.pair} (${h.price})`).join(', '));
  }

  section('-- by profession and band (today: Handcraft makes every tier 1 to 3 row)');
  const pc = new Map<string, number>();
  for (const r of recs) {
    const k = `${r.prof} ${bandOfTier(r.tier)}`;
    pc.set(k, (pc.get(k) ?? 0) + 1);
  }
  for (const k of [...pc.keys()].sort()) p(`${k}: ${pc.get(k)}`);
  const lv = new Map<string, number[]>();
  for (const r of recs) {
    const l = lv.get(r.prof);
    if (l) l.push(r.level);
    else lv.set(r.prof, [r.level]);
  }
  const levels = [...lv.keys()].sort().map((pr) => {
    const v = must(lv.get(pr), pr);
    return `${pr} ${Math.min(...v)}-${Math.max(...v)}`;
  });
  p('levels: ' + levels.join('; '));

  section('-- how a recipe is known');
  const kc = new Map<string, number>();
  for (const r of recs) {
    const k = r.known === 'try' || r.known === 'start' || r.known === 'cache' ? r.known : 'quest';
    kc.set(k, (kc.get(k) ?? 0) + 1);
  }
  p(['start', 'cache', 'quest', 'try'].map((k) => `${k} ${kc.get(k) ?? 0}`).join(', '));
  const qs = new Map<string, number>();
  for (const r of recs) if (r.known.startsWith('q-')) qs.set(r.known, (qs.get(r.known) ?? 0) + 1);
  const quests = [...qs.keys()].sort().map((k) => `${k} ${qs.get(k)}`);
  p(`quests ${qs.size}: ` + quests.join(', '));

  const slot = new Set(Object.entries(m.items).filter(([, v]) => v[1] === 'slot').map(([k]) => k));
  const rests = new Map<string, boolean>();
  for (const r of [...recs].sort((a, b) => a.tier - b.tier)) rests.set(r.id, [...r.inputs.keys()].some((i) => slot.has(i) || rests.get(i) === true));
  const late = recs.filter((r) => r.tier >= 7);
  const from4 = recs.filter((r) => r.tier >= 4);
  const resting = (rs: Row[]): number => rs.filter((r) => rests.get(r.id) === true).length;
  section(`-- land slots: ${resting(late)} of ${late.length} tier 7-10 recipes rest on a land slot; ${resting(from4)} of ${from4.length} at tiers 4-10`);

  section('-- first slice (WEAPONS 5.2, 5.4, 6.2) in the matrix');
  for (const l of sliceLines) p(l);

  section('-- shape pools per tier (close reach 1, close reach 2, thrown, bow, sling): used of capacity');
  const cap: [string, number][] = [
    ['c1', 27],
    ['c2', 27],
    ['thrown', 81],
    ['bow', 54],
    ['sling', 54],
  ];
  for (const t of tiers) {
    const u = new Map<string, number>();
    for (const h of hands.filter((x) => x.tier === t)) {
      const k = CLOSE.has(h.cls) ? `c${h.block[2]}` : h.cls;
      u.set(k, (u.get(k) ?? 0) + 1);
    }
    p(`T${padR(t, 2)} ` + cap.map(([k, n]) => `${padL(u.get(k) ?? 0, 2)}/${n}`).join(' '));
  }

  if (tables) {
    section('-- forms: shape, price, harm by tier (launchers: own harm)');
    for (const f of m.forms) {
      const hs = new Map(hands.filter((h) => h.row === f.form).map((h) => [h.tier, h]));
      const h0 = [...hs.values()][0];
      if (h0 === undefined) continue;
      const shape = `${f.tempo} ${f.feel} ${f.noise}` + (CLOSE.has(f.class) ? ` reach ${f.reach ?? 1}` : ` range ${f.range}`) + (f.ammo !== undefined ? ` ${f.ammo}` : '');
      const cells = tiers.map((t) => {
        const h = hs.get(t);
        return h ? padL(h.harm, 3) : '  .';
      });
      p(`| ${f.form} | ${f.class} | ${shape} | ${h0.windup} | ${h0.price} | ${cells.join(' ')} |`);
    }
    section('-- launchers: own harm + best shot of its tier = pair (cell)');
    for (const f of m.forms) {
      const ammo = f.ammo;
      if (ammo === undefined) continue;
      const hs = hands.filter((h) => h.row === f.form).sort((a, b) => a.tier - b.tier);
      p(`${f.form}: ` + hs.map((h) => `T${h.tier} ${h.harm}+${topOf(ctx, h.tier, ammo)}=${h.harm + topOf(ctx, h.tier, ammo)} (${h.cell})`).join('; '));
    }
  }

  section('-- variants (recipes T1-3 / T4-10; WM-COUNT against the direction for each)');
  for (const v of variants) p(v.line);

  const n = checks.notes;
  section('-- notes');
  p(`hit ties at bare_base ${bb} (listed, owner question 16): ${n.hitTies}`);
  p(`taught recipes sharing one input set (no try reads them): ${n.taughtDups.length}`);
  for (const x of n.taughtDups) p(`  ${x}`);
  p(`launcher x ammunition pairs allowed: ${n.launcherPairs}`);
  p(`built recipes read: ${n.builtRecipes}`);
  p(`checks run: ${n.checksRun.length}`);
  for (const x of n.checksRun) p(`  ${x}`);
  p(`built params compared (WM-BUILT): ${n.builtCompared}`);

  section(`-- checks: ${checks.errors.length} errors`);
  for (const e of checks.errors) p(`  ${e}`);
  return out.join('\n') + '\n';
}

// ---------------------------------------------------------------------------
// The whole report

export interface WeaponsReport {
  variant: Variant;
  rows: Row[];
  errors: string[];
  notes: Notes;
  counts: Counts;
  variants: VariantLine[];
  text: string;
}

export interface WeaponsOptions {
  variant?: Variant;
  /** also print the per-form harm table and the launcher pairs */
  tables?: boolean;
}

/** The report of one variant: the rows, every check's errors in the order the page lists them, the notes, the print. */
export function weaponsOutputs(src: WeaponSource, built: Built, opts: WeaponsOptions = {}): WeaponsReport {
  const variant = opts.variant ?? 'default';
  const ctx = makeCtx(src, variant, built);
  const rows = expand(ctx);
  const checks = runChecks(ctx, rows);
  checks.notes.builtCompared = checkBuilt(ctx, checks.errors);
  const slice = firstSlice(ctx, rows);
  checks.errors.push(...slice.errors);
  const variants = VARIANTS.map((v) => variantLine(src, built, v));
  const c = counts(rows);
  const [lo3, hi3] = bandCounts(c);
  const vd = verdict(src, lo3, hi3);
  if (vd !== 'in the direction') checks.errors.push(`WM-COUNT: variant ${variant}: ${lo3} / ${hi3}, ${vd}`);
  const text = renderReport(ctx, rows, checks, slice.lines, variants, opts.tables ?? false);
  return { variant, rows, errors: checks.errors, notes: checks.notes, counts: c, variants, text };
}

// ---------------------------------------------------------------------------
// The loader

function fail(path: string, msg: string): never {
  throw new Error(`weapon-matrix.json ${path}: ${msg}`);
}

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

function obj(x: unknown, path: string): Record<string, unknown> {
  if (!isObj(x)) fail(path, 'must be an object');
  return x;
}

function arr(x: unknown, path: string): unknown[] {
  if (!Array.isArray(x)) fail(path, 'must be a list');
  return x;
}

function int(x: unknown, path: string): number {
  if (typeof x !== 'number' || !Number.isSafeInteger(x)) fail(path, 'must be a whole number');
  return x;
}

function str(x: unknown, path: string): string {
  if (typeof x !== 'string') fail(path, 'must be a string');
  return x;
}

function pair(x: unknown, path: string): [number, number] {
  const a = arr(x, path);
  if (a.length !== 2) fail(path, 'must be two numbers');
  return [int(a[0], `${path}[0]`), int(a[1], `${path}[1]`)];
}

function rowSpec(x: unknown, path: string): void {
  const r = obj(x, path);
  pair(r.tiers, `${path}.tiers`);
  int(r.step, `${path}.step`);
  str(r.teach, `${path}.teach`);
  const make = arr(r.make, `${path}.make`);
  if (make.length !== 2) fail(`${path}.make`, 'names two professions');
  for (const [i, m] of make.entries()) if (!(str(m, `${path}.make[${i}]`) in STATION)) fail(`${path}.make[${i}]`, `unknown profession ${String(m)}`);
  if (r.early !== undefined) for (const [t, list] of Object.entries(obj(r.early, `${path}.early`))) for (const [i, s] of arr(list, `${path}.early.${t}`).entries()) str(s, `${path}.early.${t}[${i}]`);
  if (r.late !== undefined) for (const [i, s] of arr(r.late, `${path}.late`).entries()) str(s, `${path}.late[${i}]`);
}

/** The source checked field by field; the numbers of the matrix are proposals and are not bounded here. */
export function loadSource(raw: unknown): WeaponSource {
  const top = obj(raw, '');
  for (const k of ['about', 'status', 'params', 'classes', 'ammo_classes', 'professions', 'stations', 'items', 'lines', 'line_items', 'forms', 'parts', 'ammo', 'teachers', 'shops', 'first_slice']) {
    if (!(k in top)) fail(k, 'missing');
  }
  const params = obj(top.params, 'params');
  for (const [name, spec] of Object.entries(obj(params.built, 'params.built'))) {
    const s = obj(spec, `params.built.${name}`);
    str(s.at, `params.built.${name}.at`);
    if (typeof s.value !== 'number' && !Array.isArray(s.value)) fail(`params.built.${name}.value`, 'must be a number or a list');
  }
  const weapons = obj(params.weapons, 'params.weapons');
  int(weapons.hand_offset, 'params.weapons.hand_offset');
  for (const [i, r] of arr(weapons.hand_rate_max_permille, 'params.weapons.hand_rate_max_permille').entries()) int(r, `params.weapons.hand_rate_max_permille[${i}]`);
  const matrix = obj(params.matrix, 'params.matrix');
  for (const k of ['hand_rate_max_permille_tier_10', 'power_cap_permille_level_15', 'clamp', 'hit_reading', 'hit_ties_open', 'anchors', 'tier_min_level', 'level_top', 'feels', 'noise', 'price', 'share_floor', 'counts_target', 'skeleton_max_swap', 'try_inputs']) {
    if (!(k in matrix)) fail(`params.matrix.${k}`, 'missing');
  }
  for (const [i, t] of arr(obj(matrix.hit_ties_open, 'params.matrix.hit_ties_open').pairs, 'params.matrix.hit_ties_open.pairs').entries()) {
    const p = arr(t, `params.matrix.hit_ties_open.pairs[${i}]`);
    if (p.length !== 3) fail(`params.matrix.hit_ties_open.pairs[${i}]`, 'is [tier, a, b]');
    int(p[0], `params.matrix.hit_ties_open.pairs[${i}][0]`);
    str(p[1], `params.matrix.hit_ties_open.pairs[${i}][1]`);
    str(p[2], `params.matrix.hit_ties_open.pairs[${i}][2]`);
  }
  for (const [i, t] of arr(matrix.tier_min_level, 'params.matrix.tier_min_level').entries()) int(t, `params.matrix.tier_min_level[${i}]`);
  const classes = obj(top.classes, 'classes');
  const forms = arr(top.forms, 'forms');
  for (const [i, f] of forms.entries()) {
    const path = `forms[${i}]`;
    rowSpec(f, path);
    const o = obj(f, path);
    str(o.form, `${path}.form`);
    if (!(str(o.class, `${path}.class`) in classes)) fail(`${path}.class`, `unknown class ${String(o.class)}`);
    if (!(TEMPOS as readonly string[]).includes(str(o.tempo, `${path}.tempo`))) fail(`${path}.tempo`, `unknown tempo ${String(o.tempo)}`);
    str(o.feel, `${path}.feel`);
    str(o.noise, `${path}.noise`);
  }
  for (const [i, r] of arr(top.parts, 'parts').entries()) {
    rowSpec(r, `parts[${i}]`);
    str(obj(r, `parts[${i}]`).part, `parts[${i}].part`);
  }
  for (const [i, r] of arr(top.ammo, 'ammo').entries()) {
    rowSpec(r, `ammo[${i}]`);
    const o = obj(r, `ammo[${i}]`);
    str(o.ammo, `ammo[${i}].ammo`);
    str(o.class, `ammo[${i}].class`);
    str(o.head, `ammo[${i}].head`);
  }
  for (const [k, v] of Object.entries(obj(top.items, 'items'))) {
    const a = arr(v, `items.${k}`);
    if (a.length !== 2) fail(`items.${k}`, 'is [tier, where]');
    int(a[0], `items.${k}[0]`);
    str(a[1], `items.${k}[1]`);
  }
  for (const [k, v] of Object.entries(obj(top.teachers, 'teachers'))) {
    const t = obj(v, `teachers.${k}`);
    pair(t.tiers, `teachers.${k}.tiers`);
    int(t.max, `teachers.${k}.max`);
  }
  for (const [k, v] of Object.entries(obj(obj(top.first_slice, 'first_slice').rows, 'first_slice.rows'))) {
    const row = arr(v, `first_slice.rows.${k}`);
    if (row.length !== 3) fail(`first_slice.rows.${k}`, 'is [inputs, level, station tier]');
    arr(row[0], `first_slice.rows.${k}[0]`);
    int(row[1], `first_slice.rows.${k}[1]`);
    int(row[2], `first_slice.rows.${k}[2]`);
  }
  return top as unknown as WeaponSource;
}

export function readSource(): WeaponSource {
  return loadSource(JSON.parse(readFileSync(WEAPON_SOURCE_FILE, 'utf8')));
}

/** The fenced `text` blocks of a page (WEAPON_MATRIX 10 quotes the report), in order, without the fences. */
export function pageBlocks(markdown: string): string[] {
  const out: string[] = [];
  const re = /```text\n([\s\S]*?)\n```/g;
  for (let mt = re.exec(markdown); mt !== null; mt = re.exec(markdown)) out.push(must(mt[1], 'block'));
  return out;
}
