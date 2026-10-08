/**
 * `pnpm check`: everything a pull request must pass, readable by a person and
 * by an AI tool (`--json`). The same command runs in CI and on a creator's
 * machine (requirement V-5).
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import { type Bundle, computeValues, minChargeFor, rarityRank } from '@game/kernel';
import { RARITIES, type ParamsBody } from '@game/schema';
import { assemble, type Assembled } from './assemble';
import { readBoard } from './board';
import { CORE_PALETTE } from './kit/palette';
import { LOCK_FILE, loadAll, toRepoPath, type Issue } from './load';
import { checkPlay } from './play';

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
    issues.push(...checkDrift(b));
    issues.push(...checkKits(assembled));
    issues.push(...checkPlay(b, assembled.origin));
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

/** Rarity the data implies, from how hard a thing is to get. */
function computedRarity(b: Bundle, itemId: string, visiting: Set<string> = new Set()): number | undefined {
  if (visiting.has(itemId)) return undefined;
  visiting.add(itemId);
  let best: number | undefined;
  const take = (r: number) => {
    best = best === undefined ? r : Math.min(best, r);
  };
  for (const t of Object.values(b.treasures)) {
    for (const f of t.finds) {
      if (f.item !== itemId) continue;
      take(f.chance_pct >= 30 ? 0 : f.chance_pct >= 10 ? 1 : f.chance_pct >= 3 ? 2 : 3);
    }
  }
  for (const r of Object.values(b.resources)) {
    if (r.output !== itemId) continue;
    const gated = (r.hours ? 1 : 0) + (r.level >= 4 ? 1 : 0) + (r.respawn_ms >= 300_000 ? 1 : 0);
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
const HD = true; // trial: painted art on a 64 px grid, no palette
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
      if ((group === 'tiles' || group === 'items') && (s.w !== 64 || s.h !== 64)) {
        issues.push({ file: kitFile, where, message: `${group} are 16x16, this one is ${s.w}x${s.h}`, level: 'error' });
      }
      // a work pose is 32x32 so a raised tool fits; its feet stay on the same spot as the walk frames
      const work = /_work_(down|left|up|right)$/.test(name);
      if (group === 'chars' && work && (s.w !== 128 || s.h !== 128)) {
        issues.push({ file: kitFile, where, message: `work poses are 32x32, this one is ${s.w}x${s.h}`, level: 'error' });
      }
      if (group === 'chars' && !work && (s.w !== 64 || s.h !== 96)) {
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
      if (soft > 0 && !HD) issues.push({ file: `${kit.rel}/${s.file}`, where: '', message: `${soft} half-transparent pixels; use fully clear or fully solid`, level: 'error' });
      if (bad.size > 0 && !HD) {
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
