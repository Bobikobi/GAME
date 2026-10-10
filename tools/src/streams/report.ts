/**
 * The live picture of parallel work: which branch belongs to which stream, what is
 * stacked on what, what really collides, and in which order the pull requests can
 * land. Pure: cli.ts gathers the facts from git and GitHub, this file decides what
 * they mean. Nothing here is committed anywhere; the picture is recomputed on demand
 * (docs/team/PARALLEL.md).
 */

export type Ci = 'pass' | 'fail' | 'pending' | 'none';

/** One line of docs/team/streams.json: a unit of work that may span several branches. */
export interface StreamDef {
  id: string;
  title: string;
  /** What it advances in the original plan: spec requirement ids and stages, GRUNT items. */
  plan: string[];
  branches: string[];
  /** The session that holds it. null until the owner says; never guessed. */
  owner: string | null;
  /** Reshapes what everyone builds on (a rename, a schema reshaping): lands first, in a quiet window. */
  cross_cutting?: boolean;
  /** Kept for reference, not part of the order (trials, shelved work). */
  parked?: boolean;
}

export interface PrFact {
  number: number;
  title: string;
  url: string;
  draft: boolean;
  ci: Ci;
}

export interface BranchFact {
  branch: string;
  /** false when no branch of that name exists in this repository at all */
  exists: boolean;
  /** commits in the branch that develop lacks */
  ahead: number;
  /** commits on develop that the branch lacks */
  behind: number;
  /** commits that exist only in a local worktree, not on GitHub */
  unpushed: number;
  /** files the branch changes against develop */
  files: number;
  pr?: PrFact;
  /** other mapped branches whose tips lie inside this one: this branch is built on them */
  contains: string[];
  /** files that conflict when the branch merges into develop */
  conflicts: string[];
}

/** Two branches that are not stacked on each other and cannot both merge without a hand edit. */
export interface Collision {
  a: string;
  b: string;
  files: string[];
}

export interface Stray {
  number: number;
  title: string;
  branch: string;
  draft: boolean;
}

export interface Facts {
  develop: string;
  streams: StreamDef[];
  /** the mapped branches that are not parked */
  branches: BranchFact[];
  collisions: Collision[];
  /** open pull requests into develop that no stream lists */
  strays: Stray[];
}

export type State =
  | 'ready'
  | 'waiting-on-base'
  | 'draft'
  | 'ci-failing'
  | 'ci-pending'
  | 'no-pr'
  | 'inside'
  | 'empty'
  | 'missing';

export interface Entry {
  stream: string;
  branch: string;
  state: State;
  pr?: PrFact;
  ahead: number;
  behind: number;
  stackedOn: string[];
  conflicts: string[];
  /** the other streams this one cannot merge with without a hand edit */
  collidesWith: string[];
  actions: string[];
}

/** What two streams both change. Only `hand` files need a person; the others a command or nothing. */
export interface Overlap {
  a: string;
  b: string;
  hand: string[];
  generated: string[];
  append: string[];
}

export interface Report {
  develop: string;
  /** the pull requests that can land now, in the order proposed */
  order: Entry[];
  entries: Entry[];
  overlaps: Overlap[];
  strays: Stray[];
  streams: StreamDef[];
}

/** What GitHub's status rollup of a pull request adds up to: check runs carry a conclusion, commit statuses a state. */
export function ciOf(rollup: readonly { status?: string; conclusion?: string; state?: string }[]): Ci {
  if (rollup.length === 0) return 'none';
  let pending = false;
  for (const item of rollup) {
    const verdict = (item.conclusion || item.state || '').toUpperCase();
    if (['FAILURE', 'ERROR', 'TIMED_OUT', 'CANCELLED', 'STARTUP_FAILURE', 'ACTION_REQUIRED'].includes(verdict)) return 'fail';
    if (['SUCCESS', 'NEUTRAL', 'SKIPPED'].includes(verdict)) continue;
    pending = true;
  }
  return pending ? 'pending' : 'pass';
}

export type FileKind = 'generated' | 'append' | 'hand';

/** Files a tool writes: never hand-merged, regenerated after the merge. */
const GENERATED: readonly [RegExp, string][] = [
  [/^schema\/json\//, 'pnpm schemas'],
  [/^content\/values\.lock\.json$/, 'pnpm values'],
  [/^CREDITS\.md$/, 'pnpm credits'],
  [/^content\/board\.json$/, 'pnpm board'],
];

/** Files every stream appends to; .gitattributes merges both sides. */
const APPEND_ONLY: readonly string[] = ['DECISIONS.md'];

export function classify(file: string): FileKind {
  if (APPEND_ONLY.includes(file)) return 'append';
  return GENERATED.some(([pattern]) => pattern.test(file)) ? 'generated' : 'hand';
}

function regenerate(files: readonly string[]): string[] {
  const commands = new Set<string>();
  for (const file of files) {
    for (const [pattern, command] of GENERATED) if (pattern.test(file)) commands.add(command);
  }
  return [...commands];
}

export function buildReport(facts: Facts): Report {
  const streamOf = new Map<string, string>();
  const crossCutting = new Set<string>();
  for (const stream of facts.streams) {
    for (const branch of stream.branches) streamOf.set(branch, stream.id);
    if (stream.cross_cutting) crossCutting.add(stream.id);
  }
  const byBranch = new Map(facts.branches.map((b) => [b.branch, b] as const));
  const overlaps = overlapsOf(facts.collisions, streamOf);

  const entries: Entry[] = facts.branches.map((fact) => {
    // only a branch with a pull request of its own is a base; a branch without one that lies
    // inside another is just an earlier point of it, with no work of its own yet
    const stackedOn = fact.contains.filter((other) => {
      const base = byBranch.get(other);
      return base !== undefined && base.ahead > 0 && base.pr !== undefined;
    });
    const insideOf = facts.branches.filter((o) => o.contains.includes(fact.branch)).map((o) => o.branch);
    const stream = streamOf.get(fact.branch) ?? '?';
    const collidesWith = overlaps
      .filter((o) => (o.a === stream || o.b === stream) && o.hand.length > 0)
      .map((o) => (o.a === stream ? o.b : o.a));
    const entry: Entry = {
      stream,
      branch: fact.branch,
      state: stateOf(fact, stackedOn, !fact.pr && insideOf.length > 0),
      pr: fact.pr,
      ahead: fact.ahead,
      behind: fact.behind,
      stackedOn,
      conflicts: fact.conflicts,
      collidesWith,
      actions: [],
    };
    entry.actions = actionsFor(entry, fact, insideOf);
    return entry;
  });

  // a base that other branches are built on goes before them: it frees their pull requests
  const dependents = (e: Entry) => entries.filter((o) => o.stackedOn.includes(e.branch)).length;
  const order = entries
    .filter((e) => e.state === 'ready')
    .sort((a, b) => {
      const cross = Number(crossCutting.has(b.stream)) - Number(crossCutting.has(a.stream));
      if (cross !== 0) return cross;
      if (dependents(a) !== dependents(b)) return dependents(b) - dependents(a);
      // the stream that collides with fewer others goes first: it asks nothing of them
      if (a.collidesWith.length !== b.collidesWith.length) return a.collidesWith.length - b.collidesWith.length;
      return (a.pr?.number ?? 0) - (b.pr?.number ?? 0);
    });

  return { develop: facts.develop, order, entries, overlaps, strays: facts.strays, streams: facts.streams };
}

/** Collisions between branches, folded into one line per pair of streams (a stack would otherwise repeat itself). */
function overlapsOf(collisions: readonly Collision[], streamOf: ReadonlyMap<string, string>): Overlap[] {
  const pairs = new Map<string, Overlap>();
  for (const c of collisions) {
    const [a, b] = [streamOf.get(c.a) ?? '?', streamOf.get(c.b) ?? '?'].sort() as [string, string];
    if (a === b) continue;
    const key = `${a}|${b}`;
    const overlap = pairs.get(key) ?? { a, b, hand: [], generated: [], append: [] };
    for (const file of c.files) {
      const list = { hand: overlap.hand, generated: overlap.generated, append: overlap.append }[classify(file)];
      if (!list.includes(file)) list.push(file);
    }
    pairs.set(key, overlap);
  }
  return [...pairs.values()]
    .filter((o) => o.hand.length > 0 || o.generated.length > 0)
    .map((o) => ({ ...o, hand: o.hand.sort(), generated: o.generated.sort(), append: o.append.sort() }));
}

function stateOf(fact: BranchFact, stackedOn: readonly string[], inside: boolean): State {
  if (!fact.exists) return 'missing';
  if (fact.ahead === 0) return 'empty';
  if (inside) return 'inside';
  if (stackedOn.length > 0) return 'waiting-on-base';
  if (!fact.pr) return 'no-pr';
  if (fact.pr.draft) return 'draft';
  if (fact.pr.ci === 'fail') return 'ci-failing';
  if (fact.pr.ci === 'pending' || fact.pr.ci === 'none') return 'ci-pending';
  return 'ready';
}

function actionsFor(entry: Entry, fact: BranchFact, insideOf: readonly string[]): string[] {
  const out: string[] = [];
  if (entry.state === 'missing') {
    return [`no branch named ${entry.branch} exists: push it, or take it out of docs/team/streams.json`];
  }
  if (entry.state === 'empty') return ['nothing ahead of develop: merged already, or not started'];
  if (entry.state === 'inside') {
    return [`no commits of its own: it sits inside ${insideOf.join(', ')}, which is further along; carry on in that branch, or start here after it lands`];
  }
  if (fact.unpushed > 0) {
    out.push(`${fact.unpushed} commit(s) exist only on this machine: push ${entry.branch} so CI and the lead can see them`);
  }
  if (entry.state === 'waiting-on-base') {
    out.push(
      `built on ${entry.stackedOn.join(', ')}: its pull request lands after that one; then merge origin/develop here (the squashed base brings identical changes, which merge clean; no force push)`,
    );
  } else if (entry.state === 'no-pr') {
    out.push('no pull request yet: open one into develop when it is ready');
  } else if (entry.state === 'draft') {
    out.push('draft: not in the order until it is marked ready for review');
  } else if (entry.state === 'ci-failing') {
    out.push('CI is failing: fix it before it takes a place in the order');
  } else if (entry.state === 'ci-pending') {
    out.push('CI has not finished: wait for it');
  }
  const kinds = entry.conflicts.map((f) => [f, classify(f)] as const);
  const hand = kinds.filter(([, k]) => k === 'hand').map(([f]) => f);
  const generated = kinds.filter(([, k]) => k === 'generated').map(([f]) => f);
  if (hand.length > 0 || generated.length > 0) {
    let text = `conflicts with develop today: merge origin/develop into ${entry.branch} (${fact.behind} behind)`;
    if (hand.length > 0) text += `; resolve by hand: ${hand.join(', ')}`;
    if (generated.length > 0) {
      text += `; for the generated files take develop's (git checkout --theirs) and rerun ${regenerate(generated).join(' && ')}, then git add`;
    }
    out.push(text);
  } else if (fact.behind > 0) {
    out.push(`${fact.behind} behind develop, no conflict: merge origin/develop before the pull request lands`);
  }
  return out;
}

export function render(report: Report): string {
  const lines: string[] = [];
  const push = (line = '') => lines.push(line);
  push(`Streams against develop ${report.develop}`);
  push();
  push('Proposed merge order (a proposal: the owner presses merge)');
  if (report.order.length === 0) push('  nothing is ready to land');
  report.order.forEach((e, i) => {
    const hard = e.conflicts.some((f) => classify(f) !== 'append');
    const note = hard ? ' - update first' : e.collidesWith.length > 0 ? ` - collides with ${e.collidesWith.join(', ')}` : '';
    push(`  ${i + 1}. #${e.pr?.number} ${e.branch} (${e.stream})${note}`);
  });
  push();
  push('Where streams collide (hand = a person settles it; generated = rerun the command)');
  if (report.overlaps.length === 0) push('  nowhere');
  for (const o of report.overlaps) {
    push(`  ${o.a} x ${o.b}`);
    if (o.hand.length > 0) push(`    hand: ${o.hand.join(', ')}`);
    if (o.generated.length > 0) push(`    generated: ${o.generated.join(', ')}`);
  }
  push();
  push('Streams');
  for (const stream of report.streams) {
    const owner = stream.owner ?? 'owner not named';
    push(`  ${stream.id} - ${stream.title} [${owner}]${stream.parked ? ' - parked' : ''}`);
    push(`    plan: ${stream.plan.join(', ')}`);
    for (const e of report.entries.filter((x) => x.stream === stream.id)) {
      const pr = e.pr ? `#${e.pr.number} ci ${e.pr.ci}${e.pr.draft ? ' draft' : ''}` : 'no PR';
      push(`    ${e.branch}  ${pr}  ahead ${e.ahead} behind ${e.behind}  ${e.state}`);
      for (const action of e.actions) push(`      -> ${action}`);
    }
  }
  if (report.strays.length > 0) {
    push();
    push('Open pull requests that no stream lists (add them to docs/team/streams.json or close them)');
    for (const s of report.strays) push(`  #${s.number} ${s.branch}${s.draft ? ' (draft)' : ''} - ${s.title}`);
  }
  push();
  push('Not visible here: uncommitted work in a worktree, and anything in the three sessions of the other app until it is pushed.');
  return lines.join('\n');
}
