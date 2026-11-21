export type LandscapeResult = 'locked' | 'unsupported' | `refused: ${string}`;

type FullscreenDocument = {
  documentElement: { requestFullscreen?: Element['requestFullscreen'] };
  fullscreenElement: Element | null;
};
type OrientationScreen = { orientation?: { lock?: (kind: 'landscape') => Promise<void>; unlock?: () => void } };

/**
 * Best-effort browser landscape: Android needs the request inside fullscreen; every refusal stays data. Fullscreen is
 * asked even where the lock API is missing: the full view is what a phone without the lock kept from before #638.
 */
export async function requestLandscape(doc: FullscreenDocument, scr: OrientationScreen, signal?: AbortSignal): Promise<LandscapeResult> {
  let step = 'landscape lock';
  try {
    const orientation = scr.orientation;
    if (!doc.fullscreenElement) {
      step = 'fullscreen';
      await doc.documentElement.requestFullscreen?.({ navigationUI: 'hide' });
    }
    if (!orientation?.lock) return 'unsupported';
    if (signal?.aborted) return 'refused: left play';
    step = 'landscape lock';
    await orientation.lock('landscape');
    return 'locked';
  } catch {
    return `refused: ${step}`;
  }
}

/**
 * Builds the one gate shared by Continue and Wake up: it asks once per play, and `rearm` (called when play is left or
 * fails to start) lets the next tap ask again. A mouse click and a key press (an empty pointer type) never ask.
 */
export function landscapeOnFirstStart(phone: () => boolean, request: () => void): ((pointer?: string) => void) & { rearm: () => void } {
  let asked = false;
  const gate = (pointer?: string) => {
    if (asked || pointer === 'mouse' || pointer === '' || !phone()) return;
    asked = true;
    request();
  };
  gate.rearm = () => {
    asked = false;
  };
  return gate;
}

export function releaseLandscape(scr: OrientationScreen): void {
  try {
    scr.orientation?.unlock?.();
  } catch {
    // a browser may expose unlock but refuse it; the home page still opens
  }
}
