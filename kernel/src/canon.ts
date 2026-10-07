/**
 * Canonical serialization and hashing (rule R3). Keys are sorted by UTF-16
 * code unit (the default sort), undefined fields are dropped, and a number
 * that is not a safe integer is an error rather than a silent rounding.
 * Two runs that reach the same state produce the same text and hash.
 */
import { KernelError } from './num';

export function canonical(value: unknown): string {
  if (value === null) return 'null';
  switch (typeof value) {
    case 'number':
      if (!Number.isSafeInteger(value)) throw new KernelError(`non-integer number in canonical data: ${value}`);
      return String(value);
    case 'string':
      return JSON.stringify(value);
    case 'boolean':
      return value ? 'true' : 'false';
    case 'object': {
      if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
      const record = value as Record<string, unknown>;
      const keys = Object.keys(record)
        .filter((k) => record[k] !== undefined)
        .sort();
      return `{${keys.map((k) => `${JSON.stringify(k)}:${canonical(record[k])}`).join(',')}}`;
    }
    default:
      throw new KernelError(`cannot serialize a ${typeof value}`);
  }
}

/** 64-bit hash as 16 hex characters (two 32-bit lanes, cyrb53 structure). */
export function hashText(text: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0');
}

export function hashOf(value: unknown): string {
  return hashText(canonical(value));
}

/** Iterate a record in canonical key order. */
export function sortedEntries<T>(record: Record<string, T>): [string, T][] {
  return Object.keys(record)
    .sort()
    .map((k) => [k, record[k] as T]);
}
