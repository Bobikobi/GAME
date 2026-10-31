/**
 * The owner's pick page (docs/art/PRODUCTION_LINE.md section 4).
 *
 * `pnpm art:gallery <pool[,pool]> [--since YYYY-MM-DD] [--names a,b] [--serve [--port N]] [--out file.html]`
 *
 * One page, every draft of the chosen entries across all rounds, each card with the picture at phone scale (pixels kept
 * square), its recipe, seed, round, GPU seconds and warnings, and three buttons: Like (the pick; one an entry), Again (with a
 * note for the next prompt) and Wrong object (the note says what it looks like). One Send writes a `picks-<date>.json`
 * that `pnpm art:pick --from` applies. With `--serve` the page sends it to a tiny local server that writes
 * `.scratch/art-pick/picks-<date>.json`; without it the browser downloads the file. The pictures are inside the page.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { join } from 'node:path';

import { CACHE_DIR, type Draft, DraftIndex } from './drafts.js';
import { ROOT } from './queue.js';
import { POOLS, type PoolName, readPool } from './status.js';
import { readPickers } from './pick.js';

export interface GalleryOptions {
  pools: PoolName[];
  since?: string;
  names?: string[];
  root?: string;
  cacheDir?: string;
  indexPath?: string;
  pickedBy?: string;
}

export interface Card {
  draft: Draft;
  png: string;
}

const esc = (s: string): string => s.replace(/&/gu, '&amp;').replace(/</gu, '&lt;').replace(/>/gu, '&gt;').replace(/"/gu, '&quot;');

/** The drafts the page shows, grouped by entry in pool order. */
export function galleryCards(opts: GalleryOptions): { pool: PoolName; name: string; width: number; height: number; what: string; cards: Card[] }[] {
  const root = opts.root ?? ROOT;
  const cache = opts.cacheDir ?? CACHE_DIR;
  const index = DraftIndex.open(opts.indexPath ?? join(root, 'tools/kit-gen/drafts.jsonl'));
  const all = [...index.drafts.values()];
  const groups: ReturnType<typeof galleryCards> = [];
  for (const pool of opts.pools) {
    for (const entry of readPool(pool, root)) {
      if (opts.names !== undefined && !opts.names.includes(entry.name)) continue;
      const cards: Card[] = [];
      for (const draft of all) {
        if (draft.name !== entry.name || (draft.pool !== null && draft.pool !== pool)) continue;
        if (opts.since !== undefined && (draft.at ?? '') < opts.since) continue;
        const file = join(cache, `${draft.id}.imported.png`);
        if (!existsSync(file)) continue;
        cards.push({ draft, png: `data:image/png;base64,${readFileSync(file).toString('base64')}` });
      }
      cards.sort((a, b) => (a.draft.round ?? 0) - (b.draft.round ?? 0) || (a.draft.at ?? '').localeCompare(b.draft.at ?? ''));
      if (cards.length > 0) groups.push({ pool, name: entry.name, width: entry.width, height: entry.height, what: entry.what ?? '', cards });
    }
  }
  return groups;
}

export function galleryHtml(opts: GalleryOptions, title = 'Pick the art'): string {
  const groups = galleryCards(opts);
  const total = groups.reduce((n, g) => n + g.cards.length, 0);
  const by = opts.pickedBy ?? readPickers(opts.root ?? ROOT)[0] ?? '';
  const body = groups.map((g) => {
    const cards = g.cards.map(({ draft: d, png }) => {
      const gpu = d.run?.gpu_seconds ?? null;
      const warn = [...d.warnings, ...d.errors].map((w) => `<li>${esc(w)}</li>`).join('');
      const scale = Math.max(1, Math.min(4, Math.floor(300 / Math.max(g.width, 1))));
      return `<div class="card" data-draft="${d.id}" data-entry="${esc(g.name)}">
  <img src="${png}" width="${g.width * scale}" height="${g.height * scale}" alt="${esc(g.name)}">
  <div class="meta">${esc(d.recipe ?? d.route ?? '?')} seed ${d.seed ?? '?'} round ${d.round ?? '?'}${gpu === null ? '' : `, run ${Math.round(gpu / 60)} min`}</div>
  ${warn === '' ? '' : `<ul class="warn">${warn}</ul>`}
  <div class="buttons"><button data-a="pick">Like</button><button data-a="again">Again</button><button data-a="wrong">Wrong object</button></div>
  <input class="note" placeholder="note (again: what to change; wrong: what it looks like)">
</div>`;
    }).join('\n');
    return `<section><h2>${esc(g.pool)} / ${esc(g.name)} <small>${g.width}x${g.height}</small></h2><p>${esc(g.what)}</p><div class="row">${cards}</div></section>`;
  }).join('\n');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>
<style>
body{font:15px system-ui,sans-serif;background:#15121c;color:#e8e4d8;margin:0;padding:12px;max-width:520px}
h1{font-size:20px}h2{font-size:17px;margin:22px 0 2px}small{color:#9a96a8}p{margin:0 0 8px;color:#b8b4c4}
.row{display:flex;flex-direction:column;gap:12px}.card{background:#211c2c;border-radius:10px;padding:10px;border:2px solid #211c2c}
.card img{image-rendering:pixelated;background:repeating-conic-gradient(#2c2638 0 25%,#241f30 0 50%) 0 0/16px 16px;max-width:100%;height:auto;display:block}
.meta{color:#9a96a8;font-size:13px;margin:6px 0}.warn{color:#d9a35a;font-size:12px;margin:4px 0;padding-left:18px}
.buttons{display:flex;gap:8px;margin:6px 0}button{flex:1;padding:12px 4px;border-radius:8px;border:0;background:#3a3350;color:#e8e4d8;font-size:15px}
.card[data-a=pick]{border-color:#e0b84a}.card[data-a=again]{border-color:#5a8fd1}.card[data-a=wrong]{border-color:#c24a4a}
.card[data-a=pick] [data-a=pick]{background:#e0b84a;color:#222}.card[data-a=again] [data-a=again]{background:#5a8fd1}.card[data-a=wrong] [data-a=wrong]{background:#c24a4a}
.note{width:100%;box-sizing:border-box;padding:8px;border-radius:6px;border:1px solid #3a3350;background:#15121c;color:#e8e4d8}
#send{position:sticky;bottom:8px;width:100%;padding:16px;font-size:17px;background:#e0b84a;color:#222;font-weight:600;margin-top:20px}
#status{text-align:center;color:#9a96a8;margin:8px 0}
</style></head><body><h1>${esc(title)}</h1>
<p>${total} drafts. Like one draft an entry (the one that goes into the game), Again to draw it once more with a note, Wrong object if it is the wrong thing. Skip what you have no view on.</p>
${body}
<div id="status"></div><button id="send">Send</button>
<script>
const PICKED_BY=${JSON.stringify(by)};
document.querySelectorAll('.card').forEach(card=>{
  card.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{
    const a=b.dataset.a;
    if(card.dataset.a===a){delete card.dataset.a;return;}
    if(a==='pick')document.querySelectorAll('.card[data-entry="'+card.dataset.entry+'"]').forEach(c=>{if(c.dataset.a==='pick')delete c.dataset.a;});
    card.dataset.a=a;
  }));
});
document.getElementById('send').addEventListener('click',async()=>{
  const picks=[];let bad=null;
  document.querySelectorAll('.card[data-a]').forEach(c=>{
    const note=c.querySelector('.note').value.trim();
    if(c.dataset.a==='wrong'&&!note)bad=c.dataset.entry;
    picks.push({draft:c.dataset.draft,action:c.dataset.a,...(note?{note}:{})});
  });
  const st=document.getElementById('status');
  if(bad){st.textContent='Wrong object needs a note: what does '+bad+' look like?';return;}
  const data={picked_by:PICKED_BY,at:new Date().toISOString(),picks};
  const day=data.at.slice(0,10);
  try{const r=await fetch('/send',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data)});
    if(!r.ok)throw new Error(r.status);st.textContent='Sent: '+picks.length+' answers.';return;}catch(e){}
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
  a.download='picks-'+day+'.json';a.click();st.textContent='Saved picks-'+day+'.json ('+picks.length+' answers).';
});
</script></body></html>
`;
}

/** Serve the page and take its Send; returns the server so the caller can close it. */
export function servePage(html: string, outDir: string, port: number): ReturnType<typeof createServer> {
  const server = createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/send') {
      const chunks: Buffer[] = [];
      req.on('data', (c: Buffer) => chunks.push(c));
      req.on('end', () => {
        try {
          const text = Buffer.concat(chunks).toString('utf8');
          JSON.parse(text);
          mkdirSync(outDir, { recursive: true });
          const path = join(outDir, `picks-${new Date().toISOString().slice(0, 10)}.json`);
          writeFileSync(path, `${JSON.stringify(JSON.parse(text), null, 2)}\n`);
          process.stdout.write(`picks written: ${path}\n`);
          res.writeHead(200).end('ok');
        } catch {
          res.writeHead(400).end('bad');
        }
      });
      return;
    }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(html);
  });
  server.listen(port, '127.0.0.1');
  return server;
}

export function galleryCli(args: readonly string[]): { html: string; serve: boolean; port: number; out: string | null; count: number } {
  const usage = 'Usage: art:gallery <pool[,pool]> [--since YYYY-MM-DD] [--names a,b] [--serve [--port N]] [--out file.html]';
  const value = (name: string): string | undefined => {
    const i = args.indexOf(name);
    return i < 0 ? undefined : args[i + 1];
  };
  const skip = new Set(['--since', '--names', '--port', '--out']);
  const positional = args.filter((a, i) => !a.startsWith('--') && !skip.has(args[i - 1] ?? ''));
  const [poolArg, ...extra] = positional;
  if (poolArg === undefined || extra.length > 0) throw new Error(usage);
  const pools = poolArg.split(',') as PoolName[];
  for (const p of pools) if (!(POOLS as readonly string[]).includes(p) || p === 'cast') throw new Error(`${usage}\n(not a drawn pool: ${p})`);
  const since = value('--since');
  const names = value('--names')?.split(',');
  const opts: GalleryOptions = { pools, ...(since === undefined ? {} : { since }), ...(names === undefined ? {} : { names }) };
  const html = galleryHtml(opts);
  return { html, serve: args.includes('--serve'), port: Number(value('--port') ?? 8791), out: value('--out') ?? null, count: galleryCards(opts).reduce((n, g) => n + g.cards.length, 0) };
}
