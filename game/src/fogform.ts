/**
 * The form of the fog (look lane v10, 14.11): how its density is shaped from the land's own numbers (look.ts FogData: how thick it lies at the bottom and at
 * the top of the frame) and the banks' noise. Three rules, each from the references (the forest clip: pale banks of 40 to 60 percent opacity over a third of
 * the frame, the rest clear):
 *   - the fog only adds light (drawn by SCREEN: a pixel never gets darker, whatever the bank's colour or the hour);
 *   - a bank is thick and its edge is soft; between banks the air is clear (the floor), so a frame holds both;
 *   - the land's numbers say where the fog lies thick and where thin (the gradient), `gain` how far its thickest bank reaches (capped by `cap`).
 * Order v11 (19.11): the fog's colour is the sky of the hour (`fogSkyOf`: the hour's light colour, brighter, most of its chroma taken out), the same over water and land, so fog
 * brightens toward the sky, thins the contrast and never adds colour; and its form comes from the land (`lownessOf`): it lies over water and in the low ground, thin on ridges.
 */
export type FogForm = { gain: number; floor: number; lo: number; hi: number; cap: number };

export const FOG_FORM: FogForm = { gain: 14.0, floor: 0.06, lo: 0.31, hi: 0.45, cap: 0.64 };

/** The sky colour the fog moves a pixel toward: the hour's light colour (look.ts fogColour) brightened by `gain` and with `keep` of its chroma left, so the fog thins colour as it lifts light. */
export const FOG_SKY = { gain: 1.5, keep: 0.2 } as const;
export function fogSkyOf(c: readonly [number, number, number]): [number, number, number] {
  const y = 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];
  const f = (v: number): number => Math.min(1, Math.max(0, y * FOG_SKY.gain + (v - y) * FOG_SKY.keep));
  return [f(c[0]), f(c[1]), f(c[2])];
}

/** How much of the fog's thickest reach a ridge keeps: the density is `mix(ridge, 1, lowness)`. */
export const FOG_HOLLOW = { ridge: 0.65, reach: 10 } as const;

/** The high sun burns the fog off dry ground (order v11b): 0 below elevation `lo` (the evening, the morning), 1 from `hi` (midday); smoothstep between. At 1 the dry ground's fog density loses `cut` (the thin fog goes first, the thick banks thin); over water and in hollows the fog stays. */
export const FOG_BURN = { lo: 0.5, hi: 0.75, cut: 0.22 } as const;
export function burnOf(elev: number): number {
  const t = Math.min(1, Math.max(0, (elev - FOG_BURN.lo) / (FOG_BURN.hi - FOG_BURN.lo)));
  return t * t * (3 - 2 * t);
}

/**
 * The low ground, 0 to 255 per art pixel: the share of water within `reach` art pixels (a box blur of the water mask, twice). Water itself reads high, its margins fall off, ground far
 * from any water reads 0. Water is the land's one sure low place that every land (a generated one too) carries as a mask; walls (ridges) thin the fog through their own distance.
 */
export function lownessOf(water: Uint8Array, w: number, h: number, reach: number): Uint8Array {
  let cur = Float32Array.from(water, (v) => (v ? 1 : 0));
  for (let pass = 0; pass < 2; pass++) {
    for (const horizontal of [true, false]) {
      const out = new Float32Array(cur.length);
      const n = horizontal ? w : h;
      const m = horizontal ? h : w;
      for (let l = 0; l < m; l++) {
        const at = (i: number): number => (horizontal ? l * w + i : i * w + l);
        let sum = 0;
        for (let i = -reach; i <= reach; i++) sum += cur[at(Math.min(n - 1, Math.max(0, i)))]!;
        for (let i = 0; i < n; i++) {
          out[at(i)] = sum / (2 * reach + 1);
          sum += cur[at(Math.min(n - 1, i + reach + 1))]! - cur[at(Math.max(0, i - reach))]!;
        }
      }
      cur = out;
    }
  }
  return Uint8Array.from(cur, (v) => Math.min(255, Math.round(v * 255)));
}

/**
 * Fog over water is one even veil (order v11c): the banks' noise is a bright bank and a dark gap, and over water (dark, so it takes the most light from the fog) the gap between two banks read as a soft dark smudge, 3 to 6 L*
 * under its surround. Over the low ground (`lownessOf`, from `lo` to `hi`) the bank value is pulled `k` of the way to `mean`, the value that gives the water the same average light the banks gave it (measured on the bone moor at 13:00: mean L* over the water 29.5 with banks, 29.6 with mean .85; .45 gave 19.7, .70 gave 25.8), so the fog's average lift over water stays and its patches go.
 * Order v11d: the veil was too grey (water's large-scale contrast 1.86 no fog -> .55 L*, bone 13:00), so `k` is .6 (the banks keep 40% of their drift, a 2 to 3 L* swing, under F7w's 3 L*) and the density over water is scaled by `thinOver` (.4); the water then keeps 85% of its no-fog large-scale contrast and 92% of its detail.
 * The shader's lit fog does the same sums (painted.ts FOG_LIT_FS); `low` is 0 to 1.
 */
export const FOG_EVEN = { k: 0.6, mean: 0.85, lo: 0.5, hi: 0.9, thin: 0.2 } as const;
/** The density factor over the low ground (order v11d): 1 on dry ground, `thin` on water; `low` is 0 to 1. */
export function thinOver(low: number, thin: number = FOG_EVEN.thin): number {
  const t = Math.min(1, Math.max(0, (low - FOG_EVEN.lo) / (FOG_EVEN.hi - FOG_EVEN.lo)));
  return 1 - (1 - thin) * t * t * (3 - 2 * t);
}
export function evenBanks(banks: number, low: number, k: number = FOG_EVEN.k): number {
  const t = Math.min(1, Math.max(0, (low - FOG_EVEN.lo) / (FOG_EVEN.hi - FOG_EVEN.lo)));
  const w = k * t * t * (3 - 2 * t);
  return banks + (FOG_EVEN.mean - banks) * w;
}
