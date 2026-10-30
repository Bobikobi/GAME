/**
 * The ground fowl (tools/anim target `fowl`, game/public3d/models/animal-fowl.glb): its walk and run are rendered with
 * one floor a cycle (`locomotion.airborne`), its other clips are not, a non-boolean `airborne` is refused, and the
 * committed body plays each action for the length the target declares. Blender is not touched.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { clipNames, clipProblems, job, readClip, readLibraries, readSettings, withNative } from '../src/anim/clip';
import { REPO_ROOT } from '../src/load';

const settings = readSettings();
const libs = withNative(readLibraries(), settings);
const paths = { out: '/o', libs: [], model: '/m.glb', threads: 1 };

interface GltfDoc {
  animations?: { name: string; samplers: { input: number }[] }[];
  accessors: { max?: number[] }[];
  nodes: { name?: string; translation?: number[]; rotation?: number[]; scale?: number[] }[];
  scenes: { nodes: number[] }[];
}

/** The JSON chunk of a binary glTF: a 12-byte header, then the first chunk's length and type, then the JSON. */
function gltfJson(file: string): GltfDoc {
  const b = readFileSync(file);
  expect(b.toString('latin1', 0, 4)).toBe('glTF');
  const length = b.readUInt32LE(12);
  expect(b.toString('latin1', 16, 20)).toBe('JSON');
  return JSON.parse(b.toString('utf8', 20, 20 + length)) as GltfDoc;
}

describe('the ground fowl', () => {
  it('walks and runs airborne: the renderer is asked for one floor a cycle; its standing clips are grounded at every pose', () => {
    expect(job('fowl_walk', readClip('fowl_walk'), libs, settings, paths).ground).toBe('cycle');
    expect(job('fowl_run', readClip('fowl_run'), libs, settings, paths).ground).toBe('cycle');
    expect(job('fowl_idle', readClip('fowl_idle'), libs, settings, paths).ground).toBeUndefined();
  });

  it('refuses an airborne flag that is not true or false', () => {
    const walk = readClip('fowl_walk');
    expect(clipProblems('fowl_walk', walk, libs, settings)).toEqual([]);
    const bad = { ...walk, locomotion: { playback: 'distance' as const, airborne: 1 as unknown as boolean } };
    expect(clipProblems('fowl_walk', bad, libs, settings).join(' ')).toMatch(/airborne/);
  });

  it('every clip of the fowl is valid and takes one of the actions the target declares', () => {
    const fowl = settings.targets.fowl;
    expect(fowl?.map).toBe('native');
    const clips = clipNames().filter((n) => readClip(n).target === 'fowl');
    expect(clips.sort()).toEqual(['fowl_alert', 'fowl_fly', 'fowl_graze', 'fowl_idle', 'fowl_lie', 'fowl_lift', 'fowl_run', 'fowl_walk']);
    for (const n of clips) {
      const c = readClip(n);
      expect(clipProblems(n, c, libs, settings), n).toEqual([]);
      expect(Object.keys(fowl?.actions ?? {}), n).toContain(c.base.action);
    }
  });

  it('the committed body plays each action for the frames the target declares, under roots with no transform', () => {
    const fowl = settings.targets.fowl;
    const model = fowl?.model;
    const fps = fowl?.fps;
    if (model === undefined || fps === undefined) throw new Error('the fowl target names no model or fps');
    const doc = gltfJson(join(REPO_ROOT, model));
    const played: Record<string, number> = {};
    for (const a of doc.animations ?? []) {
      const seconds = Math.max(...a.samplers.map((s) => doc.accessors[s.input]?.max?.[0] ?? 0));
      played[a.name] = Math.round(seconds * fps * 1000) / 1000;
    }
    expect(played).toEqual(fowl?.actions);
    for (const i of doc.scenes[0]?.nodes ?? []) {
      const root = doc.nodes[i];
      expect(root?.translation, root?.name).toBeUndefined();
      expect(root?.rotation, root?.name).toBeUndefined();
      expect(root?.scale, root?.name).toBeUndefined();
    }
  });
});
