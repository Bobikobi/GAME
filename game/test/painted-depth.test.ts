import { describe, expect, it } from 'vitest';
import { decodeFootLine, footLineOk, cutFront, inFront, premultiplyRound, windowAt, type FootLine } from '../src/painted-depth';

describe('the figure against the mass, per pixel', () => {
  it('decodes the 8 bit picture back to the foot rows (a known value, 1234)', () => {
    const rgba = [4, 210, 0, 255, 0, 0, 0, 255, 255, 255, 0, 255, 8, 238, 0, 255];
    const d = decodeFootLine(rgba, 2, 2);
    expect([...d]).toEqual([1234, 0, 65535, 2286]);
    expect(footLineOk({ w: 2, h: 2, data: d }, [0, 0, 1234])).toBe(true);
    expect(footLineOk({ w: 2, h: 2, data: d }, [0, 0, 1235])).toBe(false);
  });

  it('a pixel is in front of her when its foot row is below hers, and never when it has none', () => {
    expect(inFront(900, 800)).toBe(true);
    expect(inFront(800, 800)).toBe(false);
    expect(inFront(700, 800)).toBe(false);
    expect(inFront(0, 0)).toBe(false);
  });

  // a 3 x 1 sheet: colours 10, 20, 30 (alpha 255, 255, 0), normals 1, 2, 3
  const sheet = { w: 3, colour: [10, 11, 12, 255, 20, 21, 22, 255, 30, 31, 32, 0], normal: [1, 1, 1, 255, 2, 2, 2, 255, 3, 3, 3, 255] };

  it('a window keeps the piece\'s own colour and normal exactly where a pixel stands in front of her, and is nothing elsewhere', () => {
    const fl: FootLine = { w: 6, h: 2, data: new Uint16Array([0, 0, 10, 20, 30, 0, 0, 0, 0, 0, 0, 0]) };
    const c = new Uint8ClampedArray(4 * 1 * 4);
    const nn = new Uint8ClampedArray(4 * 1 * 4);
    // the piece covers land columns 2..4 of row 0 (sheet at 0,0); the window is columns 1..4; her foot row is 15: columns 3 and 4 are in front (20, 30), column 2 (10) is not
    const n = cutFront(c, nn, 1, 0, 4, 1, { x0: 2, y0: 0, w: 3, h: 1 }, 0, 0, sheet, fl, 15);
    expect(Array.from(c)).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 20, 21, 22, 255, 0, 0, 0, 0]);
    expect([nn[8], nn[9], nn[10]]).toEqual([2, 2, 2]);
    expect([nn[0], nn[1], nn[2]]).toEqual([128, 128, 255]);
    expect(n).toBe(1);   // the last column is in front but the sheet's pixel is clear there
  });

  it('a see-through window thins the alpha by its own amount', () => {
    const fl: FootLine = { w: 3, h: 1, data: new Uint16Array([90, 90, 90]) };
    const c = new Uint8ClampedArray(2 * 4);
    const nn = new Uint8ClampedArray(2 * 4);
    cutFront(c, nn, 0, 0, 2, 1, { x0: 0, y0: 0, w: 3, h: 1 }, 0, 0, sheet, fl, 10, (x) => (x === 0 ? 1 : 0.5));
    expect([c[3], c[7]]).toEqual([0, 128]);
  });

  it('a window stays inside its piece and sits where asked when it can', () => {
    expect(windowAt(50, 0, 100, 40)).toBe(50);
    expect(windowAt(-10, 0, 100, 40)).toBe(0);
    expect(windowAt(90, 0, 100, 40)).toBe(60);
    expect(windowAt(5, 10, 20, 40)).toBe(10);
  });
});

describe('the front windows premultiplied colour (the direct upload)', () => {
  it('rounds each channel to the nearest level, as the canvas path did, for every colour and alpha, and copies the alpha', () => {
    const src = new Uint8Array(4);
    const out = new Uint8Array(4);
    for (let a = 0; a < 256; a++) {
      for (let c = 0; c < 256; c++) {
        src[0] = c; src[1] = 255 - c; src[2] = c >> 1; src[3] = a;
        premultiplyRound(src, out);
        expect([out[0], out[1], out[2], out[3]]).toEqual([Math.round((c * a) / 255), Math.round(((255 - c) * a) / 255), Math.round(((c >> 1) * a) / 255), a]);
      }
    }
  });
});
