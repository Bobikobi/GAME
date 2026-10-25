import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, test } from 'vitest';
import ts from 'typescript';

// Decision 39 (owner, 22-23.10): a line a player reads is words; where a number is shown it is a plain
// n/10 scale, never a percentage. The exact values live one long press away.

const root = join(__dirname, '..', '..');

function walk(dir: string, ext: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'generated') continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, ext, out);
    else if (path.endsWith(ext)) out.push(path);
  }
  return out;
}

/** The places a percentage may stay: the file, the name the literal sits under, and why. */
const EXEMPT: { file: string; owner: string; why: string }[] = [
  { file: 'game/src/text.ts', owner: 'exact', why: 'the attribute rows\' real before-to-after values, shown only on a long press' },
  { file: 'game/src/text.ts', owner: 'exactPct', why: 'the luck row\'s chance, read only by its long-press line' },
  { file: 'game/src/text.ts', owner: 'exactBonus', why: 'a bonus as the rules hold it, shown only on a long press' },
];

/** A number followed by "%": a digit, or an interpolation (written as `${}`), then the sign. */
const PERCENT = /(?:\d|\$\{\})\s*%/;

interface Literal {
  text: string;
  line: number;
  /** the nearest name the literal sits under: a property, a variable or a function */
  owner?: string;
  /** a CSS value (a `style` property or a `.style.x =` assignment), which is layout, not text */
  style: boolean;
}

function nameOf(node: ts.Node): string | undefined {
  if ((ts.isPropertyAssignment(node) || ts.isVariableDeclaration(node) || ts.isFunctionDeclaration(node)) && node.name && ts.isIdentifier(node.name)) {
    return node.name.text;
  }
  return undefined;
}

function isStyle(node: ts.Node): boolean {
  for (let n: ts.Node | undefined = node.parent; n; n = n.parent) {
    if (ts.isPropertyAssignment(n)) return nameOf(n) === 'style';
    if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
      return ts.isPropertyAccessExpression(n.left) && ts.isPropertyAccessExpression(n.left.expression) && n.left.expression.name.text === 'style';
    }
    if (ts.isStatement(n)) return false;
  }
  return false;
}

/** Every string literal and the text parts of every template in a source file. */
function literals(file: string, code = readFileSync(file, 'utf8')): Literal[] {
  const source = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true);
  const found: Literal[] = [];
  const visit = (node: ts.Node) => {
    let text: string | undefined;
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) text = node.text;
    // only the written text of a template: the code inside `${}` (a modulo, say) is not on screen
    else if (ts.isTemplateExpression(node)) text = node.head.text + node.templateSpans.map((span) => `\${}${span.literal.text}`).join('');
    if (text !== undefined) {
      let owner: string | undefined;
      for (let n: ts.Node | undefined = node.parent; n && owner === undefined; n = n.parent) owner = nameOf(n);
      found.push({ text, line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1, owner, style: isStyle(node) });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

function offenders(dir: string): string[] {
  const bad: string[] = [];
  for (const file of walk(join(root, dir), '.ts')) {
    const rel = relative(root, file);
    for (const { text, line, owner, style } of literals(file)) {
      if (!PERCENT.test(text) || style) continue;
      if (EXEMPT.some((e) => e.file === rel && e.owner === owner)) continue;
      bad.push(`${rel}:${line} ${text.slice(0, 80)}`);
    }
  }
  return bad;
}

describe('no percentages on screen (decision 39)', () => {
  test('the player-facing text builders hold no "%"', () => {
    expect([...offenders('game/src'), ...offenders('kernel/src')]).toEqual([]);
  });

  test('the scan catches a percentage in a template and lets layout through', () => {
    const probe = [
      'const shown = `${bonus}% faster`;',
      'const said = { text: "Rare finds 10% more likely" };',
      'bar.style.width = `${fill}%`;',
      'h("i", { style: `width:${fill}%` });',
      'const clock = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;',
      "if (tile === '%') skip();",
    ].join('\n');
    const found = literals('probe.ts', probe);
    expect(found.filter((l) => PERCENT.test(l.text) && !l.style).map((l) => l.owner)).toEqual(['shown', 'text']);
  });

  test('content text holds no "%"', () => {
    const bad: string[] = [];
    const scan = (value: unknown, path: string, file: string) => {
      if (typeof value === 'string') {
        if (/\d\s*%/.test(value)) bad.push(`${file} ${path}: ${value.slice(0, 80)}`);
      } else if (Array.isArray(value)) value.forEach((v, i) => scan(v, `${path}[${i}]`, file));
      else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) scan(v, `${path}.${k}`, file);
    };
    for (const file of walk(join(root, 'content'), '.json')) {
      const rel = relative(root, file);
      // the map file holds tile grids, not sentences; values.lock.json and board.json are generated
      if (rel.endsWith('map.json') || rel.endsWith('values.lock.json') || rel.endsWith('board.json')) continue;
      scan(JSON.parse(readFileSync(file, 'utf8')), '', rel);
    }
    expect(bad).toEqual([]);
  });

  test('every exemption still names a literal with a "%", so a stale one is removed', () => {
    for (const e of EXEMPT) {
      const hits = literals(join(root, e.file)).filter((l) => l.owner === e.owner && PERCENT.test(l.text));
      expect(hits.length, `${e.file} ${e.owner}: ${e.why}`).toBeGreaterThan(0);
    }
  });
});
