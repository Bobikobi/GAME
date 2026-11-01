/**
 * The keyed luck (finding 3 of the 27.10 security review; kernel 0.20, state format 3): a draw is
 * SipHash-2-4 under a 128-bit key, built from 32-bit integer operations, and an old 32-bit seed widens to
 * a key the same way everywhere.
 *
 * The reference: J.-P. Aumasson and D. J. Bernstein, "SipHash: a fast short-input PRF", INDOCRYPT 2012,
 * Appendix A (key 00 01 .. 0f, message 00 01 .. 0e, result a129ca6149be45e5), and the 64 vectors of the
 * reference code's `vectors.h` (github.com/veorq/SipHash, `vectors_sip64`): the same key, the message
 * 00 01 .. (n-1) for n = 0..63, the 8 result bytes in the order the reference writes them. The list below
 * was taken from OpenSSL 3.5's SIPHASH MAC (c-rounds 2, d-rounds 4) and matches `vectors.h` at every entry
 * checked by hand (0, 1, 2, 15 and 63).
 */
import { beforeAll, describe, expect, test } from 'vitest';

import {
  type Bundle,
  type Seed,
  type State,
  KERNEL_VERSION,
  STATE_FORMAT,
  draw,
  isSeed,
  migrateState,
  newState,
  publicState,
  seedBytes,
  seedFromBytes,
  serialize,
  sipHash24,
  step,
  wakePocket,
  widenSeed,
} from '@game/kernel';

import { loadBundle } from '../../tools/test/helpers/world.js';

/** `vectors_sip64` of the reference code, n = 0..63, as the 8 bytes of each result in hex. */
const VECTORS = [
  '310e0edd47db6f72', 'fd67dc93c539f874', '5a4fa9d909806c0d', '2d7efbd796666785',
  'b7877127e09427cf', '8da699cd64557618', 'cee3fe586e46c9cb', '37d1018bf50002ab',
  '6224939a79f5f593', 'b0e4a90bdf82009e', 'f3b9dd94c5bb5d7a', 'a7ad6b22462fb3f4',
  'fbe50e86bc8f1e75', '903d84c02756ea14', 'eef27a8e90ca23f7', 'e545be4961ca29a1',
  'db9bc2577fcc2a3f', '9447be2cf5e99a69', '9cd38d96f0b3c14b', 'bd6179a71dc96dbb',
  '98eea21af25cd6be', 'c7673b2eb0cbf2d0', '883ea3e395675393', 'c8ce5ccd8c030ca8',
  '94af49f6c650adb8', 'eab8858ade92e1bc', 'f315bb5bb835d817', 'adcf6b0763612e2f',
  'a5c91da7acaa4dde', '716595876650a2a6', '28ef495c53a387ad', '42c341d8fa92d832',
  'ce7cf2722f512771', 'e37859f94623f3a7', '381205bb1ab0e012', 'ae97a10fd434e015',
  'b4a31508beff4d31', '81396229f0907902', '4d0cf49ee5d4dcca', '5c73336a76d8bf9a',
  'd0a704536ba93e0e', '925958fcd6420cad', 'a915c29bc8067318', '952b79f3bc0aa6d4',
  'f21df2e41d4535f9', '87577519048f53a9', '10a56cf5dfcd9adb', 'eb75095ccd986cd0',
  '51a9cb9ecba312e6', '96afadfc2ce666c7', '72fe52975a4364ee', '5a1645b276d592a1',
  'b274cb8ebf87870a', '6f9bb4203de7b381', 'eaecb2a30b22a87f', '9924a43cc1315724',
  'bd838d3aafbf8db7', '0b1a2a3265d51aea', '135079a3231ce660', '932b2846e4d70666',
  'e1915f5cb1eca46c', 'f325965ca16d629f', '575ff28e60381be5', '724506eb4c328a95',
];

const REFERENCE_KEY = seedFromBytes(Array.from({ length: 16 }, (_, i) => i));

/** The 8 result bytes in the reference's order (the 64-bit word, little-endian). */
function hex(words: readonly [number, number]): string {
  return words
    .flatMap((w) => [w & 0xff, (w >>> 8) & 0xff, (w >>> 16) & 0xff, w >>> 24])
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

const counting = (n: number) => Array.from({ length: n }, (_, i) => i);

let b: Bundle;

beforeAll(() => {
  b = loadBundle();
});

describe('SipHash-2-4 on 32-bit words', () => {
  test('gives the paper\'s Appendix A result', () => {
    const [lo, hi] = sipHash24(REFERENCE_KEY, counting(15));
    expect(hi.toString(16).padStart(8, '0') + lo.toString(16).padStart(8, '0')).toBe('a129ca6149be45e5');
  });

  test.each(VECTORS.map((expected, n) => [n, expected] as const))('gives the reference vector for %i bytes', (n, expected) => {
    expect(hex(sipHash24(REFERENCE_KEY, counting(n)))).toBe(expected);
  });

  test('reads its key as the reference does: the 16 bytes little-endian, k0 first', () => {
    expect(REFERENCE_KEY).toEqual([0x03020100, 0x07060504, 0x0b0a0908, 0x0f0e0d0c]);
    expect(seedBytes(REFERENCE_KEY)).toEqual(counting(16));
    const key: Seed = [0xdeadbeef, 0x01234567, 0x89abcdef, 0xfffffffe];
    expect(seedFromBytes(seedBytes(key))).toEqual(key);
  });
});

describe('a draw under the key', () => {
  const KEY: Seed = [0x6b8b4567, 0x327b23c6, 0x643c9869, 0x66334873];

  test('is an unsigned 32-bit integer, and every word of the key moves it', () => {
    const base = draw(KEY, 'core/oak#3', 12);
    expect(Number.isInteger(base) && base >= 0 && base <= 0xffffffff).toBe(true);
    for (let word = 0; word < 4; word++) {
      const other = [...KEY] as [number, number, number, number];
      other[word] = (other[word]! ^ 1) >>> 0;
      expect(draw(other, 'core/oak#3', 12), `word ${word}`).not.toBe(base);
    }
  });

  test('is the low word of SipHash-2-4 over the counter then the entity, little-endian', () => {
    // counter 0x01020304, entity "Az" (code units 0x0041, 0x007a)
    expect(draw(KEY, 'Az', 0x01020304)).toBe(sipHash24(KEY, [0x04, 0x03, 0x02, 0x01, 0x41, 0x00, 0x7a, 0x00])[0]);
  });

  test('keeps an entity and a counter apart: no pair reads as another', () => {
    // the counter has a fixed width and the length is hashed in, so a shorter entity is another message
    expect(draw(KEY, 'a', 1)).not.toBe(draw(KEY, '', 1));
    expect(draw(KEY, 'ab', 0)).not.toBe(draw(KEY, 'a', 0));
  });
});

describe('the seed of an old save widens to a key (state format 3)', () => {
  test('the kernel is 0.20 and the format 3', () => {
    expect(KERNEL_VERSION).toBe('0.23.0');
    expect(STATE_FORMAT).toBe(3);
  });

  test('a new world holds a key of four words', () => {
    const key: Seed = [1, 2, 3, 4];
    expect(newState(b, key).seed).toEqual(key);
    expect(isSeed(newState(b, key).seed)).toBe(true);
    expect(newState(b, 2026).seed).toEqual([2026, 0, 0, 0]);
    expect(widenSeed(-1)).toEqual([0xffffffff, 0, 0, 0]);
  });

  test('a format 2 save keeps playing: its 32-bit seed becomes the same key wherever it loads', () => {
    const r = step(b, newState(b, widenSeed(31337)), { t: 'start', race: 'core/human', name: 'Tess' }, 0);
    if (!r.ok) throw new Error(r.error);
    const old = JSON.parse(serialize(r.state)) as Omit<State, 'seed'> & { seed: unknown };
    old.seed = 31337;
    old.format = 2;
    const before = JSON.stringify(old);
    const now = migrateState(old as unknown as State);
    expect(JSON.stringify(old)).toBe(before);
    expect(now.format).toBe(3);
    expect(now.seed).toEqual([31337, 0, 0, 0]);
    expect(serialize(now)).toBe(serialize(r.state));
    expect(migrateState(now)).toEqual(now);
    // and it plays on
    expect(step(b, now, { t: 'move', at: now.player.at }, 1).ok).toBe(true);
  });

  test('a state the server stored carries no seed, and stays without one', () => {
    const stored = { ...publicState(newState(b, [5, 6, 7, 8])), format: 2 } as unknown as State;
    const now = migrateState(stored);
    expect('seed' in now).toBe(false);
    expect(now.format).toBe(3);
  });

  test('the wake pocket is drawn under the key', () => {
    const pockets = new Set<string>();
    for (let n = 0; n < 200; n++) pockets.add(wakePocket(b, [n, 0x9e3779b9, n * 7, 0x7f4a7c15]));
    expect([...pockets].sort()).toEqual(Object.keys(b.pockets).sort());
  });
});
