import { describe, expect, test, vi } from 'vitest';

vi.mock('phaser', () => ({ BlendModes: { MULTIPLY: 'MULTIPLY', ADD: 'ADD', ERASE: 'ERASE' }, Textures: { FilterMode: { NEAREST: 1 } } }));

import { LightLayer } from '../src/light-layer';
import { tableOf, type LightKey } from '../src/light';

/** a render texture that keeps the commands since its last clear/fill (what it holds), and counts its renders */
class Rec {
  visible = false;
  x = 0;
  y = 0;
  w = 0;
  h = 0;
  cmds: string[] = [];
  held: string[] = [];
  renders = 0;
  setOrigin() { return this; }
  setDepth() { return this; }
  setBlendMode() { return this; }
  setScale() { return this; }
  setVisible(v: boolean) { this.visible = v; return this; }
  setPosition(x: number, y: number) { this.x = x; this.y = y; return this; }
  resize(w: number, h: number) { this.w = w; this.h = h; this.cmds = []; this.held = []; return this; }
  clear() { this.cmds = []; return this; }
  fill(c: number, a: number) { this.cmds = [`fill ${c} ${a}`]; return this; }
  stamp(k: string, _f: unknown, x: number, y: number, o: unknown) { this.cmds.push(`${k} ${x} ${y} ${JSON.stringify(o)}`); return this; }
  render() { this.held = [...this.cmds]; this.renders += 1; return this; }
}
function scene() {
  const rts: Rec[] = [];
  return {
    rts,
    textures: { exists: () => true, createCanvas: () => undefined },
    add: { renderTexture: () => { const r = new Rec(); rts.push(r); return r; } },
  };
}
const keys = tableOf([
  { at: '05:00', tint: '#1a1c3c', pct: 92 }, { at: '08:00', tint: '#e8a83a', pct: 0 }, { at: '18:00', tint: '#e8a83a', pct: 0 }, { at: '22:00', tint: '#0a0a1c', pct: 92 },
] as never) as LightKey[];
// the table above is read as the game's own keys are: the test only needs a night that darkens past the floor


/** The layer in a night dark enough for the readable ring, over a view with a fire and a lamp in it. */
function night() {
  const sc = scene();
  const layer = new LightLayer(sc as never, keys, { floor: 0.2 }, { shade: 1, pools: 2 });
  const fire = layer.add({ kind: 'fire', x: 200, y: 150 });
  fire.phase = 1;
  layer.add({ kind: 'lamp', x: 420, y: 90, head: { x: 420, y: 70 } });
  const [shade, pools] = sc.rts as [Rec, Rec];
  const view = (x = 100, y = 50) => ({ x, y, width: 844, height: 390, right: x + 844, bottom: y + 390 }) as never;
  return { layer, fire, shade, pools, view };
}
const counts = (n: { shade: Rec; pools: Rec }) => [n.shade.renders, n.pools.renders];

describe('the light layer redraws each texture on its own inputs', () => {
  test('a frame that would draw the same leaves both textures as they are', () => {
    const n = night();
    n.layer.update(1340, n.view(), { x: 300, y: 200 }, 0, false);
    expect(counts(n)).toEqual([1, 1]);
    for (let i = 1; i < 30; i++) n.layer.update(1340, n.view(), { x: 300, y: 200 }, i * 16.7, false);
    expect(counts(n)).toEqual([1, 1]);
  });

  test('the ring moving with the player redraws the shade and leaves the pools', () => {
    const n = night();
    n.layer.update(1340, n.view(), { x: 300, y: 200 }, 0, false);
    const held = n.pools.held.join(';');
    for (let i = 1; i <= 20; i++) n.layer.update(1340, n.view(), { x: 300 + i * 2, y: 200 }, i * 16.7, false);
    expect(counts(n)).toEqual([21, 1]);
    expect(n.pools.held.join(';')).toBe(held);
  });

  test("the hour's shade changing redraws the shade and leaves the pools", () => {
    const n = night();
    n.layer.update(1290, n.view(), { x: 300, y: 200 }, 0, false);
    n.layer.update(1320, n.view(), { x: 300, y: 200 }, 16.7, false);
    expect(n.shade.renders).toBe(2);
    expect(n.pools.renders).toBe(1);
  });

  test('a light changing, or the view stepping, redraws both', () => {
    const n = night();
    n.layer.update(1340, n.view(), { x: 300, y: 200 }, 0, false);
    n.fire.strength = 0.5;
    n.layer.update(1340, n.view(), { x: 300, y: 200 }, 16.7, false);
    expect(counts(n)).toEqual([2, 2]);
    n.layer.update(1340, n.view(160, 50), { x: 300, y: 200 }, 33.4, false);
    expect(counts(n)).toEqual([3, 3]);
  });

  test('the layers are as drawn again after hide', () => {
    const n = night();
    n.layer.update(1340, n.view(), { x: 300, y: 200 }, 0, false);
    n.layer.hide();
    n.layer.update(1340, n.view(), { x: 300, y: 200 }, 16.7, false);
    expect(counts(n)).toEqual([2, 2]);
  });
});
