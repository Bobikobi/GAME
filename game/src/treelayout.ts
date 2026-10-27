/**
 * Where each node of the skill tree stands (DECISIONS 2026-10-23 "The tree is data"): the tree is
 * content, and its picture is worked out from it here, the same every time. The race is the trunk in
 * the middle; each school is a wing that grows out from it in its own direction. A node stands one
 * step further out than the deepest node of its school it needs, and beside the nodes of the same
 * depth, as close to what it needs as the others allow. A school that gives its nodes places
 * (`pos`) stands where it says. Units are steps; the screen picks how many pixels a step is.
 * Pure, so it is tested without a page.
 */
import { needKey, nodeKey, type Bundle, type SchoolDef } from '@game/kernel';
import type { SchoolNodeDef, TreeTint } from '@game/schema';

/** The first ring of nodes stands this many steps from the middle; each depth one step further. */
export const TREE_INNER = 2.4;
export const TREE_STEP = 1.3;
/** Two nodes of the same depth stand at least this many steps apart. */
export const TREE_GAP = 1.15;
/** How big a node is drawn, as a share of a step: its radius. */
export const NODE_RADIUS: Record<SchoolNodeDef['size'], number> = { small: 0.3, major: 0.42, corner: 0.48, keystone: 0.5 };
/** The trunk's radius, in steps. */
export const TRUNK_RADIUS = 1.1;

export interface PlacedNode {
  key: string;
  school: string;
  node: SchoolNodeDef;
  x: number;
  y: number;
  r: number;
  depth: number;
  /** the keys of the nodes it needs, across wings too */
  needs: string[];
}

export interface PlacedSchool {
  id: string;
  name: string;
  tint: TreeTint;
  /** the wing's direction, in degrees clockwise from the right */
  angle: number;
  /** where its name plate stands: past the wing's tip on its axis */
  label: { x: number; y: number };
  bounds: Box;
  /** the nodes with no need in their own school: the trunk reaches them */
  roots: string[];
}

export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface TreeLayout {
  nodes: PlacedNode[];
  byKey: Map<string, PlacedNode>;
  schools: PlacedSchool[];
  bounds: Box;
}

/** The wings in the order they go round, each with its direction. */
export function wingAngles(schools: SchoolDef[]): Map<string, number> {
  const sorted = [...schools].sort((a, b) => a.id.localeCompare(b.id));
  const free = sorted.filter((s) => s.angle === undefined);
  const out = new Map<string, number>();
  const n = Math.max(1, free.length);
  free.forEach((s, i) => out.set(s.id, ((-90 - 180 / n + (i * 360) / n) % 360 + 360) % 360));
  for (const s of sorted) if (s.angle !== undefined) out.set(s.id, s.angle);
  return out;
}

/**
 * The nodes a player of this race sees, placed. A corner node of another race is not on the tree. The
 * corners of the races share one place in their school, so each race's tree has the same shape.
 */
export function layoutTree(b: Bundle, race: string): TreeLayout {
  const schools = Object.values(b.schools ?? {}).sort((x, y) => x.id.localeCompare(y.id));
  const angles = wingAngles(schools);
  const nodes: PlacedNode[] = [];
  const placedSchools: PlacedSchool[] = [];
  for (const sc of schools) {
    const angle = angles.get(sc.id) ?? 0;
    const rad = (angle * Math.PI) / 180;
    const dir = { x: Math.cos(rad), y: Math.sin(rad) };
    const side = { x: -dir.y, y: dir.x };
    const ids = new Map(sc.nodes.map((n, i) => [n.id, i]));
    const inSchool = (n: SchoolNodeDef) => (n.needs ?? []).map((m) => (m.includes('/') ? (m.startsWith(`${sc.id}/`) ? m.slice(sc.id.length + 1) : '') : m)).filter((m) => ids.has(m));
    // depth: one past the deepest need inside the school
    const depth = new Map<string, number>();
    const depthOf = (id: string, seen: Set<string> = new Set()): number => {
      const known = depth.get(id);
      if (known !== undefined) return known;
      if (seen.has(id)) return 0;
      seen.add(id);
      const n = sc.nodes[ids.get(id)!]!;
      const d = Math.max(-1, ...inSchool(n).map((m) => depthOf(m, seen))) + 1;
      depth.set(id, d);
      return d;
    };
    for (const n of sc.nodes) depthOf(n.id);
    // the corners of all races share one place: one stand-in per set of needs
    const shown = sc.nodes.filter((n) => n.size !== 'corner' || n.race === race);
    const standIn = new Map<string, SchoolNodeDef>();
    for (const n of sc.nodes) {
      if (n.size !== 'corner') continue;
      const sig = [...(n.needs ?? [])].sort().join('|');
      if (!standIn.has(sig)) standIn.set(sig, n);
    }
    const slotOf = (n: SchoolNodeDef): string => (n.size === 'corner' ? `corner:${[...(n.needs ?? [])].sort().join('|')}` : n.id);
    const slots = [...new Set(sc.nodes.map(slotOf))];
    const slotNode = (slot: string): SchoolNodeDef =>
      slot.startsWith('corner:') ? standIn.get(slot.slice('corner:'.length))! : sc.nodes[ids.get(slot)!]!;
    // across: depth by depth, each near the average of what it needs, then spread to the gap
    const across = new Map<string, number>();
    const clusterOrder = new Map((sc.clusters ?? []).map((c, i) => [c.id, i]));
    const maxDepth = Math.max(0, ...slots.map((sl) => depth.get(slotNode(sl).id) ?? 0));
    for (let d = 0; d <= maxDepth; d++) {
      const row = slots
        .filter((sl) => depth.get(slotNode(sl).id) === d)
        .map((sl) => {
          const n = slotNode(sl);
          const parents = inSchool(n).map((m) => across.get(slotOf(sc.nodes[ids.get(m)!]!)) ?? 0);
          const want = parents.length ? parents.reduce((a, v) => a + v, 0) / parents.length : 0;
          return { sl, want, cluster: clusterOrder.get(n.cluster ?? '') ?? -1, index: ids.get(n.id)! };
        })
        .sort((p, q) => p.want - q.want || p.cluster - q.cluster || p.index - q.index);
      const at: number[] = [];
      row.forEach((r, i) => at.push(i === 0 ? r.want : Math.max(r.want, at[i - 1]! + TREE_GAP)));
      const shift = row.length ? row.reduce((a, r, i) => a + (at[i]! - r.want), 0) / row.length : 0;
      row.forEach((r, i) => across.set(r.sl, at[i]! - shift));
    }
    const placed = sc.nodes.every((n) => n.pos !== undefined);
    const own: PlacedNode[] = shown.map((n) => {
      const d = depth.get(n.id) ?? 0;
      const out = TREE_INNER + d * TREE_STEP;
      const lat = across.get(slotOf(n)) ?? 0;
      const x = placed ? n.pos!.x : dir.x * out + side.x * lat;
      const y = placed ? n.pos!.y : dir.y * out + side.y * lat;
      return {
        key: nodeKey(sc.id, n.id),
        school: sc.id,
        node: n,
        x,
        y,
        r: NODE_RADIUS[n.size],
        depth: d,
        needs: (n.needs ?? []).map((m) => needKey(sc.id, m)),
      };
    });
    nodes.push(...own);
    const bounds = boxOf(own);
    const reach = Math.max(TREE_INNER, ...own.map((p) => p.x * dir.x + p.y * dir.y)) + 1.1;
    placedSchools.push({
      id: sc.id,
      name: sc.name,
      tint: sc.tint ?? 'wood',
      angle,
      label: { x: dir.x * reach, y: dir.y * reach },
      bounds,
      roots: own.filter((p) => inSchool(p.node).length === 0 && p.node.size !== 'corner').map((p) => p.key),
    });
  }
  const byKey = new Map(nodes.map((p) => [p.key, p]));
  const all = boxOf([...nodes, { x: 0, y: 0, r: TRUNK_RADIUS }, ...placedSchools.map((s) => ({ ...s.label, r: 1 }))]);
  return { nodes, byKey, schools: placedSchools, bounds: all };
}

function boxOf(points: { x: number; y: number; r: number }[]): Box {
  if (points.length === 0) return { x0: 0, y0: 0, x1: 0, y1: 0 };
  return {
    x0: Math.min(...points.map((p) => p.x - p.r)),
    y0: Math.min(...points.map((p) => p.y - p.r)),
    x1: Math.max(...points.map((p) => p.x + p.r)),
    y1: Math.max(...points.map((p) => p.y + p.r)),
  };
}

/** The closest two nodes come, edge to edge, in steps: the layout keeps it above zero. */
export function closestGap(layout: TreeLayout): number {
  let best = Number.POSITIVE_INFINITY;
  const ns = layout.nodes;
  for (let i = 0; i < ns.length; i++) {
    for (let j = i + 1; j < ns.length; j++) {
      const a = ns[i]!;
      const c = ns[j]!;
      best = Math.min(best, Math.hypot(a.x - c.x, a.y - c.y) - a.r - c.r);
    }
  }
  return best;
}
