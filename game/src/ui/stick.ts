/**
 * The floating stick of the landscape layout (the owner, 30.10: a phone in landscape plays with a stick and buttons
 * in the Wild Rift grammar). The stick is not drawn anywhere until the left thumb lands in its zone; its center is
 * where the thumb landed, and the finger's offset from that center drives the walk exactly as the portrait pad does
 * (`stickFrom`: the same dead zone and full-speed share, of the ring's own width). Lifting the finger lets it go.
 * Pure: no page, no app, so the math is tested on its own (game/test/touch.test.ts).
 */
import { STICK_FULL, stickFrom } from '../input';

/** The floating stick's ring, in CSS px: the owner's floor is 120. */
export const STICK_RING = 132;

/** Where a thumb may land to raise the stick: a box in CSS px. */
export interface Zone {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * The stick's zone on a screen `width` by `height`: the left half, below the HUD's band (`bandBottom`, the lowest
 * edge of what the top band shows).
 */
export function stickZone(width: number, height: number, bandBottom: number): Zone {
  return { left: 0, top: Math.max(0, bandBottom), right: width / 2, bottom: height };
}

export function inZone(zone: Zone, x: number, y: number): boolean {
  return x >= zone.left && x < zone.right && y >= zone.top && y < zone.bottom;
}

export class FloatingStick {
  /** the stick's center while a thumb holds it, else null */
  center: { x: number; y: number } | null = null;
  /** the pointer that raised it */
  pointer: number | null = null;

  constructor(readonly ring = STICK_RING) {}

  /** A thumb lands: inside the zone it raises the stick there (and reads no walk yet), elsewhere nothing. */
  down(pointer: number, x: number, y: number, zone: Zone): boolean {
    if (this.pointer !== null || !inZone(zone, x, y)) return false;
    this.pointer = pointer;
    this.center = { x, y };
    return true;
  }

  /** The walk's vector for the thumb at `x, y`, or null when this pointer does not hold the stick. */
  move(pointer: number, x: number, y: number): [number, number] | null {
    if (pointer !== this.pointer || !this.center) return null;
    return stickFrom(x - this.center.x, y - this.center.y, this.ring);
  }

  /**
   * Where the knob is drawn for the thumb at `x, y`, from the center: the finger's offset, held inside the
   * full-speed ring, so the knob stops where the walk stops growing.
   */
  knob(x: number, y: number): { x: number; y: number } {
    if (!this.center) return { x: 0, y: 0 };
    const dx = x - this.center.x;
    const dy = y - this.center.y;
    const r = Math.hypot(dx, dy);
    const max = this.ring * STICK_FULL;
    return r <= max ? { x: dx, y: dy } : { x: (dx / r) * max, y: (dy / r) * max };
  }

  /** The thumb lifts: true when it was the one holding the stick, which is then let go. */
  up(pointer: number): boolean {
    if (pointer !== this.pointer) return false;
    this.pointer = null;
    this.center = null;
    return true;
  }
}
