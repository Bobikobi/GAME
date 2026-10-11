/**
 * `value`: what the kernel computes for draft records. The checkout's content is copied to a temporary folder, the
 * drafts are written into the copy, the check runs there, and the folder is removed; the checkout is never written.
 */
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, posix, relative } from 'node:path';
import { runCheck } from '@game/tools';
import { meta } from '../meta';
import type { ToolInput, ToolOutput } from '../tools';
import type { Answer, Context } from './context';

/** A draft goes under content/ and nowhere else; a path that climbs out is refused. */
function contentPath(path: string): string | undefined {
  const clean = posix.normalize(path.replace(/^\.\//, ''));
  return clean.startsWith('content/') && !clean.split('/').includes('..') ? clean : undefined;
}

/** Every item id a draft names, at any depth. */
function named(data: unknown, items: Record<string, unknown>, out: Set<string>): void {
  if (typeof data === 'string') {
    if (Object.hasOwn(items, data)) out.add(data);
  } else if (Array.isArray(data)) data.forEach((d) => named(d, items, out));
  else if (typeof data === 'object' && data !== null) Object.values(data).forEach((d) => named(d, items, out));
}

export function value(ctx: Context, input: ToolInput<'value'>): Answer<ToolOutput<'value'>> {
  const issues: ToolOutput<'value'>['issues'] = [];
  const drafts = input.drafts.flatMap((d) => {
    const path = contentPath(d.path);
    if (!path) issues.push({ file: d.path.slice(0, 240).replace(/[^A-Za-z0-9_./-]/g, '_') || 'content', where: '', message: 'a draft lives under content/', level: 'error' });
    return path ? [{ path, data: d.data }] : [];
  });
  const tmp = mkdtempSync(join(tmpdir(), 'openfold-value-'));
  try {
    // links are followed into plain copies, so a draft can never be written through one; the generated files are not content
    cpSync(join(ctx.root, 'content'), join(tmp, 'content'), { recursive: true, dereference: true });
    for (const generated of ['values.lock.json', 'board.json']) rmSync(join(tmp, 'content', generated), { force: true });
    for (const d of drafts) {
      mkdirSync(dirname(join(tmp, d.path)), { recursive: true });
      writeFileSync(join(tmp, d.path), `${JSON.stringify(d.data, null, 2)}\n`);
    }
    const result = runCheck(join(tmp, 'content'));
    // the check names files relative to the repository; in the copy they sit under the temporary folder
    const prefix = `${relative(ctx.root, tmp).split('\\').join('/')}/`;
    const draftPaths = new Set(drafts.map((d) => d.path));
    for (const i of result.issues) {
      const file = i.file.startsWith(prefix) ? i.file.slice(prefix.length) : i.file;
      if (draftPaths.has(file) || i.level === 'error') issues.push({ file, where: i.where, message: i.message, level: i.level });
    }
    const values: ToolOutput<'value'>['values'] = {};
    const b = result.assembled.bundle;
    if (b) {
      const lock = (JSON.parse(readFileSync(join(ctx.root, 'content', 'values.lock.json'), 'utf8')) as { values: Record<string, number> }).values;
      const ids = new Set<string>();
      drafts.forEach((d) => named(d.data, b.values, ids));
      for (const id of [...ids].sort()) {
        const v = b.values[id]!;
        const anchor = lock[id] ?? null;
        const drift = anchor ? Math.round((Math.abs(v - anchor) * 1000) / anchor) : null;
        values[id] = { value: v, anchor, drift_permille: drift, within_budget: drift === null || drift <= b.params.drift_budget_permille };
      }
    }
    const errors = issues.filter((i) => i.level === 'error').length;
    return { result: { meta: meta(ctx.root), issues, values }, note: `${Object.keys(values).length} values, ${errors} errors` };
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}
