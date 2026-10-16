/** A tended fire is a named map prop, and every tending or fire-lit reference points to one (G48). */
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { Bundle, QuestDef } from '@game/kernel';
import type { ParamsFile } from '@game/schema';
import { runCheck } from '../src/check';
import { CONTENT_DIR } from '../src/load';
import { checkPlay } from '../src/play';

type Prop = Bundle['map']['props'][number];

let base: Bundle;

beforeAll(() => {
  const found = runCheck().assembled.bundle;
  if (!found) throw new Error('Content did not assemble into a bundle.');
  base = found;
});

function prop(id: string | undefined, fields: Partial<Prop> = {}): Prop {
  return {
    ...(id === undefined ? {} : { id }),
    sprite: 'core/base-kit:props/standing_stone',
    x: 8,
    y: 8,
    w: 1,
    h: 1,
    solid: true,
    ...fields,
  };
}

function world(props: Prop[], step?: QuestDef['steps'][number]): Bundle {
  const b = structuredClone(base);
  b.map.props = [...b.map.props, ...props];
  if (step) {
    const source = Object.values(b.quests)[0]!;
    b.quests['test/tending'] = { ...source, id: 'test/tending', steps: [step] };
  }
  return b;
}

function messages(b: Bundle): string {
  return checkPlay(b, {}).map((issue) => issue.message).join('\n');
}

describe('fire rules', () => {
  it('accepts a named fire, its tending step and a prop lit by it', () => {
    const b = world(
      [prop('test/fire', { fire: true }), prop('test/sign', { lit_by: 'test/fire' })],
      { kind: 'tend', fire: 'test/fire' },
    );
    expect(checkPlay(b, {})).toEqual([]);
  });

  it('refuses a tending step that names a prop which is not a fire', () => {
    const text = messages(world([prop('test/stone')], { kind: 'tend', fire: 'test/stone' }));
    expect(text).toContain('"test/stone" is not a fire prop');
    expect(text).toContain('G48');
  });

  it('refuses a fire prop without an id', () => {
    expect(messages(world([prop(undefined, { fire: true })]))).toContain('a fire needs an id');
  });

  it('refuses lit_by when its id is not a fire', () => {
    expect(messages(world([prop('test/stone'), prop('test/sign', { lit_by: 'test/stone' })]))).toContain(
      '"test/stone" is not a fire prop',
    );
  });
});

describe('the fire params the check refuses (G48)', () => {
  const roots: string[] = [];
  afterAll(() => {
    for (const root of roots) rmSync(root, { recursive: true, force: true });
  });

  /** The errors on `params.fire` for a copy of the core world with this cap and burn per log. */
  function fireErrors(cap: number, logMs: number): string[] {
    const root = mkdtempSync(join(tmpdir(), 'openfold-fire-'));
    roots.push(root);
    cpSync(join(CONTENT_DIR, 'core'), join(root, 'core'), { recursive: true });
    cpSync(join(CONTENT_DIR, 'kit'), join(root, 'kit'), { recursive: true });
    const file = join(root, 'core', 'params.json');
    const data = JSON.parse(readFileSync(file, 'utf8')) as ParamsFile;
    data.params.fire.cap.value = cap;
    data.params.fire.log_ms.value = logMs;
    writeFileSync(file, JSON.stringify(data, null, 2));
    return runCheck(root)
      .issues.filter((i) => i.level === 'error' && i.where === 'params.fire')
      .map((i) => i.message);
  }

  it('keeps the shipped fire, whose warning opens long after a log fits', () => {
    expect(fireErrors(3, 100_000)).toEqual([]);
  });

  it('refuses a warning that opens before a log fits', () => {
    // two logs of 20000 ticks take another only in their last 20000; 30 game minutes are 25000
    expect(fireErrors(2, 20_000)).toEqual(['the fire would warn before it takes a log: keep warn_min within cap - 1 logs of burn (G48)']);
  });
});
