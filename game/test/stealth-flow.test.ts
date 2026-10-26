/**
 * The south-bank stealth beat of game/e2e/stealth.ts, played on the real map without a browser: the
 * Session, the kernel and the walk's own rules (walking.ts), one frame at a time at the scene's step
 * pace. The beats are the e2e's own; where the e2e takes a screenshot this keeps the moment as text
 * (textview.ts), and a failure prints every moment so far. STEALTH_VIEW=1 prints them on a pass too.
 *
 * What it leaves to the e2e: the dialogue with Pell (the quest is accepted by its kernel action), the
 * moonreed minigame (the gather is sent with a grade), the keys, and everything drawn.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';

import { type Bundle, type Hazard, type Tile, coverAt, hazardsOf, headingOf, makeWalkable, predatorAt, hpCap, sees } from '@game/kernel';
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

  /** The shortest walk over what the scene lets the player enter now, as the e2e plans it. */
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
        if (prev.has(`${nx},${ny}`) || !canEnter(this.b, this.walkable, this.nodeAt, s, nx, ny)) continue;
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

describe('the south bank, played without a browser (game/e2e/stealth.ts)', () => {
  test('the covered road, the moonreed behind the wolf, a chase into the open and home to camp', () => {
    const b = bundle;
    const me = new Play(b);
    const s = me.s;
    const wolf = hazardsOf(b).find((h) => h.id === WOLF);
    if (!wolf) throw new Error(`no ${WOLF} on the map`);

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
    me.place(34, 11);
    s.facing = 'right';

    // the stealth quest itself comes from Pell
    const taken = s.act({ t: 'accept', quest: QUEST, at: [s.pos[0], s.pos[1]] });
    me.check(taken.ok, `Pell did not give the south-bank quest: ${taken.ok ? '' : taken.error}`);
    me.check(s.state.player.quests[QUEST] === 'active', 'the south-bank quest is not active');

    // the night from the built camp to the head of the bank road; once the wolf turns west along the far
    // edge, down the covered bank (x 12) to the waiting tile, as the e2e goes. The shortest walk takes
    // the meadow beside it, the wolf's own column, and passes or not by the pace of its steps.
    me.place(18, 22);
    me.setHour(21);
    me.walkTo(12, 19, 'the head of the bank road');
    me.waitFor(
      () => {
        const [, y] = predatorAt(b, wolf, s.tick);
        const [hx] = headingOf(b, wolf, s.tick);
        return y === 31 && hx === -1;
      },
      'the wolf to turn west along the far edge',
      20_000,
    );
    while (s.pos[1] < 33) {
      me.step('down');
      if (s.pos[1] >= 24) me.check(coverAt(b, [s.pos[0], s.pos[1]]), `the bank road is not cover at ${s.pos.join(',')}`);
    }
    me.check(s.state.player.chase === null, 'the wolf began a chase on the covered approach');

    // a beat the e2e leaves to its timing: the wolf comes down the meadow beside the bank looking south,
    // and only the grass keeps the waiting tile out of its eyes (without the cover it would see it)
    me.waitFor(
      () => {
        const [x, y] = predatorAt(b, wolf, s.tick);
        const [, hy] = headingOf(b, wolf, s.tick);
        return x === 11 && y === 29 && hy === 1;
      },
      'the wolf to come down beside the bank',
      20_000,
    );
    const bare: Bundle = { ...b, map: { ...b.map, props: b.map.props.filter((prop) => prop.cover !== true) } };
    me.check(sees(bare, wolf, s.tick, [s.pos[0], s.pos[1]]), 'the wolf would not see the waiting tile even without its cover: the beat proves nothing');
    me.check(s.state.player.chase === null, 'the wolf saw the player in the cover');
    me.snap('in-cover');

    // wait for the wolf on the west edge, looking north: its eyes face away from the one-tile crossing
    me.waitFor(
      () => {
        const [x, y] = predatorAt(b, wolf, s.tick);
        const [hx, hy] = headingOf(b, wolf, s.tick);
        return x === 8 && y === 30 && hx === 0 && hy === -1;
      },
      'the wolf eyes to face away',
      20_000,
    );
    me.check(s.state.player.chase === null, 'the wolf saw the player waiting in the cover');
    me.snap('eyes-away');

    me.step('left');
    const node = Object.entries(b.instances).find(([, n]) => n.source === 'core/moon-reeds');
    if (!node) throw new Error('no moonreed on the map');
    const [nodeId, inst] = node;
    me.check(Math.max(Math.abs(inst.x - s.pos[0]), Math.abs(inst.y - s.pos[1])) === 1, `the moonreed at ${inst.x},${inst.y} is not beside the crossing`);
    const gathered = s.act({ t: 'gather', node: nodeId, grade: 3, at: [s.pos[0], s.pos[1]] });
    me.check(gathered.ok, `the moonreed was refused: ${gathered.ok ? '' : gathered.error}`);
    me.waitFor(() => !s.busy, 'the moonreed gather to finish', 10_000);
    me.check(s.state.player.chase === null, 'the moonreed crossing started a chase');
    me.check((s.state.player.bag['core/moonreed'] ?? 0) >= 1, 'the moonreed is not in the bag');
    me.snap('moonreed');

    // back to cover; as soon as the open tile north of the crossing is in the wolf's sight, step into it
    me.step('right');
    me.waitFor(() => sees(b, wolf, s.tick, [11, 32]), 'the open tile to enter the wolf cone', 20_000);
    const before = { hp: s.state.player.hp, falls: s.state.player.falls };
    me.step('left');
    me.step('up');
    const chase = me.waitFor(() => s.state.player.chase, 'the wolf chase to start', 3000);
    me.snap('chase');

    // home to the camp: the hunt ends on safe ground, after at least one bite and no fall
    me.walkTo(18, 22, 'the safe camp');
    me.check(s.state.player.chase === null, 'the chase did not end in the camp');
    me.snap('camp-safe');
    const home = s.state.player;
    me.check(home.falls === before.falls, `the chase ended in a fall: falls ${before.falls} -> ${home.falls}`);
    me.check(before.hp - home.hp >= bite, `the chase never bit: health ${before.hp} -> ${home.hp}, a bite takes ${bite}`);
    me.check(home.movedAt > chase.since, 'the camp was reached before the chase began');
  });
});

describe('the world as text (textview.ts)', () => {
  test('draws the player at the centre, the wolf where the kernel has it, the cover and the ground, and a status line', () => {
    const b = bundle;
    const s = Session.fresh(b);
    expect(s.act({ t: 'start', starter: 'core/forager', name: 'Tess' }).ok).toBe(true);
    const wolf = hazardsOf(b).find((h) => h.id === WOLF)!;
    // 21:00, two hours after dusk: the wolf is on its round
    const tick = 450_000;
    const pos: Tile = [12, 33];
    const lines = textView(b, { state: s.state, tick, pos }, 3).split('\n');
    expect(lines).toHaveLength(1 + 7 + 1);
    expect(lines[0]).toBe('   9012345');
    const cell = (x: number, y: number) => lines[1 + y - (pos[1] - 3)]![3 + x - (pos[0] - 3)];
    expect(cell(12, 33)).toBe('@');
    expect(cell(12, 32)).toBe('^');
    expect(cell(13, 33)).toBe(b.map.ground[33]![13]);
    const [wx, wy] = predatorAt(b, wolf, tick);
    expect(textView(b, { state: s.state, tick, pos: [wx + 2, wy] }, 2).split('\n')[3]![3 + 0]).toBe('W');
    expect(lines.at(-1)).toContain('21:00');
    expect(lines.at(-1)).toContain(`${WOLF} at ${wx},${wy}`);
  });
});
