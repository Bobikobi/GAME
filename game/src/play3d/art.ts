/**
 * Which 3D model stands in for a sprite of the bundle. A sprite with no entry here is drawn as the bundle's own
 * picture (world3d.ts), so content from any creator shows up in the 3D door from its first day.
 */

export interface ModelFor {
  model: string;
  /** the model's height in metres (one tile is one metre) */
  height: number;
}

const BY_SPRITE: Record<string, ModelFor> = {
  herb_plant: { model: 'plant_bush', height: 0.55 },
  bush_berry: { model: 'plant_bushDetailed', height: 0.9 },
  bush_empty: { model: 'plant_bush', height: 0.5 },
  log_fallen: { model: 'log', height: 0.4 },
  mushroom_patch: { model: 'mushroom_redGroup', height: 0.45 },
  tree_oak: { model: 'tree_oak', height: 3.2 },
  stump: { model: 'stump_oldTall', height: 0.7 },
  sapling: { model: 'plant_bushLarge', height: 0.6 },
  young_tree: { model: 'tree_oak', height: 1.5 },
  rock_small: { model: 'rock_smallA', height: 0.3 },
  rock_stones: { model: 'rock_largeA', height: 0.5 },
  rock_mossy: { model: 'rock_smallB', height: 0.4 },
};

/** "core/base-kit:props/herb_plant" -> "herb_plant" */
function baseName(ref: string): string {
  return ref.split('/').pop() ?? ref;
}

export function nodeModel(spriteRef: string): ModelFor | undefined {
  return BY_SPRITE[baseName(spriteRef)];
}

/** The mini characters that stand in for the valley's people until their own models are made (NEXT.md, 8b). */
const PEOPLE: Record<string, string> = {
  'core/elder': 'character-male-a',
  'core/trader': 'character-female-a',
};

export function npcLook(npcId: string): string | undefined {
  return PEOPLE[npcId];
}

/** A steady turn in [0, 1) for a tile, so the same tree always stands the same way. */
export function pickLook(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263 + 1013904223) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
