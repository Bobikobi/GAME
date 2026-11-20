import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { canonical } from '@game/kernel';
import { validateFile, type ExtensionFile } from '@game/schema';
import { describe, expect, test } from 'vitest';
import { assemble } from '../src/assemble.js';
import { readBoard } from '../src/board.js';
import { REPO_ROOT, loadAll } from '../src/load.js';

/**
 * #742: a character clip is a kit sprite entry with a `clip` object (race, view, verb, frame_ms, anchor) and the entry's own
 * `frames`. The schema refuses a clip that cannot be played, naming the field; today's walk sheets validate unchanged.
 */
const FIXTURE = join(REPO_ROOT, 'tools', 'test', 'fixtures', 'clips', 'kit.json');
const fixture = (): { kit: { sprites: Record<string, { clip: Record<string, unknown> }> } } & ExtensionFile => JSON.parse(readFileSync(FIXTURE, 'utf8'));
const STRIKE = 'chars/human_strike_left';

/** The fixture with one field of one clip changed (`undefined` takes it out), and what the schema says of it. */
function refuse(field: string, value: unknown) {
  const data = fixture();
  const clip = data.kit.sprites[STRIKE]!.clip;
  if (value === undefined) delete clip[field];
  else clip[field] = value;
  return validateFile(data);
}

describe('B5: the schema refuses a clip that cannot be played, naming the field', () => {
  test('the fixture kit is valid, and so is develop\'s kit with its walk sheets as they are', () => {
    expect(validateFile(fixture())).toEqual([]);
    const core = JSON.parse(readFileSync(join(REPO_ROOT, 'content', 'kit', 'core', 'kit.json'), 'utf8'));
    expect(validateFile(core)).toEqual([]);
    expect(Object.keys(core.kit.sprites).filter((k) => k.startsWith('chars/human_')).length).toBeGreaterThan(0);
  });

  test('a clip without a frame time', () => {
    const issues = refuse('frame_ms', undefined);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.some((i) => i.path.endsWith('/clip/frame_ms') || i.path.endsWith('/clip') && /frame_ms/.test(i.message))).toBe(true);
  });

  test('a frame time that is not a whole number', () => {
    for (const bad of [83.5, 0.5, '90', null]) {
      const issues = refuse('frame_ms', bad);
      expect(issues.some((i) => i.path.endsWith('/clip/frame_ms')), JSON.stringify(bad)).toBe(true);
    }
    // a frame time of nothing, or one longer than five seconds, is no speed either
    expect(refuse('frame_ms', 0).some((i) => i.path.endsWith('/clip/frame_ms'))).toBe(true);
    expect(refuse('frame_ms', 5001).some((i) => i.path.endsWith('/clip/frame_ms'))).toBe(true);
    expect(refuse('frame_ms', 140)).toEqual([]);
  });

  test('an unknown verb or view', () => {
    expect(refuse('verb', 'swim').some((i) => i.path.endsWith('/clip/verb'))).toBe(true);
    expect(refuse('verb', undefined).some((i) => i.path.endsWith('/clip/verb') || /verb/.test(i.message))).toBe(true);
    expect(refuse('view', 'right').some((i) => i.path.endsWith('/clip/view'))).toBe(true);
    expect(refuse('view', 'diagonal').some((i) => i.path.endsWith('/clip/view'))).toBe(true);
    expect(refuse('view', undefined).some((i) => i.path.endsWith('/clip/view') || /view/.test(i.message))).toBe(true);
  });

  test('a clip without its anchor, or with a field the schema does not know', () => {
    expect(refuse('anchor', undefined).some((i) => i.path.endsWith('/clip/anchor') || /anchor/.test(i.message))).toBe(true);
    expect(refuse('speed', 2).length).toBeGreaterThan(0);
  });
});

describe('the assembler carries the clips and refuses two for one lookup', () => {
  const run = (edit?: (data: ReturnType<typeof fixture>) => void) => {
    const data = fixture();
    edit?.(data);
    return assemble([...loadAll().files, { rel: 'kit/core/clip-fixture.json', abs: FIXTURE, data }], readBoard());
  };

  test('each clip sheet reaches the bundle with its clip', () => {
    const a = run();
    expect(a.issues.filter((i) => i.level === 'error')).toEqual([]);
    const info = a.bundle!.sprites[`core/clip-fixture:${STRIKE}`] as unknown as { frames: number; clip: { verb: string; view: string; frame_ms: number } };
    expect(info.frames).toBe(4);
    expect(info.clip).toMatchObject({ verb: 'strike', view: 'left', frame_ms: 107 });
  });

  test('the clip reaches the client as the bundle command writes it: integers only, and it survives the JSON the client reads', () => {
    const b = run().bundle!;
    expect(() => canonical(b)).not.toThrow();
    const written = JSON.parse(JSON.stringify(b)) as typeof b;
    for (const [name, entry] of Object.entries(fixture().kit.sprites)) {
      expect((written.sprites[`core/clip-fixture:${name}`] as unknown as { clip: unknown }).clip, name).toEqual(entry.clip);
    }
  });

  test('two sheets for one verb, race and view are an error that names the second', () => {
    const a = run((d) => {
      d.kit.sprites['chars/human_strike_left_again'] = structuredClone(d.kit.sprites[STRIKE]!);
      (d.kit.sprites['chars/human_strike_left_again'] as unknown as { file: string }).file = 'chars/human_strike_left_again.png';
    });
    const errors = a.issues.filter((i) => i.level === 'error');
    expect(errors.length).toBe(1);
    expect(errors[0]!.where).toMatch(/^kit\.sprites\.chars\/human_strike_left(_again)?\.clip$/);
    expect(errors[0]!.message).toMatch(/strike core\/human left/);
  });

  test('a clip for something that is not a race is an error that names the field', () => {
    const a = run((d) => {
      d.kit.sprites[STRIKE]!.clip.race = 'core/dragon';
    });
    const errors = a.issues.filter((i) => i.level === 'error');
    expect(errors.map((e) => e.where)).toEqual([`kit.sprites.${STRIKE}.clip.race`]);
  });
});
