/**
 * The wild brain (HUNTING 2 and 3): the noticing count and the ten states, one think step at a time.
 * `think` changes the one animal it is given and nothing else; every other member of its group is read
 * through the view. No float, no clock and no draw but the public behaviour draw (`roll`).
 */
import { idiv } from '../num';
import { avoids, followTarget, regroupTarget, regroups } from './groups';
import { type Field, fleeMap, homeMap, nextTile, NEIGHBOURS, ringTiles, stepToward, valueAt, homeStep } from './paths';
import { type Notice, d2, hearsNoise, notices, threshold } from './senses';
import {
  type Creature,
  type ThinkOut,
  type Tile,
  type WildKind,
  type WildState,
  type WildView,
  THINK_MS,
  WILD,
  awake,
  roll,
} from './types';

export { threshold };

/** What ALERT turns into for a kind; before the fight a defender and a hunter only bluff (HUNTING 11, question 1). */
export function tierState(kind: WildKind, fight = false): WildState {
  if (kind.tier === 'flee') return 'FLEE';
  if (!fight) return 'ALERT';
  return kind.tier === 'defend' ? 'DEFEND' : 'STALK';
}

/** Whole tiles to move at a pace this think, the rest carried in `credit` so pace stays integer. */
export function stepsToMove(c: Creature, paceMs: number): number {
  const total = c.credit + THINK_MS;
  const n = idiv(total, paceMs);
  c.credit = total - n * paceMs;
  return n;
}

/** The quiet state after IDLE, by the kind's weights (BEHAVIOUR 1). */
export function nextQuiet(kind: WildKind, c: Creature, view: WildView): WildState {
  const x = roll(c, view, 100);
  if (x < kind.weights.idle) return 'IDLE';
  if (x < kind.weights.idle + kind.weights.graze) return 'GRAZE';
  return 'WANDER';
}

function same(a: Tile, b: Tile): boolean {
  return a[0] === b[0] && a[1] === b[1];
}

function faceToward(c: Creature, to: Tile): void {
  const dx = to[0] - c.at[0];
  const dy = to[1] - c.at[1];
  if (dx === 0 && dy === 0) return;
  c.face = Math.abs(dx) >= Math.abs(dy) ? [Math.sign(dx), 0] : [0, Math.sign(dy)];
}

function moveTo(c: Creature, t: Tile): void {
  c.face = [t[0] - c.at[0], t[1] - c.at[1]];
  c.at = [t[0], t[1]];
}

function enter(c: Creature, s: WildState, view: WildView): void {
  c.state = s;
  c.since = view.tick;
  c.credit = 0;
  delete c.up;
  delete c.beats;
  delete c.back;
}

function enterQuiet(kind: WildKind, c: Creature, s: WildState, view: WildView, regroup = false): void {
  if (s === 'WANDER') {
    const target = wanderTarget(kind, c, view, regroup);
    if (!target) return enterQuiet(kind, c, 'IDLE', view);
    enter(c, 'WANDER', view);
    c.target = [target[0], target[1]];
    return;
  }
  enter(c, s, view);
  delete c.target;
  if (s === 'IDLE') c.left = 2 + roll(c, view, 5);
  if (s === 'GRAZE') {
    c.beats = 1 + roll(c, view, 3);
    c.left = 4 + roll(c, view, 9);
    c.up = 0;
  }
}

/** A WANDER target (HUNTING 2): 3 to 8 tiles away inside the roam circle, open, out of the avoided ring. */
function wanderTarget(kind: WildKind, c: Creature, view: WildView, regroup: boolean): Tile | undefined {
  if (view.leader && kind.group !== 'solitary') return followTarget(kind, c, view.leader, view);
  if (regroup) return regroupTarget(c, view);
  const choices = ringTiles(c.at, 3, 8).filter(
    (t) => view.open(t[0], t[1]) && d2(t, view.anchorAt) <= kind.roam * kind.roam && !avoids(c, view.tick, t),
  );
  return choices.length ? choices[roll(c, view, choices.length)] : undefined;
}

function enterAlert(kind: WildKind, c: Creature, src: Tile, view: WildView, out: ThinkOut): void {
  enter(c, 'ALERT', view);
  c.count = 0;
  c.left = WILD.alertQuiet;
  c.src = [src[0], src[1]];
  faceToward(c, src);
  if (kind.alarm > 0) out.alarm = kind.alarm;
  out.events.push({ e: 'alert', id: c.id });
}

function enterFlee(kind: WildKind, c: Creature, src: Tile, view: WildView, out: ThinkOut): void {
  enter(c, 'FLEE', view);
  c.count = 0;
  c.left = WILD.fleeLost;
  c.src = [src[0], src[1]];
  c.from = [c.at[0], c.at[1]];
  delete c.target;
  out.fledFrom = c.from;
  out.events.push({ e: 'flee', id: c.id });
  flee(kind, c, view, out);
}

function goTier(kind: WildKind, c: Creature, src: Tile, view: WildView, out: ThinkOut): void {
  const s = tierState(kind, view.fight);
  if (s === 'FLEE') return enterFlee(kind, c, src, view, out);
  if (s === 'ALERT') {
    if (c.state === 'ALERT' && !c.back) {
      c.left = WILD.alertQuiet;
      faceToward(c, src);
      return;
    }
    return enterAlert(kind, c, src, view, out);
  }
  enter(c, s, view);
  c.count = 0;
  c.left = s === 'STALK' ? 0 : WILD.giveUp;
  c.src = [src[0], src[1]];
  faceToward(c, src);
}

/** Goes to its rest for the night: a burrower under, any other kind asleep at its anchor. */
function rest(kind: WildKind, c: Creature, view: WildView): void {
  enter(c, 'SLEEP', view);
  delete c.target;
  delete c.src;
  c.count = 0;
  c.left = 0;
  if (kind.flight === 'burrow') c.under = true;
}

function homeward(kind: WildKind, c: Creature, view: WildView): void {
  if (same(c.at, view.anchorAt)) return awake(kind, view.hour) ? enterQuiet(kind, c, 'IDLE', view) : rest(kind, c, view);
  enter(c, 'RETURN', view);
  delete c.src;
  c.target = [view.anchorAt[0], view.anchorAt[1]];
}

/** Walks toward the target at a pace: 'there' on it, 'stuck' when no step leads closer, else 'on'. */
function walk(c: Creature, target: Tile, paceMs: number, view: WildView, stopShort = false): 'there' | 'stuck' | 'on' {
  const n = stepsToMove(c, paceMs);
  for (let i = 0; i < n; i++) {
    if (same(c.at, target)) break;
    const t = stepToward(view.open, c.at, target);
    if (!t) return 'stuck';
    if (stopShort && same(t, target)) break;
    moveTo(c, t);
  }
  return same(c.at, target) ? 'there' : 'on';
}

/** A step straight away from the threat when it stands outside the map's box. */
function awayStep(c: Creature, src: Tile, view: WildView): Tile | undefined {
  let best: Tile | undefined;
  let far = d2(c.at, src);
  for (const [dx, dy] of NEIGHBOURS) {
    const t: Tile = [c.at[0] + dx, c.at[1] + dy];
    if (view.open(t[0], t[1]) && d2(t, src) > far) {
      best = t;
      far = d2(t, src);
    }
  }
  return best;
}

/**
 * One think of FLEE's run at the run's pace (HUNTING 2; BEHAVIOUR 1, flight): a burrower down its home
 * map while the threat is not between, else down the flee map. `home`: it stands at its den; `homing`:
 * it ran toward the den this step, so the distance end does not cut the run home short.
 */
function run(kind: WildKind, c: Creature, view: WildView): { home: boolean; homing: boolean } {
  const src = c.src ?? view.anchorAt;
  const map: Field = fleeMap(view.open, src, c.at, kind.sight + 6);
  const home = kind.flight === 'burrow' ? homeMap(view.open, view.anchorAt, c.at, kind.roam + 4) : undefined;
  let went = false;
  const n = stepsToMove(c, view.pace.run);
  for (let i = 0; i < n; i++) {
    if (home && same(c.at, view.anchorAt)) break;
    let t = home ? homeStep(home, c.at, src, view.open) : undefined;
    if (t) went = true;
    else t = valueAt(map, src[0], src[1]) === map.none ? awayStep(c, src, view) : nextTile(map, c.at, view.open);
    if (!t) break;
    moveTo(c, t);
  }
  return { home: !!home && same(c.at, view.anchorAt), homing: went };
}

function flee(kind: WildKind, c: Creature, view: WildView, out: ThinkOut): void {
  const went = run(kind, c, view);
  if (went.home) {
    rest(kind, c, view);
    c.left = WILD.denStay;
    c.avoidUntil = view.tick + WILD.avoidSteps * THINK_MS;
    out.events.push({ e: 'home', id: c.id });
    return;
  }
  if (went.homing) return;
  const src = c.src ?? view.anchorAt;
  const reach = kind.sight + WILD.fleeExtra;
  if (d2(c.at, src) >= reach * reach || c.left <= 0) endFlee(kind, c, view);
}

function endFlee(kind: WildKind, c: Creature, view: WildView): void {
  c.avoidUntil = view.tick + WILD.avoidSteps * THINK_MS;
  c.count = 0;
  if (kind.looksBack) {
    enter(c, 'ALERT', view);
    c.back = true;
    c.left = WILD.backSteps;
    if (c.src) faceToward(c, c.src);
    return;
  }
  enterQuiet(kind, c, 'WANDER', view, regroups(kind));
}

/** The loudest sound besides the player's gait that the animal hears this step. */
function heardNoise(kind: WildKind, c: Creature, view: WildView): { at: Tile; r: number } | undefined {
  let best: { at: Tile; r: number } | undefined;
  for (const n of view.noises) {
    if (hearsNoise(kind, c, n.at, n.r) && (!best || n.r > best.r)) best = n;
  }
  return best;
}

/** A group member within 8 tiles in a state, read and never written (HUNTING 2; question 10 default A). */
function kinIn(kind: WildKind, c: Creature, view: WildView, s: WildState): Creature | undefined {
  if (kind.group === 'solitary') return undefined;
  const reach = WILD.spread * WILD.spread;
  for (const k of view.kin) if (k.id !== c.id && !k.under && k.state === s && d2(k.at, c.at) <= reach) return k;
  return undefined;
}

/** Gone to ground: out at its waking hour once nobody is within a walk's hearing of the mouth for 8 steps. */
function thinkUnder(kind: WildKind, c: Creature, view: WildView, out: ThinkOut): void {
  if (c.flushed) {
    const at = c.flushed;
    delete c.flushed;
    c.under = false;
    c.at = [at[0], at[1]];
    return enterFlee(kind, c, view.player?.at ?? view.anchorAt, view, out);
  }
  if (!awake(kind, view.hour)) return;
  const p = view.player;
  const ear = WILD.walkNoise + kind.ear;
  if (p && !p.asleep && d2(p.at, view.anchorAt) <= ear * ear) {
    c.left = WILD.denStay;
    return;
  }
  if (c.left > 0) c.left -= 1;
  if (c.left > 0) return;
  c.under = false;
  c.at = [view.anchorAt[0], view.anchorAt[1]];
  out.events.push({ e: 'out', id: c.id });
  enterQuiet(kind, c, 'WANDER', view);
}

/** One think step of one animal. Changes `c` only. */
export function think(kind: WildKind, c: Creature, view: WildView): ThinkOut {
  const out: ThinkOut = { events: [] };
  if (c.under) {
    thinkUnder(kind, c, view, out);
    return out;
  }
  const isAwake = awake(kind, view.hour);
  const n: Notice | undefined = notices(kind, c, view);
  c.count = n ? c.count + 1 : 0;
  const p = view.player;
  const sound = heardNoise(kind, c, view);
  const playerLoud = !!p && !p.asleep && p.noise >= WILD.loud && !!hearsNoise(kind, c, p.at, p.noise);
  const loud = !!view.hit || playerLoud || (!!sound && sound.r >= WILD.loud);
  const loudAt: Tile | undefined = view.hit || playerLoud ? p?.at : sound?.at;

  switch (c.state) {
    case 'SLEEP':
    case 'IDLE':
    case 'GRAZE':
    case 'WANDER':
    case 'RETURN': {
      const listens = c.state !== 'RETURN' || kind.tier === 'flee';
      if (!listens || !react(kind, c, view, out, n, sound, loud ? loudAt : undefined)) quiet(kind, c, view, isAwake);
      return out;
    }
    case 'ALERT': {
      const fleeing = kind.tier === 'flee' ? kinIn(kind, c, view, 'FLEE') : undefined;
      if (loud && loudAt) {
        goTier(kind, c, loudAt, view, out);
        return out;
      }
      if (fleeing) {
        enterFlee(kind, c, fleeing.src ?? fleeing.at, view, out);
        return out;
      }
      if (n) c.src = [n.at[0], n.at[1]];
      if (c.src) faceToward(c, c.src);
      if (c.back) {
        c.left -= 1;
        if (c.left <= 0) enterQuiet(kind, c, 'WANDER', view, regroups(kind));
        return out;
      }
      if (n) {
        c.left = WILD.alertQuiet;
        if (c.count >= WILD.alertMore) goTier(kind, c, n.at, view, out);
        return out;
      }
      c.left -= 1;
      if (c.left <= 0) {
        delete c.src;
        enterQuiet(kind, c, 'IDLE', view);
        out.events.push({ e: 'calm', id: c.id });
      }
      return out;
    }
    case 'FLEE': {
      if (n) {
        c.src = [n.at[0], n.at[1]];
        c.left = WILD.fleeLost;
      } else c.left -= 1;
      flee(kind, c, view, out);
      return out;
    }
    case 'DEFEND': {
      if (!n) homeward(kind, c, view);
      else faceToward(c, n.at);
      return out;
    }
    case 'STALK':
    case 'CHASE':
      hunt(kind, c, view, n);
      return out;
  }
}

/**
 * What moves a quiet animal, most pressing first: a hit or a loud noise to the tier's state, a group
 * member fleeing within 8 to FLEE, the noticing count to ALERT (asleep, any sense at once), another
 * kind's alarm to ALERT, a group member alert within 8 to ALERT. False when nothing did.
 */
function react(
  kind: WildKind,
  c: Creature,
  view: WildView,
  out: ThinkOut,
  n: Notice | undefined,
  sound: { at: Tile } | undefined,
  loudAt: Tile | undefined,
): boolean {
  const fleeing = kinIn(kind, c, view, 'FLEE');
  const alerted = kinIn(kind, c, view, 'ALERT');
  if (loudAt) goTier(kind, c, loudAt, view, out);
  else if (fleeing && kind.tier === 'flee') enterFlee(kind, c, fleeing.src ?? fleeing.at, view, out);
  else if (n && (c.state === 'SLEEP' || c.count >= threshold(n.dd, n.r))) enterAlert(kind, c, n.at, view, out);
  else if (sound) enterAlert(kind, c, sound.at, view, out);
  else if (alerted?.src) enterAlert(kind, c, alerted.src, view, out);
  else return false;
  return true;
}

/** The quiet states' own beats when nothing moved them (HUNTING 2). */
function quiet(kind: WildKind, c: Creature, view: WildView, isAwake: boolean): void {
  if (c.state === 'RETURN') {
    const target = c.target ?? view.anchorAt;
    if (walk(c, target, view.pace.walk, view) !== 'on') {
      if (isAwake) enterQuiet(kind, c, 'IDLE', view);
      else rest(kind, c, view);
    }
    return;
  }
  if (c.state === 'SLEEP') {
    if (isAwake) enterQuiet(kind, c, 'IDLE', view);
    return;
  }
  if (!isAwake) return homeward(kind, c, view);
  if (c.state === 'IDLE') {
    c.left -= 1;
    if (c.left <= 0) enterQuiet(kind, c, nextQuiet(kind, c, view), view);
    return;
  }
  if (c.state === 'GRAZE') {
    if (c.up) {
      c.up -= 1;
      if (c.up > 0) return;
      c.beats = (c.beats ?? 1) - 1;
      if (c.beats <= 0) return enterQuiet(kind, c, nextQuiet(kind, c, view), view);
      c.left = 4 + roll(c, view, 9);
      return;
    }
    c.left -= 1;
    if (c.left <= 0) c.up = 2;
    return;
  }
  // WANDER
  if (!c.target || walk(c, c.target, view.pace.walk, view) !== 'on') enterQuiet(kind, c, 'IDLE', view);
}

/**
 * STALK and CHASE (HUNTING 2), reached only once the fight is built: a stalker closes at the sneak and
 * holds while the player faces it, a chaser follows at the walk and never faster, inside its leash.
 */
function hunt(kind: WildKind, c: Creature, view: WildView, n: Notice | undefined): void {
  const p = view.player;
  if (!p || p.asleep) return homeward(kind, c, view);
  const dd = d2(c.at, p.at);
  if (c.state === 'STALK') {
    const faced = p.face[0] * (c.at[0] - p.at[0]) + p.face[1] * (c.at[1] - p.at[1]) > 0;
    if (faced && dd <= WILD.stalkFaced * WILD.stalkFaced) {
      c.left += 1;
      if (c.left >= 2) homeward(kind, c, view);
      return;
    }
    c.left = 0;
    if (dd <= WILD.stalkClose * WILD.stalkClose) {
      enter(c, 'CHASE', view);
      c.left = WILD.giveUp;
      return;
    }
    walk(c, p.at, view.pace.sneak, view, true);
    return;
  }
  if (n) c.left = WILD.giveUp;
  else c.left -= 1;
  if (c.left <= 0 || d2(c.at, view.anchorAt) > WILD.leash * WILD.leash) return homeward(kind, c, view);
  walk(c, p.at, view.pace.walk, view, true);
  faceToward(c, p.at);
}

/**
 * The rest pose after a long gap (more than 64 think steps): O(1) instead of simulating every think.
 * Out of hours at its rest; awake, standing at IDLE where it was, or at the anchor if it strayed.
 */
export function settle(kind: WildKind, c: Creature, view: WildView): void {
  c.count = 0;
  delete c.target;
  delete c.src;
  if (!awake(kind, view.hour)) {
    c.at = [view.anchorAt[0], view.anchorAt[1]];
    rest(kind, c, view);
    return;
  }
  if (c.under || d2(c.at, view.anchorAt) > kind.roam * kind.roam) c.at = [view.anchorAt[0], view.anchorAt[1]];
  c.under = false;
  enter(c, 'IDLE', view);
  c.left = 2;
}
