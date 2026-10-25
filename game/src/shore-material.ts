/** Client-side artwork selection. Material identity is separate from shoreline topology. */
export interface ShoreVariant {
  id: string;
  motif: string;
  texture: string;
  mask: number;
  profile: string;
}

export interface ShoreMaterial {
  id: string;
  profile: string;
  variants: readonly ShoreVariant[];
  water: { bed: string; surface: string; foam: string; speed: number; opacity: number };
}

export interface ShoreChoice {
  variant: ShoreVariant;
  repeatedMotif: boolean;
}

/** Never silently substitute a different material or an incompatible shoreline profile. */
export function chooseShoreVariant(material: ShoreMaterial, mask: number, x: number, y: number, nearbyMotifs: readonly string[] = []): ShoreChoice | undefined {
  const compatible = material.variants.filter(v => v.mask === mask && v.profile === material.profile);
  if (!compatible.length) return undefined;
  const fresh = compatible.filter(v => !nearbyMotifs.includes(v.motif));
  // Sort by stable id so file/registration order never changes the same area's appearance.
  const pool = [...(fresh.length ? fresh : compatible)].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const hash = (Math.imul(x, 73856093) ^ Math.imul(y, 19349663)) >>> 0;
  const variant = pool[hash % pool.length]!;
  return { variant, repeatedMotif: nearbyMotifs.includes(variant.motif) };
}
