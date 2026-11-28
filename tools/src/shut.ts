/**
 * Quests shut by their content (`shut_until`): nobody offers one and nothing starts it, until what it names exists.
 * `pnpm check` names each, and each quest after one through the requires links, which no new character reaches while
 * it stays shut. Warnings, never errors: a shut quest is a decision the content records, not a fault.
 */
import type { Bundle } from '@game/kernel';
import type { Issue } from './load';

export function checkShut(b: Bundle, origin: Record<string, string>): Issue[] {
  const shut = Object.values(b.quests).filter((q) => q.shut_until !== undefined);
  if (shut.length === 0) return [];
  const issues: Issue[] = shut.map((q) => ({
    file: origin[q.id] ?? q.file ?? '',
    where: 'quest.shut_until',
    message: `${q.id} is shut until ${q.shut_until}: nobody offers it, and a save that took it keeps it`,
    level: 'warning',
  }));
  // a quest after a shut one, through any length of requires, is out of reach while it stays shut
  const after = new Map<string, string>();
  for (let grew = true; grew; ) {
    grew = false;
    for (const q of Object.values(b.quests)) {
      if (q.shut_until !== undefined || after.has(q.id)) continue;
      const by = (q.requires ?? []).map((r) => (b.quests[r]?.shut_until !== undefined ? r : after.get(r))).find((r) => r !== undefined);
      if (by === undefined) continue;
      after.set(q.id, by);
      grew = true;
    }
  }
  for (const [id, by] of [...after].sort(([x], [y]) => x.localeCompare(y))) {
    issues.push({ file: origin[id] ?? b.quests[id]?.file ?? '', where: 'quest.requires', message: `${id} comes after the shut quest ${by}: no new character reaches it until that opens`, level: 'warning' });
  }
  return issues;
}
