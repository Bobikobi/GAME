/**
 * The one work rule for both sides (QUARRYING 10; DECISIONS.md, 2026-10-11): which work runs by itself after one
 * press (felling with the axe, digging with the trowel, mining with a pick or bare hands on a mined node) and which
 * plays a minigame. The kernel reads the timing grade by it (work that runs by itself is grade 3, whatever the
 * action says), and the client starts the work by it, so the two never disagree. Pure: no state, no clock.
 */
import type { ResourceDef, TreasureDef } from './bundle';

export type AutoKind = 'fell' | 'dig' | 'mine';

/** The tool that makes a node work by itself, and what the work is called. A node marked `work: "mine"` works by itself with no tool; herbs and the keystone keep their minigames. */
const BY_TOOL: Readonly<Record<string, AutoKind>> = { axe: 'fell', trowel: 'dig', pick: 'mine' };

export function autoKind(tool: string | undefined): AutoKind | undefined {
  return tool === undefined ? undefined : BY_TOOL[tool];
}

/** What a resource node asks for: a tree, a mined stone, or whatever else is worked with a tool. */
export function resourceKind(r: Pick<ResourceDef, 'tool' | 'work'>): AutoKind | undefined {
  return r.work === 'mine' && r.tool === undefined ? 'mine' : autoKind(r.tool);
}

/** What a treasure asks for: a dig with a trowel; a find picked up by hand has no work. */
export function treasureKind(t: Pick<TreasureDef, 'tool'>): AutoKind | undefined {
  return autoKind(t.tool);
}

/**
 * Whether working this node or spot plays a minigame (QUARRYING 10). A resource node plays one unless its work runs
 * by itself; a dig spot plays one only when it names a tool that does not run by itself (a find picked up by hand
 * plays none, and neither does a trowel dig). The kind is the instance's own (`inst.kind`), never read off the
 * shape, because a resource node can carry finds too. The game field does not decide it: the oaks say
 * `game: "snap"` and are felled by themselves.
 */
export function playsMinigame(kind: 'resource' | 'treasure', def: Pick<ResourceDef, 'tool'> & Partial<Pick<ResourceDef, 'work'>>): boolean {
  return kind === 'resource' ? resourceKind(def) === undefined : treasureKind(def) === undefined && def.tool !== undefined;
}
