import { Value } from '@sinclair/typebox/value';
import type { TSchema } from '@sinclair/typebox';
import { SCHEMAS } from './index';

export interface SchemaIssue {
  /** JSON pointer inside the file, for example /node/yield */
  path: string;
  message: string;
}

// read at call time: index.ts and this file import each other
const typeNames = () => Object.keys(SCHEMAS).filter((k) => k !== 'extension');

/**
 * Validate one parsed extension file. The file's own `type` picks the schema,
 * so a creator gets "node.yield: must be at most 20" instead of the
 * unreadable "no union member matched".
 */
export function validateFile(data: unknown): SchemaIssue[] {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return [{ path: '', message: 'the file must hold one JSON object' }];
  }
  const type = (data as { type?: unknown }).type;
  if (typeof type !== 'string' || !typeNames().includes(type)) {
    return [{ path: '/type', message: `"type" must be one of: ${typeNames().join(', ')}` }];
  }
  const schema = (SCHEMAS as Record<string, TSchema>)[type] as TSchema;
  const issues: SchemaIssue[] = [];
  const seen = new Set<string>();
  for (const error of Value.Errors(schema, data)) {
    const key = `${error.path}|${error.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    issues.push({ path: error.path, message: describe(error.message, error.schema, error.value) });
    if (issues.length >= 20) break;
  }
  return issues;
}

function describe(message: string, schema: TSchema, value: unknown): string {
  const got = value === undefined ? 'nothing' : JSON.stringify(value)?.slice(0, 60);
  if (typeof schema.pattern === 'string' && typeof value === 'string') {
    return `${message} - got ${got}. ${schema.description ?? ''}`.trim();
  }
  return `${message} (got ${got})`;
}
