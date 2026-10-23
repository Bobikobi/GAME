/**
 * `pnpm sheet`: a contact sheet of the core map for the richness check (tools/src/richness.ts). It draws the
 * whole map once from the kit and cuts it into the same phone-sized windows the check judges, thin ones
 * outlined in red. Output goes to .scratch/richness/ (git ignores it): open index.html.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import type { Bundle } from '@game/kernel';
import { runCheck } from './check';
import { REPO_ROOT } from './load';
import { readRichnessParams, richnessWindows, type RichWindow } from './richness';
import { walkBitmap } from './reach';

interface Img {
  width: number;
  height: number;
  data: Buffer;
}

function over(dst: Img, src: Img, sx: number, sw: number, dx: number, dy: number): void {
  for (let y = 0; y < src.height; y++) {
    const ty = y + dy;
    if (ty < 0 || ty >= dst.height) continue;
    for (let x = 0; x < sw; x++) {
      const tx = x + dx;
      if (tx < 0 || tx >= dst.width) continue;
      const s = (y * src.width + sx + x) * 4;
      const d = (ty * dst.width + tx) * 4;
      const sa = src.data[s + 3]!;
      if (sa === 0) continue;
      const da = (dst.data[d + 3]! * (255 - sa)) / 255;
      const oa = sa + da;
      for (let c = 0; c < 3; c++) dst.data[d + c] = Math.round((src.data[s + c]! * sa + dst.data[d + c]! * da) / oa);
      dst.data[d + 3] = Math.round(oa);
    }
  }
}

function drawMap(b: Bundle, files: Record<string, string>): { png: Buffer; t: number } {
  const cache = new Map<string, Img | undefined>();
  const load = (ref: string): Img | undefined => {
    if (!cache.has(ref)) {
      const f = files[ref];
      cache.set(ref, f ? (({ width, height, data }) => ({ width, height, data }))(PNG.sync.read(readFileSync(f))) : undefined);
    }
    return cache.get(ref);
  };
  /** the first frame, bottom-centred on a footprint */
  const stand = (dst: Img, ref: string, x: number, y: number, w: number, h: number, t: number) => {
    const im = load(ref);
    const info = b.sprites[ref];
    if (!im || !info) return;
    over(dst, im, 0, info.w, Math.round((x + w / 2) * t - info.w / 2), (y + h) * t - im.height);
  };
  const { width, height } = b.map;
  const first = Object.values(b.map.legend)[0]!.sprite;
  const t = b.sprites[first]?.w ?? 16;
  const out: Img = { width: width * t, height: height * t, data: Buffer.alloc(width * t * height * t * 4) };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const tile = b.map.legend[b.map.ground[y]?.[x] ?? ''];
      const im = tile && load(tile.sprite);
      if (tile && im) over(out, im, 0, b.sprites[tile.sprite]?.w ?? t, x * t, y * t);
    }
  }
  const things: { bottom: number; draw: () => void }[] = [];
  for (const p of b.map.props) things.push({ bottom: p.y + p.h, draw: () => stand(out, p.sprite, p.x, p.y, p.w, p.h, t) });
  for (const i of Object.values(b.instances)) {
    const sprite = i.kind === 'resource' ? b.resources[i.source]?.sprite : undefined;
    if (sprite) things.push({ bottom: i.y + 1, draw: () => stand(out, sprite, i.x, i.y, 1, 1, t) });
  }
  for (const n of Object.values(b.npcs)) {
    const s = b.map.slots.find((q) => q.id === n.place.slot);
    if (s) things.push({ bottom: s.y + s.h, draw: () => stand(out, n.sprite, s.x, s.y, s.w, s.h, t) });
  }
  things.sort((a, c) => a.bottom - c.bottom).forEach((th) => th.draw());
  const png = new PNG({ width: out.width, height: out.height });
  out.data.copy(png.data);
  return { png: PNG.sync.write(png), t };
}

const result = runCheck();
const b = result.assembled.bundle;
if (!b) {
  console.error('The content does not assemble; run "pnpm check" first.');
  process.exit(1);
}
const files: Record<string, string> = {};
for (const [ref, info] of Object.entries(b.sprites)) {
  const kitId = ref.slice(0, ref.indexOf(':'));
  const kit = result.assembled.kits[kitId];
  if (kit) files[ref] = join(kit.dir, info.url.slice(`kit/${kitId}/`.length));
}
const params = readRichnessParams();
const windows = richnessWindows(b, params);
const { png, t } = drawMap(b, files);

// coverage: every walkable tile must sit inside some window of the sheet
const open = walkBitmap(b);
let walkable = 0;
let covered = 0;
for (let y = 0; y < b.map.height; y++) {
  for (let x = 0; x < b.map.width; x++) {
    if (!open[y * b.map.width + x]) continue;
    walkable++;
    if (windows.some((w) => x >= w.x && x < w.x + w.w && y >= w.y && y < w.y + w.h)) covered++;
  }
}

const thin = (w: RichWindow) => w.judged && !(w.passA && w.passB && w.passC);
const cardW = 300;
const scale = cardW / (windows[0]!.w * t);
const cards = windows
  .map((w) => {
    const lacks = [!w.passA && 'act', !w.passB && 'move', !w.passC && 'react'].filter(Boolean).join(', ');
    const label = `(${w.x},${w.y}) ${w.walkable} walkable<br>act ${w.acts.length}: ${w.acts.join(', ') || '-'}<br>move ${w.moves.length}: ${w.moves.join(', ') || '-'}<br>react ${w.reacts.length}: ${w.reacts.join(', ') || '-'}`;
    return `<figure class="${!w.judged ? 'skip' : thin(w) ? 'thin' : 'ok'}"><div class="crop" style="width:${cardW}px;height:${Math.round(w.h * t * scale)}px;background-position:-${Math.round(w.x * t * scale)}px -${Math.round(w.y * t * scale)}px;background-size:${Math.round(b.map.width * t * scale)}px"></div><figcaption>${thin(w) ? `<b>thin: ${lacks}</b><br>` : w.judged ? '' : 'not judged (little walkable ground)<br>'}${label}</figcaption></figure>`;
  })
  .join('\n');
const outlines = windows
  .filter(thin)
  .map((w) => `<rect x="${w.x * t}" y="${w.y * t}" width="${w.w * t}" height="${w.h * t}"/>`)
  .join('');
const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Richness sheet</title>
<style>body{font:13px system-ui;background:#161616;color:#ddd;margin:16px}h1{font-size:18px}.grid{display:flex;flex-wrap:wrap;gap:10px}figure{margin:0;width:300px;border:2px solid #444;background:#222}figure.thin{border-color:#e33}figure.skip{opacity:.5}.crop{background-image:url(map.png);image-rendering:pixelated}figcaption{padding:4px 6px;font-size:11px;line-height:1.4}.map{position:relative;max-width:100%;margin:12px 0}.map img,.map svg{display:block;width:100%;image-rendering:pixelated}.map svg{position:absolute;inset:0}.map rect{fill:none;stroke:#e33;stroke-width:${Math.max(1, t / 8)}}</style>
<h1>Richness sheet: ${windows.length} phone windows (${params.window_w}x${params.window_h}), ${windows.filter(thin).length} thin (red). Walkable ground covered: ${covered}/${walkable}</h1>
<div class="map"><img src="map.png"><svg viewBox="0 0 ${b.map.width * t} ${b.map.height * t}">${outlines}</svg></div>
<div class="grid">${cards}</div>`;

const dir = join(REPO_ROOT, '.scratch', 'richness');
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, 'map.png'), png);
writeFileSync(join(dir, 'index.html'), html);
console.log(`sheet: ${windows.length} windows, ${windows.filter(thin).length} thin; walkable ground covered ${covered}/${walkable} (${Math.round((covered * 100) / walkable)}%)\n${join(dir, 'index.html')}`);
