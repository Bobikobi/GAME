/**
 * The image library: one static page of every draft in `tools/kit-gen/drafts.jsonl`, sections by tool, a filter by
 * creation date, thumbnails fetched once from the private drafts store (see `library-cli.ts`, `tools/art-library/`).
 *
 * This file is the pure part: the rows (amendments already folded in by `DraftIndex`), the date a draft was made, and
 * the page. Nothing here reads the network or the disk.
 */
import type { Draft } from './drafts.js';

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

/** JSON that is safe inside a `<script>` element. */
function inlineJson(value: unknown): string {
  return [0x2028, 0x2029].reduce((text, code) => text.split(String.fromCharCode(code)).join(`\\u${code.toString(16)}`), JSON.stringify(value).replace(/</g, '\\u003c'));
}

export function renderLibrary(rows: readonly Row[], opts: PageOptions): string {
  const sorted = sortRows(rows);
  return `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>כל התמונות שיצרנו, לפי כלי</title>
<style>${CSS}</style></head><body><header><h1>כל התמונות שיצרנו, לפי כלי <span id="n" class="d"></span></h1>
<div class="d" id="upd" data-total="${sorted.length}" data-built="${opts.builtAt}"></div>
<div class="row" id="tools"></div>
<div class="row"><input id="q" placeholder="חיפוש לפי שם, למשל tree"><span id="rv"></span></div>
<div class="row" id="dates"><label>מתאריך <input type="date" id="from"></label><label>עד תאריך <input type="date" id="to"></label><span id="quick"></span></div></header><main id="m"></main><div id="lb"></div>
<script type="application/json" id="data">${inlineJson(sorted)}</script>
<script type="application/json" id="cfg">${inlineJson({ tools: TOOLS, reviews: REVIEWS, builtAt: opts.builtAt })}</script>
<script>${SCRIPT}</script></body></html>
`;
}

const CSS = `:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;background:#15171a;color:#e8e6e1;font:15px/1.45 system-ui,sans-serif}
header{position:sticky;top:0;z-index:5;background:#15171af2;padding:12px 16px;border-bottom:1px solid #30343a}h1{font-size:19px;margin:0 0 4px}
.row{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:6px}button{font:inherit;color:inherit;background:#262a30;border:1px solid #3b4047;border-radius:6px;padding:5px 10px;cursor:pointer}button.on{background:#e0b34e;color:#191712;border-color:#e0b34e;font-weight:600}
input{font:inherit;color:inherit;background:#22252a;border:1px solid #3b4047;border-radius:6px;padding:5px 10px;min-width:220px}input[type=date]{min-width:0}label{font-size:13px;color:#a5a39d;display:flex;gap:6px;align-items:center}main{padding:8px 16px 60px}h2{font-size:17px;margin:24px 0 2px}.d{color:#a5a39d;margin:0 0 10px;font-size:13px}
.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}.c{background:#1f2226;border:1px solid #2d3136;border-radius:6px;padding:6px;cursor:pointer;min-width:0}.c:hover{border-color:#e0b34e}.c img,.c .ph{display:block;width:100%;aspect-ratio:1;object-fit:contain;background:#30343a}.c .ph{display:flex;align-items:center;justify-content:center;color:#a5a39d;font-size:13px;direction:ltr}.c div.t{font-size:12px;margin-top:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;direction:ltr;text-align:left}.keep{outline:2px solid #6fbf73}.more{margin:12px 0}
#lb{position:fixed;inset:0;background:#000d;display:none;z-index:9;padding:16px;overflow:auto}#lb.on{display:flex;gap:16px;flex-wrap:wrap;justify-content:center;align-items:flex-start}#lb img,#lb .ph{width:min(92vw,600px);aspect-ratio:1;object-fit:contain;image-rendering:pixelated;background:#30343a;display:flex;align-items:center;justify-content:center}#lb .i{max-width:380px;direction:ltr;text-align:left;font-size:13px;white-space:pre-wrap;word-break:break-word}`;

const SCRIPT = `
const TOOLS=JSON.parse(document.getElementById('cfg').textContent),DATA=JSON.parse(document.getElementById('data').textContent);
const RV=TOOLS.reviews,BUILT=TOOLS.builtAt;const TL=TOOLS.tools;
let tool='all',rv='all',q='',from='',to='',nodate=false,shown={};const PAGE=120;
const $=s=>document.querySelector(s);const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const pad=n=>String(n).padStart(2,'0');const ymd=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const today=new Date();const ago=n=>{const d=new Date(today);d.setDate(d.getDate()-n);return ymd(d)};
const months={};DATA.forEach(x=>{if(x.d){const k=x.d.slice(0,7);months[k]=(months[k]||0)+1}});const undated=DATA.filter(x=>!x.d).length;
const inDate=x=>nodate?!x.d:((!from&&!to)||(x.d&&(!from||x.d>=from)&&(!to||x.d<=to)));
const match=x=>(rv==='all'||x.r===rv)&&(!q||(x.n+' '+x.g).toLowerCase().includes(q))&&inDate(x);
function quick(){const cnt=(a,b)=>DATA.filter(x=>x.d&&x.d>=a&&x.d<=b).length;const t=ymd(today);
 const on=(a,b)=>!nodate&&from===a&&to===b;
 let h='<button data-q="all" class="'+(!nodate&&!from&&!to?'on':'')+'">כל התאריכים</button> <button data-q="'+t+'|'+t+'" class="'+(on(t,t)?'on':'')+'">היום ('+cnt(t,t)+')</button> <button data-q="'+ago(6)+'|'+t+'" class="'+(on(ago(6),t)?'on':'')+'">7 ימים ('+cnt(ago(6),t)+')</button> <button data-q="'+ago(29)+'|'+t+'" class="'+(on(ago(29),t)?'on':'')+'">30 יום ('+cnt(ago(29),t)+')</button> ';
 for(const k of Object.keys(months).sort().reverse()){const a=k+'-01',b=k+'-31';h+='<button data-q="'+a+'|'+b+'" class="'+(on(a,b)?'on':'')+'">'+k+' ('+months[k]+')</button> '}
 h+='<button data-q="none" class="'+(nodate?'on':'')+'">ללא תאריך ('+undated+')</button>';$('#quick').innerHTML=h}
function chips(){const c={};DATA.filter(match).forEach(x=>c[x.t]=(c[x.t]||0)+1);const tot=Object.values(c).reduce((a,b)=>a+b,0);
 $('#tools').innerHTML='<button data-t="all" class="'+(tool==='all'?'on':'')+'">הכול ('+tot+')</button>'+TL.map(t=>'<button data-t="'+t.key+'" class="'+(tool===t.key?'on':'')+'">'+t.label+' ('+(c[t.key]||0)+')</button>').join('');
 $('#rv').innerHTML=RV.map(([k,l])=>'<button data-r="'+k+'" class="'+(rv===k?'on':'')+'">'+l+'</button>').join(' ');quick();
 $('#upd').textContent='עודכן ב'+new Date(BUILT).toLocaleString('he-IL')+' - '+DATA.length+' תמונות';}
function cell(x){const im=x.th?'<img loading="lazy" src="thumb/'+x.id+'.webp" alt="">':'<div class="ph">'+esc(x.x)+'</div>';
 return '<div class="c '+(x.r==='keep'?'keep':'')+'" data-i="'+x.id+'" title="'+esc(x.d)+'">'+im+'<div class="t">'+esc(x.n)+'</div></div>'}
function draw(){chips();let h='';for(const t of TL){if(tool!=='all'&&tool!==t.key)continue;const a=DATA.filter(x=>x.t===t.key&&match(x));if(!a.length)continue;const n=shown[t.key]||(tool==='all'?24:PAGE);
 h+='<h2>'+t.label+' ('+a.length+')</h2><p class="d">'+t.note+'</p><div class="g">'+a.slice(0,n).map(cell).join('')+'</div>';
 if(a.length>n)h+='<button class="more" data-m="'+t.key+'" data-n="'+n+'">עוד (נשארו '+(a.length-n)+')</button>';}
 $('#m').innerHTML=h||'<p>אין תוצאות</p>';}
function setRange(a,b){from=a;to=b;nodate=false;$('#from').value=a;$('#to').value=b}
document.addEventListener('click',e=>{const t=e.target.closest('button,.c');if(e.target.closest('#lb')){$('#lb').className='';return}if(!t)return;
 if(t.dataset.t){tool=t.dataset.t;draw()}else if(t.dataset.r){rv=t.dataset.r;draw()}else if(t.dataset.m){shown[t.dataset.m]=+t.dataset.n+PAGE*2;draw()}
 else if(t.dataset.q){const v=t.dataset.q;if(v==='none'){setRange('','');nodate=true}else if(v==='all'){setRange('','')}else{const [a,b]=v.split('|');setRange(a,b)}draw()}
 else if(t.dataset.i){const x=DATA.find(y=>y.id===t.dataset.i);const im=x.th?'<img src="thumb/'+x.id+'.webp" alt="">':'<div class="ph">'+esc(x.x)+'</div>';
  const rvl=(RV.find(r=>r[0]===x.r)||[0,x.r])[1];
  $('#lb').innerHTML=im+'<div class="i">'+esc(x.n)+'\\nreview: '+esc(x.r)+' ('+esc(rvl)+')'+(x.note?'\\nnote: '+esc(x.note):'')+(x.by?'\\nreviewed by: '+esc(x.by):'')+'\\ngroup: '+esc(x.g)+'\\ndate: '+esc(x.d||'none')+(x.ds?' ('+esc(x.ds)+')':'')+'\\nmodel: '+esc(x.m)+'\\nseed: '+esc(x.seed)+'\\ncanvas: '+esc(x.c)+'\\nstore: '+esc(x.tag)+'\\nid: '+esc(x.id)+'\\n\\n'+esc(x.p)+'</div>';$('#lb').className='on'}});
$('#q').addEventListener('input',e=>{q=e.target.value.trim().toLowerCase();draw()});
$('#from').addEventListener('change',e=>{from=e.target.value;nodate=false;draw()});$('#to').addEventListener('change',e=>{to=e.target.value;nodate=false;draw()});
document.addEventListener('keydown',e=>{if(e.key==='Escape')$('#lb').className=''});draw();
`;
