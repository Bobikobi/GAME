/**
 * The skill tree's wings (docs/design/GROWTH.md section 4; DECISIONS.md 2026-10-22 "The tree" and
 * 2026-10-23 "The tree is data"): the structural rules a tree of any size keeps, from the five core
 * wings to hundreds of nodes. The balance rows of GROWTH 4.5 (a school's share of the priced value,
 * majors spread over the climb, the slot slack) come with the content wave that writes the real nodes.
 */
import { needKey, nodeKey, type Bundle } from '@game/kernel';
import type { Issue } from './load';

/**
 * The tree's rules: a school names a profession, one school per profession; node ids are unique in
 * their school; every need names a node that exists (in its school, or in another by its full key)
 * and no chain of needs goes round; each school's nodes hang together, so none stands alone; a corner
 * node names a race and every other node none; a race has at most one corner in each school (a
 * creator's race may have none yet) and sees at most `nodes_max` nodes in one; only a major or a corner
 * node is a technique (`slot`); a node's own price stays in its size's band; a cluster a node names is
 * one of its school's, and a cluster holds a node; a school gives every node a place or none, and no
 * two places are the same; an icon is an item; the growth params exist when a school does, and no slot
 * opens before the one ahead of it.
 */
export function checkSchools(b: Bundle, origin: Record<string, string>): Issue[] {
  const issues: Issue[] = [];
  const at = (id: string) => origin[id] ?? 'content/core';
  const err = (id: string, where: string, message: string) => issues.push({ file: at(id), where, message, level: 'error' });
  const ids = Object.keys(b.schools).sort();
  const growth = b.params.growth;
  if (ids.length > 0 && !growth) err(ids[0]!, 'school', 'the params file has no "growth" group: a school needs its costs and slots');
  const levels = growth?.slot_levels ?? [];
  levels.forEach((l, i) => {
    if (i > 0 && l < levels[i - 1]!) err('content/core/params.json', `params.growth.slot_levels.${i}`, 'a later slot never opens before an earlier one');
  });

  // every node of the tree by its key, for the needs that cross from one wing to another
  const all = new Map<string, { school: string; needs: string[] }>();
  for (const id of ids) {
    for (const n of b.schools[id]!.nodes) all.set(nodeKey(id, n.id), { school: id, needs: (n.needs ?? []).map((m) => needKey(id, m)) });
  }
  const places = new Map<string, string>();
  const byProfession: Record<string, string> = {};
  for (const id of ids) {
    const sc = b.schools[id]!;
    if (!b.professions[sc.profession]) err(id, 'school.profession', `no profession "${sc.profession}"`);
    else if (byProfession[sc.profession]) err(id, 'school.profession', `"${sc.profession}" already has the school ${byProfession[sc.profession]}`);
    else byProfession[sc.profession] = id;
    const clusters = new Set((sc.clusters ?? []).map((c) => c.id));
    const used = new Set<string>();
    const nodes = new Map<string, (typeof sc.nodes)[number]>();
    const placed = sc.nodes.filter((n) => n.pos !== undefined).length;
    if (placed > 0 && placed < sc.nodes.length) err(id, 'school.nodes', `${placed} of ${sc.nodes.length} nodes have a place: a school gives every node a place or none`);
    sc.nodes.forEach((n, i) => {
      const where = `school.nodes.${i}`;
      if (nodes.has(n.id)) err(id, `${where}.id`, `"${n.id}" is used twice in this school`);
      nodes.set(n.id, n);
      if (n.size === 'corner') {
        if (n.race === undefined) err(id, `${where}.race`, 'a corner node names the race it belongs to');
        else if (!b.races[n.race]) err(id, `${where}.race`, `no race "${n.race}"`);
      } else if (n.race !== undefined) err(id, `${where}.race`, 'only a corner node belongs to a race');
      if (n.slot === true && n.size !== 'major' && n.size !== 'corner') err(id, `${where}.slot`, `a ${n.size} node is always on: only a major or a corner node is a technique`);
      if (n.icon !== undefined && !b.items[n.icon]) err(id, `${where}.icon`, `no item "${n.icon}"`);
      if (n.cost !== undefined && growth) {
        const [lo, hi] = growth.cost_band[n.size];
        if (n.cost < lo || n.cost > hi) err(id, `${where}.cost`, `a ${n.size} node costs ${lo} to ${hi} points, not ${n.cost}`);
      }
      if (n.cluster !== undefined) {
        if (!clusters.has(n.cluster)) err(id, `${where}.cluster`, `no cluster "${n.cluster}" in this school`);
        used.add(n.cluster);
      }
      if (n.pos !== undefined) {
        const spot = `${n.pos.x},${n.pos.y}`;
        const other = places.get(spot);
        if (other !== undefined && !(n.size === 'corner' && other.startsWith(`${id}/`) && nodes.get(other.slice(id.length + 1))?.size === 'corner')) {
          err(id, `${where}.pos`, `the place ${spot} is taken by ${other}`);
        } else places.set(spot, nodeKey(id, n.id));
      }
    });
    for (const c of sc.clusters ?? []) if (!used.has(c.id)) err(id, 'school.clusters', `the cluster "${c.id}" holds no node`);
    sc.nodes.forEach((n, i) => {
      for (const need of n.needs ?? []) {
        const key = needKey(id, need);
        if (key === nodeKey(id, n.id) || !all.has(key)) {
          err(id, `school.nodes.${i}.needs`, need.includes('/') ? `no node "${need}" in the tree` : `no node "${need}" before it in this school`);
        }
      }
    });
    // the school hangs together: from its first node, the needs inside it (both ways) reach every other
    const links = new Map<string, string[]>(sc.nodes.map((n) => [n.id, []]));
    for (const n of sc.nodes) {
      for (const need of n.needs ?? []) {
        if (need.includes('/') && !need.startsWith(`${id}/`)) continue;
        const m = need.includes('/') ? need.slice(id.length + 1) : need;
        if (!links.has(m)) continue;
        links.get(n.id)!.push(m);
        links.get(m)!.push(n.id);
      }
    }
    const reached = new Set<string>();
    const queue = sc.nodes.length > 0 ? [sc.nodes[0]!.id] : [];
    while (queue.length > 0) {
      const next = queue.pop()!;
      if (reached.has(next)) continue;
      reached.add(next);
      queue.push(...(links.get(next) ?? []));
    }
    for (const n of sc.nodes) if (!reached.has(n.id)) err(id, 'school.nodes', `"${n.id}" stands alone: no path of needs joins it to the rest of the school`);
    const path = sc.nodes.filter((n) => n.size !== 'corner').length;
    const most = growth?.nodes_max ?? Number.POSITIVE_INFINITY;
    for (const race of Object.keys(b.races).sort()) {
      const corners = sc.nodes.filter((n) => n.size === 'corner' && n.race === race).length;
      if (corners > 1) err(id, 'school.nodes', `the race "${race}" has ${corners} corner nodes here; a race has at most one in each school`);
      if (path + corners > most) err(id, 'school.nodes', `a player of "${race}" sees ${path + corners} nodes here; at most ${most}`);
    }
  }

  // no cycle in the whole tree: every node's chain of needs ends, across wings too
  const state = new Map<string, 'open' | 'done'>();
  const looped = new Set<string>();
  const visit = (key: string): boolean => {
    if (state.get(key) === 'done') return true;
    if (state.get(key) === 'open') return false;
    state.set(key, 'open');
    let ok = true;
    for (const m of all.get(key)?.needs ?? []) if (all.has(m) && !visit(m)) ok = false;
    state.set(key, 'done');
    return ok;
  };
  for (const key of [...all.keys()].sort()) {
    if (!visit(key) && !looped.has(key)) {
      looped.add(key);
      err(all.get(key)!.school, 'school.nodes', `the needs of "${key.slice(all.get(key)!.school.length + 1)}" go round in a circle`);
    }
  }
  return issues;
}
