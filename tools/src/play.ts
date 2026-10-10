/**
 * The play rules: what docs/design/GAME_RULES.md can test on content. Every
 * line cites its rule and the pattern's name so a creator can read why. They
 * are errors since the core content was rewritten to pass them (GRUNT P-3,
 * 8.10): a breach stops the check, core and extensions alike.
 */
import type { Bundle, QuestDef } from '@game/kernel';
import { QUEST_TYPES } from '@game/schema';
import type { Issue } from './load';

export const RULES_PAGE = 'docs/design/GAME_RULES.md';

/** The opening chain teaches each verb by repetition; G2 and G4 apply after it. */
export const OPENING_QUESTS: ReadonlySet<string> = new Set(['core/fix-the-bridge', 'core/first-fire', 'core/into-town']);

/**
 * The opening as the content names it: the shared chain, and each start's own
 * first task, a quest that names its starter (DECISIONS.md, 2026-10-09: each
 * character begins its own way, and the opening chain names each first task).
 */
export function openingQuests(b: Bundle): Set<string> {
  return new Set([...OPENING_QUESTS, ...Object.values(b.quests).flatMap((q) => (q.starter === undefined ? [] : [q.id]))]);
}

/** What a start's own spots give: a gift of the start, which its own first task may name as a find. */
export function startFinds(b: Bundle, starter: string): Set<string> {
  return new Set(Object.values(b.treasures).flatMap((t) => (t.starter === starter ? t.finds.map((f) => f.item) : [])));
}

/** About two lines of dialogue on a phone at the dialogue size (G14). */
export const BOX_CHARS = 80;

/** Errors since the pull request that rewrote the core content (P-3, 8.10). */
export const PLAY_LEVEL: Issue['level'] = 'error';

/** Items that only digging gives: never gathered, made or sold. */
export function digOnlyItems(b: Bundle): Set<string> {
  const gathered = new Set(Object.values(b.resources).map((r) => r.output));
  const made = madeItems(b);
  const sold = soldItems(b);
  // a start's own spot is a gift, not a source
  const dug = Object.values(b.treasures).flatMap((t) => (t.starter === undefined ? t.finds.map((f) => f.item) : []));
  return new Set(dug.filter((item) => !gathered.has(item) && !made.has(item) && !sold.has(item)));
}

/**
 * Items a `find` step may name: what only digging gives, and what exactly one
 * timed plant gives (a resource with `hours`), as long as nothing makes or
 * sells it. Bringing one, with a clue, is a find and not a counter (G2).
 */
export function findableItems(b: Bundle): Set<string> {
  const out = digOnlyItems(b);
  const made = madeItems(b);
  const sold = soldItems(b);
  const givers = new Map<string, number>();
  for (const r of Object.values(b.resources)) givers.set(r.output, (givers.get(r.output) ?? 0) + 1);
  for (const r of Object.values(b.resources)) {
    if (r.hours === undefined || givers.get(r.output) !== 1 || made.has(r.output) || sold.has(r.output)) continue;
    out.add(r.output);
  }
  return out;
}

function madeItems(b: Bundle): Set<string> {
  return new Set(Object.values(b.recipes).flatMap((c) => c.outputs.map((o) => o.item)));
}

function soldItems(b: Bundle): Set<string> {
  return new Set(Object.values(b.shops).flatMap((s) => s.sells.map((o) => o.item)));
}

/** The first quests a player meets: by the length of their requires chain, then by id. */
export function firstQuests(b: Bundle, n: number): QuestDef[] {
  const depth = new Map<string, number>();
  const depthOf = (id: string, trail: Set<string>): number => {
    const known = depth.get(id);
    if (known !== undefined) return known;
    if (trail.has(id)) return 0;
    trail.add(id);
    const q = b.quests[id];
    const d = q ? Math.max(0, ...(q.requires ?? []).map((r) => depthOf(r, trail) + 1)) : 0;
    depth.set(id, d);
    return d;
  };
  return Object.values(b.quests)
    .sort((x, y) => depthOf(x.id, new Set()) - depthOf(y.id, new Set()) || x.id.localeCompare(y.id))
    .slice(0, n);
}

export function checkPlay(b: Bundle, origin: Record<string, string>): Issue[] {
  const issues: Issue[] = [];
  const at = (id: string) => origin[id] ?? 'content';
  const rule = (n: string, name: string) => `${RULES_PAGE} ${n}, "${name}"`;

  // A bring of something only digging or one timed plant gives is a find (G2). The find and riddle steps are beats by kind.
  const findable = findableItems(b);
  const isFind = (item: string) => findable.has(item);

  const opening = openingQuests(b);
  for (const q of Object.values(b.quests)) {
    if (opening.has(q.id)) continue;
    const counter = q.steps.every((s) => s.kind === 'visit' || (s.kind === 'bring' && !isFind(s.item)));
    if (counter) {
      issues.push({
        file: at(q.id),
        where: 'quest.steps',
        message: `every step is bring or visit: a counter, not a question (${rule('G2', 'click-until-done')})`,
        level: PLAY_LEVEL,
      });
    }
    const r = q.reward;
    // items, recipes and places opened are all something the player can newly do
    if ((r.items?.length ?? 0) + (r.recipes?.length ?? 0) + (r.opens?.length ?? 0) === 0) {
      issues.push({
        file: at(q.id),
        where: 'quest.reward',
        message: `gold and reputation only: nothing the player can newly do (${rule('G4', 'gold for gold')})`,
        level: PLAY_LEVEL,
      });
    }
  }

  for (const c of Object.values(b.camps)) {
    if (c.provides === undefined && c.bag_bonus === undefined) {
      issues.push({
        file: at(c.id),
        where: 'camp',
        message: `no station and no bag bonus: a build must change play, a panel gets a button (${rule('G10', 'menu in disguise')})`,
        level: PLAY_LEVEL,
      });
    }
  }

  // G14 and G21: talk stays short, counted per character so one line names the problem.
  for (const n of Object.values(b.npcs)) {
    const d = n.dialogue;
    const over: string[] = [];
    if (d.first !== undefined && d.first.length > 3) over.push(`first meeting ${d.first.length} boxes (3 at most)`);
    for (const standing of ['stranger', 'acquaintance', 'friend', 'family'] as const) {
      const lines = d[standing];
      if (lines !== undefined && lines.length > 2) over.push(`${standing} ${lines.length} boxes (2 at most)`);
    }
    for (const t of n.topics ?? []) if (t.lines.length > 4) over.push(`topic "${t.ask}" ${t.lines.length} boxes (4 at most)`);
    if (over.length > 0) {
      issues.push({
        file: at(n.id),
        where: 'npc.dialogue',
        message: `${over.join(', ')}: the player pulls, the rest waits behind a topic (${rule('G21', 'lore wall')})`,
        level: PLAY_LEVEL,
      });
    }
    const boxes = [d.first ?? [], d.stranger, d.acquaintance ?? [], d.friend ?? [], d.family ?? [], ...(n.topics ?? []).map((t) => t.lines)].flat();
    const long = boxes.filter((line) => line.length > BOX_CHARS).length;
    if (long > 0) {
      issues.push({
        file: at(n.id),
        where: 'npc.dialogue',
        message: `${long} of ${boxes.length} boxes over ${BOX_CHARS} characters, about two phone lines (${rule('G14', 'lore wall')})`,
        level: PLAY_LEVEL,
      });
    }
  }

  // G8: an inscription pays only when a riddle cites its prop; a prop without an id cannot be cited.
  const cited = new Set(Object.values(b.quests).flatMap((q) => q.steps.flatMap((st) => (st.kind === 'riddle' ? st.props : []))));
  let unnamed = 0;
  for (const p of b.map.props) {
    if (p.note === undefined) continue;
    if (p.id === undefined) {
      unnamed++;
      continue;
    }
    if (!cited.has(p.id)) {
      issues.push({
        file: at(b.map.id),
        where: `map.props.${p.id}`,
        message: `"${p.id}" has an inscription that no riddle cites (${rule('G8', 'free read')})`,
        level: PLAY_LEVEL,
      });
    }
  }
  if (unnamed > 0) {
    issues.push({
      file: at(b.map.id),
      where: 'map.props',
      message: `${unnamed} inscription${unnamed === 1 ? '' : 's'} on props without an id, so no riddle can cite ${unnamed === 1 ? 'it' : 'them'} (${rule('G8', 'free read')}); give the prop an id and a riddle, or cut the note`,
      level: PLAY_LEVEL,
    });
  }

  // G17: every quest names its type; no two of one type in a row along the requires links; five types among the first ten quests.
  for (const q of Object.values(b.quests)) {
    if (q.type === undefined) {
      issues.push({
        file: at(q.id),
        where: 'quest.type',
        message: `no type: name the question it asks, one of ${QUEST_TYPES.join(', ')} (${rule('G17', 'same again')})`,
        level: PLAY_LEVEL,
      });
      continue;
    }
    for (const r of q.requires ?? []) {
      if (b.quests[r]?.type !== q.type) continue;
      issues.push({
        file: at(q.id),
        where: 'quest.type',
        message: `${q.type} right after "${r}", also ${q.type}: two of one kind in a row (${rule('G17', 'same again')})`,
        level: PLAY_LEVEL,
      });
    }
  }
  const first = firstQuests(b, 10);
  const head = first[0];
  if (head && first.length === 10 && first.every((q) => q.type !== undefined)) {
    const types = new Set(first.map((q) => q.type));
    if (types.size < 5) {
      issues.push({
        file: at(head.id),
        where: 'quest.type',
        message: `${types.size} type${types.size === 1 ? '' : 's'} among the first ten quests (${first.map((q) => q.id).join(', ')}): five at least (${rule('G17', 'same again')})`,
        level: PLAY_LEVEL,
      });
    }
  }

  return issues;
}
