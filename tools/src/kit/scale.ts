/**
 * Scale, the floors of NATURE section 1 and STYLE 1b, worked out without the disk so it can be
 * tested: which kind a sprite is by its name, the height in characters that kind may not fall
 * under, and what the check says about a sprite's `scale`.
 *
 * A number is a floor and the size of the common one; bigger is open (STYLE 1b). Where a page
 * gives a range, the floor is its low end; where STYLE 1b picked one number on the owner's look
 * (20.10), that number rules.
 */

/** One kind of thing with a floor, and the words of a sprite's name that make a sprite that kind. */
export type ScaleKind = { kind: string; floor: number; words: readonly (readonly string[])[] };

/**
 * The kinds, most specific first: the first whose words all stand in the sprite's name wins, so
 * "young_tree" is a young tree before it is a tree. Words are the name's last part split on "_"
 * and "-". A kind with no `scale` on the sprite says nothing; the floors only hold a declared size.
 */
export const SCALE_KINDS: readonly ScaleKind[] = [
  // people (STYLE 1b, the owner's pick of 20.10; NATURE 1)
  { kind: 'child', floor: 0.65, words: [['child'], ['kid']] },
  { kind: 'elder', floor: 0.9, words: [['elder']] },
  // animals (STYLE 1b where picked, NATURE 1 for the rest)
  { kind: 'bird', floor: 0.1, words: [['bird'], ['sparrow'], ['crow']] },
  { kind: 'fish', floor: 0.1, words: [['fish']] },
  { kind: 'hen', floor: 0.25, words: [['hen'], ['hare'], ['cat']] },
  { kind: 'dog', floor: 0.45, words: [['dog']] },
  { kind: 'fox', floor: 0.4, words: [['fox']] },
  { kind: 'sheep', floor: 0.5, words: [['sheep'], ['goat'], ['pig']] },
  { kind: 'wolf', floor: 0.55, words: [['wolf']] },
  { kind: 'deer', floor: 0.9, words: [['deer']] },
  { kind: 'bear', floor: 1, words: [['bear']] },
  { kind: 'cow', floor: 1.1, words: [['cow'], ['ox']] },
  { kind: 'horse', floor: 1.25, words: [['horse']] },
  // trees and plants (STYLE 1b; pines and palms NATURE 1)
  { kind: 'young tree', floor: 2, words: [['young', 'tree'], ['sapling']] },
  { kind: 'dead tree', floor: 2.5, words: [['dead', 'tree']] },
  { kind: 'pine', floor: 4, words: [['pine'], ['fir']] },
  { kind: 'palm', floor: 3, words: [['palm'], ['cypress']] },
  { kind: 'oak', floor: 3, words: [['oak'], ['tree']] },
  { kind: 'bush', floor: 0.5, words: [['bush']] },
  { kind: 'tall grass', floor: 0.25, words: [['grass'], ['reeds'], ['flowers']] },
  // built things (STYLE 1b; towers and doors NATURE 1)
  { kind: 'tower', floor: 6, words: [['tower'], ['church'], ['keep']] },
  { kind: 'house', floor: 3, words: [['house']] },
  { kind: 'door', floor: 1.3, words: [['door']] },
  { kind: 'market stall', floor: 2, words: [['stall']] },
  { kind: 'street lamp', floor: 2, words: [['lantern', 'post'], ['lamp']] },
  { kind: 'standing stone', floor: 1.5, words: [['standing', 'stone'], ['pillar'], ['totem'], ['statue']] },
  { kind: 'boulder', floor: 0.5, words: [['boulder']] },
];

/** A character sprite that is no child and no elder is an adult, the measure (NATURE 1). */
export const ADULT: ScaleKind = { kind: 'adult', floor: 1, words: [] };

/** The group a creature's sprites live in. No kit has one yet; the first creature kit opens it. */
export const CREATURE_GROUP = 'creatures';

/** The kind a sprite is by its name, or undefined when no floor speaks for it. */
export function scaleKindOf(name: string): ScaleKind | undefined {
  const [group = '', ...rest] = name.split('/');
  const words = new Set((rest.at(-1) ?? '').split(/[_-]/));
  const found = SCALE_KINDS.find((k) => k.words.some((all) => all.every((w) => words.has(w))));
  if (found) return found;
  return group === 'chars' ? ADULT : undefined;
}

/**
 * What the check says about one sprite's `scale`, as warnings (NATURE 7): a height under its kind's
 * floor, and a creature with no height at all. NATURE 1 asks for one decimal, but STYLE 1b's picks
 * (a dog at 0.45, a child at 0.65, a horse at 1.25) carry two, so the check reads the number as given.
 */
export function scaleProblems(name: string, scale: number | undefined): string[] {
  if (scale === undefined) {
    return name.startsWith(`${CREATURE_GROUP}/`)
      ? ['a creature declares its "scale", its height in characters (NATURE section 1)']
      : [];
  }
  const kind = scaleKindOf(name);
  return kind && scale < kind.floor
    ? [`scale ${scale} is under the floor of a ${kind.kind}, ${kind.floor} characters (NATURE section 1, STYLE 1b); bigger is open`]
    : [];
}
