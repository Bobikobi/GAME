/**
 * Where a walking predator's sprite stands, in tile units: the kernel's round tile, slid toward
 * the next one by the same pace, so the drawing never drifts from the rule. Pure, so the rule can
 * be tested without a scene.
 */
import { type Bundle, type Hazard, lastDusk, predatorAt, windowOpen } from '@game/kernel';

/**
 * Between two rule tiles the sprite is linearly placed by the kernel's pace, so it reaches each
 * kernel position exactly on the tick that position changes. A step that would land after dawn is
 * never taken: the kernel keeps the predator on its tile until the window shuts, so the sprite
 * holds there too.
 */
export function predatorSpriteAt(b: Bundle, rule: Hazard, tick: number): [number, number] {
  const [tx, ty] = predatorAt(b, rule, tick);
  if (!rule.round || !windowOpen(b, rule, tick)) return [tx, ty];
  const into = (tick - lastDusk(b, tick)) % rule.pace;
  // the tick of the next step; in the last pace before dawn it is already day
  const stepAt = tick - into + rule.pace;
  if (!windowOpen(b, rule, stepAt)) return [tx, ty];
  const phase = into / rule.pace;
  const [nx, ny] = predatorAt(b, rule, stepAt);
  return [tx + (nx - tx) * phase, ty + (ny - ty) * phase];
}
