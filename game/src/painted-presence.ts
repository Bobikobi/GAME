// What a query asks of the painted mount's presence options; no engine import, so a test can read it (painted.ts re-exports both).

/** The query of the private preview: the block that tools/art/block.py built (preview.py puts its scene folder at painted/preview-block), the way out of the valley, the device's hour, the phone camera `zoom=auto` (the engine's own default stays the fixed 3 until the owner rules), (the page's own query comes first and wins: URLSearchParams.get reads the first). */
export const PREVIEW_QUERY = '?painted=preview-block&link=1&clock=device&seethrough=1&zoom=auto';

/** The presence options a query asks for. The engine's own default for see-through is off (the owner rules); the preview's query turns it on (his like of 12.11), and a `seethrough=0` in the page's own query comes first and turns it off again. */
export function presenceOf(search: string): { edge: boolean; contact: boolean; seeThrough: boolean; figZoom: number; link: boolean; deviceClock: boolean; base: boolean } {
  const q = new URLSearchParams(search);
  return {
    edge: q.get('figedge') !== '0',
    contact: q.get('contact') !== '0',
    seeThrough: q.get('seethrough') === '1',
    figZoom: Math.max(0, Math.round(Number(q.get('figzoom') ?? 0)) || 0),
    link: q.get('link') === '1',
    deviceClock: q.get('clock') === 'device',
    base: q.get('base') === '1',
  };
}

/** What the query asks of the camera zoom: `zoom=N` is the camera's own zoom value, as it always was (it wins over everything), `zoom=auto` the phone camera (it follows the screen's height), else the standard's (`figzoom` or 3). The first value in the query wins. */
export function zoomOf(search: string): { auto: boolean; value: number } {
  const raw = new URLSearchParams(search).get('zoom') ?? '';
  if (raw === 'auto') return { auto: true, value: 0 };
  const n = Number(raw);
  return { auto: false, value: Number.isFinite(n) && n > 0 ? n : 0 };
}

/** The valley as the painted land (`base=1`): the map is the content's own, one ring round the scene's cells, so the scene lies at tile (1, 1). A map of another size is refused. */
export function baseOf<M extends { width: number; ground: readonly string[] }>(raw: M, scene: { cols: number; rows: number }): { map: M; x0: number; y0: number } {
  if (raw.width !== scene.cols + 2 || raw.ground.length !== scene.rows + 2) throw new Error(`painted base: the map is ${raw.width} x ${raw.ground.length}, the scene ${scene.cols} x ${scene.rows} needs ${scene.cols + 2} x ${scene.rows + 2}`);
  return { map: raw, x0: 1, y0: 1 };
}
