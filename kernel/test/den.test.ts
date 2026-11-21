/**
 * A den's bolt hole (docs/design/HUNT_FAMILIES.md section 3.1; kernel/src/wild/den.ts): the candidates lie in the
 * squared ring of wild.bolt_min_tiles to wild.bolt_max_tiles round the mouth, on open habitat the burrower reaches,
 * in ring order; the server's keyed draw `bolt:<anchor id>` picks one, the same every time for the same content (the
 * step that lays the anchor stores it, HUNT_FAMILIES 3.1). A ring tile cut off from the mouth by water or a cliff is
 * never a candidate, though a plain scan of the ring would list it.
 */
import { beforeAll, describe, expect, test } from 'vitest';

import { type Bundle, type DenTile, anchorId, boltCandidates, boltHole, draw, ringOrder, staticSolid, tagAt, widenSeed } from '@game/kernel';

import { loadBundle } from '../../tools/test/helpers/world.js';

let b: Bundle;
const HARE = 'core/hare';
/** The core hare den by the west trees: every ring tile of it is reached from the mouth on the shipped map. */
const MOUTH: DenTile = [3, 9];

beforeAll(() => {
  b = loadBundle();
});

/** A copy of the bundle with some ground tiles and levels set; `set` gets the tile and returns its new ground and level. */
function edited(set: (x: number, y: number) => { ground?: string; level?: string } | undefined): Bundle {
  const { map } = b;
  const ground = map.ground.map((row, y) => [...row].map((c, x) => set(x, y)?.ground ?? c).join(''));
  const levels = map.levels?.map((row, y) => [...row].map((c, x) => set(x, y)?.level ?? c).join(''));
  return { ...b, map: { ...map, ground, ...(levels ? { levels } : {}) } };
}

/** The ring scanned with no walk: every open habitat tile at a squared distance of 64 to 100 from the mouth. */
function ringScan(bundle: Bundle, [mx, my]: DenTile, habitat: readonly string[]): DenTile[] {
  const solid = staticSolid(bundle.map);
  const out: DenTile[] = [];
  for (let y = 0; y < bundle.map.height; y++) {
    for (let x = 0; x < bundle.map.width; x++) {
      const d2 = (x - mx) ** 2 + (y - my) ** 2;
      if (d2 >= 64 && d2 <= 100 && solid[y * bundle.map.width + x] === 0 && habitat.includes(tagAt(bundle.map, x, y) ?? '')) out.push([x, y]);
    }
  }
  return out;
}

const key = ([x, y]: DenTile) => `${x},${y}`;
/** A line across the whole ring's box, five tiles south of the mouth: what lies beyond it is the ring's south side. */
const southLine = (x: number, y: number) => y === MOUTH[1] + 5 && Math.abs(x - MOUTH[0]) <= 10;

describe('the bolt hole', () => {
  test('every candidate of the core hares is open meadow 8 to 10 tiles from the mouth, in ring order', () => {
    const solid = staticSolid(b.map);
    const dens = b.map.creatures!.spots.filter((s) => s.kind === HARE);
    expect(dens.length).toBeGreaterThanOrEqual(8);
    for (const s of dens) {
      const list = boltCandidates(b, [s.x, s.y], ['meadow']);
      expect(list.length).toBeGreaterThan(0);
      for (const [x, y] of list) {
        const d2 = (x - s.x) ** 2 + (y - s.y) ** 2;
        expect(d2).toBeGreaterThanOrEqual(64);
        expect(d2).toBeLessThanOrEqual(100);
        expect(solid[y * b.map.width + x]).toBe(0);
        expect(tagAt(b.map, x, y)).toBe('meadow');
      }
      const offsets = list.map(([x, y]) => [x - s.x, y - s.y] as const);
      expect([...offsets].sort(ringOrder)).toEqual(offsets);
    }
  });

  test('ring order: nearer first, then clockwise from north', () => {
    const ring = [
      [-8, 0],
      [0, 8],
      [8, 0],
      [0, -8],
      [6, -6],
    ] as const;
    expect([...ring].sort(ringOrder)).toEqual([
      [0, -8],
      [8, 0],
      [0, 8],
      [-8, 0],
      [6, -6],
    ]);
    expect(ringOrder([3, -7], [7, -3])).toBeLessThan(0);
  });

  test('the server draws it once by its own key: the same tile every time, one of the candidates', () => {
    const seed = widenSeed(20261030);
    const s = b.map.creatures!.spots.find((x) => x.kind === HARE)!;
    const id = anchorId(HARE, s.x, s.y);
    expect(id).toBe(`${HARE}@${s.x},${s.y}`);
    const list = boltCandidates(b, [s.x, s.y], ['meadow']);
    const tile = boltHole(b, seed, id, [s.x, s.y], ['meadow']);
    expect(tile).toEqual(list[draw(seed, `bolt:${id}`, 0) % list.length]);
    expect(boltHole(b, seed, id, [s.x, s.y], ['meadow'])).toEqual(tile);
  });

  test('on the shipped map every ring tile of the west den is reached, so the walk and the plain scan agree', () => {
    expect(boltCandidates(b, MOUTH, ['meadow']).map(key).sort()).toEqual(ringScan(b, MOUTH, ['meadow']).map(key).sort());
  });

  test('a row of water across the ring cuts off its far side: those tiles are never candidates', () => {
    const wet = edited((x, y) => (southLine(x, y) ? { ground: '~' } : undefined));
    const scan = ringScan(wet, MOUTH, ['meadow']);
    const cut = scan.filter(([, y]) => y > MOUTH[1] + 5);
    expect(cut.length).toBeGreaterThan(0);
    const list = boltCandidates(wet, MOUTH, ['meadow']);
    expect(list.map(key).sort()).toEqual(scan.filter(([, y]) => y < MOUTH[1] + 5).map(key).sort());
    for (const tile of cut) expect(list.map(key)).not.toContain(key(tile));
  });

  test('a cliff across the ring with no crossing cuts off its far side too: the height rule gates the walk', () => {
    const cliff = edited((x, y) => (southLine(x, y) ? { level: '4' } : undefined));
    const scan = ringScan(cliff, MOUTH, ['meadow']);
    const cut = scan.filter(([, y]) => y > MOUTH[1] + 5);
    expect(cut.length).toBeGreaterThan(0);
    const list = boltCandidates(cliff, MOUTH, ['meadow']);
    expect(list.map(key).sort()).toEqual(scan.filter(([, y]) => y < MOUTH[1] + 5).map(key).sort());
    for (const tile of cut) expect(list.map(key)).not.toContain(key(tile));
  });

  test('a ring of water round the mouth leaves no bolt hole, though the plain scan still finds open meadow', () => {
    const moat = edited((x, y) => (Math.max(Math.abs(x - MOUTH[0]), Math.abs(y - MOUTH[1])) === 5 ? { ground: '~' } : undefined));
    expect(ringScan(moat, MOUTH, ['meadow']).length).toBeGreaterThan(0);
    expect(boltCandidates(moat, MOUTH, ['meadow'])).toEqual([]);
    expect(boltHole(moat, widenSeed(1), anchorId(HARE, ...MOUTH), MOUTH, ['meadow'])).toBeUndefined();
  });

  test('a mouth with no open habitat in the ring has no bolt hole', () => {
    const s = b.map.creatures!.spots.find((x) => x.kind === HARE)!;
    expect(boltCandidates(b, [s.x, s.y], ['interior'])).toEqual([]);
    expect(boltHole(b, widenSeed(1), anchorId(HARE, s.x, s.y), [s.x, s.y], ['interior'])).toBeUndefined();
  });
});
