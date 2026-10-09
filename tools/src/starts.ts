/**
 * Wood and the first starts (DECISIONS.md, 2026-10-09: no fallen branches, the
 * first fire is built from a felled tree; 2026-10-10: the axe and the first
 * starts). No start ends at a wall: wood comes only from felling, every
 * character can hold an axe before the first fire, an axe that breaks can be
 * bought again, and the opening never asks for more logs than the valley's
 * trees give when the world is new.
 */
import type { Bundle } from '@game/kernel';
import type { Issue } from './load';
import { isTool, isWood } from './material';
import { OPENING_QUESTS } from './play';

export function checkStarts(b: Bundle, origin: Record<string, string>): Issue[] {
  const issues: Issue[] = [];
  const at = (id: string) => origin[id] ?? 'content';
  const err = (file: string, where: string, message: string) => issues.push({ file, where, message, level: 'error' });

  // wood comes only from felling
  for (const r of Object.values(b.resources)) {
    if (isWood(b, r.output) && r.tool !== 'axe') {
      err(at(r.id), 'node.tool', `${r.output} is wood, and wood comes only from felling a tree: the node needs "tool": "axe"`);
    }
  }
  for (const t of Object.values(b.treasures)) {
    t.finds.forEach((f, i) => {
      if (isWood(b, f.item)) err(at(t.id), `dig.finds.${i}.item`, `${f.item} is wood, and wood comes only from felling a tree: digging never gives it`);
    });
  }

  const trees = Object.values(b.resources).filter((r) => r.tool === 'axe');
  if (trees.length === 0) return issues;

  // an axe wears out; Pell sells another, or the player is stuck
  const sold = Object.values(b.shops).some((s) => s.sells.some((o) => isTool(b, o.item, 'axe')));
  if (!sold) err(at(trees[0]!.id), 'node.tool', 'a tree needs an axe, and no shop sells one: a broken axe would end the game for the player');

  // every character can hold an axe before the first fire
  for (const s of Object.values(b.starters)) {
    if (!(s.kit ?? []).some((k) => isTool(b, k.item, 'axe'))) {
      err(at(s.id), 'starter.kit', 'this start holds no axe, and the first fire is built from a felled tree: put an axe in the kit (no start ends at a wall)');
    }
  }

  // the opening asks for no more of an item a tree gives than the trees give grown, on a new valley
  const given = new Map<string, number>();
  for (const r of trees) given.set(r.output, (given.get(r.output) ?? 0) + r.yield * r.count);
  const asked = new Map<string, number>();
  const ask = (item: string, qty: number) => {
    if (given.has(item)) asked.set(item, (asked.get(item) ?? 0) + qty);
  };
  for (const id of OPENING_QUESTS) {
    for (const step of b.quests[id]?.steps ?? []) {
      if (step.kind === 'build') for (const s of b.camps[step.camp]?.inputs ?? []) ask(s.item, s.qty);
      if (step.kind === 'make') for (const s of b.recipes[step.recipe]?.inputs ?? []) ask(s.item, s.qty);
      if (step.kind === 'restore') for (const s of b.restores[step.restore]?.inputs ?? []) ask(s.item, s.qty);
    }
  }
  for (const [item, qty] of asked) {
    const have = given.get(item) ?? 0;
    if (qty > have) {
      err('content/core', 'opening', `the opening asks for ${qty} of ${item}, and the trees of a new valley give ${have}: more trees, or less to build`);
    }
  }
  return issues;
}
