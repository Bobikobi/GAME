// `template`: the starting file of one record type from templates/extension/, with the creator's handle and name.
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { meta } from '../meta';
import type { ToolInput, ToolOutput } from '../tools';
import type { Answer, Context } from './context';

const TEMPLATE_HANDLE = 'your-handle';

function jsonFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? jsonFiles(join(dir, e.name)) : e.name.endsWith('.json') ? [join(dir, e.name)] : []));
}

export function template(ctx: Context, input: ToolInput<'template'>): Answer<ToolOutput<'template'>> {
  const base = join(ctx.root, 'templates', 'extension');
  const files: ToolOutput<'template'>['files'] = [];
  for (const abs of jsonFiles(base)) {
    const text = readFileSync(abs, 'utf8');
    const data = JSON.parse(text) as { type?: string; id?: string };
    if (data.type !== input.type || !data.id) continue;
    const id = `${input.handle}/${input.name}`;
    const folder = relative(base, abs).split('/').slice(0, -1).join('/');
    files.push({
      path: `content/extensions/${input.handle}/${folder ? `${folder}/` : ''}${input.name}.json`,
      content: text.split(`"${data.id}"`).join(`"${id}"`).split(TEMPLATE_HANDLE).join(input.handle),
    });
  }
  const next = files.length
    ? 'Write the file, change what it says, then run "pnpm check" (or the check tool) and "pnpm dev" to see it in the game.'
    : `There is no template for "${input.type}" yet; read its schema with the schema tool and the creator guide with the guide tool.`;
  return { result: { meta: meta(ctx.root), files, next }, note: `${files.length} file${files.length === 1 ? '' : 's'}` };
}
