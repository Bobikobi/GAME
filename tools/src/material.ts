/** Small readings of the material grammar that more than one check shares. */
import type { Bundle } from '@game/kernel';
import { BASE_CLASSES } from '@game/schema';

/** The base class of a class: itself, or the base it was declared under. */
export function baseOf(b: Bundle, cls: string | undefined): string | undefined {
  return cls === undefined ? undefined : (BASE_CLASSES as readonly string[]).includes(cls) ? cls : b.classes[cls]?.base;
}

/** Is this item wood, by its class? */
export function isWood(b: Bundle, itemId: string): boolean {
  return baseOf(b, b.items[itemId]?.class) === 'wood';
}

/** Is this item a tool of the given kind? */
export function isTool(b: Bundle, itemId: string, kind: string): boolean {
  return b.items[itemId]?.tool?.kind === kind;
}
