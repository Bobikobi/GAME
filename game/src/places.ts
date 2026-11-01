/** What stands where: read from the bundle, shared by the world and the menus. */
import { inRect, placeName, regionAt, type Bundle, type Slot } from '@game/kernel';

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

/** The map is revealed in 8x8-tile chunks: an area a walk can take in, never a tile. */
export const MAP_CHUNK = 8;

/** The town's free corner, where a player's stall can stand beside the trader. */
export const STALL_SLOT = 'core/town-corner';

export interface MapPlace {
  id: string;
  label?: string;
  kind: Slot['kind'];
  /** slot centre, in tiles */
  x: number;
  y: number;
  current: boolean;
  stall: boolean;
}

export function chunkKey(x: number, y: number): string {
  return `${Math.floor(x / MAP_CHUNK)},${Math.floor(y / MAP_CHUNK)}`;
}

/**
 * A place's name on the map: the slot's own label, or the content's title for a
 * place. People and plain ground stay unnamed unless the map names them, so a
 * trader is not a landmark.
 */
export function mapPlaceLabel(b: Bundle, slot: Slot): string | undefined {
  if (slot.label) return slot.label;
  if (slot.kind === 'resource' || slot.kind === 'npc') return undefined;
  return slotContent(b, slot.id)?.title;
}

/**
 * What the chart may show: slots the player has entered. A resource slot with
 * no name is ground, not a place; a person is met, not a landmark.
 */
export function mapPlaces(b: Bundle, seen: ReadonlySet<string>, at: readonly [number, number], stall?: string): MapPlace[] {
  const out: MapPlace[] = [];
  for (const slot of b.map.slots) {
    if (!seen.has(slot.id)) continue;
    const label = mapPlaceLabel(b, slot);
    if (label === undefined && (slot.kind === 'resource' || slot.kind === 'npc')) continue;
    out.push({
      id: slot.id,
      label,
      kind: slot.kind,
      x: slot.x + slot.w / 2,
      y: slot.y + slot.h / 2,
      current: inRect(at[0], at[1], slot),
      stall: slot.id === stall,
    });
  }
  return out;
}

/** True when the player stands on the town's free corner, where a stall may stand. */
export function canPlaceStall(b: Bundle, at: readonly [number, number]): boolean {
  const slot = b.map.slots.find((s) => s.id === STALL_SLOT);
  return slot !== undefined && inRect(at[0], at[1], slot) && slotContent(b, slot.id) === undefined;
}

export const PLACE_KIND: Record<Slot['kind'], string> = {
  area: 'Place',
  ruin: 'Ruin',
  npc: 'Landmark',
  building: 'Building',
  restore: 'Crossing',
  camp: 'Camp',
  resource: 'Ground',
};

/** Eight-point direction from one tile to another, in words a walk can use. */
export function directionOf(from: readonly [number, number], to: readonly [number, number]): string {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) return 'Beside you';
  const ns = dy < 0 ? 'north' : 'south';
  const ew = dx < 0 ? 'west' : 'east';
  if (Math.abs(dx) <= 2) return ns;
  if (Math.abs(dy) <= 2) return ew;
  return `${ns}-${ew}`;
}

/** What the local save carries for the map; a server session has no such fields yet. */
export interface LocalMapState {
  seen: ReadonlySet<string>;
  seenChunks: ReadonlySet<string>;
  stall?: string;
}

/** The map's local state, when the session is the one that keeps a save. */
export function localMapState(s: unknown): LocalMapState | undefined {
  const m = s as Partial<LocalMapState>;
  return m.seen instanceof Set && m.seenChunks instanceof Set
    ? { seen: m.seen, seenChunks: m.seenChunks, stall: typeof m.stall === 'string' ? m.stall : undefined }
    : undefined;
}

/** A map region the player has entered (G66): drawn as its whole footprint, never as the tiles walked. */
export interface MapRegion {
  /** the place id, `${map.id}/${region.id}` */
  id: string;
  title: string;
  cells: readonly (readonly [number, number, number, number])[];
  /** the centre of the first cell, in tiles: where the name stands */
  x: number;
  y: number;
  current: boolean;
}

/** The regions of the map named in the player's seen list, in map order; ids that are no region are skipped. */
export function seenRegions(b: Bundle, seen: readonly string[] | undefined, at: readonly [number, number]): MapRegion[] {
  const out: MapRegion[] = [];
  if (!seen?.length) return out;
  const known = new Set(seen);
  const here = regionAt(b.map, at[0], at[1]);
  for (const region of b.map.regions ?? []) {
    const id = `${b.map.id}/${region.id}`;
    const title = placeName(b.map, id);
    if (!known.has(id) || title === undefined) continue;
    const [cx, cy, cw, ch] = region.cells[0]!;
    out.push({ id, title, cells: region.cells, x: cx + cw / 2, y: cy + ch / 2, current: here === region });
  }
  return out;
}
