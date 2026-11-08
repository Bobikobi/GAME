/**
 * Integer value noise for the generator: a lattice of drawn values every `cell` tiles, blended between with a
 * smoothstep in fixed point (1024 = 1). Every value is 0..65535, every step an integer, so the same seed gives
 * the same field on every machine (same seed, same world). `fbm` sums octaves with integer weights.
 */
import type { Seed } from '@game/kernel';
import { draw } from '@game/kernel';
import { at } from './rand';

const ONE = 1024;

/** Floor division for a lattice that may sit at negative coordinates. */
function floorDiv(a: number, b: number): number {
  return Math.floor(a / b);
}

/** The lattice value at a lattice point: 0..65535. */
function lattice(seed: Seed, layer: string, ix: number, iy: number): number {
  return draw(seed, `noise:${layer}`, at(ix + 32768, iy + 32768)) & 0xffff;
}

/** Smoothstep of t in [0, ONE], in [0, ONE]. */
function smooth(t: number): number {
  // 3t^2 - 2t^3, fixed point
  const t2 = Math.floor((t * t) / ONE);
  const t3 = Math.floor((t2 * t) / ONE);
  return 3 * t2 - 2 * t3;
}

/** Value noise at tile (x, y) for a lattice of `cell` tiles: 0..65535. */
export function valueNoise(seed: Seed, layer: string, x: number, y: number, cell: number): number {
  const ix = floorDiv(x, cell);
  const iy = floorDiv(y, cell);
  const fx = x - ix * cell;
  const fy = y - iy * cell;
  const sx = smooth(Math.floor((fx * ONE) / cell));
  const sy = smooth(Math.floor((fy * ONE) / cell));
  const a = lattice(seed, layer, ix, iy);
  const b = lattice(seed, layer, ix + 1, iy);
  const c = lattice(seed, layer, ix, iy + 1);
  const d = lattice(seed, layer, ix + 1, iy + 1);
  const top = Math.floor((a * (ONE - sx) + b * sx) / ONE);
  const bottom = Math.floor((c * (ONE - sx) + d * sx) / ONE);
  return Math.floor((top * (ONE - sy) + bottom * sy) / ONE);
}

/** Octaves summed by integer weights, back to 0..65535. `cells` and `weights` are the same length. */
export function fbm(seed: Seed, layer: string, x: number, y: number, cells: readonly number[], weights: readonly number[]): number {
  let sum = 0;
  let total = 0;
  for (let i = 0; i < cells.length; i++) {
    sum += valueNoise(seed, `${layer}:${i}`, x, y, cells[i]!) * weights[i]!;
    total += weights[i]!;
  }
  return Math.floor(sum / total);
}
