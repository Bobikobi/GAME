// `check`: the content check CI runs, on the whole checkout or on the given files only.
import { runCheck } from '@game/tools';
import { setContentTag, meta } from '../meta';
import type { ToolInput, ToolOutput } from '../tools';
import type { Answer, Context } from './context';

export function check(ctx: Context, input: ToolInput<'check'>): Answer<ToolOutput<'check'>> {
  const result = runCheck();
  setContentTag(result.assembled.bundle?.tag);
  const only = input.paths?.map((p) => p.replace(/^\.\//, ''));
  const issues = (only ? result.issues.filter((i) => only.includes(i.file)) : result.issues).map((i) => ({ file: i.file, where: i.where, message: i.message, level: i.level }));
  return {
    result: { meta: meta(ctx.root), ok: !issues.some((i) => i.level === 'error'), files: only ? only.length : result.files, issues },
    note: `${issues.filter((i) => i.level === 'error').length} errors, ${issues.filter((i) => i.level === 'warning').length} warnings`,
  };
}
