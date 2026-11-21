/**
 * pnpm anim: library motion to pixels (tools/anim/README.md).
 *
 *   pnpm anim list                              the clips, their sources and whether the libraries are fetched
 *   pnpm anim fetch [--lib <id>] [--from <zip>] download each library by URL, check its sha256, unpack the glb
 *   pnpm anim render <clip ...> | --all         Blender, then snap, strips and the four measures; exit 1 on a failure
 *   pnpm anim check [<clip ...>]                the four measures of clips already rendered; exit 1 on a failure
 *   pnpm anim sheets                            the rendered walks of the targets that ship into content/kit/core/chars (+ kit.json, feet.json)
 *   ... --target <id>                           render or check the clips on another target of anim.json (the cast):
 *                                               written under tools/.cache/anim/cast/<id>/<clip>/
 *
 * Blender comes from BLENDER, else tools/.cache/anim/local.json {"blender": "<path>"}, else `blender` on the PATH.
 * Everything is written under tools/.cache/anim/ (ignored); nothing goes to content/.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { PNG } from 'pngjs';
import { INK_HEX } from '../kit/ink.js';
import { CONTENT_DIR } from '../load.js';
import { ANIM_DIR, CACHE_DIR, type Clip, clipNames, clipPaces, clipProblems, frameOf, job, type Library, type ModelPack, missingModels, modelPath, paces, raceSpec, poseMs, readClip, readLibraries, readModels, readSettings, selfLibrary, type Settings, stepFrames, type View, withNative } from './clip.js';
import { archiveProblems, itchDownload, libraryGlb, MODEL_DIR, modelDir, packProblems, unpack, unpackModel, urlDownload } from './fetch.js';
import { type ClipMeasures, measureClip, type RenderMeta, type ViewMeasures } from './measure.js';
import { buildSheets } from './sheets.js';
import { classPalettes, flipX, type Picture, sheetRamps, snap } from './snap.js';

const say = (line: string) => process.stdout.write(`${line}\n`);

export function blenderPath(env: Record<string, string | undefined>): string {
  if (env.BLENDER) return env.BLENDER;
  const local = join(CACHE_DIR, 'local.json');
  if (existsSync(local)) {
    const b = (JSON.parse(readFileSync(local, 'utf8')) as { blender?: string }).blender;
    if (b) return b;
  }
  return 'blender';
}

const readPng = (path: string): Picture => {
  const png = PNG.sync.read(readFileSync(path));
  return { width: png.width, height: png.height, data: new Uint8Array(png.data) };
};
const writePng = (path: string, p: Picture) => {
  const png = new PNG({ width: p.width, height: p.height });
  png.data = Buffer.from(p.data);
  writeFileSync(path, PNG.sync.write(png));
};

/** The libraries a clip loads into Blender: a native body's own actions (`self:`) are not a file. */
function libsOf(clip: Clip): string[] {
  return [...new Set([clip.base.library, ...(clip.layer ? [clip.layer.library] : [])])].filter((id) => !id.startsWith('self:'));
}

async function fetchLibraries(libs: Record<string, Library>, only: string | undefined, from: string | undefined): Promise<number> {
  let failed = 0;
  for (const [id, lib] of Object.entries(libs)) {
    if (id.startsWith('self:') || (only !== undefined && id !== only)) continue;
    if (libraryGlb(id, lib).ready && from === undefined) {
      say(`${id}: already fetched and checked`);
      continue;
    }
    const cached = join(CACHE_DIR, 'lib', `${id}.zip`);
    let buf: Buffer;
    if (from !== undefined) buf = readFileSync(from);
    else if (existsSync(cached) && archiveProblems(readFileSync(cached), lib).length === 0) buf = readFileSync(cached);
    else {
      say(`${id}: downloading "${lib.upload}" from ${lib.page}`);
      buf = await itchDownload(lib.page, lib.upload);
    }
    const problems = archiveProblems(buf, lib);
    if (problems.length > 0) {
      say(`${id}: REFUSED, not the archive in libraries.json: ${problems.join('; ')}`);
      failed += 1;
      continue;
    }
    mkdirSync(join(CACHE_DIR, 'lib'), { recursive: true });
    writeFileSync(cached, buf);
    say(`${id}: sha256 ${lib.sha256} matches, unpacked ${unpack(id, lib, buf)}`);
  }
  return failed;
}

/** The body packs of the races (libraries.json `models`), downloaded by URL, refused unless the bytes and sha256 match. */
async function fetchModels(models: Record<string, ModelPack>, only: string | undefined): Promise<number> {
  let failed = 0;
  for (const [id, pack] of Object.entries(models)) {
    if (only !== undefined && id !== only) continue;
    if (modelDir(id, pack).ready) {
      say(`${id}: already fetched and checked`);
      continue;
    }
    const cached = join(CACHE_DIR, 'models', `${id}.download`);
    let buf: Buffer;
    if (existsSync(cached) && packProblems(readFileSync(cached), pack).length === 0) buf = readFileSync(cached);
    else {
      say(`${id}: downloading ${pack.upload ?? pack.url} (${pack.page})`);
      buf = pack.upload !== undefined ? await itchDownload(pack.page, pack.upload) : await urlDownload(pack.url ?? '');
    }
    const problems = packProblems(buf, pack);
    if (problems.length > 0) {
      say(`${id}: REFUSED, not the pack in libraries.json: ${problems.join('; ')}`);
      failed += 1;
      continue;
    }
    mkdirSync(MODEL_DIR, { recursive: true });
    writeFileSync(cached, buf);
    say(`${id}: sha256 ${pack.sha256} matches, unpacked ${unpackModel(id, pack, buf)}`);
  }
  return failed;
}

interface Context {
  settings: Settings;
  libs: Record<string, Library>;
  paces: ReturnType<typeof paces>;
}

function context(): Context {
  const settings = readSettings();
  const params = JSON.parse(readFileSync(join(CONTENT_DIR, 'core', 'params.json'), 'utf8')) as unknown;
  return { settings, libs: withNative(readLibraries(), settings), paces: paces(settings, params) };
}

/** Where a clip's output goes: out/<clip>/ on its own target, cast/<target>/<clip>/ when --target moves it. */
export function outDir(name: string, cast?: string): string {
  return cast === undefined ? join(CACHE_DIR, 'out', name) : join(CACHE_DIR, 'cast', cast, name);
}

/**
 * The clip as written, or moved to another target: the motion, props and frame stay; the body, scale and ramps are the
 * target's. A native clip takes the same action of the other body's own (`self:<target>`), so a second body of one
 * animal (the hare's pied body) plays every clip of the first.
 */
export function onTarget(clip: Clip, cast: string | undefined): Clip {
  if (cast === undefined) return clip;
  const base = clip.base.library === selfLibrary(clip.target) ? { ...clip.base, library: selfLibrary(cast) } : clip.base;
  return { ...clip, target: cast, base };
}

function measure(name: string, clip: Clip, ctx: Context, cast?: string): ClipMeasures {
  const out = outDir(name, cast);
  const target = ctx.settings.targets[clip.target];
  if (target === undefined) throw new Error(`${name}: no target ${clip.target}`);
  const ramps = clip.ramps ?? target.ramps;
  const pal = classPalettes(ramps, target.metal, target.leaf);
  const allowed = new Set([...pal.body, ...pal.fire, ...pal.metal, ...pal.leaf, INK_HEX]);
  const frames: Partial<Record<View, Picture[]>> = {};
  const n = poseMs(clip, ctx.libs).length;
  for (const view of clip.views) frames[view] = Array.from({ length: n }, (_, i) => readPng(join(out, 'sprites', `${name}_${view}_${String(i).padStart(2, '0')}.png`)));
  const metaPath = join(out, 'raw', `${name}_meta.json`);
  const meta = existsSync(metaPath) ? (JSON.parse(readFileSync(metaPath, 'utf8')) as RenderMeta) : undefined;
  const limits = { ...ctx.settings.limits, ...(clip.limits ?? {}) };
  const m = measureClip({
    frames,
    allowed,
    limits,
    meta,
    locomotion: clip.locomotion,
    poseStep: stepFrames(clip, ctx.libs),
    ms: poseMs(clip, ctx.libs),
    paces: clipPaces(clip, ctx.settings, ctx.paces),
  });
  writeFileSync(join(out, 'measures.json'), `${JSON.stringify(m, null, 1)}\n`);
  return m;
}

function summary(name: string, m: ClipMeasures): string {
  const parts = [`palette ${m.palette.pct}%`];
  for (const [view, v] of Object.entries(m.views)) {
    let s = `${view}: outline ${v.outlined}/${v.frames}, silhouette ${v.silhouette.maxDevPct}%`;
    if (v.stride && v.paces) s += `, cycle ${v.stride.cyclePx} px, slide ${v.paces.steady.slidePx} px, ${v.paces.steady.lockedPoseRate} poses/s at steady`;
    if (v.footfalls) s += `, footfalls ${v.footfalls.order.join(' ')} (gaps ${v.footfalls.gaps.join(' ')})`;
    parts.push(s);
  }
  return `${m.problems.length === 0 ? 'PASS' : 'FAIL'} ${name}: ${parts.join(' | ')}`;
}

function render(name: string, ctx: Context, cast?: string): ClipMeasures {
  const t0 = Date.now();
  const clip = onTarget(readClip(name), cast);
  const problems = clipProblems(name, clip, ctx.libs, ctx.settings);
  if (problems.length > 0) throw new Error(problems.join('\n'));
  const target = ctx.settings.targets[clip.target];
  if (target === undefined) throw new Error(`${name}: no target`);
  let model: string | undefined;
  if (target.map === 'ual') {
    const absent = missingModels(raceSpec(target.race ?? '', target.body));
    if (absent.length > 0) throw new Error(`${name}: the ${clip.target} body is not fetched (${absent.length} files missing, first ${absent[0]}); run pnpm anim fetch`);
  } else {
    model = target.model === undefined ? undefined : modelPath(target.model, process.env);
    if (model === undefined || !existsSync(model)) throw new Error(`${name}: the ${clip.target} model is missing (${target.model}${target.model?.startsWith('$') ? ' is not set' : ''})`);
  }
  const libs = libsOf(clip).map((id) => {
    const lib = ctx.libs[id];
    const glb = lib ? libraryGlb(id, lib) : undefined;
    if (!glb?.ready) throw new Error(`${name}: library ${id} is not fetched; run pnpm anim fetch`);
    return glb.path;
  });
  const out = outDir(name, cast);
  mkdirSync(join(out, 'raw'), { recursive: true });
  mkdirSync(join(out, 'sprites'), { recursive: true });
  const jobPath = join(out, 'job.json');
  const threads = Number(process.env.ANIM_THREADS) || Math.max(1, cpus().length - 2);
  const basket = target.basket !== undefined ? modelPath(target.basket, process.env) : undefined;
  writeFileSync(jobPath, `${JSON.stringify(job(name, clip, ctx.libs, ctx.settings, { out: join(out, 'raw'), libs, model, basket, threads }), null, 1)}\n`);
  const blender = blenderPath(process.env);
  const run = spawnSync(blender, ['-b', '--factory-startup', '--offline-mode', '-P', join(ANIM_DIR, 'blender', 'render.py'), '--', jobPath], { encoding: 'utf8', maxBuffer: 64 << 20 });
  const refused = /^REFUSED (.*)$/m.exec(run.stdout ?? '');
  if (refused) throw new Error(`${name} on ${clip.target}: ${refused[1]}`);
  if (run.error || !/^DONE /m.test(run.stdout ?? '')) {
    throw new Error(`${name}: Blender (${blender}) did not finish:\n${(run.stdout ?? '').slice(-2000)}\n${(run.stderr ?? '').slice(-1500)}${run.error ? `\n${run.error.message}` : ''}`);
  }
  const blenderS = (Date.now() - t0) / 1000;
  const pal = classPalettes(clip.ramps ?? target.ramps, target.metal, target.leaf);
  const ms = poseMs(clip, ctx.libs);
  const [fw, fh] = frameOf(clip, ctx.settings).size;
  for (const view of clip.views) {
    const strip: Picture = { width: fw * ms.length, height: fh, data: new Uint8Array(fw * ms.length * fh * 4) };
    ms.forEach((_, i) => {
      const base = join(out, 'raw', `${name}_${view}_${String(i).padStart(2, '0')}`);
      let hi = readPng(`${base}.png`);
      let ids = existsSync(`${base}_id.png`) ? readPng(`${base}_id.png`) : undefined;
      if (view === 'left') {
        hi = flipX(hi);
        ids = ids && flipX(ids);
      }
      const sprite = snap(hi, ids, ctx.settings.supersample, pal);
      writePng(join(out, 'sprites', `${name}_${view}_${String(i).padStart(2, '0')}.png`), sprite);
      for (let y = 0; y < fh; y += 1) strip.data.set(sprite.data.subarray(y * fw * 4, (y + 1) * fw * 4), (y * strip.width + i * fw) * 4);
    });
    writePng(join(out, `${name}_${view}.png`), strip);
  }
  const m = measure(name, clip, ctx, cast);
  // what a player of the strip needs: for distance playback, the art px walked per pose in each view
  const travel: Partial<Record<View, number>> = {};
  for (const [view, v] of Object.entries(m.views) as [View, ViewMeasures][]) if (v.stride) travel[view] = v.stride.travelPerPose;
  const playback = clip.locomotion
    ? { playback: clip.locomotion.playback, travel_px_per_pose: travel, how: 'distance: pose = floor(art px walked / travel_px_per_pose) mod poses; time: each pose for its ms' }
    : {};
  writeFileSync(
    join(out, `${name}.json`),
    `${JSON.stringify({ clip: name, frame: frameOf(clip, ctx.settings).size, anchor: frameOf(clip, ctx.settings).anchor, poses: ms.length, ms, views: clip.views, ...playback, right: 'the left strip mirrored', target: clip.target, ramps: sheetRamps(clip.ramps ?? target.ramps, target.metal, target.leaf), credit: target.credit ?? null })}\n`,
  );
  say(`${summary(cast === undefined ? name : `${name} on ${cast}`, m)}  (Blender ${blenderS.toFixed(0)} s, all ${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  return m;
}

export async function main(argv: readonly string[]): Promise<number> {
  const [cmd, ...rest] = argv;
  const flag = (name: string) => {
    const i = rest.indexOf(name);
    return i >= 0 ? rest[i + 1] : undefined;
  };
  const ctx = context();
  const named = rest.filter((a, i) => !a.startsWith('--') && !['--lib', '--from', '--target'].includes(rest[i - 1] ?? ''));
  const cast = flag('--target');
  if (cast !== undefined && ctx.settings.targets[cast] === undefined) {
    say(`--target ${cast}: not one of ${Object.keys(ctx.settings.targets).join(', ')}`);
    return 2;
  }
  const rendered = clipNames().filter((n) => existsSync(join(outDir(n, cast), `${n}.json`)));
  const names = rest.includes('--all') ? clipNames() : cmd === 'check' && named.length === 0 ? rendered : named;
  if (cmd === 'list') {
    for (const [id, lib] of Object.entries(ctx.libs)) if (!id.startsWith('self:')) say(`library ${id}: ${lib.title}, ${lib.licence}; ${libraryGlb(id, lib).ready ? 'fetched' : 'not fetched (pnpm anim fetch)'}`);
    for (const name of clipNames()) {
      const c = readClip(name);
      const bad = clipProblems(name, c, ctx.libs, ctx.settings);
      say(`${name}: ${c.base.library}/${c.base.action}${c.layer ? ` + ${c.layer.library}/${c.layer.action} (${c.layer.mask.join(', ')})` : ''}${c.ik ? ' + IK' : ''}${c.prop ? ` + ${c.prop.kind}` : ''} on ${c.target}${bad.length ? `  INVALID: ${bad.join('; ')}` : ''}`);
    }
    return 0;
  }
  if (cmd === 'fetch') {
    const only = flag('--lib');
    const models = readModels();
    const bad = (only === undefined || only in ctx.libs ? await fetchLibraries(ctx.libs, only, flag('--from')) : 0) + (only === undefined || only in models ? await fetchModels(models, only) : 0);
    return bad > 0 ? 1 : 0;
  }
  if (cmd === 'sheets') {
    const r = buildSheets(ctx.settings);
    for (const [name, w] of Object.entries(r.widths)) say(`${name}: ${w} px wide at its broadest, the median of the walk`);
    for (const p of r.problems) say(`  ${p}`);
    say(r.problems.length === 0 ? `${r.written.length} sheets written to content/kit/core/chars, kit.json and tools/anim/feet.json updated` : 'nothing written');
    return r.problems.length > 0 ? 1 : 0;
  }
  if (cmd === 'render' || cmd === 'check') {
    if (names.length === 0) {
      say('name the clips, or --all');
      return 2;
    }
    let failed = 0;
    for (const name of names) {
      try {
        const m = cmd === 'render' ? render(name, ctx, cast) : measure(name, onTarget(readClip(name), cast), ctx, cast);
        if (cmd === 'check') say(summary(cast === undefined ? name : `${name} on ${cast}`, m));
        for (const p of m.problems) say(`  ${p}`);
        if (m.problems.length > 0) failed += 1;
      } catch (err) {
        say(`FAIL ${name}: ${(err as Error).message}`);
        failed += 1;
      }
    }
    say(`${names.length - failed} of ${names.length} clips pass`);
    return failed > 0 ? 1 : 0;
  }
  say('usage: pnpm anim list | fetch [--lib <id>] [--from <zip>] | render <clip ...>|--all [--target <id>] | check [<clip ...>] [--target <id>] | sheets');
  return 2;
}

const entry = process.argv[1];
if (entry !== undefined && import.meta.url === pathToFileURL(entry).href) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (err: unknown) => {
      process.stderr.write(`${(err as Error).message}\n`);
      process.exit(1);
    },
  );
}
