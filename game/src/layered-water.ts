import type { WaterSample, WaterWeather } from './water-response';

const clamp = (v: number) => Math.max(0, Math.min(1, v));
/** Visual envelopes only: no hydrodynamics or terrain-height simulation. */
export function waterLayers(sample: WaterSample, weather: WaterWeather, slope: number, time: number) {
  const steep = clamp(slope);
  const distance = Number.isFinite(sample.distance) ? sample.distance : 10000;
  const shallow = sample.land ? 0 : Math.exp(-distance / (30 - 20 * steep));
  const strength = weather === 'calm' ? 0 : weather === 'windy' ? .6 : 1;
  const period = weather === 'storm' ? 3.8 : 5.5;
  const bx = sample.x - sample.nx * distance, by = sample.y - sample.ny * distance;
  const phase = ((time / period + (bx + by) * .0009) % 1 + 1) % 1;
  // A complete train enters from offshore; the tail survives after the crest reaches land.
  const front = 48 - phase * 76;
  const behind = distance - front;
  const width = 18 - steep * 8;
  const envelope = behind >= -3 && behind < width
    ? Math.min(1, (behind + 3) / 4) * (1 - Math.max(0, behind) / width) : 0;
  const impact = clamp(1 - Math.max(0, front - 15) / 35);
  const exposure = Math.sqrt(sample.exposure);
  const alive = sample.land ? 0 : strength * exposure;
  return {
    shallow,
    reflection: sample.land ? 0 : Math.exp(-distance / 18) * .32,
    body: alive * Math.exp(-(((distance - front - 7) / 16) ** 2)) * .3,
    foam: alive * envelope * impact,
    retreat: alive * clamp(-front / 10) * clamp(1 + front / 28) * Math.exp(-distance / (14 - steep * 7)) * .55,
  };
}
