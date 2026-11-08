/**
 * The generator's draws (DECISIONS 2026-10-17, "same seed, same world"): every number the generator needs is a
 * pure function of the story's seed, the thing it belongs to and that thing's own counter, through the kernel's
 * SipHash draw. Nothing is a stream: a place added elsewhere never shifts what this tile is. Integers only.
 */
import { type Seed, draw, mulDiv, sipHash24 } from '@game/kernel';

/** A public, fixed key: a story's seed word is a name, not a secret, so its key may be derived in the open. */
const STORY_KEY: Seed = [0x4c6f6f6d, 0x76616c65, 0x53746f72, 0x79536565];

/** The 128-bit key a story's seed word stands for: two SipHash words of the name, under the fixed key. */
export function storySeed(word: string): Seed {
  const bytes: number[] = [];
  for (let i = 0; i < word.length; i++) {
    const unit = word.charCodeAt(i);
    bytes.push(unit & 0xff, unit >>> 8);
  }
  const a = sipHash24(STORY_KEY, [...bytes, 0]);
  const b = sipHash24(STORY_KEY, [...bytes, 1]);
  return [a[0], a[1], b[0], b[1]];
}

/** Two tile coordinates folded into one counter: x and y each 0..65535. */
export function at(x: number, y: number): number {
  return (((x & 0xffff) << 16) | (y & 0xffff)) >>> 0;
}

/** An integer in [0, n). */
export function pick(seed: Seed, entity: string, counter: number, n: number): number {
  return mulDiv(draw(seed, entity, counter), n, 4_294_967_296);
}

/** Whether a draw lands under `permille` out of 1000. */
export function chance(seed: Seed, entity: string, counter: number, permille: number): boolean {
  return pick(seed, entity, counter, 1000) < permille;
}

/** One of a list, by a draw. */
export function choose<T>(seed: Seed, entity: string, counter: number, list: readonly T[]): T {
  return list[pick(seed, entity, counter, list.length)]!;
}
