/**
 * The equipment category (EQUIPMENT 3.1): derived from an item's blocks, never stored. Read in WEAPONS'
 * order: a look first, then a weapon, then a tool, so a weapon that also works (a dual hand) reads as a
 * weapon and a look never counts as anything else. Pure: it reads the item and nothing more.
 */
import type { ItemDef } from '@game/schema';

/** The seven categories, in the order `itemCategory` reads them (EQUIPMENT 3.1; WEAPONS 6, 13 and appendix). */
export const ITEM_CATEGORIES = ['look', 'weapon', 'tool', 'wear', 'consumable', 'quest', 'material'] as const;
export type ItemCategory = (typeof ITEM_CATEGORIES)[number];

/** What an item is to the player: one category, the first that fits in ITEM_CATEGORIES' order. */
export function itemCategory(it: Pick<ItemDef, 'kind' | 'tool' | 'weapon' | 'wear'>): ItemCategory {
  if (it.wear?.look) return 'look';
  if (it.weapon) return 'weapon';
  if (it.tool) return 'tool';
  if (it.wear) return 'wear';
  if (it.kind === 'food') return 'consumable';
  if (it.kind === 'fragment' || it.kind === 'treasure') return 'quest';
  return 'material';
}
