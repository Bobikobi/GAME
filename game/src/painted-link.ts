/**
 * The private preview's way out of the valley (tracker #33), pure so a test can hold it: which cells of a scene are walkable pieces, and the cut that joins the valley's east lane to the
 * scene's west end. The mount (painted.ts) puts the cut into its in-memory map; nothing of the valley's content changes.
 */
import type { MapDef } from '@game/kernel';

/** The walkable cell of a scene's walk map. */
export const walkableCell = (c: string | undefined): boolean => c === '.';

export interface CellsOf {
  cols: number;
  rows: number;
  cells: string[];
}

/** The walkable pieces of a scene's cells (four-way), largest first. */
export function piecesOf(scene: CellsOf): [number, number][][] {
  const { cols, rows } = scene;
  const free = (x: number, y: number): boolean => walkableCell(scene.cells[y]?.[x]);
  const seen = new Set<string>();
  const all: [number, number][][] = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (!free(x, y) || seen.has(`${x},${y}`)) continue;
      const piece: [number, number][] = [[x, y]];
      seen.add(`${x},${y}`);
      for (let i = 0; i < piece.length; i++) {
        const [cx, cy] = piece[i] as [number, number];
        for (const [nx, ny] of [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]] as const) {
          if (!free(nx, ny) || seen.has(`${nx},${ny}`)) continue;
          seen.add(`${nx},${ny}`);
          piece.push([nx, ny]);
        }
      }
      all.push(piece);
    }
  }
  return all.sort((a, b) => b.length - a.length);
}

/**
 * The preview's way out of the valley: the east lane's nook (x 46, y 21 to 23, in the valley's own map) is cut east through the hills along one row to the scene's
 * west end, so a figure walks from the valley into the picture. `from` is the lane's last open tile; the cut leaves the valley at `y` and turns to the row of `to`
 * (the scene's cell nearest its west edge in its largest walkable piece) on the column `turn`. Only the in-memory map changes; nothing of the valley's content does.
 */
/** The slot of the valley's old bridge (content/core/restores/old-bridge.json). */
export const BRIDGE_SLOT = 'core/old-bridge';
export const LINK_FROM: [number, number] = [46, 22];
export function linkOf(raw: Pick<MapDef, 'width' | 'slots'>, scene: CellsOf): { to: [number, number]; cut: [number, number][] } | undefined {
  const best = piecesOf(scene)[0];
  if (!best) return undefined;
  const to = best.reduce((a, b) => (b[0] < a[0] || (b[0] === a[0] && Math.abs(b[1] - (LINK_FROM[1] - 1)) < Math.abs(a[1] - (LINK_FROM[1] - 1))) ? b : a), best[0] as [number, number]);
  const x0 = raw.width + 1;
  const ty = 1 + to[1];
  const turn = raw.width - 2;
  const cut: [number, number][] = [];
  // the river wall (x 13 to 15, the whole map high) is crossed by the old bridge, which a player restores with a keystone; the preview has no such errand, so the bridge's tiles are open path
  const bridge = raw.slots.find((s) => s.id === BRIDGE_SLOT);
  if (bridge) for (let y = bridge.y; y < bridge.y + bridge.h; y++) for (let x = bridge.x; x < bridge.x + bridge.w; x++) cut.push([x, y]);
  for (let x = LINK_FROM[0] + 1; x <= turn; x++) cut.push([x, LINK_FROM[1]]);
  for (let y = Math.min(LINK_FROM[1], ty); y <= Math.max(LINK_FROM[1], ty); y++) cut.push([turn, y]);
  for (let x = turn; x < x0 + to[0]; x++) cut.push([x, ty]);
  return { to, cut };
}
