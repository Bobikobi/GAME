/**
 * A fire anywhere outside the town (NEXT 21b) of game/e2e/tending.ts, played on the real map without a browser:
 * the Session, the kernel and the client's own pure rules (fires.ts for the journal line, the running-low warning,
 * the four flame stages and when a log fits; text.ts for the toast lines). Two passes as in the e2e: the long night
 * taken from Maru and met at dawn by a fire of the player's own out in the wild, while the hearth by Maru's door
 * burns a whole night and does not count; and a second character whose fire survives a reload and then goes out, so
 * the vigil stays unmet. A build inside the bank wolf's watch and during a chase is refused, and no log leaves the
 * bag. A failure prints every beat so far; TENDING_VIEW=1 prints them on a pass too.
 *
 * What it leaves to the e2e: the dialogue boxes themselves (the quest is accepted and handed in by its kernel
 * action, the warning box is the `fireWarning` the HUD opens), the Build a fire prompt on screen, the flame's
 * sprite and size, the toasts' timing, and everything drawn.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';

import {
  OWN_FIRE,
  type Bundle,
  type GameEvent,
  fireBurns,
  hazardsOf,
  isTownTile,
  makeWalkable,
  mulDiv,
  npcTile,
  hpCap,
  watchOf,
} from '@game/kernel';
import { s1Use } from '../src/net/s1';
import { fireName, fireStage, fireWarning, holdsKindling, woodToFeed } from '../src/fires';
import { Session } from '../src/session';
import { describe as eventText, questSteps, readyToHandIn } from '../src/text';
import { loadBundle } from '../../tools/test/helpers/world';

const HEARTH = 'core/elder-hearth';
const QUEST = 'core/the-long-night';
const LOG = 'core/log';
const WOLF = 'core/bank-wolf';
/** The fire of the player's own, six tiles south of the town square, and the path beside it. */
const BUILD: [number, number] = [27, 16];
const STAND: [number, number] = [28, 16];
/** A tile in the bank wolf's round watch, and a tile beside it to stand on. */
const WOLF_FIRE: [number, number] = [3, 19];
const WOLF_STAND: [number, number] = [2, 19];
/** Outside the fire's safe ring: a chase can begin here and end at the ring. */
const OUTSIDE: [number, number] = [30, 16];
const DUSK = 400_000;
const DAWN = 850_000;

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

/** A player on the real map, with nothing drawn: the session, the kernel, and the client's own fire rules. */
class Tender {
  readonly s: Session;
  /** the boxes the HUD would open for the running-low warning, as its `warnedFires` keeps them */
  private warned = new Set<string>();
  /** how many running-low boxes opened */
  warnings = 0;
  private readonly moments: string[] = [];

  constructor(
    readonly b: Bundle,
    session?: Session,
  ) {
    this.s = session ?? Session.fresh(b);
  }

  private get own() {
    return this.s.state.player.own;
  }

  private get now(): string {
    const s = this.s;
    return `hour ${this.hour().toFixed(2)}, ${s.state.player.bag[LOG] ?? 0} logs, own ${JSON.stringify(this.own)}, journal: ${this.tracker()}`;
  }

  /** Keep the moment, where the e2e takes a screenshot. */
  snap(label: string): void {
    this.moments.push(`-- ${label}: ${this.now}`);
    if (process.env.TENDING_VIEW) console.log(this.moments[this.moments.length - 1]);
  }

  fail(what: string): never {
    throw new Error([what, ...this.moments, `-- now: ${this.now}`].join('\n'));
  }

  check(ok: boolean, what: string): void {
    if (!ok) this.fail(what);
  }

  /** The e2e's clock jump: the next time the in-game hour reads `h`. */
  setHour(h: number): void {
    const s = this.s;
    const day = this.b.params.day_length_ms;
    let t = s.tick - ((s.tick + Math.floor(day / 2)) % day) + Math.round((h / 24) * day);
    if (t < s.tick) t += day;
    this.setTick(t);
  }

  /** A jump to an exact game tick, for the four stages of one burn. */
  setTick(t: number): void {
    this.s.tick = t;
  }

  hour(): number {
    const s = this.s;
    const day = this.b.params.day_length_ms;
    return (((s.tick + Math.floor(day / 2)) % day) * 24) / day;
  }

  place(at: readonly [number, number]): void {
    this.s.pos = [at[0], at[1]];
    this.s.state.player.at = [at[0], at[1]];
  }

  /** A walkable tile beside the elder, where the long night is taken and handed in. */
  maruSpot(): [number, number] {
    const b = this.b;
    const walkable = makeWalkable(b);
    const maru = npcTile(b, 'core/elder');
    if (!maru) this.fail('no place for Maru on the map');
    const tiles: [number, number][] = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const t: [number, number] = [maru[0] + dx, maru[1] + dy];
        if ((dx || dy) && walkable(t[0], t[1], this.s.state.player)) tiles.push(t);
      }
    }
    const at = tiles[0];
    if (!at) this.fail(`no tile beside Maru: ${maru.join(',')}`);
    return at;
  }

  /** A walkable tile beside the hearth by Maru's door. */
  hearthSpot(): [number, number] {
    const b = this.b;
    const walkable = makeWalkable(b);
    const p = b.map.props.find((x) => x.id === HEARTH);
    if (!p) this.fail('no hearth on the map');
    for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1]] as const) {
      const t: [number, number] = [p.x + dx, p.y + dy];
      if (walkable(t[0], t[1], this.s.state.player)) return t;
    }
    return this.fail('no tile beside the hearth');
  }

  /** A new character with the opening behind, the long night accepted from Maru, and logs in the bag. */
  begin(logs: number): void {
    const s = this.s;
    expect(s.act({ t: 'start', starter: 'core/forager', name: 'Tess' }).ok).toBe(true);
    const p = s.state.player;
    // the earlier tasks are setup: the opening is behind, Maru has his stew (the long night waits for it), and Maru is met
    for (const id of Object.keys(p.quests)) if (p.quests[id] === 'active') p.quests[id] = 'done';
    for (const id of ['core/fix-the-bridge', 'core/first-fire', 'core/into-town', 'core/three-fruits', 'core/a-coin-for-maru', 'core/herbs-for-pell', 'core/a-whole-one', 'core/something-warm']) p.quests[id] = 'done';
    if (!p.restored.includes('core/old-bridge')) p.restored.push('core/old-bridge');
    p.hp = 10 * hpCap(this.b, s.state);
    p.bag[LOG] = logs;
    s.met.add('core/elder');
    this.setHour(17);
    this.place(this.maruSpot());
    const r = s.act({ t: 'accept', quest: QUEST, at: s.pos });
    this.check(r.ok, `Maru did not give the long night: ${r.ok ? '' : r.error}`);
    this.check(s.state.player.quests[QUEST] === 'active', 'the long night is not active');
    // tasks that open by themselves on the way are setup too: the tracker shows this one
    for (const id of Object.keys(s.state.player.quests)) if (id !== QUEST && s.state.player.quests[id] === 'active') s.state.player.quests[id] = 'done';
  }

  /** The Build a fire button's own condition: two logs in the bag and the ground outside the town (NEXT 21b). */
  buildShown(): boolean {
    return holdsKindling(this.b, this.s.state) && !isTownTile(this.b, this.s.pos);
  }

  /** One press of Build a fire, as ui.kindle sends it. A refusal keeps the logs, as the kernel does. */
  build(at: readonly [number, number] = BUILD): { ok: true; toast: string } | { ok: false; toast: string } {
    const s = this.s;
    const before = s.state.player.bag[LOG] ?? 0;
    const r = s.act({ t: 'kindle', fire: [at[0], at[1]], at: s.pos });
    if (r.ok) {
      const toast = r.events.map((e) => eventText(this.b, s.state, e)?.text ?? '').join(' | ');
      return { ok: true, toast };
    }
    this.check((s.state.player.bag[LOG] ?? 0) === before, 'a refused build still took a log');
    return { ok: false, toast: r.error };
  }

  /** One press of Feed on the player's own fire, as ui.feed sends it. */
  feedOwn(): { fed: true; toast: string } | { fed: false; toast: string } {
    const s = this.s;
    const item = woodToFeed(this.b, s.state);
    if (!item) return { fed: false, toast: 'You have no wood.' };
    const r = s.act({ t: 'feed', fire: OWN_FIRE, item, at: s.pos });
    if (r.ok) return { fed: true, toast: r.events.map((e) => eventText(this.b, s.state, e)?.text ?? '').join(' | ') };
    return { fed: false, toast: r.error };
  }

  /** One press of Feed on the hearth by Maru's door, as ui.feed sends it there. */
  feedHearth(): boolean {
    const s = this.s;
    const item = woodToFeed(this.b, s.state);
    if (!item) return false;
    return s.act({ t: 'feed', fire: HEARTH, item, at: s.pos }).ok;
  }

  /** The hearth kept from before dusk to dawn, as if Maru's own fire could satisfy the task (it cannot, after NEXT 21b). */
  keepHearthToDawn(): void {
    this.place(this.hearthSpot());
    this.setHour(19);
    for (let i = 0; i < 12 && (this.s.state.player.fires[HEARTH]?.until ?? 0) < DAWN; i++) {
      if (!this.feedHearth()) this.setHour(this.hour() + 1);
    }
    const fire = this.s.state.player.fires[HEARTH];
    this.check((fire?.until ?? 0) >= DAWN, `the hearth did not reach dawn: ${JSON.stringify(fire ?? null)}`);
  }

  burns(): boolean {
    return fireBurns(this.s.state, OWN_FIRE, this.s.tick);
  }

  stage(): string {
    return fireStage(this.b, this.s.state, OWN_FIRE, this.s.tick);
  }

  /** A jump to the middle of a stage of the burn now going: a fraction of its own log left. */
  stageAt(leftOfLog: number): void {
    const own = this.own;
    if (!own) this.fail('no fire of the player\'s own to dim');
    this.setTick(own.until - Math.round(own.log * leftOfLog));
  }

  logs(): number {
    return this.s.state.player.bag[LOG] ?? 0;
  }

  /** The journal's line for the vigil, as the HUD's tracker shows it. */
  tracker(): string {
    return questSteps(this.b, this.s.state, QUEST, this.s.tick)
      .map((st) => st.text)
      .join(' | ');
  }

  /** Feed while a log still fits, up to a fire's cap of three: the quick top-up a player makes when the fire is low. */
  feedFitting(): number {
    let fed = 0;
    for (let i = 0; i < 4; i++) {
      const r = this.feedOwn();
      if (!r.fed) break;
      fed++;
    }
    return fed;
  }

  /** Feed while the journal asks for wood, as a player would; a full fire says so and the clock is moved on an hour. */
  holdToDawn(): { fed: number; full: boolean } {
    let fed = 0;
    for (let i = 0; i < 20 && this.tracker().includes('it still needs wood'); i++) {
      const r = this.feedOwn();
      if (!r.fed) {
        this.check(/already full/.test(r.toast), `an unexpected refusal while feeding: ${r.toast}`);
        this.setHour(this.hour() + 1);
        continue;
      }
      fed++;
    }
    this.check(this.tracker().includes('it has the wood: wait for dawn'), `the journal does not wait for dawn: ${this.tracker()}`);
    return { fed, full: false };
  }

  /** The HUD's check for the running-low box, every beat: opens it once per burn. */
  beat(): boolean {
    const w = fireWarning(this.b, this.s.state, this.s.tick, this.warned);
    if (!w) return false;
    this.warned.add(w.key);
    this.warnings++;
    return true;
  }

  /** Maru's options for the long night: handed in when the kernel takes it, asked about while it waits. */
  maruOffers(): 'hand in' | 'about' {
    return readyToHandIn(this.b, this.s.state, QUEST, this.s.tick) ? 'hand in' : 'about';
  }

  /** The kernel's step for a walk: it moves the player and the world acts on the tile they reach. */
  move(at: readonly [number, number]): GameEvent[] {
    const r = this.s.act({ t: 'move', at: [at[0], at[1]] });
    if (!r.ok) this.fail(`the walk to ${at.join(',')} was refused: ${r.error}`);
    this.place(at);
    return r.events;
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

describe("a fire anywhere outside the town, played without a browser (game/e2e/tending.ts)", () => {
  test("the long night is met at dawn by a fire of one's own out in the wild, and not by the hearth", () => {
    const me = new Tender(bundle);
    me.begin(16);
    const s = me.s;

    me.check(me.tracker().includes('Keep the fire burning until dawn - light it before dusk'), 'the journal does not ask to light a fire of its own');
    me.check(!me.tracker().includes('hearth'), 'the journal still names Maru\'s hearth');
    // the Build a fire button shows only with the two logs in the bag and outside the town
    me.place(STAND);
    me.check(me.buildShown(), 'no Build a fire with sixteen logs out of the town');
    me.place([27, 8]);
    me.check(isTownTile(bundle, me.s.pos) && !me.buildShown(), 'Build a fire shows inside the town');
    me.check(me.build([28, 8]).toast === 'The town has its own fires.', 'a build offered by hand inside the town was not refused by the kernel');

    // the hearth by Maru's door burns the whole first night: the task is not met by it
    me.keepHearthToDawn();
    me.setHour(5.5);
    me.check(me.maruOffers() === 'about', 'the hearth met the long night');
    me.check(!me.tracker().includes('Bring it to'), 'the tracker sends the long night in after the hearth kept a night');
    me.snap('hearth-night-unmet');

    // the next evening, out in the wild: a build inside the bank wolf's watch is refused and keeps the logs
    me.place(WOLF_STAND);
    me.s.facing = 'right';
    me.setHour(17);
    const before = me.logs();
    const watched = me.build(WOLF_FIRE);
    me.check(!watched.ok && watched.toast === 'A wolf watches this ground. Not here.', `the wolf's watch did not refuse a build: ${watched.toast}`);
    me.check(me.logs() === before, 'a build inside a round\'s watch took a log');
    me.snap('wolf-watch-refused');

    // out past the last house, six tiles from the town, a fire of one's own is built
    me.place(STAND);
    me.s.facing = 'left';
    me.setHour(19);
    const built = me.build();
    me.check(built.ok, `the wild ground refused a fire: ${built.toast}`);
    me.check(me.logs() === before - 2, `kindling took ${before - me.logs()} logs, not 2`);
    me.check(me.burns() && me.stage() === 'full', `the new fire is not full: ${me.stage()}`);
    me.check(fireName(OWN_FIRE) === 'fire', 'the fire of one\'s own is named by its kernel word');
    me.snap('flame-full');

    // the flame dims through four stages, and no line about the fire carries a digit
    for (const [left, stage] of [[0.6, 'steady'], [0.45, 'low'], [0.25, 'embers']] as const) {
      me.stageAt(left);
      me.check(me.stage() === stage, `at ${left} of a log the fire is ${me.stage()}, not ${stage}`);
      me.check(!/\d/.test(me.tracker()), `the journal counts the fire: ${me.tracker()}`);
      me.snap(`flame-${stage}`);
    }
    me.check(me.burns() && me.beat() && me.warnings === 1, 'the running-low warning did not open once at the embers');
    // the fire is topped up to its cap at once, still twenty-hundred hours, and burns into the night
    me.check(me.feedFitting() === 2, 'the embers took two logs, not the two that fit under the cap');
    me.setHour(21);
    me.check(me.burns(), 'the topped-up fire is out by 21:00');

    // a build during a chase is refused and keeps the logs; a chase that reaches the fire's ring ends there
    me.place(OUTSIDE);
    s.state.player.chase = { hazard: WOLF, since: s.tick, bites: 0 };
    const chasedBefore = me.logs();
    const chased = me.build([31, 16]);
    me.check(!chased.ok && chased.toast === 'Not with the wolf at your heels.', `a build during a chase was not refused: ${chased.toast}`);
    me.check(me.logs() === chasedBefore, 'a build during a chase took a log');
    me.snap('chase-refused');
    const safe = me.move(STAND);
    me.check(s.state.player.chase === null, 'a chase that reached the fire\'s ring did not end there');
    me.check(safe.some((e) => e.e === 'safe' && e.id === WOLF), 'reaching the ring did not tell the hunt safe');

    // through the night from 21:00, fed to dawn, the warning not repeated in the same burn
    const night = me.holdToDawn();
    me.check(night.fed > 0, 'the fire reached dawn without another log');
    me.check(!me.beat(), 'the warning opened twice in one burn');
    me.setHour(5.5);
    me.check(me.maruOffers() === 'hand in', 'the fire of one\'s own did not meet the long night at dawn');
    me.snap('dawn-met');

    expect(s.state.player.recipes).not.toContain('core/bandage');
    me.place(me.maruSpot());
    const done = s.act({ t: 'turnin', quest: QUEST, at: s.pos });
    me.check(done.ok, `Maru did not take the long night: ${done.ok ? '' : done.error}`);
    me.check(s.state.player.quests[QUEST] === 'done', 'the long night is not done');
    me.check(s.state.player.recipes.includes('core/bandage'), 'the bandage recipe was not given');
    me.check(me.warnings === 1, 'the warning count changed after the vigil');
    me.snap('handed-in');
  });

  test('a lit fire survives a reload, and a fire that goes out leaves the vigil unmet', () => {
    const first = new Tender(bundle);
    first.begin(6);
    expect(first.s.state.player.recipes).not.toContain('core/bandage');
    first.place(STAND);
    first.setHour(19);
    first.check(first.build().ok, 'the second fire was refused in the wild');
    const kept = first.own;

    // the burn lives in the save: a reload finds the fire of one's own still burning, where it stood
    first.s.save();
    const back = Session.restore(bundle);
    if (!back) throw new Error('the save did not load');
    const me = new Tender(bundle, back);
    me.check(
      !!kept && me.own?.lit === kept.lit && me.own?.until === kept.until && me.own?.at.join() === kept.at.join() && me.own?.log === kept.log,
      `the fire did not survive the reload: ${JSON.stringify({ kept, again: me.own })}`,
    );
    me.place(STAND);
    me.check(me.burns(), 'the reloaded fire does not burn');

    me.setHour(22);
    me.check(!me.burns() && me.stage() === 'out', 'the unfed fire did not go out');
    me.check(me.tracker().includes('it went out, tonight is lost'), `the journal does not tell the night lost: ${me.tracker()}`);
    me.setHour(5.5);
    me.check(me.maruOffers() === 'about', 'Maru takes a vigil that went out');
    me.check(me.tracker().includes('it went out in the night'), `the day after does not remember the lost night: ${me.tracker()}`);
    const refused = me.s.act({ t: 'turnin', quest: QUEST, at: me.s.pos });
    me.check(!refused.ok, 'the kernel took a vigil that went out');
    me.check(me.s.state.player.quests[QUEST] === 'active', 'the unmet vigil left the journal');
    me.snap('went-out');
    // the refusal says what a fire is worth on ground the wolf watches, and keeps every log
    me.setHour(17);
    me.place(WOLF_STAND);
    const logs = me.logs();
    me.check(me.build(WOLF_FIRE).toast === 'A wolf watches this ground. Not here.', 'the watch refused nothing the second time');
    me.check(me.logs() === logs, 'a refused build took a log the second time');
    me.check(mulDiv(bundle.params.fire.log_ms, 100, 150) === 66_666, 'the danger of the wild ground no longer shortens a log');
    me.check(hazardsOf(bundle).some((h) => h.id === WOLF && watchOf(bundle, h).some(([x, y]) => x === WOLF_FIRE[0] && y === WOLF_FIRE[1])), 'the wolf\'s watch moved off the test tile');
    me.check(DUSK === 400_000, 'the dusk moved');
  });
});
