/// <reference types="astro/client" />
/**
 * What the rules page reads (docs/team/GRUNT.md, item 12), every number from the file the game and the loop read it
 * from: .github/loop.json with its sentences from docs/loop/README.md, .github/points.json, content/values.lock.json
 * and the bounded numbers of content/core/params.json. These are the files `pnpm hub:data` copies into `parameters`,
 * so the page and the document cannot disagree. The conduct section is CONTRIBUTING.md's own.
 */
import loopFile from '../../../.github/loop.json';
import pointsFile from '../../../.github/points.json';
import lock from '../../../content/values.lock.json';
import params from '../../../content/core/params.json';
import loopReadme from '../../../docs/loop/README.md?raw';
import contributing from '../../../CONTRIBUTING.md?raw';

export interface Row {
  key: string;
  value: string;
  says: string;
}

/** The text of one `## <title>` section of a markdown file, without its heading. */
export function section(markdown: string, title: string): string {
  const start = markdown.indexOf(`\n## ${title}\n`);
  if (start < 0) throw new Error(`no "## ${title}" section`);
  const body = markdown.slice(start + title.length + 5);
  const end = body.search(/\n## /);
  return (end < 0 ? body : body.slice(0, end)).trim();
}

/** "- `quota.cap`: maximum allowance." -> the sentence for each key, from the loop's own README. */
const sentences = new Map(
  [...section(loopReadme, 'Parameters').matchAll(/^- `([a-z_.]+)`: (.+)$/gm)].map((m) => [m[1]!, m[2]!.replace(/^./, (c) => c.toUpperCase())]),
);

const show = (v: unknown): string => (Array.isArray(v) ? v.join(', ') : String(v));

/** Every key of .github/loop.json, nested ones with a dot, each with the README's sentence. */
export const loop: Row[] = Object.entries(loopFile).flatMap(([key, value]) =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? Object.entries(value).map(([k, v]) => ({ key: `${key}.${k}`, value: show(v), says: sentences.get(`${key}.${k}`) ?? '' }))
    : [{ key, value: show(value), says: sentences.get(key) ?? '' }],
);

const POINTS: Record<string, string> = {
  per_record: 'Points for each record a builder has in the game now.',
  per_commit: "Points for each commit that changed the builder's files.",
  per_approval: 'Points for each approval that counted on a merged proposal, by anyone but its author.',
  weekly_pool: "Points shared out each week by how much players use each builder's records.",
  weekly_pool_active: 'Whether the weekly pool is shared out. It stays off until usage is measured, and is then shared by usage, never by seniority.',
};

export const points: Row[] = Object.entries(pointsFile).map(([key, value]) => ({ key, value: show(value), says: POINTS[key] ?? '' }));

/** The anchored value of every item (rule R11), most valuable first. */
export const values: { id: string; value: number }[] = Object.entries(lock.values as Record<string, number>)
  .map(([id, value]) => ({ id, value }))
  .sort((a, b) => b.value - a.value || a.id.localeCompare(b.id));

/** How far a value may move from its anchor before `pnpm check` stops it, in per mille. */
export const driftBudget: number = (params.params as { drift_budget_permille: { value: number } }).drift_budget_permille.value;

/** The Conduct section of CONTRIBUTING.md, as its paragraphs. */
export const conduct: string[] = section(contributing, 'Conduct').split(/\n\s*\n/).map((p) => p.replace(/\s+/g, ' ').trim());
