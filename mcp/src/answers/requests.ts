// `requests`: what players asked for, with support and open calls.
import { meta } from '../meta';
import type { ToolInput, ToolOutput } from '../tools';
import type { Answer, Context } from './context';
import { hubData } from './hub';

export async function requests(ctx: Context, input: ToolInput<'requests'>): Promise<Answer<ToolOutput<'requests'>>> {
  const { doc, from } = await hubData(ctx.root);
  const list = doc.requests
    .filter((r) => (input.open_call === undefined || r.open_call === input.open_call) && (input.kind === undefined || r.kind === input.kind))
    .sort((a, b) => b.support - a.support || a.number - b.number)
    .slice(0, input.limit ?? 20);
  return {
    result: { meta: meta(ctx.root), fetched_at: doc.sources.github?.fetched_at ?? null, requests: list },
    note: `${list.length} requests, from ${from}`,
  };
}
