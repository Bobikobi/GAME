/** Re-render the retained human, without writing to the race pipeline's checkout.
 * pnpm exec tsx tools/src/kit/render-world-study-walk.ts <race-checkout> --measure
 * pnpm exec tsx tools/src/kit/render-world-study-walk.ts <race-checkout>
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PNG } from 'pngjs';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const source = resolve(process.argv[2] ?? '../feat-races-in-game');
const measureOnly = process.argv.includes('--measure');
const action = 'Jog_Fwd_Loop';
const cycleSourceFrames = 22.4;
const folder = join(root, 'docs/design/frames/rich-world-motion-2026-10-29');
const cache = join(root, '.scratch/world-motion-2026-10-29');
const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const renderer = join(source, 'tools/anim/blender/render.py');
const rendererHash = '50bcf8ec89e72675fdcc4d7ffe636d0ea19010720b108f14a9e1d53596bd6162';
if (hash(readFileSync(renderer)) !== rendererHash) throw Error('Inspect the changed upstream renderer before using it');
const { snap, flipX, classPalettes } = await import(pathToFileURL(join(source, 'tools/src/anim/snap.ts')).href);
const { plantedRuns, sharedSlope } = await import(pathToFileURL(join(source, 'tools/src/anim/measure.ts')).href);
const angles = { down: 0, 'down-left': Math.atan(Math.sin(50 * Math.PI / 180)), left: Math.PI / 2, 'up-left': Math.PI - Math.atan(Math.sin(50 * Math.PI / 180)), up: Math.PI };
type View = keyof typeof angles;
type Foot = { px: [number, number]; world: [number, number, number] };
type Feet = Record<'Left' | 'Right', Foot>;
type Pose = Record<View, Feet>;
type Meta = { poses: Pose[]; dense: Pose[]; scale_v: number };
const mirrored = (view: View) => view.includes('left');
const unit: Record<View, [number, number]> = { down: [0, 1], up: [0, -1], left: [-1, 0], 'down-left': [-Math.SQRT1_2, Math.SQRT1_2], 'up-left': [-Math.SQRT1_2, -Math.SQRT1_2] };
const along = (view: View, foot: Foot) => (mirrored(view) ? 128 - foot.px[0] : foot.px[0]) * unit[view][0] + foot.px[1] * unit[view][1];
function cycles(meta: Meta): Record<View, number> {
  return Object.fromEntries((Object.keys(angles) as View[]).map(view => {
    const runs: number[][] = [];
    for (const foot of ['Left', 'Right'] as const) {
      const points = meta.dense.map(pose => pose[view][foot]);
      for (const run of plantedRuns(points.map(p => p.world[2]), .015 * meta.scale_v)) runs.push(run.map((i: number) => along(view, points[i]!)));
    }
    const slope: number | undefined = sharedSlope(runs);
    if (!slope || slope > 0) throw Error(`No backward planted-foot travel in ${view}`);
    return [view, Math.abs(slope) * meta.dense.length];
  })) as Record<View, number>;
}
mkdirSync(folder, { recursive: true });
mkdirSync(cache, { recursive: true });
const measurementFile = join(cache, 'jog-cycle-distance.json');
if (!measureOnly && !existsSync(measurementFile)) throw Error('Run --measure first');
const measured = measureOnly ? undefined : JSON.parse(readFileSync(measurementFile, 'utf8')) as Record<View, number>;
// 30 poses plus standing fit a 3968px strip, within a 4096px texture limit.
const count = measureOnly ? 64 : Math.min(30, Math.floor(30 * Math.min(...Object.values(measured!)) / 125));
if (count < 12) throw Error('The retained walk is too short for a smooth study walk at 125 art px/s');
const base = JSON.parse(readFileSync(join(source, 'tools/.cache/anim/cast/forager/jog_human/job.json'), 'utf8')) as Record<string, unknown>;
const raw = join(cache, measureOnly ? 'measure' : 'raw');
const samples: { base: [string, number] }[] = Array.from({ length: count }, (_, i) => ({ base: [action, cycleSourceFrames * i / count] }));
if (!measureOnly) samples.push({ base: ['Idle_Loop', 0] });
const job = { ...base, name: 'walk', renderer, renderer_sha256: rendererHash, out: raw, view_angles: angles, dirs: Object.keys(angles), samples, threads: 2, render: !measureOnly, dense: { length: cycleSourceFrames, step: cycleSourceFrames / 64 } };
const jobFile = join(cache, measureOnly ? 'measure-job.json' : 'walk-job.json');
writeFileSync(jobFile, JSON.stringify(job, null, 2) + '\n');
const blender = (JSON.parse(readFileSync(join(source, 'tools/.cache/anim/local.json'), 'utf8')) as { blender: string }).blender;
execFileSync(blender, ['-b', '--factory-startup', '--offline-mode', '-P', join(root, 'tools/src/kit/world-study-walk-render.py'), '--', jobFile], { stdio: 'inherit', maxBuffer: 64 << 20 });
const meta = JSON.parse(readFileSync(join(raw, 'walk_meta.json'), 'utf8')) as Meta;
const cycle = cycles(meta);
if (measureOnly) {
  writeFileSync(measurementFile, JSON.stringify(cycle, null, 2) + '\n');
  console.log({ cycleDistanceArtPx: cycle, smoothPosesAtStudySpeed: Math.min(30, Math.floor(30 * Math.min(...Object.values(cycle)) / 125)) });
} else {
  const palette = classPalettes(['wood', 'red', 'skin'], 'grey');
  const sheets: Record<string, unknown> = {};
  for (const view of Object.keys(angles) as View[]) {
    const atlas = new PNG({ width: 128 * samples.length, height: 128 });
    for (let i = 0; i < samples.length; i++) {
      const stem = join(raw, `walk_${view}_${String(i).padStart(2, '0')}`);
      let lit = PNG.sync.read(readFileSync(stem + '.png'));
      let ids = PNG.sync.read(readFileSync(stem + '_id.png'));
      if (mirrored(view)) { lit = flipX(lit); ids = flipX(ids); }
      const picture = snap(lit, ids, 4, palette);
      for (let y = 0; y < 128; y++) atlas.data.set(picture.data.subarray(y * 128 * 4, (y + 1) * 128 * 4), (y * atlas.width + i * 128) * 4);
    }
    const bytes = PNG.sync.write(atlas);
    const file = `human-${view}.png`;
    writeFileSync(join(folder, file), bytes);
    const feet = meta.poses.map(pose => {
      const both = pose[view];
      const floor = Math.min(both.Left.world[2], both.Right.world[2]);
      return (['Left', 'Right'] as const).map(foot => ({
        foot, x: (mirrored(view) ? 128 - both[foot].px[0] : both[foot].px[0]) - 64,
        y: both[foot].px[1] - 90, support: both[foot].world[2] <= floor + .015 * meta.scale_v,
      }));
    });
    sheets[view] = { file, sha256: hash(bytes), frames: samples.length, travelMpx: Math.round(cycle[view] * 1000 / count), cycleDistanceMpx: Math.round(cycle[view] * 1000), feet };
  }
  writeFileSync(join(folder, 'walk-metadata.json'), JSON.stringify({ date: '2026-10-29', frame: { width: 128, height: 128, anchor: [64, 90], scale: 1 }, walkingFrames: count, studySpeedArtPxPerSecond: 125, renderElevationDegrees: 50, source: { branch: 'feat/races-in-game', commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: source, encoding: 'utf8' }).trim(), rendererSha256: rendererHash, modelSha256: hash(readFileSync(String(base['target_path']))), librarySha256: hash(readFileSync((base['libs'] as string[])[0]!)), action, sourceFramesPerCycle: cycleSourceFrames }, sheets }, null, 2) + '\n');
  writeFileSync(join(folder, 'render-job.json'), JSON.stringify(job, null, 2) + '\n');
  writeFileSync(join(folder, 'projected-feet.json'), JSON.stringify(meta) + '\n');
  console.log(`Rendered ${count} walk poses and a standing pose in five views; at most 30 poses/s at the study speed.`);
}
