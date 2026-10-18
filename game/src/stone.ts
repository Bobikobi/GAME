/**
 * The returners' stone at the old bridge (NEXT 16 e): six names cut by earlier hands, one word each, and a line
 * under them that the player carves. The stone is the speaker of every line on it (STORY S2): it says that people
 * came back and carved a name, never why or when (S1). Written content, as lore.ts is; the names are the team's.
 */
export const STONE_RESTORE = 'core/old-bridge';
export const STONE_SPEAKER = 'The stone';
export const STONE_NAMES = ['Odile', 'Bram', 'Sunniva', 'Hale', 'Ketil', 'Ivo'] as const;
/** What is cut for a player who types no name. */
export const DEFAULT_CARVE = 'Wanderer';
/** The stone's one box after the mend: the purse under it, with no claim about who hung it or when. */
export const STONE_PURSE = ["Thirty gold hang below the names, a tool's price.", 'Take them.'];
/** Seconds the camera takes to come down to the stone, and the zoom it holds there (frame hook-2-stop-close). */
export const STONE_GLIDE_MS = 1200;
export const STONE_ZOOM = 3;

export interface StoneView {
  /** the six written names, top to bottom */
  names: readonly string[];
  /** the line under them: the player's name, or '' while it is not cut yet */
  carved: string;
}

/** What the stone shows for a restore: nothing for any place but the bridge, and nothing before it is mended. */
export function stoneView(restoreId: string, restored: readonly string[], name: string): StoneView | undefined {
  if (restoreId !== STONE_RESTORE || !restored.includes(restoreId)) return undefined;
  return { names: STONE_NAMES, carved: name };
}
