/**
 * The guard scan, built on the TypeScript compiler API.
 *
 * A guard is something that fails when a rule breaks: a test (test and it, their .each and .concurrent
 * forms, inside describe chains), a check site (an object literal with a message and a level, or a call
 * of a local issue helper such as the err arrows of tools/src), a constrained property of schema/src, or a
 * throw of an e2e file. The scan finds each one with the citations that reach it by placement:
 *
 *   - the title of a test, or the message of a check site
 *   - a comment right above the test, the describe, the site or the statement that holds it
 *   - a heading comment: it reaches the statements under it, up to the first blank line
 *   - the comment above the enclosing function (its JSDoc)
 *
 * There is no file-wide citation. A file or a function opts out with '// decisions: none - <why>'.
 *
 * Whether CI really runs a guard is decided by three things (ciLiveFiles): the include globs of the vitest
 * configs, the files the root e2e script runs, and the static relative-import closure of tools/src/check.ts.
 * It is never decided by whether some test imports a function.
 */
import ts from 'typescript';
import { citationsIn, type Citation } from './ids';
import type { Io } from './model';

export type GuardKind = 'test' | 'check' | 'schema' | 'e2e';

export interface Guard {
  kind: GuardKind;
  file: string;
  /** the ledger key: '<path> > <describe> > <title>' for a test, '<path> :: <function> :: <message>' for the rest */
  key: string;
  /** what a message shows: the test's title chain, or the first words of the message */
  title: string;
  /** 1-based line */
  line: number;
  /** CI runs the file this guard sits in */
  live: boolean;
  /** a skipped, todo or condition-bound test: it holds nothing */
  skipped: boolean;
  /** the citations that reach the guard */
  citations: Citation[];
  /** the reason of a '// decisions: none - <why>' that covers it, or null */
  optOut: string | null;
}

export interface CiLive {
  /** the files the vitest include globs match */
  tests: Set<string>;
  /** the files the root e2e script runs, with their relative imports */
  e2e: Set<string>;
  /** the static relative-import closure of tools/src/check.ts */
  check: Set<string>;
  /** the first two and the last together */
  all: Set<string>;
}

export const CHECK_ENTRY = 'tools/src/check.ts';
export const VITEST_CONFIGS = ['vitest.config.ts', 'web/vitest.config.ts'] as const;
const OPT_OUT = /decisions: none - (.*)$/m;

function globToRegex(glob: string): RegExp {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i]!;
    if (c === '*' && glob[i + 1] === '*') {
      re += glob[i + 2] === '/' ? '(?:.*/)?' : '.*';
      i += glob[i + 2] === '/' ? 2 : 1;
    } else if (c === '*') re += '[^/]*';
    else if (c === '?') re += '[^/]';
    else re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`);
}

function includeGlobs(source: string): string[] {
  const file = ts.createSourceFile('vitest.config.ts', source, ts.ScriptTarget.Latest, false, ts.ScriptKind.TS);
  const out: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isPropertyAssignment(node) && ts.isIdentifier(node.name) && node.name.text === 'include' && ts.isArrayLiteralExpression(node.initializer)) {
      for (const el of node.initializer.elements) if (ts.isStringLiteralLike(el)) out.push(el.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return out;
}

const EXTENSIONS = ['.ts', '.tsx', '/index.ts', '/index.tsx'];

/** Resolves a relative import of `from` to a repo file, or null. */
function resolveImport(from: string, spec: string, has: (p: string) => boolean): string | null {
  const parts = from.split('/').slice(0, -1);
  for (const seg of spec.split('/')) {
    if (seg === '.' || seg === '') continue;
    if (seg === '..') parts.pop();
    else parts.push(seg);
  }
  const base = parts.join('/').replace(/\.(js|jsx)$/, '');
  for (const ext of ['', ...EXTENSIONS]) if (has(`${base}${ext}`) && /\.tsx?$/.test(`${base}${ext}`)) return `${base}${ext}`;
  return null;
}

/** The files reached from `entries` by static relative imports. */
export function importClosure(io: Io, entries: readonly string[], has: (p: string) => boolean): Set<string> {
  const seen = new Set<string>();
  const queue = [...entries];
  while (queue.length) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    const text = io.read(file);
    if (text === null) continue;
    seen.add(file);
    for (const imp of ts.preProcessFile(text, true, true).importedFiles) {
      if (!imp.fileName.startsWith('.')) continue;
      const r = resolveImport(file, imp.fileName, has);
      if (r && !seen.has(r)) queue.push(r);
    }
  }
  return seen;
}

/** Which repo files CI runs: the vitest globs, the e2e script and the closure of check.ts. */
export function ciLiveFiles(io: Io): CiLive {
  const all = new Set(io.list(''));
  const has = (p: string): boolean => all.has(p);
  const tests = new Set<string>();
  for (const config of VITEST_CONFIGS) {
    const src = io.read(config);
    if (src === null) continue;
    const dir = config.includes('/') ? config.slice(0, config.lastIndexOf('/') + 1) : '';
    for (const glob of includeGlobs(src)) {
      const re = globToRegex(`${dir}${glob}`);
      for (const f of all) if (re.test(f)) tests.add(f);
    }
  }
  const e2eRoots: string[] = [];
  const pkg = io.read('package.json');
  if (pkg !== null) {
    try {
      const script = (JSON.parse(pkg) as { scripts?: Record<string, string> }).scripts?.e2e ?? '';
      const m = /for t in ([a-z0-9 _-]+); do tsx (\S*?)\$t\.ts/.exec(script);
      if (m) for (const name of m[1]!.trim().split(/\s+/)) e2eRoots.push(`${m[2]}${name}.ts`);
    } catch {
      // an unreadable package.json is the loader's problem
    }
  }
  const e2e = importClosure(io, e2eRoots.filter(has), has);
  const check = importClosure(io, has(CHECK_ENTRY) ? [CHECK_ENTRY] : [], has);
  return { tests, e2e, check, all: new Set([...tests, ...e2e, ...check]) };
}

const TEST_ROOTS = new Set(['test', 'it']);
const SKIP_MODS = new Set(['skip', 'todo']);
const COND_MODS = new Set(['skipIf', 'runIf']);

interface Callee {
  root: string;
  mods: string[];
  /** the argument of skipIf / runIf */
  condition: string | null;
}

/** 'test', 'test.skip', 'it.each(table)', 'describe.concurrent.skip' -> the root name and its modifiers. */
function calleeOf(expr: ts.Expression, sf: ts.SourceFile): Callee | null {
  const mods: string[] = [];
  let condition: string | null = null;
  let cur: ts.Expression = expr;
  for (;;) {
    if (ts.isCallExpression(cur)) {
      const f = cur.expression;
      if (ts.isPropertyAccessExpression(f) && COND_MODS.has(f.name.text)) condition = cur.arguments[0]?.getText(sf) ?? '';
      cur = f;
    } else if (ts.isPropertyAccessExpression(cur)) {
      mods.push(cur.name.text);
      cur = cur.expression;
    } else break;
  }
  return ts.isIdentifier(cur) && (cur.text === 'describe' || TEST_ROOTS.has(cur.text)) ? { root: cur.text, mods, condition } : null;
}

function literalText(node: ts.Node | undefined, sf: ts.SourceFile): string {
  if (!node) return '';
  if (ts.isStringLiteralLike(node)) return node.getText(sf).slice(1, -1);
  if (ts.isTemplateExpression(node)) return node.getText(sf).slice(1, -1);
  if (ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  return node.getText(sf);
}

/** The first 60 characters of a message's source, with each ${...} written ${}. */
function messageKey(src: string): string {
  return src.replace(/\$\{[^}]*\}/g, '${}').replace(/\s+/g, ' ').trim().slice(0, 60);
}

const GUARD_KINDS: readonly Citation['kind'][] = ['dec', 'g', 's', 'title', 'decision-of'];

function citesIn(text: string): Citation[] {
  return citationsIn(text, GUARD_KINDS);
}

function leadingComments(text: string, node: ts.Node, sf: ts.SourceFile): string[] {
  const ranges = ts.getLeadingCommentRanges(text, node.getFullStart()) ?? [];
  void sf;
  return ranges.map((r) => text.slice(r.pos, r.end));
}

interface Ctx {
  describes: string[];
  fns: string[];
  cites: Citation[];
  optOut: string | null;
  skipped: boolean;
}

function optOutOf(comments: readonly string[]): string | null {
  for (const c of comments) {
    const m = OPT_OUT.exec(c);
    if (m) return m[1]!.replace(/\*\/\s*$/, '').trim();
  }
  return null;
}

/** An object literal's property by name. */
function prop(obj: ts.ObjectLiteralExpression, name: string): ts.ObjectLiteralElementLike | undefined {
  return obj.properties.find((p) => p.name !== undefined && ts.isIdentifier(p.name) && p.name.text === name);
}

function propValue(p: ts.ObjectLiteralElementLike | undefined): ts.Expression | undefined {
  if (!p) return undefined;
  if (ts.isPropertyAssignment(p)) return p.initializer;
  if (ts.isShorthandPropertyAssignment(p)) return p.name;
  return undefined;
}

/** A function whose body builds an Issue literal from one of its own parameters: an issue helper such as err. */
function issueHelpers(sf: ts.SourceFile): Map<string, number> {
  const out = new Map<string, number>();
  const visit = (node: ts.Node): void => {
    let name: string | null = null;
    let fn: ts.FunctionLikeDeclaration | null = null;
    if (ts.isFunctionDeclaration(node) && node.name && node.body) {
      name = node.name.text;
      fn = node;
    } else if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))) {
      name = node.name.text;
      fn = node.initializer;
    }
    if (name && fn) {
      const params = fn.parameters.map((p) => (ts.isIdentifier(p.name) ? p.name.text : ''));
      const find = (n: ts.Node): void => {
        if (ts.isObjectLiteralExpression(n)) {
          const m = prop(n, 'message');
          if (m && prop(n, 'level')) {
            const text = propValue(m)?.getText(sf) ?? '';
            const idx = params.findIndex((p) => p !== '' && new RegExp(`\\b${p}\\b`).test(text));
            if (idx >= 0 && !out.has(name!)) out.set(name!, idx);
          }
        }
        ts.forEachChild(n, find);
      };
      find(fn.body!);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

const SCHEMA_KEYS = new Set(['maxItems', 'minItems', 'maxLength', 'minLength', 'minimum', 'maximum', 'pattern', 'enum', 'const', 'multipleOf', 'maxProperties', 'minProperties']);

/** Scans one TypeScript file. `live` says CI runs it; `kind` picks what to look for besides tests and check sites. */
export function scanSource(file: string, text: string, opts: { live: boolean; e2e: boolean; schema: boolean; ciText?: string }): Guard[] {
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, false, ts.ScriptKind.TS);
  const guards: Guard[] = [];
  const helpers = issueHelpers(sf);
  const seen = new Map<string, number>();
  const add = (g: Omit<Guard, 'file' | 'live'>): void => {
    const n = (seen.get(g.key) ?? 0) + 1;
    seen.set(g.key, n);
    guards.push({ ...g, file, live: opts.live || (g.kind === 'e2e' && opts.e2e), key: n > 1 ? `${g.key} #${n}` : g.key });
  };
  const lineOf = (node: ts.Node): number => ts.getLineAndCharacterOfPosition(sf, node.getStart(sf)).line + 1;
  const firstStatement = sf.statements[0];
  const fileOptOut = firstStatement ? optOutOf(leadingComments(text, firstStatement, sf)) : null;

  const base: Ctx = { describes: [], fns: [], cites: [], optOut: fileOptOut, skipped: false };

  const visitStatements = (stmts: readonly ts.Statement[], ctx: Ctx): void => {
    let group: Citation[] = [];
    let groupOpt: string | null = null;
    let prevEnd = -1;
    for (const st of stmts) {
      const gap = prevEnd >= 0 && /\n[ \t]*\r?\n/.test(text.slice(prevEnd, st.getStart(sf)));
      if (gap) {
        group = [];
        groupOpt = null;
      }
      const own = leadingComments(text, st, sf);
      const ownCites = own.flatMap((c) => citesIn(c));
      const ownOpt = optOutOf(own);
      if (ownCites.length || ownOpt) {
        group = ownCites;
        groupOpt = ownOpt;
      }
      visit(st, { ...ctx, cites: [...ctx.cites, ...group], optOut: ctx.optOut ?? groupOpt });
      prevEnd = st.end;
    }
  };

  const visit = (node: ts.Node, ctx: Ctx): void => {
    // a function name joins the chain; a describe or a test is read by the call below
    if (ts.isFunctionDeclaration(node) && node.name) ctx = { ...ctx, fns: [...ctx.fns, node.name.text] };
    else if (ts.isMethodDeclaration(node) && ts.isIdentifier(node.name)) ctx = { ...ctx, fns: [...ctx.fns, node.name.text] };
    else if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))) {
      ctx = { ...ctx, fns: [...ctx.fns, node.name.text] };
    }

    if (ts.isCallExpression(node)) {
      const callee = calleeOf(node.expression, sf);
      if (callee) {
        const titleArg = node.arguments[0];
        const title = literalText(titleArg, sf);
        const cb = node.arguments.find((a): a is ts.ArrowFunction | ts.FunctionExpression => ts.isArrowFunction(a) || ts.isFunctionExpression(a));
        const conditional = callee.condition !== null;
        const skipped = callee.mods.some((m) => SKIP_MODS.has(m)) || (conditional && !conditionLive(callee.condition!, opts.ciText));
        const titleCites = citesIn(title);
        if (callee.root === 'describe') {
          const inner: Ctx = { ...ctx, describes: [...ctx.describes, title], cites: [...ctx.cites, ...titleCites], skipped: ctx.skipped || skipped };
          if (cb) {
            if (ts.isBlock(cb.body)) visitStatements(cb.body.statements, inner);
            else visit(cb.body, inner);
          }
          return;
        }
        const chain = [...ctx.describes, title];
        add({
          kind: 'test',
          key: `${file} > ${chain.join(' > ')}`,
          title: chain.join(' > '),
          line: lineOf(node),
          skipped: ctx.skipped || skipped,
          citations: [...ctx.cites, ...titleCites],
          optOut: ctx.optOut,
        });
        // a test body holds no further tests, but a helper inside it may build an issue: nothing more to read
        return;
      }
      const f = node.expression;
      if (ts.isIdentifier(f) && helpers.has(f.text)) {
        const arg = node.arguments[helpers.get(f.text)!];
        const src = literalText(arg, sf);
        if (arg) {
          add({
            kind: 'check',
            key: `${file} :: ${ctx.fns[ctx.fns.length - 1] ?? '<module>'} :: ${messageKey(src)}`,
            title: messageKey(src),
            line: lineOf(node),
            skipped: false,
            citations: [...ctx.cites, ...citesIn(src)],
            optOut: ctx.optOut,
          });
        }
      }
      if (opts.e2e && ts.isIdentifier(f) && /^(assert\w*|fail\w*|expect\w*)$/.test(f.text)) {
        const src = node.getText(sf);
        add({ kind: 'e2e', key: `${file} :: ${ctx.fns[ctx.fns.length - 1] ?? '<module>'} :: ${messageKey(src)}`, title: messageKey(src), line: lineOf(node), skipped: false, citations: ctx.cites, optOut: ctx.optOut });
      }
    }
    if (opts.e2e && ts.isThrowStatement(node)) {
      const src = node.getText(sf);
      add({ kind: 'e2e', key: `${file} :: ${ctx.fns[ctx.fns.length - 1] ?? '<module>'} :: ${messageKey(src)}`, title: messageKey(src), line: lineOf(node), skipped: false, citations: ctx.cites, optOut: ctx.optOut });
    }
    if (ts.isObjectLiteralExpression(node)) {
      const m = prop(node, 'message');
      if (m && prop(node, 'level')) {
        const value = propValue(m);
        const src = literalText(value, sf);
        // the literal inside an issue helper is the helper's own, not a site
        const inHelper = ctx.fns.some((n) => helpers.has(n));
        const isParam = inHelper && value !== undefined && /^`?\$\{\w+\}/.test(`${value.getText(sf)}`.replace(/^`/, '`')) ;
        if (!isParam && !(inHelper && value && !ts.isStringLiteralLike(value) && !ts.isTemplateExpression(value) && !ts.isNoSubstitutionTemplateLiteral(value))) {
          add({
            kind: 'check',
            key: `${file} :: ${ctx.fns[ctx.fns.length - 1] ?? '<module>'} :: ${messageKey(src)}`,
            title: messageKey(src),
            line: lineOf(node),
            skipped: false,
            citations: [...ctx.cites, ...citesIn(src)],
            optOut: ctx.optOut,
          });
        }
      }
    }
    if (opts.schema && ts.isPropertyAssignment(node) && ts.isObjectLiteralExpression(node.initializer) && node.initializer.properties.some((p) => p.name !== undefined && ts.isIdentifier(p.name) && SCHEMA_KEYS.has(p.name.text))) {
      const name = node.name.getText(sf);
      const own = leadingComments(text, node, sf).flatMap((c) => citesIn(c));
      const limits = node.initializer.properties.filter((p) => p.name !== undefined && ts.isIdentifier(p.name) && SCHEMA_KEYS.has(p.name.text)).map((p) => p.getText(sf)).join(', ');
      add({ kind: 'schema', key: `${file} :: ${name} :: ${messageKey(limits)}`, title: `${name} (${messageKey(limits)})`, line: lineOf(node), skipped: false, citations: [...ctx.cites, ...own], optOut: ctx.optOut });
    }
    // statements get their heading-comment groups; everything else is walked
    if (ts.isBlock(node) || ts.isModuleBlock(node)) {
      visitStatements(node.statements, ctx);
      return;
    }
    if (ts.isCaseClause(node) || ts.isDefaultClause(node)) {
      visitStatements(node.statements, ctx);
      return;
    }
    ts.forEachChild(node, (c) => visit(c, ctx));
  };

  visitStatements(sf.statements, base);
  return guards;
}

/** A skipIf / runIf test is live when ci.yml names an environment variable its condition reads. */
function conditionLive(condition: string, ciText: string | undefined): boolean {
  if (ciText === undefined) return false;
  const names = condition.match(/\b[A-Z][A-Z0-9_]{2,}\b/g) ?? [];
  return names.some((n) => ciText.includes(n));
}

/** Every guard of the repository's TypeScript. Files CI runs, e2e files, schema/src and files that cite a decision are read. */
export function scanGuards(io: Io): Guard[] {
  const live = ciLiveFiles(io);
  const ci = io.read('.github/workflows/ci.yml') ?? undefined;
  const out: Guard[] = [];
  for (const file of io.list('')) {
    if (!/\.tsx?$/.test(file) || file.includes('node_modules/') || file.endsWith('.d.ts')) continue;
    const isLive = live.all.has(file);
    const schema = file.startsWith('schema/src/');
    if (!isLive && !schema) continue;
    const text = io.read(file);
    if (text === null) continue;
    out.push(...scanSource(file, text, { live: isLive, e2e: live.e2e.has(file), schema, ciText: ci }));
  }
  return out;
}

/** Files outside the live set whose text carries a dec: citation, for the message that says CI does not run them. */
export function citingFiles(io: Io, liveFiles: ReadonlySet<string>): Map<string, Citation[]> {
  const out = new Map<string, Citation[]>();
  for (const file of io.list('')) {
    if (!/\.tsx?$/.test(file) || liveFiles.has(file) || file.includes('node_modules/')) continue;
    const text = io.read(file);
    if (text === null || !text.includes('dec:')) continue;
    const found = citationsIn(text, ['dec']);
    if (found.length) out.set(file, found);
  }
  return out;
}

export interface Binding {
  /** the bind reads a pointer into JSON, an 'exists' pointer, or an exported const */
  kind: 'pointer' | 'exists' | 'const';
  path: string;
  /** the pointer, or the const's name */
  at: string;
  /** the value the rule says; undefined for 'exists' */
  expected?: unknown;
  /** whether the file has the target at all */
  found: boolean;
  /** the value read now */
  actual?: unknown;
  /** the bind is malformed, or the file cannot be read */
  error?: string;
}

function resolvePointer(data: unknown, pointer: string): { found: boolean; value?: unknown } {
  if (pointer === '' || pointer === '/') return { found: pointer === '' || true, value: data };
  let cur: unknown = data;
  for (const raw of pointer.replace(/^\//, '').split('/')) {
    const seg = raw.replace(/~1/g, '/').replace(/~0/g, '~');
    if (Array.isArray(cur)) {
      const i = Number(seg);
      if (!Number.isInteger(i) || i < 0 || i >= cur.length) return { found: false };
      cur = cur[i];
    } else if (cur !== null && typeof cur === 'object' && Object.prototype.hasOwnProperty.call(cur, seg)) {
      cur = (cur as Record<string, unknown>)[seg];
    } else return { found: false };
  }
  return { found: true, value: cur };
}

function exportedConst(source: string, name: string): { found: boolean; value?: unknown } {
  const sf = ts.createSourceFile('const.ts', source, ts.ScriptTarget.Latest, false, ts.ScriptKind.TS);
  for (const st of sf.statements) {
    if (!ts.isVariableStatement(st) || !st.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) continue;
    for (const d of st.declarationList.declarations) {
      if (!ts.isIdentifier(d.name) || d.name.text !== name || !d.initializer) continue;
      let init: ts.Expression = d.initializer;
      while (ts.isAsExpression(init) || ts.isSatisfiesExpression(init) || ts.isParenthesizedExpression(init)) init = init.expression;
      if (ts.isNumericLiteral(init)) return { found: true, value: Number(init.text.replace(/_/g, '')) };
      if (ts.isPrefixUnaryExpression(init) && init.operator === ts.SyntaxKind.MinusToken && ts.isNumericLiteral(init.operand)) return { found: true, value: -Number(init.operand.text.replace(/_/g, '')) };
      if (ts.isStringLiteralLike(init)) return { found: true, value: init.text };
      if (init.kind === ts.SyntaxKind.TrueKeyword) return { found: true, value: true };
      if (init.kind === ts.SyntaxKind.FalseKeyword) return { found: true, value: false };
      return { found: true, value: undefined };
    }
  }
  return { found: false };
}

/**
 * Reads a binds field: '<path>#<RFC 6901 pointer> = <JSON value>', '<path>#<pointer> exists', or
 * '<path>.ts#<EXPORTED_CONST> = <number, string or boolean literal>'.
 */
export function readBinding(io: Io, target: string): Binding {
  const m = /^(\S+?)#(\S+?)(?: = (.+)| exists)$/.exec(target.trim());
  if (!m) return { kind: 'pointer', path: '', at: '', found: false, error: `"${target}" is no bind: write "<path>#<pointer> = <value>", "<path>#<pointer> exists" or "<path>.ts#<CONSTANT> = <value>"` };
  const [, path, at, expectedText] = m as unknown as [string, string, string, string | undefined];
  const exists = expectedText === undefined;
  let expected: unknown;
  if (!exists) {
    try {
      expected = JSON.parse(expectedText);
    } catch {
      return { kind: path.endsWith('.ts') ? 'const' : 'pointer', path, at, found: false, error: `the value "${expectedText}" is not JSON` };
    }
  }
  const text = io.read(path);
  if (text === null) return { kind: exists ? 'exists' : path.endsWith('.ts') ? 'const' : 'pointer', path, at, expected, found: false, error: `${path} does not exist` };
  if (path.endsWith('.ts')) {
    const r = exportedConst(text, at);
    return { kind: 'const', path, at, expected, found: r.found, actual: r.value };
  }
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { kind: exists ? 'exists' : 'pointer', path, at, expected, found: false, error: `${path} is not valid JSON` };
  }
  const r = resolvePointer(data, at);
  return { kind: exists ? 'exists' : 'pointer', path, at, expected, found: r.found, actual: r.value };
}
