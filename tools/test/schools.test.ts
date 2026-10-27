/**
 * The skill tree's check (tools/src/schools.ts; docs/design/GROWTH.md section 4.5): the core schools
 * pass, a generated tree of about three hundred nodes passes, and a school that breaks each structural
 * rule gets an error that names it.
 */
import type { Bundle } from '@game/kernel';
import { beforeAll, describe, expect, it } from 'vitest';
import { runCheck } from '../src/check';
import { checkSchools } from '../src/schools';
import { bigTree, treeSize } from './helpers/bigtree';

let core: Bundle;
beforeAll(() => {
  core = runCheck().assembled.bundle!;
});

const DIG = 'core/digging-school';
const messages = (b: Bundle) => checkSchools(b, {}).map((i) => `${i.where}: ${i.message}`);
const dig = (b: Bundle) => b.schools[DIG]!;

describe('the core schools', () => {
  it('pass every school check', () => {
    expect(checkSchools(core, {})).toEqual([]);
  });
});

describe('a tree of about three hundred nodes', () => {
  it('passes every school check: joined wings, clusters, keystones and a corner for each race', () => {
    const big = bigTree(core);
    expect(treeSize(big)).toBeGreaterThanOrEqual(300);
    expect(checkSchools(big, {})).toEqual([]);
    const crossing = Object.values(big.schools).flatMap((sc) => sc.nodes.flatMap((n) => (n.needs ?? []).filter((m) => m.includes('/'))));
    expect(crossing.length).toBe(Object.keys(big.schools).length);
    expect(Object.values(big.schools).every((sc) => sc.nodes.some((n) => n.size === 'keystone'))).toBe(true);
  });

  it('is the same tree every time', () => {
    expect(bigTree(core)).toEqual(bigTree(core));
  });
});

describe('a school that breaks a rule', () => {
  it('a profession that does not exist, and a second school for one profession', () => {
    const b = structuredClone(core);
    b.schools['core/twin'] = { ...structuredClone(dig(b)), id: 'core/twin' };
    dig(b).profession = 'core/juggling';
    const m = messages(b);
    expect(m).toContainEqual(expect.stringContaining('no profession "core/juggling"'));
    const c = structuredClone(core);
    c.schools['core/twin'] = { ...structuredClone(dig(c)), id: 'core/twin' };
    expect(messages(c)).toContainEqual(expect.stringContaining('"core/digging" already has the school'));
  });

  it('a node id twice, a need that is not there, and needs that go round', () => {
    const b = structuredClone(core);
    const nodes = dig(b).nodes;
    nodes[1]!.id = nodes[0]!.id;
    nodes[2]!.needs = ['nowhere'];
    expect(messages(b)).toContainEqual(expect.stringContaining('is used twice in this school'));
    expect(messages(b)).toContainEqual(expect.stringContaining('no node "nowhere" before it'));
    const c = structuredClone(core);
    const cn = dig(c).nodes;
    cn[0]!.needs = [cn[2]!.id];
    expect(messages(c)).toContainEqual(expect.stringContaining('go round in a circle'));
  });

  it('a corner with no race or an unknown one, a path node with a race, two corners for one race', () => {
    const b = structuredClone(core);
    const nodes = dig(b).nodes;
    const corner = nodes.find((n) => n.size === 'corner')!;
    delete corner.race;
    nodes[0]!.race = 'core/human';
    const m = messages(b);
    expect(m).toContainEqual(expect.stringContaining('a corner node names the race it belongs to'));
    expect(m).toContainEqual(expect.stringContaining('only a corner node belongs to a race'));
    const c = structuredClone(core);
    const corners = dig(c).nodes.filter((n) => n.size === 'corner');
    corners[0]!.race = corners[1]!.race;
    expect(messages(c)).toContainEqual(expect.stringContaining('a race has at most one in each school'));
    const d = structuredClone(core);
    dig(d).nodes.find((n) => n.size === 'corner')!.race = 'core/dwarf';
    expect(messages(d)).toContainEqual(expect.stringContaining('no race "core/dwarf"'));
  });

  it('a small node in a slot, an icon that is no item, and a school too big for one race', () => {
    const b = structuredClone(core);
    const nodes = dig(b).nodes;
    nodes.find((n) => n.size === 'small')!.slot = true;
    nodes[0]!.icon = 'core/nothing';
    const m = messages(b);
    expect(m).toContainEqual(expect.stringContaining('only a major or a corner node is a technique'));
    expect(m).toContainEqual(expect.stringContaining('no item "core/nothing"'));
    const c = structuredClone(core);
    const path = dig(c).nodes.filter((n) => n.size !== 'corner');
    const most = c.params.growth!.nodes_max;
    for (let i = path.length; i < most; i++) dig(c).nodes.push({ ...structuredClone(path[0]!), id: `extra-${i}`, needs: [path[0]!.id] });
    expect(messages(c)).toContainEqual(expect.stringContaining(`at most ${most}`));
  });

  it('a node that stands alone, a need in a wing that is not there, and needs that go round across wings', () => {
    const b = structuredClone(core);
    dig(b).nodes.push({ ...structuredClone(dig(b).nodes[0]!), id: 'alone', needs: [] });
    expect(messages(b)).toContainEqual(expect.stringContaining('"alone" stands alone'));
    const c = bigTree(core);
    dig(c).nodes[0]!.needs = ['core/nowhere-school/root'];
    expect(messages(c)).toContainEqual(expect.stringContaining('no node "core/nowhere-school/root" in the tree'));
    const d = bigTree(core);
    const ids = Object.keys(d.schools).sort();
    // each wing's last fork needs the next wing's last spine node: a spine that needs its own wing's fork back closes a ring
    for (const [i, id] of ids.entries()) d.schools[id]!.nodes.find((n) => n.id === 'spine-6')!.needs = [`${ids[(i + ids.length - 1) % ids.length]}/fork-6-2`];
    expect(messages(d)).toContainEqual(expect.stringContaining('go round in a circle'));
  });

  it('a price outside its size\'s band, a keystone in a slot, and clusters that do not match', () => {
    const b = bigTree(core);
    const nodes = dig(b).nodes;
    nodes.find((n) => n.size === 'small')!.cost = 9;
    nodes.find((n) => n.size === 'keystone')!.slot = true;
    nodes[0]!.cluster = 'nowhere';
    dig(b).clusters!.push({ id: 'empty', name: 'Empty' });
    const m = messages(b);
    expect(m).toContainEqual(expect.stringContaining('a small node costs 1 to 2 points, not 9'));
    expect(m).toContainEqual(expect.stringContaining('a keystone node is always on'));
    expect(m).toContainEqual(expect.stringContaining('no cluster "nowhere"'));
    expect(m).toContainEqual(expect.stringContaining('the cluster "empty" holds no node'));
  });

  it('places given to some nodes of a school only, and two nodes in one place', () => {
    const b = structuredClone(core);
    dig(b).nodes[0]!.pos = { x: 3, y: 0 };
    expect(messages(b)).toContainEqual(expect.stringContaining('a school gives every node a place or none'));
    const c = structuredClone(core);
    dig(c).nodes.forEach((n, i) => (n.pos = { x: 3 + i, y: 0 }));
    dig(c).nodes[1]!.pos = { x: 3, y: 0 };
    expect(messages(c)).toContainEqual(expect.stringContaining('the place 3,0 is taken'));
    const d = structuredClone(core);
    dig(d).nodes.forEach((n, i) => (n.pos = n.size === 'corner' ? { x: 9, y: 9 } : { x: 3 + i, y: 0 }));
    expect(checkSchools(d, {}), 'the corners of different races may share a place: one is ever seen').toEqual([]);
  });

  it('a school with no growth params, and a slot that opens before the one ahead of it', () => {
    const b = structuredClone(core);
    delete b.params.growth;
    expect(messages(b)).toContainEqual(expect.stringContaining('no "growth" group'));
    const c = structuredClone(core);
    c.params.growth!.slot_levels = [1, 5, 3];
    expect(messages(c)).toContainEqual(expect.stringContaining('a later slot never opens before an earlier one'));
  });
});
