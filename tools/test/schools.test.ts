/**
 * The skill tree's check (tools/src/schools.ts; docs/design/GROWTH.md section 4.5): the core schools
 * pass, and a school that breaks each structural rule gets an error that names it.
 */
import type { Bundle } from '@game/kernel';
import { beforeAll, describe, expect, it } from 'vitest';
import { runCheck } from '../src/check';
import { SCHOOL_NODES_MAX, checkSchools } from '../src/schools';

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
    for (let i = path.length; i < SCHOOL_NODES_MAX; i++) dig(c).nodes.push({ ...structuredClone(path[0]!), id: `extra-${i}`, needs: [] });
    expect(messages(c)).toContainEqual(expect.stringContaining(`at most ${SCHOOL_NODES_MAX}`));
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
