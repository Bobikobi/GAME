/**
 * Cuts a generated land into the world's 64 by 64 chunk files (OPEN_WORLD G50-G52): the ground rows, the level
 * digits, the props in chunk coordinates, and the creature spots the spawner placed in the chunk, in its
 * coordinates too (a patrol's route stays in world tiles, so a beat may cross a seam). A prop stands in the chunk
 * its tile is in; a footprint is one tile, so none straddles a seam. The land below is cut the same way, at its own
 * chunks. The files pass `chunkProblems` and the chunk schema; the test proves both.
 */
import type { ChunkFile } from '@game/schema';
import { CHUNK_SIZE } from '../chunks';
import type { Land } from './grid';
import type { Generated } from './land';
import type { Spawn } from './spawn';

type Spot = NonNullable<ChunkFile['chunk']['spawns']>[number];

/** The most spots a chunk file may hold (the schema's cap); the spawner's own caps keep a land well under it. */
export const SPOTS_PER_CHUNK = 64;

/** The spot a spawn becomes: the kind and leader already content ids, a regular spot without its rank, the rest with their axes. */
export function spotOf(sp: Spawn, x0: number, y0: number): Spot {
  const spot: Spot = { kind: sp.kind, x: sp.x - x0, y: sp.y - y0 };
  if (sp.rank !== 'regular') spot.rank = sp.rank;
  spot.shape = sp.shape;
  spot.count = sp.count;
  if (sp.affixes.length > 0) spot.affixes = sp.affixes;
  if (sp.leader) spot.leader = sp.leader;
  if (sp.route && sp.route.length >= 2) spot.route = sp.route.map(([x, y]) => [x, y]);
  return spot;
}

export function cut(gen: Generated, spawns: readonly Spawn[] = []): ChunkFile[] {
  const { story } = gen;
  const name = story.id.split('/')[1]!;
  const out = cutLand(gen.land, spawns, name, story.title, story.id, story.seed);
  if (gen.below) out.push(...cutLand(gen.below.land, [], name, `${story.title}, below`, story.id, story.seed));
  return out;
}

function cutLand(land: Land, spawns: readonly Spawn[], name: string, title: string, storyId: string, seed: string): ChunkFile[] {
  const out: ChunkFile[] = [];
  for (let y0 = land.y0; y0 < land.y0 + land.h; y0 += CHUNK_SIZE) {
    for (let x0 = land.x0; x0 < land.x0 + land.w; x0 += CHUNK_SIZE) {
      const cx = x0 / CHUNK_SIZE;
      const cy = y0 / CHUNK_SIZE;
      const grounds: string[] = [];
      const levels: string[] = [];
      for (let y = y0; y < y0 + CHUNK_SIZE; y++) {
        grounds.push(land.ground[y - land.y0]!.slice(x0 - land.x0, x0 - land.x0 + CHUNK_SIZE));
        let row = '';
        for (let x = x0; x < x0 + CHUNK_SIZE; x++) row += String(Math.min(9, land.level(x, y)));
        levels.push(row);
      }
      const inChunk = (p: { x: number; y: number }) => p.x >= x0 && p.x < x0 + CHUNK_SIZE && p.y >= y0 && p.y < y0 + CHUNK_SIZE;
      const props = land.props
        .filter(inChunk)
        .map((p) => ({ ...p, x: p.x - x0, y: p.y - y0 }))
        .sort((a, b) => a.y - b.y || a.x - b.x);
      const spots = spawns
        .filter(inChunk)
        .sort((a, b) => a.y - b.y || a.x - b.x)
        .slice(0, SPOTS_PER_CHUNK)
        .map((sp) => spotOf(sp, x0, y0));
      const file: ChunkFile = {
        $schema: '../../../schema/json/chunk.schema.json',
        format: 1,
        type: 'chunk',
        id: `core/${name}-${cx}-${cy}`,
        title: `${title} ${cx},${cy}`,
        creator: 'core',
        description: `Generated from the story ${storyId} with the seed word "${seed}". Do not edit by hand: run pnpm gen.`,
        chunk: { x: x0, y: y0, grounds, levels, props, stamps: [], ...(spots.length > 0 ? { spawns: spots } : {}) },
      };
      out.push(file);
    }
  }
  return out;
}
