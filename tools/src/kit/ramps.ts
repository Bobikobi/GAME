/**
 * Ramps, the palette rule of ART_SYSTEM section 3, worked out without the disk so it can
 * be tested: what a unit of light does to a colour, the problems a declared ramp has, and
 * the colours a sprite may use once it names its ramps.
 *
 * The 32 core colours stay the shared colours. A ramp is how a material goes from its dark
 * step to its light one, and the check holds a declared ramp to two things: its steps rise
 * in light, and its hue moves between them, so "only changes value" is not a ramp.
 */

/** One step of a ramp, as the palette writes colours. */
export type RampLike = { id: string; steps: readonly string[] };

/** A ramp is five or six steps (ART_SYSTEM section 3). */
export const RAMP_STEPS = { min: 5, max: 6 } as const;

/** How far one step's light must rise over the one below it, on a 0 to 255 scale. */
export const RAMP_VALUE_STEP = 5;

/** How far the hue must travel across the whole ramp, as a share of the colour's own light. */
export const RAMP_HUE_DRIFT = 0.03;

/** Reads `#rrggbb` into its three channels. A colour in another shape throws, as the schema refuses it first. */
export function rgbOf(hex: string): [number, number, number] {
  const value = hex.replace('#', '');
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ];
}

/** How light a colour is, 0 to 255: the green channel weighs most, as the eye sees it. */
export function lightOf(hex: string): number {
  const [r, g, b] = rgbOf(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Where a colour sits between cool and warm, roughly -1 to 1: blue-red over the colour's own
 * total light. It ignores how saturated a colour is, so a pale step and a deep one of the
 * same hue land on the same number, and a grey sits near zero whatever its light.
 */
export function warmthOf(hex: string): number {
  const [r, g, b] = rgbOf(hex);
  const total = r + g + b;
  return total === 0 ? 0 : (r - b) / total;
}

/**
 * Every problem a declared ramp has, as one sentence each, in the wording the check prints.
 * An empty list means the ramp is a ramp.
 */
export function rampProblems(ramp: RampLike): string[] {
  const problems: string[] = [];
  const steps = ramp.steps;
  if (steps.length < RAMP_STEPS.min || steps.length > RAMP_STEPS.max) {
    problems.push(`has ${steps.length} steps; a ramp is ${RAMP_STEPS.min} or ${RAMP_STEPS.max}`);
    return problems;
  }
  const seen = new Set<string>();
  for (const step of steps) {
    if (seen.has(step)) problems.push(`repeats ${step}; every step of a ramp is a colour of its own`);
    seen.add(step);
  }
  for (let index = 1; index < steps.length; index += 1) {
    const below = lightOf(steps[index - 1]!);
    const here = lightOf(steps[index]!);
    if (here - below < RAMP_VALUE_STEP) {
      problems.push(
        `step ${index + 1} (${steps[index]}) is not at least ${RAMP_VALUE_STEP} lighter than step ${index} (${steps[index - 1]})`,
      );
    }
  }
  const drift = Math.abs(warmthOf(steps[steps.length - 1]!) - warmthOf(steps[0]!));
  if (drift < RAMP_HUE_DRIFT) {
    problems.push(
      `moves its hue by ${drift.toFixed(3)} from dark to light, under the ${RAMP_HUE_DRIFT} a ramp needs; a ramp that only changes value is not a ramp`,
    );
  }
  return problems;
}

/** Every colour a kit may draw a sprite in: the core, plus the ramps that sprite names. */
export function allowedColors(core: readonly string[], ramps: readonly RampLike[], named: readonly string[]): Set<string> {
  const allowed = new Set(core.map((hex) => hex.toLowerCase()));
  for (const id of named) {
    const ramp = ramps.find((r) => r.id === id);
    for (const step of ramp?.steps ?? []) allowed.add(step.toLowerCase());
  }
  return allowed;
}

/**
 * The colours a tile uses that its own ramp does not hold: the accents the style allows, at
 * most two (ART_SYSTEM section 3). `colors` are the colours the sprite actually draws with.
 */
export function accentsOf(colors: Iterable<string>, ramp: RampLike): Set<string> {
  const own = new Set(ramp.steps.map((hex) => hex.toLowerCase()));
  const accents = new Set<string>();
  for (const color of colors) if (!own.has(color.toLowerCase())) accents.add(color.toLowerCase());
  return accents;
}
