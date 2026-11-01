/**
 * The sea crossing's rules (docs/design/SEA_CROSSING.md sections 3 and 5): what `pnpm check` tests on every passage.
 * The boat's table must be one a player can live through: each event warns a segment before it strikes and fits
 * inside the crossing, each answer can be given, and nothing aboard pays more than the minutes it takes. Every item a
 * passage names already has a value, so the boat is never the only source of a thing.
 */
import { type Bundle, payFor, seaWindow } from '@game/kernel';
import type { Issue } from './load';
import { BOX_CHARS, RULES_PAGE } from './play';

export function checkSea(b: Bundle, origin: Record<string, string>): Issue[] {
  const issues: Issue[] = [];
  const rule = (n: string, name: string) => `${RULES_PAGE} ${n}, "${name}"`;
  const exits = b.map.plan?.exits ?? [];
  for (const p of Object.values(b.passages)) {
    const file = origin[p.id] ?? p.file;
    const err = (where: string, message: string) => issues.push({ file, where, message, level: 'error' });
    const warn = (where: string, message: string) => issues.push({ file, where, message, level: 'warning' });
    const valued = (where: string, item: string) => {
      if (b.items[item] && b.values[item] === undefined) err(where, `${item} has no value: a crossing names only things another source already prices (SEA_CROSSING.md section 3)`);
    };
    const lines = (where: string, texts: readonly string[]) =>
      texts.forEach((t, i) => {
        if (t.length > BOX_CHARS) warn(`${where}.${i}`, `${t.length} characters, over ${BOX_CHARS}: about two phone lines (${rule('G14', 'lore wall')})`);
      });

    if (p.to !== undefined && p.to === p.from) err('passage.to', 'a passage that lands where it leaves leaves `to` out');
    // G71: the far bank is ground of another world, so a passage that lands there leaves only from an exit the road length already holds
    const from = exits.find((x) => x.id === p.from);
    if (p.to !== undefined && from && from.min_road_steps === undefined) {
      warn('passage.from', `${p.from} declares no min_road_steps, and this boat lands at ${p.to}: measure that the crossing does not shorten the first day (${rule('G71', 'the first night is held by size')})`);
    }
    if (p.fare) valued('passage.fare.item', p.fare.item);
    // the ladder holds the first minutes, and the crossing is part of an opening (DECISIONS 2026-10-22 "The opening pool and the region quests")
    if (!p.requires?.length) warn('passage.requires', `no quest opens this boat, so a player can take it from the first minute: name the quest of the opening it belongs to (${RULES_PAGE} section 2, the ladder)`);
    lines('passage.board', p.board);
    lines('passage.land', p.land);
    lines('passage.back', p.back);

    // nothing aboard pays more than the minutes the crossing takes, at the trader's share (R8)
    const ceiling = payFor(b.params, p.segments * p.segment_ms);
    const seen = new Map<string, string>();
    p.events.forEach((e, i) => {
      const where = `passage.events.${i}`;
      if (seen.has(e.id)) err(`${where}.id`, `"${e.id}" is the id of another event of this passage`);
      const twin = [...seen.entries()].find(([, type]) => type === e.type);
      if (twin) warn(`${where}.type`, `"${e.id}" pays the same feeling as "${twin[0]}" (${e.type}): one event of each type (${rule('G17', 'variety')})`);
      seen.set(e.id, e.type);

      // warn, then strike: the sign shows on a segment before the window, and a segment is sailed after it
      if (p.segments - e.window < 2) err(`${where}.window`, `a window of ${e.window} leaves no segment for the sign before it or the sea after it in ${p.segments} segments`);
      const { first, last } = seaWindow(p, e);
      if (first < 2 || last >= p.segments) err(`${where}.window`, `the window (segments ${first} to ${last}) must sit inside the crossing's ${p.segments} segments with one before it`);
      const act = e.act;
      if (act.kind === 'tend' && act.times > e.window) err(`${where}.act.times`, `${act.times} answers do not fit a window of ${e.window} segments, one answer a segment`);
      if (act.kind === 'riddle' && act.answer >= act.choices.length) err(`${where}.act.answer`, `answer ${act.answer} is not one of the ${act.choices.length} choices (counted from 0)`);
      if (act.kind === 'riddle') lines(`${where}.act.clue`, [act.clue]);
      if (act.kind === 'bring') valued(`${where}.act.item`, act.item);

      const items = e.reward.items ?? [];
      items.forEach((s, j) => valued(`${where}.reward.items.${j}`, s.item));
      const worth = (e.reward.gold_mg ?? 0) + items.reduce((n, s) => n + payFor(b.params, b.values[s.item] ?? 0) * s.qty, 0);
      if (worth > ceiling) err(`${where}.reward`, `pays ${worth} mg, over the ${ceiling} mg the crossing's ${p.segments * p.segment_ms} ms are worth at the trader's share`);
      if (items.length === 0 && (e.reward.gold_mg ?? 0) > 0) warn(`${where}.reward`, `gold only: nothing the player can newly hold (${rule('G4', 'gold for gold')})`);
      lines(`${where}.sign`, e.sign);
      lines(`${where}.met`, e.met);
      lines(`${where}.missed`, e.missed);
    });
  }
  return issues;
}
