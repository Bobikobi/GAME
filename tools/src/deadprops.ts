/**
 * No prop may look usable without being usable (owner, 10.10: trees that look
 * choppable but are not, a lying log that cannot be taken). A sprite that a
 * resource node, a restoration or a camp part wears - grown, empty or young -
 * is the look of something to work. A map prop wearing one of them is scenery
 * that lies about itself: make it a node (a resource slot, or `place.scatter`)
 * or give it a look that reads as scenery.
 */
import type { Bundle } from '@game/kernel';
import type { Issue } from './load';

export function checkDeadProps(b: Bundle, origin: Record<string, string>): Issue[] {
  const usable = new Map<string, string>();
  const note = (sprite: string | undefined, owner: string) => {
    if (sprite !== undefined && !usable.has(sprite)) usable.set(sprite, owner);
  };
  for (const [id, r] of Object.entries(b.resources)) {
    note(r.sprite, id);
    note(r.sprite_empty, id);
    r.growth?.forEach((g) => note(g, id));
  }
  for (const [id, r] of Object.entries(b.restores)) {
    note(r.before, id);
    note(r.after, id);
  }
  for (const [id, c] of Object.entries(b.camps)) note(c.sprite, id);

  const file = origin[b.map.id] ?? 'content';
  const issues: Issue[] = [];
  b.map.props.forEach((p, i) => {
    const owner = usable.get(p.sprite);
    if (owner === undefined) return;
    issues.push({
      file,
      where: `map.props.${i}`,
      message: `the prop at (${p.x}, ${p.y}) wears ${p.sprite}, the look of "${owner}", but nothing can be done with it: make it a node of "${owner}" (a resource slot or place.scatter) or give it a scenery sprite`,
      level: 'error',
    });
  });
  // a scatter slot that finds no open tile would leave the prop gone and nothing in its place
  for (const [id, r] of Object.entries(b.resources)) {
    for (const slotId of r.place.scatter ?? []) {
      const slot = b.map.slots.find((s) => s.id === slotId);
      if (!slot) continue;
      const has = Object.values(b.instances).some(
        (n) => n.source === id && n.x >= slot.x && n.x < slot.x + slot.w && n.y >= slot.y && n.y < slot.y + slot.h,
      );
      if (!has) issues.push({ file, where: `map.slots.${slotId}`, message: `"${slotId}" is a scatter slot of "${id}" but holds no node: it needs one open tile that is not a path or a solid prop`, level: 'error' });
    }
  }
  return issues;
}
