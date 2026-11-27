/**
 * Where a stepped animal is drawn between its think steps (kernel `wildStep`): the kernel moves it whole tiles once every
 * `THINK_MS`, and the view walks it along the tiles it entered in that think (`WildAnimal.path`), so it never cuts across
 * water or a wall. The drawing runs one think behind the kernel, the usual interpolation delay. Display only, pure.
 */
import { THINK_MS, type WildAnimal } from '@game/kernel';

export interface WildDrawn {
  /** tiles, fractional while it walks */
  at: [number, number];
  /** the unit step it is walking along now, or the way it faces when it stands */
  heading: [number, number];
  /** tiles it covers in this think: 0 standing, about 4 at a walk, 8 at a run */
  tiles: number;
}

/** The drawn place of an animal at game ms `ms`. */
export function wildDrawnAt(a: Pick<WildAnimal, 'from' | 'path' | 'last' | 'c'>, ms: number): WildDrawn {
  const n = a.path.length;
  if (n === 0 || a.last < 0) return { at: [a.c.at[0], a.c.at[1]], heading: [a.c.face[0], a.c.face[1]], tiles: 0 };
  const t = Math.min(1, Math.max(0, (ms - a.last) / THINK_MS)) * n;
  const i = Math.min(n - 1, Math.floor(t));
  const p = i === 0 ? a.from : a.path[i - 1]!;
  const q = a.path[i]!;
  const k = t - i;
  return { at: [p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k], heading: [Math.sign(q[0] - p[0]), Math.sign(q[1] - p[1])], tiles: n };
}
