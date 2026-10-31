/**
 * The balance playtest (NEXT 19 b, "checked against a playtest"): the simulated player of
 * `server/test/sim` plays its scripted session on the kernel itself, one run per start it knows
 * (each start wakes in its own pocket), and at every place it first stands in or next to it notes
 * the game time, the gold and the level it really has, next to the level the difficulty reckoning
 * expects there for that pocket. It prints a table and writes nothing.
 *
 * It is the quest-follower's measure: the opening, the first outing and the first sale as the
 * content scripts them, no grinding. The reckoning's level counts the grinding open on the way
 * (up to `grind_passes_max` passes) and the quests it counts as done before the place; the gap is
 * what those two add over the scripted road, and the quest-experience column shows how much of it
 * is quests the follower has not yet been handed.
 *
 * Two ladders read the same experience: each profession's `xp_levels` in the kernel (the level
 * the player sees) and the reckoning's one curve (`t1_ms`, `ratio_permille`). Both levels are
 * reported, and the gap is read on the curve, the reckoning's own ladder; where the two columns
 * differ, the ladders read the same work differently (the kernel's best school need not be the
 * leading one).
 */
import {
  type Action,
  type Bundle,
  type PublicState,
  type State,
  characterLevel,
  near,
  newState,
  professionLevel,
  publicState,
  step,
} from '@game/kernel';

import { type ActResult, type Hands, Player } from '../../../server/test/sim/player.js';
import { STARTS, type Start, playSession } from '../../../server/test/sim/session.js';
import { levelOf, thresholdsMs } from './curve';
import type { PlaceRow, PocketLevel } from './reckon';
import type { Rules } from './rules';

/** What the player had when it first stood in or next to a place. */
export interface Visit {
  slot: string;
  kind: string;
  /** game time since the start, in ms */
  tick: number;
  /** milli-gold */
  gold: number;
  hp: number;
  /** the school with the most experience, and its active ms */
  school: string;
  xpMs: number;
  /** every school's experience together, in ms */
  xpAllMs: number;
  /** the leading school's level on the reckoning's curve */
  levelCurve: number;
  /** the best profession level on the kernel's own ladders */
  levelKernel: number;
  charLevel: number;
  /** the reckoning's expectation for this place from the run's pocket; null when it has none */
  expected: PocketLevel | null;
  /** levelCurve minus the expected level; null without an expectation */
  gap: number | null;
}

/** One start's session, with the places in the order they were reached. */
export interface PlaytestRun {
  starter: string;
  /** the pocket the start woke in, as the kernel set it */
  pocket: string;
  /** the world seed the draws came from */
  seed: number;
  /** game time the session took, in ms */
  gameMs: number;
  actions: number;
  moves: number;
  /** milli-gold at the end */
  gold: number;
  /** the first sale: what went and what the trader paid (milli-gold); empty when the run stopped before it */
  sold: string;
  paidMg: number;
  /** every school's active ms at the end */
  xp: Record<string, number>;
  visits: Visit[];
  /** the error that stopped the run, when it did not finish; the visits before it are kept */
  failed?: string;
}

/**
 * The player's hands on the kernel itself: no server and no wire, the tick is the run's own clock.
 * A movement report is kept with the tick it was made at and applied in order at `flushMoves`,
 * under the kernel's travel rule (G56); the server's movement-time credit is not applied here,
 * the sim test over the wire covers it.
 */
export class KernelHands implements Hands {
  tick = 0;
  private raw: State;
  private pub: PublicState | null = null;
  private pending: { at: [number, number]; tick: number }[] = [];

  constructor(
    private readonly bundle: Bundle,
    seed: number,
    /** called after every action the kernel accepted, with the state it left and the tick it ran at */
    private readonly observe?: (state: PublicState, tick: number) => void,
  ) {
    this.raw = newState(bundle, seed);
  }

  get state(): PublicState {
    if (this.pub === null) this.pub = publicState(this.raw);
    return this.pub;
  }

  advance(dt: number): void {
    this.tick += dt;
  }

  report(at: readonly [number, number]): void {
    this.pending.push({ at: [at[0], at[1]], tick: this.tick });
  }

  async flushMoves(): Promise<void> {
    const moves = this.pending;
    this.pending = [];
    for (const m of moves) {
      const r = this.apply({ t: 'move', at: m.at }, m.tick);
      if (!r.ok) throw new Error(`The move to ${m.at[0]},${m.at[1]} at ${m.tick} ms was refused: ${r.error}`);
    }
  }

  async act(action: Action): Promise<ActResult> {
    const r = this.apply(action, this.tick);
    return r.ok ? { ok: true, events: r.events } : { ok: false, error: r.error };
  }

  private apply(action: Action, tick: number) {
    const r = step(this.bundle, this.raw, action, tick, { validateTravel: true });
    if (r.ok) {
      this.raw = r.state;
      this.pub = null;
      this.observe?.(this.state, tick);
    }
    return r;
  }
}

function standing(bundle: Bundle, rules: Rules, state: PublicState): Pick<Visit, 'school' | 'xpMs' | 'xpAllMs' | 'levelCurve' | 'levelKernel' | 'charLevel'> {
  let school = '';
  let xpMs = -1;
  let xpAllMs = 0;
  let levelKernel = 1;
  for (const id of Object.keys(bundle.professions).sort()) {
    const xp = state.player.xp[id] ?? 0;
    xpAllMs += xp;
    levelKernel = Math.max(levelKernel, professionLevel(bundle, state, id));
    if (xp > xpMs) {
      school = id;
      xpMs = xp;
    }
  }
  xpMs = Math.max(0, xpMs);
  return { school, xpMs, xpAllMs, levelCurve: levelOf(rules, xpMs), levelKernel, charLevel: characterLevel(bundle, state) };
}

/**
 * The observer that turns the first step onto or next to each place into a visit. The expectation
 * is the reckoning's for the pocket the kernel woke the character in (the start sets it before the
 * first place can be reached).
 */
function arrivals(bundle: Bundle, rules: Rules, rows: readonly PlaceRow[], visits: Visit[]): (state: PublicState, tick: number) => void {
  const seen = new Set<string>();
  return (state, tick) => {
    const at: readonly [number, number] = [state.player.at[0], state.player.at[1]];
    for (const slot of bundle.map.slots) {
      if (seen.has(slot.id) || !near(at, slot)) continue;
      seen.add(slot.id);
      const row = rows.find((r) => r.slot === slot.id);
      // a pocket entry with no steps is the reckoning's placeholder for a place its wake cannot reach, not an expectation
      const found = row?.byPocket.find((p) => p.pocket === state.player.pocket);
      const expected = found !== undefined && found.steps !== null ? found : null;
      const now = standing(bundle, rules, state);
      visits.push({
        slot: slot.id,
        kind: row?.kind ?? slot.kind,
        tick,
        gold: state.player.gold,
        hp: state.player.hp,
        ...now,
        expected,
        gap: expected === null ? null : now.levelCurve - expected.level,
      });
    }
  };
}

/** One start's session from one seed, measured place by place. */
export async function playtestRun(bundle: Bundle, rules: Rules, rows: readonly PlaceRow[], start: Start, seed: number): Promise<PlaytestRun> {
  const visits: Visit[] = [];
  const hands = new KernelHands(bundle, seed, arrivals(bundle, rules, rows, visits));
  const player = new Player(bundle, hands, { now: 0 });
  const run: PlaytestRun = { starter: start.starter, pocket: '', seed, gameMs: 0, actions: 0, moves: 0, gold: 0, sold: '', paidMg: 0, xp: {}, visits };
  try {
    const summary = await playSession(bundle, player, start);
    run.sold = summary.sold;
    run.paidMg = summary.paidMg;
  } catch (e) {
    run.failed = e instanceof Error ? e.message : String(e);
  }
  run.pocket = hands.state.player.pocket;
  run.gameMs = player.tick;
  run.actions = player.log.filter((entry) => entry.a.t !== 'move').length;
  run.moves = player.log.filter((entry) => entry.a.t === 'move').length;
  run.gold = hands.state.player.gold;
  for (const id of Object.keys(bundle.professions).sort()) run.xp[id] = hands.state.player.xp[id] ?? 0;
  return run;
}

/** Every start the simulated player knows, from one world seed (1 unless another is given). */
export async function playtest(bundle: Bundle, rules: Rules, rows: readonly PlaceRow[], options: { seed?: number } = {}): Promise<PlaytestRun[]> {
  const seed = options.seed ?? 1;
  const runs: PlaytestRun[] = [];
  for (const start of STARTS) runs.push(await playtestRun(bundle, rules, rows, start, seed));
  return runs;
}

const short = (id: string): string => id.replace(/^core\//, '');
const tenths = (value: number, unit: number): string => `${Math.trunc(value / unit)}.${Math.trunc((value % unit) / (unit / 10))}`;
const minutes = (ms: number): string => tenths(ms, 60_000);
const gold = (mg: number): string => tenths(mg, 1000);
const seconds = (ms: number): string => String(Math.trunc(ms / 1000));

/** The two ladders side by side: seconds of active work to each of the first levels. */
export function formatLadders(bundle: Bundle, rules: Rules, levels = 5): string {
  const curve = thresholdsMs(rules).slice(0, levels - 1).map(seconds);
  const parts = [`curve ${curve.join(' ')}`];
  for (const id of Object.keys(bundle.professions).sort()) {
    const own = bundle.professions[id]!.xp_levels.slice(0, levels - 1).map(String);
    parts.push(`${short(id)} ${own.join(' ')}`);
  }
  const heads = Array.from({ length: levels - 1 }, (_, i) => `L${i + 2}`).join(' ');
  return `ladders (s of active work to ${heads}): ${parts.join(' | ')}`;
}

/** The table a designer reads: one block per run, one line per place, and the places under the reckoning in every run. */
export function formatPlaytest(runs: readonly PlaytestRun[], bundle: Bundle, rules: Rules): string {
  const out: string[] = [
    'The balance playtest (NEXT 19 b): the simulated player plays the scripted opening, first outing and first sale',
    'on the kernel, one run per start (each wakes in its own pocket), no grinding. At each place it first stands in or next to:',
    'game minutes since the start, gold, the leading school\'s level on the reckoning\'s curve / the best profession level on',
    `the kernel's ladders, its experience (leading school / all schools, s), then the reckoning's level for that place and`,
    `pocket (the quests it counts as done before it and grinding up to ${rules.grindPassesMax} passes), its quest and grind experience,`,
    "and the gap (the curve level minus the reckoning's; under is negative).",
    '',
    formatLadders(bundle, rules),
  ];
  const head = ['place'.padEnd(18), 'min'.padStart(6), 'gold'.padStart(6), 'L c/k'.padStart(6), 'xp s'.padStart(9), '| reckon', 'quest s'.padStart(8), 'grind s'.padStart(8), 'gap'.padStart(5)].join(' ');
  for (const run of runs) {
    const judged = run.visits.filter((v) => v.gap !== null);
    const under = judged.filter((v) => (v.gap ?? 0) < 0);
    const worst = under.reduce<Visit | null>((a, v) => (a === null || (v.gap ?? 0) < (a.gap ?? 0) ? v : a), null);
    const sale = run.sold ? `sold ${short(run.sold)} for ${gold(run.paidMg)} gold` : 'no sale';
    out.push('');
    out.push(`== ${short(run.starter)} from ${short(run.pocket) || 'the spawn'} (seed ${run.seed}): ${minutes(run.gameMs)} game min, ${run.actions} actions, ${run.moves} moves, ${sale}, ${gold(run.gold)} gold at the end`);
    out.push(`   ${under.length} of ${judged.length} places under the reckoning${worst ? ` (worst ${worst.gap} at ${short(worst.slot)})` : ''}, ${judged.filter((v) => v.gap === 0).length} at it, ${judged.filter((v) => (v.gap ?? 0) > 0).length} above`);
    if (run.failed) out.push(`   stopped: ${run.failed}`);
    out.push(head);
    for (const v of run.visits) {
      const e = v.expected;
      out.push(
        [
          short(v.slot).padEnd(18),
          minutes(v.tick).padStart(6),
          gold(v.gold).padStart(6),
          `${v.levelCurve}/${v.levelKernel}`.padStart(6),
          `${seconds(v.xpMs)}/${seconds(v.xpAllMs)}`.padStart(9),
          `| ${e ? `L${e.level}` : '-'}`.padEnd(8),
          (e ? seconds(e.questXpMs) : '-').padStart(8),
          (e ? seconds(e.grindXpMs) : '-').padStart(8),
          (v.gap === null ? '-' : v.gap > 0 ? `+${v.gap}` : String(v.gap)).padStart(5),
        ].join(' '),
      );
    }
  }
  const always = alwaysUnder(runs);
  out.push('');
  out.push(always.length > 0 ? `under the reckoning in every run (the mildest gap): ${always.map((a) => `${short(a.slot)} (${a.gap})`).join(', ')}` : 'no place is under the reckoning in every run');
  return out.join('\n');
}

/** The places every run reached under the reckoning, with the mildest gap seen there. */
export function alwaysUnder(runs: readonly PlaytestRun[]): { slot: string; gap: number }[] {
  if (runs.length === 0) return [];
  const slots = new Set(runs[0]!.visits.filter((v) => v.gap !== null).map((v) => v.slot));
  const out: { slot: string; gap: number }[] = [];
  for (const slot of [...slots].sort()) {
    const gaps = runs.map((run) => run.visits.find((v) => v.slot === slot)?.gap ?? null);
    if (gaps.some((g) => g === null || g >= 0)) continue;
    out.push({ slot, gap: Math.max(...gaps.map((g) => g ?? 0)) });
  }
  return out;
}
