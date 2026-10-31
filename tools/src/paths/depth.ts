/**
 * pnpm paths:depth: how deep each path of the tree is today (docs/design/PATHS.md).
 * A path is a school (DECISIONS.md, 2026-10-23, "The skill tree's format"). Read-only: every
 * number comes from the assembled content, nothing is typed by hand, and the same content gives
 * the same table on every run. Flags: --json.
 */
import { fileURLToPath } from 'node:url';
import { nodeVerb, type Bundle, type Verb } from '@game/kernel';
import { hoursTenths, masteryMs } from '../balance/curve';
import type { Rules } from '../balance/rules';
import { loadWorld } from '../balance/world';

export interface PathDepth {
  /** the school's id, the sort key */
  id: string;
  name: string;
  profession: string;
  /** the nodes of the school, by size */
  nodes: { total: number; small: number; major: number; corner: number; keystone: number };
  /** nodes that are techniques: they count only while they sit in the build */
  slotted: number;
  /** the longest chain of needs inside the school, counted in nodes */
  chain: number;
  /** active hours (in tenths) from level 1 to the profession's last level today: the last of its `xp_levels` */
  masteryTenths: number;
  /** the profession's own older techniques, which still count beside the nodes */
  professionTechniques: number;
  /** recipes the profession gates: a recipe's own `profession`, else the one that works its station */
  recipes: number;
  /** the highest recipe level of those */
  recipeLevelTop: number;
  /** the distinct tiers of the items the path makes, gathers or digs up, sorted */
  tiers: number[];
  /** tool items a node of the path asks for, or that make a mined node faster */
  tools: string[];
  /** kinds of node (resource files and dig files) that train the path */
  placeKinds: number;
  /** placed nodes and dig spots on the map that train it, plus the camp parts that provide its stations */
  places: number;
  /** quests with a step the path trains (a make, a bring or a find of what it makes), derived */
  quests: string[];
}

export interface DepthReport {
  paths: PathDepth[];
  /** active hours (in tenths) to master every path today, summed before rounding */
  totalTenths: number;
  /** active hours (in tenths) the balance model gives one school: `t1_ms` and the ratio over `school_steps` steps */
  modelTenths: number;
  /** the fewest active hours that master every school of the catalogue (`balance.catalogue_hours_min`), in tenths */
  catalogueTenths: number;
  /** tool items no school names (a staff, a hammer) */
  toolsNoSchool: string[];
  /** quests with no step any path trains */
  questsNoSchool: string[];
  questsTotal: number;
}

/** A pick or a hammer in the bag makes a mined node faster (schema, `Resource.work`), so they belong to digging. */
const MINING_TOOLS = ['pick', 'hammer'];

function longestChain(nodes: { id: string; needs?: string[] }[]): number {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const memo = new Map<string, number>();
  const depth = (id: string, seen: Set<string>): number => {
    const hit = memo.get(id);
    if (hit !== undefined) return hit;
    if (seen.has(id)) return 0;
    seen.add(id);
    // a need that names another school ("<school>/<node>") ends the chain at this school's border
    const needs = (byId.get(id)?.needs ?? []).filter((m) => byId.has(m));
    const d = 1 + (needs.length === 0 ? 0 : Math.max(...needs.map((m) => depth(m, seen))));
    seen.delete(id);
    memo.set(id, d);
    return d;
  };
  return nodes.length === 0 ? 0 : Math.max(...nodes.map((n) => depth(n.id, new Set())));
}

export function pathsDepth(b: Bundle, rules: Rules): DepthReport {
  const bySchool = new Map<string, PathDepth>(); // by profession id
  const schoolIds = Object.keys(b.schools).sort();
  for (const id of schoolIds) {
    const sc = b.schools[id]!;
    const count = (size: string) => sc.nodes.filter((n) => n.size === size).length;
    bySchool.set(sc.profession, {
      id,
      name: sc.name,
      profession: sc.profession,
      nodes: { total: sc.nodes.length, small: count('small'), major: count('major'), corner: count('corner'), keystone: count('keystone') },
      slotted: sc.nodes.filter((n) => n.slot === true).length,
      chain: longestChain(sc.nodes),
      masteryTenths: hoursTenths((b.professions[sc.profession]?.xp_levels.at(-1) ?? 0) * 1000),
      professionTechniques: b.professions[sc.profession]?.techniques?.length ?? 0,
      recipes: 0,
      recipeLevelTop: 0,
      tiers: [],
      tools: [],
      placeKinds: 0,
      places: 0,
      quests: [],
    });
  }
  const tiersOf = new Map<string, Set<number>>();
  const addTier = (prof: string, item: string) => {
    if (!bySchool.has(prof)) return;
    const set = tiersOf.get(prof) ?? new Set<number>();
    set.add(b.items[item]?.tier ?? 1);
    tiersOf.set(prof, set);
  };

  const recipeProfession = (id: string): string => {
    const r = b.recipes[id]!;
    return r.profession ?? b.stations[r.station] ?? b.verbs.craft;
  };
  for (const id of Object.keys(b.recipes).sort()) {
    const prof = recipeProfession(id);
    const row = bySchool.get(prof);
    if (row === undefined) continue;
    row.recipes += 1;
    row.recipeLevelTop = Math.max(row.recipeLevelTop, b.recipes[id]!.level ?? 1);
    for (const o of b.recipes[id]!.outputs) addTier(prof, o.item);
  }

  // what each profession's nodes ask: the tool kinds, the kinds of node
  const toolKinds = new Map<string, Set<string>>();
  const wantTool = (prof: string, kind: string | undefined) => {
    if (kind === undefined) return;
    const set = toolKinds.get(prof) ?? new Set<string>();
    set.add(kind);
    toolKinds.set(prof, set);
  };
  const verbOfResource = new Map<string, Verb>();
  for (const id of Object.keys(b.resources).sort()) {
    const r = b.resources[id]!;
    const verb = nodeVerb(r);
    verbOfResource.set(id, verb);
    const prof = b.verbs[verb];
    const row = bySchool.get(prof);
    if (row === undefined) continue;
    row.placeKinds += 1;
    wantTool(prof, r.tool);
    addTier(prof, r.output);
    if (r.work === 'mine') for (const k of MINING_TOOLS) wantTool(prof, k);
  }
  for (const id of Object.keys(b.treasures).sort()) {
    const t = b.treasures[id]!;
    const prof = b.verbs.dig;
    const row = bySchool.get(prof);
    if (row === undefined) continue;
    row.placeKinds += 1;
    wantTool(prof, t.tool);
    for (const f of t.finds) addTier(prof, f.item);
  }

  // placed nodes and dig spots (the map's instances), and the camp parts that provide a station
  for (const key of Object.keys(b.instances).sort()) {
    const inst = b.instances[key]!;
    const prof = inst.kind === 'treasure' ? b.verbs.dig : b.verbs[verbOfResource.get(inst.source) ?? 'gather'];
    const row = bySchool.get(prof);
    if (row !== undefined) row.places += 1;
  }
  for (const id of Object.keys(b.camps).sort()) {
    const c = b.camps[id]!;
    const station = c.provides;
    const prof = station === undefined ? undefined : b.stations[station];
    const row = prof === undefined ? undefined : bySchool.get(prof);
    if (row !== undefined) row.places += 1;
  }

  // tools: the tool items whose kind a node of the path asks for
  const named = new Set<string>();
  for (const [prof, kinds] of toolKinds) {
    const row = bySchool.get(prof);
    if (row === undefined) continue;
    for (const id of Object.keys(b.items).sort()) {
      const kind = b.items[id]!.tool?.kind;
      if (kind !== undefined && kinds.has(kind)) {
        row.tools.push(id);
        named.add(id);
      }
    }
  }
  const toolsNoSchool = Object.keys(b.items)
    .sort()
    .filter((id) => b.items[id]!.tool !== undefined && !named.has(id));

  // quests: a step a path trains
  const producers = (item: string): string[] => {
    const out = new Set<string>();
    for (const [id, r] of Object.entries(b.resources)) if (r.output === item) out.add(b.verbs[verbOfResource.get(id) ?? 'gather']);
    for (const t of Object.values(b.treasures)) if (t.finds.some((f) => f.item === item)) out.add(b.verbs.dig);
    for (const id of Object.keys(b.recipes)) if (b.recipes[id]!.outputs.some((o) => o.item === item)) out.add(recipeProfession(id));
    return [...out];
  };
  const questsNoSchool: string[] = [];
  const questIds = Object.keys(b.quests).sort();
  for (const qid of questIds) {
    const touched = new Set<string>();
    for (const step of b.quests[qid]!.steps ?? []) {
      if (step.kind === 'make') touched.add(recipeProfession(step.recipe));
      else if (step.kind === 'bring' || step.kind === 'find') for (const p of producers(step.item)) touched.add(p);
    }
    let any = false;
    for (const p of touched) {
      const row = bySchool.get(p);
      if (row !== undefined) {
        row.quests.push(qid);
        any = true;
      }
    }
    if (!any) questsNoSchool.push(qid);
  }

  for (const [prof, set] of tiersOf) bySchool.get(prof)!.tiers = [...set].sort((a, c) => a - c);
  return {
    paths: [...bySchool.values()].sort((a, c) => a.id.localeCompare(c.id)),
    totalTenths: hoursTenths(schoolIds.reduce((a, id) => a + (b.professions[b.schools[id]!.profession]?.xp_levels.at(-1) ?? 0) * 1000, 0)),
    modelTenths: hoursTenths(masteryMs(rules)),
    catalogueTenths: rules.catalogueHoursMin * 10,
    toolsNoSchool,
    questsNoSchool,
    questsTotal: questIds.length,
  };
}

const short = (id: string) => id.replace(/^core\//, '');
const tenths = (t: number) => `${Math.trunc(t / 10)}.${t % 10}`;

/** The table as markdown, the form PATHS.md quotes. */
export function formatDepth(r: DepthReport): string {
  const head = ['Path', 'Nodes (S/M/C/K)', 'Slotted', 'Chain', 'Hours to master', 'Prof. techniques', 'Recipes', 'Top recipe level', 'Tiers', 'Tools', 'Node kinds', 'Places', 'Quests'];
  const rows = r.paths.map((p) => [
    p.name,
    `${p.nodes.total} (${p.nodes.small}/${p.nodes.major}/${p.nodes.corner}/${p.nodes.keystone})`,
    String(p.slotted),
    String(p.chain),
    tenths(p.masteryTenths),
    String(p.professionTechniques),
    String(p.recipes),
    String(p.recipeLevelTop),
    p.tiers.length === 0 ? '-' : p.tiers.join(','),
    String(p.tools.length),
    String(p.placeKinds),
    String(p.places),
    String(p.quests.length),
  ]);
  const line = (cells: string[]) => `| ${cells.join(' | ')} |`;
  const out = [line(head), line(head.map(() => '---')), ...rows.map(line)];
  out.push('');
  for (const p of r.paths) out.push(`${p.name}: tools ${p.tools.map(short).join(', ') || '-'}; quests ${p.quests.map(short).join(', ') || '-'}`);
  out.push('');
  out.push(`Hours to master: ${tenths(r.totalTenths)} h for ${r.paths.length} paths today; the balance model gives one school ${tenths(r.modelTenths)} h, and the catalogue's floor is ${tenths(r.catalogueTenths)} h.`);
  out.push(`Tool items no path names: ${r.toolsNoSchool.map(short).join(', ') || '-'}`);
  out.push(`Quests no path trains (${r.questsNoSchool.length} of ${r.questsTotal}): ${r.questsNoSchool.map(short).join(', ') || '-'}`);
  return out.join('\n');
}

function main(): void {
  const { bundle, rules } = loadWorld();
  const report = pathsDepth(bundle, rules);
  console.log(process.argv.includes('--json') ? JSON.stringify(report, null, 2) : formatDepth(report));
}

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]) main();
