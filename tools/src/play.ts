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
