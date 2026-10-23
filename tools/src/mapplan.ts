/**
 * The checks of a hand-composed map's plan block (DECISIONS.md, 2026-10-23: the valley map plan in
 * the game). The plan agrees with the tiles; paths wind (G69); and the first night is held by the
 * size of the land, never by a lock (G71). The kernel and the clients never read the plan.
 */
import { type Bundle, type Rect, findSlot, inRect, lastDusk, makeWalkable, tagAt, worldAt } from '@game/kernel';
import type { Issue } from './load';

type Tile = readonly [number, number];

const STEPS: readonly Tile[] = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

/** G69: the longest straight run of a path, in tiles; a run that crosses a bridge may reach the longer one. */
export const RUN_MAX = 8;
export const BRIDGE_RUN_MAX = 12;

type Plan = NonNullable<Bundle['map']['plan']>;

const at = ([x, y]: Tile) => `(${x}, ${y})`;

/** The slots of the restorations that can be walked once mended (a bridge, a gate). */
function passableSlots(b: Bundle): { id: string; slot: Rect }[] {
  return Object.values(b.restores)
    .filter((r) => r.passable)
    .flatMap((r) => {
      const slot = findSlot(b.map, r.place.slot);
      return slot ? [{ id: r.id, slot }] : [];
    });
}

/** Every tile from `a` to `b` on one row or one column, both ends included; undefined when they share neither. */
function line(a: Tile, b: Tile): Tile[] | undefined {
  if (a[0] !== b[0] && a[1] !== b[1]) return undefined;
  const dx = Math.sign(b[0] - a[0]);
  const dy = Math.sign(b[1] - a[1]);
  const out: Tile[] = [a];
  let [x, y] = a;
  while (x !== b[0] || y !== b[1]) {
    x += dx;
    y += dy;
    out.push([x, y]);
  }
  return out;
}

/** The straight runs of a chain of four-adjacent tiles: each run's first and last tile and its length in tiles. */
export function straightRuns(tiles: readonly Tile[]): { from: Tile; to: Tile; length: number; tiles: Tile[] }[] {
  const runs: { from: Tile; to: Tile; length: number; tiles: Tile[] }[] = [];
  const push = (part: Tile[]) => runs.push({ from: part[0]!, to: part[part.length - 1]!, length: part.length, tiles: part });
  if (tiles.length === 0) return runs;
  const step = (i: number) => `${tiles[i]![0] - tiles[i - 1]![0]},${tiles[i]![1] - tiles[i - 1]![1]}`;
  let start = 0;
  for (let i = 2; i < tiles.length; i++) {
    if (step(i) === step(i - 1)) continue;
    // a turn at tile i-1: it closes one run and opens the next
    push(tiles.slice(start, i));
    start = i - 1;
  }
  push(tiles.slice(start));
  return runs;
}

function checkPaths(b: Bundle, plan: Plan, err: (where: string, message: string) => void): void {
  const m = b.map;
  const crossings = passableSlots(b);
  const onCrossing = ([x, y]: Tile) => crossings.some((c) => inRect(x, y, c.slot));
  (plan.paths ?? []).forEach((p, i) => {
    const where = `map.plan.paths.${i}`;
    const tiles: Tile[] = [];
    for (let k = 1; k < p.via.length; k++) {
      const a = p.via[k - 1]!;
      const c = p.via[k]!;
      const part = line(a, c);
      if (!part) return err(where, `${p.id}: ${at(a)} and ${at(c)} share no row and no column`);
      tiles.push(...(tiles.length === 0 ? part : part.slice(1)));
    }
    const off = tiles.filter(([x, y]) => x >= m.width || y >= m.height);
    if (off.length > 0) return err(where, `${p.id}: ${at(off[0]!)} is outside the map`);
    const bad = tiles.filter((t) => tagAt(m, t[0], t[1]) !== 'path' && !onCrossing(t));
    if (bad.length > 0) {
      err(where, `${p.id}: ${bad.slice(0, 4).map(at).join(', ')}${bad.length > 4 ? ` and ${bad.length - 4} more` : ''} carry no path letter and lie on no crossing`);
    }
    for (const run of straightRuns(tiles)) {
      const max = run.tiles.some(onCrossing) ? BRIDGE_RUN_MAX : RUN_MAX;
      if (run.length > max) err(where, `${p.id}: a straight run of ${run.length} tiles from ${at(run.from)} to ${at(run.to)}, over ${max} (G69: paths wind)`);
    }
  });
  // every path letter on the ground, not only the planned ones: no straight row or column of them over the limit
  const scan = (x0: number, y0: number, dx: number, dy: number) => {
    let run: Tile[] = [];
    const flush = () => {
      if (run.length > RUN_MAX) err('map.ground', `a straight run of ${run.length} path tiles from ${at(run[0]!)} to ${at(run[run.length - 1]!)}, over ${RUN_MAX} (G69: paths wind)`);
      run = [];
    };
    for (let x = x0, y = y0; x < m.width && y < m.height; x += dx, y += dy) {
      if (tagAt(m, x, y) === 'path') run.push([x, y]);
      else flush();
    }
    flush();
  };
  for (let y = 0; y < m.height; y++) scan(0, y, 1, 0);
  for (let x = 0; x < m.width; x++) scan(x, 0, 0, 1);
}

/** G71: the steps added to the least road an exit needs, so a stitched road is never cut to the bone. */
export const ROAD_MARGIN = 10;

/** One wake's measure for G71, every gate open. Steps are four-way walks; `null` when nothing of the kind can be reached. */
export interface FirstNight {
  pocket: string;
  wake: Tile;
  /** game milliseconds from waking (tick 0, noon) to the first dusk */
  daylightMs: number;
  /** steps to the nearest tile of another world or the map's edge by a way the plan does not list as an exit */
  exitSteps: number | null;
  exit?: Tile;
  /** steps to stand on each listed exit (its gate open), by exit id */
  exits: Record<string, number | null>;
}

/** One exit of the plan, as G71 measures it. */
export interface ExitRoad {
  id: string;
  /** the fewest steps any wake walks to stand on it */
  gateSteps: number | null;
  /** the least road beyond it: the daylight in steps less `gateSteps`, plus the margin */
  needed: number | null;
  declared: number;
  /** steps beyond it to the next region's ground drawn on this map (another world); `null` when the road leaves the map first */
  road: number | null;
  ground?: Tile;
}

/** The first dusk after tick 0, the moment a new character wakes. */
export function firstDusk(b: Bundle): number {
  const day = b.params.day_length_ms;
  let dusk = lastDusk(b, 0);
  while (dusk <= 0) dusk += day;
  return dusk;
}

/** The tiles of each listed exit: its gate slot, or its one tile. */
function exitTiles(b: Bundle): { id: string; tiles: Tile[] }[] {
  return (b.map.plan?.exits ?? []).map((e) => {
    const tiles: Tile[] = [];
    const slot = e.slot ? findSlot(b.map, e.slot) : undefined;
    if (slot) for (let y = slot.y; y < slot.y + slot.h; y++) for (let x = slot.x; x < slot.x + slot.w; x++) tiles.push([x, y]);
    else if (e.at) tiles.push(e.at);
    return { id: e.id, tiles };
  });
}

/** A walk over the map with every mend made and every listed gate open; `stop` tiles are entered but not walked past. */
function walkFrom(b: Bundle, starts: readonly Tile[], stop: (x: number, y: number) => boolean, skip: (x: number, y: number) => boolean = () => false): Map<number, number> {
  const m = b.map;
  const walkable = makeWalkable(b);
  const view = { restored: passableSlots(b).map((s) => s.id), camp: [] as string[] };
  const gate = new Set(exitTiles(b).flatMap((e) => e.tiles.map(([x, y]) => y * m.width + x)));
  const open = (x: number, y: number) => x >= 0 && y >= 0 && x < m.width && y < m.height && (gate.has(y * m.width + x) || walkable(x, y, view));
  const dist = new Map<number, number>();
  const queue: Tile[] = [];
  for (const [x, y] of starts) {
    dist.set(y * m.width + x, 0);
    queue.push([x, y]);
  }
  for (let i = 0; i < queue.length; i++) {
    const [x, y] = queue[i]!;
    const d = dist.get(y * m.width + x)!;
    if (i >= starts.length && stop(x, y)) continue;
    for (const [dx, dy] of STEPS) {
      const nx = x + dx;
      const ny = y + dy;
      const k = ny * m.width + nx;
      if (dist.has(k) || !open(nx, ny) || skip(nx, ny)) continue;
      dist.set(k, d + 1);
      queue.push([nx, ny]);
    }
  }
  return dist;
}

const nearest = (b: Bundle, dist: Map<number, number>, hit: (x: number, y: number) => boolean): { at: Tile; d: number } | undefined => {
  let best: { at: Tile; d: number } | undefined;
  for (const [k, d] of dist) {
    const x = k % b.map.width;
    const y = Math.floor(k / b.map.width);
    if (hit(x, y) && (!best || d < best.d)) best = { at: [x, y], d };
  }
  return best;
};

/**
 * G71, measured from every wake of the pool with the valley's own mends made (the bridge, the arch) and
 * every gate of the plan's exits open (DECISIONS.md, 2026-10-23): the walk to another world's ground or
 * the map's edge by any way that is not a listed exit, and the walk to stand on each exit.
 */
export function firstNight(b: Bundle): FirstNight[] {
  const m = b.map;
  const daylightMs = firstDusk(b);
  const exits = exitTiles(b);
  const onExit = (x: number, y: number) => exits.some((e) => e.tiles.some(([ex, ey]) => ex === x && ey === y));
  const out: FirstNight[] = [];
  for (const [id, pocket] of Object.entries(b.pockets).sort(([a], [c]) => a.localeCompare(c))) {
    const wake: Tile = [pocket.wake.x, pocket.wake.y];
    const home = worldAt(m, wake[0], wake[1]);
    const dist = walkFrom(b, [wake], onExit);
    const away = nearest(b, dist, (x, y) => !onExit(x, y) && (worldAt(m, x, y) !== home || x === 0 || y === 0 || x === m.width - 1 || y === m.height - 1));
    const steps: Record<string, number | null> = {};
    for (const e of exits) steps[e.id] = nearest(b, dist, (x, y) => e.tiles.some(([ex, ey]) => ex === x && ey === y))?.d ?? null;
    out.push({ pocket: id, wake, daylightMs, exitSteps: away ? away.d : null, ...(away ? { exit: away.at } : {}), exits: steps });
  }
  return out;
}

/**
 * G71 at each exit: the least road the region beyond must provide, and, where that region is drawn on
 * this map (ground of another world past the gate), the road it does provide.
 */
export function exitRoads(b: Bundle): ExitRoad[] {
  const m = b.map;
  const nights = firstNight(b);
  const daylightSteps = firstDusk(b) / b.params.walk_step_ms;
  const valley = new Set<number>();
  for (const f of nights) {
    const exits = exitTiles(b);
    const onExit = (x: number, y: number) => exits.some((e) => e.tiles.some(([ex, ey]) => ex === x && ey === y));
    for (const [k] of walkFrom(b, [f.wake], onExit)) {
      const x = k % m.width;
      if (!onExit(x, Math.floor(k / m.width))) valley.add(k);
    }
  }
  return exitTiles(b).map((e, i) => {
    const declared = m.plan!.exits![i]!.min_road_steps;
    const reached = nights.map((f) => f.exits[e.id]).filter((d): d is number => d !== null && d !== undefined);
    const gateSteps = reached.length ? Math.min(...reached) : null;
    const needed = gateSteps === null ? null : Math.max(1, Math.ceil(daylightSteps - gateSteps) + ROAD_MARGIN);
    const home = nights[0] ? worldAt(m, nights[0].wake[0], nights[0].wake[1]) : undefined;
    const beyond = walkFrom(b, e.tiles, () => false, (x, y) => valley.has(y * m.width + x));
    const ground = nearest(b, beyond, (x, y) => worldAt(m, x, y) !== home);
    return { id: e.id, gateSteps, needed, declared, road: ground ? ground.d : null, ...(ground ? { ground: ground.at } : {}) };
  });
}

export function checkMapPlan(b: Bundle, origin: Record<string, string>): Issue[] {
  const m = b.map;
  const file = origin[m.id] ?? 'content/core/map.json';
  const issues: Issue[] = [];
  const err = (where: string, message: string) => issues.push({ file, where, message, level: 'error' });
  const warn = (where: string, message: string) => issues.push({ file, where, message, level: 'warning' });

  if (m.heights) {
    if (m.heights.length !== m.height) err('map.heights', `has ${m.heights.length} rows, the map is ${m.height} high`);
    m.heights.forEach((row, y) => {
      if (row.length !== m.width) err(`map.heights.${y}`, `row is ${row.length} wide, the map is ${m.width} wide`);
    });
  }

  const walkMs = b.params.walk_step_ms;
  for (const f of firstNight(b)) {
    if (f.exitSteps === null || f.exitSteps * walkMs > f.daylightMs) continue;
    const secs = (f.exitSteps * walkMs) / 1000;
    err(
      'map',
      `G71: from the wake of ${f.pocket} ${at(f.wake)} a walk of ${f.exitSteps} steps (${secs} s), every gate open, reaches ${at(f.exit!)}, outside the first region by no listed exit, and the first dusk comes ${f.daylightMs / 1000} s after waking: the land must be larger, the first night is held by size`,
    );
  }
  if (m.plan?.exits?.length) {
    exitRoads(b).forEach((r, i) => {
      const e = m.plan!.exits![i]!;
      const where = `map.plan.exits.${i}`;
      if (!e.slot === !e.at) return err(where, `${r.id}: give the gate's slot or the tile, one of the two`);
      if (e.slot && !findSlot(m, e.slot)) return err(where, `${r.id}: no slot "${e.slot}"`);
      if (!(m.plan!.regions ?? []).some((g) => g.id === e.to)) err(where, `${r.id}: no plan region "${e.to}"`);
      if (r.needed === null) return warn(where, `${r.id}: no wake reaches it with every gate open`);
      if (r.declared < r.needed)
        err(where, `G71: ${r.id} is ${r.gateSteps} steps from the nearest wake; the road beyond it must run at least ${r.needed} steps before the next region's ground (the first dusk is ${Math.ceil(firstDusk(b) / walkMs)} steps after waking, margin ${ROAD_MARGIN}), the plan asks ${r.declared}`);
      if (r.road !== null && r.road < r.declared)
        err(where, `G71: beyond ${r.id} the next region's ground begins at ${at(r.ground!)}, ${r.road} steps past the gate; its road must run ${r.declared}: the first night is held by the length of the road, never by the gate`);
    });
  }

  const plan = m.plan;
  if (!plan) return issues;
  const seen = new Set<string>();
  (plan.regions ?? []).forEach((r, i) => {
    const where = `map.plan.regions.${i}`;
    if (seen.has(r.id)) err(where, `region "${r.id}" is named twice`);
    seen.add(r.id);
    r.cells.forEach(([x, y, w, h], k) => {
      if (x + w > m.width || y + h > m.height) err(`${where}.cells.${k}`, 'reaches past the edge of the map');
    });
    // a region quest named before it is written is the plan's to-do, not a fault: its gate stays shut ground until then
  });

  checkPaths(b, plan, err);

  const walkable = makeWalkable(b);
  const mended = { restored: passableSlots(b).map((s) => s.id), camp: [] as string[] };
  (plan.routes ?? []).forEach((r, i) => {
    r.via.forEach(([x, y], k) => {
      if (!walkable(x, y, mended)) err(`map.plan.routes.${i}.via.${k}`, `${r.id}: ${at([x, y])} is not a tile a foot can stand on`);
    });
  });

  (plan.rests ?? []).forEach((r, i) => {
    const rect = { x: r.x, y: r.y, w: 3, h: 3 };
    if (r.x + 3 > m.width || r.y + 3 > m.height) return err(`map.plan.rests.${i}`, 'reaches past the edge of the map');
    const slot = m.slots.find((s) => s.x < rect.x + 3 && rect.x < s.x + s.w && s.y < rect.y + 3 && rect.y < s.y + s.h);
    if (slot) warn(`map.plan.rests.${i}`, `the rest at ${at([r.x, r.y])} overlaps the slot ${slot.id}`);
    for (let y = r.y; y < r.y + 3; y++) for (let x = r.x; x < r.x + 3; x++) if (!walkable(x, y, mended)) return warn(`map.plan.rests.${i}`, `the rest at ${at([r.x, r.y])} holds ${at([x, y])}, which is not open ground`);
  });

  if (plan.wakes) {
    const listed = new Set<string>();
    plan.wakes.forEach((w, i) => {
      const where = `map.plan.wakes.${i}`;
      listed.add(w.pocket);
      if (!b.pockets[w.pocket]) return err(where, `no wake pocket "${w.pocket}"`);
      const q = b.quests[w.quest];
      if (!q) return err(where, `no quest "${w.quest}"`);
      if (q.pocket !== w.pocket) err(where, `${w.quest} is not the first task of ${w.pocket} (its pocket is ${q.pocket ?? 'none'})`);
    });
    for (const id of Object.keys(b.pockets).sort()) if (!listed.has(id)) warn('map.plan.wakes', `the wake pocket ${id} is missing from the spawn pool`);
  }
  return issues;
}
