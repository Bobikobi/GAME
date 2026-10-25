/** The open world's chunk and stamp (NEXT section 19 a): a 64 by 64 block that parses and serializes byte-identically, a stamp whose missing height keeps 0, and height digits that refuse anything but 0 to 9. */
import { readFileSync } from 'node:fs';
import { Value } from '@sinclair/typebox/value';
import { describe, expect, it } from 'vitest';

import { ChunkFile, MapBody, Stamp, validateFile } from '../src/index';

const GROUND_ROW = '.'.repeat(64);
const ZERO_ROW = '0'.repeat(64);

const chunk = () => ({
  $schema: '../../schema/json/chunk.schema.json',
  format: 1,
  type: 'chunk',
  id: 'core/chunk-0-0',
  title: 'Chunk (0, 0)',
  creator: 'core',
  chunk: {
    x: 0,
    y: 0,
    grounds: Array.from({ length: 64 }, () => GROUND_ROW),
    levels: [ZERO_ROW, ...Array.from({ length: 63 }, () => '1'.repeat(64))],
    props: [{ sprite: 'core/base-kit:props/oak', x: 3, y: 4, w: 2, h: 2, solid: true }],
    stamps: [
      {
        id: 'core/boathouse',
        x: 40,
        y: 40,
        grounds: ['..', '..'],
        props: [{ sprite: 'core/base-kit:props/boathouse', x: 0, y: 0, w: 2, h: 2, solid: true }],
        slots: [{ id: 'core/boathouse-keeper', kind: 'npc', x: 0, y: 0, w: 1, h: 1 }],
      },
    ],
  },
});

type ChunkSample = ReturnType<typeof chunk>;

describe('the chunk file', () => {
  it('parses and serializes byte-identically', () => {
    const text = `${JSON.stringify(chunk(), null, 2)}\n`;
    const parsed = JSON.parse(text);
    expect(validateFile(parsed)).toEqual([]);
    expect(Value.Check(ChunkFile, parsed)).toBe(true);
    expect(`${JSON.stringify(parsed, null, 2)}\n`).toBe(text);
  });

  it('keeps format version 1, and a chunk without levels still validates', () => {
    const bare = chunk();
    delete (bare.chunk as { levels?: unknown }).levels;
    expect(bare.format).toBe(1);
    expect(validateFile(bare)).toEqual([]);
  });

  it('is a 64 by 64 block: a row of another length, a missing row and a 65th row are all refused', () => {
    const shrink = (c: ChunkSample) => {
      c.chunk.grounds[0] = '.'.repeat(63);
    };
    const grow = (c: ChunkSample) => {
      c.chunk.grounds[0] = '.'.repeat(65);
    };
    const fewer = (c: ChunkSample) => {
      c.chunk.grounds = c.chunk.grounds.slice(0, 63);
    };
    const more = (c: ChunkSample) => {
      c.chunk.grounds = [...c.chunk.grounds, GROUND_ROW];
    };
    for (const mutate of [shrink, grow, fewer, more]) {
      const bad = chunk();
      mutate(bad);
      expect(Value.Check(ChunkFile, bad)).toBe(false);
    }
  });

  it('refuses a chunk whose corner is not on the grid of 64', () => {
    const off = chunk();
    off.chunk.x = 64 + 1;
    expect(Value.Check(ChunkFile, off)).toBe(false);
  });
});

describe('the stamp', () => {
  it('with no height keeps 0', () => {
    const stamp: { id: string; x: number; y: number; height?: number } = { id: 'core/boathouse', x: 40, y: 40 };
    expect(Value.Check(Stamp, stamp)).toBe(true);
    expect(stamp.height ?? 0).toBe(0);
    // the emitted schema says so too, so a reader knows the default
    const emitted = JSON.parse(readFileSync(new URL('../json/chunk.schema.json', import.meta.url), 'utf8')) as {
      properties: { chunk: { properties: { stamps: { items: { properties: { height: { default: number } } } } } } };
    };
    expect(emitted.properties.chunk.properties.stamps.items.properties.height.default).toBe(0);
  });

  it('accepts a level from 0 to 9 and refuses anything else', () => {
    for (const h of [0, 3, 9]) expect(Value.Check(Stamp, { id: 'core/boathouse', x: 0, y: 0, height: h })).toBe(true);
    for (const bad of [10, -1, 1.5, '2']) expect(Value.Check(Stamp, { id: 'core/boathouse', x: 0, y: 0, height: bad })).toBe(false);
  });
});

describe('the height layer', () => {
  const valley = JSON.parse(readFileSync(new URL('../../content/core/map.json', import.meta.url), 'utf8')) as {
    map: { width: number; height: number; levels?: unknown };
  };

  it('is optional on a map: the valley of today validates without it', () => {
    expect(validateFile(valley)).toEqual([]);
  });

  it('takes one digit 0 to 9 per tile, and refuses anything else', () => {
    const rows = Array.from({ length: valley.map.height }, () => '0'.repeat(valley.map.width));
    expect(Value.Check(MapBody, { ...valley.map, levels: rows })).toBe(true);
    rows[0] = `a${rows[0]!.slice(1)}`;
    expect(Value.Check(MapBody, { ...valley.map, levels: rows })).toBe(false);
  });

  it('in a chunk: 64 digits a row, and a letter anywhere refuses the chunk', () => {
    const good = chunk();
    expect(Value.Check(ChunkFile, good)).toBe(true);
    const letter = chunk();
    letter.chunk.levels[7] = `${letter.chunk.levels[7]!.slice(0, 30)}x${letter.chunk.levels[7]!.slice(31)}`;
    expect(Value.Check(ChunkFile, letter)).toBe(false);
  });
});
