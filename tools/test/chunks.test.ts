/**
 * The shape of the height layer and of a chunk past the schema (NEXT section 19 a): a sound chunk passes, and
 * each way a place, a prop, a slot or a level row can spill out of its grid gets an error that says where.
 */
import { describe, expect, it } from 'vitest';
import type { Chunk } from '@game/schema';
import { assemble } from '../src/assemble';
import { chunkProblems, levelsProblems } from '../src/chunks';
import { loadAll, type Loaded } from '../src/load';

const chunk = (): Chunk => ({
  x: 0,
  y: 0,
  grounds: Array.from({ length: 64 }, () => '.'.repeat(64)),
  props: [{ sprite: 'core/base-kit:props/oak', x: 3, y: 4, w: 2, h: 2, solid: true }],
  stamps: [
    {
      id: 'core/boathouse',
      x: 40,
      y: 40,
      grounds: ['...', '...'],
      levels: ['000', '011'],
      props: [{ sprite: 'core/base-kit:props/boathouse', x: 0, y: 0, w: 2, h: 2, solid: true }],
      slots: [{ id: 'core/boathouse-keeper', kind: 'npc', x: 2, y: 1, w: 1, h: 1 }],
    },
  ],
});

const stamp = (c: Chunk) => c.stamps[0]!;
const wheres = (c: Chunk) => chunkProblems(c).map((p) => p.where);

describe('the height layer beside its ground', () => {
  it('passes when every row has a level row as long', () => {
    expect(levelsProblems(['01', '12'], ['..', '..'], 'map.levels')).toEqual([]);
  });

  it('names a missing row and a row of another width', () => {
    expect(levelsProblems(['01'], ['..', '..'], 'map.levels').map((p) => p.where)).toEqual(['map.levels']);
    expect(levelsProblems(['01', '1'], ['..', '..'], 'map.levels').map((p) => p.where)).toEqual(['map.levels.1']);
  });
});

describe('a chunk', () => {
  it('that fits passes', () => {
    expect(chunkProblems(chunk())).toEqual([]);
  });

  it('refuses a prop that reaches past the block', () => {
    const c = chunk();
    c.props[0] = { ...c.props[0]!, x: 63, w: 2 };
    expect(wheres(c)).toEqual(['chunk.props.0']);
  });

  it('refuses a predator round that leaves the block', () => {
    const c = chunk();
    c.props[0] = { ...c.props[0]!, id: 'core/wolf', hazard: { kind: 'predator', window: ['night'], round: [[3, 4], [63, 4], [63, 5], [3, 5]] } };
    expect(wheres(c)).toEqual([]);
    c.props[0].hazard!.round![1] = [64, 4];
    expect(wheres(c)).toEqual(['chunk.props.0.hazard.round.1']);
  });

  it('refuses a stamped place whose rows are not one width', () => {
    const c = chunk();
    stamp(c).grounds = ['...', '..'];
    stamp(c).levels = undefined;
    expect(wheres(c)).toEqual(['chunk.stamps.0.grounds.1']);
  });

  it('refuses levels of another shape than the place', () => {
    const c = chunk();
    stamp(c).levels = ['000'];
    expect(wheres(c)).toEqual(['chunk.stamps.0.levels']);
    stamp(c).levels = ['000', '01'];
    expect(wheres(c)).toEqual(['chunk.stamps.0.levels.1']);
  });

  it('refuses a place that spills out of the chunk', () => {
    const c = chunk();
    stamp(c).x = 62;
    // the place is 3 wide, and its slot at 2 still fits inside it
    expect(wheres(c)).toEqual(['chunk.stamps.0']);
  });

  it("refuses a place's prop or slot outside the place", () => {
    const c = chunk();
    stamp(c).props![0] = { ...stamp(c).props![0]!, x: 2 };
    stamp(c).slots![0] = { ...stamp(c).slots![0]!, y: 2 };
    expect(wheres(c)).toEqual(['chunk.stamps.0.props.0', 'chunk.stamps.0.slots.0']);
  });

  it('lets a place with no rows of its own reach to the far edges of the chunk', () => {
    const c = chunk();
    stamp(c).grounds = undefined;
    stamp(c).levels = undefined;
    stamp(c).props![0] = { ...stamp(c).props![0]!, x: 22, y: 22 };
    expect(wheres(c)).toEqual([]);
    stamp(c).props![0] = { ...stamp(c).props![0]!, x: 23 };
    expect(wheres(c)).toEqual(['chunk.stamps.0.props.0']);
  });

  it('refuses two places of one id', () => {
    const c = chunk();
    c.stamps.push({ ...stamp(c), x: 0, y: 0 });
    expect(wheres(c)).toEqual(['chunk.stamps.1.id']);
  });
});

describe('in the content check', () => {
  const files = loadAll().files;

  it("reports a map's level rows that do not match its ground", () => {
    const changed = files.map((f): Loaded => {
      if (f.data.type !== 'map') return f;
      const map = { ...f.data.map, levels: f.data.map.ground.slice(1).map((row) => '0'.repeat(row.length)) };
      return { ...f, data: { ...f.data, map } };
    });
    expect(assemble(changed).issues.map((i) => i.where)).toContain('map.levels');
  });

  it('reports a chunk file whose place spills out of it', () => {
    const map = files.find((f) => f.data.type === 'map')!;
    const bad = chunk();
    stamp(bad).x = 62;
    const file = { format: 1, type: 'chunk', id: 'core/chunk-0-0', title: 'Chunk (0, 0)', creator: 'core', chunk: bad };
    const withChunk = [...files, { rel: 'core/chunk-0-0.json', abs: map.abs.replace(/map\.json$/, 'chunk-0-0.json'), data: file as unknown as Loaded['data'] }];
    const issues = assemble(withChunk).issues.filter((i) => i.file.endsWith('chunk-0-0.json'));
    expect(issues.map((i) => i.where)).toEqual(['chunk.stamps.0']);
  });
});
