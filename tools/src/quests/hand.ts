/**
 * The hand: which quests a character can hold open at once, and which two of
 * one type a player can finish back to back by their own choice.
 *
 * G17 reads the requires links, but a player with three tasks open picks the
 * order, so "the next one is a different kind" is tested here on every order
 * the content allows. Two orders come from items and are read here too:
 * - a quest with no giver that finds an item is done the moment the item first
 *   comes into the bag, however it came (found once is found), so it is done
 *   before any quest that needs the item, or needs what only that item, as the
 *   one tool of its kind, gathers: the digger's slid bank comes before the
 *   first fire, whose logs only the axe fells;
 * - a node that opens after a quest holds back every quest that needs what only
 *   that node gives: the explorer's glint comes before the bridge's keystone.
 * One level only: an input a recipe makes is not followed further. Hours,
 * expedition nights and places are left out: they only narrow the orders, so a
 * pair found here may be rare in play, and a pair not found here never happens.
 */
import type { Bundle, QuestDef } from '@game/kernel';

/** Two quests of one type that a character can finish one right after the other. */
export interface SameAgain {
  type: string;
  first: string;
  then: string;
  /**
   * `open`: both can be open at once, done in either order. `requires`: `then`
   * requires `first` directly, the chain case the check already refuses.
   * `needs`: `then` needs what `first` finds or opens, and nothing has to come
   * between them.
   */
  how: 'open' | 'requires' | 'needs';
}

export interface Hand {
  starter: string;
  /** The quests this character can reach, sorted. */
  quests: string[];
  /** The most quests it can hold open at once. */
  widest: number;
  same: SameAgain[];
}

/** For one character: the quests it can reach, and what must be done before each is done, or before it can start. */
export interface Order {
  quests: string[];
  done: Map<string, Set<string>>;
  start: Map<string, Set<string>>;
}

const offered = (q: { starter?: string }, starter: string) => q.starter === undefined || q.starter === starter;

/** Every quest that must be done before this one can start, through the requires links. */
function ancestry(b: Bundle): Map<string, Set<string>> {
  const memo = new Map<string, Set<string>>();
  const walk = (id: string, trail: Set<string>): Set<string> => {
    const known = memo.get(id);
    if (known) return known;
    const all = new Set<string>();
    if (trail.has(id)) return all;
    trail.add(id);
    for (const r of b.quests[id]?.requires ?? []) {
      all.add(r);
      for (const a of walk(r, trail)) all.add(a);
    }
    trail.delete(id);
    memo.set(id, all);
    return all;
  };
  for (const id of Object.keys(b.quests)) walk(id, new Set());
  return memo;
}

/** The quests a character of this starter is offered and can open: offered to it, and every requirement reachable too. */
function reachable(b: Bundle, starter: string, anc: Map<string, Set<string>>): string[] {
  const ok = (id: string) => b.quests[id] !== undefined && offered(b.quests[id]!, starter);
  return Object.keys(b.quests)
    .filter((id) => ok(id) && !anc.get(id)!.has(id) && [...anc.get(id)!].every(ok))
    .sort();
}

/** One way an item comes into this character's bag: the tool it takes, and the quest the node waits for. Neither: a free way. */
interface Way {
  tool?: string;
  after?: string;
}

function waysTo(b: Bundle, starter: string, item: string): Way[] {
  const ways: Way[] = [];
  for (const r of Object.values(b.resources)) {
    if (r.output !== item) continue;
    const q = r.opens_after === undefined ? undefined : b.quests[r.opens_after];
    ways.push({ tool: r.tool, after: q && offered(q, starter) ? q.id : undefined });
  }
  for (const t of Object.values(b.treasures)) {
    if (offered(t, starter) && t.finds.some((f) => f.item === item)) ways.push({ tool: t.tool });
  }
  const rewards = [...Object.values(b.quests), ...Object.values(b.expeditions)].flatMap((x) => x.reward?.items ?? []);
  const free =
    Object.values(b.recipes).some((r) => r.outputs.some((o) => o.item === item)) ||
    Object.values(b.shops).some((s) => s.sells.some((o) => o.item === item)) ||
    (b.starters[starter]?.kit ?? []).some((k) => k.item === item) ||
    rewards.some((r) => r.item === item || r.instead === item);
  if (free) ways.push({});
  return ways;
}

/** The one item every way needs as its tool: the axe, for logs. None when a way needs no tool, or tools of two kinds. */
function onlyTool(b: Bundle, ways: readonly Way[]): string | undefined {
  const kinds = new Set(ways.map((w) => w.tool));
  if (ways.length === 0 || kinds.size !== 1 || kinds.has(undefined)) return undefined;
  const tools = Object.entries(b.items).filter(([, i]) => kinds.has(i.tool?.kind));
  return tools.length === 1 ? tools[0]![0] : undefined;
}

/** The one quest every way waits for: the glint, for the keystone. */
function onlyAfter(ways: readonly Way[]): string | undefined {
  const after = new Set(ways.map((w) => w.after));
  return ways.length > 0 && after.size === 1 ? [...after][0] : undefined;
}

/** The items a quest needs to have had in the bag: what its steps name, and the inputs of what it restores, builds or makes. */
function needs(b: Bundle, q: QuestDef): Set<string> {
  const items = new Set<string>();
  for (const s of q.steps) {
    if (s.kind === 'bring' || s.kind === 'find') items.add(s.item);
    else if (s.kind === 'restore') for (const i of b.restores[s.restore]?.inputs ?? []) items.add(i.item);
    else if (s.kind === 'build') for (const i of b.camps[s.camp]?.inputs ?? []) items.add(i.item);
    else if (s.kind === 'make') for (const i of b.recipes[s.recipe]?.inputs ?? []) if ('item' in i) items.add(i.item);
  }
  return items;
}

/** The orders the items make, for one character: for each quest, the quests that are done before it is done. */
function itemOrders(b: Bundle, starter: string, ids: readonly string[]): Map<string, Set<string>> {
  const before = new Map(ids.map((id) => [id, new Set<string>()]));
  // open from the start, with nobody to hand the find to: done the moment the item comes
  const finders = new Map<string, string[]>();
  for (const id of ids) {
    const q = b.quests[id]!;
    const [only] = q.steps;
    if (q.giver || q.requires?.length || q.steps.length !== 1 || only?.kind !== 'find') continue;
    finders.set(only.item, [...(finders.get(only.item) ?? []), id]);
  }
  for (const id of ids) {
    const q = b.quests[id]!;
    for (const item of needs(b, q)) {
      const ways = waysTo(b, starter, item);
      const lock = onlyAfter(ways);
      if (lock !== undefined && lock !== id && before.has(lock)) before.get(id)!.add(lock);
      const tool = onlyTool(b, ways);
      for (const got of tool === undefined ? [item] : [item, tool]) {
        // a giver-less quest that names the item itself is met by the same action as the finder: no order between them
        const named = q.steps.some((s) => (s.kind === 'bring' || s.kind === 'find') && s.item === got);
        if (!q.giver && named) continue;
        for (const finder of finders.get(got) ?? []) if (finder !== id) before.get(id)!.add(finder);
      }
    }
  }
  return before;
}

export function orderOf(b: Bundle, starter: string): Order {
  const quests = reachable(b, starter, ancestry(b));
  const items = itemOrders(b, starter, quests);
  const done = new Map<string, Set<string>>();
  const walk = (id: string, trail: Set<string>): Set<string> => {
    const known = done.get(id);
    if (known) return known;
    const all = new Set<string>();
    if (trail.has(id)) return all;
    trail.add(id);
    for (const r of [...(b.quests[id]!.requires ?? []), ...items.get(id)!]) {
      all.add(r);
      for (const a of walk(r, trail)) all.add(a);
    }
    trail.delete(id);
    done.set(id, all);
    return all;
  };
  for (const id of quests) walk(id, new Set());
  const start = new Map(
    quests.map((id) => [id, new Set((b.quests[id]!.requires ?? []).flatMap((r) => [r, ...done.get(r)!]))]),
  );
  return { quests, done, start };
}

/**
 * The widest set of quests open at once: the widest antichain of "done before
 * it can start" (Dilworth: the quests minus the largest matching between a
 * quest and one that cannot start until it is done).
 */
function width(ids: readonly string[], start: Map<string, Set<string>>): number {
  const later = new Map(ids.map((a) => [a, ids.filter((x) => start.get(x)!.has(a))]));
  const matchedTo = new Map<string, string>();
  const augment = (a: string, seen: Set<string>): boolean => {
    for (const x of later.get(a)!) {
      if (seen.has(x)) continue;
      seen.add(x);
      const holder = matchedTo.get(x);
      if (holder === undefined || augment(holder, seen)) {
        matchedTo.set(x, a);
        return true;
      }
    }
    return false;
  };
  let matched = 0;
  for (const a of ids) if (augment(a, new Set())) matched++;
  return ids.length - matched;
}

export function handOf(b: Bundle, starter: string): Hand {
  const { quests, done, start } = orderOf(b, starter);
  const same: SameAgain[] = [];
  for (const [i, a] of quests.entries()) {
    const ta = b.quests[a]!.type;
    if (ta === undefined) continue;
    for (const c of quests.slice(i + 1)) {
      if (b.quests[c]!.type !== ta) continue;
      const before = done.get(c)!.has(a);
      const after = done.get(a)!.has(c);
      if (!before && !after) {
        same.push({ type: ta, first: a, then: c, how: 'open' });
        continue;
      }
      // one is done before the other: back to back only when nothing has to be done between them
      const [first, then] = before ? [a, c] : [c, a];
      const between = [...done.get(then)!].some((x) => x !== first && done.get(x)!.has(first));
      if (!between) same.push({ type: ta, first, then, how: b.quests[then]!.requires?.includes(first) ? 'requires' : 'needs' });
    }
  }
  return { starter, quests, widest: width(quests, start), same };
}

export function hands(b: Bundle): Hand[] {
  return Object.keys(b.starters)
    .sort()
    .map((s) => handOf(b, s));
}

/** The types the content uses, how often, and the ones it never asks. */
export function typeCounts(b: Bundle, palette: readonly string[]): { used: [string, number][]; unused: string[] } {
  const count = new Map<string, number>();
  for (const q of Object.values(b.quests)) if (q.type) count.set(q.type, (count.get(q.type) ?? 0) + 1);
  return {
    used: [...count].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0])),
    unused: palette.filter((t) => !count.has(t)),
  };
}
