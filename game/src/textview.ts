/**
 * The world as text: a window of the map around a tile, one character a tile, so a test or an agent
 * can read a moment of play without a renderer (DECISIONS 2026-10-18, the character-grid look kept
 * for later). The ground is the map's own legend (content/core/map.json); over it, the higher in this
 * list the more it wins:
 *
 *   @ the player            W a predator awake, w asleep     * a node ready to gather, o one gathered
 *   N a person              ! a pit or a trap                x a tile an awake predator sees
 *   ^ cover                 + solid ground the kernel lets the player walk (a mended bridge)
 *   X open ground the kernel blocks (a solid prop)
 *
 * Under the grid one line gives the hour, the health, the hunt and where each awake predator looks.
 */
import { type Bundle, type Tile, hazardsOf, makeWalkable, minuteOfDay, npcTile, predatorAt, headingOf, sees, windowOpen, type PublicState } from '@game/kernel';

/** What a moment of play is made of: the kernel's state, the clock, and the tile the client has the player on. */
export interface Moment {
  state: PublicState;
  tick: number;
  pos: readonly [number, number];
}

const walkables = new WeakMap<Bundle, ReturnType<typeof makeWalkable>>();
const HEADING: Record<string, string> = { '0,-1': 'up', '0,1': 'down', '-1,0': 'left', '1,0': 'right', '0,0': 'still' };

/** The map within `radius` tiles of `at` (the player by default), with a status line under it. */
export function textView(b: Bundle, m: Moment, radius = 6, at: Tile = [m.pos[0], m.pos[1]]): string {
  let walkable = walkables.get(b);
  if (!walkable) {
    walkable = makeWalkable(b);
    walkables.set(b, walkable);
  }
  const { map } = b;
  const x0 = Math.max(0, at[0] - radius);
  const x1 = Math.min(map.width - 1, at[0] + radius);
  const y0 = Math.max(0, at[1] - radius);
  const y1 = Math.min(map.height - 1, at[1] + radius);
  const marks = new Map<string, string>();
  const mark = (x: number, y: number, c: string) => marks.set(`${x},${y}`, c);
  const fill = (r: { x: number; y: number; w: number; h: number }, c: string) => {
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) mark(x, y, c);
  };

  // lowest first: each later mark wins over an earlier one on the same tile
  for (const p of map.props) if (p.cover === true) fill(p, '^');
  const hazards = hazardsOf(b);
  const awake = hazards.filter((h) => h.kind === 'predator' && windowOpen(b, h, m.tick));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) if (awake.some((h) => h.round && sees(b, h, m.tick, [x, y]))) mark(x, y, 'x');
  }
  for (const h of hazards) if (h.kind === 'pit' || h.kind === 'trap') fill(h.rect, '!');
  for (const id of Object.keys(b.npcs)) {
    const t = npcTile(b, id);
    if (t) mark(t[0], t[1], 'N');
  }
  for (const [id, inst] of Object.entries(b.instances)) {
    if (inst.kind === 'resource') mark(inst.x, inst.y, (m.state.nodes[id]?.readyAt ?? 0) <= m.tick ? '*' : 'o');
  }
  for (const h of hazards) {
    if (h.kind !== 'predator') continue;
    const [px, py] = predatorAt(b, h, m.tick);
    mark(px, py, awake.includes(h) ? 'W' : 'w');
  }
  mark(m.pos[0], m.pos[1], '@');

  const rows: string[] = [];
  let header = '   ';
  for (let x = x0; x <= x1; x++) header += String(x % 10);
  rows.push(header);
  for (let y = y0; y <= y1; y++) {
    let row = String(y).padStart(2) + ' ';
    for (let x = x0; x <= x1; x++) {
      const ground = map.ground[y]?.[x] ?? ' ';
      const solid = map.legend[ground]?.solid === true;
      const open = walkable(x, y, m.state.player);
      row += marks.get(`${x},${y}`) ?? (solid && open ? '+' : !solid && !open ? 'X' : ground);
    }
    rows.push(row);
  }
  rows.push(status(b, m, awake));
  return rows.join('\n');
}

function status(b: Bundle, m: Moment, awake: ReturnType<typeof hazardsOf>): string {
  const minute = minuteOfDay(b, m.tick);
  const clock = `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
  const p = m.state.player;
  const parts = [`${clock} tick ${m.tick}`, `@ ${m.pos[0]},${m.pos[1]}`, `health ${p.hp}`, `falls ${p.falls}`];
  parts.push(p.chase ? `hunted by ${p.chase.hazard} since ${p.chase.since}` : 'not hunted');
  for (const h of awake) {
    const [x, y] = predatorAt(b, h, m.tick);
    const look = h.round ? ` looking ${HEADING[headingOf(b, h, m.tick).join(',')] ?? '?'}` : '';
    parts.push(`${h.id} at ${x},${y}${look}`);
  }
  return parts.join(' | ');
}
