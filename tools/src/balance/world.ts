/** The content as the balance tools read it: the assembled bundle and the raw params file (the bundle keeps only what the kernel reads). */
import type { Bundle } from '@game/kernel';
import type { ParamsBody } from '@game/schema';
import { assemble } from '../assemble';
import { readBoard } from '../board';
import { loadAll, type Issue } from '../load';
import { readRules, type Rules } from './rules';

export interface World {
  bundle: Bundle;
  params: ParamsBody;
  rules: Rules;
}

/** `root` is a content folder (tests point it at a copy); the board is read only for the real one, as runCheck does. */
export function loadWorld(root?: string): World {
  const { files, issues } = loadAll(root);
  const assembled = assemble(files, root ? {} : readBoard());
  const errors: Issue[] = [...issues, ...assembled.issues].filter((i) => i.level === 'error');
  const file = files.find((f) => f.data.type === 'params')?.data;
  const params = file?.type === 'params' ? file.params : undefined;
  if (!assembled.bundle || !params || errors.length > 0) {
    throw new Error(`The content does not assemble: ${errors.slice(0, 3).map((e) => `${e.file} ${e.where}: ${e.message}`).join('; ') || 'no params file'}`);
  }
  const rules = readRules(params);
  if (!rules) throw new Error('content/core/params.json has no difficulty or balance block.');
  return { bundle: assembled.bundle, params, rules };
}
