export type LandscapeResult = 'locked' | 'unsupported' | `refused: ${string}`;

type FullscreenDocument = {
  documentElement: { requestFullscreen?: Element['requestFullscreen'] };
  fullscreenElement: Element | null;
};
type OrientationScreen = { orientation?: { lock?: (kind: 'landscape') => Promise<void>; unlock?: () => void } };

/** Best-effort browser landscape: Android needs the request inside fullscreen; every refusal stays data. */
export async function requestLandscape(doc: FullscreenDocument, scr: OrientationScreen, signal?: AbortSignal): Promise<LandscapeResult> {
  let step = 'landscape lock';
  try {
    const orientation = scr.orientation;
    if (!orientation?.lock) return 'unsupported';
    if (!doc.fullscreenElement) {
      step = 'fullscreen';
      await doc.documentElement.requestFullscreen?.({ navigationUI: 'hide' });
    }
    if (signal?.aborted) return 'refused: left play';
    step = 'landscape lock';
    await orientation.lock('landscape');
    return 'locked';
  } catch {
    return `refused: ${step}`;
  }
}

/** Builds the one gate shared by Continue and Wake up; a desktop gate never asks. */
export function landscapeOnFirstStart(phone: () => boolean, request: () => void): (pointer?: string) => void {
  let asked = false;
  return (pointer) => {
    if (asked || pointer === 'mouse' || !phone()) return;
    asked = true;
    request();
  };
}

export function releaseLandscape(scr: OrientationScreen): void {
  try {
    scr.orientation?.unlock?.();
  } catch {
    // a browser may expose unlock but refuse it; the home page still opens
  }
}
