/**
 * The difficulty reckoning (NEXT 19 b): for every place of the map, the level
 * a player arrives with, computed from content and never typed in, and what
 * the place should hold for that player on the 9.10 scale. Pure and integer;
 * it recommends and prints, and never places anything into the map.
 *
 * - Distance: the G56 walk, four ways over the map's walkable tiles with every
 *   passable restoration mended, from each wake tile (the pockets' wakes).
 * - Quests before a place: every quest whose places are all nearer, with what
 *   must be done before it (the quest order of `pnpm quests`), and what must be
 *   done before the quests that sit at the place itself.
 * - Experience is the activity record (R6): a quest pays what its steps make the
 *   player do (the gathers, digs and crafts it asks), to the school of each verb;
 *   a visit, a riddle's walk and a tended fire pay nothing.
 * - Grinding on the way: each nearer node worked up to `grind_passes_max` times
 *   (a pass waits for the node to grow back), its school capped at the top level
 *   of the band of the highest tier its nodes give (a tier-1 node trains to 5).
 * - Levels on the one curve of PROGRESSION 3.2 (t1, the 9.10 ratio); the leading
 *   school's level is the place's expected level.
 */
import { type Bundle, type QuestDef, type Rect, dangerAt, hazardsOf, makeStepRule, makeWalkable, near, nodeVerb } from '@game/kernel';
import { QUEST_TYPES } from '@game/schema';
import { orderOf } from '../quests/hand';
import { fmtMs, fmtPermille, levelOf, scalePermille, stepMs, thresholdsMs } from './curve';
import { bandOf, type Rules } from './rules';

type Slot = Rect & { id: string; kind: string; label?: string };

const STEPS: readonly (readonly [number, number])[] = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

/** What a quest kind fits, by the kind of place (G17 asks the next quest to differ in kind; the palette rotates). */
const PALETTE: Record<string, readonly string[]> = {
  resource: ['collection', 'fetch_twist', 'tending', 'skill'],
  ruin: ['investigation', 'riddle', 'discovery', 'gamble'],
  area: ['discovery', 'maze', 'stealth', 'investigation'],
  npc: ['errand', 'persuasion', 'dilemma', 'fetch_twist'],
  restore: ['skill', 'mastery', 'collection'],
  camp: ['tending', 'mastery', 'skill'],
  building: ['errand', 'skill', 'mastery'],
};

export interface PocketLevel {
  pocket: string;
  steps: number | null;
  level: number;
  charLevel: number;
  questsBefore: number;
  questXpMs: number;
  grindXpMs: number;
}

export interface PlaceRow {
  slot: string;
  kind: string;
  label: string;
  /** fewest steps from any wake; null: no wake reaches it */
  steps: number | null;
  /** the danger the map gives it today: 0 safe ground, 1 elsewhere (CR-38 not built) */
  dNow: number;
  /** the least-prepared arrival's leading level, and the best-prepared one's */
  level: number;
  levelMax: number;
  band: number;
  charLevel: number;
  /** the recommended danger on the 9.10 scale: 0 on safe ground, else the arrival's level */
  dRec: number;
  quests: { count: number; kinds: string[]; eachMs: number; nextStepMs: number };
  monsters: { tier: string; oneInMinutes: number; strengthPermille: number; authored: string[] } | null;
  opens: string[];
  byPocket: PocketLevel[];
}

interface Work {
  xp: Map<string, number>;
  activeMs: number;
  slots: Set<string>;
}

function bitmap(b: Bundle, restored: string[]): Uint8Array {
  const walkable = makeWalkable(b);
  const view = { restored, camp: [] as string[] };
  const { width, height } = b.map;
  const open = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) open[y * width + x] = walkable(x, y, view) ? 1 : 0;
  return open;
}

/** Steps from one tile to every tile, four ways; -1 where it cannot walk. */
export function walkFrom(b: Bundle, open: Uint8Array, from: readonly [number, number]): Int32Array {
  const { width, height } = b.map;
  // the height rule of a step (G68), the kernel's own, so this reckoning and the walk cannot disagree
  const stepOpen = makeStepRule(b);
  const dist = new Int32Array(width * height).fill(-1);
  const start = from[1] * width + from[0];
  dist[start] = 0;
  const queue = [start];
  for (let i = 0; i < queue.length; i++) {
    const at = queue[i]!;
    const x = at % width;
    const y = (at - x) / width;
    for (const [dx, dy] of STEPS) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const k = ny * width + nx;
      if (dist[k] !== -1 || open[k] !== 1 || !stepOpen(x, y, nx, ny)) continue;
      dist[k] = dist[at]! + 1;
      queue.push(k);
    }
  }
  return dist;
}

/** Fewest steps to stand next to a slot (the kernel's `near`), or null. */
function stepsTo(b: Bundle, dist: Int32Array, slot: Rect): number | null {
  const { width, height } = b.map;
  let best: number | null = null;
  for (let y = Math.max(0, slot.y - 1); y <= Math.min(height - 1, slot.y + slot.h); y++) {
    for (let x = Math.max(0, slot.x - 1); x <= Math.min(width - 1, slot.x + slot.w); x++) {
      const d = dist[y * width + x]!;
      if (d >= 0 && near([x, y], slot) && (best === null || d < best)) best = d;
    }
  }
  return best;
}

/** Where the characters wake: each pocket's wake, or the map's spawn when the content has no pockets. */
export function wakes(b: Bundle): { pocket: string; at: [number, number] }[] {
  const pockets = Object.values(b.pockets).map((p) => ({ pocket: p.id, at: [p.wake.x, p.wake.y] as [number, number] }));
  return pockets.length > 0 ? pockets.sort((a, c) => a.pocket.localeCompare(c.pocket)) : [{ pocket: '', at: [b.map.spawn.x, b.map.spawn.y] }];
}

function recipeSchool(b: Bundle, id: string): string {
  const r = b.recipes[id]!;
  return r.profession ?? b.stations[r.station] ?? b.verbs.craft;
}

/** The activity record of each quest for one wake: the nearest source of each item is the one used. */
function questWork(b: Bundle, q: QuestDef, pocket: string, steps: (slot: string) => number | null): Work {
  const w: Work = { xp: new Map(), activeMs: 0, slots: new Set() };
  const pay = (school: string, ms: number) => {
    w.xp.set(school, (w.xp.get(school) ?? 0) + ms);
    w.activeMs += ms;
  };
  const nearest = <T>(list: T[], slotOf: (t: T) => string): T | undefined =>
    list
      .filter((t) => steps(slotOf(t)) !== null)
      .sort((a, c) => (steps(slotOf(a)) ?? 0) - (steps(slotOf(c)) ?? 0) || slotOf(a).localeCompare(slotOf(c)))[0];
  const campSlots = b.map.slots.filter((s) => s.kind === 'camp').map((s) => s.id);
  const item = (id: string, qty: number, depth: number): void => {
    const r = nearest(
      Object.values(b.resources).filter((x) => x.output === id),
      (x) => x.place.slot,
    );
    if (r) {
      const n = Math.trunc((qty + r.yield - 1) / r.yield);
      pay(b.verbs[nodeVerb(r)], n * r.active_ms);
      w.slots.add(r.place.slot);
      return;
    }
    const t = nearest(
      Object.values(b.treasures).filter((x) => (x.pocket === undefined || x.pocket === pocket) && x.finds.some((f) => f.item === id)),
      (x) => x.place.slot,
    );
    if (t) {
      pay(b.verbs.dig, qty * t.active_ms);
      w.slots.add(t.place.slot);
      return;
    }
    const recipe = Object.values(b.recipes).find((x) => x.outputs.some((o) => o.item === id));
    if (recipe && depth < 2) make(recipe.id, Math.trunc((qty + recipe.outputs.find((o) => o.item === id)!.qty - 1) / recipe.outputs.find((o) => o.item === id)!.qty), depth + 1);
  };
  const make = (id: string, times: number, depth: number): void => {
    const r = b.recipes[id];
    if (!r) return;
    pay(recipeSchool(b, id), times * r.active_ms);
    for (const s of campSlots) w.slots.add(s);
    for (const i of r.inputs) if ('item' in i) item(i.item, i.qty * times, depth);
  };
  if (q.giver) {
    const npc = b.npcs[q.giver];
    if (npc) w.slots.add(npc.place.slot);
  }
  for (const s of q.steps) {
    if (s.kind === 'bring') item(s.item, s.qty, 0);
    else if (s.kind === 'find') item(s.item, 1, 0);
    else if (s.kind === 'make') make(s.recipe, 1, 0);
    else if (s.kind === 'restore') {
      const r = b.restores[s.restore];
      if (r) {
        w.slots.add(r.place.slot);
        for (const i of r.inputs) item(i.item, i.qty, 0);
      }
    } else if (s.kind === 'build') {
      for (const c of campSlots) w.slots.add(c);
      for (const i of b.camps[s.camp]?.inputs ?? []) item(i.item, i.qty, 0);
    } else if (s.kind === 'visit') w.slots.add(s.slot);
    else if (s.kind === 'riddle') {
      if (s.answer.kind === 'dig') {
        const t = b.treasures[s.answer.treasure];
        if (t) {
          pay(b.verbs.dig, t.active_ms);
          w.slots.add(t.place.slot);
        }
      } else if (s.answer.kind === 'visit') w.slots.add(s.answer.slot);
    } else if (s.kind === 'tend') for (const c of campSlots) w.slots.add(c);
  }
  return w;
}

/** The highest item tier each school's nodes give: grinding trains a school to the top of that tier's band. */
function grindCaps(b: Bundle, rules: Rules): Map<string, number> {
  const caps = new Map<string, number>();
  const up = (school: string, tier: number) => caps.set(school, Math.max(caps.get(school) ?? 0, tier * rules.bandSize));
  for (const r of Object.values(b.resources)) up(b.verbs[nodeVerb(r)], b.items[r.output]?.tier ?? 1);
  for (const t of Object.values(b.treasures)) up(b.verbs.dig, Math.max(1, ...t.finds.map((f) => b.items[f.item]?.tier ?? 1)));
  return caps;
}

function kindsFor(kind: string, used: Map<string, number>, count: number): string[] {
  const palette = [...(PALETTE[kind] ?? QUEST_TYPES)];
  const order = palette.map((k, i) => ({ k, i, n: used.get(k) ?? 0 })).sort((a, c) => a.n - c.n || a.i - c.i);
  return Array.from({ length: count }, (_, i) => order[i % order.length]!.k);
}

export function reckon(b: Bundle, rules: Rules): PlaceRow[] {
  const slots = b.map.slots as readonly Slot[];
  const mended = Object.values(b.restores).filter((r) => r.passable).map((r) => r.id);
  const open = bitmap(b, mended);
  const caps = grindCaps(b, rules);
  const thresholds = thresholdsMs(rules);
  const hazards = hazardsOf(b);
  const perWake = wakes(b).map(({ pocket, at }) => {
    const dist = walkFrom(b, open, at);
    const stepsOf = new Map(slots.map((s) => [s.id, stepsTo(b, dist, s)]));
    const steps = (id: string) => stepsOf.get(id) ?? null;
    const order = orderOf(b, pocket);
    const work = new Map(order.quests.map((id) => [id, questWork(b, b.quests[id]!, pocket, steps)]));
    const far = (id: string): number => {
      const ds = [...work.get(id)!.slots].map(steps);
      return ds.some((d) => d === null) ? Number.MAX_SAFE_INTEGER : Math.max(0, ...(ds as number[]));
    };
    return { pocket, at, dist, steps, order, work, far };
  });

  // a restoration that is a way over: what its mending shortens, from the first wake
  const shortcut = new Map<string, string>();
  for (const r of Object.values(b.restores).filter((x) => x.passable)) {
    const without = bitmap(b, mended.filter((id) => id !== r.id));
    const opened = new Set<string>();
    let saved = 0;
    for (const w of perWake) {
      const d0 = walkFrom(b, without, w.at);
      for (const s of slots) {
        const a = stepsTo(b, d0, s);
        const c = w.steps(s.id);
        if (c === null) continue;
        if (a === null) opened.add(s.id);
        else saved = Math.max(saved, a - c);
      }
    }
    shortcut.set(r.place.slot, `shortcut: ${r.id} (${opened.size > 0 ? `opens ${opened.size} places` : saved > 0 ? `saves up to ${saved} steps` : 'no shorter way from a wake'})`);
  }

  return slots.map((slot) => {
    const byPocket: PocketLevel[] = [];
    const used = new Map<string, number>();
    for (const w of perWake) {
      const here = w.steps(slot.id);
      if (here === null) {
        byPocket.push({ pocket: w.pocket, steps: null, level: 1, charLevel: 1, questsBefore: 0, questXpMs: 0, grindXpMs: 0 });
        continue;
      }
      const before = new Set<string>();
      for (const id of w.order.quests) {
        const at = w.work.get(id)!.slots.has(slot.id);
        if (w.far(id) < here || at) {
          if (!at) before.add(id);
          for (const d of w.order.done.get(id) ?? []) before.add(d);
        }
      }
      const xp = new Map<string, number>();
      let activeMs = 0;
      for (const id of before) {
        const q = w.work.get(id);
        if (!q) continue;
        activeMs += q.activeMs;
        for (const [s, ms] of q.xp) xp.set(s, (xp.get(s) ?? 0) + ms);
        const type = b.quests[id]?.type;
        if (type) used.set(type, (used.get(type) ?? 0) + 1);
      }
      const questXp = new Map(xp);
      const elapsed = here * rules.walkStepMs + activeMs;
      const grind = new Map<string, number>();
      const passes = (respawn: number) => Math.min(rules.grindPassesMax, 1 + Math.trunc(elapsed / Math.max(1, respawn)));
      for (const r of Object.values(b.resources)) {
        const d = w.steps(r.place.slot);
        if (d === null || d >= here || (r.opens_after ?? []).some((x) => { const wq = b.quests[x.quest]; return wq !== undefined && (wq.pocket === undefined || wq.pocket === w.pocket) && !before.has(x.quest); })) continue;
        const school = b.verbs[nodeVerb(r)];
        grind.set(school, (grind.get(school) ?? 0) + passes(r.respawn_ms) * r.count * r.active_ms);
      }
      for (const t of Object.values(b.treasures)) {
        const d = w.steps(t.place.slot);
        if (d === null || d >= here || (t.pocket !== undefined && t.pocket !== w.pocket)) continue;
        grind.set(b.verbs.dig, (grind.get(b.verbs.dig) ?? 0) + passes(t.respawn_ms) * t.count * t.active_ms);
      }
      let grindXp = 0;
      for (const [school, ms] of grind) {
        const own = xp.get(school) ?? 0;
        const cap = caps.get(school) ?? rules.bandSize;
        const top = (thresholds[cap - 1] ?? Number.MAX_SAFE_INTEGER) - 1;
        const add = Math.max(0, Math.min(ms, top - own));
        grindXp += add;
        xp.set(school, own + add);
      }
      const levels = [...Object.keys(b.professions)].map((id) => levelOf(rules, xp.get(id) ?? 0));
      byPocket.push({
        pocket: w.pocket,
        steps: here,
        level: Math.max(1, ...levels),
        charLevel: 1 + levels.reduce((a, l) => a + l - 1, 0),
        questsBefore: before.size,
        questXpMs: [...questXp.values()].reduce((a, c) => a + c, 0),
        grindXpMs: grindXp,
      });
    }
    const reached = byPocket.filter((p) => p.steps !== null);
    const level = reached.length > 0 ? Math.min(...reached.map((p) => p.level)) : 1;
    const levelMax = reached.length > 0 ? Math.max(...reached.map((p) => p.level)) : 1;
    const charLevel = reached.length > 0 ? Math.min(...reached.map((p) => p.charLevel)) : 1;
    const steps = reached.length > 0 ? Math.min(...reached.map((p) => p.steps!)) : null;
    const centre: [number, number] = [slot.x + Math.trunc(slot.w / 2), slot.y + Math.trunc(slot.h / 2)];
    const dNow = dangerAt(b, centre);
    const dRec = dNow === 0 ? 0 : level;
    const nextStepMs = stepMs(rules.t1Ms, rules.ratioPermille, level);
    const share = Math.trunc((nextStepMs * rules.questSharePct) / 100);
    const count = Math.min(rules.questsMax, Math.max(1, Math.trunc((share + rules.questMinutesMax * 60_000 - 1) / (rules.questMinutesMax * 60_000))));
    const authored = hazards
      .filter((h) => h.rect.x <= slot.x + slot.w && slot.x <= h.rect.x + h.rect.w && h.rect.y <= slot.y + slot.h && slot.y <= h.rect.y + h.rect.h)
      .map((h) => h.kind);
    const opens: string[] = [];
    if (slot.kind === 'camp') opens.push(`station: ${[...new Set(Object.values(b.camps).flatMap((c) => (c.provides ? [c.provides] : [])))].sort().join(', ')}`);
    const tools = new Set<string>();
    for (const r of Object.values(b.resources)) if (r.place.slot === slot.id && r.tool) tools.add(r.tool);
    for (const t of Object.values(b.treasures)) if (t.place.slot === slot.id && t.tool) tools.add(t.tool);
    if (tools.size > 0) opens.push(`tool gate: ${[...tools].sort().join(', ')}`);
    for (const npc of Object.values(b.npcs)) {
      if (npc.place.slot !== slot.id) continue;
      if (npc.shop) opens.push(`shop: ${npc.shop}`);
      const given = Object.values(b.quests).filter((q) => q.giver === npc.id).length;
      if (given > 0) opens.push(`quests: ${given} from ${npc.name}`);
    }
    const cut = shortcut.get(slot.id);
    if (cut) opens.push(cut);
    return {
      slot: slot.id,
      kind: slot.kind,
      label: slot.label ?? '',
      steps,
      dNow,
      level,
      levelMax,
      band: bandOf(rules, level),
      charLevel,
      dRec,
      quests: { count, kinds: kindsFor(slot.kind, used, count), eachMs: Math.trunc((share + count - 1) / count), nextStepMs },
      monsters:
        dRec === 0
          ? null
          : {
              tier: `T${bandOf(rules, dRec)}`,
              oneInMinutes: rules.hazardBp > 0 ? Math.trunc((10_000 + rules.hazardBp * dRec - 1) / (rules.hazardBp * dRec)) : 0,
              strengthPermille: scalePermille(rules.ratioPermille, dRec),
              authored: [...new Set(authored)].sort(),
            },
      opens,
      byPocket,
    };
  });
}

/** The table `pnpm map:difficulty` prints. */
export function formatReckoning(rows: readonly PlaceRow[], rules: Rules): string {
  const out: string[] = [];
  out.push('The difficulty reckoning (NEXT 19 b): recommends, never places. Steps from the nearest wake by the G56 walk;');
  out.push(`level = the least-prepared wake's leading school level on the curve (t1 ${fmtMs(rules.t1Ms)}, ratio ${rules.ratioPermille} permille);`);
  out.push('d now = what the map gives today (0 safe, 1 elsewhere); d rec = recommended on the 9.10 scale.');
  out.push('');
  const head = ['place', 'kind', 'steps', 'd now', 'level', 'band', 'd rec', 'quests', 'monsters', 'opens'];
  const body = [...rows]
    .sort((a, c) => (a.steps ?? 1e9) - (c.steps ?? 1e9) || a.slot.localeCompare(c.slot))
    .map((r) => [
      r.slot.replace(/^core\//, ''),
      r.kind,
      r.steps === null ? 'unreached' : String(r.steps),
      String(r.dNow),
      r.level === r.levelMax ? String(r.level) : `${r.level}-${r.levelMax}`,
      String(r.band),
      String(r.dRec),
      `${r.quests.count} x ${fmtMs(r.quests.eachMs)} (${r.quests.kinds.join(', ')})`,
      r.monsters ? `${r.monsters.tier} one in ${r.monsters.oneInMinutes} game min after dark, x${fmtPermille(r.monsters.strengthPermille)}${r.monsters.authored.length ? `; authored: ${r.monsters.authored.join(', ')}` : ''}` : 'none (safe)',
      r.opens.join('; ') || '-',
    ]);
  const widths = head.map((h, i) => Math.min(48, Math.max(h.length, ...body.map((row) => row[i]!.length))));
  const line = (cells: string[]) => cells.map((c, i) => (i === cells.length - 1 ? c : c.padEnd(widths[i]!))).join('  ');
  out.push(line(head));
  for (const row of body) out.push(line(row));
  return out.join('\n');
}
