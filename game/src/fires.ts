/**
 * Tended fires (NEXT 13, G31): what the client says and shows about a fire the
 * player feeds by hand. Pure: every answer comes from the bundle, the state and
 * the game tick the caller passes, never from a clock of the client's own.
 */
import {
  OWN_FIRE,
  type Bundle,
  type State,
  burnsAsWood,
  fireBurns,
  fireOf,
  idiv,
  idivUp,
  isNight,
  lastDusk,
  logMsOf,
  minuteOfDay,
  nextLogAt,
  nightEnds,
  nightFalls,
  tendHolds,
} from '@game/kernel';

/** A fire's name as the player reads it: its id after the namespace, hyphens as spaces ("core/elder-hearth" is "elder hearth"), and "fire" for the one the player kindles, which has no place to name. */
export function fireName(id: string): string {
  if (id === OWN_FIRE) return 'fire';
  return id.slice(id.indexOf('/') + 1).replaceAll('-', ' ');
}

/** The camp part whose logs and time build the player's own fire: the kernel's `kindle` reads its inputs (NEXT 21 a). */
const KINDLE_FROM = 'core/campfire';

/** Whether the bag holds what kindling takes, so the Build a fire button has a place (the kernel keeps the logs on a refusal). */
export function holdsKindling(b: Bundle, s: State): boolean {
  const camp = b.camps[KINDLE_FROM];
  return camp !== undefined && camp.inputs.every((input) => (s.player.bag[input.item] ?? 0) >= input.qty);
}

/**
 * How a burning fire looks by the wood left in it (NEXT 21b): full at three quarters of a log or more, steady at half,
 * low above the warning, and embers through the last `fire.warn_min` game minutes, so the flame is seen to dim.
 * A log is the fire's own (`logMsOf`: shorter on dangerous ground), so no count of logs or minutes is ever shown.
 */
export type FireStage = 'out' | 'embers' | 'low' | 'steady' | 'full';

export function fireStage(b: Bundle, s: State, id: string, tick: number): FireStage {
  const fire = fireOf(s, id);
  if (fire === undefined || fire.until <= tick) return 'out';
  const left = fire.until - tick;
  const log = logMsOf(b, s, id);
  if (left * 4 > log * 3) return 'full';
  if (left * 2 > log) return 'steady';
  return left > warnTicks(b) ? 'low' : 'embers';
}

/** The wood a Feed sends: a log when the bag holds one, else the first wood item in the bag; undefined with no wood. */
export function woodToFeed(b: Bundle, s: State): string | undefined {
  const bag = s.player.bag;
  if ((bag['core/log'] ?? 0) > 0 && burnsAsWood(b, 'core/log')) return 'core/log';
  return Object.keys(bag).find((id) => (bag[id] ?? 0) > 0 && burnsAsWood(b, id));
}

/** The game ticks of `fire.warn_min` game minutes: how long before a fire goes out its warning opens and its flame dims. */
export function warnTicks(b: Bundle): number {
  return idiv(b.params.fire.warn_min * b.params.day_length_ms, 24 * 60);
}

/** A burning fire within its last `fire.warn_min` game minutes: the embers run down. */
export function fireLow(b: Bundle, s: State, id: string, tick: number): boolean {
  const fire = fireOf(s, id);
  return fire !== undefined && fire.until > tick && fire.until - tick <= warnTicks(b);
}

/**
 * The once-per-burn key of a fire's warning: one value for each uninterrupted burn
 * (one `lit`), while that burn is in its last `fire.warn_min` game minutes.
 */
export function fireWarnKey(b: Bundle, s: State, id: string, tick: number): string | undefined {
  const fire = fireOf(s, id);
  return fire !== undefined && fireLow(b, s, id, tick) ? `${id}@${fire.lit}` : undefined;
}

/** The fires that a `tend` step of an active quest asks the player to keep. */
export function tendedFires(b: Bundle, s: State): Set<string> {
  const out = new Set<string>();
  for (const [id, state] of Object.entries(s.player.quests)) {
    if (state !== 'active') continue;
    for (const st of b.quests[id]?.steps ?? []) if (st.kind === 'tend') out.add(st.fire);
  }
  return out;
}

/**
 * The fire warning to open now (G31), if any: a fire an active tend step names, in the
 * last minutes of a burn not yet warned of, while that fire still wants wood for the night
 * it keeps (`wantsWood`), wherever the player stands: the night is theirs to keep, so the
 * screen does not decide. A burn whose wood reaches dawn goes out at dawn with the night
 * kept, so it is not warned of. The fire the player kindles is one of these by the word
 * `own`; it needs no prop on the map. Sorted, so the same fire warns first on every replay.
 */
export function fireWarning(
  b: Bundle,
  s: State,
  tick: number,
  warned: ReadonlySet<string>,
): { key: string; id: string; name: string } | undefined {
  for (const id of [...tendedFires(b, s)].sort()) {
    const key = fireWarnKey(b, s, id, tick);
    if (key === undefined || warned.has(key) || !wantsWood(b, s, id, tick)) continue;
    return { key, id, name: fireName(id) };
  }
  return undefined;
}

/**
 * Whether a tend step's fire still wants wood for the night it keeps: its vigil does not hold,
 * it burns, it was lit by that night's dusk, and its wood falls short of that dawn. Only then
 * does the journal count logs (`tendLine`) and the running-low warning open (`fireWarning`).
 */
export function wantsWood(b: Bundle, s: State, id: string, tick: number): boolean {
  const fire = fireOf(s, id);
  return (
    fire !== undefined &&
    !tendHolds(b, s, id, tick) &&
    fire.until > tick &&
    fire.lit <= vigilDusk(b, tick) &&
    logsToDawn(b, s, id, tick) > 0
  );
}

/**
 * The logs a fire still needs to burn until the dawn of the night it keeps: the night
 * under way, or by day the one that comes next. 0 when its wood already reaches dawn.
 * A log of the player's own fire is the one it was kindled with, shorter on deeper ground.
 */
export function logsToDawn(b: Bundle, s: State, id: string, tick: number): number {
  const until = fireOf(s, id)?.until ?? tick;
  const dawn = nightEnds(b, vigilDusk(b, tick));
  return dawn > until ? idivUp(dawn - until, logMsOf(b, s, id)) : 0;
}

/** The dusk a vigil kept now belongs to: the last one while it is dark, the next one by day. */
function vigilDusk(b: Bundle, tick: number): number {
  return isNight(b, tick) ? lastDusk(b, tick) : nightFalls(b, tick);
}

/**
 * The game clock of the first minute that starts at or after `tick` ("21:00"), so a time the
 * player may act from is never shown early. text.ts's clock, kept here: text.ts imports this file.
 */
function clockFrom(b: Bundle, tick: number): string {
  const m = minuteOfDay(b, tick);
  const from = minuteOfDay(b, tick - 1) === m ? (m + 1) % (24 * 60) : m;
  return `${Math.floor(from / 60)}:${String(from % 60).padStart(2, '0')}`;
}

/** The clock time from which a fire too full for a whole log takes the next one ("21:00"); undefined while one fits now. */
export function nextLogClock(b: Bundle, s: State, id: string, tick: number): string | undefined {
  const next = nextLogAt(b, s, id, tick);
  return next > tick ? clockFrom(b, next) : undefined;
}

/**
 * How the night of a fire is lost, if it is: `out` in the night when the fire that burned
 * at its dusk has gone out (the kernel tells that `fire_out`), `late` while a fire lit after
 * that dusk burns (it cannot keep the night), and `past` by day after a night the fire went
 * out in, until the next dusk. Undefined while the night can still be kept, once it was
 * kept, and from the next dusk on, which starts clean.
 */
export function nightLost(b: Bundle, s: State, id: string, tick: number): 'out' | 'late' | 'past' | undefined {
  const fire = fireOf(s, id);
  const dusk = lastDusk(b, tick);
  if (fire === undefined || fire.until < dusk || tendHolds(b, s, id, tick)) return undefined;
  if (!isNight(b, tick)) return fire.until < nightEnds(b, dusk) ? 'past' : undefined;
  if (fire.until <= tick) return 'out';
  return fire.lit > dusk ? 'late' : undefined;
}

/** Whether a feed of a kept fire lit it, or fed it, after its night was lost: that is answered plainly, never cheered. */
export function feedTooLate(b: Bundle, s: State, id: string, tick: number): boolean {
  return tendedFires(b, s).has(id) && nightLost(b, s, id, tick) === 'late';
}

const LOST = { out: 'it went out, tonight is lost', late: 'tonight is lost', past: 'it went out in the night' } as const;

/**
 * The journal line of a tend step: "Keep the <name> burning until dawn", and while the
 * vigil does not hold, what it still needs - lighting before dusk when the fire is out
 * or was lit after dark began (saying so while its night is lost, `nightLost`), else the
 * logs that carry it to dawn, and while the fire is too full for a whole log, the time the
 * next one fits (the kernel refuses it before). A fire with wood to dawn still waits for
 * it: the vigil holds only once dawn has come.
 *
 * The player's own fire says no count and no clock (NEXT 21b): its log is shorter the deeper
 * the ground it stands on, so a number of logs would tell the danger level (G30, CR-38).
 * It asks for wood while it needs it and no more.
 */
export function tendLine(b: Bundle, s: State, id: string, tick: number): { text: string; done: boolean } {
  const text = `Keep the ${fireName(id)} burning until dawn`;
  if (tendHolds(b, s, id, tick)) return { text, done: true };
  const lost = nightLost(b, s, id, tick);
  if (lost !== undefined) return { text: `${text} - ${LOST[lost]}: light it before dusk`, done: false };
  const fire = fireOf(s, id);
  if (fire === undefined || fire.until <= tick || fire.lit > vigilDusk(b, tick)) return { text: `${text} - light it before dusk`, done: false };
  if (logsToDawn(b, s, id, tick) === 0) return { text: `${text} - it has the wood: wait for dawn`, done: false };
  if (id === OWN_FIRE) return { text: `${text} - it still needs wood`, done: false };
  const n = logsToDawn(b, s, id, tick);
  const at = nextLogClock(b, s, id, tick);
  const when = at === undefined ? '' : `, the next at ${at}`;
  return { text: `${text} - fed to reach dawn: ${n} more ${n === 1 ? 'log' : 'logs'}${when}`, done: false };
}

/** Whether a prop's note and sign can be read now: always, unless it is lit by a fire that does not burn (`lit_by`). */
export function readable(s: State, litBy: string | undefined, tick: number): boolean {
  return litBy === undefined || fireBurns(s, litBy, tick);
}

/** What looking at an unlit `lit_by` prop says. */
export const TOO_DARK = 'Too dark to read.';
