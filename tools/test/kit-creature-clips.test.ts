import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { canonical } from '@game/kernel';
import { validateFile, type ExtensionFile } from '@game/schema';
import { describe, expect, test } from 'vitest';
import { assemble } from '../src/assemble.js';
import { readBoard } from '../src/board.js';
import { REPO_ROOT, loadAll } from '../src/load.js';

/**
 * #847: a creature's drawn clip is a kit sprite entry with a `creature_clip` object (creature, view, verb, frame_ms, anchor,
 * and optionally a fit and a head point), and a still sprite names the creature it stands for with `still_of`. The schema refuses
 * a clip that cannot be played, naming the field; the assembler carries both to the bundle and refuses a creature that is not a
 * kind of the map and two sheets for one lookup.
 */
const FIXTURE = join(REPO_ROOT, 'tools', 'test', 'fixtures', 'creature-clips', 'kit.json');
type Sprites = Record<string, Record<string, unknown> & { creature_clip: Record<string, unknown> }>;
const fixture = (): { kit: { sprites: Sprites } } & ExtensionFile => JSON.parse(readFileSync(FIXTURE, 'utf8'));
const WALK = 'creatures/hare_walk_left';
const IDLE = 'creatures/hare_idle_front';
const STILL = 'creatures/hare_still';

function refuse(field: string, value: unknown) {
  const data = fixture();
  const clip = data.kit.sprites[WALK]!.creature_clip;
  if (value === undefined) delete clip[field];
  else clip[field] = value;
  return validateFile(data);
}

describe('the schema refuses a creature clip that cannot be played, naming the field', () => {
  test('the fixture kit is valid, and develop\'s kit with its sheets as they are', () => {
    expect(validateFile(fixture())).toEqual([]);
    const core = JSON.parse(readFileSync(join(REPO_ROOT, 'content', 'kit', 'core', 'kit.json'), 'utf8'));
    expect(validateFile(core)).toEqual([]);
  });

  test('a clip needs its creature, verb, view, frame time and ground point', () => {
    for (const field of ['creature', 'verb', 'view', 'frame_ms', 'anchor']) {
      expect(refuse(field, undefined).length, field).toBeGreaterThan(0);
    }
  });

  test('a verb or view that is not drawn, and a field the schema does not know', () => {
    expect(refuse('verb', 'bite').some((i) => i.path.endsWith('/creature_clip/verb'))).toBe(true);
    expect(refuse('verb', 'strike').some((i) => i.path.endsWith('/creature_clip/verb'))).toBe(true);
    expect(refuse('view', 'right').some((i) => i.path.endsWith('/creature_clip/view'))).toBe(true);
    expect(refuse('race', 'core/human').length).toBeGreaterThan(0);
    expect(refuse('verb', 'idle')).toEqual([]);
  });

  test('a frame time, a fit and a head point are whole numbers inside their bounds', () => {
    for (const bad of [83.5, 0, 5001, '90', null]) expect(refuse('frame_ms', bad).some((i) => i.path.endsWith('/frame_ms')), JSON.stringify(bad)).toBe(true);
    for (const bad of [99, 4001, 1000.5]) expect(refuse('fit_permille', bad).some((i) => i.path.endsWith('/fit_permille')), JSON.stringify(bad)).toBe(true);
    for (const bad of [[1], [1.5, 2], [-1, 2], [1, 400], 'face']) expect(refuse('head', bad).some((i) => i.path.includes('/head')), JSON.stringify(bad)).toBe(true);
    expect(refuse('head', [30, 40])).toEqual([]);
  });

  test('a still names its creature with an id', () => {
    const data = fixture();
    (data.kit.sprites[STILL] as Record<string, unknown>).still_of = 'wolf';
    expect(validateFile(data).some((i) => i.path.endsWith('/still_of'))).toBe(true);
  });
});

/**
 * The fixture plays `core/hare`, which the shipped kit now draws too: the shipped hare's sheets are taken out of the files before the
 * fixture is added, so the fixture is the only hare and two sheets for one lookup mean the fixture's own.
 */
function withoutHareSheets(files: ReturnType<typeof loadAll>['files']) {
  return files.map((f) => {
    if (f.rel !== 'kit/core/kit.json') return f;
    const data = structuredClone(f.data) as unknown as { kit: { sprites: Record<string, unknown> } };
    for (const name of Object.keys(data.kit.sprites)) if (name.startsWith('creatures/hare_')) delete data.kit.sprites[name];
    return { ...f, data: data as unknown as typeof f.data };
  });
}

describe('the assembler carries creature clips and refuses what cannot be found', () => {
  const run = (edit?: (data: ReturnType<typeof fixture>) => void) => {
    const data = fixture();
    edit?.(data);
    return assemble([...withoutHareSheets(loadAll().files), { rel: 'kit/core/creature-clip-fixture.json', abs: FIXTURE, data }], readBoard());
  };
  const errors = (a: ReturnType<typeof run>) => a.issues.filter((i) => i.level === 'error');

  test('each sheet reaches the bundle with its clip, and the still with its creature', () => {
    const a = run();
    expect(errors(a)).toEqual([]);
    const walk = a.bundle!.sprites[`core/creature-clip-fixture:${WALK}`] as unknown as { frames: number; creature_clip: unknown };
    expect(walk.frames).toBe(8);
    expect(walk.creature_clip).toEqual(fixture().kit.sprites[WALK]!.creature_clip);
    const idle = a.bundle!.sprites[`core/creature-clip-fixture:${IDLE}`] as unknown as { creature_clip: Record<string, unknown> };
    expect(idle.creature_clip).toEqual({ creature: 'core/hare', view: 'front', verb: 'idle', frame_ms: 160, anchor: [64, 99] });
    expect(Object.keys(idle.creature_clip)).not.toContain('head');
    expect((a.bundle!.sprites[`core/creature-clip-fixture:${STILL}`] as unknown as { still_of: string }).still_of).toBe('core/hare');
  });

  test('it survives the JSON the client reads, integers only', () => {
    const b = run().bundle!;
    expect(() => canonical(b)).not.toThrow();
    const written = JSON.parse(JSON.stringify(b)) as typeof b;
    for (const name of [WALK, IDLE]) {
      expect((written.sprites[`core/creature-clip-fixture:${name}`] as unknown as { creature_clip: unknown }).creature_clip, name).toEqual(fixture().kit.sprites[name]!.creature_clip);
    }
  });

  test('a creature that is not a kind of the map is an error that names the field', () => {
    const a = run((d) => {
      d.kit.sprites[WALK]!.creature_clip.creature = 'core/dragon';
      (d.kit.sprites[STILL] as Record<string, unknown>).still_of = 'core/dragon';
    });
    expect(errors(a).map((e) => e.where).sort()).toEqual([`kit.sprites.${STILL}.still_of`, `kit.sprites.${WALK}.creature_clip.creature`]);
  });

  test('two sheets for one verb, creature and view are an error that names the second', () => {
    const a = run((d) => {
      d.kit.sprites['creatures/hare_walk_left_again'] = structuredClone(d.kit.sprites[WALK]!);
      (d.kit.sprites['creatures/hare_walk_left_again'] as Record<string, unknown>).file = 'creatures/hare_walk_left_again.png';
    });
    expect(errors(a).length).toBe(1);
    expect(errors(a)[0]!.message).toMatch(/walk core\/hare left/);
  });

  test('a ground point or a head point outside the frame, and a sheet that is a character clip too', () => {
    expect(errors(run((d) => { d.kit.sprites[WALK]!.creature_clip.anchor = [64, 128]; })).map((e) => e.where)).toEqual([`kit.sprites.${WALK}.creature_clip.anchor`]);
    expect(errors(run((d) => { d.kit.sprites[WALK]!.creature_clip.head = [128, 10]; })).map((e) => e.where)).toEqual([`kit.sprites.${WALK}.creature_clip.head`]);
    const both = run((d) => {
      (d.kit.sprites[WALK] as Record<string, unknown>).clip = { race: 'core/human', view: 'left', verb: 'strike', frame_ms: 100, anchor: [64, 90] };
    });
    expect(errors(both).some((e) => /not both/.test(e.message))).toBe(true);
  });
});
