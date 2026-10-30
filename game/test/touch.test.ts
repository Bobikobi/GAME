import { describe, expect, it } from 'vitest';
import { STICK_DEAD, STICK_FULL, stickFrom } from '../src/input';
import { FloatingStick, STICK_RING, inZone, stickZone } from '../src/ui/stick';

const zone = stickZone(800, 360, 90);

describe('the floating stick', () => {
  it('takes the left half below the HUD band', () => {
    expect(zone).toEqual({ left: 0, top: 90, right: 400, bottom: 360 });
    expect(inZone(zone, 10, 300)).toBe(true);
    expect(inZone(zone, 399, 91)).toBe(true);
    expect(inZone(zone, 400, 300)).toBe(false); // the right half is the buttons'
    expect(inZone(zone, 100, 89)).toBe(false); // the band is the HUD's
  });

  it('centers where the thumb lands and reads no walk there', () => {
    const s = new FloatingStick();
    expect(s.down(1, 180, 260, zone)).toBe(true);
    expect(s.center).toEqual({ x: 180, y: 260 });
    expect(s.move(1, 180, 260)).toEqual([0, 0]);
  });

  it('does not rise outside its zone, nor for a second thumb', () => {
    const s = new FloatingStick();
    expect(s.down(1, 600, 260, zone)).toBe(false);
    expect(s.center).toBeNull();
    expect(s.down(1, 100, 200, zone)).toBe(true);
    expect(s.down(2, 120, 220, zone)).toBe(false);
    expect(s.center).toEqual({ x: 100, y: 200 });
    expect(s.move(2, 200, 200)).toBeNull();
  });

  it('keeps the pad\'s dead zone and full-speed radius, scaled to its ring', () => {
    const s = new FloatingStick();
    s.down(1, 200, 250, zone);
    const dead = STICK_RING * STICK_DEAD;
    const full = STICK_RING * STICK_FULL;
    expect(s.move(1, 200 + dead - 0.5, 250)).toEqual([0, 0]);
    const half = s.move(1, 200 + (dead + full) / 2, 250);
    expect(half?.[0]).toBeCloseTo(0.5);
    expect(s.move(1, 200, 250 - full)).toEqual([0, -1]);
    expect(s.move(1, 200 + 3 * full, 250)).toEqual([1, 0]);
    // the same vector the portrait pad gives for the same offset over its width
    expect(s.move(1, 237, 281)).toEqual(stickFrom(37, 31, STICK_RING));
  });

  it('holds the knob inside the full-speed ring', () => {
    const s = new FloatingStick();
    s.down(1, 200, 250, zone);
    expect(s.knob(210, 250)).toEqual({ x: 10, y: 0 });
    const far = s.knob(200 + 300, 250 + 400);
    expect(Math.hypot(far.x, far.y)).toBeCloseTo(STICK_RING * STICK_FULL);
    expect(far.x / far.y).toBeCloseTo(300 / 400);
  });

  it('lets go when its thumb lifts, and only then', () => {
    const s = new FloatingStick();
    s.down(1, 200, 250, zone);
    expect(s.up(2)).toBe(false);
    expect(s.center).not.toBeNull();
    expect(s.up(1)).toBe(true);
    expect(s.center).toBeNull();
    expect(s.move(1, 260, 250)).toBeNull();
    // the next landing raises it afresh where that thumb lands
    expect(s.down(3, 50, 330, zone)).toBe(true);
    expect(s.center).toEqual({ x: 50, y: 330 });
  });

  it('is at least the owner\'s 120 px ring', () => {
    expect(STICK_RING).toBeGreaterThanOrEqual(120);
  });
});
