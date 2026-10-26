/**
 * tools/anim (library motion to pixels): the clip configs, the library fetch's refusal, the zip reader, the snap and
 * the four measures, on small made-up inputs. Blender and the network are not touched.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { crc32, deflateRawSync } from 'node:zlib';
import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';
import { type Clip, clipNames, clipProblems, job, type Library, paces, poseMs, readClip, readLibraries, readSettings, samples, stepFrames } from '../src/anim/clip';
import { onTarget, outDir } from '../src/anim/cli';
import { archiveProblems, itchUploads, sha256, unpack } from '../src/anim/fetch';
import { measureClip, outlineOf, paletteShare, plantedRuns, type RenderMeta, sharedSlope, silhouette, slideAtPace, stride } from '../src/anim/measure';
import { classPalettes, flipX, type Picture, rampColours, snap } from '../src/anim/snap';
import { applyInk, INK_HEX, inkShare } from '../src/kit/ink';
import { zipEntries, zipFile, zipRead } from '../src/anim/zip';
import { CONTENT_DIR, REPO_ROOT } from '../src/load';

const settings = readSettings();
const libs = readLibraries();
const OUTLINE = INK_HEX;

function picture(width: number, height: number, fill?: (x: number, y: number) => readonly [number, number, number, number] | undefined): Picture {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    const c = fill?.(x, y);
    if (c) data.set(c, (y * width + x) * 4);
  }
  return { width, height, data };
}

const at = (p: Picture, x: number, y: number) => `#${[...p.data.subarray((y * p.width + x) * 4, (y * p.width + x) * 4 + 3)].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
const alpha = (p: Picture, x: number, y: number) => p.data[(y * p.width + x) * 4 + 3];

describe('clip configs', () => {
  it('every clip in tools/anim/clips can be rendered as written', () => {
    expect(clipNames().length).toBeGreaterThan(0);
    for (const name of clipNames()) expect(clipProblems(name, readClip(name), libs, settings)).toEqual([]);
  });

  it('every target of the cast has its model in the repo, shared ramps and a credit line naming its licence', () => {
    const cast = Object.entries(settings.targets).filter(([, t]) => !t.model.startsWith('$'));
    expect(cast.length).toBeGreaterThan(1);
    for (const [id, t] of cast) {
      expect(existsSync(join(REPO_ROOT, t.model)), id).toBe(true);
      expect(() => classPalettes(t.ramps, t.metal, t.leaf), id).not.toThrow();
      expect(rampColours(t.ramps).length, id).toBeGreaterThan(0);
      expect(t.credit ?? '', id).toMatch(/CC BY 4\.0|CC0/);
    }
  });

  it('a clip moved onto another target keeps its motion, takes that body and writes to its own folder', () => {
    const chop = readClip('chop');
    const moved = onTarget(chop, 'digger-f');
    expect(moved.target).toBe('digger-f');
    expect(moved.base).toEqual(chop.base);
    expect(moved.prop).toEqual(chop.prop);
    expect(onTarget(chop, undefined)).toBe(chop);
    expect(clipProblems('chop', moved, libs, settings)).toEqual([]);
    expect(clipProblems('chop', onTarget(chop, 'nobody'), libs, settings).join(' ')).toContain('nobody');
    expect(outDir('chop', 'digger-f').split(/[\\/]/).slice(-3)).toEqual(['cast', 'digger-f', 'chop']);
    expect(outDir('chop').split(/[\\/]/).slice(-2)).toEqual(['out', 'chop']);
  });

  it('refuses an action the library lacks, a frame past its end, a short IK curve and a locomotion clip with picked frames', () => {
    const bad: Clip = {
      about: 'made up',
      target: 'forager',
      base: { library: 'ual1', action: 'Walk_Loop' },
      frames: [0, 99],
      ik: { side: 'R', anchor: 'shoulder', pole: [0, 0, -1], points: [[0, 0, 0]], t: [0] },
      frame: { size: [64, 96], anchor: [32, 84] },
      views: ['down'],
      locomotion: { playback: 'distance' },
      layer: { library: 'ual2', action: 'No_Such_Action', mask: ['arm_x'], frame: 0 },
      ramps: ['velvet'],
    };
    const problems = clipProblems('bad', bad, libs, settings).join('\n');
    expect(problems).toMatch(/frame 99 is outside the base action/);
    expect(problems).toMatch(/action "No_Such_Action" is not in ual2/);
    expect(problems).toMatch(/mask "arm_x"/);
    expect(problems).toMatch(/ik.points/);
    expect(problems).toMatch(/ik.t is 2 numbers/);
    expect(problems).toMatch(/spreads its poses evenly/);
    expect(problems).toMatch(/ramp "velvet"/);
  });

  it('refuses a set piece or a worn part the renderer cannot build, and a named IK point without a body anchor', () => {
    const kneel = readClip('harvest_kneel');
    const bad: Clip = {
      ...kneel,
      set: [{ kind: 'tree', at: [0.3] }],
      worn: [{ kind: 'quiver', at: [0, 0, 0] }],
      ik: { side: 'R', anchor: 'shoulder', pole: [0, 0, -1], points: ['pouch', [0, 0, 0]], t: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7] },
      prop: { kind: 'sprig', hand: 'R', poses: [3, 8] },
    };
    const problems = clipProblems('bad', bad, libs, settings).join('\n');
    expect(problems).toMatch(/set piece "tree"/);
    expect(problems).toMatch(/set tree: at is two numbers/);
    expect(problems).toMatch(/worn "quiver"/);
    expect(problems).toMatch(/ik.points/);
    expect(problems).toMatch(/prop.poses are pose numbers from 0 to 7/);
    expect(clipProblems('kneel', { ...kneel, worn: [] }, libs, settings).join('\n')).toMatch(/ik.points/);
  });

  it('a layer that follows the base takes the same phase of its own action', () => {
    const clip = readClip('walk_torch');
    const s = samples(clip, libs);
    const walk = libs.ual1?.actions.Walk_Loop ?? 0;
    const torch = libs.ual1?.actions.Idle_Torch_Loop ?? 0;
    expect(s.map((x) => x.base[1])).toEqual([0, 4, 8, 12, 16, 20, 24, 28].map((f) => (f * walk) / 32));
    expect(s[4]?.layer_f).toBeCloseTo((s[4]?.base[1] ?? 0) * (torch / walk), 2);
    expect(stepFrames(clip, libs)).toBe(walk / 8);
  });

  it('a pose lasts until the next picked frame at the library fps unless the clip says', () => {
    const picked: Clip = { about: 'picked frames', target: 'forager', base: { library: 'ual2', action: 'Farm_Harvest' }, frames: [0, 8, 14, 20, 26, 32, 42, 52], frame: { size: [128, 128], anchor: [64, 112] }, views: ['down'] };
    expect(poseMs(picked, libs)).toEqual([333, 250, 250, 250, 250, 417, 417, 333]);
    expect(poseMs(readClip('dig_ik'), libs)).toEqual([110, 110, 110, 110, 110, 110, 110, 110]);
  });

  it('the job carries the resolved paths, the IK, the set, the worn parts and the dense feet of a locomotion clip', () => {
    const j = job('walk_torch', readClip('walk_torch'), libs, settings, { out: '/o', libs: ['/l1.glb'], model: '/m.glb', threads: 2 });
    expect(j).toMatchObject({ target: 'forager', target_path: '/m.glb', libs: ['/l1.glb'], prop: 'torch', prop_side: 'L', layer: { action: 'Idle_Torch_Loop', mask: ['arm_l'] }, dense: { length: 32, step: 1 } });
    const ik = job('dig_ik', readClip('dig_ik'), libs, settings, { out: '/o', libs: [], model: '/m.glb', threads: 2 });
    expect(ik).toMatchObject({ prop_from: 'ik', haft_from: 'fore', ik: { side: 'R', anchor: 'wrist' } });
    expect(ik.dense).toBeUndefined();
    const pick = job('harvest_kneel', readClip('harvest_kneel'), libs, settings, { out: '/o', libs: [], model: '/m.glb', threads: 2 });
    expect(pick).toMatchObject({ prop: 'sprig', prop_poses: [4, 5, 6, 7], set: [{ kind: 'herb' }, { kind: 'herb' }], worn: [{ kind: 'pouch' }], ik: { side: 'R', anchor: 'body' } });
  });

  it('reads the game paces from the params: one tile per step', () => {
    const p = paces(settings, JSON.parse(readFileSync(join(CONTENT_DIR, 'core', 'params.json'), 'utf8')));
    expect(p.steady).toBeCloseTo(64000 / 190, 3);
    expect(p.light).toBeGreaterThan(p.steady);
    expect(p.heavy).toBeLessThan(p.steady);
  });
});

function makeZip(files: { name: string; data: Buffer; deflate: boolean }[]): Buffer {
  const parts: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const f of files) {
    const body = f.deflate ? deflateRawSync(f.data) : f.data;
    const name = Buffer.from(f.name);
    const crc = crc32(f.data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(f.deflate ? 8 : 0, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(f.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    parts.push(local, name, body);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0);
    c.writeUInt16LE(f.deflate ? 8 : 0, 10);
    c.writeUInt32LE(crc, 16);
    c.writeUInt32LE(body.length, 20);
    c.writeUInt32LE(f.data.length, 24);
    c.writeUInt16LE(name.length, 28);
    c.writeUInt32LE(offset, 42);
    central.push(c, name);
    offset += 30 + name.length + body.length;
  }
  const dir = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(dir.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, dir, end]);
}

describe('zip reader', () => {
  const text = Buffer.from('CC0 1.0 Universal\n'.repeat(20));
  const glb = Buffer.from(Array.from({ length: 300 }, (_, i) => i % 251));
  const zip = makeZip([
    { name: 'Lib/License.txt', data: text, deflate: true },
    { name: 'Lib/x.glb', data: glb, deflate: false },
  ]);

  it('reads stored and deflated entries by name', () => {
    expect(zipEntries(zip).map((e) => e.name)).toEqual(['Lib/License.txt', 'Lib/x.glb']);
    expect(zipFile(zip, 'Lib/License.txt').equals(text)).toBe(true);
    expect(zipFile(zip, 'Lib/x.glb').equals(glb)).toBe(true);
  });

  it('refuses an entry whose bytes do not match its CRC', () => {
    const broken = Buffer.from(zip);
    const entry = zipEntries(broken)[1];
    if (entry === undefined) throw new Error('no entry');
    const start = entry.offset + 30 + 'Lib/x.glb'.length;
    broken[start + 5] = (broken[start + 5] ?? 0) ^ 0xff;
    expect(() => zipRead(broken, entry)).toThrow(/CRC/);
  });
});

describe('library fetch', () => {
  const archive = makeZip([
    { name: 'L/License.txt', data: Buffer.from('CC0'), deflate: false },
    { name: 'L/a.glb', data: Buffer.from('glTF'), deflate: false },
  ]);
  const lib: Library = { title: 't', page: 'https://example.invalid/x', upload: 'x.zip', bytes: archive.length, sha256: sha256(archive), licence: 'CC0', glb: 'L/a.glb', licence_file: 'L/License.txt', fps: 24, actions: {} };

  it('accepts exactly the bytes in libraries.json', () => {
    expect(archiveProblems(archive, lib)).toEqual([]);
  });

  it('refuses an archive whose sha256 differs, before unpacking anything', () => {
    const other = Buffer.from(archive);
    other[31] = (other[31] ?? 0) ^ 0xff;
    expect(archiveProblems(other, lib).join(' ')).toMatch(/sha256 [0-9a-f]{64}, expected/);
    expect(() => unpack('test-refused', lib, other)).toThrow(/refused/);
  });

  it('every library names its archive by sha256 and its licence', () => {
    for (const l of Object.values(libs)) {
      expect(l.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(l.licence).toMatch(/CC0/);
      expect(l.page).toMatch(/^https:\/\//);
    }
  });

  it('finds the upload ids and names on a download page', () => {
    const html = '<div class="upload"><a data-upload_id="11">Download</a><div class="info"><strong title="A.zip" class="name">A.zip</strong></div></div>'
      + '<div class="upload"><a data-upload_id="12">Download</a><strong class="name" title="B">B[Standard].zip</strong></div>';
    expect(itchUploads(html)).toEqual([{ id: '11', name: 'A.zip' }, { id: '12', name: 'B[Standard].zip' }]);
  });
});

describe('snap', () => {
  const pal = classPalettes(['wood', 'red', 'skin'], 'grey');
  const allowed = new Set([...pal.body, ...pal.fire, ...pal.metal, ...pal.leaf, OUTLINE]);
  // 4x supersampled 12x12 art px: a body square at art (4..7, 4..7), its right column a flame in the ID pass
  const hi = picture(48, 48, (x, y) => (x >= 16 && x < 32 && y >= 16 && y < 32 ? [180, 120, 80, 255] : undefined));
  const ids = picture(48, 48, (x, y) => (x >= 16 && x < 32 && y >= 16 && y < 32 ? (x >= 28 ? [255, 0, 0, 255] : [0, 0, 255, 255]) : undefined));

  it('draws only ramp colours, one block per pixel, and the outline all round', () => {
    const s = snap(hi, undefined, 4, pal);
    expect([s.width, s.height]).toEqual([12, 12]);
    expect(paletteShare([s], allowed).pct).toBe(100);
    expect(at(s, 3, 5)).toBe(OUTLINE);
    expect(at(s, 8, 5)).toBe(OUTLINE);
    expect(alpha(s, 2, 5)).toBe(0);
    expect(outlineOf(s)).toEqual({ outlined: true, clipped: false });
  });

  it('draws the one ink edge: the kit measure reads 100 % and the kit ink pass changes nothing', () => {
    const s = snap(hi, undefined, 4, pal);
    const png = PNG.sync.write(Object.assign(new PNG({ width: s.width, height: s.height }), { data: Buffer.from(s.data) }));
    expect(inkShare(png, s.width)).toBe(1);
    expect(PNG.sync.read(applyInk(png, s.width)).data.equals(PNG.sync.read(png).data)).toBe(true);
  });

  it('a pixel the ID pass marks as flame takes the fire ramp only', () => {
    const s = snap(hi, ids, 4, pal);
    expect(pal.fire).toContain(at(s, 7, 5));
    expect(pal.body).toContain(at(s, 5, 5));
    expect(pal.fire).not.toContain(at(s, 5, 5));
  });

  it('a pixel the ID pass marks as leaf takes the leaf ramp only', () => {
    const leafIds = picture(48, 48, (x, y) => (x >= 16 && x < 32 && y >= 16 && y < 32 ? (x >= 28 ? [255, 255, 0, 255] : [0, 0, 255, 255]) : undefined));
    const s = snap(hi, leafIds, 4, pal);
    expect(pal.leaf).toContain(at(s, 7, 5));
    expect(pal.body).not.toContain(at(s, 7, 5));
    expect(pal.body).toContain(at(s, 5, 5));
    expect(paletteShare([s], allowed).pct).toBe(100);
  });

  it('a block less than half covered stays clear', () => {
    const thin = picture(8, 8, (x, y) => (x === 0 && y < 4 ? [180, 120, 80, 255] : undefined));
    const s = snap(thin, undefined, 4, pal);
    expect([alpha(s, 0, 0), alpha(s, 1, 0), alpha(s, 0, 1)]).toEqual([0, 0, 0]);
  });

  it('mirrors left to right', () => {
    const p = picture(3, 1, (x) => (x === 0 ? [1, 2, 3, 255] : undefined));
    expect([...flipX(p).data.subarray(8, 12)]).toEqual([1, 2, 3, 255]);
  });
});

describe('measures', () => {
  it('palette: an off-ramp pixel fails the clip', () => {
    const p = picture(4, 4, (x, y) => (x === 1 && y === 1 ? [1, 2, 3, 255] : undefined));
    const m = measureClip({ frames: { down: [p] }, allowed: new Set([OUTLINE]), limits: settings.limits, ms: [100], paces: { light: 1, steady: 1, heavy: 1 } });
    expect(m.palette.pct).toBe(0);
    expect(m.problems.join(' ')).toMatch(/palette 0%/);
    expect(m.problems.join(' ')).toMatch(/without the full outline/);
  });

  it('outline: a drawing that touches the frame edge is clipped', () => {
    const p = picture(3, 3, () => [0x1b, 0x1a, 0x2e, 255]);
    expect(outlineOf(p)).toEqual({ outlined: true, clipped: true });
  });

  it('silhouette: the largest deviation from the mean area', () => {
    const square = (n: number) => picture(10, 10, (x, y) => (x < n && y < n ? [0, 0, 0, 255] : undefined));
    const s = silhouette([square(4), square(4), square(4), square(2)]);
    expect(s.areas).toEqual([16, 16, 16, 4]);
    expect(s.maxDevPct).toBeCloseTo((100 * 9) / 13, 2);
  });

  it('planted runs wrap round the loop', () => {
    expect(plantedRuns([0, 0, 1, 1, 1, 0, 0, 0], 0.1)).toEqual([[5, 6, 7, 0, 1]]);
    expect(sharedSlope([[10, 4, -2], [30, 24]])).toBeCloseTo(-6, 6);
  });

  // a walk seen from the front: each foot planted for four of eight poses while the ground moves 6 px a pose
  const feet = (i: number) => {
    const leftDown = i < 4;
    const foot = (planted: boolean, k: number) => ({ px: [30, planted ? 60 - 6 * k : 40] as [number, number], world: [0, 0, planted ? 0 : 0.1] as [number, number, number] });
    return { down: { Left: foot(leftDown, i % 4), Right: foot(!leftDown, i % 4) } };
  };
  const meta: RenderMeta = { frame: [64, 96], scale_v: 1, poses: Array.from({ length: 8 }, (_, i) => feet(i)) };

  it('foot slide: a planted foot that moves with the ground holds; the stride is fitted from it', () => {
    const s = stride(meta, 'down', 4);
    expect(s.travelPerPose).toBe(6);
    expect(s.cyclePx).toBe(48);
    expect(s.lockedSlidePx).toBe(0);
    const shaken = Array.from({ length: 8 }, (_, i) => feet(i));
    const third = shaken[2];
    if (third) third.down.Left.px = [30, 48.6];
    const jitter: RenderMeta = { ...meta, poses: shaken };
    expect(stride(jitter, 'down', 4).lockedSlidePx).toBeGreaterThan(0.3);
  });

  it('foot slide at the game pace: distance playback holds, time playback drifts by the speed difference', () => {
    const s = stride(meta, 'down', 4);
    const steady = 64000 / 190;
    expect(slideAtPace(s, Array(8).fill(100), steady, 'distance')).toMatchObject({ slidePx: 0, lockedPoseRate: Math.round((steady / 6) * 10) / 10 });
    expect(slideAtPace(s, Array(8).fill(100), steady, 'time').slidePx).toBeCloseTo(3 * (steady / 10 - 6), 1);
    expect(slideAtPace(s, Array(8).fill(Math.round((6 / steady) * 100000) / 100), steady, 'time').slidePx).toBeLessThan(0.05);
  });

  it('a locomotion clip fails on slide over 1 px at a pace, and passes with its feet locked', () => {
    const frames = { down: Array.from({ length: 8 }, () => picture(5, 5, (x, y) => (x > 0 && x < 4 && y > 0 && y < 4 ? (x === 2 && y === 2 ? [0x9e, 0x6b, 0x3c, 255] : [0x1b, 0x1a, 0x2e, 255]) : undefined))) };
    const base = { frames, allowed: new Set(['#9e6b3c', OUTLINE]), limits: settings.limits, meta, poseStep: 4, ms: Array(8).fill(100), paces: { light: 160, steady: 150, heavy: 120 } };
    expect(measureClip({ ...base, locomotion: { playback: 'distance' } }).problems).toEqual([]);
    expect(measureClip({ ...base, locomotion: { playback: 'time' } }).problems.join(' ')).toMatch(/feet slide .* at the steady pace/);
  });

  it('a distance-locked cycle fails when its short stride needs more poses a second than the screen can show', () => {
    const frames = { down: Array.from({ length: 8 }, () => picture(5, 5, (x, y) => (x > 0 && x < 4 && y > 0 && y < 4 ? (x === 2 && y === 2 ? [0x9e, 0x6b, 0x3c, 255] : [0x1b, 0x1a, 0x2e, 255]) : undefined))) };
    const m = measureClip({ frames, allowed: new Set(['#9e6b3c', OUTLINE]), limits: settings.limits, meta, poseStep: 4, ms: Array(8).fill(100), paces: { light: 376, steady: 337, heavy: 278 }, locomotion: { playback: 'distance' } });
    expect(m.problems).toHaveLength(3);
    expect(m.problems[1]).toMatch(/needs 56.2 poses a second at the steady pace/);
    expect(m.views.down?.paces?.steady.slidePx).toBe(0);
  });
});
