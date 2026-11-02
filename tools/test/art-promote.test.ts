import { createHash } from 'node:crypto';

import { PNG } from 'pngjs';
import { describe, expect, test } from 'vitest';

import { type Choice } from '../src/art/library-reviews.js';
import { type Draft, sha256Hex } from '../src/art/drafts.js';
import {
  BUCKETS, type CameraRecord, MAX_MEAN_DE, STEPS, bucketOf, familyOf, onCanvas, ownerKept, parseCamera, promoteRefusal, queue, queueText,
  recordProblem, sha256, snapToPalette, stepOf,
} from '../src/art/promote.js';

/** A draft fixture, the same shape `art-library.test.ts` builds its own from. */
function draft(seed: string, over: Partial<Draft> = {}): Draft {
  const sha = sha256Hex(Buffer.from(seed));
  return {
    id: sha.slice(0, 16), pool: null, name: seed, spec: null, round: null, route: 'codex', recipe: 'codex', model: null, model_version: null, seed: null,
    denoise: null, canvas: null, asked: null, ramps: null, prompt: 'a prompt', negative: null, warnings: [], errors: [], run: null,
    files: { raw: { sha256: sha, bytes: 10 }, full: null, imported: null },
    stored: { repo: 'x/y', tag: 'run-20261030-abcdef', assets: { raw: `${sha.slice(0, 16)}.png` } },
    review: 'unreviewed', at: null, sources: [], ...over,
  };
}

/** A PNG of one solid colour, `side` square, fully opaque unless `alpha` says otherwise. */
function solid(hex: string, side = 2, alpha = 255): PNG {
  const [r, g, b] = [Number.parseInt(hex.slice(1, 3), 16), Number.parseInt(hex.slice(3, 5), 16), Number.parseInt(hex.slice(5, 7), 16)];
  const png = new PNG({ width: side, height: side });
  for (let i = 0; i < side * side; i += 1) {
    png.data[i * 4] = r;
    png.data[i * 4 + 1] = g;
    png.data[i * 4 + 2] = b;
    png.data[i * 4 + 3] = alpha;
  }
  return png;
}

describe('familyOf', () => {
  test('a trailing frame or variant number is cut, the base name is not', () => {
    expect(familyOf('pro-bush-12')).toBe('pro-bush');
    expect(familyOf('rock_mossy_3')).toBe('rock_mossy');
    expect(familyOf('pro-bush')).toBe('pro-bush');
    expect(familyOf('well42')).toBe('well');
  });
});

describe('bucketOf', () => {
  test('a creature, an effect and combat motion are held as advanced', () => {
    expect(bucketOf('cat-warrior').bucket).toBe('advanced');
    expect(bucketOf('hit-flash-1').bucket).toBe('advanced');
    expect(bucketOf('anim-sneak-v2').bucket).toBe('advanced');
  });

  test('a keyframe pair, a figure and a wind frame wait for something else', () => {
    expect(bucketOf('kf-walk-1').bucket).toBe('source');
    expect(bucketOf('human-base').bucket).toBe('parameters');
    expect(bucketOf('anim-oak-wind-1').bucket).toBe('parameters');
  });

  test('a many-piece sheet needs a cut, a reference picture is a source', () => {
    expect(bucketOf('sheet-props-1').bucket).toBe('cut');
    expect(bucketOf('oaks').bucket).toBe('cut');
    expect(bucketOf('bush-source').bucket).toBe('source');
  });

  test('a family that matches no rule is ready for the camera check as drawn', () => {
    expect(bucketOf('pro-bush')).toEqual({ bucket: 'ready', why: 'one picture of one thing' });
  });

  test('every bucket word is one of the BUCKETS', () => {
    for (const family of ['cat-warrior', 'kf-walk', 'human-base', 'sheet-props', 'pro-bush']) {
      expect(BUCKETS).toContain(bucketOf(family).bucket);
    }
  });
});

describe('ownerKept', () => {
  test('a draft the owner (or his stamp, elad) marked keep directly is kept', () => {
    const a = draft('a', { review: 'keep', review_by: 'owner' });
    const b = draft('b', { review: 'keep', review_by: 'elad' });
    const kept = ownerKept([a, b], new Map());
    expect(kept.map((d) => d.id)).toEqual([a.id, b.id]);
  });

  test('kept by someone other than the owner, or not kept at all, is left out', () => {
    const a = draft('a', { review: 'keep', review_by: 'some-agent' });
    const b = draft('b', { review: 'unreviewed' });
    expect(ownerKept([a, b], new Map())).toEqual([]);
  });

  test("the page's own choice overrides the index row, by whoever recorded it", () => {
    const a = draft('a', { review: 'unreviewed' });
    const choice: Choice = { id: a.id, review: 'keep', note: '', at: '2026-11-02T00:00:00.000Z' };
    expect(ownerKept([a], new Map([[a.id, choice]])).map((d) => d.id)).toEqual([a.id]);
  });

  test('a choice that reverts to unreviewed takes a once-kept draft back out', () => {
    const a = draft('a', { review: 'keep', review_by: 'owner' });
    const choice: Choice = { id: a.id, review: 'unreviewed', note: '', at: '2026-11-02T00:00:00.000Z' };
    expect(ownerKept([a], new Map([[a.id, choice]]))).toEqual([]);
  });

  test('the result is sorted by name, numeric tiebreak, then id', () => {
    const z = draft('z-pic-2', { name: 'pic-2', review: 'keep', review_by: 'owner' });
    const o = draft('a-pic-10', { name: 'pic-10', review: 'keep', review_by: 'owner' });
    const t = draft('b-pic-1', { name: 'pic-1', review: 'keep', review_by: 'owner' });
    expect(ownerKept([z, o, t], new Map()).map((d) => d.name)).toEqual(['pic-1', 'pic-2', 'pic-10']);
  });
});

describe('snapToPalette', () => {
  test('a picture already made of palette colours is not moved', () => {
    const png = solid('#84c450', 2);
    const snapped = snapToPalette(png, ['#1b1a2e', '#84c450']);
    expect(snapped.meanDE).toBe(0);
    expect(snapped.maxDE).toBe(0);
    expect(snapped.changed).toBe(0);
    expect(snapped.colours).toBe(1);
  });

  test('a colour outside the palette moves to the nearest one and is counted', () => {
    const png = solid('#84c452', 2); // one step off a palette colour
    const snapped = snapToPalette(png, ['#1b1a2e', '#84c450']);
    expect(snapped.meanDE).toBeGreaterThan(0);
    expect(snapped.changed).toBe(4);
    expect(snapped.colours).toBe(1);
    expect(snapped.png.data[0]).toBe(0x84);
    expect(snapped.png.data[1]).toBe(0xc4);
    expect(snapped.png.data[2]).toBe(0x50);
  });

  test('a transparent pixel is left out of the distance and is not counted opaque', () => {
    const png = solid('#84c452', 2, 0);
    const snapped = snapToPalette(png, ['#1b1a2e', '#84c450']);
    expect(snapped.meanDE).toBe(0);
    expect(snapped.changed).toBe(0);
  });

  test('MAX_MEAN_DE is the kit check gate the task description quotes (6)', () => {
    expect(MAX_MEAN_DE).toBe(6);
  });
});

describe('onCanvas', () => {
  test('a picture smaller than the canvas is bottom-centred on a transparent field', () => {
    const png = solid('#84c450', 2);
    const out = onCanvas(png, 6, 6);
    expect(out.width).toBe(6);
    expect(out.height).toBe(6);
    // bottom-centred: (6-2)/2 = 2 columns in, the bottom two rows
    const at = (x: number, y: number): number => out.data[(y * 6 + x) * 4 + 3] as number;
    expect(at(2, 4)).toBe(255);
    expect(at(0, 4)).toBe(0);
    expect(at(2, 0)).toBe(0);
  });

  test('a picture larger than the canvas throws', () => {
    const png = solid('#84c450', 8);
    expect(() => onCanvas(png, 6, 6)).toThrow(/larger/);
  });
});

describe('sha256', () => {
  test('matches node crypto directly, hex, 64 characters', () => {
    const data = Buffer.from('a kept picture');
    const expected = createHash('sha256').update(data).digest('hex');
    const got = sha256(data);
    expect(got).toBe(expected);
    expect(got).toHaveLength(64);
  });
});

function record(over: Partial<CameraRecord> = {}): CameraRecord {
  return {
    id: '0123456789abcdef', name: 'pro-bush-1', verdict: 'pass', reason: 'stands flat on the grass, matches the human', still: '.scratch/still.png',
    picture: sha256(Buffer.from('x')), reduce: { colours: 16 }, at: '2026-11-02T00:00:00.000Z', by: 'builder', ...over,
  };
}

describe('recordProblem', () => {
  test('a well-formed record has no problem', () => {
    expect(recordProblem(record())).toBeNull();
  });

  test('an id that is not 16 hex digits is refused', () => {
    expect(recordProblem(record({ id: 'not-an-id' }))).toContain('id');
  });

  test('a verdict outside pass/fail is refused', () => {
    expect(recordProblem(record({ verdict: 'maybe' as CameraRecord['verdict'] }))).toContain('pass or fail');
  });

  test('a reason under MIN_REASON characters is refused', () => {
    expect(recordProblem(record({ reason: 'too short' }))).toContain('reason');
  });

  test('a missing still is refused', () => {
    expect(recordProblem(record({ still: '' }))).toContain('still');
  });

  test('a picture hash that is not 64 hex digits is refused', () => {
    expect(recordProblem(record({ picture: 'abc' }))).toContain('picture hash');
  });

  test('a missing "by" is refused', () => {
    expect(recordProblem(record({ by: '' }))).toContain('who looked');
  });
});

describe('parseCamera', () => {
  test('a valid line per draft is read, keyed by id', () => {
    const a = record({ id: '1111111111111111' });
    const b = record({ id: '2222222222222222' });
    const { records, skipped } = parseCamera(`${JSON.stringify(a)}\n${JSON.stringify(b)}\n`);
    expect(records.size).toBe(2);
    expect(skipped).toBe(0);
    expect(records.get(a.id)).toEqual(a);
  });

  test('a later line for the same id wins, torn JSON and an incomplete record are skipped and counted', () => {
    const a = record({ id: '1111111111111111', verdict: 'fail', reason: 'the angle looks wrong from here' });
    const again = record({ id: '1111111111111111', verdict: 'pass' });
    const text = `not json at all\n${JSON.stringify(a)}\n${JSON.stringify({ id: a.id })}\n${JSON.stringify(again)}\n`;
    const { records, skipped } = parseCamera(text);
    expect(records.size).toBe(1);
    expect(records.get(a.id)?.verdict).toBe('pass');
    expect(skipped).toBe(2);
  });

  test('blank lines are not counted as skipped', () => {
    expect(parseCamera('\n\n').skipped).toBe(0);
  });
});

describe('promoteRefusal', () => {
  const picture = sha256(Buffer.from('the exact reduction'));

  test('no record at all: refused, says to run the camera check', () => {
    expect(promoteRefusal(undefined, picture, true)).toContain('verdict');
  });

  test("the still the record names is gone: refused", () => {
    expect(promoteRefusal(record({ picture }), picture, false)).toContain('still');
  });

  test('the reduction on hand is not the one the verdict was about: refused', () => {
    expect(promoteRefusal(record({ picture: sha256(Buffer.from('a different reduction')) }), picture, true)).toContain('another reduction');
  });

  test('a failed verdict: refused, carries the reason', () => {
    expect(promoteRefusal(record({ picture, verdict: 'fail', reason: 'the angle does not match the human at all' }), picture, true)).toContain('failed');
  });

  test('a passing verdict on this exact reduction, with its still in place: allowed', () => {
    expect(promoteRefusal(record({ picture }), picture, true)).toBeNull();
  });
});

describe('stepOf', () => {
  const d = draft('pro-bush-1');

  test('nothing recorded yet: camera check', () => {
    expect(stepOf(d, { camera: new Map(), promoted: [], placed: new Set() }).step).toBe('camera check');
  });

  test('a failed verdict: fix, the reason carries what it waits for', () => {
    const camera = new Map([[d.id, record({ id: d.id, verdict: 'fail', reason: 'the angle is off from this side', waits: 'credits' })]]);
    const { step, why } = stepOf(d, { camera, promoted: [], placed: new Set() });
    expect(step).toBe('fix');
    expect(why).toContain('credits');
  });

  test('a passing verdict, not yet promoted: kit', () => {
    const camera = new Map([[d.id, record({ id: d.id })]]);
    expect(stepOf(d, { camera, promoted: [], placed: new Set() }).step).toBe('kit');
  });

  test('promoted into the kit, the map does not place it: map', () => {
    const promoted = [{ draft: d.id, sprite: 'props/bush' }];
    expect(stepOf(d, { camera: new Map(), promoted, placed: new Set() }).step).toBe('map');
  });

  test('promoted and placed: done', () => {
    const promoted = [{ draft: d.id, sprite: 'props/bush' }];
    expect(stepOf(d, { camera: new Map(), promoted, placed: new Set(['props/bush']) }).step).toBe('done');
  });
});

describe('queue', () => {
  test('a ready family is placed at the furthest-back step any of its pictures stand at', () => {
    const a = draft('pro-bush-1');
    const b = draft('pro-bush-2');
    const camera = new Map([[a.id, record({ id: a.id })]]); // a passed; b has no record at all
    const rows = queue({ kept: [a, b], camera, promoted: [], placed: new Set() });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.family).toBe('pro-bush');
    expect(rows[0]?.count).toBe(2);
    expect(rows[0]?.step).toBe('camera check');
    expect(rows[0]?.at).toEqual({ kit: 1, 'camera check': 1 });
  });

  test('a non-ready family carries its bucket as its step and why', () => {
    const a = draft('cat-warrior-1');
    const rows = queue({ kept: [a], camera: new Map(), promoted: [], placed: new Set() });
    expect(rows[0]?.bucket).toBe('advanced');
    expect(rows[0]?.step).toBe('advanced');
    expect(rows[0]?.why).toContain('advanced');
  });

  test('rows are ordered least-progressed first (the ones needing attention), then by name', () => {
    const done = draft('aaa-1');
    const stuck = draft('zzz-1');
    const promoted = [{ draft: done.id, sprite: 'props/aaa' }];
    const rows = queue({ kept: [stuck, done], camera: new Map(), promoted, placed: new Set(['props/aaa']) });
    expect(rows.map((r) => r.family)).toEqual(['zzz', 'aaa']);
  });
});

describe('queueText', () => {
  test('names the total, the family count and one line a family, padded', () => {
    const rows = queue({ kept: [draft('pro-bush-1')], camera: new Map(), promoted: [], placed: new Set() });
    const text = queueText(rows);
    expect(text).toContain('1 kept pictures in 1 families');
    expect(text).toContain('pro-bush');
    expect(text).toContain('camera check');
  });

  test('every STEPS word used by queue is accounted for in queueText\'s own step list', () => {
    expect(STEPS).toEqual(['camera check', 'fix', 'kit', 'map', 'done']);
  });
});
