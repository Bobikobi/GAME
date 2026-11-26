/**
 * A slot clash names the places that are still free (#732): when two extensions
 * name one slot, `pnpm check` says which slots of the same kind are still free,
 * or that none is and that a "Request for the valley" issue is the way to ask
 * for one. A newcomer who copied the fruit template meets this error first, and
 * the old message left them with no next step.
 */
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { runCheck } from '../src/check';
import { CONTENT_DIR } from '../src/load';

const roots: string[] = [];
afterAll(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

/** A copy of the core world, plus the files of the creator "tester". */
function world(files: Record<string, object>): { root: string; messages: string[] } {
  const root = mkdtempSync(join(tmpdir(), 'loomvale-clash-'));
  roots.push(root);
  cpSync(join(CONTENT_DIR, 'core'), join(root, 'core'), { recursive: true });
  cpSync(join(CONTENT_DIR, 'kit'), join(root, 'kit'), { recursive: true });
  for (const [rel, data] of Object.entries(files)) {
    const abs = join(root, 'extensions', 'tester', rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, JSON.stringify(data, null, 2));
  }
  const messages = runCheck(root)
    .issues.filter((i) => i.level === 'error' && i.message.includes('is taken by more than one extension'))
    .map((i) => i.message);
  return { root, messages };
}

const envelope = (type: string, name: string) => ({ format: 1, type, id: `tester/${name}`, title: name, creator: 'tester' });

/** The fruit template: a resource whose node sits in one slot. */
const fruit = (name: string, slot: string) => ({
  ...envelope('resource', name),
  items: [
    {
      id: `tester/${name}`,
      name: `${name} fruit`,
      kind: 'food',
      rarity: 'common',
      class: 'plant',
      tier: 1,
      sprite: 'core/base-kit:items/herb',
      weight: 1,
      food: { satiety: 4 },
    },
  ],
  node: {
    output: `tester/${name}`,
    yield: 2,
    active_ms: 3000,
    respawn_ms: 90000,
    count: 3,
    sprite: 'core/base-kit:props/bush_berry',
    level: 1,
    place: { slot },
  },
});

/** A mended place: it fills a "restore" or "building" slot. */
const mending = (name: string, slot: string) => ({
  ...envelope('restore', name),
  restore: {
    place: { slot },
    before: 'core/base-kit:tiles/bridge_broken',
    after: 'core/base-kit:tiles/bridge',
    inputs: [],
    active_ms: 4000,
    passable: true,
  },
});

/** An npc that stands in one slot. */
const villager = (name: string, slot: string) => ({
  ...envelope('npc', name),
  npc: {
    name,
    sprite: 'core/base-kit:chars/elder',
    place: { slot },
    dialogue: { stranger: ['Hello.'] },
  },
});

describe('a slot clash names what is still free', () => {
  it('lists the free slots of the same kind when some are free', () => {
    const { messages } = world({
      // two extensions name the one building slot, the other stays free
      'restores/one.json': mending('one', 'core/town-edge'),
      'restores/two.json': mending('two', 'core/town-edge'),
    });
    expect(messages).toContainEqual('slot "core/town-edge" is taken by more than one extension: tester/one, tester/two; free building slots: core/workshop-stall');
  });

  it('says none is free and names the Request for the valley issue when every slot of the kind is taken', () => {
    const { messages } = world({
      // two newcomers copy the fruit template onto the same slot; the core's scatter takes every other resource slot
      'resources/one.json': fruit('one', 'core/west-glade'),
      'resources/two.json': fruit('two', 'core/west-glade'),
    });
    expect(messages).toContainEqual(
      'slot "core/west-glade" is taken by more than one extension: tester/one, tester/two; no resource slot is free: open a "Request for the valley" issue to ask for one',
    );
  });
});

describe('a reserved slot is taken, not free', () => {
  it('refuses an extension that names a reserved slot and says why', () => {
    const root = mkdtempSync(join(tmpdir(), 'loomvale-reserved-'));
    roots.push(root);
    cpSync(join(CONTENT_DIR, 'core'), join(root, 'core'), { recursive: true });
    cpSync(join(CONTENT_DIR, 'kit'), join(root, 'kit'), { recursive: true });
    const abs = join(root, 'extensions', 'tester', 'npcs', 'one.json');
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, JSON.stringify(villager('one', 'core/grove-clearing'), null, 2));
    const messages = runCheck(root)
      .issues.filter((i) => i.level === 'error')
      .map((i) => i.message);
    expect(messages).toContain(
      '"core/grove-clearing" is reserved: The grove clearing is the traveller\'s ember camp (decision 35 of 22.10)',
    );
  });
});
