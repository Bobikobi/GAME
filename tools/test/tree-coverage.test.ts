/**
 * pnpm tree:coverage (docs/design/PROGRESSION.md 4.9): touched, untouched and
 * reserved nodes per school, the thinnest band, the order by untouched share,
 * the proposals' tables read from a design page, and one run on the content.
 */
import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { assemble } from '../src/assemble';
import { loadAll } from '../src/load';
import { type CoverageSchool, bandOfLevel, coverage, formatCoverage, parseBandCell, parseProposals } from '../src/tree/coverage';
import { builtSchools, contentTouches, proposedSchools, readEffects } from '../src/tree/sources';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

const PAGE = `# A page

### 4.2 The catalogue

| School | State | What its nodes may change |
|---|---|---|
| Foraging | now | \`gather_speed_pct\` |
| **Travel** | foundation | carrying |
| Hunting | with combat | \`track_read\` |
| Company | later | \`pet_slot\` |

| School | What it reads |
|---|---|
| Strike (blades) | might |

### 4.8 Travel, a full school

| Band | id | Name | Size | Needs | Effect | Value | Text | Waits on |
|---|---|---|---|---|---|---|---|---|
| 1 | \`steady-load\` | Steady | small | none | \`load_pct\` | 5 | More. | #297 |
| 2 (human) | \`road-packer\` | Road | corner | \`steady-load\` | \`load_pct\` | 10, slot | More. | #297 |
| 3, Trail | \`long-stride\` | Long | small | none | \`walk_step_pct\` | 5 | Further. | none |
| crown | \`wayfarer\` | Wayfarer | major | \`long-stride\` | \`raise_move\` | 5 | Past. | the crown's format |
`;

const school = (name: string, nodes: [string, 1 | 2 | 3 | 4 | 5, string?][], built = true): CoverageSchool => ({
  name,
  built,
  firstCatalogue: true,
  outsideCount: false,
  nodes: nodes.map(([id, band, waits]) => ({ id, band, effect: 'x', waitsOn: waits ?? '', ownLine: false })),
});

describe('bands', () => {
  it('reads a level and a table cell into a band', () => {
    expect([1, 5, 6, 10, 11, 16, 20, 21].map(bandOfLevel)).toEqual([1, 1, 2, 2, 3, 4, 4, 5]);
    expect(['1', '2 (human)', '3, Trail', 'crown', 'none'].map(parseBandCell)).toEqual([1, 2, 3, 5, null]);
  });
});

describe('the proposals tables', () => {
  const p = parseProposals(PAGE);
  it('names every school of the catalogue tables, the combat table included', () => {
    expect(p.map((s) => s.name)).toEqual(['Foraging', 'Travel', 'Hunting', 'Company', 'Strike']);
  });
  it('gives the node table to the school its heading names, with bands and waits', () => {
    const travel = p.find((s) => s.name === 'Travel')!;
    expect(travel.nodes.map((n) => [n.id, n.band, n.waitsOn, n.ownLine])).toEqual([
      ['steady-load', 1, '#297', false],
      ['road-packer', 2, '#297', false],
      ['long-stride', 3, '', true],
      ['wayfarer', 5, "the crown's format", false],
    ]);
  });
  it('keeps a built school out and sorts the rest into the first catalogue, later, or outside the count', () => {
    const s = proposedSchools(PAGE, new Set(['Foraging']));
    expect(s.map((x) => [x.name, x.firstCatalogue, x.outsideCount])).toEqual([
      ['Travel', true, false],
      ['Hunting', false, false],
      ['Company', false, true],
      ['Strike', false, false],
    ]);
  });
});

describe('coverage', () => {
  const schools = [school('A', [['a1', 1], ['a2', 1], ['a3', 2, 'a verb']]), school('B', [['b1', 1], ['b2', 3]]), school('C', [], false)];
  const r = coverage(schools, [
    { school: 'A', band: 1, by: 'recipe r1' },
    { school: 'A', band: 1, by: 'recipe r2' },
    { school: 'B', node: 'b2', by: 'quest q' },
    { school: 'B', bandMax: 1, by: 'teacher t' },
  ]);
  it('counts touched, untouched and reserved per school', () => {
    const a = r.schools.find((s) => s.name === 'A')!;
    expect([a.touched, a.untouched, a.reserved.map((n) => n.id)]).toEqual([['a1', 'a2'], ['a3'], ['a3']]);
    const b = r.schools.find((s) => s.name === 'B')!;
    expect([b.touched, b.untouched, b.bandTouches]).toEqual([['b1', 'b2'], [], [1, 0, 0, 0, 0]]);
  });
  it('names the thinnest band among the bands a school has nodes in', () => {
    expect(r.schools.map((s) => s.thinnestBand)).toEqual([2, 3, null]);
  });
  it('orders the schools by their untouched share, most untouched first', () => {
    expect(r.order).toEqual(['C', 'A', 'B']);
    expect(r.totals).toMatchObject({ schools: 3, built: 2, proposed: 1, nodes: 5, touched: 4, untouched: 1, reserved: 1 });
  });
  it('lists the reserved nodes first in the text, each with what it waits on', () => {
    const text = formatCoverage(r);
    expect(text.indexOf('A/a3 (band 2): a verb')).toBeGreaterThan(0);
    expect(text.indexOf('A/a3')).toBeLessThan(text.indexOf('A (built)'));
    expect(text).toContain('C (proposed, first catalogue): no nodes yet');
  });
});

describe('on the content', () => {
  const b = assemble(loadAll().files).bundle!;
  const effects = [...new Set(Object.values(b.schools).flatMap((s) => s.nodes.map((n) => n.effect)))].sort();
  const read = readEffects([join(ROOT, 'kernel/src'), join(ROOT, 'game/src')], effects);
  const run = () => coverage([...builtSchools(b, read), ...proposedSchools(PAGE, new Set(Object.values(b.schools).map((s) => s.name)))], contentTouches(b));
  it('every built school is in the report with all its nodes, and every built effect has a reader', () => {
    const r = run();
    for (const sc of Object.values(b.schools)) expect(r.schools.find((s) => s.name === sc.name)?.nodes).toBe(sc.nodes.length);
    expect(effects.filter((e) => !read.has(e))).toEqual([]);
  });
  it('a recipe touches its profession\'s school at its level\'s band', () => {
    const touches = contentTouches(b);
    const id = Object.keys(b.recipes).sort()[0]!;
    expect(touches.some((t) => t.by === `recipe ${id}` && t.band === bandOfLevel(b.recipes[id]!.level ?? 1))).toBe(true);
  });
  it('is the same on two runs', () => {
    expect(JSON.stringify(run())).toBe(JSON.stringify(run()));
  });
});
