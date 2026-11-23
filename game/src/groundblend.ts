import { BANK_EDGE, EDGE_PX, PATH_EDGE, WATER_EDGE, WOOD_EDGE, prepareEdgeTile, type PathAt } from './pathedge';
import { hash } from './richground';
import { deepTile } from './waterbody';

type GroundTile = { sprite: string; tag: string };
type Pixels = Uint8ClampedArray | null;
export type TileBlend = (frame: number) => Pixels;

const NEIGHBOURS = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]] as const;
const EDGES = [
  ['path', 'meadow', PATH_EDGE],
  ['sand', 'meadow', BANK_EDGE],
  ['grove', 'meadow', WOOD_EDGE],
  ['path', 'sand', BANK_EDGE],
  ['path', 'grove', WOOD_EDGE],
  ['sand', 'water', WATER_EDGE],
  ['meadow', 'water', WATER_EDGE],
  ['grove', 'water', WATER_EDGE],
  ['path', 'water', WATER_EDGE],
] as const;

const kindOf = (tile: GroundTile | undefined): string | undefined =>
  tile?.sprite.split('/').pop() === 'sand' ? 'sand' : tile?.tag;

/** Open water and its variants read the same procedural water at this position. */
export function isOpenWater(ref: string): boolean {
  return /(?:^|\/)water(_\d+)?$/.test(ref);
}

interface PixelSource {
  animated: boolean;
  read: TileBlend;
}

interface BlendStep {
  own: 0 | 1;
  theirs: PixelSource;
  animated: boolean;
  prepare: () => ReturnType<typeof prepareEdgeTile>;
  paint?: ReturnType<typeof prepareEdgeTile>;
  result?: Pixels;
}

/** Resolves each tile's ordered edges once. Keep the resulting blend only while baking its chunk's frames. */
export function groundBlender(
  at: (x: number, y: number) => GroundTile | undefined,
  grassSprites: readonly string[],
  withVariants: (ref: string) => readonly string[],
  spriteFrames: (ref: string) => number,
  spritePixels: (ref: string, frame: number) => Pixels,
): (x: number, y: number, sprite: string, key: string) => TileBlend | undefined {
  const edges = EDGES.map(([a, b, look]) => {
    const sideAt: PathAt = (x, y) => {
      const kind = kindOf(at(x, y));
      return kind === a ? 1 : kind === b ? 0 : undefined;
    };
    return { a, b, look, sideAt };
  });
  return (x, y, sprite, key) => {
    const kind = kindOf(at(x, y));
    const h = hash(x, y);
    const steps: BlendStep[] = [];
    let mine: PixelSource | undefined;
    let animated = false;
    let waterFrame = -1;
    let waterPixels: Uint8ClampedArray | undefined;
    const water: PixelSource = { animated: true, read: (frame) => {
      waterPixels ??= new Uint8ClampedArray(EDGE_PX * EDGE_PX * 4);
      if (frame !== waterFrame) {
        deepTile(x, y, frame, waterPixels, EDGE_PX);
        waterFrame = frame;
      }
      return waterPixels;
    } };
    const source = (ref: string): PixelSource => isOpenWater(ref) ? water : {
      animated: spriteFrames(ref) > 1,
      read: (frame) => spritePixels(ref, frame),
    };
    for (const { a, b, look, sideAt } of edges) {
      if (kind !== a && kind !== b) continue;
      const own = kind === a ? 1 : 0;
      const side = own === 1 ? b : a;
      // Finding the other side within one tile is the needsBlend check.
      const near = NEIGHBOURS.map(([dx, dy]) => at(x + dx, y + dy)).find((t) => kindOf(t) === side);
      if (!near) continue;
      const others = side === 'meadow' ? grassSprites : withVariants(near.sprite);
      const other = others[(h >>> 3) % others.length];
      if (other === undefined) continue;
      mine ??= source(kind === 'meadow' ? key : sprite);
      const theirs = source(other);
      animated ||= mine.animated || theirs.animated;
      steps.push({ own, theirs, animated, prepare: () => prepareEdgeTile(x, y, sideAt, own, look) });
    }
    if (!mine) return undefined;
    const original = mine;
    return (frame) => {
      let cur: Pixels = null;
      for (const step of steps) {
        if (step.result !== undefined) {
          cur = step.result;
          continue;
        }
        const local = cur ?? original.read(frame);
        const other = step.theirs.read(frame);
        if (local && other) {
          const paint = step.paint ?? step.prepare();
          if (step.animated) step.paint = paint;
          cur = new Uint8ClampedArray(EDGE_PX * EDGE_PX * 4);
          if (step.own === 1) paint(local, other, cur);
          else paint(other, local, cur);
        }
        if (!step.animated) step.result = cur;
      }
      return cur;
    };
  };
}
