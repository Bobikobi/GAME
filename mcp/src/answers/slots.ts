// `slots`: the ruins map, every slot filled or waiting.
import { meta } from '../meta';
import type { ToolInput, ToolOutput } from '../tools';
import type { Answer, Context } from './context';
import { hubData } from './hub';

export async function slots(ctx: Context, input: ToolInput<'slots'>): Promise<Answer<ToolOutput<'slots'>>> {
  const { doc, from } = await hubData(ctx.root);
  const list = doc.slots.filter((s) => (input.kind === undefined || s.kind === input.kind) && (input.free === undefined || (s.filled_by === null) === input.free));
  return { result: { meta: meta(ctx.root), slots: list }, note: `${list.length} slots, from ${from}` };
}
