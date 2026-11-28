import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { canonical } from '@game/kernel';
import { validateFile, type ExtensionFile } from '@game/schema';
import { describe, expect, test } from 'vitest';
import { assemble } from '../src/assemble.js';
import { readBoard } from '../src/board.js';
import { REPO_ROOT, loadAll } from '../src/load.js';
import { withoutClips } from './fixtures/clips/without-clips.js';

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
    return assemble([...withoutClips(loadAll().files), { rel: 'kit/core/clip-fixture.json', abs: FIXTURE, data }], readBoard());
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

  test('a hand is at most one point a frame: carried to the bundle, refused above its frames, and a clip with none still assembles', () => {
    // the fixture's clips have no hand: they assemble and the bundle's clip has no `hand` key
    const plain = run();
    expect(plain.issues.filter((i) => i.level === 'error')).toEqual([]);
    expect(Object.keys((plain.bundle!.sprites[`core/clip-fixture:${STRIKE}`] as unknown as { clip: object }).clip)).not.toContain('hand');
    // four frames, four points: the bundle carries them as whole numbers
    const hand = [[10, 20], [11, 21], [12, 22], [13, 23]];
    const withHand = run((d) => {
      d.kit.sprites[STRIKE]!.clip.hand = hand;
    });
    expect(withHand.issues.filter((i) => i.level === 'error')).toEqual([]);
    const info = withHand.bundle!.sprites[`core/clip-fixture:${STRIKE}`] as unknown as { clip: { hand: number[][] } };
    expect(info.clip.hand).toEqual(hand);
    expect(() => canonical(withHand.bundle!)).not.toThrow();
    // fewer points than frames is fine (a hand is needed only while the thing is held); more than the clip has is an error that names the field
    const short = run((d) => {
      d.kit.sprites[STRIKE]!.clip.hand = hand.slice(0, 3);
    });
    expect(short.issues.filter((i) => i.level === 'error')).toEqual([]);
    const long = run((d) => {
      d.kit.sprites[STRIKE]!.clip.hand = [...hand, [14, 24]];
    });
    expect(long.issues.filter((i) => i.level === 'error').map((e) => e.where)).toEqual([`kit.sprites.${STRIKE}.clip.hand`]);
  });

  test('the schema takes a hand of whole points inside the frame and refuses the rest', () => {
    expect(refuse('hand', [[1, 2], [3, 4]])).toEqual([]);
    for (const bad of [[], [[1]], [[1.5, 2]], [[-1, 2]], [[1, 400]], 'left', [null]]) {
      expect(refuse('hand', bad).some((i) => i.path.includes('/clip/hand')), JSON.stringify(bad)).toBe(true);
    }
  });

  test('a clip for something that is not a race is an error that names the field', () => {
    const a = run((d) => {
      d.kit.sprites[STRIKE]!.clip.race = 'core/dragon';
    });
    const errors = a.issues.filter((i) => i.level === 'error');
    expect(errors.map((e) => e.where)).toEqual([`kit.sprites.${STRIKE}.clip.race`]);
  });
});

describe('takes: a near-identical drawing of a clip is kept as a later take', () => {
  const build = (edit: (sprites: Record<string, { clip: Record<string, unknown> }>) => void) => {
    const data = fixture();
    edit(data.kit.sprites);
    return assemble([...withoutClips(loadAll().files), { rel: 'kit/core/clip-fixture.json', abs: FIXTURE, data }], readBoard()).issues.filter((i) => i.level === 'error');
  };

  test('the fixture\'s takes 2 and 3 of the human hit reach the bundle with their take, and the first take has none', () => {
    const data = fixture();
    const a = assemble([...withoutClips(loadAll().files), { rel: 'kit/core/clip-fixture.json', abs: FIXTURE, data }], readBoard());
    const clip = (name: string) => (a.bundle!.sprites[`core/clip-fixture:${name}`] as unknown as { clip: { take?: number } }).clip;
    expect(clip('chars/human_hit_left').take).toBeUndefined();
    expect(clip('chars/human_hit_left_v2').take).toBe(2);
    expect(clip('chars/human_hit_left_v3').take).toBe(3);
  });

  test('two sheets with the same take of one clip are refused; a take with a gap before it is refused', () => {
    expect(build((s) => { s['chars/human_hit_left_v3']!.clip.take = 2; }).some((e) => /already plays hit core\/human left take 2/.test(e.message))).toBe(true);
    expect(build((s) => { delete s['chars/human_hit_left_v2']; }).some((e) => /has no take 2/.test(e.message))).toBe(true);
  });

  test('a take outside 2 to 9 is refused by the schema', () => {
    for (const bad of [1, 0, 10, 2.5, '2']) expect(refuse('take', bad).some((i) => i.path.endsWith('/clip/take')), JSON.stringify(bad)).toBe(true);
    expect(refuse('take', 2)).toEqual([]);
  });
});
