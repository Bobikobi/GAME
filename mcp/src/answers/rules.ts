// `rules`: the numbers of the loop and the boards, the licence, and the lines the project never crosses.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { meta } from '../meta';
import type { ToolOutput } from '../tools';
import type { Answer, Context } from './context';

/** docs/team/PLATFORM.md, section 4.1: the line never crossed, one sentence each. */
export const LINES = [
  'The MCP writes nothing: it reads the checkout and the published hub-data document.',
  'The MCP holds no token and never talks to GitHub.',
  "The creator's agent writes files into the creator's own folder, content/extensions/<handle>/.",
  'The creator opens the pull request, and the loop on GitHub decides it.',
];

const json = <T>(root: string, path: string): T => JSON.parse(readFileSync(join(root, path), 'utf8')) as T;

export function rules(ctx: Context): Answer<ToolOutput<'rules'>> {
  return {
    result: {
      meta: meta(ctx.root),
      loop: json(ctx.root, '.github/loop.json'),
      points: json(ctx.root, '.github/points.json'),
      licence: json<{ license: string }>(ctx.root, 'package.json').license,
      lines: LINES,
    },
    note: 'the same rules are at https://loomvale.vercel.app/hub/rules/',
  };
}
