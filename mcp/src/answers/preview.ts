// `preview`: the state of one open proposal.
import { meta } from '../meta';
import type { ToolInput, ToolOutput } from '../tools';
import type { Answer, Context } from './context';
import { hubData } from './hub';

export async function preview(ctx: Context, input: ToolInput<'preview'>): Promise<Answer<ToolOutput<'preview'>>> {
  const { doc, from } = await hubData(ctx.root);
  const proposal = doc.proposals.find((p) => p.number === input.pr) ?? null;
  return {
    result: { meta: meta(ctx.root), proposal },
    note: proposal ? `proposal #${input.pr}, from ${from}` : `no open proposal #${input.pr} in ${from}`,
  };
}
