/**
 * Tended fires (NEXT 13, G31): what the client says and shows about a fire the
 * player feeds by hand. Pure: every answer comes from the bundle, the state and
 * the game tick the caller passes, never from a clock of the client's own.
 */
import {
  type Bundle,
  type State,
  burnsAsWood,
  fireBurns,
  idiv,
  idivUp,
  isNight,
  lastDusk,
  minuteOfDay,
  nextLogAt,
  nightEnds,
  nightFalls,
  tendHolds,
} from '@game/kernel';

type Prop = Bundle['map']['props'][number];

/** A fire's name as the player reads it: its id after the namespace, hyphens as spaces ("core/elder-hearth" is "elder hearth"). */
export function fireName(id: string): string {
  return id.slice(id.indexOf('/') + 1).replaceAll('-', ' ');
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
  const fire = s.player.fires?.[id];
  return fire !== undefined && fireBurns(s, id, tick) && fire.until - tick <= warnTicks(b);
}

/**
 * The once-per-burn key of a fire's warning: one value for each uninterrupted burn
 * (one `lit`), while that burn is in its last `fire.warn_min` game minutes.
 */
export function fireWarnKey(b: Bundle, s: State, id: string, tick: number): string | undefined {
  const fire = s.player.fires?.[id];
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
 * last minutes of a burn not yet warned of, that the player can see (`sees`, the screen),
 * while that fire still wants wood for the night it keeps (`wantsWood`). A burn whose wood
 * reaches dawn goes out at dawn with the night kept, so it is not warned of.
 */
export function fireWarning(
  b: Bundle,
  s: State,
  tick: number,
  warned: ReadonlySet<string>,
  sees: (prop: Prop) => boolean,
): { key: string; id: string; name: string } | undefined {
  const tended = tendedFires(b, s);
  for (const p of b.map.props) {
    if (p.fire !== true || p.id === undefined || !tended.has(p.id)) continue;
    const key = fireWarnKey(b, s, p.id, tick);
    if (key === undefined || warned.has(key) || !wantsWood(b, s, p.id, tick) || !sees(p)) continue;
    return { key, id: p.id, name: fireName(p.id) };
  }
  return undefined;
}

/**
 * Whether a tend step's fire still wants wood for the night it keeps: its vigil does not hold,
 * it burns, it was lit by that night's dusk, and its wood falls short of that dawn. Only then
 * does the journal count logs (`tendLine`) and the running-low warning open (`fireWarning`).
 */
export function wantsWood(b: Bundle, s: State, id: string, tick: number): boolean {
  const fire = s.player.fires?.[id];
  return (
    fire !== undefined &&
    !tendHolds(b, s, id, tick) &&
    fireBurns(s, id, tick) &&
    fire.lit <= vigilDusk(b, tick) &&
    logsToDawn(b, s, id, tick) > 0
  );
}

/**
 * The logs a fire still needs to burn until the dawn of the night it keeps: the night
 * under way, or by day the one that comes next. 0 when its wood already reaches dawn.
 */
export function logsToDawn(b: Bundle, s: State, id: string, tick: number): number {
  const until = s.player.fires?.[id]?.until ?? tick;
  const dawn = nightEnds(b, vigilDusk(b, tick));
  return dawn > until ? idivUp(dawn - until, b.params.fire.log_ms) : 0;
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
 * The journal line of a tend step: "Keep the <name> burning until dawn", and while the
 * vigil does not hold, what it still needs - lighting before dusk when the fire is out
 * or was lit after dark began, else the logs that carry it to dawn, and while the fire
 * is too full for a whole log, the time the next one fits (the kernel refuses it before).
 * A fire with wood to dawn still waits for it: the vigil holds only once dawn has come.
 */
export function tendLine(b: Bundle, s: State, id: string, tick: number): { text: string; done: boolean } {
  const text = `Keep the ${fireName(id)} burning until dawn`;
  if (tendHolds(b, s, id, tick)) return { text, done: true };
  const fire = s.player.fires?.[id];
  if (fire === undefined || !fireBurns(s, id, tick) || fire.lit > vigilDusk(b, tick)) return { text: `${text} - light it before dusk`, done: false };
  const n = logsToDawn(b, s, id, tick);
  if (n === 0) return { text: `${text} - it has the wood: wait for dawn`, done: false };
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
