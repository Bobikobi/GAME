/**
 * The play rules (docs/design/GAME_RULES.md section 8) on the real content:
 * the breaches the owner found on 2026-10-07 are reported, the opening chain
 * and the camps that change play are not, and nothing is an error yet.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import type { Bundle } from '@game/kernel';
import { runCheck } from '../src/check';
import { OPENING_QUESTS, PLAY_LEVEL, RULES_PAGE, checkPlay } from '../src/play';

let bundle: Bundle;
let origin: Record<string, string>;
let issues: ReturnType<typeof checkPlay>;
let all: ReturnType<typeof runCheck>['issues'];

beforeAll(() => {
  const r = runCheck();
  if (!r.assembled.bundle) throw new Error('Content did not assemble into a bundle.');
  bundle = r.assembled.bundle;
  origin = r.assembled.origin;
  all = r.issues;
  issues = checkPlay(bundle, origin);
});

const about = (id: string) => issues.filter((i) => i.file === origin[id]);
const cites = (id: string, rule: string) => about(id).some((i) => i.message.includes(`${RULES_PAGE} ${rule},`));

describe('play rules', () => {
  it('names the breaches found on 2026-10-07', () => {
    expect(cites('core/collection-shelf', 'G10')).toBe(true);
    expect(cites('core/three-fruits', 'G2')).toBe(true);
    expect(cites('core/herbs-for-pell', 'G2')).toBe(true);
    expect(cites('core/herbs-for-pell', 'G4')).toBe(true);
    expect(issues.some((i) => i.where === 'map.props' && i.message.includes(`${RULES_PAGE} G8,`))).toBe(true);
  });

  it('lets the opening chain teach a verb by repetition', () => {
    for (const id of OPENING_QUESTS) expect(about(id)).toEqual([]);
  });

  it('counts a dig-only item with a hint as a find (G2), and still wants a reward that changes play (G4)', () => {
    expect(cites('core/a-coin-for-maru', 'G2')).toBe(false);
    expect(cites('core/a-coin-for-maru', 'G4')).toBe(true);
  });

  it('accepts a camp that gives a station or capacity', () => {
    expect(about('core/campfire')).toEqual([]);
    expect(about('core/storage-chest')).toEqual([]);
  });

  it('cites the rules page on every line and warns until P-3', () => {
    expect(issues.length).toBeGreaterThan(0);
    for (const i of issues) {
      expect(i.message).toContain(`${RULES_PAGE} G`);
      expect(i.level).toBe(PLAY_LEVEL);
    }
    expect(PLAY_LEVEL).toBe('warning');
  });

  it('is silent about the shelf once it provides a station', () => {
    const shelf = bundle.camps['core/collection-shelf'];
    if (!shelf) throw new Error('core/collection-shelf is not in the bundle');
    const fixed: Bundle = { ...bundle, camps: { ...bundle.camps, 'core/collection-shelf': { ...shelf, provides: 'fire' as const } } };
    expect(checkPlay(fixed, origin).filter((i) => i.where === 'camp' && i.file === origin['core/collection-shelf'])).toEqual([]);
  });

  it('counts the long first meeting and the long boxes per character (G14, G21)', () => {
    expect(cites('core/elder', 'G21')).toBe(true);
    expect(cites('core/elder', 'G14')).toBe(true);
    expect(cites('core/trader', 'G21')).toBe(true);
    expect(about('core/elder').filter((i) => i.where === 'npc.dialogue')).toHaveLength(2);
  });

  it('is silent about a character who talks within the limits', () => {
    const elder = bundle.npcs['core/elder'];
    if (!elder) throw new Error('core/elder is not in the bundle');
    const quiet = { ...elder, dialogue: { stranger: ['Stay near the fire after dark.'], first: ['I am Maru.', 'You mended the bridge. That is how it starts.'] }, topics: undefined };
    const fixed: Bundle = { ...bundle, npcs: { ...bundle.npcs, 'core/elder': quiet } };
    expect(checkPlay(fixed, origin).filter((i) => i.where === 'npc.dialogue' && i.file === origin['core/elder'])).toEqual([]);
  });

  it('reaches pnpm check', () => {
    expect(all.some((i) => i.message.includes('G10, "menu in disguise"'))).toBe(true);
    expect(all.filter((i) => i.level === 'error')).toEqual([]);
  });
});
