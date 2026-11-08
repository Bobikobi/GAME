/**
 * Cuts a generated land into the world's 64 by 64 chunk files (OPEN_WORLD G50-G52): the ground rows, the level
 * digits, the props in chunk coordinates. A prop stands in the chunk its tile is in; a footprint is one tile, so
 * none straddles a seam. The files pass `chunkProblems` and the chunk schema; the test proves both.
 */
import type { ChunkFile } from '@game/schema';
import { CHUNK_SIZE } from '../chunks';
import type { Generated } from './land';

export function cut(gen: Generated): ChunkFile[] {
  const { land, story } = gen;
  const name = story.id.split('/')[1]!;
  const out: ChunkFile[] = [];
  for (let cy = 0; cy < story.size.h; cy++) {
    for (let cx = 0; cx < story.size.w; cx++) {
      const x0 = land.x0 + cx * CHUNK_SIZE;
      const y0 = land.y0 + cy * CHUNK_SIZE;
      const grounds: string[] = [];
      const levels: string[] = [];
      for (let y = y0; y < y0 + CHUNK_SIZE; y++) {
        grounds.push(land.ground[y - land.y0]!.slice(x0 - land.x0, x0 - land.x0 + CHUNK_SIZE));
        let row = '';
        for (let x = x0; x < x0 + CHUNK_SIZE; x++) row += String(Math.min(9, land.level(x, y)));
        levels.push(row);
      }
      const props = land.props
        .filter((p) => p.x >= x0 && p.x < x0 + CHUNK_SIZE && p.y >= y0 && p.y < y0 + CHUNK_SIZE)
        .map((p) => ({ ...p, x: p.x - x0, y: p.y - y0 }))
        .sort((a, b) => a.y - b.y || a.x - b.x);
      const file: ChunkFile = {
        $schema: '../../../schema/json/chunk.schema.json',
        format: 1,
        type: 'chunk',
        id: `core/${name}-${story.origin.cx + cx}-${story.origin.cy + cy}`,
        title: `${story.title} ${story.origin.cx + cx},${story.origin.cy + cy}`,
        creator: 'core',
        description: `Generated from the story ${story.id} with the seed word "${story.seed}". Do not edit by hand: run pnpm gen.`,
        chunk: { x: x0, y: y0, grounds, levels, props, stamps: [] },
      };
      out.push(file);
    }
  }
  return out;
}
