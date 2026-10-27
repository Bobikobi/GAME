/**
 * What the coverage report reads (PROGRESSION.md 4.9): the built schools and
 * every touch from `content/`, the proposed schools from a design page's
 * tables, and the effect names the code reads (the static grep of 4.6).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { Bundle } from '@game/kernel';
import { type Band, type CoverageNode, type CoverageSchool, type Touch, bandOfLevel, isFirstCatalogue, isOutsideCount, parseProposals } from './coverage';

/** Every `.ts` file under the given directories, tests left out, sorted. */
function sourceFiles(dirs: string[]): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    for (const name of readdirSync(d).sort()) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) {
        if (name !== 'node_modules' && name !== 'test') walk(p);
      } else if (name.endsWith('.ts') && !name.endsWith('.test.ts') && !name.endsWith('.d.ts')) out.push(p);
    }
  };
  for (const d of dirs) walk(d);
  return out;
}

/** The effect names that appear as a string literal in the code (the kernel and the client): an effect read somewhere. */
export function readEffects(dirs: string[], effects: string[]): Set<string> {
  const text = sourceFiles(dirs)
    .map((f) => readFileSync(f, 'utf8'))
    .join('\n');
  return new Set(effects.filter((e) => text.includes(`'${e}'`) || text.includes(`"${e}"`)));
}

/** A built node's band: its own `band` when the format has one, else three main-line steps a band along its chain of needs. */
function builtBand(nodes: { id: string; needs?: string[]; band?: unknown }[], id: string): Band {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const own = byId.get(id)?.band;
  if (typeof own === 'number' && own >= 1 && own <= 4) return own as Band;
  if (own === 'crown') return 5;
  const depth = (nid: string, seen: Set<string>): number => {
    if (seen.has(nid)) return 0;
    seen.add(nid);
    const needs = byId.get(nid)?.needs ?? [];
    return needs.length === 0 ? 0 : 1 + Math.max(...needs.map((m) => depth(m, seen)));
  };
  return Math.min(4, 1 + Math.floor(depth(id, new Set()) / 3)) as Band;
}

export function builtSchools(b: Bundle, read: Set<string>): CoverageSchool[] {
  return Object.keys(b.schools)
    .sort()
    .map((id) => {
      const sc = b.schools[id]!;
      const nodes: CoverageNode[] = sc.nodes.map((n) => ({
        id: n.id,
        band: builtBand(sc.nodes, n.id),
        effect: n.effect,
        waitsOn: read.has(n.effect) ? '' : `a reader for ${n.effect}`,
        ownLine: false,
      }));
      return { name: sc.name, built: true, firstCatalogue: true, outsideCount: false, nodes };
    });
}

export function proposedSchools(md: string, built: Set<string>): CoverageSchool[] {
  return parseProposals(md)
    .filter((p) => !built.has(p.name))
    .map((p) => ({ name: p.name, built: false, firstCatalogue: isFirstCatalogue(p.state), outsideCount: isOutsideCount(p.state), nodes: p.nodes }));
}

/** Every touch the content makes, keyed by school name. */
export function contentTouches(b: Bundle): Touch[] {
  const byProfession = new Map<string, string>();
  const byId = new Map<string, string>();
  for (const id of Object.keys(b.schools)) {
    const sc = b.schools[id]!;
    byProfession.set(sc.profession, sc.name);
    byId.set(id, sc.name);
    byId.set(sc.name, sc.name);
  }
  const schoolOf = (ref: string) => byId.get(ref) ?? byProfession.get(ref) ?? ref;
  const touches: Touch[] = [];
  const at = (profession: string, level: number, by: string) => {
    const school = byProfession.get(profession);
    if (school !== undefined) touches.push({ school, band: bandOfLevel(level), by });
  };
  for (const id of Object.keys(b.recipes).sort()) {
    const r = b.recipes[id]!;
    at(r.profession ?? b.stations[r.station] ?? b.verbs.craft, r.level ?? 1, `recipe ${id}`);
  }
  for (const id of Object.keys(b.resources).sort()) {
    const r = b.resources[id]!;
    at(r.tool === 'axe' ? b.verbs.fell : b.verbs.gather, r.level ?? 1, `resource ${id}`);
  }
  for (const id of Object.keys(b.treasures).sort()) {
    const t = b.treasures[id]! as { level?: number };
    if (typeof t.level === 'number') at(b.verbs.dig, t.level, `dig ${id}`);
  }
  // forward-compatible readers: the fields 3.6 proposes, read when the format has them
  for (const id of Object.keys(b.quests).sort()) {
    const q = b.quests[id]! as { reward?: { xp?: { school?: string } }; band?: { school?: string; band?: number } };
    const xp = q.reward?.xp?.school;
    if (typeof xp === 'string') touches.push({ school: schoolOf(xp), bandMax: 1, by: `quest ${id} pays it` });
    if (typeof q.band?.school === 'string' && typeof q.band.band === 'number') touches.push({ school: schoolOf(q.band.school), band: Math.min(5, Math.max(1, q.band.band)) as Band, by: `quest ${id} asks its band` });
  }
  for (const id of Object.keys(b.npcs).sort()) {
    const n = b.npcs[id]! as { teaches?: { school?: string; band_max?: number } };
    if (typeof n.teaches?.school === 'string') touches.push({ school: schoolOf(n.teaches.school), bandMax: Math.min(5, Math.max(1, n.teaches.band_max ?? 1)) as Band, by: `teacher ${id}` });
  }
  b.map.props.forEach((p, i) => {
    const c = (p as { crossing?: unknown }).crossing;
    if (typeof c === 'object' && c !== null) {
      const { kind, travel } = c as { kind?: string; travel?: number };
      if (typeof travel === 'number') touches.push({ school: 'Travel', band: bandOfLevel(travel), by: `crossing ${kind ?? 'way'} at prop ${i}` });
    }
  });
  return touches;
}
