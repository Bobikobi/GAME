/**
 * list-shrinks: a registered list only shrinks against the base.
 *
 * A key the base list did not hold fails, even when another key leaves in the same change, so a swap is
 * refused too. A list the base lacks is skipped (that is the change that creates it); a list the base
 * holds that head cannot read (deleted, renamed, or no longer a plain list) fails.
 */
import ts from 'typescript';
import type { Issue } from '../load';

const CHECK = '[list-shrinks]';

export interface Ratchet {
  /** the exported const of a TypeScript file, or a label for a JSON file */
  name: string;
  /** path relative to the repo root */
  file: string;
  /** 'ts-string-array': an exported const array of string literals; 'json-keys': the keys of a JSON object */
  read: 'ts-string-array' | 'json-keys';
  /** what to do instead of growing the list, said in the message */
  instruction: string;
}

/** The registered shrink-only lists. Empty for now: SIXTEEN_PX_LEFT of tools/src/kit/rich.ts joins once that file is on develop. */
export const RATCHETS: readonly Ratchet[] = [];

/** The list's keys, or null when the source does not hold it in the expected shape. */
export function readList(source: string, ratchet: Pick<Ratchet, 'name' | 'read'>): string[] | null {
  if (ratchet.read === 'json-keys') {
    try {
      const data: unknown = JSON.parse(source);
      return data !== null && typeof data === 'object' && !Array.isArray(data) ? Object.keys(data) : null;
    } catch {
      return null;
    }
  }
  const file = ts.createSourceFile('list.ts', source, ts.ScriptTarget.Latest, false, ts.ScriptKind.TS);
  for (const st of file.statements) {
    if (!ts.isVariableStatement(st)) continue;
    if (!st.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) continue;
    if (!(st.declarationList.flags & ts.NodeFlags.Const)) continue;
    for (const d of st.declarationList.declarations) {
      if (!ts.isIdentifier(d.name) || d.name.text !== ratchet.name || !d.initializer) continue;
      let init: ts.Expression = d.initializer;
      while (ts.isAsExpression(init) || ts.isSatisfiesExpression(init) || ts.isParenthesizedExpression(init)) init = init.expression;
      if (!ts.isArrayLiteralExpression(init)) return null;
      const out: string[] = [];
      for (const el of init.elements) {
        if (!ts.isStringLiteral(el) && !ts.isNoSubstitutionTemplateLiteral(el)) return null;
        out.push(el.text);
      }
      return out;
    }
  }
  return null;
}

/** `head` and `base` read a repo file (null when absent); `base` is null when no base could be resolved. */
export function checkRatchets(
  head: (file: string) => string | null,
  base: ((file: string) => string | null) | null,
  ratchets: readonly Ratchet[] = RATCHETS,
): Issue[] {
  if (!base) return [];
  const issues: Issue[] = [];
  for (const r of ratchets) {
    const baseText = base(r.file);
    const before = baseText === null ? null : readList(baseText, r);
    if (before === null) continue;
    const headText = head(r.file);
    const after = headText === null ? null : readList(headText, r);
    const err = (message: string): void => {
      issues.push({ file: r.file, where: r.name, message: `${message} ${CHECK}`, level: 'error' });
    };
    if (after === null) {
      err(`cannot be read at head: it was deleted, renamed or is no longer ${r.read === 'json-keys' ? 'a JSON object' : 'an exported const array of string literals'}; the list only shrinks, so keep it in place`);
      continue;
    }
    const had = new Set(before);
    for (const key of after.filter((k) => !had.has(k))) err(`adds "${key}": the list only shrinks: ${r.instruction}`);
  }
  return issues;
}
