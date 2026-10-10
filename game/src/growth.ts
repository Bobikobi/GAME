/**
 * How a node that grows back looks (DECISIONS.md, 2026-10-09: wood comes from felling trees;
 * 2026-10-10: the axe and the first starts): by the share of its respawn time that has passed,
 * from the stump through the young stages to the grown one. Pure, so the stages can be tested
 * without a scene.
 */
import type { Bundle } from '@game/kernel';

type NodeArt = Pick<Bundle['resources'][string], 'sprite' | 'sprite_empty' | 'growth' | 'solid' | 'respawn_ms'>;

export interface NodeLook {
  sprite: string;
  alpha: number;
  /** drawn on the ground, under the player, because the way over it is open */
  flat: boolean;
}

/** The stage a node that is not yet ready shows, `left` ms before it is: the bare ground first, the young stages as it grows. */
export function growthSprite(r: NodeArt, left: number): string {
  if (!r.sprite_empty) return r.sprite;
  const stages = [r.sprite_empty, ...(r.growth ?? [])];
  const span = Math.max(1, r.respawn_ms);
  const grown = Math.min(span, Math.max(0, span - left));
  return stages[Math.min(stages.length - 1, Math.floor((grown * stages.length) / span))]!;
}

/**
 * What a node shows `left` ms before it is ready (0 or less: it is). A gathered node lies flat and
 * faded, since the way over it is open; a solid one, a tree, stays upright at every stage because
 * it stays in the way.
 */
export function nodeLook(r: NodeArt, left: number): NodeLook {
  if (left <= 0) return { sprite: r.sprite, alpha: 1, flat: false };
  if (!r.sprite_empty) return { sprite: r.sprite, alpha: 0.3, flat: true };
  const sprite = growthSprite(r, left);
  return r.solid === true ? { sprite, alpha: 1, flat: false } : { sprite, alpha: 0.8, flat: true };
}
