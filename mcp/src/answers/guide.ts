// `guide`: docs/creators/README.md, with its sections as the site links them (/docs/#anchor).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { meta } from '../meta';
import type { ToolOutput } from '../tools';
import type { Answer, Context } from './context';

/** The anchor Astro gives a heading: lowercase, punctuation dropped, spaces to hyphens, a repeat numbered. */
export function slug(title: string, seen: Map<string, number>): string {
  const base = title
    .toLowerCase()
    .replace(/`/g, '')
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s/g, '-');
  const n = seen.get(base) ?? 0;
  seen.set(base, n + 1);
  return n === 0 ? base : `${base}-${n}`;
}

export function guide(ctx: Context): Answer<ToolOutput<'guide'>> {
  const markdown = readFileSync(join(ctx.root, 'docs', 'creators', 'README.md'), 'utf8');
  const seen = new Map<string, number>();
  const sections: ToolOutput<'guide'>['sections'] = [];
  let fence = false;
  for (const line of markdown.split('\n')) {
    if (/^\s*```/.test(line)) fence = !fence;
    const h = !fence && line.match(/^(#{1,6}) (.+?)\s*#*\s*$/);
    if (!h) continue;
    const anchor = slug(h[2]!, seen);
    if (h[1] === '##') sections.push({ title: h[2]!, anchor });
  }
  return { result: { meta: meta(ctx.root), markdown, sections }, note: `${sections.length} sections; the same guide is at https://theopenfold.vercel.app/docs/` };
}
