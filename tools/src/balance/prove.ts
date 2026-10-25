/**
 * The balance prover (PROGRESSION 4.7): the two red lines, the rising
 * ceilings, both proofs of every wall and the strongest builds, over a
 * catalogue (content, or the stand-in of fixture.ts). Pure and integer: the
 * same catalogue and rules give the same report on every machine.
 *
 * A wall is passed when all three hold (4.7): the health at the end stays above
 * zero, T inside the timer, the requirement met on base levels. With L the
 * length in game minutes, slow the remaining grade's slow in permille, off the
 * `move` (or `work`) share in percent and net the drain less `sustain` in
 * percent of the cap a game hour:
 *
 *   loss% = L * slow * (100 - off) * net / 6,000,000      (T = L * slow * (100 - off) / 100,000 minutes)
 *
 * `sustain` is the band's ceiling: food is carried, and while a place drains
 * all health back comes in at most at that rate (4.7). Every source is
 * monotonic, so each slot's Pareto front over the wall's own stats reaches the
 * best a band can do; the search walks the fronts in full, exactly.
 */
import { type Bundle, idiv } from '@game/kernel';
import type { Catalogue, Dish, Piece, Wall } from './catalogue';
import { vendorLoops } from './catalogue';
import { fmtPct, fmtTenths, hoursTenths } from './curve';
import { CATEGORIES, type Category, RARITY_NAMES, type Rules, ceilingOf } from './rules';

export type Status = 'pass' | 'fail' | 'warn' | 'info';

export interface Row {
  id: string;
  status: Status;
  detail: string;
}

export interface Build {
  pieces: Piece[];
  dishes: Dish[];
}

/** How a build meets a place: the remaining grade, the share off, and the two coefficients the length multiplies. */
export interface Fit {
  r: number;
  off: number;
  net: number;
  /** loss% * 6,000,000 per game minute */
  k: number;
  /** T in minutes * 100,000 per game minute */
  kT: number;
  answers: Record<string, number>;
  build: Build;
}

export interface WallProof {
  id: string;
  band: number;
  witness: { found: boolean; fit?: Fit; endPermille?: number; tMin?: number; passes: boolean; why: string };
  cheese: { band: number; fit?: Fit; endPermille?: number; tMin?: number; passes: boolean; why: string; walked: number; full: string };
}

export interface Window {
  band: number;
  grade: number;
  conditions: string[];
  /** fewest game minutes nothing from band - gap passes; null: it always passes (no wall can be made) */
  minMin: number | null;
  /** most game minutes the band's best passes with the margin; null: any length */
  maxMin: number | null;
}

export interface TopBand {
  band: number;
  top: { score: number; ids: string[] }[];
  median: number;
  medianOwnTier: number;
  ratioPermille: number;
  full: string;
  states: number;
}

export interface Proof {
  source: string;
  rows: Row[];
  hours: { school: string; tenths: number; first: boolean }[];
  walls: WallProof[];
  windows: Window[];
  top: TopBand[];
  counts: { what: string; full: string; walked: number }[];
}

const SIX_E8 = 600_000_000;

function levelTop(rules: Rules, band: number): number {
  return Math.min(band * rules.bandSize, rules.steps + 1);
}

/** A trait's strength worn by a player of this band: one tier ahead at most (Q5), common always 1 (5.7), a master step for uncommon and up. */
export function traitStrength(rules: Rules, p: Piece, band: number): number {
  if (!p.trait) return 0;
  if (p.rarity === 0) return 1;
  const tier = Math.min(p.tier, band + 1);
  return (rules.traitStrengthByTier[tier - 1] ?? 0) + (p.master ? rules.masterStep : 0);
}

const sumOf = (build: Build, cat: Category): number => {
  let s = 0;
  for (const p of build.pieces) for (const e of p.effects) if (e.cat === cat) s += e.value;
  for (const d of build.dishes) for (const e of d.effects) if (e.cat === cat) s += e.value;
  return s;
};

/** How a build meets conditions at a grade, worn by a player of this band. */
export function fit(rules: Rules, cat: Catalogue, band: number, conditions: readonly string[], grade: number, by: 'move' | 'work', build: Build): Fit {
  const answerOf = new Map(cat.traits.map((t) => [t.name, t.answers]));
  const garment: Record<string, number> = {};
  for (const c of conditions) garment[c] = 0;
  for (const p of build.pieces) {
    const c = p.trait ? answerOf.get(p.trait) : undefined;
    if (c !== undefined && c in garment) garment[c] = Math.max(garment[c]!, traitStrength(rules, p, band));
  }
  const ceilPlace = ceilingOf(rules, 'place', band);
  const dishAnswers = [...new Set(build.dishes.map((d) => d.answers).filter((a): a is string => a !== undefined && conditions.includes(a)))];
  let best: { r: number; answers: Record<string, number> } | undefined;
  for (const chosen of dishAnswers.length > 0 ? dishAnswers : [undefined]) {
    const answers: Record<string, number> = {};
    let r = 0;
    for (const c of conditions) {
      answers[c] = Math.min(ceilPlace, garment[c]! + (chosen === c ? rules.dishPlaceStep : 0));
      r = Math.max(r, grade - answers[c]);
    }
    if (!best || r < best.r) best = { r, answers };
  }
  const r = Math.min(rules.gradeWalkPermille.length - 1, Math.max(0, best!.r));
  const off = Math.min(ceilingOf(rules, by, band), sumOf(build, by) + (cat.tree[by][band - 1] ?? 0));
  const slow = rules.gradeWalkPermille[r]!;
  const net = Math.max(0, rules.gradeDrainPct[r]! - ceilingOf(rules, 'sustain', band));
  return { r, off, net, k: slow * (100 - off) * net, kT: slow * (100 - off), answers: best!.answers, build };
}

/** Does a fit pass a wall of this length? `margin`: the witness's spare tenth of the cap and the timer. */
function passes(rules: Rules, wall: Wall, f: Fit, band: number, margin: boolean): { ok: boolean; why: string } {
  const m = margin ? rules.wallMarginBp : 0;
  const L = wall.lengthMin;
  const healthOk = margin ? L * f.k <= (10_000 - m) * 60_000 : L * f.k < SIX_E8;
  const timerOk = wall.timerMin === undefined || (margin ? L * f.kT <= wall.timerMin * 10 * (10_000 - m) : L * f.kT <= wall.timerMin * 100_000);
  const levelOk = wall.needsLevel === undefined || wall.needsLevel <= levelTop(rules, band);
  const why = [!healthOk ? 'health runs out' : '', !timerOk ? 'the timer runs out' : '', !levelOk ? `needs level ${wall.needsLevel}` : ''].filter(Boolean).join(', ');
  return { ok: healthOk && timerOk && levelOk, why: why || 'passes' };
}

/** Health left at the end, in permille of the cap (may be negative), and T in game minutes. */
export function endOf(wall: { lengthMin: number }, f: Fit): { endPermille: number; tMin: number } {
  return { endPermille: 1000 - idiv(wall.lengthMin * f.k, SIX_E8 / 1000), tMin: idiv(wall.lengthMin * f.kT, 100_000) };
}

/** Keep only the items no other item beats in every coordinate. */
function front<T>(items: readonly T[], vec: (t: T) => number[]): T[] {
  const vs = items.map(vec);
  const keep: T[] = [];
  for (let i = 0; i < items.length; i++) {
    let beaten = false;
    for (let j = 0; j < items.length && !beaten; j++) {
      if (i === j) continue;
      const a = vs[j]!;
      const b = vs[i]!;
      let ge = true;
      let gt = false;
      for (let k = 0; k < a.length; k++) {
        if (a[k]! < b[k]!) ge = false;
        if (a[k]! > b[k]!) gt = true;
      }
      beaten = ge && (gt || j < i);
    }
    if (!beaten) keep.push(items[i]!);
  }
  return keep;
}

function slotInstances(cat: Catalogue): string[] {
  return cat.slots.flatMap((s) => Array.from({ length: s.count }, () => s.id));
}

const choose2 = (n: bigint) => (n * (n - 1n)) / 2n;

/** The full count of builds a band could wear, before any pruning: every slot empty or any piece, and up to two dishes. */
function fullCount(cat: Catalogue, pieces: readonly Piece[], dishes: readonly Dish[]): bigint {
  let n = 1n;
  for (const s of slotInstances(cat)) n *= BigInt(pieces.filter((p) => p.slot === s).length + 1);
  const d = BigInt(dishes.length);
  return n * (1n + d + choose2(d));
}

interface SearchResult {
  best?: Fit;
  first?: Fit;
  walked: number;
  full: bigint;
}

/**
 * Walk every combination of the slots' Pareto fronts and the dishes' front for
 * one band and one set of conditions. `accept` stops the walk early (a cheese
 * found); the best fit is the one with the least loss, then the least time.
 */
function search(
  rules: Rules,
  cat: Catalogue,
  band: number,
  conditions: readonly string[],
  grade: number,
  by: 'move' | 'work',
  pieces: readonly Piece[],
  dishes: readonly Dish[],
  accept?: (f: Fit) => boolean,
): SearchResult {
  const answerOf = new Map(cat.traits.map((t) => [t.name, t.answers]));
  const pVec = (p: Piece) => [...conditions.map((c) => (p.trait && answerOf.get(p.trait) === c ? traitStrength(rules, p, band) : 0)), p.effects.filter((e) => e.cat === by).reduce((a, e) => a + e.value, 0)];
  const dVec = (d: Dish) => [...conditions.map((c) => (d.answers === c ? rules.dishPlaceStep : 0)), d.effects.filter((e) => e.cat === by).reduce((a, e) => a + e.value, 0)];
  const fronts = slotInstances(cat).map((s) => {
    const f = front(
      pieces.filter((p) => p.slot === s),
      pVec,
    ).filter((p) => pVec(p).some((x) => x > 0));
    return f.length > 0 ? f : [undefined];
  });
  const dFront = front(dishes, dVec).filter((d) => dVec(d).some((x) => x > 0));
  const dishSets: Dish[][] = [[]];
  if (rules.dishSlots >= 1) for (const d of dFront) dishSets.push([d]);
  if (rules.dishSlots >= 2) for (let i = 0; i < dFront.length; i++) for (let j = i + 1; j < dFront.length; j++) dishSets.push([dFront[i]!, dFront[j]!]);
  const out: SearchResult = { walked: 0, full: fullCount(cat, pieces, dishes) };
  const chosen: Piece[] = [];
  let stop = false;
  const walk = (i: number) => {
    if (stop) return;
    if (i === fronts.length) {
      for (const ds of dishSets) {
        out.walked++;
        const f = fit(rules, cat, band, conditions, grade, by, { pieces: [...chosen], dishes: ds });
        if (!out.best || f.k < out.best.k || (f.k === out.best.k && f.kT < out.best.kT)) out.best = f;
        if (accept && accept(f)) {
          out.first = f;
          stop = true;
          return;
        }
      }
      return;
    }
    for (const p of fronts[i]!) {
      if (p) chosen.push(p);
      walk(i + 1);
      if (p) chosen.pop();
      if (stop) return;
    }
  };
  walk(0);
  return out;
}

const piecesUpTo = (cat: Catalogue, tier: number) => cat.pieces.filter((p) => p.tier <= tier);
const dishesUpTo = (cat: Catalogue, tier: number) => cat.dishes.filter((d) => d.tier <= tier);

function proveWall(rules: Rules, cat: Catalogue, wall: Wall, counts: Proof['counts']): WallProof {
  const b = wall.band;
  // the witness: the recorded build, at band b
  let witness: WallProof['witness'];
  if (!wall.witness) witness = { found: false, passes: false, why: 'no witness recorded' };
  else {
    const pieces = wall.witness.pieces.map((id) => cat.pieces.find((p) => p.id === id));
    const dishes = wall.witness.dishes.map((id) => cat.dishes.find((d) => d.id === id));
    const missing = [...wall.witness.pieces.filter((_, i) => !pieces[i]), ...wall.witness.dishes.filter((_, i) => !dishes[i])];
    const over = [...pieces, ...dishes].filter((x) => x && x.tier > b).map((x) => x!.id);
    if (missing.length > 0 || over.length > 0) {
      witness = { found: false, passes: false, why: missing.length > 0 ? `the witness names unknown things: ${missing.join(', ')}` : `the witness uses tiers above band ${b}: ${over.join(', ')}` };
    } else {
      const f = fit(rules, cat, b, wall.conditions, wall.grade, wall.by, { pieces: pieces as Piece[], dishes: dishes as Dish[] });
      const p = passes(rules, wall, f, b, true);
      witness = { found: true, fit: f, ...endOf(wall, f), passes: p.ok, why: p.ok ? `remaining grade ${f.r}, ${wall.by} ${f.off}%, ends with margin` : p.why };
    }
  }
  // not cheesable: everything from band b - gap, one tier ahead, every dish pair
  const cb = b - rules.wallCheeseGap;
  let cheese: WallProof['cheese'];
  if (cb < 1) cheese = { band: cb, passes: false, why: `band ${b} has no band ${cb}: nothing below can try`, walked: 0, full: '0' };
  else {
    const res = search(rules, cat, cb, wall.conditions, wall.grade, wall.by, piecesUpTo(cat, cb + 1), cat.dishes, (f) => passes(rules, wall, f, cb, false).ok);
    counts.push({ what: `wall ${wall.id}: band ${cb} builds`, full: res.full.toString(), walked: res.walked });
    const f = res.first ?? res.best;
    const p = f ? passes(rules, wall, f, cb, false) : { ok: false, why: 'no build' };
    cheese = { band: cb, ...(f ? { fit: f, ...endOf(wall, f) } : {}), passes: p.ok, why: p.ok ? 'a build passes' : `the best build: ${p.why}`, walked: res.walked, full: res.full.toString() };
  }
  return { id: wall.id, band: b, witness, cheese };
}

/** The window of lengths at which a wall of this band, grade and conditions is both solvable with margin and not cheesable. */
export function windowOf(rules: Rules, cat: Catalogue, band: number, grade: number, conditions: string[], by: 'move' | 'work' = 'move'): Window {
  const w = search(rules, cat, band, conditions, grade, by, piecesUpTo(cat, band), dishesUpTo(cat, band)).best;
  const cb = band - rules.wallCheeseGap;
  const c = cb >= 1 ? search(rules, cat, cb, conditions, grade, by, piecesUpTo(cat, cb + 1), cat.dishes).best : undefined;
  const minMin = cb < 1 ? 1 : !c || c.k === 0 ? null : idiv(SIX_E8 - 1, c.k) + 1;
  const maxMin = !w || w.k === 0 ? null : idiv((10_000 - rules.wallMarginBp) * 60_000, w.k);
  return { band, grade, conditions, minMin, maxMin };
}

/** The effect graph: a cycle is red line A (4.7 (a)). Returns one cycle, or undefined. */
export function findCycle(cat: Catalogue): string[] | undefined {
  const edges = new Map<string, Set<string>>();
  const add = (a: string, c: string) => edges.set(a, (edges.get(a) ?? new Set()).add(c));
  for (const [a, c] of cat.edges) add(a, c);
  for (const t of [...cat.pieces, ...cat.dishes]) if (t.maker) for (const e of t.effects) add(`strength:${t.maker}`, e.kind);
  const state = new Map<string, number>();
  const path: string[] = [];
  let found: string[] | undefined;
  const visit = (n: string): void => {
    if (found) return;
    state.set(n, 1);
    path.push(n);
    for (const m of [...(edges.get(n) ?? [])].sort()) {
      if (state.get(m) === 1) {
        found = [...path.slice(path.indexOf(m)), m];
        return;
      }
      if (!state.has(m)) visit(m);
      if (found) return;
    }
    path.pop();
    state.set(n, 2);
  };
  for (const n of [...edges.keys()].sort()) if (!state.has(n)) visit(n);
  return found;
}

/** Red line B (4.7 (b)): no name may speak of experience, and the only bonus is the mentor's. */
export function experienceLeaks(rules: Rules, cat: Catalogue): string[] {
  const out: string[] = [];
  const xp = /(^|_)(xp|exp|experience)(_|$)/i;
  for (const n of cat.names) if (xp.test(n)) out.push(`the effect ${n} names experience`);
  for (const t of [...cat.pieces, ...cat.dishes]) for (const e of t.effects) if (xp.test(e.kind) && !cat.names.includes(e.kind)) out.push(`${t.id} carries ${e.kind}`);
  for (const s of cat.xpSources) {
    if (s.source === 'mentor') {
      if (s.permille > rules.mentorBonusPct * 10) out.push(`the mentor pays ${s.permille} permille, above ${rules.mentorBonusPct * 10}`);
    } else out.push(`${s.source} pays ${s.permille} permille of the player's own experience: a source beside the mentor`);
  }
  return out;
}

const effectCount = (t: Piece | Dish) => t.effects.length + ('trait' in t && t.trait ? 1 : 0);

/** Score of a build for the top list: each category's value over its ceiling, summed (4.7 item 4), in permille. */
function scoreOf(rules: Rules, cat: Catalogue, band: number, sums: Record<string, number>, answers: Record<string, number>): number {
  let s = 0;
  for (const c of CATEGORIES) {
    if (c === 'place') continue;
    const ceil = ceilingOf(rules, c, band);
    if (ceil > 0) s += idiv(Math.min(ceil, (sums[c] ?? 0) + (cat.tree[c][band - 1] ?? 0)) * 1000, ceil);
  }
  const conds = cat.traits.map((t) => t.answers);
  const ceilPlace = ceilingOf(rules, 'place', band);
  if (conds.length > 0 && ceilPlace > 0) s += idiv(conds.reduce((a, c) => a + Math.min(ceilPlace, answers[c] ?? 0), 0) * 1000, ceilPlace * conds.length);
  return s;
}

interface BeamState {
  sums: Record<string, number>;
  garment: Record<string, number>;
  dish: Record<string, number>;
  ids: string[];
}

function stateScore(rules: Rules, cat: Catalogue, band: number, s: BeamState): number {
  const answers: Record<string, number> = {};
  const conds = cat.traits.map((t) => t.answers);
  // only one dish's place answer counts: give it where it adds most
  let bestGain = 0;
  let bestC = '';
  const ceilPlace = ceilingOf(rules, 'place', band);
  for (const c of conds) {
    const gain = Math.min(ceilPlace, (s.garment[c] ?? 0) + (s.dish[c] ?? 0)) - Math.min(ceilPlace, s.garment[c] ?? 0);
    if (gain > bestGain) {
      bestGain = gain;
      bestC = c;
    }
  }
  for (const c of conds) answers[c] = Math.min(ceilPlace, (s.garment[c] ?? 0) + (c === bestC ? (s.dish[c] ?? 0) : 0));
  return scoreOf(rules, cat, band, s.sums, answers);
}

/** A seeded integer generator (xorshift32), for the median's sample. */
function xorshift(seed: number): () => number {
  let x = seed >>> 0 || 1;
  return () => {
    x ^= x << 13;
    x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5;
    x >>>= 0;
    return x;
  };
}

/** The strongest builds of a band by a beam over the slots, and the band's median from a fixed-seed sample. */
export function topBuilds(rules: Rules, cat: Catalogue, band: number, beam = 400, samples = 2001): TopBand {
  const answerOf = new Map(cat.traits.map((t) => [t.name, t.answers]));
  const conds = cat.traits.map((t) => t.answers);
  const pieces = piecesUpTo(cat, band);
  const dishes = dishesUpTo(cat, band);
  const add = (s: BeamState, t: Piece | Dish | undefined): BeamState => {
    if (!t) return s;
    const sums = { ...s.sums };
    for (const e of t.effects) if (e.cat && e.cat !== 'place') sums[e.cat] = (sums[e.cat] ?? 0) + e.value;
    const garment = { ...s.garment };
    const dish = { ...s.dish };
    if ('slot' in t && t.trait) {
      const c = answerOf.get(t.trait)!;
      garment[c] = Math.max(garment[c] ?? 0, traitStrength(rules, t, band));
    }
    if (!('slot' in t) && t.answers) dish[t.answers] = Math.max(dish[t.answers] ?? 0, rules.dishPlaceStep);
    return { sums, garment, dish, ids: [...s.ids, t.id] };
  };
  const vec = (t: Piece | Dish) => [
    ...CATEGORIES.filter((c) => c !== 'place').map((c) => t.effects.filter((e) => e.cat === c).reduce((a, e) => a + e.value, 0)),
    ...conds.map((c) => ('slot' in t ? (t.trait && answerOf.get(t.trait) === c ? traitStrength(rules, t, band) : 0) : t.answers === c ? rules.dishPlaceStep : 0)),
  ];
  const lanes: (Piece | Dish)[][] = [
    ...slotInstances(cat).map((s) => front(pieces.filter((p) => p.slot === s), vec)),
    ...Array.from({ length: rules.dishSlots }, () => front(dishes, vec) as (Piece | Dish)[]),
  ];
  let states: BeamState[] = [{ sums: {}, garment: {}, dish: {}, ids: [] }];
  let walked = 0;
  for (const lane of lanes) {
    const next = new Map<string, { s: BeamState; score: number }>();
    for (const s of states) {
      for (const t of [undefined, ...lane]) {
        if (t && !('slot' in t) && s.ids.includes(t.id)) continue;
        const n = add(s, t);
        walked++;
        const key = JSON.stringify([n.sums, n.garment, n.dish]);
        if (next.has(key)) continue;
        next.set(key, { s: n, score: stateScore(rules, cat, band, n) });
      }
    }
    states = [...next.values()]
      .sort((a, c) => c.score - a.score || a.s.ids.join().localeCompare(c.s.ids.join()))
      .slice(0, beam)
      .map((x) => x.s);
  }
  const scored = states.map((s) => ({ score: stateScore(rules, cat, band, s), ids: s.ids })).sort((a, c) => c.score - a.score);
  const top = scored.slice(0, rules.topBuildsN);
  const sample = (pool: readonly Piece[], seed: number): number => {
    const next = xorshift(seed);
    const scores: number[] = [];
    const bySlot = new Map(cat.slots.map((s) => [s.id, pool.filter((p) => p.slot === s.id)]));
    for (let i = 0; i < samples; i++) {
      let s: BeamState = { sums: {}, garment: {}, dish: {}, ids: [] };
      for (const slot of slotInstances(cat)) {
        const list = bySlot.get(slot) ?? [];
        if (list.length > 0) s = add(s, list[next() % list.length]);
      }
      for (let d = 0; d < rules.dishSlots && dishes.length > 0; d++) s = add(s, dishes[next() % dishes.length]);
      scores.push(stateScore(rules, cat, band, s));
    }
    scores.sort((a, c) => a - c);
    return scores[idiv(scores.length, 2)] ?? 0;
  };
  const median = sample(pieces, 7 + band);
  const medianOwnTier = sample(
    pieces.filter((p) => p.tier === band),
    77 + band,
  );
  const best = top[0]?.score ?? 0;
  return {
    band,
    top,
    median,
    medianOwnTier,
    ratioPermille: median > 0 ? idiv(best * 1000, median) : 0,
    full: fullCount(cat, pieces, dishes).toString(),
    states: walked,
  };
}

/** Everything, over one catalogue. `bundle` adds the vendor loops of content. */
export function prove(rules: Rules, cat: Catalogue, bundle?: Bundle, opts: { top?: boolean } = {}): Proof {
  const rows: Row[] = [];
  const counts: Proof['counts'] = [];
  // the curve and the catalogue's hours
  const t1Ok = rules.t1Ms >= rules.t1MinMs && rules.t1Ms <= rules.t1MaxMs;
  rows.push({ id: 'curve_t1', status: t1Ok ? 'pass' : 'fail', detail: `t1 ${rules.t1Ms} ms, inside ${rules.t1MinMs}-${rules.t1MaxMs}` });
  const hours = cat.schools.map((s) => ({ school: s.id, tenths: hoursTenths(s.masteryMs), first: s.first }));
  const firstMs = cat.schools.filter((s) => s.first).reduce((a, s) => a + s.masteryMs, 0);
  const allMs = cat.schools.reduce((a, s) => a + s.masteryMs, 0);
  const firstN = cat.schools.filter((s) => s.first).length;
  rows.push({
    id: 'catalogue_hours_min',
    status: firstMs >= rules.catalogueHoursMin * 3_600_000 ? 'pass' : 'fail',
    detail: `${firstN} schools of the first catalogue master in ${fmtTenths(hoursTenths(firstMs))} h (at least ${rules.catalogueHoursMin}); all ${cat.schools.length}: ${fmtTenths(hoursTenths(allMs))} h`,
  });
  // the ceilings rise and the raisers top them
  const falling = CATEGORIES.filter((c) => rules.ceilings[c].some((v, i) => i > 0 && v < (rules.ceilings[c][i - 1] ?? 0)));
  const raisers = CATEGORIES.reduce((a, c) => a + rules.raisersMax[c], 0);
  const tops = CATEGORIES.map((c) => `${c} ${ceilingOf(rules, c, rules.bands, rules.raisersMax[c])}`).join(', ');
  rows.push({ id: 'ceilings', status: falling.length === 0 ? 'pass' : 'fail', detail: falling.length === 0 ? `every ceiling rises with the band; ${raisers} raisers; tops with every raiser: ${tops}` : `falls with the band: ${falling.join(', ')}` });
  // red line A: no loop
  const cycle = findCycle(cat);
  rows.push({ id: 'effect_graph_acyclic', status: cycle ? 'fail' : 'pass', detail: cycle ? `a loop: ${cycle.join(' -> ')}` : `no cycle among ${new Set(cat.edges.flat()).size + cat.pieces.length + cat.dishes.length} effect sources` });
  if (bundle) {
    const loops = vendorLoops(bundle);
    const bad = loops.filter((l) => l.profitMg > rules.loopProfitMaxMg);
    const worst = loops[0];
    rows.push({
      id: 'loop_profit_max',
      status: bad.length === 0 ? 'pass' : 'fail',
      detail:
        bad.length === 0
          ? `${loops.length} buy-make-sell cycles, none above ${rules.loopProfitMaxMg} mg${worst ? `; the closest: ${worst.what}, ${worst.profitMg} mg` : ''}`
          : bad.map((l) => `${l.what}: costs ${l.costMg} mg, pays ${l.payMg} mg, +${l.profitMg} mg`).join('; '),
    });
  } else rows.push({ id: 'loop_profit_max', status: 'info', detail: 'the stand-in has no shops: read on content only' });
  // red line B: experience only from the mentor
  const leaks = experienceLeaks(rules, cat);
  rows.push({ id: 'xp_sources', status: leaks.length === 0 ? 'pass' : 'fail', detail: leaks.length === 0 ? `${cat.names.length} effect names, none of experience; bonus sources: ${cat.xpSources.map((s) => s.source).join(', ') || 'none'}` : leaks.join('; ') });
  // common things are plain, and what each rarity may carry (5.7)
  const things = [...cat.pieces, ...cat.dishes];
  const notPlain = things.filter((t) => t.rarity === 0 && (effectCount(t) > 1 || t.effects.some((e) => e.value > (cat.steps[e.kind] ?? Number.MAX_SAFE_INTEGER))));
  rows.push({ id: 'common_plain', status: notPlain.length === 0 ? 'pass' : 'fail', detail: notPlain.length === 0 ? `${things.filter((t) => t.rarity === 0).length} common things, each one effect at most, at its smallest step` : notPlain.slice(0, 5).map((t) => t.id).join(', ') });
  const tooMany = things.filter((t) => effectCount(t) > (rules.rarityEffectsMax[t.rarity] ?? 0));
  rows.push({ id: 'rarity_effects_max', status: tooMany.length === 0 ? 'pass' : 'fail', detail: tooMany.length === 0 ? `${things.length} things within [${rules.rarityEffectsMax.join(', ')}] effects by rarity` : tooMany.slice(0, 5).map((t) => `${t.id} (${RARITY_NAMES[t.rarity]}, ${effectCount(t)})`).join(', ') });
  const outOfBand: string[] = [];
  let zeroes = 0;
  for (const t of things) {
    if (t.rarity === 0) continue;
    const [lo, hi] = rules.rarityBandPermille[t.rarity] ?? [0, 1000];
    for (const e of t.effects) {
      const full = cat.full['slot' in t ? e.kind : `dish:${e.kind}`]?.[t.tier - 1];
      if (full === undefined) continue;
      if (e.value === 0) zeroes++;
      if (e.value < idiv(full * lo, 1000) || e.value > idiv(full * hi + 999, 1000)) outOfBand.push(`${t.id} ${e.kind} ${e.value} of ${full}`);
    }
  }
  rows.push({
    id: 'rarity_band_permille',
    status: outOfBand.length === 0 ? (zeroes > 0 ? 'warn' : 'pass') : 'fail',
    detail: outOfBand.length > 0 ? outOfBand.slice(0, 5).join(', ') : zeroes > 0 ? `inside the bands, but ${zeroes} effects round down to 0 (a band of a small full value)` : 'every effect inside its rarity band',
  });
  // walls
  const walls = cat.walls.map((w) => proveWall(rules, cat, w, counts));
  if (cat.walls.length === 0) rows.push({ id: 'walls', status: 'info', detail: 'no walls in this catalogue yet' });
  for (const w of walls) {
    rows.push({ id: `wall_witness_required:${w.id}`, status: w.witness.found ? 'pass' : 'fail', detail: w.witness.found ? 'a witness is recorded' : w.witness.why });
    if (w.witness.found) rows.push({ id: `wall_solvable:${w.id}`, status: w.witness.passes ? 'pass' : 'fail', detail: `band ${w.band}: ${w.witness.why}; ends at ${fmtPct(w.witness.endPermille!)} of the cap, T ${w.witness.tMin} game min` });
    rows.push({
      id: `wall_not_cheesable:${w.id}`,
      status: w.cheese.passes ? 'fail' : 'pass',
      detail: `band ${w.cheese.band}: ${w.cheese.why}${w.cheese.fit ? ` (remaining grade ${w.cheese.fit.r}, ends at ${fmtPct(w.cheese.endPermille!)}, T ${w.cheese.tMin} game min${w.cheese.passes ? `; by ${w.cheese.fit.build.pieces.map((p) => p.id).concat(w.cheese.fit.build.dishes.map((d) => d.id)).join(', ')}` : ''})` : ''}; ${w.cheese.walked} of ${w.cheese.full} combinations walked`,
    });
  }
  // two conditions on one slot: does the top band answer every pair in full?
  const conds = cat.traits.map((t) => t.answers);
  const stuck: string[] = [];
  for (let i = 0; i < conds.length; i++) {
    for (let j = i + 1; j < conds.length; j++) {
      const pair = [conds[i]!, conds[j]!];
      const f = search(rules, cat, rules.bands, pair, rules.gradeWalkPermille.length - 1, 'move', cat.pieces, cat.dishes).best;
      if (f && f.r > 0) stuck.push(`${pair.join(' + ')} leaves grade ${f.r}`);
    }
  }
  if (conds.length > 1) rows.push({ id: 'condition_pairs', status: stuck.length === 0 ? 'pass' : 'warn', detail: stuck.length === 0 ? 'the top band answers every pair of conditions at the top grade' : `at the top grade, the top band cannot answer: ${stuck.join('; ')}` });
  // the strongest builds (a warning, never a failure)
  const top: TopBand[] = [];
  if (opts.top !== false && cat.pieces.length > 0) {
    for (let band = 1; band <= rules.bands; band++) {
      const t = topBuilds(rules, cat, band);
      top.push(t);
      counts.push({ what: `top builds, band ${band}`, full: t.full, walked: t.states });
      const over = t.ratioPermille > rules.topOverMedianMaxPermille;
      rows.push({
        id: `top_builds:${band}`,
        status: over ? 'warn' : 'pass',
        detail: `the strongest scores ${t.top[0]?.score ?? 0} of ${(CATEGORIES.length) * 1000}; median ${t.median} (all tiers), ${t.medianOwnTier} (the band's own tier); ${t.ratioPermille} permille of the median${over ? `, above ${rules.topOverMedianMaxPermille}` : ''}`,
      });
    }
  }
  return { source: cat.source, rows, hours, walls, windows: [], top, counts };
}

/** The rows `pnpm check` holds content to: each passes on content as it stands. */
export const WIRED_ROWS = ['curve_t1', 'ceilings', 'effect_graph_acyclic', 'xp_sources', 'common_plain', 'rarity_effects_max'] as const;
