/**
 * The tree's coverage report (docs/design/PROGRESSION.md 4.9, "The coverage
 * report"): the tree's thin spots, for the quest designer to read first. It
 * informs and never fails. Pure and integer: the same input gives the same
 * report on every machine.
 *
 * A node is touched when content names it, or its school at its band: a quest
 * that pays the school (`reward.xp.school`) or asks for its band, a recipe of
 * the school's profession whose level sits in the band, a place that trains it
 * (a resource or a dig spot of the profession, at its level; for Travel, a
 * crossing's `kind` and `travel` level), a teacher whose `teaches.band_max`
 * reaches it. A node is reserved when its effect has no reader in the code yet
 * (a built node) or its proposal names what it waits on (a proposed node);
 * a proposed node that waits on nothing but its own line is listed apart.
 */

/** The bands of 3.3: 1..4, and 5 for the crown (level 21). */
export type Band = 1 | 2 | 3 | 4 | 5;
export const BANDS: readonly Band[] = [1, 2, 3, 4, 5];

/** A level's band: levels 1-5 band 1, 6-10 band 2, 11-15 band 3, 16-20 band 4, 21 and over the crown. */
export function bandOfLevel(level: number): Band {
  if (level >= 21) return 5;
  return Math.min(4, Math.max(1, Math.ceil(level / 5))) as Band;
}

export function bandName(b: Band): string {
  return b === 5 ? 'crown' : `band ${b}`;
}

export interface CoverageNode {
  id: string;
  band: Band;
  effect: string;
  /** what the node waits on before it can be built; empty when nothing */
  waitsOn: string;
  /** a proposed node whose only wait is its own kernel or client line */
  ownLine: boolean;
}

export interface CoverageSchool {
  /** the school's name, the key touches use */
  name: string;
  built: boolean;
  /** in the first full catalogue (4.2): every built school, and the proposed ones not waiting on combat or the machines */
  firstCatalogue: boolean;
  /** a table row with no node format yet (Company): listed, outside the counts */
  outsideCount: boolean;
  nodes: CoverageNode[];
}

export interface Touch {
  school: string;
  /** the band it reaches; a teacher reaches every band up to it */
  band?: Band;
  bandMax?: Band;
  /** a node named directly */
  node?: string;
  /** what touches it, for the report: "recipe core/reed-cord" */
  by: string;
}

export interface SchoolCoverage {
  name: string;
  built: boolean;
  firstCatalogue: boolean;
  nodes: number;
  touched: string[];
  untouched: string[];
  reserved: { id: string; band: Band; waitsOn: string }[];
  ownLine: string[];
  /** touches per band, 1..5 */
  bandTouches: number[];
  /** the band with the fewest touches among the bands the school has nodes in; null with no nodes */
  thinnestBand: Band | null;
  /** untouched nodes in permille of all nodes; 1000 with no nodes */
  untouchedPermille: number;
  touchedBy: string[];
}

export interface CoverageReport {
  schools: SchoolCoverage[];
  /** the schools ordered by their untouched share, most untouched first, then by name */
  order: string[];
  totals: { schools: number; built: number; proposed: number; proposedFirstCatalogue: number; nodes: number; touched: number; untouched: number; reserved: number };
}

export function coverage(schools: CoverageSchool[], touches: Touch[]): CoverageReport {
  const out: SchoolCoverage[] = [];
  for (const sc of [...schools].sort((a, b) => a.name.localeCompare(b.name))) {
    if (sc.outsideCount) continue;
    const mine = touches.filter((t) => t.school === sc.name);
    const bandTouches = [0, 0, 0, 0, 0];
    for (const t of mine) {
      if (t.band !== undefined) bandTouches[t.band - 1]! += 1;
      if (t.bandMax !== undefined) for (let b = 1; b <= t.bandMax; b++) bandTouches[b - 1]! += 1;
    }
    const named = new Set(mine.flatMap((t) => (t.node === undefined ? [] : [t.node])));
    const touched: string[] = [];
    const untouched: string[] = [];
    for (const n of sc.nodes) (named.has(n.id) || bandTouches[n.band - 1]! > 0 ? touched : untouched).push(n.id);
    const reserved = sc.nodes.filter((n) => n.waitsOn !== '').map((n) => ({ id: n.id, band: n.band, waitsOn: n.waitsOn }));
    const ownLine = sc.nodes.filter((n) => n.ownLine).map((n) => n.id);
    const present = BANDS.filter((b) => sc.nodes.some((n) => n.band === b));
    let thinnest: Band | null = null;
    for (const b of present) if (thinnest === null || bandTouches[b - 1]! < bandTouches[thinnest - 1]!) thinnest = b;
    out.push({
      name: sc.name,
      built: sc.built,
      firstCatalogue: sc.firstCatalogue,
      nodes: sc.nodes.length,
      touched,
      untouched,
      reserved,
      ownLine,
      bandTouches,
      thinnestBand: thinnest,
      untouchedPermille: sc.nodes.length === 0 ? 1000 : Math.floor((untouched.length * 1000) / sc.nodes.length),
      touchedBy: [...new Set(mine.map((t) => t.by))].sort(),
    });
  }
  const order = [...out].sort((a, b) => b.untouchedPermille - a.untouchedPermille || a.name.localeCompare(b.name)).map((s) => s.name);
  const sum = (f: (s: SchoolCoverage) => number) => out.reduce((n, s) => n + f(s), 0);
  return {
    schools: out,
    order,
    totals: {
      schools: out.length,
      built: out.filter((s) => s.built).length,
      proposed: out.filter((s) => !s.built).length,
      proposedFirstCatalogue: out.filter((s) => !s.built && s.firstCatalogue).length,
      nodes: sum((s) => s.nodes),
      touched: sum((s) => s.touched.length),
      untouched: sum((s) => s.untouched.length),
      reserved: sum((s) => s.reserved.length),
    },
  };
}

/** The report as text: reserved first, each with what it waits on; then per school; then the whole tree on one line. */
export function formatCoverage(r: CoverageReport): string {
  const lines: string[] = [];
  const t = r.totals;
  lines.push(`The tree: ${t.built} schools built, ${t.proposed} proposed (${t.proposedFirstCatalogue} of them in the first full catalogue); ${t.nodes} nodes, ${t.touched} touched, ${t.untouched} untouched, ${t.reserved} reserved.`);
  lines.push('');
  lines.push('Reserved (waiting on a system before they can be built):');
  const res = r.schools.flatMap((s) => s.reserved.map((n) => `  ${s.name}/${n.id} (${bandName(n.band)}): ${n.waitsOn}`));
  lines.push(...(res.length > 0 ? res : ['  none']));
  lines.push('');
  for (const s of r.schools) {
    const kind = s.built ? 'built' : s.firstCatalogue ? 'proposed, first catalogue' : 'proposed, later';
    if (s.nodes === 0) {
      lines.push(`${s.name} (${kind}): no nodes yet`);
      continue;
    }
    const bands = BANDS.map((b) => `${bandName(b)} ${s.bandTouches[b - 1]}`).join(', ');
    lines.push(`${s.name} (${kind}): ${s.nodes} nodes, ${s.touched.length} touched, ${s.untouched.length} untouched, ${s.reserved.length} reserved; thinnest ${s.thinnestBand === null ? 'none' : bandName(s.thinnestBand)}`);
    lines.push(`  touches by band: ${bands}`);
    if (s.untouched.length > 0) lines.push(`  untouched: ${s.untouched.join(', ')}`);
    if (s.ownLine.length > 0) lines.push(`  waiting only on their own line: ${s.ownLine.join(', ')}`);
  }
  lines.push('');
  lines.push(`By untouched share: ${r.schools
    .slice()
    .sort((a, b) => r.order.indexOf(a.name) - r.order.indexOf(b.name))
    .map((s) => `${s.name} ${Math.floor(s.untouchedPermille / 10)}%`)
    .join(', ')}`);
  return lines.join('\n');
}

/** A proposal table's band cell: "1", "2 (human)", "3, Trail", "crown". */
export function parseBandCell(cell: string): Band | null {
  const c = cell.trim().toLowerCase();
  if (c.startsWith('crown')) return 5;
  const m = /^(\d)/.exec(c);
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 1 && n <= 4 ? (n as Band) : null;
}

const cells = (row: string) =>
  row
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim());
const plain = (c: string) => c.replace(/\*\*/g, '').replace(/`/g, '').trim();

/** States in the catalogue tables (4.2) that keep a school out of the first full catalogue. */
const LATER = [/^with combat/i, /^with the city/i];
const OUTSIDE = [/^later/i];

/**
 * The proposals' tables of a design page (PROGRESSION.md): every catalogue table (`| School | State |` or the
 * combat table `| School | What it reads |`) names a school; a node table (`| Band | id | ... | Effect | ... | Waits on |`)
 * gives the nodes of the school its section heading names.
 */
export function parseProposals(md: string): { name: string; state: string; nodes: CoverageNode[] }[] {
  const schools = new Map<string, { name: string; state: string; nodes: CoverageNode[] }>();
  const lines = md.split('\n');
  let heading = '';
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (/^#{1,6} /.test(line)) {
      heading = line;
      continue;
    }
    if (!line.startsWith('|') || !lines[i + 1]?.startsWith('|')) continue;
    const head = cells(line).map((c) => plain(c).toLowerCase());
    if (!/^\|[\s:|-]+\|$/.test(lines[i + 1]!.trim())) continue;
    let j = i + 2;
    const rows: string[][] = [];
    while (j < lines.length && lines[j]!.startsWith('|')) rows.push(cells(lines[j++]!));
    if (head[0] === 'school') {
      const stateCol = head.indexOf('state');
      for (const r of rows) {
        const name = plain(r[0] ?? '').split(' (')[0]!.trim();
        if (name === '') continue;
        const state = stateCol >= 0 ? plain(r[stateCol] ?? '') : 'with combat';
        if (!schools.has(name)) schools.set(name, { name, state, nodes: [] });
      }
    } else if (head[0] === 'band' && head[1] === 'id' && head.includes('effect') && head.includes('waits on')) {
      const school = [...schools.keys()].find((n) => new RegExp(`\\b${n}\\b`).test(heading));
      if (school !== undefined) {
        const eff = head.indexOf('effect');
        const wait = head.indexOf('waits on');
        for (const r of rows) {
          const band = parseBandCell(r[0] ?? '');
          const id = plain(r[1] ?? '');
          if (band === null || id === '') continue;
          const w = plain(r[wait] ?? '');
          const none = w === '' || w.toLowerCase() === 'none';
          schools.get(school)!.nodes.push({ id, band, effect: plain(r[eff] ?? ''), waitsOn: none ? '' : w, ownLine: none });
        }
      }
    }
    i = j - 1;
  }
  return [...schools.values()];
}

export function isFirstCatalogue(state: string): boolean {
  return !LATER.some((r) => r.test(state)) && !OUTSIDE.some((r) => r.test(state));
}

export function isOutsideCount(state: string): boolean {
  return OUTSIDE.some((r) => r.test(state));
}
