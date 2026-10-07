/**
 * Draws (rule R4): a draw is a pure function of the world seed, the entity it
 * belongs to and that entity's own counter. Nothing else can shift it, so a
 * new extension elsewhere in the world never changes what this spot gives.
 */
import { mulDiv } from './num';

export function draw(seed: number, entity: string, counter: number): number {
  let h = seed >>> 0;
  for (let i = 0; i < entity.length; i++) {
    h = Math.imul(h ^ entity.charCodeAt(i), 0x01000193) >>> 0;
  }
  h = Math.imul(h ^ (counter >>> 0), 0x9e3779b1) >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}

/** A draw in basis points: an integer in [0, 10000). */
export function drawBasisPoints(seed: number, entity: string, counter: number): number {
  return mulDiv(draw(seed, entity, counter), 10_000, 4_294_967_296);
}
