/**
 * The threat telegraph (NEXT.md 12 c): the pattern a threat that acts plays before and while it acts, so a
 * player hears and sees it coming. Four beats, each with its visible twin (G24, G27):
 *   1. far: after dark a howl now and then, heard from far off, and the first one a night says so in the toast band;
 *   2. near: a layer of strange noises (breath, a twig, a padding) that grows as the player comes closer, while
 *      the threat's eyes already show in the dark;
 *   3. the alert on `seen`, as the stealth cues built it and kept there (`bangAt` in predator.ts, the growl, the flare);
 *   4. the act: the drawn threat stands beside the player by the bite, and each bite is drawn once, a lunge,
 *      a flinch and the health meter's own reaction.
 * Display only: the kernel decides every sight, bite and safe place, and nothing here reads back into it. Pure:
 * no scene and no audio graph, so the beats are tested on their own. A threat comes in by its kind and its
 * position, so a pit, a trap or deep water take the pattern with their own voices when they get them.
 */
import type { Bundle, Chase, GameEvent, HazardKind, Telegraph as Numbers } from '@game/kernel';
import type { BedId, SfxId } from './audio';
import { panFor } from './audio/spatial';

export type Spot = readonly [number, number];

/** The voices of each kind of threat: its far call and its near layer. A kind with none is silent here. */
export const VOICES: Partial<Record<HazardKind, { far: SfxId; near: BedId }>> = {
  predator: { far: 'howl', near: 'prowl' },
};

/** The first far howl of a night, as the toast band says it (its visible twin). */
export const HOWL_LINE = 'A howl, far off.';

/** The telegraph's numbers for a kind of threat, from the content's params; undefined when it has none. */
export function telegraphOf(b: Bundle, kind: HazardKind): Numbers | undefined {
  return kind === 'predator' ? b.params.hazard.predator.telegraph : undefined;
}

/** Tiles between two spots, as the crow flies. */
export function tilesBetween(a: Spot, b: Spot): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

/** The far howl's level at `tiles` from its cause, 0 to 1: `howl_pct` beside it, falling to nothing at `howl_tiles`. */
export function farGain(t: Numbers, tiles: number): number {
  if (!(tiles < t.howl_tiles)) return 0;
  return (t.howl_pct / 100) * (1 - Math.max(0, tiles) / t.howl_tiles);
}

/** The rising layer's level at `tiles` from the threat, 0 to 1: nothing from `near_tiles` on, then growing to `near_pct` beside it. */
export function nearGain(t: Numbers, tiles: number): number {
  if (!(tiles < t.near_tiles)) return 0;
  const closed = 1 - Math.max(0, tiles) / t.near_tiles;
  return (t.near_pct / 100) * closed ** t.near_curve;
}

/** A threat as the telegraph hears it: its prop id, its kind, where it is drawn (tiles), and whether it is out now. */
export interface Threat {
  id: string;
  kind: HazardKind;
  at: Spot;
  /** out and acting now: a predator awake and drawn, a pit or a trap that can hurt */
  out: boolean;
}

/** What the player hears of the threats this moment: each near layer's level and pan, and a far call if one sounds now. */
export interface Heard {
  near: Partial<Record<BedId, { level: number; pan: number }>>;
  far?: { id: string; sfx: SfxId; gain: number; pan: number; first: boolean };
}

/**
 * The far and the near beats over time. `hear` is called every frame or every few: it says how loud each near
 * layer is, and when a far call is due it picks the nearest threat out of the near range and inside its far
 * range, and says whether it is the first of this night (the toast's cue). The wait between two far calls is
 * drawn between `howl_gap_min_s` and `howl_gap_max_s` by `rng`, and starts again at each dusk.
 */
export class Telegraph {
  private nextFarAt: number | undefined;
  private night: number | undefined;
  private calledNight: number | undefined;

  constructor(
    private readonly b: Bundle,
    private readonly rng: () => number = Math.random,
  ) {}

  /**
   * `nowMs` is the wall clock in ms, `dusk` the tick of the night's dusk (null by day), `player` where the
   * player is drawn, `hunted` the id of a threat that hunts the player now (its far call is silent then).
   */
  hear(nowMs: number, dusk: number | null, player: Spot, threats: readonly Threat[], hunted: string | null): Heard {
    const heard: Heard = { near: {} };
    for (const th of threats) {
      const t = telegraphOf(this.b, th.kind);
      const voice = VOICES[th.kind];
      if (!t || !voice || !th.out) continue;
      const level = nearGain(t, tilesBetween(player, th.at));
      const was = heard.near[voice.near];
      if (!was || level > was.level) heard.near[voice.near] = { level, pan: panFor(th.at[0] - player[0], t.near_tiles) };
    }
    for (const v of Object.values(VOICES)) if (v && !heard.near[v.near]) heard.near[v.near] = { level: 0, pan: 0 };

    if (dusk === null) {
      this.night = undefined;
      this.nextFarAt = undefined;
      return heard;
    }
    if (this.night !== dusk) {
      this.night = dusk;
      this.nextFarAt = nowMs + this.gap();
    }
    if (this.nextFarAt === undefined || nowMs < this.nextFarAt) return heard;
    this.nextFarAt = nowMs + this.gap();
    let best: { th: Threat; t: Numbers; tiles: number } | undefined;
    for (const th of threats) {
      const t = telegraphOf(this.b, th.kind);
      if (!t || !VOICES[th.kind] || !th.out || th.id === hunted) continue;
      const tiles = tilesBetween(player, th.at);
      // the far call is the far beat: inside the near range the layer speaks instead
      if (tiles < t.near_tiles || farGain(t, tiles) <= 0) continue;
      if (!best || tiles < best.tiles) best = { th, t, tiles };
    }
    if (!best) return heard;
    const first = this.calledNight !== dusk;
    this.calledNight = dusk;
    heard.far = { id: best.th.id, sfx: VOICES[best.th.kind]!.far, gain: farGain(best.t, best.tiles), pan: panFor(best.th.at[0] - player[0], best.t.howl_tiles), first };
    return heard;
  }

  /** The wait before the next far call, in ms, between the predator's two bounds. */
  private gap(): number {
    const t = this.b.params.hazard.predator.telegraph;
    if (!t) return Number.POSITIVE_INFINITY;
    const lo = Math.min(t.howl_gap_min_s, t.howl_gap_max_s) * 1000;
    const hi = Math.max(t.howl_gap_min_s, t.howl_gap_max_s) * 1000;
    return lo + this.rng() * (hi - lo);
  }
}

/** The tick of the hunt's next bite by the kernel's clock: the first `catch_ms` after it began, then one every `bite_ms`. */
export function nextBiteAt(b: Bundle, chase: Chase): number {
  const { catch_ms, bite_ms } = b.params.hazard.predator;
  return chase.since + catch_ms + chase.bites * bite_ms;
}

/**
 * Beat 4, the run: how many game ms a drawn predator takes for each of the `steps` tiles still between it and
 * the player's side, so it stands there by the next bite, `msLeft` from now. Never slower than its own pace,
 * never faster than `dash` (the telegraph's `dash_ms`); with no time left it goes at `dash`.
 */
export function catchPace(steps: number, msLeft: number, pace: number, dash: number): number {
  if (steps <= 0) return pace;
  if (msLeft <= 0) return Math.min(pace, dash);
  return Math.max(Math.min(pace, dash), Math.min(pace, msLeft / steps));
}

/** One drawn bite: when it began on the wall clock, and which threat bit. */
export interface Bite {
  at: number;
  id: string;
}

/**
 * Beat 4, the bite drawn: one lunge and one flinch for each `hurt` the kernel tells from a predator, never for
 * a pit, a trap, deep water or hunger. Under reduced motion the lunge and the flinch are left out and the meter
 * keeps its reaction.
 */
export class Bites {
  private readonly started: Bite[] = [];
  private total = 0;

  constructor(private readonly b: Bundle) {}

  /** Takes a batch of the kernel's events; returns the bites it starts, one per `hurt` from a predator. */
  take(events: readonly GameEvent[], nowMs: number): Bite[] {
    const fresh: Bite[] = [];
    for (const e of events) {
      if (e.e !== 'hurt' || e.by !== 'predator' || e.id === undefined) continue;
      const bite = { at: nowMs, id: e.id };
      this.started.push(bite);
      this.total += 1;
      fresh.push(bite);
    }
    while (this.started.length > 8) this.started.shift();
    return fresh;
  }

  /** How many bites have been drawn in all. */
  get count(): number {
    return this.total;
  }

  /**
   * The pose `nowMs` into the latest bite of threat `id`: the lunge toward the player and the flinch away from
   * the threat in game px, each rising and falling once, and whether the meter shows the bite. All 0 when no
   * bite runs.
   */
  pose(id: string, nowMs: number, motion: boolean): { lunge: number; flinch: number; hit: boolean } {
    const t = this.b.params.hazard.predator.telegraph;
    const last = [...this.started].reverse().find((x) => x.id === id);
    if (!t || !last) return { lunge: 0, flinch: 0, hit: false };
    const ms = nowMs - last.at;
    const hit = ms >= 0 && ms < t.hit_ms;
    if (!motion) return { lunge: 0, flinch: 0, hit };
    return { lunge: t.lunge_px * swing(ms, t.lunge_ms), flinch: t.flinch_px * swing(ms, t.flinch_ms), hit };
  }
}

/** Out and back once within `ms`: 0 before and after, 1 at a third of the way, a quick strike and a slower return. */
export function swing(at: number, ms: number): number {
  if (!(at >= 0 && at < ms)) return 0;
  const peak = ms / 3;
  return at < peak ? at / peak : (ms - at) / (ms - peak);
}
