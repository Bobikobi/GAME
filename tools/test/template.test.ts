/**
 * The creator template must pass the check as it is, so "add a fruit in 10
 * minutes" starts from something that works.
 */
import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { appearSlots } from '@game/kernel';
import { runCheck } from '../src/check';
import { CONTENT_DIR, REPO_ROOT } from '../src/load';

describe('templates/extension', () => {
  const root = mkdtempSync(join(tmpdir(), 'loomvale-template-'));
  afterAll(() => rmSync(root, { recursive: true, force: true }));

  cpSync(join(CONTENT_DIR, 'core'), join(root, 'core'), { recursive: true });
  cpSync(join(CONTENT_DIR, 'kit'), join(root, 'kit'), { recursive: true });
  cpSync(join(REPO_ROOT, 'templates', 'extension'), join(root, 'extensions', 'your-handle'), {
    recursive: true,
    filter: (src) => !src.endsWith('.md'),
  });
  const result = runCheck(root);

  it('passes the check unchanged', () => {
    expect(result.issues.filter((i) => i.level === 'error')).toEqual([]);
  });

  it('grows its fruit in the empty glade, credited to the creator', () => {
    const b = result.assembled.bundle!;
    expect(b.items['your-handle/plum']?.creator).toBe('your-handle');
    const nodes = Object.values(b.instances).filter((i) => i.source === 'your-handle/wild-plums');
    expect(nodes).toHaveLength(4);
    const glade = b.map.slots.find((s) => s.id === 'core/west-glade')!;
    for (const n of nodes) {
      expect(n.x >= glade.x && n.x < glade.x + glade.w && n.y >= glade.y && n.y < glade.y + glade.h).toBe(true);
    }
    expect(b.values['your-handle/plum']).toBeGreaterThan(0);
  });

  it('drops a windfall plum below each bush left full, a reaction of its own', () => {
    const b = result.assembled.bundle!;
    const slots = [...appearSlots(b).values()].filter((s) => s.reaction.id === 'your-handle/windfall-plums');
    expect(slots).toHaveLength(4);
    for (const s of slots) expect([s.x, s.y]).toEqual([s.parent.x, s.parent.y + 1]);
  });
});
