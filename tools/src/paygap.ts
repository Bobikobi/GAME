/**
 * The pay-gap check (G62, docs/design/OPEN_WORLD.md; EXPERIENCE_AUDIT.md gap M8): a static proxy for pillar 1's
 * recording test. No walkable tile may lie farther from a pay than floor(pay_gap_ms / (2 x walk_step_ms)) +
 * pay_sight_tiles steps, 4-way, under the kernel's own walk and height rules, with every crossing open. A pay is a
 * live instance, a slot, a crossing, a note a riddle cites (G8; one that fails G8 does not count, that would invite
 * filler) or the tile where a walker enters a region (G63). A tile no pay reaches is left out: the step rule goes
 * both ways, so nobody who has walked from a pay can stand there. Whether every start reaches the road is
 * checkStarts' and checkReach's; a map with no pay at all is an error here.
 */
import { type Bundle, type Rect, makeStepRule, regionAt } from '@game/kernel';
import type { Issue } from './load';
import { walkBitmap } from './reach';

const STEPS: readonly (readonly [number, number])[] = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

const RULE = 'docs/design/OPEN_WORLD.md G62';

export interface PayGap {
  /** the most steps any walkable tile may lie from a pay */
  cap: number;
  /** tiles a walk can start paying from */
  pays: number;
  /** the walkable tile farthest from a pay (the first in row order on a tie); none when no tile has a pay in reach */
  worst?: { x: number; y: number; steps: number };
}

/** The allowance: the draft's numbers where the params do not carry their own (older content). */
export function payGapCap(b: Bundle): number {
  const p: { walk_step_ms: number; pay_gap_ms?: number; pay_sight_tiles?: number } = b.params;
  return Math.floor((p.pay_gap_ms ?? 90000) / (2 * p.walk_step_ms)) + (p.pay_sight_tiles ?? 5);
}

/** Every tile a walk starts paying from, as map indices: a pay on blocked ground pays from the walkable tiles beside it. */
function payTiles(b: Bundle, open: Uint8Array, stepOpen: ReturnType<typeof makeStepRule>): Set<number> {
  const { width, height } = b.map;
  const tiles = new Set<number>();
  const pay = (r: Rect) => {
    const inside: number[] = [];
    const beside: number[] = [];
    for (let y = r.y; y < r.y + r.h; y++) {
      for (let x = r.x; x < r.x + r.w; x++) {
        if (x < 0 || y < 0 || x >= width || y >= height) continue;
        if (open[y * width + x]) inside.push(y * width + x);
        for (const [dx, dy] of STEPS) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < width && ny < height && open[ny * width + nx]) beside.push(ny * width + nx);
        }
      }
    }
    for (const i of inside.length > 0 ? inside : beside) tiles.add(i);
  };
  for (const inst of Object.values(b.instances)) pay({ x: inst.x, y: inst.y, w: 1, h: 1 });
  for (const slot of b.map.slots) pay(slot);
  const cited = new Set(Object.values(b.quests).flatMap((q) => q.steps.flatMap((st) => (st.kind === 'riddle' ? st.props : []))));
  for (const p of b.map.props) if (p.crossing === true || (p.note !== undefined && p.id !== undefined && cited.has(p.id))) pay(p);
  // A region pays where a walker can come in from outside it; along a wall or the map's edge nothing fires.
  if (b.map.regions) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (!open[y * width + x]) continue;
        const region = regionAt(b.map, x, y);
        if (!region) continue;
        const entered = STEPS.some(([dx, dy]) => {
          const nx = x + dx;
          const ny = y + dy;
          return nx >= 0 && ny >= 0 && nx < width && ny < height && open[ny * width + nx] === 1 && regionAt(b.map, nx, ny) !== region && stepOpen(nx, ny, x, y);
        });
        if (entered) tiles.add(y * width + x);
      }
    }
  }
  return tiles;
}

/** One breadth-first pass from every pay at once, linear in tiles. */
export function measurePayGap(b: Bundle): PayGap {
  const { width, height } = b.map;
  const open = walkBitmap(b);
  const stepOpen = makeStepRule(b);
  const pays = payTiles(b, open, stepOpen);
  const dist = new Int32Array(width * height).fill(-1);
  const queue = new Int32Array(width * height);
  let tail = 0;
  for (const i of pays) {
    dist[i] = 0;
    queue[tail++] = i;
  }
  for (let head = 0; head < tail; head++) {
    const i = queue[head]!;
    const x = i % width;
    const y = (i - x) / width;
    for (const [dx, dy] of STEPS) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const n = ny * width + nx;
      if (dist[n] !== -1 || !open[n] || !stepOpen(x, y, nx, ny)) continue;
      dist[n] = dist[i]! + 1;
      queue[tail++] = n;
    }
  }
  const result: PayGap = { cap: payGapCap(b), pays: pays.size };
  for (let i = 0; i < dist.length; i++) {
    if (dist[i]! > (result.worst?.steps ?? -1)) result.worst = { x: i % width, y: Math.floor(i / width), steps: dist[i]! };
  }
  return result;
}

export function checkPayGap(b: Bundle, origin: Record<string, string>): Issue[] {
  const { cap, worst } = measurePayGap(b);
  const file = origin[b.map.id] ?? 'content';
  if (!worst) return [{ file, where: 'map', message: `the map has no pay a walker can reach (${RULE})`, level: 'error' }];
  const half = Math.floor(cap / 2);
  const line = `the tile (${worst.x}, ${worst.y}) is ${worst.steps} steps from the nearest pay`;
  if (worst.steps > cap) {
    return [{ file, where: 'map', message: `${line}, past the cap of ${cap}: place a pay nearer, or take it to the owner (${RULE})`, level: 'error' }];
  }
  if (worst.steps > half) {
    return [{ file, where: 'map', message: `${line}, past half the cap of ${cap}: something to notice on the way, for review (G5, ${RULE})`, level: 'warning' }];
  }
  return [];
}
