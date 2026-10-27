/**
 * The skill tree's wings (docs/design/GROWTH.md section 4; DECISIONS.md 2026-10-22 "The tree"): the
 * structural rules the format needs before any screen reads it. The balance rows of GROWTH 4.5 (a
 * school's share of the priced value, majors spread over the climb, the slot slack) come with the
 * content wave that writes the real nodes.
 */
import type { Bundle } from '@game/kernel';
import type { Issue } from './load';

/** At most this many nodes a player of one race sees in a school: the path and that race's corner (GROWTH section 4.1, `nodes_max`). */
export const SCHOOL_NODES_MAX = 12;

/**
 * The skill tree's wings (docs/design/GROWTH.md section 4.5, the part the format needs now): a school
 * names a profession, one school per profession; node ids are unique in their school; `needs` names
 * nodes of the same school and makes no cycle; a corner node names a race and every other node none;
 * a race has at most one corner in each school (a creator's race may have none yet); only a major or
 * a corner node is a technique (`slot`); an icon is an item; the growth params exist when a school
 * does, and no slot opens before the one ahead of it.
 */
export function checkSchools(b: Bundle, origin: Record<string, string>): Issue[] {
  const issues: Issue[] = [];
  const at = (id: string) => origin[id] ?? 'content/core';
  const err = (id: string, where: string, message: string) => issues.push({ file: at(id), where, message, level: 'error' });
  const ids = Object.keys(b.schools).sort();
  if (ids.length > 0 && !b.params.growth) err(ids[0]!, 'school', 'the params file has no "growth" group: a school needs its costs and slots');
  const levels = b.params.growth?.slot_levels ?? [];
  levels.forEach((l, i) => {
    if (i > 0 && l < levels[i - 1]!) err('content/core/params.json', `params.growth.slot_levels.${i}`, 'a later slot never opens before an earlier one');
  });
  const byProfession: Record<string, string> = {};
  for (const id of ids) {
    const sc = b.schools[id]!;
    if (!b.professions[sc.profession]) err(id, 'school.profession', `no profession "${sc.profession}"`);
    else if (byProfession[sc.profession]) err(id, 'school.profession', `"${sc.profession}" already has the school ${byProfession[sc.profession]}`);
    else byProfession[sc.profession] = id;
    const nodes = new Map<string, (typeof sc.nodes)[number]>();
    sc.nodes.forEach((n, i) => {
      const where = `school.nodes.${i}`;
      if (nodes.has(n.id)) err(id, `${where}.id`, `"${n.id}" is used twice in this school`);
      nodes.set(n.id, n);
      if (n.size === 'corner') {
        if (n.race === undefined) err(id, `${where}.race`, 'a corner node names the race it belongs to');
        else if (!b.races[n.race]) err(id, `${where}.race`, `no race "${n.race}"`);
      } else if (n.race !== undefined) err(id, `${where}.race`, 'only a corner node belongs to a race');
      if (n.slot === true && n.size === 'small') err(id, `${where}.slot`, 'a small node is always on: only a major or a corner node is a technique');
      if (n.icon !== undefined && !b.items[n.icon]) err(id, `${where}.icon`, `no item "${n.icon}"`);
    });
    sc.nodes.forEach((n, i) => {
      for (const need of n.needs ?? []) {
        if (need === n.id || !nodes.has(need)) err(id, `school.nodes.${i}.needs`, `no node "${need}" before it in this school`);
      }
    });
    // no cycle: every node's chain of needs ends
    const state = new Map<string, 'open' | 'done'>();
    const visit = (nid: string): boolean => {
      if (state.get(nid) === 'done') return true;
      if (state.get(nid) === 'open') return false;
      state.set(nid, 'open');
      const ok = (nodes.get(nid)?.needs ?? []).every((m) => !nodes.has(m) || visit(m));
      state.set(nid, 'done');
      return ok;
    };
    for (const n of sc.nodes) if (!visit(n.id)) err(id, 'school.nodes', `the needs of "${n.id}" go round in a circle`);
    const path = sc.nodes.filter((n) => n.size !== 'corner').length;
    for (const race of Object.keys(b.races).sort()) {
      const corners = sc.nodes.filter((n) => n.size === 'corner' && n.race === race).length;
      if (corners > 1) err(id, 'school.nodes', `the race "${race}" has ${corners} corner nodes here; a race has at most one in each school`);
      if (path + corners > SCHOOL_NODES_MAX) err(id, 'school.nodes', `a player of "${race}" sees ${path + corners} nodes here; at most ${SCHOOL_NODES_MAX}`);
    }
  }
  return issues;
}
