import type { PublicState, State } from './state';
import type { Action } from './step';

export type { PublicState };

/**
 * The wire's merge patch (NEXT 18 a): the server turns one step into a patch of the public state, and the
 * phone turns it back into a state. It lives in the kernel because both ends apply the same rule, and it is
 * pure and depends on nothing but the state's own shape.
 */
export type MergePatch =
  | null
  | boolean
  | number
  | string
  | MergePatch[]
  | { [key: string]: MergePatch };

const DELETE = { $delete: true } as const;

export function publicState(state: State): PublicState {
  const { seed: _secret, ...visible } = state;
  return visible;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function equal(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((value, i) => equal(value, b[i]));
  }
  if (!isRecord(a) || !isRecord(b)) return false;
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  return aKeys.length === bKeys.length && aKeys.every((key) => Object.hasOwn(b, key) && equal(a[key], b[key]));
}

function diff(before: unknown, after: unknown): MergePatch | undefined {
  if (equal(before, after)) return undefined;
  if (!isRecord(after)) return after as MergePatch;
  if (!isRecord(before)) return after as { [key: string]: MergePatch };

  const patch: { [key: string]: MergePatch } = {};
  for (const key of Object.keys(before)) {
    if (!Object.hasOwn(after, key)) patch[key] = DELETE;
  }
  for (const [key, value] of Object.entries(after)) {
    const change = diff(before[key], value);
    if (change !== undefined) patch[key] = change;
  }
  return patch;
}

/**
 * A structural state merge patch. Null is a state value; removed object keys
 * use the reserved {$delete:true} marker so nullable kernel fields survive.
 */
export function statePatch(before: State, after: State): MergePatch {
  return diff(publicState(before), publicState(after)) ?? {};
}

export function applyStatePatch<T>(value: T, patch: MergePatch): T {
  if (isRecord(patch) && patch.$delete === true && Object.keys(patch).length === 1) {
    throw new Error('A delete marker cannot replace the root value.');
  }
  if (!isRecord(patch)) return structuredClone(patch) as T;
  const result: Record<string, unknown> = isRecord(value) ? structuredClone(value) : {};
  for (const [key, change] of Object.entries(patch)) {
    if (isRecord(change) && change.$delete === true && Object.keys(change).length === 1) {
      delete result[key];
    } else {
      result[key] = applyStatePatch(result[key], change);
    }
  }
  return result as T;
}

/**
 * The most steps a phone keeps of the opening it plays before an account exists (NEXT 18 d). The phone
 * logs every step, a walked tile included, from the start until the sign-up; past this many it keeps
 * nothing more and the account starts fresh.
 */
export const OPENING_LOG_MAX = 2000;

/**
 * The opening as the phone hands it over at the sign-up (NEXT 18 d): the seed it played under, every step
 * in the order it played with the tick it played at (the shape `replay` reads), and the state it ended on
 * as `serialize` writes it. The server plays the log again under that seed and keeps the result only when
 * it lands on the same text.
 */
export interface OpeningUpload {
  seed: number;
  log: { a: Action; tick: number }[];
  state: string;
}
