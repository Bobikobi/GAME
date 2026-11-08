/**
 * The land the generator draws on: ground letters of the valley's shared legend (G52), a level digit a tile, props
 * in land tiles, and the marks the picture and the later stages read. All coordinates are world tiles.
 */
import type { Chunk } from '@game/schema';

export type Prop = Chunk['props'][number];
export type Tile = readonly [number, number];

/** The shared legend's letters the generator writes (content/core/map.json legend). */
export const G = {
  meadow: '.',
  flowers: ',',
  grove: '"',
  forest: 'T',
  water: '~',
  bank: '_',
  path: ':',
  ruinFloor: '#',
  rubble: '%',
  mountain: '^',
  bridge: 'j',
} as const;

/** The letters a foot cannot stand on. */
export const SOLID: ReadonlySet<string> = new Set([G.forest, G.water, G.rubble, G.mountain]);

export const STEPS4: readonly Tile[] = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

export interface Mark {
  kind: 'cave' | 'clearing' | 'ruin' | 'entry' | 'lake' | 'spring' | 'door' | 'arrival' | 'chamber' | 'secret' | 'pool';
  x: number;
  y: number;
  label: string;
}

export class Land {
  readonly ground: string[];
  readonly levels: Uint8Array;
  readonly props: Prop[] = [];
  readonly marks: Mark[] = [];
  /** The road tiles, path by path, as laid. */
  readonly roads: Tile[][] = [];
  /** Tiles a crossing prop stands on (G68). */
  readonly crossings = new Set<number>();
  /** Tiles a solid prop stands on. */
  readonly blocked = new Set<number>();

  constructor(
    readonly x0: number,
    readonly y0: number,
    readonly w: number,
    readonly h: number,
  ) {
    this.ground = Array.from({ length: h }, () => G.meadow.repeat(w));
    this.levels = new Uint8Array(w * h);
  }

  inside(x: number, y: number): boolean {
    return x >= this.x0 && y >= this.y0 && x < this.x0 + this.w && y < this.y0 + this.h;
  }

  key(x: number, y: number): number {
    return (y - this.y0) * this.w + (x - this.x0);
  }

  get(x: number, y: number): string {
    return this.ground[y - this.y0]![x - this.x0]!;
  }

  set(x: number, y: number, ch: string): void {
    const row = this.ground[y - this.y0]!;
    const i = x - this.x0;
    this.ground[y - this.y0] = row.slice(0, i) + ch + row.slice(i + 1);
  }

  level(x: number, y: number): number {
    return this.levels[this.key(x, y)]!;
  }

  setLevel(x: number, y: number, lv: number): void {
    this.levels[this.key(x, y)] = lv;
  }

  /** Whether a foot can stand on the tile: inside, not a solid letter, no solid prop. */
  walkable(x: number, y: number): boolean {
    return this.inside(x, y) && !SOLID.has(this.get(x, y)) && !this.blocked.has(this.key(x, y));
  }

  /** The kernel's step rule (G68): the same level, or 1 to 3 levels with a crossing at either end. */
  canStep(x1: number, y1: number, x2: number, y2: number): boolean {
    const a = this.level(x1, y1);
    const b = this.level(x2, y2);
    if (a === b) return true;
    if (Math.abs(a - b) > 3) return false;
    return this.crossings.has(this.key(x1, y1)) || this.crossings.has(this.key(x2, y2));
  }

  addProp(p: Prop): void {
    this.props.push(p);
    for (let y = p.y; y < p.y + p.h; y++) {
      for (let x = p.x; x < p.x + p.w; x++) {
        if (!this.inside(x, y)) continue;
        if (p.solid) this.blocked.add(this.key(x, y));
        if (p.crossing) this.crossings.add(this.key(x, y));
      }
    }
  }

  /** Drops every prop whose footprint touches the tile. */
  clearProps(x: number, y: number): void {
    for (let i = this.props.length - 1; i >= 0; i--) {
      const p = this.props[i]!;
      if (x >= p.x && x < p.x + p.w && y >= p.y && y < p.y + p.h) {
        this.props.splice(i, 1);
        for (let yy = p.y; yy < p.y + p.h; yy++) {
          for (let xx = p.x; xx < p.x + p.w; xx++) {
            if (!this.inside(xx, yy)) continue;
            if (p.solid) this.blocked.delete(this.key(xx, yy));
            if (p.crossing) this.crossings.delete(this.key(xx, yy));
          }
        }
      }
    }
  }

  /** Four-way steps from the sources over walkable tiles under the step rule: steps per tile key, -1 unreached. */
  distances(sources: readonly Tile[]): Int32Array {
    const dist = new Int32Array(this.w * this.h).fill(-1);
    const queue: Tile[] = [];
    for (const [x, y] of sources) {
      if (!this.walkable(x, y) || dist[this.key(x, y)] !== -1) continue;
      dist[this.key(x, y)] = 0;
      queue.push([x, y]);
    }
    for (let i = 0; i < queue.length; i++) {
      const [x, y] = queue[i]!;
      const here = dist[this.key(x, y)]!;
      for (const [dx, dy] of STEPS4) {
        const nx = x + dx;
        const ny = y + dy;
        if (!this.walkable(nx, ny) || dist[this.key(nx, ny)] !== -1 || !this.canStep(x, y, nx, ny)) continue;
        dist[this.key(nx, ny)] = here + 1;
        queue.push([nx, ny]);
      }
    }
    return dist;
  }

  /** The walkable tile nearest to (x, y) by rings, or undefined. */
  nearestWalkable(x: number, y: number, radius = 24): Tile | undefined {
    for (let r = 0; r <= radius; r++) {
      for (let yy = y - r; yy <= y + r; yy++) {
        for (let xx = x - r; xx <= x + r; xx++) {
          if (Math.max(Math.abs(xx - x), Math.abs(yy - y)) !== r) continue;
          if (this.walkable(xx, yy)) return [xx, yy];
        }
      }
    }
    return undefined;
  }
}
