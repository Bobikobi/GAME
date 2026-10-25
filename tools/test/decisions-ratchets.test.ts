/** list-shrinks: a registered list never gains a key against the base, not even in a swap. */
import { describe, expect, it } from 'vitest';
import { checkRatchets, readList, type Ratchet } from '../src/decisions/ratchets';

const R: Ratchet = { name: 'LEFT', file: 'tools/src/x.ts', read: 'ts-string-array', instruction: 'draw it the new way' };
const J: Ratchet = { name: 'ledger', file: 'tools/x.json', read: 'json-keys', instruction: 'fix it instead' };
const ts = (...keys: string[]): string => `/** a list */\nexport const LEFT: readonly string[] = [${keys.map((k) => `'${k}'`).join(', ')}] as const;\n`;
const files = (map: Record<string, string>) => (file: string): string | null => map[file] ?? null;

describe('list-shrinks', () => {
  it('reads an exported const array of string literals and the keys of a JSON object', () => {
    expect(readList(ts('a', 'b'), R)).toEqual(['a', 'b']);
    expect(readList('const LEFT = ["a"];', R)).toBeNull();
    expect(readList('export const LEFT = ["a", name];', R)).toBeNull();
    expect(readList('{"x": 1, "y": 2}', J)).toEqual(['x', 'y']);
    expect(readList('["x"]', J)).toBeNull();
  });

  it('a list that shrinks passes', () => {
    expect(checkRatchets(files({ [R.file]: ts('a') }), files({ [R.file]: ts('a', 'b') }), [R])).toEqual([]);
  });

  it('a list that grows fails', () => {
    const issues = checkRatchets(files({ [R.file]: ts('a', 'b', 'c') }), files({ [R.file]: ts('a', 'b') }), [R]);
    expect(issues.map((i) => i.message)).toEqual(['adds "c": the list only shrinks: draw it the new way [list-shrinks]']);
  });

  it('a swap fails: a key comes in while another leaves', () => {
    const issues = checkRatchets(files({ [J.file]: '{"a":1,"c":1}' }), files({ [J.file]: '{"a":1,"b":1}' }), [J]);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.message).toMatch(/adds "c"/);
  });

  it('a list deleted or reshaped at head fails', () => {
    expect(checkRatchets(files({}), files({ [R.file]: ts('a') }), [R])[0]!.message).toMatch(/cannot be read at head/);
    expect(checkRatchets(files({ [R.file]: 'export let LEFT = ["a"];' }), files({ [R.file]: ts('a') }), [R])).toHaveLength(1);
  });

  it('a list the base lacks is skipped, and no base runs nothing', () => {
    expect(checkRatchets(files({ [R.file]: ts('a') }), files({}), [R])).toEqual([]);
    expect(checkRatchets(files({ [R.file]: ts('a', 'z') }), null, [R])).toEqual([]);
  });
});
