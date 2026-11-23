/**
 * The drafts store keeps only what is usable (owner, 22.11, track #812). This is the pure part: the rules that sort every
 * draft into remove or keep, each removal by a written rule with a reason code. `prune-cli.ts` reads the inputs, writes the
 * report and the contact sheets, and (after the manager's GO) removes the files. Nothing here reads the disk or the network.
 *
 *   R1 owner-archive    the owner's own review is `archive` (his hand sort on the library page, or an index review stamped by him)
 *   R2 pick-lost        an option of an owner pick that closed on another option (`tools/kit-gen/prune/pick-closes.json`)
 *   R3 old-era          drawn for the 16 px or 32 px game, before the 64 px decision of 18.10
 *   R4 retired-subject  its subject is retired in the pools and a grep of content/ and docs/design/ finds it nowhere
 *   R5 duplicate        its raw picture is byte for byte another draft's picture, and the other draft ranks higher
 *   R6 broken           the draw reported errors, or its file is empty or missing from the store
 *
 * Never removed, whatever the rule says: a draft reviewed keep, rework or reuse-parts (in the index or on the page); a draft a
 * file of the repo uses; a wrong draw kept for another role (`looks_like`); a 3D door draft (paused, not retired); a draft a
 * close names as kept; a draft under 7 days old that no pick has closed. When unsure, keep.
 */
import { type Draft, FILE_KINDS, type FileKind, type ReviewState } from './drafts.js';
import { dateOf } from './library.js';
import { OWNER_BY } from './library-reviews.js';

export const RULES = [
  { rule: 'R1', code: 'owner-archive', title: 'the owner archived it' },
  { rule: 'R2', code: 'pick-lost', title: 'an option of an owner pick that went to another option' },
  { rule: 'R3', code: 'old-era', title: 'drawn for the 16 px or 32 px game' },
  { rule: 'R4', code: 'retired-subject', title: 'its subject is retired and nothing uses the name' },
  { rule: 'R5', code: 'duplicate', title: 'the same picture as a higher ranked draft' },
  { rule: 'R6', code: 'broken', title: 'errors set, or the file is empty or missing' },
] as const;
export type RuleId = (typeof RULES)[number]['rule'];
export const codeOf = (rule: RuleId): string => RULES.find((r) => r.rule === rule)!.code;

/** The day the 64 px decision was made: a draft made on or before it, at a 16 or 32 px scale, is the old game's. */
export const ERA_END = '2026-10-18';
/** A draft younger than this many days, with no pick closing it, is not touched. */
export const YOUNG_DAYS = 7;
/** Review states that are never removed. */
export const KEPT_STATES: readonly ReviewState[] = ['keep', 'rework', 'reuse-parts'];

/** A source of a draft is matched by regular expressions on its label, run folder and file; every one given must match. */
export interface Matcher { label?: string; run?: string; file?: string }

/** One owner pick that closed: the drafts that were its options and lost are removed. Written when the pick closes. */
export interface PickClose {
  id: string;
  closed: string;
  /** Where the answer is written: the DECISIONS heading. */
  decision: string;
  /** The hub answer file (`hub/answers/<hub>.json`) that holds the owner's pick; checked when the folder is there. */
  hub?: string;
  note?: string;
  /** What the owner picked, for the report. */
  picked?: string;
  /** A draft is lost when one of its sources matches one of these and every other source is one of these or a `scratch` folder. */
  lost: Matcher[];
  /** The trial's working folders (a job's output folder, a frames folder): a copy of the same bytes, never a reason to keep a draft. */
  scratch?: Matcher[];
  /** A draft with a source matching one of these is never removed, by any rule (the owner's keep list of the same pick). */
  keep?: Matcher[];
}

export interface RetiredEntry { name: string; kit_id?: string; why: string }

export interface Choice { review: ReviewState; at: string }

export interface PruneInput {
  /** The live drafts: those whose files are still in the store. */
  drafts: readonly Draft[];
  /** The owner's page choices (the last per id). */
  owner: ReadonlyMap<string, Choice>;
  /** Draft id to the repo files that use its picture (a catalogue that merely lists drafts is not a use). */
  uses: ReadonlyMap<string, readonly string[]>;
  closes: readonly PickClose[];
  /** Whether the hub answer a close names exists and stands: true, false, or null when the folder is not there. */
  hubOk: (hub: string) => boolean | null;
  retired: readonly RetiredEntry[];
  /** The repo files that still name a retired subject (content/, docs/design/, the live pools). */
  nameHits: (term: string) => readonly string[];
  /** The asset names the store holds, or null when the store was not listed. */
  present: ReadonlySet<string> | null;
  /** The names of the objects the game or its pools still has (kit sprites, pool entries): an archived draft of one of these has a home. */
  objects: ReadonlySet<string>;
  now: Date;
}

export interface Verdict {
  id: string;
  rule: RuleId;
  code: string;
  /** The evidence, one line. */
  why: string;
  /** 0 to 1: how certain the rule is of this one. The sheets show the least certain first. */
  sure: number;
  bytes: number;
}

/** A draft a rule matched and a protection held back: the report counts them so a reader sees what the rules would catch. */
export interface Held { id: string; rule: RuleId; by: string; detail: string }

export interface Plan {
  remove: Verdict[];
  held: Held[];
  /** Why each draft that no rule caught stays, counted by the protection or by "no rule". */
  kept: Map<string, number>;
  /** The drafts no rule matched at all and no protection covers: what is left for the owner's library sort. */
  uncaught: string[];
}

/* ---- small helpers ---- */

export const bytesOf = (d: Draft): number => FILE_KINDS.reduce((n, k) => n + (d.files[k]?.bytes ?? 0), 0);

export function assetsOf(d: Draft): string[] {
  const out: string[] = [];
  for (const kind of FILE_KINDS) {
    const name = d.stored?.assets[kind as FileKind];
    if (name !== undefined) out.push(name);
  }
  return out;
}

const text = (d: Draft): string => [d.name, d.spec ?? '', ...d.sources.flatMap((s) => [s.label, s.run ?? '', s.file ?? ''])].join(' ');

function matches(m: Matcher, s: { label: string; run: string | null; file: string | null }): boolean {
  const ok = (pattern: string | undefined, value: string | null): boolean => pattern === undefined || new RegExp(pattern, 'i').test(value ?? '');
  return ok(m.label, s.label) && ok(m.run, s.run) && ok(m.file, s.file) && (m.label !== undefined || m.run !== undefined || m.file !== undefined);
}

const anySource = (d: Draft, ms: readonly Matcher[]): boolean => d.sources.some((s) => ms.some((m) => matches(m, s)));
/** At least one source is a lost option, and no source is anything else than a lost option or the trial's working folder. */
function isLost(d: Draft, c: PickClose): boolean {
  const scratch = c.scratch ?? [];
  const real = d.sources.filter((s) => !scratch.some((m) => matches(m, s)));
  return real.length > 0 && real.every((s) => c.lost.some((m) => matches(m, s)));
}

/** The 3D door's drafts: paused, not retired. A model file, or a source of the 3D trials, the cast's rigs, the hd2d study. */
export function isThreeD(d: Draft): boolean {
  if ((d.files.raw.ext ?? '.png') === '.glb') return true;
  return /\b3d\b|3d-|-3d|meshy|hd2d|play3d|\bglb\b|work-char|blender/i.test(text(d)) || d.route === 'blender' || d.route === 'render';
}

/** Days between a draft's date and now, or null when no date is known. */
export function ageDays(d: Draft, now: Date): number | null {
  const day = dateOf(d)?.date;
  if (day === undefined) return null;
  return (now.getTime() - new Date(`${day}T00:00:00Z`).getTime()) / 86_400_000;
}

/** The review a draft stands at: the owner's page choice beats the index. */
export function reviewOf(d: Draft, owner: ReadonlyMap<string, Choice>): { review: ReviewState; byOwner: boolean } {
  const page = owner.get(d.id);
  if (page !== undefined) return { review: page.review, byOwner: true };
  return { review: d.review, byOwner: OWNER_BY.includes(d.review_by ?? '') };
}

const SCORE: Record<ReviewState, number> = { keep: 4, 'reuse-parts': 3, rework: 2, unreviewed: 1, archive: 0 };

/** Higher is kept: the most review first, then the oldest (a smaller date), then the smaller id. */
function ranksAbove(a: Draft, b: Draft, owner: ReadonlyMap<string, Choice>): boolean {
  const sa = SCORE[reviewOf(a, owner).review];
  const sb = SCORE[reviewOf(b, owner).review];
  if (sa !== sb) return sa > sb;
  const da = dateOf(a)?.date ?? '9999';
  const db = dateOf(b)?.date ?? '9999';
  if (da !== db) return da < db;
  return a.id < b.id;
}

/* ---- the protections ---- */

/** The reason a draft may not be removed, or null. The age check is separate: a pick that closed overrides it. */
export function protectedBy(d: Draft, input: PruneInput): string | null {
  const own = input.owner.get(d.id);
  if (KEPT_STATES.includes(d.review)) return `reviewed ${d.review}`;
  if (own !== undefined && KEPT_STATES.includes(own.review)) return `reviewed ${own.review} (the owner's page)`;
  const uses = input.uses.get(d.id);
  if (uses !== undefined && uses.length > 0) return `used by ${uses[0]}`;
  if (d.looks_like !== undefined && d.looks_like !== '') return 'a wrong draw kept for another role';
  if (isThreeD(d)) return 'the 3D door (paused, not retired)';
  for (const c of input.closes) if (c.keep !== undefined && anySource(d, c.keep)) return `kept by the pick ${c.id}`;
  return null;
}

/* ---- the rules ---- */

/** What the rules share: the names that still have a draft the owner kept. */
interface Ctx { keptNames: ReadonlySet<string> }

type Rule = (d: Draft, input: PruneInput, ctx: Ctx) => Omit<Verdict, 'id' | 'rule' | 'code' | 'bytes'> | null;

/** An object's name as the pools and the kit write it: the draft's own name without the timestamp or round tail. */
export const objectName = (d: Draft): string => d.name.replace(/-\d{4}-\d{2}-\d{2}T[\d-]+Z?$/, '').replace(/_2c_[a-z]-1x$/, '').replace(/-\d+x?$/, '');

/** How certain an archive is: an object that has a kept draft is surely replaced; one with no kept draft and no sprite or pool entry is the doubtful one. */
function archiveSure(d: Draft, input: PruneInput, ctx: Ctx): { sure: number; tail: string } {
  const name = objectName(d);
  if (ctx.keptNames.has(name)) return { sure: 1, tail: `; the object "${name}" has a kept draft` };
  if (input.objects.has(name)) return { sure: 0.85, tail: `; "${name}" is a kit sprite or pool entry, no kept draft` };
  return { sure: 0.5, tail: `; "${name}" has no kept draft, no kit sprite and no pool entry` };
}

const r1: Rule = (d, input, ctx) => {
  const page = input.owner.get(d.id);
  const a = archiveSure(d, input, ctx);
  if (page !== undefined) return page.review === 'archive' ? { why: `archived by the owner on the library page, ${page.at.slice(0, 10)}${a.tail}`, sure: a.sure } : null;
  if (d.review === 'archive' && OWNER_BY.includes(d.review_by ?? '')) return { why: `index review archive by ${d.review_by}${d.review_note ? `: ${d.review_note.slice(0, 60)}` : ''}${a.tail}`, sure: a.sure };
  return null;
};

const r2: Rule = (d, input) => {
  for (const c of input.closes) {
    if (!isLost(d, c)) continue;
    const hub = c.hub === undefined ? null : input.hubOk(c.hub);
    return { why: `lost the pick ${c.id} (${c.closed}${c.picked ? `, picked ${c.picked}` : ''}), its only homes are options that were not chosen${hub === false ? '; the hub answer is missing or void' : ''}`, sure: hub === false ? 0.3 : hub === null ? 0.8 : 1 };
  }
  return null;
};

/** An explicit 16 or 32 px mark in the draft's own names. */
const OLD_SCALE = /(?<![0-9])(16|32)\s?px(?![0-9a-z])|-(16|32)px\b|(?<![0-9])(16|32)x(16|32)(?![0-9])|trial-32/i;

const r3: Rule = (d) => {
  const day = dateOf(d)?.date ?? null;
  const side = d.asked === null ? null : Math.max(d.asked[0], d.asked[1]);
  if (day !== null && day <= ERA_END && side !== null && side <= 32) return { why: `made ${day} at ${d.asked![0]}x${d.asked![1]} art px, before the 64 px decision of ${ERA_END}`, sure: 0.8 };
  const mark = OLD_SCALE.exec([d.name, ...d.sources.flatMap((s) => [s.label, s.file ?? ''])].join(' '));
  const own = d.canvas === null ? null : Math.max(d.canvas[0], d.canvas[1]);
  if (mark !== null && own !== null && own <= 64 && (day === null || day <= ERA_END)) return { why: `named at the old scale ("${mark[0]}") and drawn at ${d.canvas![0]}x${d.canvas![1]}`, sure: 0.6 };
  return null;
};

const r4: Rule = (d, input) => {
  for (const e of input.retired) {
    if (d.name !== e.name && !d.name.startsWith(`${e.name}-`) && !d.name.startsWith(`${e.name}_2`)) continue;
    const hits = [...input.nameHits(e.name), ...(e.kit_id === undefined ? [] : input.nameHits(e.kit_id))];
    if (hits.length > 0) return { why: `retired (${e.why}) but ${hits[0]} still names it`, sure: -1 };
    return { why: `retired (${e.why}); content/, docs/design/ and the pools do not name it`, sure: 0.9 };
  }
  return null;
};

const r6: Rule = (d, input) => {
  if (d.errors.length > 0) return { why: `the draw reported: ${d.errors[0]!.slice(0, 90)}`, sure: 0.6 };
  if (d.files.raw.bytes === 0) return { why: 'the raw file is empty', sure: 1 };
  const raw = d.stored?.assets.raw;
  if (input.present !== null && (raw === undefined || !input.present.has(raw))) return { why: `the store has no ${raw ?? 'raw asset'}`, sure: 0.9 };
  return null;
};

const FIRST_PASS: readonly [RuleId, Rule][] = [['R1', r1], ['R2', r2], ['R3', r3], ['R4', r4], ['R6', r6]];

/** What a rule needs the draft to be, beyond the protections: R2 and R1 are the owner's own word and pass the age check. */
const IGNORES_AGE: ReadonlySet<RuleId> = new Set(['R1', 'R2']);
/** R6 (a missing or empty file) does not need a date; the others that look at age do. */
const NEEDS_DATE: ReadonlySet<RuleId> = new Set(['R3', 'R4', 'R5']);

export function planPrune(input: PruneInput): Plan {
  const remove: Verdict[] = [];
  const held: Held[] = [];
  const kept = new Map<string, number>();
  const uncaught: string[] = [];
  const note = (why: string): void => void kept.set(why, (kept.get(why) ?? 0) + 1);
  const gone = new Set<string>();
  const keptNames = new Set<string>();
  for (const d of input.drafts) if (KEPT_STATES.includes(reviewOf(d, input.owner).review) || KEPT_STATES.includes(d.review)) keptNames.add(objectName(d));
  const ctx: Ctx = { keptNames };

  const decide = (d: Draft, rule: RuleId, hit: { why: string; sure: number }): boolean => {
    const hold = (by: string): false => {
      held.push({ id: d.id, rule, by, detail: hit.why });
      return false;
    };
    const guard = protectedBy(d, input);
    if (guard !== null) return hold(guard);
    if (!IGNORES_AGE.has(rule)) {
      const age = ageDays(d, input.now);
      if (age !== null && age < YOUNG_DAYS) return hold(`under ${YOUNG_DAYS} days old`);
      if (age === null && NEEDS_DATE.has(rule) && !(rule === 'R3' && hit.sure >= 0.6)) return hold('age unknown');
    }
    if (hit.sure < 0) return hold(hit.why);
    remove.push({ id: d.id, rule, code: codeOf(rule), why: hit.why, sure: hit.sure, bytes: bytesOf(d) });
    gone.add(d.id);
    return true;
  };

  const caught = new Set<string>();
  for (const d of input.drafts) {
    for (const [rule, fn] of FIRST_PASS) {
      const hit = fn(d, input, ctx);
      if (hit === null) continue;
      caught.add(d.id);
      if (decide(d, rule, hit)) break;
    }
  }

  // R5 sees the others' removals: the picture it keeps must survive
  const holders = new Map<string, Draft[]>();
  for (const d of input.drafts) for (const kind of FILE_KINDS) { const f = d.files[kind]; if (f) holders.set(f.sha256, [...(holders.get(f.sha256) ?? []), d]); }
  for (const d of input.drafts) {
    if (gone.has(d.id)) continue;
    const others = (holders.get(d.files.raw.sha256) ?? []).filter((o) => o.id !== d.id && !gone.has(o.id));
    const best = others.filter((o) => ranksAbove(o, d, input.owner)).sort((a, b) => (ranksAbove(a, b, input.owner) ? -1 : 1))[0];
    if (best === undefined) continue;
    // every file of this draft must live on in another draft, or the removal would lose a picture
    const lost = FILE_KINDS.some((k) => { const f = d.files[k]; return f && !(holders.get(f.sha256) ?? []).some((o) => o.id !== d.id && !gone.has(o.id)); });
    if (lost) continue;
    caught.add(d.id);
    const keeper = reviewOf(best, input.owner);
    const sure = keeper.review === 'unreviewed' ? 0.7 : keeper.byOwner ? 1 : 0.85;
    decide(d, 'R5', { why: `its raw picture is a file of ${best.id} (${best.name}, ${keeper.review}${keeper.byOwner ? ' by the owner' : keeper.review === 'unreviewed' ? '' : ' by an agent'})`, sure });
  }

  for (const d of input.drafts) {
    if (gone.has(d.id)) continue;
    if (caught.has(d.id)) { note('a rule matched, a protection held it'); continue; }
    if (protectedBy(d, input) !== null) note('protected, no rule matched');
    else { note('no rule matched (left for the library sort)'); uncaught.push(d.id); }
  }
  return { remove, held, kept, uncaught };
}

/** Per rule: the count, the bytes, and the verdicts. */
export function byRule(plan: Plan): Map<RuleId, Verdict[]> {
  const out = new Map<RuleId, Verdict[]>(RULES.map((r) => [r.rule, []]));
  for (const v of plan.remove) out.get(v.rule)!.push(v);
  return out;
}

/** The sheet's cells: the least certain `doubt` first, then a random sample for the rest, up to `size`. Deterministic for a seed. */
export function sampleFor(verdicts: readonly Verdict[], seed: number, size = 48, doubt = 10): { doubtful: Verdict[]; sample: Verdict[] } {
  const ordered = [...verdicts].sort((a, b) => a.sure - b.sure || (a.id < b.id ? -1 : 1));
  const doubtful = ordered.slice(0, Math.min(doubt, ordered.length));
  const rest = ordered.slice(doubtful.length);
  let s = seed >>> 0 || 1;
  const rand = (): number => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 0x1_0000_0000; };
  for (let i = rest.length - 1; i > 0; i -= 1) { const j = Math.floor(rand() * (i + 1)); [rest[i], rest[j]] = [rest[j]!, rest[i]!]; }
  return { doubtful, sample: rest.slice(0, Math.max(0, size - doubtful.length)) };
}
