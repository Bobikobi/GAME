/** A dense, seeded fight workload: several players and foes in a walled yard, inputs of every verb at random. */
import { type Bundle, type FightInput, type FightWorld, fightCreature, fightPlayer } from '@game/kernel';
import { mulberry32 } from '../../tools/test/helpers/world.js';
import { fightArena, playedState } from './fight-scripts.js';

type Tile = [number, number];
export const YARD = { x0: 4, y0: 4, x1: 16, y1: 16 } as const;

/** The scripts' open meadow with a seeded scatter of solid tiles inside the yard, so dodges meet walls. */
export function fightYard(base: Bundle): { b: Bundle; solid: Set<string> } {
  const b = fightArena(base);
  b.map.legend['#'] = { tag: 'meadow', solid: true, sprite: '' };
  const next = mulberry32(2026_11_14), solid = new Set<string>();
  const rows = b.map.ground.map((row) => row.split(''));
  for (let y = YARD.y0; y <= YARD.y1; y++) for (let x = YARD.x0; x <= YARD.x1; x++) {
    if (next() < 0.2) { rows[y]![x] = '#'; solid.add(`${x},${y}`); }
  }
  b.map.ground = rows.map((row) => row.join(''));
  return { b, solid };
}

/** Three played accounts, built once on the plain meadow (the yard has walls): building one takes about a hundred kernel steps. */
export function fuzzAccounts(b: Bundle): FightWorld['players'] {
  const players: FightWorld['players'] = {};
  for (let i = 0; i < 3; i++) players[`account/${i}`] = fightPlayer(b, playedState(b, 54920 + i, [8, 9]));
  return players;
}

/** A round: two wolves and three players on free yard tiles, every player engaged with every wolf. */
export function fuzzWorld(b: Bundle, solid: Set<string>, accounts: FightWorld['players'], round: number): FightWorld {
  const next = mulberry32(round * 7919 + 13), w: FightWorld = { players: {}, creatures: {} };
  const taken = new Set<string>();
  const free = (near: Tile | null): Tile => {
    for (;;) {
      const span = near ? 2 : YARD.x1 - YARD.x0 - 2;
      const x = near ? near[0] + Math.floor(next() * (2 * span + 1)) - span : YARD.x0 + 1 + Math.floor(next() * span);
      const y = near ? near[1] + Math.floor(next() * (2 * span + 1)) - span : YARD.y0 + 1 + Math.floor(next() * span);
      const key = `${x},${y}`;
      if (x < YARD.x0 || y < YARD.y0 || x > YARD.x1 || y > YARD.y1 || solid.has(key) || taken.has(key)) continue;
      taken.add(key);
      return [x, y];
    }
  };
  const foes: Tile[] = [free(null), free(null)];
  Object.entries(accounts).forEach(([id, template], i) => {
    const p = structuredClone(template);
    p.state.player.at = free(foes[i % 2]!);
    p.state.player.fight = { foe: 'foe/0', since: 0 };
    p.facing = [0, -1];
    w.players[id] = p;
  });
  foes.forEach((at, i) => {
    const f = fightCreature(b, `foe/${i}`, 'core/wolf', at, ['bite', 'bite', 'lunge']);
    f.engaged = Object.keys(w.players); f.heed = 'account/0'; f.facing = [0, 1];
    w.creatures[f.spot] = f;
  });
  return w;
}

const DIRS: Tile[] = [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]];
const sign = (n: number): number => Math.sign(n);

/** Every player, every tick, may attack or guard toward the nearest wolf, dodge anywhere, walk or let go. */
export function fuzzInputs(w: FightWorld, tick: number, round: number): FightInput[] {
  const next = mulberry32(round * 104729 + tick * 31 + 7), inputs: FightInput[] = [];
  for (const [id, p] of Object.entries(w.players)) {
    const at = p.state.player.at;
    const foe = Object.values(w.creatures).sort((a, z) =>
      Math.max(Math.abs(a.at[0] - at[0]), Math.abs(a.at[1] - at[1])) - Math.max(Math.abs(z.at[0] - at[0]), Math.abs(z.at[1] - at[1])))[0]!;
    const toward: Tile = Math.abs(foe.at[0] - at[0]) >= Math.abs(foe.at[1] - at[1]) ? [sign(foe.at[0] - at[0]), 0] : [0, sign(foe.at[1] - at[1])];
    const dir = (): Tile => (next() < 0.7 && (toward[0] !== 0 || toward[1] !== 0) ? toward : DIRS[Math.floor(next() * DIRS.length)]!);
    // A wolf winding up in front of a player is what makes a player dodge, across its line or at random, into walls too.
    const age = tick - foe.since, front = Math.sign(at[0] - foe.at[0]) === foe.facing[0] && Math.sign(at[1] - foe.at[1]) === foe.facing[1]
      && Math.max(Math.abs(foe.at[0] - at[0]), Math.abs(foe.at[1] - at[1])) <= 2;
    const dodging = foe.phase === 'windup' && front && age >= 3 && age <= 6 && next() < 0.5;
    const roll = dodging ? 0.5 : next();
    const across: Tile = foe.facing[0] === 0 ? [next() < 0.5 ? 1 : -1, 0] : [0, next() < 0.5 ? 1 : -1];
    const send = (v: 'attack' | 'dodge' | 'guard' | 'move', d: Tile | null): void => { inputs.push({ player: id, tick, v, dir: d } as FightInput); };
    if (roll < 0.25) send('attack', dir());
    else if (roll < 0.4) send('guard', dir());
    else if (roll < 0.45) send('guard', null);
    else if (roll < 0.55) send('dodge', dodging && next() < 0.7 ? across : dir());
    else if (roll < 0.62) send('move', dir());
    else if (roll < 0.65) send('move', null);
  }
  return inputs;
}
