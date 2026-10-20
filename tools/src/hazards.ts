/**
 * The hazard rules (GAME_RULES G30 and G34, DECISIONS.md 2026-10-10: health
 * and hazards). A hazard is a prop with an id, in the open: never on safe
 * ground, a pit, trap or deep water that a foot can step on, and a predator
 * whose hunting ground always leaves the player a run to a safe place that
 * costs less than a whole fall. Nothing here names an item: a hazard is only
 * escaped (G34), and the schema has no field to answer it with.
 */
import { type Bundle, type Hazard, type Rect, type Tile, bitesAfter, findSlot, hazardsOf, inRect, isSafeGround, makeWalkable, watchOf } from '@game/kernel';
import type { Issue } from './load';

const STEPS: readonly (readonly [number, number])[] = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

const tileKey = ([x, y]: readonly [number, number]): string => `${x},${y}`;

function reachOf(b: Bundle, hazard: Hazard): Tile[] {
  const tiles: Tile[] = [];
  for (let y = Math.max(0, hazard.rect.y - hazard.reach); y < Math.min(b.map.height, hazard.rect.y + hazard.rect.h + hazard.reach); y++) {
    for (let x = Math.max(0, hazard.rect.x - hazard.reach); x < Math.min(b.map.width, hazard.rect.x + hazard.rect.w + hazard.reach); x++) {
      tiles.push([x, y]);
    }
  }
  return tiles;
}

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
  const err = (at: string, where: string, message: string) => issues.push({ file: at, where, message, level: 'error' });
  const mapErr = (where: string, message: string) => err(file, where, message);
  const rule = (n: string, name: string) => `docs/design/GAME_RULES.md ${n}, "${name}"`;
  const stealthRule = rule('G47', 'A watched road is a rule the eyes can read');
  const walkable = makeWalkable(b);
  const view = { restored: Object.values(b.restores).filter((r) => r.passable).map((r) => r.id), camp: [] as string[] };

  b.map.props.forEach((p, i) => {
    if (p.cover === true && p.solid) mapErr(`map.props.${i}.cover`, `${stealthRule}: cover must be non-solid, so the player can stand on it`);
  });

  b.map.props.forEach((p, i) => {
    if (!p.hazard) return;
    const where = `map.props.${i}.hazard`;
    if (p.id === undefined) mapErr(where, 'a hazard needs an id: the world keeps each hunt by the id of its prop');
    if (p.hazard.reach !== undefined && p.hazard.kind !== 'predator') mapErr(`${where}.reach`, `only a predator has a reach, not a ${p.hazard.kind}`);
    if (p.hazard.kind !== 'predator' && p.solid) mapErr(where, `a ${p.hazard.kind} is stepped on: its prop must not be solid, or nobody can reach it`);
    const safe = touchesSafe(b, { x: p.x, y: p.y, w: p.w, h: p.h });
    if (safe) {
      mapErr(where, `${rule('G30', 'The town and the camp are safe')}: the ${p.hazard.kind}${p.id ? ` "${p.id}"` : ''} stands on safe ground at (${safe[0]}, ${safe[1]}); no hazard acts there`);
    }

    const round = p.hazard.round;
    if (!round) {
      if (p.hazard.pace_ms !== undefined || p.hazard.eyes !== undefined) {
        mapErr(where, `${stealthRule}: pace_ms and eyes belong to a predator with a round`);
      }
      return;
    }
    if (p.hazard.kind !== 'predator') mapErr(`${where}.round`, `${stealthRule}: only a predator walks a round`);
    const openAt = round.findIndex((at, j) => {
      const next = round[(j + 1) % round.length];
      return !next || Math.abs(next[0] - at[0]) + Math.abs(next[1] - at[1]) !== 1;
    });
    if (openAt >= 0) {
      mapErr(`${where}.round`, `${stealthRule}: the round is not a closed loop of four-adjacent tiles; step ${openAt + 1} does not meet the next`);
    }
    const first = round[0];
    if (first && !inRect(first[0], first[1], p)) {
      mapErr(`${where}.round.0`, `${stealthRule}: the first tile (${first[0]}, ${first[1]}) must be inside the predator's footprint`);
    }
    for (let j = 0; j < round.length; j++) {
      const at = round[j]!;
      const insideMap = at[0] >= 0 && at[1] >= 0 && at[0] < b.map.width && at[1] < b.map.height;
      if (!insideMap || (!inRect(at[0], at[1], p) && !walkable(at[0], at[1], view))) {
        mapErr(`${where}.round.${j}`, `${stealthRule}: round tile (${at[0]}, ${at[1]}) is not walkable`);
      }
      if (insideMap && isSafeGround(b, at, true)) {
        mapErr(`${where}.round.${j}`, `${stealthRule}: round tile (${at[0]}, ${at[1]}) is on safe ground; no hazard acts there`);
      }
    }
    const hazard = p.id === undefined ? undefined : hazardsOf(b).find((h) => h.id === p.id);
    if (hazard) {
      const watch = new Set(watchOf(b, hazard).map((at) => tileKey(at)));
      const hasCover = b.map.props.some((cover) => {
        if (cover.cover !== true || cover.solid) return false;
        for (let y = cover.y; y < cover.y + cover.h; y++) {
          for (let x = cover.x; x < cover.x + cover.w; x++) if (watch.has(tileKey([x, y]))) return true;
        }
        return false;
      });
      if (!hasCover) mapErr(`${where}.round`, `${stealthRule}: the round's watch contains no cover tile`);
    }
  });

  const predators = hazardsOf(b).filter((h) => h.kind === 'predator');
  const watched = new Set(predators.flatMap((h) => watchOf(b, h)).map((at) => tileKey(at)));
  for (const q of Object.values(b.quests)) {
    if (q.type !== 'stealth') continue;
    let targets = 0;
    q.steps.forEach((step, i) => {
      let slotId: string | undefined;
      if (step.kind === 'visit') slotId = step.slot;
      else if (step.kind === 'find') slotId = Object.values(b.resources).find((r) => r.output === step.item)?.place.slot;
      if (slotId === undefined) return;
      targets++;
      const slot = findSlot(b.map, slotId);
      let insideWatch = false;
      if (slot) {
        for (let y = slot.y; y < slot.y + slot.h && !insideWatch; y++) {
          for (let x = slot.x; x < slot.x + slot.w; x++) if (watched.has(tileKey([x, y]))) insideWatch = true;
        }
      }
      if (!insideWatch) {
        err(origin[q.id] ?? 'content', `quest.steps.${i}`, `${stealthRule}: the stealth target slot "${slotId}" lies outside every predator round's watch`);
      }
    });
    if (targets === 0) {
      err(origin[q.id] ?? 'content', 'quest.steps', `${stealthRule}: a stealth quest needs a find or visit step for the eyes to watch`);
    }
  }

  if (predators.length === 0) return issues;
  const dist = runsToSafety(b);
  const { width } = b.map;
  const { bite_pct } = b.params.hazard.predator;
  for (const h of predators) {
    let worst: { at: [number, number]; steps: number } | undefined;
    const hunted = h.round ? watchOf(b, h) : reachOf(b, h);
    for (const [x, y] of hunted) {
      if (!walkable(x, y, view) || isSafeGround(b, [x, y], true)) continue;
      const steps = dist.get(y * width + x) ?? Number.POSITIVE_INFINITY;
      if (!worst || steps > worst.steps) worst = { at: [x, y], steps };
    }
    if (!worst) continue;
    const where = `map.props.${b.map.props.findIndex((p) => p.id === h.id)}.hazard`;
    const name = rule('G34', 'A hazard is a rule, not a roll');
    if (!Number.isFinite(worst.steps)) {
      mapErr(where, `${name}: a player hunted by "${h.id}" at (${worst.at[0]}, ${worst.at[1]}) has no road to a safe place; the chase never ends`);
      continue;
    }
    const bites = bitesAfter(b, worst.steps * b.params.walk_step_ms);
    if (bites * bite_pct >= 100) {
      mapErr(
        where,
        `${name}: from (${worst.at[0]}, ${worst.at[1]}) the run from "${h.id}" to a safe place is ${worst.steps} tiles, ${bites} bites of ${bite_pct}% - the player falls on the way. Move it nearer a safe place or shrink its reach`,
      );
    }
  }
  return issues;
}
