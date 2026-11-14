import { beforeAll, describe, expect, it } from 'vitest';
import { type Bundle, type FightInput, type FightWorld, fightTick } from '@game/kernel';
import { loadBundle } from '../../tools/test/helpers/world.js';
import { fightArena, fightScripts, scriptInputs, scriptWorld } from './fight-scripts.js';
import { fightYard, fuzzAccounts, fuzzInputs, fuzzWorld } from './fight-fuzz.js';

type Tile = readonly [number, number];
type Result = ReturnType<typeof fightTick>;
type Told = Extract<Result['events'][number], { e: 'hit' | 'fight_miss' | 'fight_guard' | 'fight_dodge' }>;

// Geometry is written out here, not imported: the count must not lean on the code it checks.
const span = (a: Tile, z: Tile): number => Math.max(Math.abs(a[0] - z[0]), Math.abs(a[1] - z[1]));
const reaches = (from: Tile, to: Tile, face: Tile, reach: number): boolean =>
  (face[0] === 0 || face[1] === 0) && span(from, to) > 0 && span(from, to) <= reach
  && Math.sign(to[0] - from[0]) === face[0] && Math.sign(to[1] - from[1]) === face[1];
const isTold = (e: Result['events'][number]): e is Told =>
  e.e === 'hit' || e.e === 'fight_miss' || e.e === 'fight_guard' || e.e === 'fight_dodge';

/**
 * Counts the strikes that resolve from the world before a tick and its inputs, never from the events, then holds the events
 * to that count: one outcome per strike, a strike never told twice anywhere in the run, and the miss, guard and dodge
 * relations. A tick that ends a pairing (a disengage event) may cancel a strike on the way, so there the count is a ceiling.
 */
class Ledger {
  tally: Record<string, number> = {};
  strictTicks = 0;
  endedTicks = 0;
  resolvedFoeMoves = 0;
  private told = new Set<string>();
  private origins: Record<string, { at: Tile; tick: number }> = {};
  /** A dodge the player truly made out of this move's reach (by the independent record) that was not told as one. */
  untoldDodges = 0;
  toldDodges = 0;
  private moves = new Map<string, { hits: Set<string>; dodges: Set<string>; misses: number }>();
  constructor(private b: Bundle) {}

  tick(label: string, before: FightWorld, tick: number, inputs: readonly { player: string; v: string; dir: unknown }[], r: Result): void {
    const c = this.b.params.combat, kinds = this.b.map.creatures!.kinds;
    const told = r.events.filter(isTold), strict = !r.events.some((e) => e.e === 'disengage');
    if (strict) this.strictTicks++; else this.endedTicks++;
    const once = (key: string): void => { expect(this.told.has(key), `${label}: ${key} told twice`).toBe(false); this.told.add(key); };
    for (const e of told) {
      this.tally[`${e.striker.side}:${e.kind}`] = (this.tally[`${e.striker.side}:${e.kind}`] ?? 0) + 1;
      expect(Number.isSafeInteger(e.number) && e.number >= 0, label).toBe(true);
      if (e.kind === 'attack' || e.kind === 'critical') expect(e.number, label).toBeGreaterThan(0);
      else expect(e.number, `${label}: ${e.kind} carries no number`).toBe(0);
      expect(('foe' in e) === (e.struck.side === 'foe' && (e.kind === 'attack' || e.kind === 'critical')), `${label}: foe health only on a landed blow at a foe`).toBe(true);
    }

    // The players' strikes: every windup that ended, once.
    const strikers = Object.entries(before.players).filter(([, p]) => p.state.player.fight && p.move === 'attack'
      && tick >= p.stagger && tick - p.since >= c.bare_windup_t).map(([id]) => id);
    const byPlayer = told.filter((e) => e.striker.side === 'player');
    for (const id of new Set(byPlayer.map((e) => e.striker.id))) expect(strikers, `${label}: ${id} struck without a finished windup`).toContain(id);
    for (const id of strikers) {
      const n = byPlayer.filter((e) => e.striker.id === id).length;
      if (strict) expect(n, `${label}: ${id}'s strike`).toBe(1); else expect(n, `${label}: ${id}'s strike`).toBeLessThanOrEqual(1);
      if (n) once(`strike|${id}|${before.players[id]!.since}`);
    }
    const landed = byPlayer.filter((e): e is Told & { foe: { left: number; whole: number } } => 'foe' in e && !!e.foe);
    for (const e of landed) expect(e.foe.whole, label).toBe(kinds[before.creatures[e.struck.id]!.kind]!.fight!.hp);
    for (const id of new Set(landed.map((e) => e.struck.id))) {
      // Several strikes may land on one foe in a tick: the health left falls with each, and the last is where it stands.
      const left = landed.filter((e) => e.struck.id === id).map((e) => e.foe.left);
      expect(left, label).toEqual([...left].sort((a, z) => z - a));
      if (strict) expect(left.at(-1), label).toBe(r.world.creatures[id]!.health);
    }

    // The foes' strikes.
    for (const [fid, f] of Object.entries(before.creatures)) {
      const after = r.world.creatures[fid]!;
      const def = kinds[f.kind]!.fight!, move = def.moves.find((m) => m.id === f.move);
      const mine = told.filter((e) => e.striker.side === 'foe' && e.striker.id === fid);
      const key = `${fid}|${f.since}|${f.move}`;
      const row = this.moves.get(key) ?? { hits: new Set<string>(), dodges: new Set<string>(), misses: 0 };
      this.moves.set(key, row);
      // Blows that landed or met a guard are the ones the move's own hit list grew by.
      const grew = after.since === f.since && after.move === f.move ? after.hit.filter((id) => !f.hit.includes(id)) : [];
      const blows = mine.filter((e) => e.e === 'hit' || e.e === 'fight_guard');
      for (const e of blows) {
        expect(move, label).toBeDefined();
        expect(e.move, label).toBe(f.move);
        if (strict) expect(grew, `${label}: ${fid} blow on ${e.struck.id}`).toContain(e.struck.id);
        once(`blow|${key}|${e.struck.id}`);
        row.hits.add(e.struck.id);
        if (e.e === 'fight_guard') {
          const p = before.players[e.struck.id]!;
          const held = inputs.filter((i) => i.player === e.struck.id && i.v === 'guard').at(-1)?.dir as Tile | null | undefined;
          const dir = held === undefined ? p.guarding : held;
          expect(dir, `${label}: a guard is told only for a guard held`).not.toBeNull();
        }
      }
      if (strict) for (const id of grew) expect(blows.filter((e) => e.struck.id === id), `${label}: ${fid} blow on ${id}`).toHaveLength(1);

      // A move's last active tick is the one that tells it met nobody, or who dodged it.
      const resolves = move && f.phase === 'active' && tick === f.since + move.windup_t + c.active_t - 1;
      const silent = mine.filter((e) => e.e === 'fight_miss' || e.e === 'fight_dodge');
      if (!resolves) expect(silent, `${label}: ${fid} told a miss or dodge outside the end of its active phase`).toEqual([]);
      if (move && resolves) {
        const activeSince = f.since + move.windup_t;
        for (const e of silent) {
          expect(e.move, label).toBe(f.move);
          if (e.e === 'fight_miss') row.misses++;
          else {
            const id = e.struck.id, p = r.world.players[id]!;
            expect(row.dodges.has(id), `${label}: ${id} dodged ${key} twice`).toBe(false);
            row.dodges.add(id);
            // The dodge must have started inside this move's window from a tile the move reached, and left it.
            const origin = this.origins[id];
            expect(origin, `${label}: ${id} dodge has no origin`).toBeDefined();
            this.toldDodges++;
            expect(reaches(f.at, origin!.at, f.facing, move.reach), `${label}: ${id} was out of reach before the dodge`).toBe(true);
            expect(reaches(f.at, p.state.player.at, f.facing, move.reach), `${label}: ${id} still in reach after the dodge`).toBe(false);
            expect(p.since, label).toBeGreaterThanOrEqual(f.since);
          }
        }
        expect(row.misses, `${key} misses`).toBeLessThanOrEqual(1);
        for (const id of f.engaged) {
          const o = this.origins[id], p = r.world.players[id];
          if (!o || !p || row.hits.has(id) || row.dodges.has(id) || (before.players[id]?.cooldowns.mercy ?? 0) > activeSince) continue;
          if (o.tick > activeSince - c.dodge_t && o.tick < activeSince && reaches(f.at, o.at, f.facing, move.reach)
            && !reaches(f.at, p.state.player.at, f.facing, move.reach)) this.untoldDodges++;
        }
        if (row.misses) expect(row.hits.size + row.dodges.size, `${key}: a miss with a hit or dodge`).toBe(0);
        for (const id of row.dodges) expect(row.hits.has(id), `${key}: ${id} dodged and was hit`).toBe(false);
        if (strict) {
          this.resolvedFoeMoves++;
          const forgiven = f.engaged.some((id) => (before.players[id]?.cooldowns.mercy ?? 0) > activeSince);
          if (!forgiven) expect(row.hits.size + row.dodges.size + row.misses, `${label}: ${key} resolved and told nothing`).toBeGreaterThan(0);
        }
      }
    }

    // A pairing with a foe in flight always has somebody it heeds (the brief's "once per move" rests on this).
    for (const [fid, f] of Object.entries(r.world.creatures)) {
      if (f.phase === 'idle') continue;
      expect(f.move, `${label}: ${fid}`).not.toBeNull();
      expect(f.heed, `${label}: ${fid} runs a move with nobody heeded`).not.toBeNull();
      expect(r.world.players[f.heed!], `${label}: ${fid} heeds a player who is not in the world`).toBeDefined();
    }

    // Where each dodge began, read from the world: the player's own tile at the tick the dodge was accepted.
    for (const [id, p] of Object.entries(r.world.players)) {
      if (p.move === 'dodge' && p.since === tick && !(before.players[id]!.move === 'dodge' && before.players[id]!.since === tick)) {
        this.origins[id] = { at: [...before.players[id]!.state.player.at], tick };
      }
    }
  }
}

function run(b: Bundle, w: FightWorld, ticks: number, inputsAt: (w: FightWorld, tick: number) => FightInput[], ledger: Ledger, label: string): FightWorld {
  for (let tick = 0; tick < ticks; tick++) {
    const inputs = inputsAt(w, tick);
    const r = fightTick(b, w, inputs, tick);
    ledger.tick(`${label} tick ${tick}`, w, tick, inputs, r);
    w = r.world;
  }
  return w;
}

describe('every strike that resolves tells exactly one outcome', () => {
  let b: Bundle;
  beforeAll(() => { b = fightArena(loadBundle()); });

  it('over the 3,000 golden ticks', () => {
    const ledger = new Ledger(b);
    for (const script of fightScripts) run(b, scriptWorld(b, script), 1000, (w, tick) => scriptInputs(script, w, tick), ledger, script.name);
    const total = Object.values(ledger.tally).reduce((a, n) => a + n, 0);
    expect(total).toBeGreaterThan(0);
    process.stdout.write(`golden: ${JSON.stringify(ledger.tally)} strict ${ledger.strictTicks} ended ${ledger.endedTicks} foe moves ${ledger.resolvedFoeMoves}\n`);
  });

  it('over a dense seeded fuzz of walls, guards, dodges and fights that end mid-move', () => {
    const { b: yard, solid } = fightYard(loadBundle());
    const accounts = fuzzAccounts(fightArena(loadBundle()));
    const totals: Record<string, number> = {};
    let strict = 0, ended = 0, moves = 0, told = 0, untold = 0;
    for (let round = 0; round < 40; round++) {
      const ledger = new Ledger(yard);
      run(yard, fuzzWorld(yard, solid, accounts, round), 300, (w, tick) => fuzzInputs(w, tick, round), ledger, `fuzz ${round}`);
      for (const [k, n] of Object.entries(ledger.tally)) totals[k] = (totals[k] ?? 0) + n;
      told += ledger.toldDodges; untold += ledger.untoldDodges; strict += ledger.strictTicks; ended += ledger.endedTicks; moves += ledger.resolvedFoeMoves;
    }
    process.stdout.write(`fuzz: ${JSON.stringify(totals)} strict ${strict} ended ${ended} foe moves ${moves} dodges told ${told} made-but-untold ${untold}\n`);
    for (const kind of ['player:attack', 'player:critical', 'player:miss', 'foe:attack', 'foe:guard', 'foe:dodge', 'foe:miss']) {
      expect(totals[kind] ?? 0, `the fuzz tells ${kind}`).toBeGreaterThan(0);
    }
  });
});
