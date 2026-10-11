/**
 * The hazard rules (GAME_RULES G30 and G34, DECISIONS.md 2026-10-10: health
 * and hazards). A hazard is a prop with an id, in the open: never on safe
 * ground, a pit, trap or deep water that a foot can step on, and a predator
 * whose hunting ground always leaves the player a run to a safe place that
 * costs less than a whole fall. Nothing here names an item: a hazard is only
 * escaped (G34), and the schema has no field to answer it with.
 */
import { type Bundle, type Rect, bitesAfter, hazardsOf, isSafeGround, makeWalkable } from '@game/kernel';
import type { Issue } from './load';

const STEPS: readonly (readonly [number, number])[] = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

/** Steps from every tile to the nearest tile that is safe without the camp, walking four ways with every restoration mended. */
function runsToSafety(b: Bundle): Map<number, number> {
  const walkable = makeWalkable(b);
  const view = { restored: Object.values(b.restores).filter((r) => r.passable).map((r) => r.id), camp: [] as string[] };
  const { width, height } = b.map;
  const dist = new Map<number, number>();
  const queue: [number, number][] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!walkable(x, y, view) || !isSafeGround(b, [x, y], false)) continue;
      dist.set(y * width + x, 0);
      queue.push([x, y]);
    }
  }
  for (let i = 0; i < queue.length; i++) {
    const [x, y] = queue[i]!;
    const here = dist.get(y * width + x)!;
    for (const [dx, dy] of STEPS) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height || dist.has(ny * width + nx) || !walkable(nx, ny, view)) continue;
      dist.set(ny * width + nx, here + 1);
      queue.push([nx, ny]);
    }
  }
  return dist;
}

function touchesSafe(b: Bundle, r: Rect): [number, number] | undefined {
  for (let y = r.y; y < r.y + r.h; y++) {
    for (let x = r.x; x < r.x + r.w; x++) if (isSafeGround(b, [x, y], true)) return [x, y];
  }
  return undefined;
}

export function checkHazards(b: Bundle, origin: Record<string, string>): Issue[] {
  const issues: Issue[] = [];
  const file = origin[b.map.id] ?? 'content';
  const err = (where: string, message: string) => issues.push({ file, where, message, level: 'error' });
  const rule = (n: string, name: string) => `docs/design/GAME_RULES.md ${n}, "${name}"`;

  b.map.props.forEach((p, i) => {
    if (!p.hazard) return;
    const where = `map.props.${i}.hazard`;
    if (p.id === undefined) err(where, 'a hazard needs an id: the world keeps each hunt by the id of its prop');
    if (p.hazard.reach !== undefined && p.hazard.kind !== 'predator') err(`${where}.reach`, `only a predator has a reach, not a ${p.hazard.kind}`);
    if (p.hazard.kind !== 'predator' && p.solid) err(where, `a ${p.hazard.kind} is stepped on: its prop must not be solid, or nobody can reach it`);
    const safe = touchesSafe(b, { x: p.x, y: p.y, w: p.w, h: p.h });
    if (safe) {
      err(where, `${rule('G30', 'The town and the camp are safe')}: the ${p.hazard.kind}${p.id ? ` "${p.id}"` : ''} stands on safe ground at (${safe[0]}, ${safe[1]}); no hazard acts there`);
    }
  });

  const predators = hazardsOf(b).filter((h) => h.kind === 'predator');
  if (predators.length === 0) return issues;
  const dist = runsToSafety(b);
  const walkable = makeWalkable(b);
  const view = { restored: Object.values(b.restores).filter((r) => r.passable).map((r) => r.id), camp: [] as string[] };
  const { width, height } = b.map;
  const { bite_pct } = b.params.hazard.predator;
  for (const h of predators) {
    let worst: { at: [number, number]; steps: number } | undefined;
    for (let y = Math.max(0, h.rect.y - h.reach); y < Math.min(height, h.rect.y + h.rect.h + h.reach); y++) {
      for (let x = Math.max(0, h.rect.x - h.reach); x < Math.min(width, h.rect.x + h.rect.w + h.reach); x++) {
        if (!walkable(x, y, view) || isSafeGround(b, [x, y], true)) continue;
        const steps = dist.get(y * width + x) ?? Number.POSITIVE_INFINITY;
        if (!worst || steps > worst.steps) worst = { at: [x, y], steps };
      }
    }
    if (!worst) continue;
    const where = `map.props.${b.map.props.findIndex((p) => p.id === h.id)}.hazard`;
    const name = rule('G34', 'A hazard is a rule, not a roll');
    if (!Number.isFinite(worst.steps)) {
      err(where, `${name}: a player hunted by "${h.id}" at (${worst.at[0]}, ${worst.at[1]}) has no road to a safe place; the chase never ends`);
      continue;
    }
    const bites = bitesAfter(b, worst.steps * b.params.walk_step_ms);
    if (bites * bite_pct >= 100) {
      err(
        where,
        `${name}: from (${worst.at[0]}, ${worst.at[1]}) the run from "${h.id}" to a safe place is ${worst.steps} tiles, ${bites} bites of ${bite_pct}% - the player falls on the way. Move it nearer a safe place or shrink its reach`,
      );
    }
  }
  return issues;
}
