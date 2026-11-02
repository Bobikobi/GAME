/**
 * The image library: one static page of every draft in `tools/kit-gen/drafts.jsonl`, sections by tool, a filter by
 * creation date, thumbnails fetched once from the private drafts store (see `library-cli.ts`, `tools/art-library/`).
 *
 * This file is the pure part: the rows (amendments already folded in by `DraftIndex`), the date a draft was made, and
 * the page. Nothing here reads the network or the disk.
 */
import { type Draft, REVIEW_STATES } from './drafts.js';
import { CSS, SCRIPT } from './library-page.js';
import { isMine } from './library-reviews.js';

/** Where a row's date came from, best first. */
export const DATE_SOURCES = ['at', 'source-at', 'source-file', 'tag'] as const;
export type DateSource = (typeof DATE_SOURCES)[number];

export interface Dated { date: string; from: DateSource }

const DAY = /^(\d{4})-(\d{2})-(\d{2})/;

function validDay(y: number, m: number, d: number): string | null {
  if (y < 2024 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** A calendar day (`YYYY-MM-DD`) from an ISO time; null when the text is not one. */
export function dayOf(iso: string | null | undefined): string | null {
  const m = DAY.exec(iso ?? '');
  return m === null ? null : validDay(Number(m[1]), Number(m[2]), Number(m[3]));
}

/** A timestamp in a file name: `20261030`, `2026-10-30`, `2026_10_30`, or a 10 or 13 digit epoch. */
export function dayInFileName(file: string | null | undefined): string | null {
  const name = file ?? '';
  const ymd = /(?<!\d)(20\d{2})[-_]?(\d{2})[-_]?(\d{2})(?!\d)/.exec(name);
  if (ymd !== null) {
    const day = validDay(Number(ymd[1]), Number(ymd[2]), Number(ymd[3]));
    if (day !== null) return day;
  }
  const epoch = /(?<!\d)(1[67]\d{8})(\d{3})?(?!\d)/.exec(name);
  if (epoch?.[1] !== undefined) return dayOf(new Date(Number(epoch[1]) * 1000).toISOString());
  return null;
}

/** The date in a store tag: `run-YYYYMMDD-...`. */
export function dayInTag(tag: string | null | undefined): string | null {
  const m = /^run-(\d{4})(\d{2})(\d{2})(?!\d)/.exec(tag ?? '');
  return m === null ? null : validDay(Number(m[1]), Number(m[2]), Number(m[3]));
}

/** When a draft was made: its own `at`, else a source's `at`, a timestamp in a source's file name, the store tag's day. */
export function dateOf(draft: Draft): Dated | null {
  const own = dayOf(draft.at);
  if (own !== null) return { date: own, from: 'at' };
  const earliest = (days: (string | null)[]): string | null => days.filter((d): d is string => d !== null).sort()[0] ?? null;
  const fromSource = earliest(draft.sources.map((s) => dayOf(s.at)));
  if (fromSource !== null) return { date: fromSource, from: 'source-at' };
  const fromFile = earliest(draft.sources.map((s) => dayInFileName(s.file)));
  if (fromFile !== null) return { date: fromFile, from: 'source-file' };
  const fromTag = dayInTag(draft.stored?.tag);
  return fromTag === null ? null : { date: fromTag, from: 'tag' };
}

/* ---- the tools ---- */

export interface Tool { key: string; label: string; note: string }

/** The sections of the page, in order. A draft with a route nobody listed falls in the last one. */
export const TOOLS: readonly Tool[] = [
  { key: 'pixellab', label: 'PixelLab', note: 'PixelLab, ציור ואנימציה בענן' },
  { key: 'blender', label: 'Blender', note: 'רנדר ותנועה מ-Blender' },
  { key: 'kaggle-qwen', label: 'Kaggle - Qwen', note: 'Qwen-Image 2512, GPU בענן' },
  { key: 'kaggle-flux', label: 'Kaggle - FLUX', note: 'FLUX.1 schnell, GPU בענן' },
  { key: 'kaggle-sdxl', label: 'Kaggle - SDXL', note: 'Stable Diffusion XL עם pixel-art LoRA, GPU בענן' },
  { key: 'kaggle-sd15', label: 'Kaggle - SD 1.5', note: 'Stable Diffusion 1.5 עם pixel LoRA, GPU בענן' },
  { key: 'local', label: 'כלי מקומי', note: 'SD 1.5 עם PixelArtRedmond, על המחשב הזה' },
  { key: 'codex', label: 'Codex', note: 'מחולל התמונות של Codex' },
  { key: 'gemini', label: 'Gemini', note: 'דרך הדפדפן' },
  { key: 'render', label: 'סקריפט', note: 'ציור בקוד' },
  { key: 'scatter', label: 'פיזור', note: 'המודל מצייר צורות קטנות, סקריפט מפזר' },
  { key: 'hand', label: 'ידני', note: 'מאגר ידני' },
  { key: 'unknown', label: 'כלי לא רשום', note: 'ישנים, בלי רישום של הכלי' },
];

export function toolOf(draft: Pick<Draft, 'route' | 'recipe'>): string {
  const route = draft.route ?? '';
  if (route === 'kaggle') {
    const key = `kaggle-${draft.recipe ?? ''}`;
    return TOOLS.some((t) => t.key === key) ? key : 'unknown';
  }
  if (route === 'gemini-web') return 'gemini';
  if (route === 'pool-hand') return 'hand';
  return TOOLS.some((t) => t.key === route) ? route : 'unknown';
}

/* ---- rows ---- */

export interface Row {
  id: string;
  /** Tool key. */
  t: string;
  n: string;
  /** The group: the spec's pool, else the first source's label. */
  g: string;
  /** Review state, from the folded draft (an amendment wins over the first line). */
  r: string;
  note: string;
  by: string;
  /** True when the owner sorted it by hand (his own choice, or a stamp in his name): the counter "sorted by you" counts these. */
  o: boolean;
  /** When the owner's choice on the page was saved; '' when the state comes from the index. */
  sa: string;
  /** Day made, `YYYY-MM-DD`, or '' when no fallback knows it. */
  d: string;
  ds: DateSource | '';
  m: string;
  seed: number | null;
  c: [number, number] | null;
  p: string;
  tag: string;
  /** The extension the picture has in the store; a thumbnail exists only for pictures. */
  x: string;
  /** True when a thumbnail file is on the page. */
  th: boolean;
}

export function rowOf(draft: Draft, hasThumb: (id: string) => boolean): Row {
  const dated = dateOf(draft);
  return {
    id: draft.id,
    t: toolOf(draft),
    n: draft.name,
    g: draft.pool ?? draft.sources[0]?.label ?? '',
    r: draft.review,
    note: draft.review_note ?? '',
    by: draft.review_by ?? '',
    o: isMine(draft.review, draft.review_by),
    sa: '',
    d: dated?.date ?? '',
    ds: dated?.from ?? '',
    m: [draft.model, draft.model_version].filter((v) => v != null && v !== '').join(' ') || draft.recipe || '',
    seed: draft.seed,
    c: draft.canvas,
    p: draft.prompt ?? '',
    tag: draft.stored?.tag ?? '',
    x: draft.files.raw.ext ?? '.png',
    th: hasThumb(draft.id),
  };
}

export interface DateReport {
  total: number;
  byFallback: Record<DateSource, number>;
  undated: number;
}

export function dateReport(rows: readonly Row[]): DateReport {
  const byFallback: Record<DateSource, number> = { at: 0, 'source-at': 0, 'source-file': 0, tag: 0 };
  let undated = 0;
  for (const r of rows) {
    if (r.ds === '') undated += 1;
    else byFallback[r.ds] += 1;
  }
  return { total: rows.length, byFallback, undated };
}

export function dateReportText(report: DateReport): string {
  const b = report.byFallback;
  return `dates: ${b.at} from at, ${b['source-at']} from a source's at, ${b['source-file']} from a timestamp in a source's file name, ${b.tag} from the store tag; ${report.undated} undated (of ${report.total})`;
}

/** Newest day first; the same day by name; undated last. */
export function sortRows(rows: readonly Row[]): Row[] {
  return [...rows].sort((a, b) => (a.d === b.d ? a.n.localeCompare(b.n) || a.id.localeCompare(b.id) : a.d === '' ? 1 : b.d === '' ? -1 : a.d < b.d ? 1 : -1));
}

/* ---- the page ---- */

export interface PageOptions {
  /** ISO time the page was built; shown as "עודכן ב...". */
  builtAt: string;
}

const REVIEWS: readonly (readonly [string, string])[] = [
  ['all', 'הכול'], ['keep', 'נשמר'], ['reuse-parts', 'חלקים'], ['rework', 'לתקן'], ['unreviewed', 'לא נבדק'], ['archive', 'בארכיון'],
];

const BUTTON_LABELS: Record<string, string> = { keep: 'שמור', 'reuse-parts': 'חלקים', rework: 'לתקן', archive: 'ארכיון' };

/** JSON that is safe inside a `<script>` element. */
function inlineJson(value: unknown): string {
  return [0x2028, 0x2029].reduce((text, code) => text.split(String.fromCharCode(code)).join(`\\u${code.toString(16)}`), JSON.stringify(value).replace(/</g, '\\u003c'));
}

export function renderLibrary(rows: readonly Row[], opts: PageOptions): string {
  const sorted = sortRows(rows);
  return `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>כל התמונות שיצרנו, לפי כלי</title>
<style>${CSS}</style></head><body><div id="top"><div id="prog"><b id="cnt"></b><div id="bar"><i></i></div><span id="sv"></span></div>
<div id="nosrv">הדף נפתח בלי שרת השמירה (tools/art-library/serve.py): אי אפשר לשמור בחירות מכאן.</div>
<div id="sel"><b id="selcount"></b> <input id="selnote" maxlength="300" placeholder="הערה לכל הנבחרות (לא חובה)" autocomplete="off">
${REVIEW_STATES.map((st) => `<button data-bs="${st}" class="b-${st}">${st === 'unreviewed' ? '↺ לא נבדק' : (BUTTON_LABELS[st] ?? st)}</button>`).join(' ')}
<button data-selall="1" id="selshown"></button> <button data-selclear="1">נקה בחירה</button></div></div>
<header><h1>כל התמונות שיצרנו, לפי כלי <span id="n" class="d"></span></h1>
<div class="d" id="upd" data-total="${sorted.length}" data-built="${opts.builtAt}"></div>
<div class="row" id="tools"></div>
<div class="row"><input id="q" placeholder="חיפוש לפי שם, למשל tree"><span id="rv"></span></div>
<div class="row" id="dates"><label>מתאריך <input type="date" id="from"></label><label>עד תאריך <input type="date" id="to"></label><span id="quick"></span></div></header><main id="m"></main><div id="lb"></div>
<script type="application/json" id="data">${inlineJson(sorted)}</script>
<script type="application/json" id="cfg">${inlineJson({ tools: TOOLS, reviews: REVIEWS, states: REVIEW_STATES, builtAt: opts.builtAt })}</script>
<script>${SCRIPT}</script></body></html>
`;
}
