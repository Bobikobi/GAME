/**
 * The ways through (OPEN_WORLD, the map generator's hidden doors and the ways back up). A way is a non-solid
 * prop with an id whose `portal` names a world tile a player can stand on. The kernel takes one way per step
 * and never chains them, so a far tile on another way's footprint is refused here: a creator who wrote one
 * meant a chain, and lands the player beside the way instead.
 */
import { type Bundle, inRect, makeWalkable } from '@game/kernel';
import type { Issue } from './load';

export function checkPortals(b: Bundle, origin: Record<string, string>): Issue[] {
  const issues: Issue[] = [];
  const file = origin[b.map.id] ?? 'content';
  const err = (where: string, message: string) => issues.push({ file, where, message, level: 'error' });
  const ways = b.map.props.filter((p) => p.portal !== undefined);
  if (ways.length === 0) return issues;
  const walkable = makeWalkable(b);
  const view = { restored: Object.values(b.restores).filter((r) => r.passable).map((r) => r.id), camp: [] as string[] };
  b.map.props.forEach((p, i) => {
    if (p.portal === undefined) return;
    const where = `map.props.${i}`;
    const name = p.id ?? `the way at (${p.x}, ${p.y})`;
    if (p.id === undefined) err(where, `${name} needs an id: the step that goes through it names it`);
    if (p.solid) err(where, `${name} is solid: a way is stepped onto, so it cannot block the tile`);
    const { x, y } = p.portal;
    if (x >= b.map.width || y >= b.map.height) err(where, `${name} leads to (${x}, ${y}), outside the map of ${b.map.width} by ${b.map.height}`);
    else if (inRect(x, y, p)) err(where, `${name} leads onto its own tile`);
    else if (!walkable(x, y, view)) err(where, `${name} leads to (${x}, ${y}), where nobody can stand`);
    else {
      const other = ways.find((q) => q !== p && inRect(x, y, q));
      if (other) err(where, `${name} leads onto another way, ${other.id ?? `the way at (${other.x}, ${other.y})`}: one way per step, land the player beside it`);
    }
  });
  return issues;
}
