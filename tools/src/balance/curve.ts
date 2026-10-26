/**
 * The one growth curve of PROGRESSION 3.2: a school's step i (from level i to
 * i + 1) takes t1 * ratio^(i - 1) active milliseconds, the ratio being the
 * 9.10 difficulty step. Exact in whole numbers: each step is computed in
 * BigInt and rounded down once.
 */
import type { Rules } from './rules';

/** Active milliseconds of step i (1-based): from level i to level i + 1. */
export function stepMs(t1Ms: number, ratioPermille: number, i: number): number {
  const n = BigInt(Math.max(0, i - 1));
  return Number((BigInt(t1Ms) * BigInt(ratioPermille) ** n) / 1000n ** n);
}

/** Active milliseconds from level 1 to each level: entry k is level k + 2 (the first entry is level 2). */
export function thresholdsMs(rules: Rules, t1Ms = rules.t1Ms): number[] {
  const out: number[] = [];
  let sum = 0;
  for (let i = 1; i <= rules.steps; i++) {
    sum += stepMs(t1Ms, rules.ratioPermille, i);
    out.push(sum);
  }
  return out;
}

/** The level an active time reaches on the curve, 1 to mastery (steps + 1). */
export function levelOf(rules: Rules, xpMs: number, t1Ms = rules.t1Ms): number {
  let level = 1;
  for (const at of thresholdsMs(rules, t1Ms)) if (xpMs >= at) level++;
  return level;
}

/** Active milliseconds from level 1 to mastery. */
export function masteryMs(rules: Rules, t1Ms = rules.t1Ms): number {
  return thresholdsMs(rules, t1Ms).at(-1) ?? 0;
}

/** A strength on the 9.10 scale: ratio^d in permille of step 0, exact and rounded down. */
export function scalePermille(ratioPermille: number, d: number): number {
  const n = BigInt(Math.max(0, d));
  return Number((1000n * BigInt(ratioPermille) ** n) / 1000n ** n);
}

/** Tenths of an hour, rounded to the nearest, for a reader: 2976000000 ms is 826.7 h. */
export function hoursTenths(ms: number): number {
  return Math.trunc((ms + 180_000) / 360_000);
}

/** 1500 permille reads 1.5, 3325256 reads 3325.2 (rounded down). */
export function fmtPermille(p: number): string {
  return `${Math.trunc(p / 1000)}.${Math.trunc((p % 1000) / 100)}`;
}

/** A permille of the cap as a percent: -205 reads -20.5%. */
export function fmtPct(permille: number): string {
  const a = Math.abs(permille);
  return `${permille < 0 ? '-' : ''}${Math.trunc(a / 10)}.${a % 10}%`;
}

export function fmtTenths(t: number): string {
  return `${Math.trunc(t / 10)}.${t % 10}`;
}

/** A duration for a reader: 28 s, 2.2 min, 6.8 h. */
export function fmtMs(ms: number): string {
  if (ms < 60_000) return `${Math.trunc((ms + 500) / 1000)} s`;
  if (ms < 3_600_000) {
    const t = Math.trunc((ms + 3000) / 6000);
    return `${fmtTenths(t)} min`;
  }
  return `${fmtTenths(hoursTenths(ms))} h`;
}
