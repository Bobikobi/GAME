/**
 * The peek at a maze's entrance (NEXT 9; DECISIONS 2026-10-11, "Maze difficulty
 * is a ladder of four tiers"): a step into a maze's frame from outside, while
 * its quest is not done, shows the whole maze from above for three seconds,
 * then the camera returns to the player. The quest's tier says what the peek
 * holds: 1 a very faint line of the route and the landmarks lit, 2 the
 * landmarks lit a moment, 3 the shape alone, 4 no peek. Pure, so the tests
 * read it without a browser; scenes/peek.ts shows it.
 */
import { findSlot, inRect, type Bundle } from '@game/kernel';

/** How long the peek holds the screen, from the step in to the player again. */
export const PEEK_MS = 3000;
/** A moment: how long the landmarks glow at tier 2. */
export const MOMENT_MS = 1200;

export type Tile = readonly [number, number];
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Peek {
  quest: string;
  tier: number;
  /** the area that frames the whole maze, in tiles */
  frame: Rect;
  /** tier 1: the shortest walk from the entrance to the heart, tile by tile; empty on the other tiers */
  route: Tile[];
  /** tiers 1 and 2: the middle of each landmark prop, in tiles; empty at tier 3 */
  landmarks: Tile[];
  /** how long the landmarks glow: the whole peek at tier 1, a moment at tier 2 */
  glowMs: number;
}

const STEPS: readonly Tile[] = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

/**
 * The peek a step from `from` to `to` opens: it crosses into a maze's frame
 * from outside, the maze's quest is not done and its tier gives a peek.
 * `walk` is the player's own walkable test, so the route goes where they can.
 */
export function peekOnStep(
  b: Bundle,
  done: (quest: string) => boolean,
  walk: (x: number, y: number) => boolean,
  from: Tile,
  to: Tile,
): Peek | undefined {
  for (const q of Object.values(b.quests)) {
    const m = q.maze;
    if (!m || m.tier >= 4 || done(q.id)) continue;
    const frame = findSlot(b.map, m.area);
    if (!frame || !inRect(to[0], to[1], frame) || inRect(from[0], from[1], frame)) continue;
    const hearts = q.steps.flatMap((st) => (st.kind === 'visit' ? [findSlot(b.map, st.slot)] : [])).filter((h): h is NonNullable<typeof h> => !!h);
    const landmarks =
      m.tier <= 2 && m.landmark
        ? b.map.props.filter((p) => p.sprite === m.landmark && inRect(p.x, p.y, frame)).map((p): Tile => [p.x + p.w / 2, p.y + p.h / 2])
        : [];
    return {
      quest: q.id,
      tier: m.tier,
      frame: { x: frame.x, y: frame.y, w: frame.w, h: frame.h },
      route: m.tier === 1 ? route(frame, walk, to, hearts) : [],
      landmarks,
      glowMs: m.tier === 1 ? PEEK_MS : m.tier === 2 ? MOMENT_MS : 0,
    };
  }
  return undefined;
}

/** The shortest walk inside the frame from a tile to any tile of a heart, four ways; empty when there is none. */
export function route(frame: Rect, walk: (x: number, y: number) => boolean, from: Tile, hearts: readonly Rect[]): Tile[] {
  const key = (x: number, y: number) => `${x},${y}`;
  const prev = new Map<string, Tile | null>([[key(from[0], from[1]), null]]);
  const queue: Tile[] = [from];
  for (let i = 0; i < queue.length; i++) {
    const at = queue[i]!;
    if (hearts.some((h) => inRect(at[0], at[1], h))) {
      const path: Tile[] = [];
      for (let t: Tile | null = at; t; t = prev.get(key(t[0], t[1])) ?? null) path.unshift(t);
      return path;
    }
    for (const [dx, dy] of STEPS) {
      const nx = at[0] + dx;
      const ny = at[1] + dy;
      if (!inRect(nx, ny, frame) || !walk(nx, ny) || prev.has(key(nx, ny))) continue;
      prev.set(key(nx, ny), at);
      queue.push([nx, ny]);
    }
  }
  return [];
}

/**
 * Where the peek looks and how near: the frame fits the screen less the bands
 * the page keeps for itself (the HUD above and below, a margin at the sides),
 * centred in what is left. Returns the zoom and the world point, in pixels,
 * that sits in the middle of the screen.
 */
export function fitFrame(
  frame: Rect,
  tile: number,
  screen: { w: number; h: number },
  keep: { top: number; bottom: number; side: number },
): { zoom: number; x: number; y: number } {
  const fw = frame.w * tile;
  const fh = frame.h * tile;
  const zoom = Math.min(Math.max(1, screen.w - 2 * keep.side) / fw, Math.max(1, screen.h - keep.top - keep.bottom) / fh);
  // the middle of the free band lies (top - bottom) / 2 below the middle of the screen
  const shift = (keep.top - keep.bottom) / 2;
  return { zoom, x: frame.x * tile + fw / 2, y: frame.y * tile + fh / 2 - shift / zoom };
}
