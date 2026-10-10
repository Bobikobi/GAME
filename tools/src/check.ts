/**
 * `pnpm check`: everything a pull request must pass, readable by a person and
 * by an AI tool (`--json`). The same command runs in CI and on a creator's
 * machine (requirement V-5).
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import { type Bundle, computeValues, minChargeFor, missOutcome, rarityBudget, rarityRank } from '@game/kernel';
import { RARITIES, type ParamsBody } from '@game/schema';
import { assemble, type Assembled } from './assemble';
import { readBoard } from './board';
import { CORE_PALETTE } from './kit/palette';
import { LOCK_FILE, loadAll, toRepoPath, type Issue } from './load';
import { baseOf } from './material';
import { checkPlay } from './play';
import { checkDeadProps } from './deadprops';
import { checkReach } from './reach';
import { checkStarts } from './starts';

export interface CheckResult {
  issues: Issue[];
  files: number;
  assembled: Assembled;
}

/** `root` is the content folder; tests point it at a copy with extra files. */
export function runCheck(root?: string): CheckResult {
  const { files, issues } = loadAll(root);
  const assembled = assemble(files, root ? {} : readBoard());
  issues.push(...assembled.issues);
  const b = assembled.bundle;
  if (b) {
    const paramsFile = files.find((f) => f.data.type === 'params')?.data;
    issues.push(...checkParams(paramsFile?.type === 'params' ? paramsFile : undefined));
    issues.push(...checkEconomy(b, assembled.origin));
    issues.push(...checkCrafting(b, assembled.origin));
    issues.push(...checkWear(b));
    issues.push(...checkDrift(b));
    issues.push(...checkKits(assembled));
    issues.push(...checkPlay(b, assembled.origin));
    issues.push(...checkStarts(b, assembled.origin));
    issues.push(...checkReach(b, assembled.origin));
    issues.push(...checkDeadProps(b, assembled.origin));
  }
  return { issues: dedupe(issues), files: files.length, assembled };
}

function dedupe(issues: Issue[]): Issue[] {
  const seen = new Set<string>();
  return issues.filter((i) => {
    const k = `${i.file}|${i.where}|${i.message}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Rule R12: every constant sits inside its own bounds. */
function checkParams(file: { params?: ParamsBody } | undefined): Issue[] {
  const issues: Issue[] = [];
  if (!file?.params) return issues;
  const visit = (node: unknown, path: string) => {
    if (typeof node !== 'object' || node === null || Array.isArray(node)) return;
    const o = node as Record<string, unknown>;
    if (typeof o.value === 'number' && typeof o.min === 'number' && typeof o.max === 'number') {
      if (o.min > o.max) issues.push({ file: 'content/core/params.json', where: path, message: 'min is above max', level: 'error' });
      if (o.value < o.min || o.value > o.max) {
        issues.push({ file: 'content/core/params.json', where: path, message: `value ${o.value} is outside [${o.min}, ${o.max}]`, level: 'error' });
      }
      return;
    }
    for (const [k, v] of Object.entries(o)) visit(v, path ? `${path}.${k}` : k);
  };
  visit(file.params, 'params');
  const caps = file.params.power_cap_permille;
  for (let i = 1; i < caps.length; i++) {
    if ((caps[i] ?? 0) < (caps[i - 1] ?? 0)) {
      issues.push({ file: 'content/core/params.json', where: `params.power_cap_permille.${i}`, message: 'the power cap may not fall with level', level: 'error' });
    }
  }
  return issues;
}

/** A respawn at least this slow makes a node rarer (V-2) and gates a high tier. */
const SLOW_RESPAWN_MS = 300_000;

/** Rarity the data implies, from how hard a thing is to get. */
function computedRarity(b: Bundle, itemId: string, visiting: Set<string> = new Set()): number | undefined {
  if (visiting.has(itemId)) return undefined;
  visiting.add(itemId);
  let best: number | undefined;
  const take = (r: number) => {
    best = best === undefined ? r : Math.min(best, r);
  };
  for (const t of Object.values(b.treasures)) {
    if (t.starter !== undefined) continue; // a start's own find is a gift, not how the item is obtained
    for (const f of t.finds) {
      if (f.item !== itemId) continue;
      take(f.chance_pct >= 30 ? 0 : f.chance_pct >= 10 ? 1 : f.chance_pct >= 3 ? 2 : 3);
    }
  }
  for (const r of Object.values(b.resources)) {
    if (r.output !== itemId) continue;
    const gated = (r.hours ? 1 : 0) + (r.level >= 4 ? 1 : 0) + (r.respawn_ms >= SLOW_RESPAWN_MS ? 1 : 0);
    take(Math.min(3, gated));
  }
  for (const c of Object.values(b.recipes)) {
    if (!c.outputs.some((o) => o.item === itemId)) continue;
    const inputs = c.inputs.map((s) => computedRarity(b, s.item, visiting) ?? 0);
    take(Math.min(3, Math.max(0, ...inputs) + (c.known === 'found' ? 1 : 0)));
  }
  visiting.delete(itemId);
  return best;
}

/** Rules R6-R8 and V-2: activity records, the computed value table, shop prices, declared rarity. */
function checkEconomy(b: Bundle, origin: Record<string, string>): Issue[] {
  const issues: Issue[] = [];
  const at = (id: string) => origin[id] ?? b.items[id]?.file ?? 'content';
  const p = b.params;
  const timed: [string, string, number][] = [
    ...Object.values(b.resources).map((r) => [r.id, 'node.active_ms', r.active_ms] as [string, string, number]),
    ...Object.values(b.treasures).map((t) => [t.id, 'dig.active_ms', t.active_ms] as [string, string, number]),
    ...Object.values(b.recipes).map((c) => [c.id, 'recipe.active_ms', c.active_ms] as [string, string, number]),
  ];
  for (const [id, where, ms] of timed) {
    if (ms < p.t_min_ms || ms > p.max_action_ms) {
      issues.push({ file: at(id), where, message: `active time ${ms} ms is outside [${p.t_min_ms}, ${p.max_action_ms}] ms`, level: 'error' });
    }
  }

  const table = computeValues(b);
  for (const v of table.issues) issues.push({ file: at(v.source), where: '', message: v.message, level: 'error' });

  // R7 reachability: everything asked for must be obtainable somewhere
  const sold = new Set(Object.values(b.shops).flatMap((s) => s.sells.map((o) => o.item)));
  const rewarded = new Set(Object.values(b.quests).flatMap((q) => (q.reward.items ?? []).map((s) => s.item)));
  const obtainable = (id: string) => b.values[id] !== undefined || sold.has(id) || rewarded.has(id);
  const needs: [string, string, string][] = [
    ...Object.values(b.recipes).flatMap((c) => c.inputs.map((s, i) => [c.id, `recipe.inputs.${i}`, s.item] as [string, string, string])),
    ...Object.values(b.restores).flatMap((r) => r.inputs.map((s, i) => [r.id, `restore.inputs.${i}`, s.item] as [string, string, string])),
    ...Object.values(b.camps).flatMap((c) => c.inputs.map((s, i) => [c.id, `camp.inputs.${i}`, s.item] as [string, string, string])),
    ...Object.values(b.quests).flatMap((q) =>
      q.steps.flatMap((st, i) => (st.kind === 'bring' ? [[q.id, `quest.steps.${i}`, st.item] as [string, string, string]] : [])),
    ),
  ];
  for (const [id, where, item] of needs) {
    if (b.items[item] && !obtainable(item)) issues.push({ file: at(id), where, message: `nothing in the world gives "${item}"`, level: 'error' });
  }

  // R8: a shop never sells a valued item below its value
  for (const s of Object.values(b.shops)) {
    s.sells.forEach((o, i) => {
      const v = b.values[o.item];
      if (v !== undefined && o.price_mg < minChargeFor(p, v)) {
        issues.push({
          file: at(s.id),
          where: `shop.sells.${i}.price_mg`,
          message: `${o.item} is worth ${minChargeFor(p, v)} mg; the shop may not sell it for less`,
          level: 'error',
        });
      }
    });
  }

  // V-2: declared rarity within one tier of what the data implies
  for (const [id, it] of Object.entries(b.items)) {
    const computed = computedRarity(b, id);
    if (computed === undefined) continue;
    const declared = rarityRank(it.rarity);
    if (Math.abs(declared - computed) > 1) {
      issues.push({
        file: it.file,
        where: `items.${id}.rarity`,
        message: `declared "${it.rarity}", but how it is obtained makes it "${RARITIES[computed]}"`,
        level: 'error',
      });
    }
  }
  return issues;
}

const PARAMS_FILE = 'content/core/params.json';
/** From this tier up an item comes only from a gated source (DECISIONS.md, 2026-10-09). */
const GATED_TIER = 3;

/**
 * The material grammar and the two ladders (DECISIONS.md, 2026-10-09: the
 * grammar, the ladders, one craft verb, metal): every item has a class and a
 * tier, every tier a level band, a recipe climbs one tier at a time at a
 * station of its tier and is gated by one craft profession, a high tier comes
 * from a gated source, and the world's rarity bonuses stay inside their
 * budget (kernel review 8.2).
 */
function checkCrafting(b: Bundle, origin: Record<string, string>): Issue[] {
  const issues: Issue[] = [];
  const p = b.params;
  const at = (id: string) => origin[id] ?? b.items[id]?.file ?? 'content';
  const err = (file: string, where: string, message: string) => issues.push({ file, where, message, level: 'error' });
  const tierOf = (id: string) => b.items[id]?.tier ?? 1;
  const worth = (stacks: readonly { item: string; qty: number }[]) => stacks.reduce((n, s) => n + (b.values[s.item] ?? 0) * s.qty, 0);

  // the level bands: tier 1 starts at level 1, each next tier higher
  const starts = p.tier_min_level;
  if (starts[0] !== 1) err(PARAMS_FILE, 'params.tier_min_level.0', 'tier 1 starts at level 1');
  for (let i = 1; i < starts.length; i++) {
    if (starts[i]! <= starts[i - 1]!) err(PARAMS_FILE, `params.tier_min_level.${i}`, 'each tier starts at a higher level than the one before');
  }
  if (starts.length < p.open_tiers) {
    err(PARAMS_FILE, 'params.tier_min_level', `${starts.length} entries for ${p.open_tiers} open tiers: every open tier needs one`);
  }
  const band = (tier: number): [number, number] => [starts[tier - 1] ?? 1, (starts[tier] ?? 21) - 1];
  // the craft chance never rises with the tier, and the cap on a worn effect never falls (G40, G44)
  const chances = p.craft_chance_bp;
  for (let i = 1; i < chances.length; i++) {
    if (chances[i]! > chances[i - 1]!) err(PARAMS_FILE, `params.craft_chance_bp.${i}`, 'the craft chance never rises with the tier');
  }
  const wornCaps = p.wear_effect_max_pct;
  for (let i = 1; i < wornCaps.length; i++) {
    if (wornCaps[i]! < wornCaps[i - 1]!) err(PARAMS_FILE, `params.wear_effect_max_pct.${i}`, 'the cap on a worn effect never falls with the tier');
  }

  for (const [id, it] of Object.entries(b.items)) {
    const where = `items.${id}`;
    if (it.class === undefined || it.tier === undefined) {
      err(it.file, where, 'every item names a "class" and a "tier"; see "Classes and tiers" in docs/creators/README.md');
      continue;
    }
    if (it.tier > p.open_tiers) err(it.file, `${where}.tier`, `tier ${it.tier} is not open yet: the world has tiers 1 to ${p.open_tiers}`);
    if (it.tool && it.tier !== it.tool.tier) err(it.file, `${where}.tier`, `a tool has the tier of its "tool": ${it.tool.tier}`);
    const base = baseOf(b, it.class);
    if (base === undefined) continue;
    if (base === 'metal') err(it.file, `${where}.class`, 'metal waits for its discovery: no metal items yet (DECISIONS.md, 2026-10-09)');
    if (it.kind === 'tool' && base !== 'tool') err(it.file, `${where}.class`, 'a tool is of class "tool"');
    if (it.kind !== 'tool' && base === 'tool') err(it.file, `${where}.class`, 'class "tool" is for items of kind "tool"');
    if (base === 'meal' && it.kind !== 'food') err(it.file, `${where}.class`, 'a meal is eaten: class "meal" is for items of kind "food"');
  }
  for (const [id, c] of Object.entries(b.classes)) {
    if (c.base === 'metal') err(c.file, `classes.${id}`, 'metal waits for its discovery: no classes under it yet (DECISIONS.md, 2026-10-09)');
  }

  // one craft profession per station
  const workedBy: Record<string, string> = {};
  for (const [id, pr] of Object.entries(b.professions)) {
    for (const station of pr.stations ?? []) {
      if (pr.verb !== 'craft') err(at(id), 'profession.stations', `${pr.name} trains "${pr.verb}": only a craft profession works stations`);
      else if (workedBy[station]) err(at(id), 'profession.stations', `the ${station} is already worked by ${workedBy[station]}`);
      else workedBy[station] = id;
    }
  }

  const stationTier: Record<string, number> = {};
  for (const c of Object.values(b.camps)) {
    const tier = c.tier ?? 1;
    if (tier > p.open_tiers) err(at(c.id), 'camp.tier', `tier ${tier} is not open yet: the world has tiers 1 to ${p.open_tiers}`);
    if (c.provides) stationTier[c.provides] = Math.max(stationTier[c.provides] ?? 0, tier);
  }

  // an upgrade stands in the slot of the part it replaces and gives at least what that part gave
  for (const c of Object.values(b.camps)) {
    const base = c.upgrades === undefined ? undefined : b.camps[c.upgrades];
    if (!base) continue;
    const file = at(c.id);
    if (base.slot !== c.slot) err(file, 'camp.upgrades', `an upgrade stands in the slot of the part it replaces: ${base.id} is in "${base.slot}", this one in "${c.slot}"`);
    if (base.provides !== undefined && c.provides !== base.provides) err(file, 'camp.upgrades', `${base.id} provides a ${base.provides}; an upgrade over it provides one too`);
    if ((c.tier ?? 1) < (base.tier ?? 1)) err(file, 'camp.upgrades', `an upgrade gives at least the tier of ${base.id} (${base.tier ?? 1})`);
    if ((c.bag_bonus ?? 0) < (base.bag_bonus ?? 0)) err(file, 'camp.upgrades', `an upgrade keeps at least the bag bonus of ${base.id} (${base.bag_bonus ?? 0})`);
    let cur: string | undefined = c.upgrades;
    for (let guard = 0; cur !== undefined && guard <= Object.keys(b.camps).length; guard++) {
      if (cur === c.id) {
        err(file, 'camp.upgrades', 'the upgrades go round in a circle: one part has to stand first');
        break;
      }
      cur = b.camps[cur]?.upgrades;
    }
  }

  for (const [id, c] of Object.entries(b.recipes)) {
    const file = at(id);
    const w = c.template ? 'template' : 'recipe';
    const named = (message: string) => (c.template ? `${message} (in the recipe "${id}")` : message);
    const top = Math.max(...c.inputs.map((s) => tierOf(s.item)));
    const tier = Math.max(...c.outputs.map((o) => tierOf(o.item)));
    c.outputs.forEach((o, i) => {
      const t = tierOf(o.item);
      if (t > top + 1) err(file, `${w}.outputs.${i}`, named(`${o.item} is tier ${t}; a recipe climbs one tier at most, and its highest input is tier ${top}`));
    });
    const [lo, hi] = band(tier);
    if (c.level < lo || c.level > hi) err(file, `${w}.level`, named(`a tier ${tier} recipe asks for a level from ${lo} to ${hi}, not ${c.level}`));
    const prof = c.profession ?? workedBy[c.station];
    const pr = prof === undefined ? undefined : b.professions[prof];
    if (prof === undefined) err(file, `${w}.station`, named(`no profession works the ${c.station}: name one in "profession"`));
    else if (pr && pr.verb !== 'craft') err(file, `${w}.profession`, named(`${pr.name} trains "${pr.verb}", not "craft"`));
    else if (pr && c.level > pr.xp_levels.length + 1) err(file, `${w}.level`, named(`${pr.name} stops at level ${pr.xp_levels.length + 1}`));
    const has = stationTier[c.station];
    if (has === undefined) err(file, `${w}.station`, named(`no camp part provides a ${c.station}`));
    else if (has < tier) err(file, `${w}.station`, named(`a tier ${tier} recipe needs a ${c.station} of tier ${tier}; the best camp part gives tier ${has}`));
    // a miss keeps part of the inputs, worth less than a success (G40)
    const left = worth(missOutcome(b, c).keep);
    const success = worth(c.outputs);
    if (success > 0 && left >= success) {
      err(file, `${w}.miss`, named(`a miss leaves ${left} of value, no less than a success gives (${success}): a miss keeps a part (G40)`));
    }
  }

  // from GATED_TIER up: a level gate or a slow respawn on a node, never a shop
  for (const r of Object.values(b.resources)) {
    const t = tierOf(r.output);
    if (t < GATED_TIER) continue;
    const gate = band(t)[0];
    if (r.level < gate && r.respawn_ms < SLOW_RESPAWN_MS) {
      err(at(r.id), 'node', `${r.output} is tier ${t}: its node needs level ${gate} or a respawn of at least ${SLOW_RESPAWN_MS} ms`);
    }
  }
  for (const s of Object.values(b.shops)) {
    s.sells.forEach((o, i) => {
      const t = tierOf(o.item);
      if (t >= GATED_TIER) err(at(s.id), `shop.sells.${i}`, `${o.item} is tier ${t}: from tier ${GATED_TIER} up a thing is found, made or earned, never sold`);
    });
  }

  // kernel review 8.2: (nodes / respawn) * bonus, summed over the merged world
  const budget = rarityBudget(b);
  if (budget.used_ppm > budget.limit_ppm) {
    const pct = (ppm: number) => `${(ppm / 10_000).toFixed(2)}%`;
    const largest = budget.parts[0]!;
    err(
      at(largest.id),
      '',
      `the rarity bonuses of the world add ${pct(budget.used_ppm)}, over the budget of ${pct(budget.limit_ppm)}; the largest part, ${pct(largest.ppm)}, is this one. Fewer nodes, a slower respawn or a lower rarity bring it back.`,
    );
  }
  return issues;
}

/**
 * Worn items and the premium marker (DECISIONS.md, 2026-10-09: the upgrade;
 * crafting and money): a worn item fits its class and its place, a work piece
 * carries small effects capped by its tier, a set can be worn whole, a look
 * counts for nothing, and only a look with no effect carries the premium
 * marker, while staying obtainable in the game (G39, G44).
 */
function checkWear(b: Bundle): Issue[] {
  const issues: Issue[] = [];
  const err = (file: string, where: string, message: string) => issues.push({ file, where, message, level: 'error' });
  const caps = b.params.wear_effect_max_pct;
  const sold = new Set(Object.values(b.shops).flatMap((s) => s.sells.map((o) => o.item)));
  const rewarded = new Set(Object.values(b.quests).flatMap((q) => (q.reward.items ?? []).map((s) => s.item)));
  const sets: Record<string, string[]> = {};
  for (const [id, it] of Object.entries(b.items)) {
    const where = `items.${id}`;
    const base = baseOf(b, it.class);
    const w = it.wear;
    if (!w) {
      if (base === 'garment' || base === 'jewelry') err(it.file, where, `a ${base} piece is worn: give it "wear" with its slot (G44)`);
      if (it.premium_later) err(it.file, `${where}.premium_later`, 'only a look item with no effect may carry the premium marker (G39)');
      continue;
    }
    if (it.kind === 'food' || it.kind === 'fragment') err(it.file, `${where}.wear`, `a ${it.kind} is not worn`);
    if (w.slot === 'hand') {
      if (it.kind !== 'tool') err(it.file, `${where}.wear.slot`, 'the hand holds a tool: an item of kind "tool"');
    } else if (w.slot === 'jewelry') {
      if (base !== 'jewelry') err(it.file, `${where}.wear.slot`, 'the jewelry places take items of class "jewelry"');
    } else if (base !== 'garment') {
      err(it.file, `${where}.wear.slot`, `the ${w.slot} takes items of class "garment"`);
    }
    if (w.look) {
      if (w.effects) err(it.file, `${where}.wear.effects`, 'a look shows and counts for nothing: it has no effects (G44)');
      if (w.set) err(it.file, `${where}.wear.set`, 'a look belongs to no set');
      if (w.slot === 'hand') err(it.file, `${where}.wear.slot`, 'the hand holds a working tool, not a look');
    }
    const tier = it.tier ?? 1;
    const cap = caps[Math.min(tier, caps.length) - 1] ?? 0;
    const named = new Set<string>();
    (w.effects ?? []).forEach((e, i) => {
      if (named.has(e.effect)) err(it.file, `${where}.wear.effects.${i}`, `${e.effect} is named twice: each effect once`);
      named.add(e.effect);
      if (e.value > cap) err(it.file, `${where}.wear.effects.${i}.value`, `a tier ${tier} piece gives at most ${cap}% (wear_effect_max_pct), not ${e.value}% (G44)`);
    });
    if (w.set) {
      if (!w.set.startsWith(`${it.creator}/`)) err(it.file, `${where}.wear.set`, `a set holds one creator's pieces: its id starts with "${it.creator}/"`);
      if (!w.look) (sets[w.set] ??= []).push(id);
    }
    if (it.premium_later) {
      if (!w.look || w.effects) err(it.file, `${where}.premium_later`, 'only a look item with no effect may carry the premium marker (G39)');
      else if (b.values[id] === undefined && !sold.has(id) && !rewarded.has(id)) {
        err(it.file, `${where}.premium_later`, 'a look with the premium marker stays obtainable in the game: a node, a dig spot, a recipe, a shop for gold or a quest gives it (G39)');
      }
    }
  }
  for (const [set, pieces] of Object.entries(sets).sort(([x], [y]) => (x < y ? -1 : 1))) {
    const first = b.items[pieces[0]!]!;
    const where = `items.${first.id}.wear.set`;
    if (pieces.length < 2) {
      err(first.file, where, `the set "${set}" has one piece: a set has two at least`);
      continue;
    }
    const per: Record<string, number> = {};
    for (const id of pieces) {
      const slot = b.items[id]!.wear!.slot;
      per[slot] = (per[slot] ?? 0) + 1;
    }
    const crowded = Object.keys(per)
      .sort()
      .filter((slot) => per[slot]! > (slot === 'jewelry' ? 2 : 1));
    if (per.outfit && (per.top || per.legs)) crowded.push('outfit');
    if (crowded.length > 0) err(first.file, where, `the set "${set}" cannot be worn whole: too many pieces for the ${crowded.join(', ')} (G44)`);
  }
  return issues;
}

/** Rule R11: values may move only within the drift budget of the committed anchor. */
function checkDrift(b: Bundle): Issue[] {
  const file = toRepoPath(LOCK_FILE);
  if (!existsSync(LOCK_FILE)) {
    return [{ file, where: '', message: 'no value anchor yet: run "pnpm values" and commit content/values.lock.json', level: 'warning' }];
  }
  const lock = JSON.parse(readFileSync(LOCK_FILE, 'utf8')) as { values: Record<string, number> };
  const issues: Issue[] = [];
  const budget = b.params.drift_budget_permille;
  for (const [id, v] of Object.entries(b.values)) {
    const old = lock.values[id];
    if (old === undefined || old === 0) continue;
    const drift = Math.abs(v - old) * 1000;
    if (drift > budget * old) {
      issues.push({
        file: b.items[id]?.file ?? file,
        where: id,
        message: `value moved from ${old} to ${v} (${Math.round(drift / old) / 10}%), over the ${budget / 10}% budget. A core maintainer re-anchors with "pnpm values".`,
        level: 'error',
      });
    }
  }
  return issues;
}

/** V-1: every sprite exists, has the published size, and uses the core palette only. */
function checkKits(a: Assembled): Issue[] {
  const issues: Issue[] = [];
  const allowed = new Set(CORE_PALETTE.map((h) => h.toLowerCase()));
  for (const [kitId, kit] of Object.entries(a.kits)) {
    const kitFile = `${kit.rel}/kit.json`;
    if (kit.palette && kit.palette.join(',') !== CORE_PALETTE.join(',')) {
      issues.push({ file: kitFile, where: 'kit.palette', message: 'differs from the core palette in tools/src/kit/palette.ts', level: 'error' });
    }
    for (const [name, s] of Object.entries(kit.sprites)) {
      const where = `kit.sprites.${name}`;
      const group = name.split('/')[0];
      if ((group === 'tiles' || group === 'items') && (s.w !== 16 || s.h !== 16)) {
        issues.push({ file: kitFile, where, message: `${group} are 16x16, this one is ${s.w}x${s.h}`, level: 'error' });
      }
      // a work pose is 32x32 so a raised tool fits; its feet stay on the same spot as the walk frames
      const work = /_work_(down|left|up|right)$/.test(name);
      if (group === 'chars' && work && (s.w !== 32 || s.h !== 32)) {
        issues.push({ file: kitFile, where, message: `work poses are 32x32, this one is ${s.w}x${s.h}`, level: 'error' });
      }
      if (group === 'chars' && !work && (s.w !== 16 || s.h !== 24)) {
        issues.push({ file: kitFile, where, message: `character frames are 16x24, this one is ${s.w}x${s.h}`, level: 'error' });
      }
      const abs = join(kit.dir, s.file);
      if (!existsSync(abs)) {
        issues.push({ file: kitFile, where, message: `missing file ${kit.rel}/${s.file}`, level: 'error' });
        continue;
      }
      let png: PNG;
      try {
        png = PNG.sync.read(readFileSync(abs));
      } catch {
        issues.push({ file: `${kit.rel}/${s.file}`, where: '', message: 'not a readable PNG', level: 'error' });
        continue;
      }
      if (png.width !== s.w * s.frames || png.height !== s.h) {
        issues.push({
          file: `${kit.rel}/${s.file}`,
          where: '',
          message: `is ${png.width}x${png.height}, the kit says ${s.w * s.frames}x${s.h} (${s.frames} frame${s.frames > 1 ? 's' : ''} of ${s.w}x${s.h})`,
          level: 'error',
        });
      }
      const bad = new Set<string>();
      let soft = 0;
      for (let i = 0; i < png.data.length; i += 4) {
        const alpha = png.data[i + 3]!;
        if (alpha === 0) continue;
        if (alpha !== 255) soft++;
        const hex = `#${[png.data[i]!, png.data[i + 1]!, png.data[i + 2]!].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
        if (!allowed.has(hex)) bad.add(hex);
      }
      if (soft > 0) issues.push({ file: `${kit.rel}/${s.file}`, where: '', message: `${soft} half-transparent pixels; use fully clear or fully solid`, level: 'error' });
      if (bad.size > 0) {
        issues.push({
          file: `${kit.rel}/${s.file}`,
          where: '',
          message: `${bad.size} colors outside the core palette (${[...bad].slice(0, 4).join(', ')}${bad.size > 4 ? ', ...' : ''}). Run it through "pnpm kit:import".`,
          level: 'error',
        });
      }
    }
    void kitId;
  }
  return issues;
}

export function formatIssues(result: CheckResult): string {
  const lines: string[] = [];
  const byFile = new Map<string, Issue[]>();
  for (const i of result.issues) byFile.set(i.file, [...(byFile.get(i.file) ?? []), i]);
  for (const [file, list] of [...byFile.entries()].sort()) {
    lines.push(`\n${file}`);
    for (const i of list) lines.push(`  ${i.level === 'error' ? 'x' : '!'} ${i.where ? `${i.where}: ` : ''}${i.message}`);
  }
  const errors = result.issues.filter((i) => i.level === 'error').length;
  const warnings = result.issues.length - errors;
  lines.push(`\n${result.files} files checked: ${errors} error${errors === 1 ? '' : 's'}, ${warnings} warning${warnings === 1 ? '' : 's'}.`);
  if (errors === 0) lines.push('Everything passes.');
  return lines.join('\n');
}
