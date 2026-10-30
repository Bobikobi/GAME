import { findSlot, makeWalkable, near } from '../../kernel/src/index';
import type { Rect } from '../../kernel/src/index';
import { runCheck } from '../../tools/src/check';
const b = runCheck().assembled.bundle!;
const walkable = makeWalkable(b);
const view = { restored: [] as string[], camp: [] as string[] };
const { width, height } = b.map;
type T = [number, number];
function bfs(from: T): Map<number, number> {
  const d = new Map<number, number>([[from[1] * width + from[0], 0]]);
  const q: T[] = [from];
  for (let i = 0; i < q.length; i++) {
    const [x, y] = q[i]!;
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]] as T[]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height || d.has(ny * width + nx) || !walkable(nx, ny, view)) continue;
      d.set(ny * width + nx, d.get(y * width + x)! + 1);
      q.push([nx, ny]);
    }
  }
  return d;
}
console.log('map', width, height);
const wakes = Object.values(b.pockets).map((p) => ({ id: p.id, at: [p.wake.x, p.wake.y] as T }));
const bridge = findSlot(b.map, 'core/old-bridge') as Rect;
console.log('bridge slot', bridge);
for (const w of wakes) {
  const d = bfs(w.at);
  let best = Infinity;
  for (let y = bridge.y - 1; y <= bridge.y + bridge.h; y++) for (let x = bridge.x - 1; x <= bridge.x + bridge.w; x++) {
    const v = d.get(y * width + x);
    if (v !== undefined && near([x, y] as never, bridge)) best = Math.min(best, v);
  }
  console.log(w.id, w.at, 'steps to beside the bridge', best);
  for (const o of wakes) if (o.id !== w.id) console.log('   to', o.id, 'walk', d.get(o.at[1] * width + o.at[0]), 'manhattan', Math.abs(o.at[0] - w.at[0]) + Math.abs(o.at[1] - w.at[1]));
}
