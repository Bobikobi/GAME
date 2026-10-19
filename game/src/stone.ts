/**
 * The returners' stone at the old bridge (NEXT 16 e): six names cut by earlier hands, one word each, and a line
 * under them that the player carves. The stone is the speaker of every line on it (STORY S2): it says that people
 * came back and carved a name, never why or when (S1). The names, the default name and the purse lines are the
 * restore's `stone` content (content/core/restores/old-bridge.json); this file holds only what the client decides.
 */
import type { RestoreDef } from '@game/kernel';

export const STONE_RESTORE = 'core/old-bridge';
export const STONE_SPEAKER = 'The stone';
/** Seconds the camera takes to come down to the stone, and how many whole camera steps (view.ts) closer than the screen's own it holds (frame hook-2-stop-close: zoom 3 against 2 on a phone, 1.5 times closer; k to k+1 is the same at k = 2). */
export const STONE_GLIDE_MS = 1200;
export const STONE_STEPS = 1;

export interface StoneView {
  /** the six written names, top to bottom */
  names: readonly string[];
  /** the line under them: the player's name, or '' while it is not cut yet */
  carved: string;
}

/** What the stone shows for a restore: nothing for any place but the bridge, and nothing before it is mended. */
export function stoneView(def: RestoreDef | undefined, restored: readonly string[], name: string): StoneView | undefined {
  if (!def?.stone || def.id !== STONE_RESTORE || !restored.includes(def.id)) return undefined;
  return { names: def.stone.names, carved: name };
}
