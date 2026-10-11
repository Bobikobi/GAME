// `schema`: the JSON schema of one content type as schema/json/ publishes it, or the list of types.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CORE_ONLY_TYPES, CREATOR_TYPES } from '@game/schema';
import { DOCUMENT_SCHEMAS } from '@game/schema/hub';
import { meta } from '../meta';
import type { ToolInput, ToolOutput } from '../tools';
import type { Answer, Context } from './context';

/** The site that publishes schema/json/ under /api/schema/. */
export const SITE = 'https://theopenfold.vercel.app';

export function schema(ctx: Context, input: ToolInput<'schema'>): Answer<ToolOutput<'schema'>> {
  const types = [...CREATOR_TYPES, ...CORE_ONLY_TYPES, ...Object.keys(DOCUMENT_SCHEMAS)];
  if (!input.type) return { result: { meta: meta(ctx.root), types } };
  const file = `${input.type}.schema.json`;
  return {
    result: {
      meta: meta(ctx.root),
      types,
      schema: JSON.parse(readFileSync(join(ctx.root, 'schema', 'json', file), 'utf8')) as unknown,
      url: `${SITE}/api/schema/${file}`,
    },
  };
}
