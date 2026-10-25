/** Visual-only coastal response, independent of gameplay weather and collision rules. */
export type WaterWeather = 'calm' | 'windy' | 'storm';
export interface WaterSample { x: number; y: number; land: boolean; distance: number; nx: number; ny: number; exposure: number }
export const WATER_WEATHER = {
  calm: { speed: .3, amplitude: .15, foam: .02, frequency: .7 },
  windy: { speed: 4, amplitude: 2.8, foam: .42, frequency: 1.7 },
  storm: { speed: 9, amplitude: 6, foam: .88, frequency: 2.6 },
} as const;

/** Sample real land silhouette; an upwind obstruction shelters the water behind it. */
export function buildWaterField(size: number, step: number, landAt: (x: number, y: number) => boolean, wind: readonly [number, number]): WaterSample[] {
  const boundary: { x: number; y: number }[] = [];
  for (let y = step / 2; y < size; y += step) for (let x = step / 2; x < size; x += step) {
    if (!landAt(x, y)) continue;
    for (const [dx, dy] of [[step, 0], [-step, 0], [0, step], [0, -step]]) {
      if (!landAt(x + dx!, y + dy!)) boundary.push({ x: x + dx! / 2, y: y + dy! / 2 });
    }
  }
  const windLength = Math.hypot(...wind) || 1;
  const wx = wind[0] / windLength, wy = wind[1] / windLength;
  const field: WaterSample[] = [];
  for (let y = step / 2; y < size; y += step) for (let x = step / 2; x < size; x += step) {
    const land = landAt(x, y);
    let nearest = { x, y }, squared = Infinity;
    if (!land) for (const p of boundary) {
      const d = (x - p.x) ** 2 + (y - p.y) ** 2;
      if (d < squared) { squared = d; nearest = p; }
    }
    const distance = Math.sqrt(squared), length = distance || 1;
    const nx = Number.isFinite(distance) ? (x - nearest.x) / length : 0;
    const ny = Number.isFinite(distance) ? (y - nearest.y) / length : 0;
    let shelter = 1;
    if (!land) for (let d = step; d <= 80; d += step) {
      const sx = x - wx * d, sy = y - wy * d;
      if (sx < 0 || sy < 0 || sx >= size || sy >= size) break;
      if (landAt(sx, sy)) { shelter = .18; break; }
    }
    const facing = Math.max(0, -(wx * nx + wy * ny));
    field.push({ x, y, land, distance, nx, ny, exposure: shelter * (.2 + .8 * facing) });
  }
  return field;
}

/** Slope 0 is a broad shallow beach; 1 is a steep bank, with narrow stronger breaking. */
export function waterResponse(sample: WaterSample, weather: WaterWeather, slope: number, time: number) {
  const w = WATER_WEATHER[weather];
  const steepness = Math.max(0, Math.min(1, slope));
  const width = 28 - steepness * 20;
  const near = sample.land ? 0 : Math.max(0, 1 - sample.distance / width);
  const phase = (Number.isFinite(sample.distance) ? sample.distance : 1000) / (8 + 10 * (1 - steepness)) - time * w.frequency;
  const wave = Math.sin(phase);
  const response = near * sample.exposure;
  return {
    bend: wave * w.amplitude * response,
    foam: sample.land ? 0 : Math.max(0, wave) ** 2 * w.foam * response * (.6 + .4 * steepness),
    speed: w.speed * (1 - .55 * near),
  };
}
