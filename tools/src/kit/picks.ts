/**
 * The pick feeds the next round (DECISIONS 2026-10-27).
 *
 * Two small records close the loop of "best of three, judged by eye":
 *
 * - the picks manifest (`tools/kit-gen/rich-wave.manifest.jsonl`, one line per picked image, `picked` set by the
 *   owner) already says which seed and recipe drew each winner. `kit:gen` reads it and draws an entry again from
 *   the picked seed (kaggle, local) and recipe (kaggle), so one run with the pick plus one new seed replaces three
 *   blind seeds. The manifest is never written here.
 * - `kit:notes` (notes.ts) reads the run manifests of earlier rounds and copies a warning that came back on two or
 *   more draws of one entry into the spec entry's `notes`, which the prompt builders append after the detail.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

import { type DrawerId, type KaggleRecipe, KAGGLE_RECIPE_NAMES } from './drawers.js';

/** The curated record of picks the spec's wave wrote (rounds 1-6 of the rich wave). */
export const DEFAULT_PICKS = 'tools/kit-gen/rich-wave.manifest.jsonl';

/** The fields of a picks-manifest line that the next round reads; the line carries more. */
export interface PickLine {
  name: string;
  /** The spec the line was drawn from (repo-relative); a line with none matches any spec. */
  spec?: string;
  /** Set by the owner when this draw won (`the owner, by eye, <date>`); a line without it is not a pick. */
  picked?: string;
  drawer?: string;
  seed?: number;
  /** The kaggle recipe that drew it (`sdxl`, `flux`, `qwen`), when the line records one. */
  model_key?: string;
  round?: number;
  candidate?: number;
}

export function parsePickLines(text: string): PickLine[] {
  return text.split('\n').filter((l) => l.trim() !== '').map((l, i) => {
    const line = JSON.parse(l) as Partial<PickLine>;
    if (typeof line.name !== 'string') throw new Error(`picks manifest line ${i + 1} has no name`);
    return line as PickLine;
  });
}

export function readPicks(path: string): PickLine[] {
  return existsSync(path) ? parsePickLines(readFileSync(path, 'utf8')) : [];
}

export interface PickPlan {
  /** The picked seed, for a route that takes one. */
  seed?: number;
  /** The recipe the picked draw used, when the CLI and the environment left the recipe unset. */
  recipe?: KaggleRecipe;
  /** Where the pick came from, for `--dry`. */
  from: string;
}

export interface PickContext {
  /** The spec's repo-relative path, as manifest lines write it. */
  spec: string;
  drawer: DrawerId;
  env: NodeJS.ProcessEnv;
}

/** Did the CLI or the environment choose the kaggle recipe? Then the pick does not override it. */
export function recipeIsExplicit(env: NodeJS.ProcessEnv): boolean {
  return ['KAGGLE_MODEL', 'KAGGLE_RECIPE'].some((name) => (env[name] ?? '').trim() !== '');
}

/**
 * What the pick of an entry changes about drawing it again, or null when it has none. The last picked line of the
 * name wins. A seed only means something on the route that drew it, so a pick from another route carries none; the
 * recipe only applies on kaggle and only when it is a recipe the route knows and the environment did not set one.
 */
export function pickPlan(name: string, picks: readonly PickLine[], ctx: PickContext): PickPlan | null {
  const line = [...picks].reverse().find((p) => p.name === name && typeof p.picked === 'string' && p.picked.trim() !== ''
    && (p.spec === undefined || p.spec === ctx.spec));
  if (line === undefined) return null;
  const plan: PickPlan = { from: line.picked ?? '' };
  const sameRoute = line.drawer === undefined || line.drawer === ctx.drawer;
  if (sameRoute && (ctx.drawer === 'kaggle' || ctx.drawer === 'local') && typeof line.seed === 'number' && Number.isInteger(line.seed)) plan.seed = line.seed;
  if (ctx.drawer === 'kaggle' && sameRoute && !recipeIsExplicit(ctx.env) && line.model_key !== undefined
    && (KAGGLE_RECIPE_NAMES as readonly string[]).includes(line.model_key)) plan.recipe = line.model_key as KaggleRecipe;
  return plan.seed === undefined && plan.recipe === undefined ? null : plan;
}

/** One `--dry` line: which entry carries a pick, with its seed and recipe. */
export function describePick(name: string, plan: PickPlan): string {
  return `${name}: pick of ${plan.from.replace(/^the owner, by eye, /, '')}: ${[plan.seed === undefined ? null : `seed ${plan.seed}`, plan.recipe === undefined ? null : `recipe ${plan.recipe}`].filter((x) => x !== null).join(', ')}`;
}

/* ---- notes: warnings that came back twice ---- */

/** The warning with its numbers blanked, so "53x83" and "54x83" count as one complaint. */
export function warningKey(warning: string): string {
  return warning.replace(/\d+/g, 'N');
}

/**
 * A warning as a clause a prompt can carry. The importer's two grid warnings end in the advice the next draw
 * needs, as words a diffusion model reads (no pixel counts, which `sdClause` drops anyway); any other warning is
 * kept as it is.
 */
export function noteFor(warning: string): string {
  if (warning.startsWith('drawn on a coarser grid')) return 'more fine detail';
  if (/^drawn on \d+x\d+, between one and two times the grid/.test(warning)) return 'fewer, bigger details';
  return warning;
}

export interface RunLine {
  name: string;
  warnings?: string[];
  at?: string;
}

/** Warnings per entry name, from one or more run manifests: a warning counts once per draw, and a draw read twice (the same file named twice) once. */
export function repeatedWarnings(runs: readonly RunLine[]): Map<string, string[]> {
  const seenDraws = new Set<string>();
  const counts = new Map<string, Map<string, { count: number; first: string }>>();
  for (const line of runs) {
    const draw = `${line.name}|${line.at ?? ''}`;
    if (line.at !== undefined && seenDraws.has(draw)) continue;
    seenDraws.add(draw);
    const byKey = counts.get(line.name) ?? new Map<string, { count: number; first: string }>();
    counts.set(line.name, byKey);
    for (const key of new Set((line.warnings ?? []).map(warningKey))) {
      const first = (line.warnings ?? []).find((w) => warningKey(w) === key) ?? key;
      const seen = byKey.get(key);
      if (seen === undefined) byKey.set(key, { count: 1, first });
      else seen.count += 1;
    }
  }
  const out = new Map<string, string[]>();
  for (const [name, byKey] of counts) {
    const repeated = [...byKey.values()].filter((w) => w.count >= 2).map((w) => noteFor(w.first));
    if (repeated.length > 0) out.set(name, [...new Set(repeated)]);
  }
  return out;
}

export function parseRunLines(text: string): RunLine[] {
  return text.split('\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l) as RunLine);
}

/**
 * The spec text with `notes` merged into its entries: existing notes stay (a hand-written one is the owner's),
 * new ones are added once, so running it again changes nothing. The spec's own `note`, its entry order and every
 * other field are kept; 2-space indent and a trailing newline. Returns the text unchanged when nothing is new,
 * so an untouched spec is never reformatted.
 */
export function mergeNotes(specText: string, repeated: ReadonlyMap<string, readonly string[]>): { text: string; added: Record<string, string[]> } {
  const json = JSON.parse(specText) as { entries?: { name: string; notes?: string[] }[] };
  const added: Record<string, string[]> = {};
  for (const entry of json.entries ?? []) {
    const fresh = (repeated.get(entry.name) ?? []).filter((n) => !(entry.notes ?? []).includes(n));
    if (fresh.length === 0) continue;
    entry.notes = [...(entry.notes ?? []), ...fresh];
    added[entry.name] = fresh;
  }
  return Object.keys(added).length === 0 ? { text: specText, added } : { text: `${JSON.stringify(json, null, 2)}\n`, added };
}

export function writeNotes(specPath: string, runPaths: readonly string[]): Record<string, string[]> {
  const runs = runPaths.flatMap((p) => parseRunLines(readFileSync(p, 'utf8')));
  const { text, added } = mergeNotes(readFileSync(specPath, 'utf8'), repeatedWarnings(runs));
  if (Object.keys(added).length > 0) writeFileSync(specPath, text);
  return added;
}
