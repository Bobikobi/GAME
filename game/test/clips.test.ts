import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CLIP_VERBS, CLIP_VIEWS } from '@game/schema';
import type { ExtensionFile } from '@game/schema';
import { beforeAll, describe, expect, test } from 'vitest';
import { assemble } from '../../tools/src/assemble';
import { readBoard } from '../../tools/src/board';
import { withoutClips } from '../../tools/test/fixtures/clips/without-clips';
import { REPO_ROOT, loadAll } from '../../tools/src/load';
import { MAX_SHEET_PX, sheetGrid } from '@game/kernel';
import { ClipPlayer, VERB_OF_AUTO, bootSprites, clipFor, raceClips, clipFrame, verbOfOutcome, viewOf, type ClipSprites } from '../src/clips';
import type { Dir } from '../src/input';
import { spriteStyle } from '../src/ui/dom';

/**
 * #742 stage 1: the figure finds a clip by verb + race + view and plays it at the clip's own frame time. The fixture kit
 * (tools/test/fixtures/clips/kit.json, tests only, never content) has one sheet per verb and view for the human, with a
 * frame time of its own on each, and one for the elf. It goes through the real schema and the real assembler.
 */
const FIXTURE = join(REPO_ROOT, 'tools', 'test', 'fixtures', 'clips', 'kit.json');
const HUMAN = 'core/human';
const KIT = 'core/clip-fixture';
/** The facing that draws each view: left is the sheet itself, front is facing down, back is facing up. */
const FACING: Record<(typeof CLIP_VIEWS)[number], Dir> = { left: 'left', front: 'down', back: 'up' };

let sprites: ClipSprites;
let fixture: { sprites: Record<string, { clip: { verb: string; view: string; race: string; frame_ms: number; anchor: [number, number] }; frames: number }> };

beforeAll(() => {
  const data = JSON.parse(readFileSync(FIXTURE, 'utf8')) as ExtensionFile & { kit: typeof fixture };
  fixture = data.kit;
  const a = assemble([...withoutClips(loadAll().files), { rel: 'kit/core/clip-fixture.json', abs: FIXTURE, data }], readBoard());
  expect(a.issues.filter((i) => i.level === 'error')).toEqual([]);
  sprites = a.bundle!.sprites as ClipSprites;
});

describe('B2: a clip is found by verb, race and view', () => {
  test('all 9 verbs x 3 views are 27 lookups, each returning that sheet and its own frame time', () => {
    expect(CLIP_VERBS).toHaveLength(9);
    expect(CLIP_VIEWS).toHaveLength(3);
    let looked = 0;
    const times = new Set<number>();
    for (const verb of CLIP_VERBS) {
      for (const view of CLIP_VIEWS) {
        const name = `chars/human_${verb}_${view}`;
        const found = clipFor(sprites, verb, HUMAN, FACING[view]);
        expect(found, `${verb} ${view}`).toBeDefined();
        expect(found!.key).toBe(`${KIT}:${name}`);
        expect(found!.frame_ms).toBe(fixture.sprites[name]!.clip.frame_ms);
        expect(found!.frames).toBe(fixture.sprites[name]!.frames);
        expect(found!.anchor).toEqual(fixture.sprites[name]!.clip.anchor);
        expect(found!.flip).toBe(false);
        times.add(found!.frame_ms);
        looked += 1;
      }
    }
    expect(looked).toBe(27);
    // every sheet is told apart by its own time: a lookup that ignored the verb or the view would show up as a repeat
    expect(times.size).toBe(27);
  });

  test('the clip\'s display fit (permille) rides through the schema and the assembler to the bundle, and a clip with none has none', () => {
    expect(sprites['core/clip-fixture:chars/human_strike_left']?.clip?.fit_permille).toBe(700);
    expect(sprites['core/clip-fixture:chars/human_strike_front']?.clip?.fit_permille).toBeUndefined();
  });

  test('the right side is the left sheet, flipped', () => {
    for (const verb of CLIP_VERBS) {
      const right = clipFor(sprites, verb, HUMAN, 'right')!;
      const left = clipFor(sprites, verb, HUMAN, 'left')!;
      expect(right.key).toBe(left.key);
      expect(right.flip).toBe(true);
      expect(viewOf('right')).toEqual({ view: 'left', flip: true });
    }
  });

  test('the race is part of the lookup, and a clip that is not in the kit is the fallback', () => {
    // the elf has only a dig, in the front view
    expect(clipFor(sprites, 'dig', 'core/elf', 'down')?.frame_ms).toBe(333);
    expect(clipFor(sprites, 'dig', 'core/elf', 'left')).toBeUndefined();
    expect(clipFor(sprites, 'strike', 'core/elf', 'down')).toBeUndefined();
    expect(clipFor(sprites, 'strike', 'core/skeleton', 'down')).toBeUndefined();
    // one sheet taken out: that lookup alone falls back (a new table is a new index)
    const key = `${KIT}:chars/human_guard_back`;
    const without = Object.fromEntries(Object.entries(sprites).filter(([k]) => k !== key));
    expect(clipFor(without, 'guard', HUMAN, 'up')).toBeUndefined();
    expect(clipFor(without, 'guard', HUMAN, 'down')).toBeDefined();
    expect(clipFor(without, 'strike', HUMAN, 'up')).toBeDefined();
  });

  test('a kit with no clip sheets has nothing for any verb, race or facing (B1)', () => {
    const plain = assemble(withoutClips(loadAll().files), readBoard()).bundle!.sprites as ClipSprites;
    expect(Object.values(plain).some((s) => s.clip)).toBe(false);
    for (const race of ['core/human', 'core/elf', 'core/skeleton']) {
      for (const verb of CLIP_VERBS) for (const dir of ['left', 'right', 'up', 'down'] as const) expect(clipFor(plain, verb, race, dir)).toBeUndefined();
    }
  });
});

describe('the frame rule: one for every verb, the clip\'s own time', () => {
  test('a clip plays frame by frame at its own frame time', () => {
    const at = (ms: number) => clipFrame(ms, 4, 140);
    expect([0, 139, 140, 279, 280, 419].map(at)).toEqual([0, 0, 1, 1, 2, 2]);
    expect(at(420)).toBe(3);
    expect(at(559)).toBe(3);
  });

  test('changing one clip\'s frame time changes that clip only', () => {
    // the same moment, two clips: doubling the first's time halves how far it has got, the second does not move
    expect(clipFrame(560, 8, 140)).toBe(4);
    expect(clipFrame(560, 8, 280)).toBe(2);
    expect(clipFrame(560, 8, 100)).toBe(5);
  });

  test('an action with no length plays the clip once, then it is over', () => {
    expect(clipFrame(419, 4, 140)).toBe(2);
    expect(clipFrame(559, 4, 140)).toBe(3);
    expect(clipFrame(560, 4, 140)).toBeUndefined();
  });

  test('an action with a length loops the clip and is cut where the action ends: the clip never sets the length', () => {
    const lasts = 1000;
    // a clip of 4 x 140 = 560 ms is shorter than the action: it repeats
    expect(clipFrame(560, 4, 140, lasts)).toBe(0);
    expect(clipFrame(700, 4, 140, lasts)).toBe(1);
    // a clip of 16 x 140 = 2240 ms is longer than the action: it is cut at 1000 ms, mid-clip
    expect(clipFrame(999, 16, 140, lasts)).toBe(7);
    expect(clipFrame(1000, 16, 140, lasts)).toBeUndefined();
  });

  test('a clip with no frames or no time shows nothing rather than looping on nothing', () => {
    expect(clipFrame(0, 0, 100)).toBeUndefined();
    expect(clipFrame(0, 4, 0)).toBeUndefined();
    expect(clipFrame(-1, 4, 100)).toBeUndefined();
  });

  test('the player runs a clip from its start, restarts on a new one, and is over when the rule says', () => {
    const found = clipFor(sprites, 'dig', HUMAN, 'down')!;
    const player = new ClipPlayer();
    expect(player.frameAt(0)).toBeUndefined();
    player.start(found, 1000);
    expect(player.active).toBe(true);
    expect(player.frameAt(1000)?.frame).toBe(0);
    expect(player.frameAt(1000 + found.frame_ms)?.frame).toBe(1);
    expect(player.frameAt(1000 + found.frame_ms * found.frames - 1)?.frame).toBe(found.frames - 1);
    expect(player.frameAt(1000 + found.frame_ms * found.frames)).toBeUndefined();
    expect(player.active).toBe(false);
    player.start(found, 5000, 2000);
    expect(player.frameAt(5000 + found.frame_ms * found.frames)?.frame).toBe(0);
    expect(player.frameAt(7000)).toBeUndefined();
    player.start(found, 0);
    player.stop();
    expect(player.frameAt(10)).toBeUndefined();
  });
});

describe('which verb answers what', () => {
  const side = (striker: 'player' | 'foe', struck: 'player' | 'foe', kind: 'attack' | 'critical' | 'miss' | 'guard' | 'dodge') => ({ kind, striker: { side: striker }, struck: { side: struck } });

  test('the fight\'s outcomes (kernel/src/events.ts) give the player strike, hit, guard or dodge', () => {
    expect(verbOfOutcome(side('player', 'foe', 'attack'))).toBe('strike');
    expect(verbOfOutcome(side('player', 'foe', 'critical'))).toBe('strike');
    expect(verbOfOutcome(side('player', 'foe', 'miss'))).toBe('strike');
    expect(verbOfOutcome(side('foe', 'player', 'attack'))).toBe('hit');
    expect(verbOfOutcome(side('foe', 'player', 'critical'))).toBe('hit');
    expect(verbOfOutcome(side('foe', 'player', 'guard'))).toBe('guard');
    expect(verbOfOutcome(side('foe', 'player', 'dodge'))).toBe('dodge');
    // a blow that missed the player asks nothing of him, and a fight between foes is not his figure's
    expect(verbOfOutcome(side('foe', 'player', 'miss'))).toBeUndefined();
    expect(verbOfOutcome(side('foe', 'foe', 'attack'))).toBeUndefined();
  });

  test('every work kind the game has names a verb the kit may hold, and the five work verbs are all reachable', () => {
    const verbs = new Set<string>(CLIP_VERBS);
    for (const v of Object.values(VERB_OF_AUTO)) expect(verbs.has(v)).toBe(true);
    expect(new Set(Object.values(VERB_OF_AUTO))).toEqual(new Set(['fell', 'quarry', 'fish', 'pickup', 'dig']));
    expect(Object.keys(VERB_OF_AUTO).sort()).toEqual(['dig', 'fell', 'fish', 'mine', 'pick']);
  });
});

/**
 * #742 stage 2: the kit the game ships holds the approved clips. Every race, view and verb of the 15.11 set resolves to its
 * packed sheet, in both facings of the left view; the one parked cell (the human's fish from behind) resolves to nothing, so the
 * engine falls back as before.
 */
describe('the packed kit', () => {
  const RACES = ['core/human', 'core/elf', 'core/skeleton'];
  const VERBS = ['strike', 'guard', 'dodge', 'hit', 'fell', 'quarry', 'fish', 'pickup'] as const;
  const PARKED = 'core/human|fish|back';
  let real: ClipSprites;

  beforeAll(() => {
    const a = assemble(loadAll().files, readBoard());
    expect(a.issues.filter((i) => i.level === 'error')).toEqual([]);
    real = a.bundle!.sprites as ClipSprites;
  });

  test('71 sheets: each (race, view, verb) finds its own sheet, with a frame time, a feet anchor and a display fit', () => {
    let found = 0;
    for (const race of RACES) {
      for (const view of CLIP_VIEWS) {
        for (const verb of VERBS) {
          const hit = clipFor(real, verb, race, FACING[view]);
          if (`${race}|${verb}|${view}` === PARKED) {
            expect(hit, PARKED).toBeUndefined();
            continue;
          }
          expect(hit, `${race} ${verb} ${view}`).toBeDefined();
          expect(hit!.key).toBe(`core/base-kit:chars/${race.slice(5)}_${verb}_${view}`);
          const sprite = real[hit!.key]!;
          // a take plays about a second whatever its frame count (the 45-frame ones show each frame 14 to 33 ms, the older 9 to 16 frame ones about 100)
          expect(sprite.clip!.frame_ms).toBeGreaterThanOrEqual(10);
          expect(sprite.clip!.frame_ms).toBeLessThanOrEqual(130);
          expect(sprite.frames * sprite.clip!.frame_ms, hit!.key).toBeGreaterThanOrEqual(700);
          expect(sprite.frames * sprite.clip!.frame_ms, hit!.key).toBeLessThanOrEqual(1500);
          // no sheet is wider or taller than 4096 px, which practically every phone's graphics card takes (WebGL 2 only guarantees 2048)
          const grid = sheetGrid(sprite);
          expect(Math.max(grid.width, grid.height), hit!.key).toBeLessThanOrEqual(MAX_SHEET_PX);
          expect(sprite.clip!.fit_permille, hit!.key).toBeGreaterThan(0);
          expect(hit!.anchor[1]).toBeGreaterThan(0);
          found++;
        }
      }
    }
    expect(found).toBe(71);
    expect(Object.values(real).filter((s) => s.clip && RACES.includes(s.clip.race) && (VERBS as readonly string[]).includes(s.clip.verb))).toHaveLength(71);
  });

  test('the boot loads no clip sheet; a race\'s clips are the 23 or 24 sheets of that race and nothing of another', () => {
    const boot = bootSprites(real);
    expect(boot.some(([, s]) => s.clip !== undefined)).toBe(false);
    expect(boot.length + Object.values(real).filter((s) => s.clip).length).toBe(Object.keys(real).length);
    let all = 0;
    for (const race of RACES) {
      const own = raceClips(real, race);
      expect(own.every(([, s]) => s.clip!.race === race), race).toBe(true);
      expect(own.length, race).toBeGreaterThanOrEqual(23);
      all += own.length;
    }
    expect(all).toBe(71);
    expect(raceClips(real, 'core/dragon')).toEqual([]);
  });

  test('facing right plays the left sheet flipped', () => {
    const left = clipFor(real, 'fell', 'core/elf', 'left')!;
    const right = clipFor(real, 'fell', 'core/elf', 'right')!;
    expect(right.key).toBe(left.key);
    expect([left.flip, right.flip]).toEqual([false, true]);
  });
});

describe('a wrapped sheet in the interface: the sprite element shows the cell the kernel names', () => {
  const info = { url: 'x.png', w: 128, h: 128, frames: 45, cols: 16, density: 4 };
  test('frame 0 is the top left, frame 17 the second row\'s second cell, the background is the whole 2048 x 384 picture at scale', () => {
    expect(spriteStyle(info, 2, 0)).toBe('width:64px;height:64px;background-image:url("x.png");background-size:1024px 192px;background-position:0px 0px');
    expect(spriteStyle(info, 2, 17)).toBe('width:64px;height:64px;background-image:url("x.png");background-size:1024px 192px;background-position:-64px -64px');
    expect(spriteStyle(info, 2, 44)).toContain('background-position:-768px -128px'); // 44 = row 2, column 12
  });
  test('a one-row sheet reads as it always did', () => {
    const one = { url: 'y.png', w: 16, h: 16, frames: 4, density: 1 };
    expect(spriteStyle(one, 2, 3)).toBe('width:32px;height:32px;background-image:url("y.png");background-size:128px 32px;background-position:-96px 0px');
  });
});
