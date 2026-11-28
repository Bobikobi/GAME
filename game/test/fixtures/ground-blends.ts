import { join } from 'node:path';
import { frameRect } from '@game/kernel';
import { CONTENT_DIR } from '../../../tools/src/load';
import { loadPixelBundle } from '../../../tools/test/helpers/world';
import { readPng } from '../../../tools/src/pngcache';
import { hash, remapTone, toneField } from '../../src/richground';
import { deepTile } from '../../src/waterbody';
import { BANK_EDGE, EDGE_PX, PATH_EDGE, WATER_EDGE, WOOD_EDGE, blendEdgeTile, needsBlend, type PathAt } from './legacy-pathedge';

const neighbours = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]] as const;
const pairs = [
  ['path', 'meadow', PATH_EDGE], ['sand', 'meadow', BANK_EDGE], ['grove', 'meadow', WOOD_EDGE],
  ['path', 'sand', BANK_EDGE], ['path', 'grove', WOOD_EDGE], ['sand', 'water', WATER_EDGE],
  ['meadow', 'water', WATER_EDGE], ['grove', 'water', WATER_EDGE], ['path', 'water', WATER_EDGE],
] as const;
const base = (ref: string) => ref.split('/').pop();

/** The tile ground's edges sampled on the frozen pixel valley: an engine rule's bytes, not the shipped map's (the painted valley draws its own ground). */
export function openingGround() {
  const bundle = loadPixelBundle();
  const { map, sprites } = bundle;
  const at = (x: number, y: number) => map.legend[map.ground[y]?.[x] ?? ''];
  const kindOf = (tile: ReturnType<typeof at>) => tile && (base(tile.sprite) === 'sand' ? 'sand' : tile.tag);
  const tones = toneField(map.width, map.height, (x, y) => at(x, y)?.tag === 'meadow');
  const withVariants = (ref: string) => [ref, ...[1, 2, 3].map((i) => ref + '_' + i).filter((r) => r in sprites)];
  const grass = Object.values(map.legend).find((tile) => tile.tag === 'meadow' && base(tile.sprite) === 'grass');
  const grassSprites = grass ? withVariants(grass.sprite) : [];
  const frames = (ref: string) => sprites[ref]?.frames ?? 1;
  const sourceCache = new Map<string, Uint8ClampedArray>();
  const pixels = (ref: string, frame: number): Uint8ClampedArray | null => {
    const [id = ref, tone] = ref.split('#tone');
    const sprite = sprites[id];
    if (sprite?.w !== EDGE_PX || sprite.h !== EDGE_PX || (tone && sprite.frames > 1)) return null;
    const f = frame % sprite.frames;
    const key = ref + '@' + f;
    const hit = sourceCache.get(key);
    if (hit) return hit;
    const png = readPng(join(CONTENT_DIR, 'kit/core', sprite.url.split('/').slice(3).join('/')));
    const cut = frameRect(sprite, f);
    const out = new Uint8ClampedArray(EDGE_PX * EDGE_PX * 4);
    for (let y = 0; y < EDGE_PX; y++) {
      const i = ((cut.y + y) * png.width + cut.x) * 4;
      out.set(png.data.subarray(i, i + EDGE_PX * 4), y * EDGE_PX * 4);
    }
    if (tone === '1' || tone === '2') remapTone(out, EDGE_PX, Number(tone) as 1 | 2, EDGE_PX);
    sourceCache.set(key, out);
    return out;
  };
  const edges = pairs.map(([a, b, look]) => {
    // Legacy samples this field for each pixel. Resolve each ground symbol's side once per pair.
    const sides = new Map(Object.entries(map.legend).map(([symbol, tile]) => {
      const kind = kindOf(tile);
      return [symbol, kind === a ? 1 : kind === b ? 0 : undefined] as const;
    }));
    const rows = map.ground.map((row) => row.split('').map((symbol) => sides.get(symbol)));
    const sideAt: PathAt = (x, y) => rows[y]?.[x];
    return { a, b, look, at: sideAt };
  });

  // Use the opening's selected variants, sand, meadow tones and actual neighbours.
  const tiles = [];
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const tile = at(x, y);
      const kind = kindOf(tile);
      if (!tile || !kind) continue;
      const h = hash(x, y);
      const variants = withVariants(tile.sprite).slice(1);
      const picked = variants.length && h % 100 < 40 ? variants[Math.floor(h / 100) % variants.length]! : tile.sprite;
      const dark = tile.tag === 'ruin' && base(tile.sprite) === 'sand' ? picked.replace(/tiles\/sand(?=_\d|$)/, 'tiles/sand_ruin') : picked;
      const sprite = dark in sprites ? dark : picked;
      const tone = tones[y * map.width + x] ?? 0;
      const key = kind === 'meadow' && tone ? sprite + '#tone' + tone : sprite;
      const touching = edges.flatMap((edge) => {
        const own = edge.at(x, y);
        if (own === undefined || !needsBlend(x, y, edge.at, own)) return [];
        const side = own === 1 ? edge.b : edge.a;
        const near = neighbours.map(([dx, dy]) => at(x + dx, y + dy)).find((t) => kindOf(t) === side);
        if (!near) return [];
        const others = side === 'meadow' ? grassSprites : withVariants(near.sprite);
        const other = others[(h >>> 3) % others.length];
        return other ? [{ ...edge, own, other }] : [];
      });
      if (touching.length) tiles.push({ x, y, sprite, key, touching });
    }
  }

  type Tile = (typeof tiles)[number];
  // The pre-change world.ts blendTile and paint chain, running the original compositor for each frame.
  function legacy(tile: Tile, frame: number): Uint8ClampedArray | null {
    const { x, y, key } = tile;
    let water: Uint8ClampedArray | undefined;
    const read = (ref: string) => {
      if (!/^water(_\d+)?$/.test(base(ref) ?? '')) return pixels(ref, frame);
      if (!water) {
        water = new Uint8ClampedArray(EDGE_PX * EDGE_PX * 4);
        deepTile(x, y, frame, water, EDGE_PX);
      }
      return water;
    };
    let cur: Uint8ClampedArray | null = null;
    for (const edge of tile.touching) {
      const mine = cur ?? read(key);
      const theirs = read(edge.other);
      if (!mine || !theirs) continue;
      cur = new Uint8ClampedArray(EDGE_PX * EDGE_PX * 4);
      blendEdgeTile(x, y, edge.at, edge.own, edge.own ? mine : theirs, edge.own ? theirs : mine, cur, edge.look);
    }
    return cur;
  }

  return { tiles, at, grassSprites, withVariants, frames, pixels, legacy };
}
