import type { Viewport } from './cdp';

/** The one phone play viewport: the phone lies on its side (owner, 14.11; #720). */
export const PHONE: Viewport = { width: 844, height: 390, mobile: true };

/** Portrait exists only to prove that the game asks for landscape play. */
export const PORTRAIT_PHONE: Viewport = { width: PHONE.height, height: PHONE.width, mobile: true };

/** Camera coverage uses a real high-density phone canvas. */
export const PHONE_3X: Viewport = { ...PHONE, scale: 3 };
