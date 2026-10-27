/**
 * Draws (rule R4): a draw is a pure function of the world's secret key, the entity it belongs to and
 * that entity's own counter. Nothing else can shift it, so a new extension elsewhere in the world never
 * changes what this spot gives.
 *
 * The key is 128 bits, four unsigned 32-bit words, and a draw is SipHash-2-4 of the entity and the
 * counter under it (finding 3 of the 27.10 security review). A player sees outcomes: the wake pocket,
 * a gather, a search row, a craft, the weather. Before kernel 0.20 a draw was a fast 32-bit hash of a
 * 32-bit seed, so a 2^32 search over a few seen outcomes gave the seed and with it every future draw.
 * SipHash is a keyed pseudorandom function: outcomes do not give the key back, and there are 2^128 keys.
 *
 * SipHash-2-4 is Aumasson and Bernstein, "SipHash: a fast short-input PRF" (INDOCRYPT 2012), built here
 * from 32-bit integer operations only, each 64-bit word a pair of unsigned 32-bit halves. The tests check
 * it against the paper's Appendix A vector and the 64 vectors of the reference code's `vectors.h`
 * (github.com/veorq/SipHash).
 */
import { KernelError, mulDiv } from './num';

/** A world's secret key: four unsigned 32-bit words, 128 bits. The server's alone once an account holds it. */
export type Seed = readonly [number, number, number, number];

/** The bytes a key is made of. */
export const SEED_BYTES = 16;

/** Whether a value is a key: four whole numbers in [0, 2^32). */
export function isSeed(value: unknown): value is Seed {
  return Array.isArray(value) && value.length === 4 && value.every((word) => Number.isSafeInteger(word) && word >= 0 && word <= 0xffff_ffff);
}

/**
 * The key a 32-bit seed of kernel 0.19 or before stands for: the old number as the first word, the rest
 * zero. Deterministic, so an old save widens to the same key wherever it is loaded; it still holds only
 * the 32 bits the old seed had, and its draws differ from the old draws (the draw itself changed).
 */
export function widenSeed(old: number): Seed {
  return [old >>> 0, 0, 0, 0];
}

/** A key from 16 bytes, each word read little-endian, as SipHash reads its key. */
export function seedFromBytes(bytes: ArrayLike<number>): Seed {
  if (bytes.length !== SEED_BYTES) throw new KernelError(`a key is ${SEED_BYTES} bytes, not ${bytes.length}`);
  const word = (i: number) => ((bytes[i]! | (bytes[i + 1]! << 8) | (bytes[i + 2]! << 16) | (bytes[i + 3]! << 24)) >>> 0);
  return [word(0), word(4), word(8), word(12)];
}

/** The 16 bytes of a key, the inverse of `seedFromBytes`. */
export function seedBytes(seed: Seed): number[] {
  const out: number[] = [];
  for (const word of seed) out.push(word & 0xff, (word >>> 8) & 0xff, (word >>> 16) & 0xff, (word >>> 24) & 0xff);
  return out;
}

// ------------------------------------------------------------ SipHash-2-4 on 32-bit halves

/** v0..v3 as [lo, hi] pairs: v[0] v[1] is v0, v[2] v[3] is v1, and so on. */
type Lanes = number[];

/** v[a] += v[b], mod 2^64. */
function add(v: Lanes, a: number, b: number): void {
  const lo = (v[a]! + v[b]!) >>> 0;
  const carry = lo < v[a]! ? 1 : 0;
  v[a] = lo;
  v[a + 1] = (v[a + 1]! + v[b + 1]! + carry) >>> 0;
}

/** v[a] = rotl(v[a], n), for 0 < n < 32. */
function rotl(v: Lanes, a: number, n: number): void {
  const lo = v[a]!;
  const hi = v[a + 1]!;
  v[a] = ((lo << n) | (hi >>> (32 - n))) >>> 0;
  v[a + 1] = ((hi << n) | (lo >>> (32 - n))) >>> 0;
}

/** v[a] = rotl(v[a], 32): the halves swap. */
function swap(v: Lanes, a: number): void {
  const lo = v[a]!;
  v[a] = v[a + 1]!;
  v[a + 1] = lo;
}

/** v[a] ^= v[b]. */
function xor(v: Lanes, a: number, b: number): void {
  v[a] = (v[a]! ^ v[b]!) >>> 0;
  v[a + 1] = (v[a + 1]! ^ v[b + 1]!) >>> 0;
}

const V0 = 0;
const V1 = 2;
const V2 = 4;
const V3 = 6;

function sipRound(v: Lanes): void {
  add(v, V0, V1); rotl(v, V1, 13); xor(v, V1, V0); swap(v, V0);
  add(v, V2, V3); rotl(v, V3, 16); xor(v, V3, V2);
  add(v, V0, V3); rotl(v, V3, 21); xor(v, V3, V0);
  add(v, V2, V1); rotl(v, V1, 17); xor(v, V1, V2); swap(v, V2);
}

/** One message word in: v3 ^= m, two rounds, v0 ^= m. */
function compress(v: Lanes, lo: number, hi: number): void {
  v[V3] = (v[V3]! ^ lo) >>> 0;
  v[V3 + 1] = (v[V3 + 1]! ^ hi) >>> 0;
  sipRound(v);
  sipRound(v);
  v[V0] = (v[V0]! ^ lo) >>> 0;
  v[V0 + 1] = (v[V0 + 1]! ^ hi) >>> 0;
}

/** Four bytes from `at`, little-endian; past the end reads as zero. */
function le32(bytes: ArrayLike<number>, at: number, end: number): number {
  let w = 0;
  for (let i = 3; i >= 0; i--) w = (w << 8) | (at + i < end ? bytes[at + i]! & 0xff : 0);
  return w >>> 0;
}

/**
 * SipHash-2-4 of a byte string under a key: the 64-bit result as [low word, high word]. The key's
 * words are k0 = seed[1]:seed[0] and k1 = seed[3]:seed[2], the reference's little-endian reading of
 * the 16 key bytes `seedBytes` gives.
 */
export function sipHash24(seed: Seed, bytes: ArrayLike<number>): readonly [number, number] {
  const [k0lo, k0hi, k1lo, k1hi] = seed;
  // "somepseudorandomlygeneratedbytes", the reference's initial state
  const v: Lanes = [
    (k0lo ^ 0x70736575) >>> 0, (k0hi ^ 0x736f6d65) >>> 0,
    (k1lo ^ 0x6e646f6d) >>> 0, (k1hi ^ 0x646f7261) >>> 0,
    (k0lo ^ 0x6e657261) >>> 0, (k0hi ^ 0x6c796765) >>> 0,
    (k1lo ^ 0x79746573) >>> 0, (k1hi ^ 0x74656462) >>> 0,
  ];
  const n = bytes.length;
  const whole = n - (n % 8);
  for (let at = 0; at < whole; at += 8) compress(v, le32(bytes, at, n), le32(bytes, at + 4, n));
  // the last word: the bytes left over, and the length's low byte at the top
  compress(v, le32(bytes, whole, n), (le32(bytes, whole + 4, n) | ((n & 0xff) << 24)) >>> 0);
  v[V2] = (v[V2]! ^ 0xff) >>> 0;
  for (let i = 0; i < 4; i++) sipRound(v);
  return [(v[0]! ^ v[2]! ^ v[4]! ^ v[6]!) >>> 0, (v[1]! ^ v[3]! ^ v[5]! ^ v[7]!) >>> 0];
}

/**
 * The message a draw hashes: the counter as four bytes, then the entity's UTF-16 code units two bytes
 * each, all little-endian. The counter has a fixed width and SipHash folds the length in, so no two
 * (entity, counter) pairs share a message.
 */
function drawMessage(entity: string, counter: number): number[] {
  const c = counter >>> 0;
  const bytes = [c & 0xff, (c >>> 8) & 0xff, (c >>> 16) & 0xff, c >>> 24];
  for (let i = 0; i < entity.length; i++) {
    const unit = entity.charCodeAt(i);
    bytes.push(unit & 0xff, unit >>> 8);
  }
  return bytes;
}

/** A draw: an unsigned 32-bit integer, the low word of SipHash-2-4 of (counter, entity) under the key. */
export function draw(seed: Seed, entity: string, counter: number): number {
  return sipHash24(seed, drawMessage(entity, counter))[0];
}

/** A draw in basis points: an integer in [0, 10000). */
export function drawBasisPoints(seed: Seed, entity: string, counter: number): number {
  return mulDiv(draw(seed, entity, counter), 10_000, 4_294_967_296);
}
