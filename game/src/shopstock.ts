/**
 * A shop's stock in named groups (DECISIONS 2026-10-22, decision 51: a shop never shows one unsorted list).
 * The group comes from the item alone, so a keeper added later (the inn, the workshop stall, a wayside
 * stall) is grouped the same way without a line of code: tools, materials, things to wear, food and
 * drink, medicine (an item tagged `medicine`), recipes (a recipe scrap) and treasures.
 */
import type { Bundle } from '@game/kernel';

export type ShopGroupKey = 'tool' | 'material' | 'wear' | 'food' | 'medicine' | 'recipe' | 'treasure';

/** The shop's groups in the order a counter shows them, each with its name. */
export const SHOP_GROUPS: readonly (readonly [ShopGroupKey, string])[] = [
  ['tool', 'Tools'],
  ['material', 'Materials'],
  ['wear', 'To wear'],
  ['food', 'Food and drink'],
  ['medicine', 'Medicine'],
  ['recipe', 'Recipes'],
  ['treasure', 'Treasures'],
];

/** The group an item belongs to on a counter; an unknown id goes with the materials. */
export function shopGroupOf(b: Bundle, id: string): ShopGroupKey {
  const it = b.items[id];
  if (!it) return 'material';
  if (it.kind === 'fragment' || it.fragment) return 'recipe';
  if (it.kind === 'tool' || it.tool) return 'tool';
  if (it.tags?.includes('medicine')) return 'medicine';
  if (it.wear) return 'wear';
  if (it.kind === 'food' || it.food) return 'food';
  if (it.kind === 'treasure') return 'treasure';
  return 'material';
}

export interface ShopGroup<T> {
  key: ShopGroupKey;
  label: string;
  entries: T[];
}

/**
 * The entries of a counter in named groups, in the order of `SHOP_GROUPS`; inside a group the shop
 * file's own order is kept (the keeper sets out the stall), and an empty group is left out.
 */
export function shopGroups<T>(b: Bundle, entries: readonly T[], itemOf: (entry: T) => string): ShopGroup<T>[] {
  return SHOP_GROUPS.map(([key, label]) => ({ key, label, entries: entries.filter((e) => shopGroupOf(b, itemOf(e)) === key) })).filter(
    (g) => g.entries.length > 0,
  );
}
