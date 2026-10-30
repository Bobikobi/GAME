/**
 * Where the e2e runs wake (DECISIONS.md, 2026-10-22). The world's seed draws the wake pocket, never the
 * race, so a run fixes its seed with `?debug&seed=N` (game/src/session.ts debugSeed) to wake where it
 * means to. game/test/wakes.test.ts pins every seed here to its pocket with the kernel's own draw. Each is
 * the first seed from 1 that wakes there under the keyed draw of kernel 0.20, the number widened to a key.
 */
export const WAKE_SEEDS = { 'core/west-bank': 6, 'core/north-meadow': 3, 'core/slid-bank': 1 } as const;
export type WakePocket = keyof typeof WAKE_SEEDS;

/**
 * A west-bank seed whose first draw on one spot of the collapsed hall is under the whole bowl's chance at the worst timing:
 * the lucky digger who finds the bowl on the first dig, so the wait for the grove at 17:00 is the longest it can be.
 */
export const LUCKY_BOWL = { seed: 487, pocket: 'core/west-bank', spot: 'core/ruins-hall#0' } as const;

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

/**
 * In the page: the character's name cut, as the stone's carve does it. A start leaves the name empty, and the
 * stone at the bridge is the only place it is chosen; the scripts that do not play the mend cut it with this.
 */
export function carveIn(name: string): string {
  return `window.__game.session.act({ t: 'carve', name: ${JSON.stringify(name)} })`;
}
