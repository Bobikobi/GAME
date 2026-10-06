/** What stands where: read from the bundle, shared by the world and the menus. */
import type { Bundle, Slot } from '@game/kernel';

export interface PlaceInfo {
  id: string;
  title: string;
  creator: string;
  ai_tools?: string[];
  kind: 'resource' | 'treasure' | 'npc' | 'restore';
}

/** The content that fills a slot, if any. Only one extension is active per slot. */
export function slotContent(b: Bundle, slotId: string): PlaceInfo | undefined {
  const pick = (kind: PlaceInfo['kind'], list: Record<string, { id: string; title: string; creator: string; ai_tools?: string[]; place: { slot: string } }>) => {
    const found = Object.values(list).find((d) => d.place.slot === slotId);
    return found ? { id: found.id, title: found.title, creator: found.creator, ai_tools: found.ai_tools, kind } : undefined;
  };
  return (
    pick('resource', b.resources) ??
    pick('treasure', b.treasures) ??
    pick('npc', b.npcs) ??
    pick('restore', b.restores)
  );
}

/** Slots nothing fills yet: fog, and a sign that invites a creator. */
export function emptySlots(b: Bundle): Slot[] {
  return b.map.slots.filter((s) => s.kind !== 'camp' && s.kind !== 'area' && !slotContent(b, s.id));
}
