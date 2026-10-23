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

/** One wake's measure for G71. Steps are four-way walks; `null` when nothing of the kind can be reached. */
export interface FirstNight {
  pocket: string;
  wake: Tile;
  /** game milliseconds from waking (tick 0, noon) to the first dusk */
  daylightMs: number;
  /** steps to the nearest tile of another world or the map's edge, every gate shut */
  exitSteps: number | null;
  exit?: Tile;
  /** steps to stand beside the nearest shut gate: where a region quest would open the way */
  gateSteps: number | null;
  gate?: string;
}

/** The first dusk after tick 0, the moment a new character wakes. */
export function firstDusk(b: Bundle): number {
  const day = b.params.day_length_ms;
  let dusk = lastDusk(b, 0);
  while (dusk <= 0) dusk += day;
  return dusk;
}

/**
 * G71, measured from every wake of the pool: the valley's own mends made (the bridge, the arch), every
 * gate to another world shut, the walk to the nearest tile of another world or to the map's edge.
 */
export function firstNight(b: Bundle): FirstNight[] {
  const m = b.map;
  const walkable = makeWalkable(b);
  const daylightMs = firstDusk(b);
  const out: FirstNight[] = [];
  for (const [id, pocket] of Object.entries(b.pockets).sort(([a], [c]) => a.localeCompare(c))) {
    const wake: Tile = [pocket.wake.x, pocket.wake.y];
    const home = worldAt(m, wake[0], wake[1]);
    const foreign = (x: number, y: number) => worldAt(m, x, y) !== home;
    const touchesForeign = (r: Rect) => {
      for (let y = r.y - 1; y <= r.y + r.h; y++) for (let x = r.x - 1; x <= r.x + r.w; x++) if (x >= 0 && y >= 0 && x < m.width && y < m.height && foreign(x, y)) return true;
      return false;
    };
    const slots = passableSlots(b);
    const gates = slots.filter((s) => touchesForeign(s.slot));
    const view = { restored: slots.filter((s) => !gates.includes(s)).map((s) => s.id), camp: [] as string[] };
    const dist = new Map<number, number>([[wake[1] * m.width + wake[0], 0]]);
    const queue: Tile[] = [wake];
    let exit: Tile | undefined;
    let gate: { id: string; at: number } | undefined;
    for (let i = 0; i < queue.length; i++) {
      const [x, y] = queue[i]!;
      const d = dist.get(y * m.width + x)!;
      if (!exit && (foreign(x, y) || x === 0 || y === 0 || x === m.width - 1 || y === m.height - 1)) exit = [x, y];
      if (!gate) {
        const beside = gates.find((g) => STEPS.some(([dx, dy]) => inRect(x + dx, y + dy, g.slot)));
        if (beside) gate = { id: beside.id, at: d };
      }
      if (exit && gate) break;
      for (const [dx, dy] of STEPS) {
        const nx = x + dx;
        const ny = y + dy;
        const k = ny * m.width + nx;
        if (dist.has(k) || !walkable(nx, ny, view)) continue;
        dist.set(k, d + 1);
        queue.push([nx, ny]);
      }
    }
    out.push({
      pocket: id,
      wake,
      daylightMs,
      exitSteps: exit ? dist.get(exit[1] * m.width + exit[0])! : null,
      ...(exit ? { exit } : {}),
      gateSteps: gate ? gate.at : null,
      ...(gate ? { gate: gate.id } : {}),
    });
  }
  return out;
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

  for (const f of firstNight(b)) {
    if (f.exitSteps === null || f.exitSteps * b.params.walk_step_ms > f.daylightMs) continue;
    const secs = (f.exitSteps * b.params.walk_step_ms) / 1000;
    err(
      'map',
      `G71: from the wake of ${f.pocket} ${at(f.wake)} a walk of ${f.exitSteps} steps (${secs} s) reaches ${at(f.exit!)}, outside the first region, and the first dusk comes ${f.daylightMs / 1000} s after waking: the land must be larger, the first night is held by size`,
    );
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
    if (r.opens_by !== 'wake' && !b.quests[r.opens_by]) warn(`${where}.opens_by`, `${r.id} opens by ${r.opens_by}, which no quest holds yet: the region stays shut until it is written`);
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
