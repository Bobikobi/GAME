import layoutJson from '../../docs/design/frames/rich-world-expansion-2026-10-26/layout.json';

/** This visual fixture uses art pixels directly; it is not a gameplay/kernel map. */
export const WORLD_TILE_SIZE = 64;
export type WorldStudyMaterial = 'meadow' | 'forest' | 'path' | 'paving' | 'worn' | 'sand';
/** Integer tile indices. For spawn, viewpoints and path points, the location is the tile centre. */
export interface WorldStudyPoint { x: number; y: number }
export interface WorldStudyViewpoint extends WorldStudyPoint {
  id: 'meadow' | 'forest' | 'cove' | 'shore' | 'paving' | 'worn' | 'sand';
  label: string;
}
export interface WorldStudyRegion extends WorldStudyPoint {
  material: 'forest' | 'paving' | 'worn' | 'sand';
  width: number;
  height: number;
}
export interface WorldStudyLayout {
  width: number;
  height: number;
  /** Land vertices: height + 1 rows, each width + 1 characters; 1 is land and 0 is water. */
  corners: string[];
  spawn: WorldStudyPoint;
  viewpoints: WorldStudyViewpoint[];
  /** Width is in tiles. Adjacent points form a continuous centre line. */
  path: { width: number; points: WorldStudyPoint[]; branches?: WorldStudyPoint[][] };
  /** Authored material patches; the renderer blends their boundaries into the surrounding field. */
  regions: WorldStudyRegion[];
}

export const worldStudyLayout = layoutJson as WorldStudyLayout;

/** Existing shore atlas orientation: top-left 1, top-right 2, bottom-right 4, bottom-left 8. */
export function worldStudyMask(tx: number, ty: number): number {
  const { width, height, corners } = worldStudyLayout;
  if (!Number.isInteger(tx) || !Number.isInteger(ty) || tx < 0 || ty < 0 || tx >= width || ty >= height) return 0;
  return Number(corners[ty]![tx] === '1')
    + Number(corners[ty]![tx + 1] === '1') * 2
    + Number(corners[ty + 1]![tx + 1] === '1') * 4
    + Number(corners[ty + 1]![tx] === '1') * 8;
}

/** Conservative placement/walking query: all four vertices must be land. Partial banks still draw via mask > 0. */
export function worldStudyLandTile(tx: number, ty: number): boolean {
  return worldStudyMask(tx, ty) === 15;
}

/** Shortest distance in world/art pixels from a point to the authored winding path centre line. */
export function worldStudyPathDistance(x: number, y: number): number {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return Infinity;
  let distanceSquared = Infinity;
  for (const points of [worldStudyLayout.path.points, ...worldStudyLayout.path.branches ?? []]) for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!, b = points[i]!;
    const ax = (a.x + .5) * WORLD_TILE_SIZE, ay = (a.y + .5) * WORLD_TILE_SIZE;
    const bx = (b.x + .5) * WORLD_TILE_SIZE, by = (b.y + .5) * WORLD_TILE_SIZE;
    const dx = bx - ax, dy = by - ay;
    const lengthSquared = dx * dx + dy * dy;
    const along = lengthSquared ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / lengthSquared)) : 0;
    distanceSquared = Math.min(distanceSquared, (x - ax - along * dx) ** 2 + (y - ay - along * dy) ** 2);
  }
  return Math.sqrt(distanceSquared);
}

/** Centre-material selection only. The renderer owns ragged transitions and the shoreline alpha. */
export function worldStudyMaterial(x: number, y: number): WorldStudyMaterial {
  for (const region of worldStudyLayout.regions) {
    if (region.material !== 'forest' && worldStudyRegionInset(region, x, y) >= 0) return region.material;
  }
  if (worldStudyPathDistance(x, y) <= worldStudyLayout.path.width * WORLD_TILE_SIZE / 2) return 'path';
  for (const region of worldStudyLayout.regions) {
    if (region.material !== 'forest') continue;
    if (x >= region.x * WORLD_TILE_SIZE && y >= region.y * WORLD_TILE_SIZE
      && x < (region.x + region.width) * WORLD_TILE_SIZE && y < (region.y + region.height) * WORLD_TILE_SIZE) return region.material;
  }
  return 'meadow';
}

/** Signed distance inside a rounded material patch; independent of art and walking/shore masks. */
export function worldStudyRegionInset(region: WorldStudyRegion, x: number, y: number): number {
  const halfWidth = region.width * WORLD_TILE_SIZE / 2, halfHeight = region.height * WORLD_TILE_SIZE / 2;
  const radius = Math.min(WORLD_TILE_SIZE, halfWidth, halfHeight);
  const dx = Math.abs(x - (region.x * WORLD_TILE_SIZE + halfWidth)) - halfWidth + radius;
  const dy = Math.abs(y - (region.y * WORLD_TILE_SIZE + halfHeight)) - halfHeight + radius;
  return radius - Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) - Math.min(Math.max(dx, dy), 0);
}
