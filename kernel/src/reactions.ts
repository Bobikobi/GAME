/**
 * World reactions (docs/design/REACTIONS.md): rules the kernel reads and never runs. A reaction
 * hangs on one kind of thing and its answer is a pure function of the content, the state of the one
 * thing it hangs on, the tick and the seed. Nothing is written to a neighbour and nothing runs while
 * nobody looks, so rule R1 holds unchanged and a replay on the server gives the same answer.
 *
 * Three effects are read in phase A: a node that appears beside the thing while the condition
 * holds, a wait that scales the thing's respawn, and a cue the client draws (the kernel never
 * emits one, since a cue changes no state).
 */
import type { Bundle, Instance, ReactionDef, ResourceDef } from './bundle';
import { idiv } from './num';
import { drawBasisPoints } from './rng';
import { type State, hourOf, isNight, senseReach, techniqueValue } from './state';
import { spotOpen } from './step';
import { tagAt } from './world';

type At = readonly [number, number];

/** What a reaction hangs on: a placed node or dig spot by its instance id, or a ground tile by "x,y". */
export interface Anchor {
  id: string;
  x: number;
  y: number;
  /** the placed node or spot; absent for a tile */
  inst?: Instance;
}

/** A node a reaction makes appear: its id is `<reaction id>@<node id>`. */
export interface AppearSlot {
  id: string;
  reaction: ReactionDef;
  parent: Anchor;
  x: number;
  y: number;
  /** the node as a resource, so everything that reads a resource reads it the same way */
  def: ResourceDef;
}

/** A sign for the client at a tile: drawn, heard, never a number or a word. */
export interface CueHit {
  cue: string;
  reaction: string;
  /** the thing it marks */
  anchor: string;
  x: number;
  y: number;
}

/** The tile next to a node on each side, for an appear node's `at`. */
const SIDE: Record<string, At> = { here: [0, 0], above: [0, -1], below: [0, 1], left: [-1, 0], right: [1, 0] };

/** The most cues one step may start: a river at dusk must not boil with fish. */
export const MAX_CUES = 3;
/** A cue with no reach of its own is met this close, the largest reach a reaction may name. */
export const CUE_REACH = 8;
/** No cue shows this close to a riddle's answer: a riddle is read from the world, never pointed at (G6). */
export const RIDDLE_CLEAR = 2;

interface Index {
  /** every reaction, in id order (rule R3) */
  all: ReactionDef[];
  appear: Map<string, AppearSlot>;
  /** wait reactions by the id of the thing they hang on */
  waits: Map<string, ReactionDef[]>;
  cues: { r: ReactionDef; anchors: Anchor[] }[];
  /** the tiles a riddle answers by a dig */
  riddles: At[];
}

const cache = new WeakMap<Bundle, Index>();

function index(b: Bundle): Index {
  let ix = cache.get(b);
  if (ix) return ix;
  const all = Object.keys(b.reactions ?? {})
    .sort()
    .map((id) => b.reactions[id]!);
  const answers = new Set<string>();
  for (const q of Object.values(b.quests)) {
    for (const st of q.steps) if (st.kind === 'riddle' && st.answer.kind === 'dig') answers.add(st.answer.treasure);
  }
  const riddles = Object.values(b.instances)
    .filter((inst) => inst.kind === 'treasure' && answers.has(inst.source))
    .map((inst): At => [inst.x, inst.y]);
  ix = { all, appear: new Map(), waits: new Map(), cues: [], riddles };
  for (const r of all) {
    const anchors = anchorsOf(b, r);
    const then = r.then;
    if ('appear' in then) {
      const [dx, dy] = SIDE[then.appear.at] ?? [0, 0];
      for (const a of anchors) {
        const id = `${r.id}@${a.id}`;
        const parent = a.inst?.kind === 'resource' ? b.resources[a.inst.source] : undefined;
        const { at: _at, ...node } = then.appear;
        const def: ResourceDef = {
          id: r.id,
          creator: r.creator,
          title: r.title,
          file: r.file,
          ...node,
          count: 1,
          place: { slot: parent?.place.slot ?? '' },
        };
        ix.appear.set(id, { id, reaction: r, parent: a, x: a.x + dx, y: a.y + dy, def });
      }
    } else if ('wait' in then) {
      for (const a of anchors) ix.waits.set(a.id, [...(ix.waits.get(a.id) ?? []), r]);
    } else {
      ix.cues.push({ r, anchors });
    }
  }
  cache.set(b, ix);
  return ix;
}

/** Every thing a reaction hangs on, in a fixed order: instance ids sorted, tiles row by row. */
export function anchorsOf(b: Bundle, r: ReactionDef): Anchor[] {
  const on = r.on;
  if ('tag' in on) {
    const out: Anchor[] = [];
    for (let y = 0; y < b.map.height; y++) {
      for (let x = 0; x < b.map.width; x++) if (tagAt(b.map, x, y) === on.tag) out.push({ id: `${x},${y}`, x, y });
    }
    return out;
  }
  const kind = 'resource' in on ? 'resource' : 'treasure';
  const source = 'resource' in on ? on.resource : on.treasure;
  return Object.keys(b.instances)
    .sort()
    .filter((id) => {
      const inst = b.instances[id]!;
      return inst.kind === kind && (source === '*' || inst.source === source);
    })
    .map((id) => {
      const inst = b.instances[id]!;
      return { id, x: inst.x, y: inst.y, inst };
    });
}

/** How far the player sees a hidden find: the senses, and two more tiles with the second-hint technique. */
export function hintReach(b: Bundle, s: State): number {
  return senseReach(b, s.player.attrs.senses) + (techniqueValue(b, s, 'second_hint') > 0 ? 2 : 0);
}

/** The game day a tick falls in: a reaction that rolls draws once a day (rule R4, the day as the counter). */
export function dayOf(b: Bundle, tick: number): number {
  return idiv(tick, b.params.day_length_ms);
}

function inHours(hour: number, [from, to]: readonly [number, number]): boolean {
  return from < to ? hour >= from && hour < to : hour >= from || hour < to;
}

function reach(a: At, x: number, y: number): number {
  return Math.max(Math.abs(a[0] - x), Math.abs(a[1] - y));
}

/**
 * Whether the reaction holds on this thing at this tick, for a player standing at `at` (their
 * tile by default). Every condition it names must hold. It reads only base state, never another
 * reaction's answer (depth 1).
 */
export function reactionHolds(b: Bundle, s: State, r: ReactionDef, anchor: Anchor, tick: number, at: At = s.player.at): boolean {
  const w = r.when;
  if (w.hours && !inHours(hourOf(b, tick), w.hours)) return false;
  if (w.night !== undefined && isNight(b, tick) !== w.night) return false;
  if (w.ready_for_ms !== undefined) {
    // a node never touched has stood ready since the first tick
    const readyAt = s.nodes[anchor.id]?.readyAt ?? 0;
    if (!anchor.inst || tick < readyAt || tick - readyAt < w.ready_for_ms) return false;
  }
  if (w.on_tag !== undefined && tagAt(b.map, anchor.x, anchor.y) !== w.on_tag) return false;
  if (w.player_within !== undefined && reach(at, anchor.x, anchor.y) > w.player_within) return false;
  if (w.unseen === true) {
    // a hidden find is one this character can dig now and does not see yet
    const inst = anchor.inst;
    if (inst?.kind !== 'treasure' || !spotOpen(b, s, anchor.id) || (s.nodes[anchor.id]?.readyAt ?? 0) > tick) return false;
    if (reach(at, anchor.x, anchor.y) <= hintReach(b, s)) return false;
  }
  if (w.chance_pct !== undefined && drawBasisPoints(s.seed, `${r.id}@${anchor.id}`, dayOf(b, tick)) >= w.chance_pct * 100) return false;
  return true;
}

/** Every node a reaction can make appear, shown or not, by id. */
export function appearSlots(b: Bundle): ReadonlyMap<string, AppearSlot> {
  return index(b).appear;
}

/** The appear node with this id, if it is one. */
export function appearSlot(b: Bundle, id: string): AppearSlot | undefined {
  return index(b).appear.get(id);
}

/** Whether the appear node is there now: its reaction holds and it has come back since it was last taken. */
export function appears(b: Bundle, s: State, id: string, tick: number): boolean {
  const slot = index(b).appear.get(id);
  if (!slot) return false;
  return (s.nodes[id]?.readyAt ?? 0) <= tick && reactionHolds(b, s, slot.reaction, slot.parent, tick);
}

/** A placed node or dig spot, or an appear node as a resource node at its own tile. */
export function placedAt(b: Bundle, id: string): Instance | undefined {
  const inst = b.instances[id];
  if (inst) return inst;
  const slot = index(b).appear.get(id);
  return slot ? { source: slot.reaction.id, kind: 'resource', x: slot.x, y: slot.y } : undefined;
}

/** The resource a node gives by: its own file's, or the appear node's as its reaction writes it. */
export function resourceOf(b: Bundle, id: string): ResourceDef | undefined {
  const inst = b.instances[id];
  if (inst) return inst.kind === 'resource' ? b.resources[inst.source] : undefined;
  return index(b).appear.get(id)?.def;
}

/**
 * The wait on a node's respawn, in permille: the waits that hold on it multiply, then clamp to
 * 500-2000. Read before the action changes the node. Waiting is never paid (R6), so no value moves.
 */
export function waitPermille(b: Bundle, s: State, id: string, tick: number): number {
  const rs = index(b).waits.get(id);
  if (!rs) return 1000;
  const inst = b.instances[id];
  const anchor: Anchor | undefined = inst ? { id, x: inst.x, y: inst.y, inst } : undefined;
  if (!anchor) return 1000;
  let p = 1000;
  for (const r of rs) {
    if ('wait' in r.then && reactionHolds(b, s, r, anchor, tick)) p = idiv(p * r.then.wait, 1000);
  }
  return Math.max(500, Math.min(2000, p));
}

/**
 * The cues a step from `from` to `to` starts: a cue fires on the edge, when its thing comes inside
 * its reach and was outside it on the tile before, so it needs no memory. At most MAX_CUES, the
 * nearest first. A cue with a spread shows on a tile drawn around its thing, the same all day, and
 * none shows within RIDDLE_CLEAR of a riddle's answer.
 */
export function cuesOnStep(b: Bundle, s: State, tick: number, from: At, to: At): CueHit[] {
  const hits: (CueHit & { d: number })[] = [];
  const ix = index(b);
  for (const { r, anchors } of ix.cues) {
    if (!('cue' in r.then)) continue;
    const radius = r.when.player_within ?? CUE_REACH;
    const spread = r.then.spread ?? 0;
    for (const a of anchors) {
      const d = reach(to, a.x, a.y);
      if (d > radius || reach(from, a.x, a.y) <= radius) continue;
      if (!reactionHolds(b, s, r, a, tick, to)) continue;
      let [x, y] = [a.x, a.y];
      if (spread > 0) {
        const span = 2 * spread + 1;
        const roll = drawBasisPoints(s.seed, `${r.id}@${a.id}#spread`, dayOf(b, tick));
        x += (roll % span) - spread;
        y += (idiv(roll, span) % span) - spread;
      }
      if (ix.riddles.some((t) => reach(t, x, y) <= RIDDLE_CLEAR)) continue;
      hits.push({ cue: r.then.cue, reaction: r.id, anchor: a.id, x, y, d });
    }
  }
  hits.sort((p, q) => p.d - q.d || (p.reaction < q.reaction ? -1 : p.reaction > q.reaction ? 1 : p.anchor < q.anchor ? -1 : 1));
  return hits.slice(0, MAX_CUES).map(({ d: _d, ...hit }) => hit);
}
