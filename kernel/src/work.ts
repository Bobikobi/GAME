/**
 * The one work rule for both sides (QUARRYING 10; DECISIONS.md, 2026-11-20): every work action is a click and a
 * repeating animation. This says which animation a node or a spot plays (felling with the axe, digging with the
 * trowel, mining with a pick or bare hands on a mined node, casting with the rod, picking by hand); the kernel
 * knows no such difference, since there is no timing window and no grade for work to read. Pure: no state, no clock.
 */
import type { ResourceDef, TreasureDef } from './bundle';

export type WorkKind = 'fell' | 'dig' | 'mine' | 'fish' | 'pick';

/** The tool that sets what the work is called; no tool, or one that is only carried (the basket), is picking. */
const BY_TOOL: Readonly<Record<string, WorkKind>> = { axe: 'fell', trowel: 'dig', pick: 'mine', rod: 'fish' };

/** What a resource node asks for: a tree is felled, a mined stone quarried, a river fished, anything else picked. */
export function resourceKind(r: Pick<ResourceDef, 'tool' | 'work'>): WorkKind {
  if (r.work === 'mine' && r.tool === undefined) return 'mine';
  return (r.tool === undefined ? undefined : BY_TOOL[r.tool]) ?? 'pick';
}

/** What a treasure asks for: a dig with a trowel; a find picked up by hand, or with a basket, is picking. */
export function treasureKind(t: Pick<TreasureDef, 'tool'>): WorkKind {
  return t.tool === 'trowel' ? 'dig' : 'pick';
}
