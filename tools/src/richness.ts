/**
 * How rich is each phone screen (the sibling of G62's pay gap, OPEN_WORLD.md
 * section 1.5). A phone sees about 15 x 10 tiles (world.ts `fit`). For every
 * such window over walkable ground, sliding by half a window, count:
 *   a) kinds of thing to act on: resource and dig kinds, slot kinds, crossings,
 *      characters, and noted props that pass G8 (a riddle cites them);
 *   b) kinds that move, as the data declares them: a sprite with frames (the
 *      client animates exactly those under `motion`), water, characters, predators;
 *   c) kinds that react to the player: predators, over their reach or their watch.
 * Warnings only. Thresholds live in richness.params.json.
 */
import { readFileSync } from 'node:fs';
import { type Bundle, type Rect, hazardsOf } from '@game/kernel';
import type { Issue } from './load';
import { watchOf } from './hazards';
import { walkBitmap } from './reach';

export interface RichnessParams {
  window_w: number;
  window_h: number;
  min_walkable_pct: number;
  min_kinds_to_act_on: number;
  min_movers: number;
  min_reactors: number;
  min_water_tiles: number;
}

export function readRichnessParams(): RichnessParams {
  return JSON.parse(readFileSync(new URL('./richness.params.json', import.meta.url), 'utf8')) as RichnessParams;
}

export interface RichWindow {
  x: number;
  y: number;
  w: number;
  h: number;
  /** walkable tiles inside */
  walkable: number;
  /** judged: enough walkable ground */
  judged: boolean;
  acts: string[];
  moves: string[];
  reacts: string[];
  passA: boolean;
  passB: boolean;
  passC: boolean;
}

const starts = (size: number, win: number, step: number): number[] => {
  const out: number[] = [];
  if (size <= win) return [0];
  for (let s = 0; s + win < size; s += step) out.push(s);
  out.push(size - win);
  return out;
};

/** A thing placed on the map: a kind label and the tiles it takes. */
interface Thing {
  kind: string;
  rect: Rect;
}

export function richnessWindows(b: Bundle, p: RichnessParams = readRichnessParams()): RichWindow[] {
  const { width, height } = b.map;
  const open = walkBitmap(b);
  const acts: Thing[] = [];
  const moves: Thing[] = [];
  const reacts: { kind: string; tiles: Set<number> }[] = [];
  const animated = (sprite: string) => (b.sprites[sprite]?.frames ?? 1) > 1;
  const tile = (x: number, y: number): Rect => ({ x, y, w: 1, h: 1 });

  for (const inst of Object.values(b.instances)) {
    acts.push({ kind: inst.kind === 'treasure' ? 'dig' : inst.source, rect: tile(inst.x, inst.y) });
    const r = inst.kind === 'resource' ? b.resources[inst.source] : undefined;
    if (r && [r.sprite, r.sprite_empty].some((s) => s !== undefined && animated(s))) moves.push({ kind: inst.source, rect: tile(inst.x, inst.y) });
  }
  const passable = new Set(Object.values(b.restores).filter((r) => r.passable).map((r) => r.id));
  const npcSlots = new Map(Object.values(b.npcs).map((n) => [n.place.slot, n]));
  for (const s of b.map.slots) {
    if (s.kind === 'area') continue;
    const npc = npcSlots.get(s.id);
    if (s.kind === 'npc') {
      if (!npc) continue;
      acts.push({ kind: `character:${npc.id}`, rect: s });
      moves.push({ kind: `character:${npc.id}`, rect: s });
    } else acts.push({ kind: s.kind === 'restore' && passable.has(s.id) ? 'crossing' : s.kind, rect: s });
  }
  const cited = new Set(Object.values(b.quests).flatMap((q) => q.steps.flatMap((st) => (st.kind === 'riddle' ? st.props : []))));
  for (const pr of b.map.props) {
    if (pr.note !== undefined && pr.id !== undefined && cited.has(pr.id)) acts.push({ kind: 'note', rect: pr });
    if (animated(pr.sprite)) moves.push({ kind: pr.sprite, rect: pr });
  }
  for (const hz of hazardsOf(b)) {
    if (hz.kind !== 'predator') continue;
    const tiles = new Set<number>();
    if (hz.round) {
      for (const [x, y] of watchOf(b, hz)) tiles.add(y * width + x);
    } else {
      for (let y = Math.max(0, hz.rect.y - hz.reach); y < Math.min(height, hz.rect.y + hz.rect.h + hz.reach); y++) {
        for (let x = Math.max(0, hz.rect.x - hz.reach); x < Math.min(width, hz.rect.x + hz.rect.w + hz.reach); x++) tiles.add(y * width + x);
      }
    }
    reacts.push({ kind: hz.id, tiles });
    moves.push({ kind: 'predator', rect: hz.rect });
  }

  const hit = (t: Rect, x0: number, y0: number, w: number, h: number) => t.x < x0 + w && t.x + t.w > x0 && t.y < y0 + h && t.y + t.h > y0;
  const out: RichWindow[] = [];
  for (const y0 of starts(height, p.window_h, Math.floor(p.window_h / 2))) {
    for (const x0 of starts(width, p.window_w, Math.floor(p.window_w / 2))) {
      const w = Math.min(p.window_w, width);
      const h = Math.min(p.window_h, height);
      let walkable = 0;
      let water = 0;
      for (let y = y0; y < y0 + h; y++) {
        for (let x = x0; x < x0 + w; x++) {
          if (open[y * width + x]) walkable++;
          const t = b.map.legend[b.map.ground[y]?.[x] ?? ''];
          if (t && (t.tag === 'water' || animated(t.sprite))) water++;
        }
      }
      const a = new Set(acts.filter((t) => hit(t.rect, x0, y0, w, h)).map((t) => t.kind));
      const m = new Set(moves.filter((t) => hit(t.rect, x0, y0, w, h)).map((t) => t.kind));
      if (water >= p.min_water_tiles) m.add('water');
      const c = new Set<string>();
      for (const r of reacts) {
        for (let y = y0; y < y0 + h && !c.has(r.kind); y++) for (let x = x0; x < x0 + w; x++) if (r.tiles.has(y * width + x)) { c.add(r.kind); break; }
      }
      out.push({
        x: x0, y: y0, w, h, walkable,
        judged: walkable * 100 >= p.min_walkable_pct * w * h,
        acts: [...a].sort(), moves: [...m].sort(), reacts: [...c].sort(),
        passA: a.size >= p.min_kinds_to_act_on, passB: m.size >= p.min_movers, passC: c.size >= p.min_reactors,
      });
    }
  }
  return out;
}

export function checkRichness(b: Bundle, origin: Record<string, string>): Issue[] {
  const p = readRichnessParams();
  const judged = richnessWindows(b, p).filter((w) => w.judged);
  if (judged.length === 0) return [];
  const file = origin[b.map.id] ?? 'content';
  const pct = (f: (w: RichWindow) => boolean) => Math.round((judged.filter(f).length * 100) / judged.length);
  const issues: Issue[] = [
    {
      file,
      where: 'map.richness',
      message: `richness over ${judged.length} phone windows (${p.window_w}x${p.window_h}): ${pct((w) => w.passA)}% have ${p.min_kinds_to_act_on}+ kinds to act on, ${pct((w) => w.passB)}% have ${p.min_movers}+ movers, ${pct((w) => w.passC)}% have ${p.min_reactors}+ reacting`,
      level: 'warning',
    },
  ];
  for (const w of judged) {
    if (w.passA && w.passB && w.passC) continue;
    const lacks = [!w.passA && `act ${w.acts.length}/${p.min_kinds_to_act_on}`, !w.passB && `move ${w.moves.length}/${p.min_movers}`, !w.passC && `react ${w.reacts.length}/${p.min_reactors}`].filter(Boolean);
    issues.push({ file, where: `map.richness.${w.x},${w.y}`, message: `thin window tiles (${w.x},${w.y})-(${w.x + w.w - 1},${w.y + w.h - 1}): ${lacks.join(', ')}`, level: 'warning' });
  }
  return issues;
}
