/**
 * Wood and the first starts (DECISIONS.md, 2026-10-10): the core content passes
 * with no line, and a fixture that breaks each rule gets an error that names it.
 */
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { runCheck } from '../src/check';
import { CONTENT_DIR } from '../src/load';

describe('the core content', () => {
  it('passes with no line: trees give the wood, every start holds an axe, Pell sells another', () => {
    const result = runCheck();
    expect(result.issues).toEqual([]);
    const b = result.assembled.bundle!;
    expect(b.resources['core/oak-trees']!.tool).toBe('axe');
    expect(Object.values(b.starters).every((s) => (s.kit ?? []).some((k) => b.items[k.item]?.tool?.kind === 'axe'))).toBe(true);
  });
});

describe('a fixture that breaks each rule', () => {
  const root = mkdtempSync(join(tmpdir(), 'openfold-starts-'));
  afterAll(() => rmSync(root, { recursive: true, force: true }));
  cpSync(join(CONTENT_DIR, 'core'), join(root, 'core'), { recursive: true });
  cpSync(join(CONTENT_DIR, 'kit'), join(root, 'kit'), { recursive: true });

  const edit = (file: string, change: (json: Record<string, Record<string, unknown>>) => void) => {
    const path = join(root, 'core', file);
    const json = JSON.parse(readFileSync(path, 'utf8'));
    change(json);
    writeFileSync(path, JSON.stringify(json, null, 2));
  };
  // a start with no axe, no shop that sells one, and a fire that asks for more logs than the valley's trees give
  edit('starters/forager.json', (j) => {
    delete j.starter!.kit;
  });
  edit('shops/trader-shop.json', (j) => {
    j.shop!.sells = (j.shop!.sells as { item: string }[]).filter((o) => o.item !== 'core/axe');
  });
  edit('camp/campfire.json', (j) => {
    j.camp!.inputs = [{ item: 'core/log', qty: 99 }];
  });
  // twigs from the ground: wood with no axe
  const ext = join(root, 'extensions', 'tester', 'resources');
  mkdirSync(ext, { recursive: true });
  writeFileSync(
    join(ext, 'twigs.json'),
    JSON.stringify({
      format: 1,
      type: 'resource',
      id: 'tester/twigs',
      title: 'Twigs',
      creator: 'tester',
      node: {
        output: 'core/branch',
        yield: 2,
        active_ms: 3000,
        respawn_ms: 40000,
        count: 2,
        sprite: 'core/base-kit:props/fallen_branches',
        level: 1,
        place: { slot: 'core/west-glade' },
      },
    }),
  );

  const result = runCheck(root);
  const text = (needle: string) => result.issues.filter((i) => i.message.includes(needle));

  it('wood from a node that needs no axe', () => {
    const lines = text('wood comes only from felling a tree');
    expect(lines).toHaveLength(1);
    expect(lines[0]!.where).toBe('node.tool');
    expect(lines[0]!.file).toContain('twigs.json');
  });

  it('a start with no axe in its kit', () => {
    const lines = text('this start holds no axe');
    expect(lines).toHaveLength(1);
    expect(lines[0]!.file).toContain('forager.json');
  });

  it('a tree and no shop that sells an axe', () => {
    expect(text('no shop sells one')).toHaveLength(1);
  });

  it('an opening that asks for more logs than the trees give', () => {
    const lines = text('the opening asks for 99 of core/log');
    expect(lines).toHaveLength(1);
    expect(lines[0]!.message).toContain('give 12');
  });
});
