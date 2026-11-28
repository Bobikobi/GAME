/**
 * The south-bank stealth beat of game/e2e/stealth.ts, played on the real map without a browser: the
 * Session, the kernel and the walk's own rules (walking.ts), one frame at a time at the scene's step
 * pace. Where the e2e takes a screenshot this keeps the moment as text (textview.ts), and a failure prints
 * every moment so far. STEALTH_VIEW=1 prints them on a pass too. The tiles are found on the shipped map
 * (`bankTiles`), and the waits read the kernel's own `sees` ahead: on the painted valley's bank (public #919)
 * there is no covered road, so the player is in the reeds before dark, and the moonreed is worked from the one
 * open tile beside it while the wolf's round takes its eyes off the bank.
 *
 * What it leaves to the e2e: the dialogue with Pell (the quest is accepted by its kernel action), the
 * moonreed work (watched on screen, with no input), the keys, and everything drawn.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';

import { type Bundle, type Hazard, type Tile, coverAt, hazardsOf, hourOf, makeWalkable, npcTile, predatorAt, hpCap, sees, windowOpen } from '@game/kernel';
import { STEP_MS } from '../src/config';
import { DIRS, type Dir } from '../src/input';
import { s1Use } from '../src/net/s1';
import { Session } from '../src/session';
import { textView } from '../src/textview';
import { StandingReports, canEnter, landStep } from '../src/walking';
import { loadBundle } from '../../tools/test/helpers/world';

const QUEST = 'core/the-south-bank';
const WOLF = 'core/bank-wolf';
/** About sixty frames a second, as the scene runs. */
const FRAME = 16;

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  get length(): number {
    return this.values.size;
  }
  clear(): void {
    this.values.clear();
  }
  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }
  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null;
  }
  removeItem(key: string): void {
    this.values.delete(key);
  }
  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

/**
 * A player on the real map with nothing drawn: each frame is the scene's own order (world.ts `update`):
 * the clock, the walk, then the reports a player standing still owes the kernel.
 */
class Play {
  readonly s: Session;
  private readonly walkable: ReturnType<typeof makeWalkable>;
  private readonly nodeAt = new Map<string, string>();
  private readonly hazards: { rule: Hazard }[];
  private readonly standing = new StandingReports();
  private move: { to: Tile; t: number } | null = null;
  private readonly moments: string[] = [];

  constructor(readonly b: Bundle) {
    this.s = Session.fresh(b);
    this.walkable = makeWalkable(b);
    for (const [id, inst] of Object.entries(b.instances)) this.nodeAt.set(`${inst.x},${inst.y}`, id);
    this.hazards = hazardsOf(b).map((rule) => ({ rule }));
  }

  /** The moment as text, under a label. */
  view(label: string): string {
    return `-- ${label}\n${textView(this.b, this.s)}`;
  }

  /** Keep the moment, where the e2e takes a screenshot. */
  snap(label: string): void {
    this.moments.push(this.view(label));
    if (process.env.STEALTH_VIEW) console.log(this.view(label));
  }

  /** Fail with every moment kept so far and the one now. */
  fail(what: string): never {
    throw new Error([what, ...this.moments, this.view('now')].join('\n\n'));
  }

  check(ok: boolean, what: string): void {
    if (!ok) this.fail(what);
  }

  /** The scene's bind: a new place for the player, and no predator has seen them yet. */
  place(x: number, y: number): void {
    this.s.pos = [x, y];
    this.s.state.player.at = [x, y];
    this.move = null;
    this.standing.reset();
  }

  frame(delta = FRAME): void {
    const s = this.s;
    s.advance(delta);
    if (this.move) {
      this.move.t += delta;
      if (this.move.t >= STEP_MS) {
        const to = this.move.to;
        this.move = null;
        landStep(s, to);
      }
    }
    this.standing.frame(this.b, s, this.hazards, this.move === null, false);
  }

  /** Frames until `ready` holds; a failure after `ms` of game time. */
  waitFor<T>(ready: () => T | false | null | undefined, what: string, ms: number): T {
    for (let t = 0; t <= ms; t += FRAME) {
      const found = ready();
      if (found) return found;
      this.frame();
    }
    return this.fail(`${what}: not within ${ms} game ms`);
  }

  /** One tile, as a key held until the step starts: refused where the scene would not start it. */
  step(dir: Dir): void {
    const s = this.s;
    this.waitFor(() => !s.busy && this.move === null, 'the player to stand still', 10_000);
    const [dx, dy] = DIRS[dir];
    const to: Tile = [s.pos[0] + dx, s.pos[1] + dy];
    s.facing = dir;
    if (!canEnter(this.b, this.walkable, this.nodeAt, s, to[0], to[1])) this.fail(`the ${dir} step was blocked at ${s.pos.join(',')}`);
    this.move = { to, t: 0 };
    this.waitFor(() => this.move === null, `the ${dir} step to end`, 5000);
    const at = s.state.player.at;
    this.check(at[0] === s.pos[0] && at[1] === s.pos[1], `the kernel did not hear the ${dir} step: it has the player at ${at.join(',')}`);
  }

  /** Whether the scene lets the player enter a tile now (from anywhere beside it). */
  enterable(t: Tile): boolean {
    return canEnter(this.b, this.walkable, this.nodeAt, this.s, t[0], t[1]);
  }

  /** The shortest walk over what the scene lets the player enter now, as the e2e plans it: each step asked from the tile it leaves (G68). */
  walkTo(x: number, y: number, what: string): void {
    const s = this.s;
    const goal = `${x},${y}`;
    const prev = new Map<string, [string, Dir] | null>([[`${s.pos[0]},${s.pos[1]}`, null]]);
    const queue: Tile[] = [[s.pos[0], s.pos[1]]];
    while (queue.length > 0 && !prev.has(goal)) {
      const [cx, cy] = queue.shift()!;
      for (const [d, [dx, dy]] of Object.entries(DIRS) as [Dir, readonly [number, number]][]) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (prev.has(`${nx},${ny}`) || !canEnter(this.b, this.walkable, this.nodeAt, s, nx, ny, [cx, cy])) continue;
        prev.set(`${nx},${ny}`, [`${cx},${cy}`, d]);
        queue.push([nx, ny]);
      }
    }
    if (!prev.has(goal)) this.fail(`no route to ${what} at ${goal}`);
    const path: Dir[] = [];
    for (let at = prev.get(goal); at; at = prev.get(at[0])) path.unshift(at[1]);
    for (const dir of path) this.step(dir);
    this.check(s.pos[0] === x && s.pos[1] === y, `the walk to ${what} ended at ${s.pos.join(',')}`);
  }

  /** The e2e's clock jump: the next time the in-game hour reads `h`. */
  setHour(h: number): void {
    const s = this.s;
    const day = this.b.params.day_length_ms;
    let t = s.tick - ((s.tick + Math.floor(day / 2)) % day) + Math.round((h / 24) * day);
    if (t < s.tick) t += day;
    s.tick = t;
  }
}

let bundle: Bundle;

beforeAll(() => {
  bundle = loadBundle();
});

beforeEach(() => {
  vi.stubGlobal('localStorage', new MemoryStorage());
  s1Use(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/**
 * The bank's tiles, found on the shipped map, not written down (the painted valley re-laid every tile, public #919):
 * MOON the moonreed; GATHER the one open tile beside it off the wolf's round, where it is worked from; NEAR the cover
 * beside GATHER; DEEP the cover beside NEAR that no round tile touches, so only the cover keeps it out of the wolf's eyes.
 */
function bankTiles(b: Bundle, wolf: Hazard, me: Play): { moon: [string, Tile]; gather: Tile; near: Tile; deep: Tile } {
  const node = Object.entries(b.instances).find(([, n]) => n.source === 'core/moon-reeds');
  if (!node) throw new Error('no moonreed on the map');
  const moon: Tile = [node[1].x, node[1].y];
  const round = wolf.round ?? [];
  const onRound = (t: Tile) => round.some(([x, y]) => x === t[0] && y === t[1]);
  const touchesRound = (t: Tile) => round.some(([x, y]) => Math.max(Math.abs(x - t[0]), Math.abs(y - t[1])) <= 1);
  const four = (t: Tile): Tile[] => Object.values(DIRS).map(([dx, dy]) => [t[0] + dx, t[1] + dy] as Tile);
  const enter = (t: Tile) => me.enterable(t);
  const around: Tile[] = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) around.push([moon[0] + dx, moon[1] + dy]);
  for (const gather of around.filter((t) => enter(t) && !onRound(t) && !coverAt(b, t))) {
    for (const near of four(gather).filter((t) => enter(t) && coverAt(b, t))) {
      const deep = four(near).find((t) => enter(t) && coverAt(b, t) && !touchesRound(t));
      if (deep) return { moon: [node[0], moon], gather, near, deep };
    }
  }
  return me.fail(`no open tile beside the moonreed at ${moon.join(',')} with cover behind it`);
}

describe('the south bank, played without a browser (game/e2e/stealth.ts)', () => {
  test('in the reeds before dark, the moonreed taken while the wolf looks away, a chase into the open and home to camp', () => {
    const b = bundle;
    const me = new Play(b);
    const s = me.s;
    const wolf = hazardsOf(b).find((h) => h.id === WOLF);
    if (!wolf) throw new Error(`no ${WOLF} on the map`);
    const { moon, gather, near, deep } = bankTiles(b, wolf, me);
    const camp = b.map.slots.find((x) => x.kind === 'camp');
    if (!camp) throw new Error('no camp slot on the map');

    // the e2e's setup: the earlier quests and camp done, the bridge mended, health far above the chase leg's bites
    expect(s.act({ t: 'start', starter: 'core/forager', name: 'Tess' }).ok).toBe(true);
    const p = s.state.player;
    p.quests['core/herbs-for-pell'] = 'done';
    p.quests['core/the-night-arch'] = 'done';
    p.camp = ['core/campfire'];
    if (!p.restored.includes('core/old-bridge')) p.restored.push('core/old-bridge');
    const cap = hpCap(b, s.state);
    const bite = Math.floor((cap * b.params.hazard.predator.bite_pct) / 100);
    p.hp = 10 * cap;
    s.met.add('core/trader');

    // the stealth quest itself comes from Pell
    const pell = npcTile(b, 'core/trader');
    if (!pell) throw new Error('no place for Pell on the map');
    const beside = Object.values(DIRS).map(([dx, dy]) => [pell[0] + dx, pell[1] + dy] as Tile).find((t) => me.enterable(t));
    if (!beside) throw new Error('no tile beside Pell');
    me.place(beside[0], beside[1]);
    const taken = s.act({ t: 'accept', quest: QUEST, at: [s.pos[0], s.pos[1]] });
    me.check(taken.ok, `Pell did not give the south-bank quest: ${taken.ok ? '' : taken.error}`);
    me.check(s.state.player.quests[QUEST] === 'active', 'the south-bank quest is not active');

    // from the camp to the reeds before dark: the wolf sleeps on its den by day, and the deep reeds are where
    // the player waits (the painted bank has no covered road, so the approach is made while it sleeps)
    const home = campTiles(b, camp).find((t) => me.enterable(t));
    if (!home) throw new Error('no tile to stand on in the camp');
    me.place(home[0], home[1]);
    me.setHour(19);
    me.walkTo(deep[0], deep[1], 'the deep reeds');
    me.check(coverAt(b, deep), `the deep reeds are not cover at ${deep.join(',')}`);
    me.waitFor(() => windowOpen(b, wolf, s.tick) && hourOf(b, s.tick) >= 20, 'the dark and the wolf on its round', 120_000);
    me.check(s.state.player.chase === null, 'the wolf began a chase on the approach');

    // only the reeds keep the waiting tile out of its eyes: without the cover it would see it
    const bare: Bundle = { ...b, map: { ...b.map, props: b.map.props.filter((prop) => prop.cover !== true) } };
    me.waitFor(() => sees(bare, wolf, s.tick, deep), 'the wolf to look at the reeds', 20_000);
    me.check(s.state.player.chase === null, 'the wolf saw the player in the cover');
    me.snap('in-cover');

    // the moonreed: wait in the reeds until the wolf's round takes its eyes off the bank long enough to step out,
    // work the reed and step back (the kernel's own `sees`, read ahead, as a player reads the wolf's back)
    const work = b.resources['core/moon-reeds']!.active_ms;
    const F = FRAME * 4;
    const clear = (t: Tile, from: number, to: number) => {
      for (let k = from; k <= to; k += FRAME) if (sees(b, wolf, k, t)) return false;
      return true;
    };
    const span = (t0: number) => ({ near: [t0, t0 + 2 * STEP_MS + F], gather: [t0 + STEP_MS, t0 + 3 * STEP_MS + work + F], back: [t0 + 2 * STEP_MS + work, t0 + 4 * STEP_MS + work + F] });
    me.waitFor(
      () => {
        const w = span(s.tick);
        return clear(near, w.near[0]!, w.near[1]!) && clear(gather, w.gather[0]!, w.gather[1]!) && clear(near, w.back[0]!, w.back[1]!);
      },
      'the wolf eyes to face away long enough',
      20_000,
    );
    me.snap('eyes-away');
    me.walkTo(gather[0], gather[1], 'the tile beside the moonreed');
    me.check(Math.max(Math.abs(moon[1][0] - s.pos[0]), Math.abs(moon[1][1] - s.pos[1])) === 1, `the moonreed at ${moon[1].join(',')} is not beside the crossing`);
    const gathered = s.act({ t: 'gather', node: moon[0], grade: 3, at: [s.pos[0], s.pos[1]] });
    me.check(gathered.ok, `the moonreed was refused: ${gathered.ok ? '' : gathered.error}`);
    me.waitFor(() => !s.busy, 'the moonreed gather to finish', 10_000);
    me.check(s.state.player.chase === null, 'the moonreed crossing started a chase');
    me.check((s.state.player.bag['core/moonreed'] ?? 0) >= 1, 'the moonreed is not in the bag');
    me.snap('moonreed');
    me.walkTo(deep[0], deep[1], 'the deep reeds again');
    me.check(s.state.player.chase === null, 'the wolf saw the player stepping back into the reeds');

    // as soon as the open tile is in the wolf's sight for the two steps it takes, step into it
    me.waitFor(() => !clear(gather, s.tick + STEP_MS, s.tick + 2 * STEP_MS + F) && [...Array(8).keys()].every((i) => sees(b, wolf, s.tick + STEP_MS + i * 2 * FRAME, gather)), 'the open tile to enter the wolf cone', 20_000);
    const before = { hp: s.state.player.hp, falls: s.state.player.falls };
    me.walkTo(gather[0], gather[1], 'the open tile in the wolf cone');
    const chase = me.waitFor(() => s.state.player.chase, 'the wolf chase to start', 3000);
    me.snap('chase');

    // home to the camp: the hunt ends on safe ground, after at least one bite and no fall
    me.walkTo(home[0], home[1], 'the safe camp');
    me.check(s.state.player.chase === null, 'the chase did not end in the camp');
    me.snap('camp-safe');
    const back = s.state.player;
    me.check(back.falls === before.falls, `the chase ended in a fall: falls ${before.falls} -> ${back.falls}`);
    me.check(before.hp - back.hp >= bite, `the chase never bit: health ${before.hp} -> ${back.hp}, a bite takes ${bite}`);
    me.check(back.movedAt > chase.since, 'the camp was reached before the chase began');
  });
});

/** The camp slot's tiles, nearest its middle first. */
function campTiles(b: Bundle, camp: { x: number; y: number; w: number; h: number }): Tile[] {
  const tiles: Tile[] = [];
  for (let y = camp.y; y < camp.y + camp.h; y++) for (let x = camp.x; x < camp.x + camp.w; x++) tiles.push([x, y]);
  const cx = camp.x + (camp.w - 1) / 2;
  const cy = camp.y + (camp.h - 1) / 2;
  return tiles.sort((a, c) => Math.abs(a[0] - cx) + Math.abs(a[1] - cy) - (Math.abs(c[0] - cx) + Math.abs(c[1] - cy)));
}

describe('the world as text (textview.ts)', () => {
  test('draws the player at the centre, the wolf where the kernel has it, the cover and the ground, and a status line', () => {
    const b = bundle;
    const s = Session.fresh(b);
    expect(s.act({ t: 'start', starter: 'core/forager', name: 'Tess' }).ok).toBe(true);
    const wolf = hazardsOf(b).find((h) => h.id === WOLF)!;
    // 21:00, two hours after dusk: the wolf is on its round
    const tick = 450_000;
    // the reeds south of the moonreed: a cover tile with cover north of it, two tiles in from every edge of the map
    const r = 2;
    let pos: Tile | undefined;
    for (let y = r; y < b.map.height - r && !pos; y++) for (let x = r; x < b.map.width - r && !pos; x++) if (coverAt(b, [x, y]) && coverAt(b, [x, y - 1])) pos = [x, y];
    if (!pos) throw new Error('no cover tile with cover north of it on the map');
    const lines = textView(b, { state: s.state, tick, pos }, r).split('\n');
    expect(lines).toHaveLength(1 + (2 * r + 1) + 1);
    expect(lines[0]).toBe('   ' + [...Array(2 * r + 1).keys()].map((i) => (pos[0] - r + i) % 10).join(''));
    const cell = (x: number, y: number) => lines[1 + y - (pos[1] - r)]![3 + x - (pos[0] - r)];
    expect(cell(pos[0], pos[1])).toBe('@');
    expect(cell(pos[0], pos[1] - 1)).toBe('^');
    // a plain tile beside it draws its ground (or `x` where the wolf sees it)
    const plain = ([[1, 0], [-1, 0], [0, 1]] as const).map(([dx, dy]) => [pos[0] + dx, pos[1] + dy] as Tile).find(([x, y]) => !coverAt(b, [x, y]) && !Object.values(b.instances).some((i) => i.x === x && i.y === y));
    if (plain) expect(cell(plain[0], plain[1])).toBe(sees(b, wolf, tick, plain) ? 'x' : b.map.ground[plain[1]]![plain[0]]);
    const [wx, wy] = predatorAt(b, wolf, tick);
    expect(textView(b, { state: s.state, tick, pos: [wx + 2, wy] }, 2).split('\n')[3]![3 + 0]).toBe('W');
    expect(lines.at(-1)).toContain('21:00');
    expect(lines.at(-1)).toContain(`${WOLF} at ${wx},${wy}`);
  });
});
