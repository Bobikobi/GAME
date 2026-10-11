// One answer per tool of TOOL_LIST, by name.
import type { ToolName } from '../tools';
import { check } from './check';
import type { Answer, Context } from './context';
import { guide } from './guide';
import { preview } from './preview';
import { requests } from './requests';
import { rules } from './rules';
import { schema } from './schema';
import { slots } from './slots';
import { template } from './template';
import { value } from './value';

export type { Answer, Context } from './context';

/** The input has passed the tool's input schema before it gets here. */
export const ANSWERS: Record<ToolName, (ctx: Context, input: never) => Answer<unknown> | Promise<Answer<unknown>>> = {
  schema,
  check,
  slots,
  requests,
  template,
  value,
  preview,
  guide,
  rules,
};
