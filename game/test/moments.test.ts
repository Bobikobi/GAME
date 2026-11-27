import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import type { GameEvent } from '@game/kernel';

vi.mock('phaser', () => ({ BlendModes: { ADD: 'ADD' }, TintModes: { FILL: 'FILL' } }));

const { BURST_FLIGHT, MOMENTS, MOMENT_IDS, groundBits, momentsOf } = await import('../src/effects');
const { EffectLayer } = await import('../src/effect-layer');
const { RING_TOTAL_MS } = await import('../src/ring');

const WORLD = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'scenes', 'world.ts'), 'utf8');

const outcome = (struck: 'player' | 'foe', at: [number, number]) => ({
  kind: 'attack' as const, number: 3, at, move: 'attack',
  striker: { side: struck === 'player' ? 'foe' as const : 'player' as const, id: struck === 'player' ? 'wolf' : 'p' },
  struck: { side: struck, id: struck === 'player' ? 'p' : 'wolf' },
});

describe('which event starts which moment (momentsOf)', () => {
  const one = (e: GameEvent) => momentsOf([e]);

  it('a stone lifted, set down or pushed lays its moment on the tile it names', () => {
    expect(one({ e: 'lift', kind: 'core/large-stone', qty: 1, at: [3, 4] })).toEqual([{ id: 'stone-lift', at: { on: 'tile', tile: [3, 4] } }]);
    expect(one({ e: 'setdown', kind: 'core/large-stone', at: [5, 6], count: 1 })).toEqual([{ id: 'stone-down', at: { on: 'tile', tile: [5, 6] } }]);
    expect(one({ e: 'push', kind: 'core/boulder', from: [1, 1], at: [2, 1] })).toEqual([{ id: 'stone-push', at: { on: 'tile', tile: [2, 1] } }]);
  });

  it('food, a broken tool, a level and a safe place are the player\'s, once a batch', () => {
    expect(momentsOf([{ e: 'eat', item: 'core/berries', hp: 9 }, { e: 'eat', item: 'core/berries', hp: 10 }])).toEqual([{ id: 'eat', at: { on: 'player' } }]);
    expect(one({ e: 'tool_broke', item: 'core/axe' })).toEqual([{ id: 'tool-broke', at: { on: 'player' } }]);
    expect(momentsOf([{ e: 'level', profession: 'core/woodcutting', level: 2 }, { e: 'level', profession: 'core/digging', level: 3 }])).toEqual([{ id: 'level', at: { on: 'player' } }]);
    expect(one({ e: 'safe', id: 'core/bank-wolf', bitten: false })).toEqual([{ id: 'safe', at: { on: 'player' } }]);
  });

  it('a quest done has its light; a quest taken has none', () => {
    expect(one({ e: 'quest', quest: 'core/first-fire', state: 'done' })).toEqual([{ id: 'quest-done', at: { on: 'player' } }]);
    expect(one({ e: 'quest', quest: 'core/first-fire', state: 'active' })).toEqual([]);
  });

  it('a fire out smokes on its own hearth', () => {
    expect(one({ e: 'fire_out', id: 'core/elder-hearth' })).toEqual([{ id: 'fire-out', at: { on: 'fire', id: 'core/elder-hearth' } }]);
  });

  it('a hurt flashes the player once a batch, and a landing\'s hurt waits for the feet', () => {
    expect(momentsOf([{ e: 'hurt', by: 'predator', id: 'w', hp: 50 }, { e: 'hit', player: 'p', by: 'foe', harm: 3, ...outcome('player', [1, 1]) }])).toEqual([{ id: 'hurt', at: { on: 'player' } }]);
    expect(one({ e: 'hurt', by: 'fall', hp: 50 })).toEqual([{ id: 'hurt', at: { on: 'player' }, landing: true }]);
  });

  it('the player\'s blow flashes the foe it struck, on its figure or its tile', () => {
    expect(one({ e: 'hit', player: 'p', by: 'player', harm: 3, ...outcome('foe', [7, 8]) })).toEqual([{ id: 'foe-hurt', at: { on: 'foe', id: 'wolf', tile: [7, 8] } }]);
  });

  it('a dodge, a guard and a foe\'s fall lay theirs on the tile; a miss lays nothing (its word is enough)', () => {
    expect(one({ e: 'fight_dodge', ...outcome('player', [2, 2]), kind: 'dodge' })).toEqual([{ id: 'dodge', at: { on: 'tile', tile: [2, 2] } }]);
    expect(one({ e: 'fight_guard', ...outcome('player', [2, 3]), kind: 'guard' })).toEqual([{ id: 'guard', at: { on: 'tile', tile: [2, 3] } }]);
    expect(one({ e: 'foe_fall', foe: 'wolf', at: [9, 9], drops: [] })).toEqual([{ id: 'foe-fall', at: { on: 'tile', tile: [9, 9] } }]);
    expect(one({ e: 'fight_miss', ...outcome('foe', [2, 3]), kind: 'miss' })).toEqual([]);
  });

  it('a stone that takes small game and one that comes down beside it have their moments (#923): quiet, laid by the scene when the stone lands', () => {
    for (const id of ['game-hit', 'game-miss'] as const) {
      expect(MOMENTS[id].danger, id).toBe(false);
      expect(MOMENTS[id].parts.length, id).toBeGreaterThan(0);
      expect(WORLD, id).toContain(`id: '${id}'`);
    }
    // the kernel tells the take before the stone has come down; the scene lays the moment at the landing
    expect(momentsOf([{ e: 'take_prey' }])).toEqual([]);
  });

  it('the rest of the kernel\'s events start no moment (they have their own: the item lifting, the coins, the banner)', () => {
    expect(momentsOf([{ e: 'gain', item: 'core/log', qty: 1 }, { e: 'gold', delta: 5 }, { e: 'place', id: 'core/town' }])).toEqual([]);
  });
});

describe('the moments\' own rules', () => {
  it('a success never flashes a body (DECISIONS 2026-10-18): every flash is a moment of danger', () => {
    for (const id of MOMENT_IDS) {
      const m = MOMENTS[id];
      if (m.parts.some((p) => p.fx === 'flash')) expect(m.danger, id).toBe(true);
    }
    for (const id of ['level', 'quest-done', 'safe', 'eat', 'fish-catch', 'stone-down'] as const) expect(MOMENTS[id].danger).toBe(false);
  });

  it('every burst throws a texture the world scene makes (makeFx), so none is silently empty', () => {
    const made = new Set([...WORLD.matchAll(/make\('(fx-[a-z-]+)'/g)].map((m) => m[1]));
    for (const id of MOMENT_IDS) for (const p of MOMENTS[id].parts) if (p.fx === 'burst') expect(made.has(p.texture), `${id}: ${p.texture}`).toBe(true);
    for (const tag of ['path', 'meadow', 'ruin']) expect(made.has(groundBits(tag)!), tag).toBe(true);
  });

  it('the ground throws dust on dry ground, leaves on grass, grit in a ruin, and nothing on water', () => {
    expect(groundBits('path')).toBe('fx-puff');
    expect(groundBits('town')).toBe('fx-puff');
    expect(groundBits('meadow')).toBe('fx-leaf');
    expect(groundBits('ruin')).toBe('fx-grit');
    expect(groundBits('water')).toBeUndefined();
    expect(groundBits(undefined)).toBeUndefined();
  });

  it('a moment is small at the game\'s zoom: at most 12 bits a part, and every flight lives under a second', () => {
    for (const id of MOMENT_IDS) for (const p of MOMENTS[id].parts) if (p.fx === 'burst' || p.fx === 'ground') expect(p.n, id).toBeLessThanOrEqual(12);
    for (const f of Object.values(BURST_FLIGHT)) expect(f.lifespan[1]).toBeLessThanOrEqual(1000);
  });
});

/** A scene with just what the layer touches: textures, sprites, images, graphics, particles and tweens, each recorded. */
function fakeScene(textures: string[]) {
  const made: { kind: string; key?: string; obj: Record<string, unknown> }[] = [];
  const chain = <T extends Record<string, unknown>>(obj: T) => new Proxy(obj, {
    get: (t, k) => (k in t ? t[k as keyof T] : () => p),
  });
  let p: Record<string, unknown>;
  const explode: [string, number, number, number][] = [];
  const scene = {
    textures: { exists: (k: string) => textures.includes(k) },
    add: {
      sprite: (x: number, y: number, key: string, frame: unknown) => {
        const o: Record<string, unknown> = { x, y, key, frame: { name: String(frame) }, texture: { key }, destroyed: false };
        p = chain(Object.assign(o, { destroy: () => { o.destroyed = true; }, setTexture: (k: string, f: unknown) => { o.texture = { key: k }; o.frame = { name: String(f) }; return p; }, setAlpha: (a: number) => { o.alpha = a; return p; } }));
        made.push({ kind: 'sprite', key, obj: o });
        return p;
      },
      image: (x: number, y: number, key: string) => {
        const o: Record<string, unknown> = { x, y, key };
        p = chain(o);
        made.push({ kind: 'image', key, obj: o });
        return p;
      },
      graphics: () => {
        const o: Record<string, unknown> = { destroyed: false, rects: 0 };
        p = chain(Object.assign(o, { destroy: () => { o.destroyed = true; }, fillRect: () => { o.rects = (o.rects as number) + 1; return p; } }));
        made.push({ kind: 'graphics', obj: o });
        return p;
      },
      particles: (_x: number, _y: number, key: string) => {
        const o: Record<string, unknown> = { key };
        p = chain(Object.assign(o, { explode: (n: number, x: number, y: number) => explode.push([key, n, x, y]), setDepth: (d: number) => { o.depth = d; return p; } }));
        made.push({ kind: 'particles', key, obj: o });
        return p;
      },
    },
    tweens: { chain: () => undefined },
  };
  return { scene, made, explode };
}

const body = () => ({ x: 40, y: 60, originX: 0.5, originY: 1, scaleX: 1, scaleY: 1, flipX: false, flipY: false, depth: 61, visible: true, active: true, texture: { key: 'human-walk' }, frame: { name: '3' } });

describe('the layer lays a moment\'s parts', () => {
  const ALL = ['fx-dust', 'fx-spark', 'fx-chip', 'fx-leaf', 'fx-puff', 'fx-grit', 'fx-drop', 'fx-mote', 'fx-smoke', 'fx-glow'];

  it('a stone set down on a path throws the path\'s bits and the dust from both sides of the feet, over the figures', () => {
    const { scene, made, explode } = fakeScene(ALL);
    const layer = new EffectLayer(scene as never, { fx: 9800, water: 9799 }, 16);
    expect(layer.moment('stone-down', { x: 8, y: 10, ground: 'fx-puff' }, 0, true)).toEqual(['ground', 'burst']);
    // a body stands on the spot: what rises from the ground there is thrown beside the feet, never hidden behind the legs (player eye, 27.11)
    expect(explode).toEqual([['fx-puff', 4, 8 - 5.6, 10], ['fx-puff', 3, 8 + 5.6, 10], ['fx-dust', 2, 8 - 5.6, 10], ['fx-dust', 1, 8 + 5.6, 10]]);
    // under the figures, the body standing on its own feet's dust hid it (player eye and a probe in the page, 27.11)
    expect(made.filter((m) => m.kind === 'particles').map((m) => m.obj.depth)).toEqual([9800, 9800]);
  });

  it('on water the ground throws nothing, and a texture the scene did not make throws nothing', () => {
    const { scene, explode } = fakeScene(['fx-dust']);
    const layer = new EffectLayer(scene as never, 9800, 16);
    expect(layer.moment('stone-down', { x: 8, y: 10 }, 0, true)).toEqual(['burst']);
    expect(layer.moment('eat', { x: 8, y: 10 }, 0, true)).toEqual([]);
    expect(explode).toEqual([['fx-dust', 2, 8 - 5.6, 10], ['fx-dust', 1, 8 + 5.6, 10]]);
  });

  it('a level lays its light above the body and sends its sparks and motes up from there', () => {
    const { scene, made, explode } = fakeScene(ALL);
    const layer = new EffectLayer(scene as never, 9800, 16);
    expect(layer.moment('level', { x: 50, y: 100 }, 0, true)).toEqual(['light', 'burst', 'burst']);
    expect(made.find((m) => m.key === 'fx-glow')?.obj).toMatchObject({ x: 50, y: 88 });
    expect(explode).toEqual([['fx-spark', 10, 50, 90], ['fx-mote', 6, 50, 86]]);
  });

  it('with the motion group off only the light and the flash play', () => {
    const { scene, explode } = fakeScene(ALL);
    const layer = new EffectLayer(scene as never, 9800, 16);
    expect(layer.moment('level', { x: 0, y: 0 }, 0, false)).toEqual(['light']);
    expect(layer.moment('fish-catch', { x: 0, y: 0 }, 0, false)).toEqual([]);
    expect(layer.moment('hurt', { x: 0, y: 0, body: body() as never }, 0, false)).toEqual(['flash']);
    expect(explode).toEqual([]);
  });

  it('a struck body\'s flash is a white copy on its frame, just over it, gone after its time; a flash with no body lays nothing', () => {
    const { scene, made } = fakeScene(ALL);
    const layer = new EffectLayer(scene as never, 9800, 16);
    expect(layer.moment('hurt', { x: 0, y: 0 }, 0, true)).toEqual([]);
    const b = body();
    expect(layer.moment('hurt', { x: 0, y: 0, body: b as never }, 1000, true)).toEqual(['flash']);
    const copy = made.find((m) => m.kind === 'sprite')!.obj;
    expect(copy).toMatchObject({ key: 'human-walk', frame: { name: '3' } });
    expect(layer.showing.flashes).toBe(1);
    // the body walks on: the copy takes its next frame
    b.frame = { name: '4' };
    layer.update(1040);
    expect(copy).toMatchObject({ frame: { name: '4' }, destroyed: false });
    layer.update(1000 + MOMENTS.hurt.parts.find((p) => p.fx === 'flash')!.ms!);
    expect(copy.destroyed).toBe(true);
    expect(layer.showing.flashes).toBe(0);
  });

  it('the fish\'s rings spread and are gone after the ring\'s time, and the record keeps what played', () => {
    const { scene, made } = fakeScene(ALL);
    const layer = new EffectLayer(scene as never, 9800, 16);
    expect(layer.moment('fish-catch', { x: 8, y: 10 }, 500, true)).toEqual(['ring', 'burst']);
    const g = made.find((m) => m.kind === 'graphics')!.obj;
    expect(g.rects).toBeGreaterThan(0);
    layer.update(500 + RING_TOTAL_MS - 1);
    expect(layer.showing.rings).toBe(1);
    layer.update(500 + RING_TOTAL_MS);
    expect(g.destroyed).toBe(true);
    expect(layer.showing.rings).toBe(0);
    expect(layer.played).toEqual([{ id: 'fish-catch', at: 500, parts: ['ring', 'burst'] }]);
  });

  it('one emitter for each texture, flight and depth, made once', () => {
    const { scene, made } = fakeScene(ALL);
    const layer = new EffectLayer(scene as never, 9800, 16);
    layer.moment('stone-down', { x: 0, y: 0, ground: 'fx-puff' }, 0, true);
    layer.moment('stone-down', { x: 5, y: 5, ground: 'fx-puff' }, 10, true);
    expect(made.filter((m) => m.kind === 'particles').map((m) => m.key)).toEqual(['fx-puff', 'fx-dust']);
  });
});
