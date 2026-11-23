import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { GameEvent } from '@game/kernel';
import { FightWordLayer } from '../src/fight-word-layer';
import {
  ART_PER_TILE, EFFECTS, EFFECT_IDS, LAY, cellOf, frameAt, landingDust, lifeMs, originOf, sheetSize, sizeInTiles, spawnsOf,
} from '../src/effects';

const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');

/** A PNG's width and height from its header. */
function pngSize(file: string): [number, number] {
  const b = readFileSync(join(PUBLIC, file));
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}

const hit = (side: 'player' | 'foe', kind: 'attack' | 'critical', at: [number, number]): GameEvent => ({
  e: 'hit', player: 'p', by: side, harm: 3, kind, number: 3, at, move: 'attack',
  striker: { side, id: side === 'player' ? 'p' : 'wolf' }, struck: { side: side === 'player' ? 'foe' : 'player', id: side === 'player' ? 'wolf' : 'p' },
}) as GameEvent;

describe('the effects sheets (the pack\'s manifests held to the files)', () => {
  it.each(EFFECT_IDS)('%s: the sheet is exactly its frames laid %s to a row', (id) => {
    const def = EFFECTS[id];
    expect(pngSize(def.url)).toEqual(sheetSize(def));
  });

  it('the last frame lies inside the sheet, the next one would not', () => {
    for (const id of EFFECT_IDS) {
      const def = EFFECTS[id];
      const [, rows] = [0, Math.ceil(def.frames / def.cols)];
      expect(cellOf(def, def.frames - 1)[1]).toBeLessThan(rows);
    }
  });

  it('every pivot lies inside its frame', () => {
    for (const id of EFFECT_IDS) {
      const def = EFFECTS[id];
      const [ox, oy] = originOf(def);
      expect(ox).toBeGreaterThan(0);
      expect(ox).toBeLessThan(1);
      expect(oy).toBeGreaterThan(0);
      expect(oy).toBeLessThan(1);
    }
  });
});

describe('an effect plays once and clears, or loops', () => {
  it.each(['hit-spark', 'crit-hit', 'landing-dust'] as const)('%s: frame 0 at the start, every frame in order, then nothing', (id) => {
    const def = EFFECTS[id];
    expect(frameAt(def, 0)).toBe(0);
    const seen: number[] = [];
    for (let t = 0; t < lifeMs(def); t += def.ms) seen.push(frameAt(def, t)!);
    expect(seen).toEqual(Array.from({ length: def.frames }, (_, i) => i));
    expect(frameAt(def, lifeMs(def))).toBeNull();
    expect(frameAt(def, lifeMs(def) + 5000)).toBeNull();
  });

  it('nothing shows before it begins', () => {
    expect(frameAt(EFFECTS['hit-spark'], -1)).toBeNull();
  });

  it('the camp fire never clears: it wraps to its first frame', () => {
    const def = EFFECTS.campfire;
    expect(frameAt(def, lifeMs(def))).toBe(0);
    expect(frameAt(def, lifeMs(def) * 40 + def.ms * 3)).toBe(3);
  });

  it('a one-shot is over within a second', () => {
    for (const id of ['hit-spark', 'crit-hit', 'landing-dust'] as const) expect(lifeMs(EFFECTS[id])).toBeLessThan(1000);
  });
});

describe('the size beside the figure (64 art pixels a tile; a figure is 1.5 tiles tall, a wolf 1.3 long)', () => {
  it('names each effect in tiles', () => {
    expect(ART_PER_TILE).toBe(64);
    expect(sizeInTiles(EFFECTS['hit-spark'])).toEqual([1, 1]);
    expect(sizeInTiles(EFFECTS['crit-hit'])).toEqual([1.5, 1.25]);
    expect(sizeInTiles(EFFECTS['landing-dust'])).toEqual([1.375, 0.71875]);
    expect(sizeInTiles(EFFECTS.campfire)).toEqual([0.625, 0.875]);
  });

  it('no frame of a one-shot is taller than the figure (1.5 tiles)', () => {
    for (const id of ['hit-spark', 'crit-hit', 'landing-dust'] as const) expect(sizeInTiles(EFFECTS[id])[1]).toBeLessThanOrEqual(1.5);
  });

  it('every effect is laid on its tile: the blows at chest height, the dust on the ground, the fire on its hearth', () => {
    expect(LAY['hit-spark'][1]).toBeLessThan(LAY['landing-dust'][1]);
    expect(LAY.campfire).toEqual([0.5, 1]);
  });
});

describe('which event starts which effect', () => {
  const at: [number, number] = [4, 5];
  const me: [number, number] = [3, 5];

  it('a hit of the player sparks on the foe\'s tile; a critical one bursts', () => {
    expect(spawnsOf([hit('player', 'attack', at)], me)).toEqual([{ id: 'hit-spark', tile: at }]);
    expect(spawnsOf([hit('player', 'critical', at)], me)).toEqual([{ id: 'crit-hit', tile: at }]);
  });

  it('a foe\'s hit is a bite on the player\'s tile', () => {
    expect(spawnsOf([hit('foe', 'attack', me)], me)).toEqual([{ id: 'crit-hit', tile: me }]);
  });

  it('the chase\'s bite (a predator\'s hurt) bursts on the player; a pit or hunger does not', () => {
    expect(spawnsOf([{ e: 'hurt', by: 'predator', id: 'wolf', hp: 80 }], me)).toEqual([{ id: 'crit-hit', tile: me }]);
    expect(spawnsOf([{ e: 'hurt', by: 'fall', hp: 80 }, { e: 'hurt', by: 'hunger', hp: 70 }], me)).toEqual([]);
  });

  it('a fight\'s bite and the chase\'s bite in one batch on one tile show once', () => {
    const batch = [hit('foe', 'attack', me), { e: 'hurt', by: 'predator', id: 'wolf', hp: 80 } as GameEvent];
    expect(spawnsOf(batch, me)).toHaveLength(1);
  });

  it('misses, guards and dodges skip the spark and show a word over the recipient', () => {
    const striker = { side: 'player', id: 'p' } as const;
    const struck = { side: 'foe', id: 'wolf' } as const;
    const events: GameEvent[] = [
      { e: 'fight_miss', kind: 'miss', number: 0, at, move: 'attack', striker, struck },
      { e: 'fight_guard', kind: 'guard', number: 0, at: me, move: 'bite', striker: struck, struck: striker },
      { e: 'fight_dodge', kind: 'dodge', number: 0, at: me, move: 'bite', striker: struck, struck: striker },
    ];
    expect(spawnsOf(events, me)).toEqual([]);

    const labels: HTMLElement[] = [];
    const host = { ownerDocument: { createElement: () => ({ style: {} }) }, append: (el: HTMLElement) => labels.push(el) } as unknown as HTMLElement;
    const words = new FightWordLayer(host, ({ struck: target }, point) => {
      point.x = target.id === 'wolf' ? 100 : 200;
      point.y = 80;
      return true;
    });
    words.play([...events, { e: 'hurt', by: 'predator', id: 'wolf', hp: 80 }], 1000);
    words.update(1000, false);
    expect(labels.map((el) => [el.textContent, el.style.transform, el.hidden])).toEqual([
      ['MISS', 'translate(100px, 76px) scale(1)', false],
      ['BLOCK 0', 'translate(200px, 52px) scale(1)', false],
      ['DODGE', 'translate(200px, 76px) scale(1)', false],
    ]);
    words.update(1600, false);
    expect(words.active).toBe(false);
    expect(labels.every((el) => el.hidden)).toBe(true);

    words.play([hit('player', 'critical', at)], 1600);
    words.update(1900, true);
    expect(labels).toHaveLength(3);
    expect(labels.find((el) => !el.hidden)).toMatchObject({
      textContent: 'CRIT 3', style: { transform: 'translate(100px, 76px) scale(1.25)', opacity: '1' },
    });
  });

  it('two blows of the player show two sparks, and none of them is lost to the bite rule', () => {
    expect(spawnsOf([hit('player', 'attack', at), hit('player', 'attack', at)], me)).toHaveLength(2);
  });
});

describe('where a landing raises dust', () => {
  it('on the dry ground of the valley, not on a meadow, a grove or water', () => {
    for (const tag of ['path', 'riverbank', 'town', 'ruin']) expect(landingDust(tag)).toBe(true);
    for (const tag of ['meadow', 'grove', 'water', undefined]) expect(landingDust(tag)).toBe(false);
  });
});
