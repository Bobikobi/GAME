/**
 * Where the e2e runs wake (DECISIONS.md, 2026-10-22). The world's seed draws the wake pocket, never the
 * race, so a run fixes its seed with `?debug&seed=N` (game/src/session.ts debugSeed) to wake where it
 * means to. game/test/wakes.test.ts pins every seed here to its pocket with the kernel's own draw.
 */
export const WAKE_SEEDS = { 'core/west-bank': 1, 'core/north-meadow': 2, 'core/slid-bank': 3 } as const;
export type WakePocket = keyof typeof WAKE_SEEDS;

/** The query that wakes a new game in a pocket, appended after `?debug`. */
export function seedQuery(pocket: WakePocket): string {
  return `&seed=${WAKE_SEEDS[pocket]}`;
}

/**
 * In the page: the wake pocket's tools handed over as if picked up off the ground, and the spots that lay
 * them spent. For the scripts that test something past the first morning; the opening picks them up by hand.
 */
export const TAKE_GROUND = `(() => {
  const g = window.__game, s = g.session, b = g.bundle, p = s.state.player;
  const ground = b.pockets[p.pocket]?.ground ?? [];
  for (const k of ground) {
    p.bag[k.item] = (p.bag[k.item] ?? 0) + k.qty;
    if (!p.journal.includes(k.item)) p.journal = [...p.journal, k.item].sort();
  }
  for (const [id, i] of Object.entries(b.instances)) {
    const t = i.kind === 'treasure' ? b.treasures[i.source] : undefined;
    if (t && t.pocket === p.pocket && !t.tool && t.finds.every((f) => ground.some((k) => k.item === f.item))) s.state.nodes[id] = { readyAt: 0, draws: 1 };
  }
  return ground.length;
})()`;
