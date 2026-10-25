/**
 * The shape of the height layer and of the open world's chunks (NEXT section
 * 19 a), past what the schema can say: a level row beside every ground row and
 * as long, a stamped place whose rows are one width and which stays inside its
 * 64 by 64 chunk, and every prop, slot and predator round inside the grid it
 * is counted in.
 */
import type { Chunk } from '@game/schema';

/** A chunk is 64 tiles a side (OPEN_WORLD G51). */
export const CHUNK_SIZE = 64;

export interface ShapeProblem {
  where: string;
  message: string;
}

type Prop = Chunk['props'][number];
type Slot = NonNullable<Chunk['stamps'][number]['slots']>[number];

/** A level layer beside its ground: as many rows, each as long as the ground row beside it. */
export function levelsProblems(levels: readonly string[], grounds: readonly string[], where: string): ShapeProblem[] {
  const problems: ShapeProblem[] = [];
  if (levels.length !== grounds.length) problems.push({ where, message: `has ${levels.length} rows, the ground has ${grounds.length}` });
  levels.forEach((row, y) => {
    const ground = grounds[y];
    if (ground !== undefined && row.length !== ground.length) {
      problems.push({ where: `${where}.${y}`, message: `row is ${row.length} wide, the ground row beside it is ${ground.length}` });
    }
  });
  return problems;
}

/** Props, their predator rounds and slots inside a w by h area counted from its own corner. */
function areaProblems(props: readonly Prop[], slots: readonly Slot[], w: number, h: number, where: string, what: string): ShapeProblem[] {
  const problems: ShapeProblem[] = [];
  props.forEach((p, i) => {
    if (p.x + p.w > w || p.y + p.h > h) problems.push({ where: `${where}.props.${i}`, message: `reaches past the edge of the ${what}` });
    p.hazard?.round?.forEach(([x, y], j) => {
      if (x >= w || y >= h) problems.push({ where: `${where}.props.${i}.hazard.round.${j}`, message: `is outside the ${what}` });
    });
  });
  slots.forEach((s, i) => {
    if (s.x + s.w > w || s.y + s.h > h) problems.push({ where: `${where}.slots.${i}`, message: `reaches past the edge of the ${what}` });
  });
  return problems;
}

/** Everything of one chunk that must fit: its props in the block, and each stamped place in the block and its own things in the place. */
export function chunkProblems(c: Chunk): ShapeProblem[] {
  const problems = areaProblems(c.props, [], CHUNK_SIZE, CHUNK_SIZE, 'chunk', 'chunk');
  const ids = new Set<string>();
  c.stamps.forEach((s, i) => {
    const where = `chunk.stamps.${i}`;
    if (ids.has(s.id)) problems.push({ where: `${where}.id`, message: `stamp id "${s.id}" is used twice on the chunk` });
    ids.add(s.id);
    // the place's own rows give its size; with none, it may reach to the chunk's far edges
    const rows = s.grounds ?? s.levels;
    const w = rows ? (rows[0]?.length ?? 0) : CHUNK_SIZE - s.x;
    const h = rows ? rows.length : CHUNK_SIZE - s.y;
    if (s.grounds) {
      s.grounds.forEach((row, y) => {
        if (row.length !== w) problems.push({ where: `${where}.grounds.${y}`, message: `row is ${row.length} wide, the place's first row is ${w}` });
      });
      if (s.levels) problems.push(...levelsProblems(s.levels, s.grounds, `${where}.levels`));
    } else if (s.levels) {
      s.levels.forEach((row, y) => {
        if (row.length !== w) problems.push({ where: `${where}.levels.${y}`, message: `row is ${row.length} wide, the place's first row is ${w}` });
      });
    }
    if (s.x + w > CHUNK_SIZE || s.y + h > CHUNK_SIZE) {
      problems.push({ where, message: `the place is ${w} by ${h} at (${s.x}, ${s.y}) and reaches past the edge of the chunk` });
    }
    problems.push(...areaProblems(s.props ?? [], s.slots ?? [], w, h, where, 'place'));
  });
  return problems;
}
