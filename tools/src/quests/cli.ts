/**
 * pnpm quests: the picture of the quests a quest designer (a person or the
 * quest-designer agent, .claude/skills/quest-designer) starts from. It only
 * reads the content. Sections: who gives what, the types the valley asks and
 * the ones it never asks, and each starter's hand (src/quests/hand.ts): how
 * many tasks a character can hold at once and which two of one type it can
 * finish back to back by choice. Flags: --json.
 */
import { QUEST_TYPES } from '@game/schema';
import { assemble } from '../assemble';
import { loadAll } from '../load';
import { type SameAgain, hands, typeCounts } from './hand';

const json = process.argv.includes('--json');
const { files } = loadAll();
const b = assemble(files).bundle;
if (!b) {
  console.error('The content does not assemble; run "pnpm check" first.');
  process.exit(1);
}

const all = hands(b);
const types = typeCounts(b, QUEST_TYPES);
const quests = Object.values(b.quests)
  .sort((x, y) => x.id.localeCompare(y.id))
  .map((q) => ({
    id: q.id,
    type: q.type ?? null,
    giver: q.giver ?? null,
    starter: q.starter ?? null,
    requires: q.requires ?? [],
    steps: q.steps.map((s) => s.kind),
    summary: q.summary,
  }));

if (json) {
  console.log(JSON.stringify({ quests, types, hands: all }, null, 2));
  process.exit(0);
}

const name = (id: string | null) => (id === null ? 'by itself' : (b.npcs[id]?.title ?? id));
const out: string[] = ['# The quests', ''];
out.push('| Quest | Type | Given by | Starter | Requires | Steps |', '|---|---|---|---|---|---|');
for (const q of quests) {
  out.push(`| ${q.id} | ${q.type ?? '-'} | ${name(q.giver)} | ${q.starter ?? 'all'} | ${q.requires.join(', ') || '-'} | ${q.steps.join(', ')} |`);
}
out.push('', '## Types', '');
out.push(`Asked: ${types.used.map(([t, n]) => `${t} ${n}`).join(', ')}.`);
out.push(`Never asked: ${types.unused.join(', ') || 'none'}.`);
out.push('', '## The hand: two of one kind back to back, by the player\'s choice', '');
out.push('G17 refuses two of one type along a requires link. A player holding several tasks picks the order, so these pairs');
out.push('can still come one right after the other. The requires links and the orders the items force are read; hours and');
out.push('places are left out: they only narrow the orders.', '');
const said: Record<SameAgain['how'], (s: SameAgain) => string> = {
  open: (s) => `${s.first} and ${s.then} can be open at once, done in either order`,
  needs: (s) => `${s.then} right after ${s.first}, which finds or opens what it needs`,
  requires: (s) => `${s.then} right after ${s.first}, along a requires link (the check refuses this)`,
};
for (const h of all) {
  out.push(`### ${h.starter}: ${h.quests.length} quests, up to ${h.widest} open at once`, '');
  if (h.same.length === 0) out.push('No two of one type can come back to back.');
  for (const how of ['open', 'needs', 'requires'] as const) {
    for (const s of h.same.filter((x) => x.how === how)) out.push(`- ${s.type}: ${said[how](s)}`);
  }
  out.push('');
}
console.log(out.join('\n'));
