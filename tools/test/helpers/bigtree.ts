/**
 * A tree of about three hundred nodes for the tests only, never for players (DECISIONS 2026-10-23
 * "The tree is data"): the core bundle with each school's nodes replaced by a generated wing. Each
 * wing has a root, a spine of six major nodes, a branch of six small nodes off each of them (three
 * ending in a keystone), a fork of two off each branch, one corner for each race and a link to the
 * next wing's spine; six clusters name the spine's stretches. The same input gives the same tree.
 */
import type { Bundle } from '@game/kernel';
import { EFFECTS, type SchoolNodeDef } from '@game/schema';

const SPINE = 6;
const BRANCH = 6;

/** The core bundle with every school grown to a wing of about sixty nodes (61 with the corners of three races). */
export function bigTree(core: Bundle): Bundle {
  const b = structuredClone(core);
  const ids = Object.keys(b.schools).sort();
  const races = Object.keys(b.races).sort();
  const items = Object.keys(b.items).sort();
  b.params.growth!.nodes_max = 80;
  ids.forEach((id, s) => {
    const school = b.schools[id]!;
    const next = ids[(s + 1) % ids.length]!;
    const nodes: SchoolNodeDef[] = [];
    let k = 0;
    const node = (n: Partial<SchoolNodeDef> & Pick<SchoolNodeDef, 'id' | 'size'>): SchoolNodeDef => {
      k++;
      const effect = EFFECTS[(s + k) % EFFECTS.length]!;
      const made: SchoolNodeDef = {
        name: `${n.id.replaceAll('-', ' ').replace(/^./, (c) => c.toUpperCase())}`,
        text: `A test node of ${school.name.toLowerCase()} that moves one thing a little.`,
        effect,
        value: 1 + ((s * 7 + k * 3) % 15),
        icon: items[(s * 11 + k) % items.length],
        ...n,
      };
      nodes.push(made);
      return made;
    };
    node({ id: 'root', size: 'small', cluster: 'spine-1' });
    for (let m = 1; m <= SPINE; m++) {
      node({ id: `spine-${m}`, size: 'major', slot: m % 2 === 0, needs: [m === 1 ? 'root' : `spine-${m - 1}`], cluster: `spine-${m}` });
      for (let j = 1; j <= BRANCH; j++) {
        node({ id: `branch-${m}-${j}`, size: 'small', needs: [j === 1 ? `spine-${m}` : `branch-${m}-${j - 1}`], cluster: `spine-${m}` });
      }
      if (m % 2 === 1) node({ id: `keystone-${m}`, size: 'keystone', needs: [`branch-${m}-${BRANCH}`], cluster: `spine-${m}` });
      for (let j = 1; j <= 2; j++) {
        node({ id: `fork-${m}-${j}`, size: j === 2 ? 'major' : 'small', needs: [j === 1 ? `branch-${m}-3` : `fork-${m}-1`], cluster: `spine-${m}` });
      }
    }
    // the last fork of the wing also needs the next wing's last spine node: two wings joined
    const last = nodes.find((n) => n.id === `fork-${SPINE}-2`)!;
    last.needs = [...(last.needs ?? []), `${next}/spine-${SPINE}`];
    races.forEach((race, r) => node({ id: `corner-${r + 1}`, size: 'corner', slot: true, race, needs: ['spine-1'], cluster: 'spine-1' }));
    school.nodes = nodes;
    school.clusters = Array.from({ length: SPINE }, (_, m) => ({ id: `spine-${m + 1}`, name: `Stretch ${m + 1}` }));
  });
  return b;
}

/** How many nodes a tree has, every school's together. */
export function treeSize(b: Bundle): number {
  return Object.values(b.schools).reduce((n, sc) => n + sc.nodes.length, 0);
}
