import { readFileSync } from 'node:fs';
import { familyFile, type ArtFamily, type FamilyReport } from './family';

const escape = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** A portable report containing the existing PNGs, never generated replacement art. */
export function familyHtml(family: ArtFamily, report: FamilyReport, root: string): string {
  const cards = family.assets.map(a => {
    const measured = report.assets.find(entry => entry.id === a.id);
    let image = '<p>Image unavailable; see errors below.</p>';
    try {
      const bytes = readFileSync(familyFile(root, a.file));
      image = `<img alt="${escape(a.id)}" src="data:image/png;base64,${bytes.toString('base64')}" style="width:${Math.round(320 * a.frame[0] / a.frame[1])}px;height:320px">`;
    } catch { /* Broken assets must still have a readable report. */ }
    return `<article><h2>${escape(a.id)} ${a.id === family.anchor ? '(anchor)' : ''}</h2><p class="${a.review.status}">${escape(a.review.status)} · ${family.sceneAssets.includes(a.id) ? 'in scene' : 'comparison only'}</p><div class="sprite">${image}</div><p>${escape(a.review.reason)}</p><dl>${measured ? Object.entries(measured.metrics).map(([key, value]) => `<dt>${escape(key)}</dt><dd>${Number.isInteger(value) ? value : value.toFixed(3)}</dd>`).join('') : ''}</dl><details><summary>Source and reviewed revision</summary><p>${escape(a.file)}</p><p>${escape(a.sha256)}</p><p>${escape(a.provenance)}</p><p>${escape(a.review.evidence)}</p></details></article>`;
  }).join('');
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>LoomVale · ${escape(family.id)} review</title><style>
body{margin:auto;max-width:1080px;padding:20px;background:#18201e;color:#ecede2;font:16px/1.5 system-ui}h1{font-size:26px}h2{font-size:20px}a{color:#b6dfc3}.cards{display:flex;flex-wrap:wrap;gap:20px}article{box-sizing:border-box;flex:1 1 330px;min-width:0;padding:16px;background:#29312c;border:1px solid #687368;border-radius:8px}.sprite{height:340px;display:flex;align-items:end;justify-content:center;background:repeating-conic-gradient(#343e35 0% 25%,#3b453c 0% 50%) 0/32px 32px;overflow:auto}img{image-rendering:pixelated;max-width:none}dl{display:grid;grid-template-columns:1fr 1fr}dd{margin:0}.approved{color:#b6dfc3}.rework,.warning{color:#ffcf88}.error{color:#ffb0a4}details{overflow-wrap:anywhere}li{margin-bottom:10px}@media(max-width:450px){body{padding:12px}article{padding:10px}}
</style><h1>${escape(family.id)} · measured comparison</h1><p>${escape(family.scope)}</p><p>Same displayed height (320 px), authored aspect ratio. Comparison images are not scene approval. Numbers flag differences; they cannot judge drawing style.</p><p><a href="/world-study.html">Open the world study</a> · <a href="./report.json">Machine-readable report</a></p><div class="cards">${cards}</div><h2>Findings</h2><ul>${report.findings.map(f => `<li class="${f.level}"><strong>${escape(f.asset)} · ${escape(f.code)}</strong>: ${escape(f.message)}</li>`).join('') || '<li>No technical findings. Visual review remains separate.</li>'}</ul><h2>Shared reference</h2><ul>${Object.entries(family.style).map(([key, value]) => `<li><strong>${escape(key)}</strong>: ${escape(value)}</li>`).join('')}</ul><p>Review the live scene for repeated directions, contact shadows, canopy overlap, and walking against roots. This sheet does not prove runtime behavior.</p></html>`;
}
