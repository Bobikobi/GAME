/**
 * Measures the tint comparison's pictures (docs/design/LIGHTING.md section 5, question 1).
 *
 *   npx tsx tools/src/light/tint-cli.ts <manifest.json> <out.json>
 *
 * The manifest lists our renders (`ours`: id, file, hour, pct) and the references (`refs`: id, file, hours, and the
 * `sky` and `ground` boxes as shares of the picture). Our frames are top-down, so the whole frame is ground and they
 * have no sky. For each hour, the strength whose ground midtones sit closest to the references' median ground is
 * the recommendation. Writes every number to out.json and prints a table.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import jpeg from 'jpeg-js';
import { PNG } from 'pngjs';

import { type Box, type Midtones, closest, distance, medianOf, midtones } from './tint';

interface Ours { id: string; file: string; hour: string; pct: number }
interface Ref { id: string; file: string; hours: string[]; sky: Box[]; ground: Box[] }

function read(file: string): { data: Uint8Array; width: number; height: number } {
  const buf = readFileSync(file);
  if (/\.jpe?g$/i.test(file)) {
    const j = jpeg.decode(buf, { useTArray: true, maxMemoryUsageInMB: 1024 });
    return { data: j.data, width: j.width, height: j.height };
  }
  const p = PNG.sync.read(buf);
  return { data: p.data, width: p.width, height: p.height };
}

const [manifestPath, outPath] = process.argv.slice(2);
if (!manifestPath || !outPath) throw new Error('usage: tint-cli <manifest.json> <out.json>');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as { ours: Ours[]; refs: Ref[] };
const at = (f: string) => resolve(dirname(manifestPath), f);
const fmt = (m: Midtones) => `a* ${m.a.toFixed(1).padStart(5)}  b* ${m.b.toFixed(1).padStart(5)}  C ${m.chroma.toFixed(1).padStart(5)}`;

const refs = manifest.refs.map((r) => {
  const img = read(at(r.file));
  return { ...r, sky: midtones(img.data, img.width, img.height, r.sky), ground: midtones(img.data, img.width, img.height, r.ground) };
});
const ours = manifest.ours.map((o) => {
  const img = read(at(o.file));
  return { ...o, m: midtones(img.data, img.width, img.height, [[0, 0, 1, 1]]) };
});

const hours = [...new Set(ours.map((o) => o.hour))];
const result = hours.map((hour) => {
  const these = refs.filter((r) => r.hours.includes(hour));
  const target = medianOf(these.map((r) => r.ground));
  const sky = medianOf(these.map((r) => r.sky));
  const row = ours.filter((o) => o.hour === hour).map((o) => ({ ...o, d: distance(o.m, target) }));
  const pick = closest(row, target);
  return { hour, refs: these.map((r) => r.id), target, sky, ours: row, pick: pick?.pct };
});

for (const r of refs) console.log(`ref ${r.id.padEnd(16)} ground ${fmt(r.ground)}   sky ${fmt(r.sky)}`);
for (const h of result) {
  console.log(`\n${h.hour}: the references' median ground ${fmt(h.target)}  (sky ${fmt(h.sky)})`);
  for (const o of h.ours) console.log(`  ${String(o.pct).padStart(2)}%  ${fmt(o.m)}  distance ${o.d.toFixed(1)}${o.pct === h.pick ? '  <- closest' : ''}`);
}
writeFileSync(outPath, JSON.stringify({ refs, result }, null, 1) + '\n');
