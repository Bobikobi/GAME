import family from '../../docs/art/families/rich-world-oak.json';

export const worldStudyTreeFamily = family;

/** The study and offline checker consume the same family selection and placement data. */
export function worldStudyTreePlacement(variant: number, x: number, y: number) {
  const id = family.sceneAssets[variant % family.sceneAssets.length]!;
  const asset = family.assets.find(a => a.id === id);
  if (!asset || asset.review.status !== 'approved') throw new Error(`Unapproved world-study tree: ${id}`);
  const c = family.contract;
  const height = c.heights[(variant >>> 12) % c.heights.length]!;
  const width = Math.round(height * asset.frame[0]! / asset.frame[1]! * c.widthScales[(variant >>> 17) % c.widthScales.length]!);
  return {
    id, width, height, flipX: c.mirror && Boolean((variant >>> 8) & 1),
    originX: c.origin[0]!, originY: c.origin[1]!,
    footprint: { x, y: y - c.root.offsetY * height, radiusX: width * c.root.radiusX, radiusY: height * c.root.radiusY },
  };
}
