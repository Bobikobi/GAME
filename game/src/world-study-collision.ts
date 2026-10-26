/** Ground footprints only: a tall drawing may overhang a walkable place behind it. */
export interface WorldStudyTreeFootprint {
  x: number;
  y: number;
  radiusX: number;
  radiusY: number;
}

/** The character's small feet rectangle, rather than its full upright sprite. */
export function worldStudyCanStand(
  x: number, y: number,
  landAt: (x: number, y: number) => boolean,
  trees: readonly WorldStudyTreeFootprint[],
): boolean {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  for (const dx of [-6, 6]) for (const dy of [-4, 4]) if (!landAt(x + dx, y + dy)) return false;
  return !trees.some(tree => {
    // Closest point of the feet rectangle to the root ellipse, including edge contact.
    const dx = Math.max(0, Math.abs(x - tree.x) - 6);
    const dy = Math.max(0, Math.abs(y - tree.y) - 4);
    return (dx / tree.radiusX) ** 2 + (dy / tree.radiusY) ** 2 <= 1;
  });
}
