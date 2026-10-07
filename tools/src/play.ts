/**
 * The play rules: what docs/design/GAME_RULES.md can test on content. Every
 * line cites its rule and the pattern's name so a creator can read why. They
 * are warnings until the core content is rewritten (GRUNT P-3); that pull
 * request flips PLAY_LEVEL to 'error'.
 */
import type { Bundle } from '@game/kernel';
import type { Issue } from './load';

export const RULES_PAGE = 'docs/design/GAME_RULES.md';

/** The opening chain teaches each verb by repetition; G2 and G4 apply after it. */
export const OPENING_QUESTS: ReadonlySet<string> = new Set(['core/fix-the-bridge', 'core/first-fire', 'core/into-town']);

/** About two lines of dialogue on a phone at the dialogue size (G14). */
export const BOX_CHARS = 80;

/** Flipped to 'error' in the pull request that fixes the core content (P-3). */
export const PLAY_LEVEL: Issue['level'] = 'warning';

export function checkPlay(b: Bundle, origin: Record<string, string>): Issue[] {
  const issues: Issue[] = [];
  const at = (id: string) => origin[id] ?? 'content';
  const rule = (n: string, name: string) => `${RULES_PAGE} ${n}, "${name}"`;

  // An item only digging gives: bringing it, with the spot's hint, is a find (G2).
  const gathered = new Set(Object.values(b.resources).map((r) => r.output));
  const made = new Set(Object.values(b.recipes).flatMap((c) => c.outputs.map((o) => o.item)));
  const sold = new Set(Object.values(b.shops).flatMap((s) => s.sells.map((o) => o.item)));
  const dug = new Set(Object.values(b.treasures).flatMap((t) => t.finds.map((f) => f.item)));
  const isFind = (item: string) => dug.has(item) && !gathered.has(item) && !made.has(item) && !sold.has(item);

  for (const q of Object.values(b.quests)) {
    if (OPENING_QUESTS.has(q.id)) continue;
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
    if ((r.items?.length ?? 0) + (r.recipes?.length ?? 0) === 0) {
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

  const notes = b.map.props.filter((p) => p.note !== undefined).length;
  if (notes > 0) {
    issues.push({
      file: at(b.map.id),
      where: 'map.props',
      message: `${notes} inscription${notes === 1 ? '' : 's'} that no quest, treasure or character refers to (${rule('G8', 'free read')}); the riddle step and prop ids come with GRUNT P-2`,
      level: PLAY_LEVEL,
    });
  }

  return issues;
}
