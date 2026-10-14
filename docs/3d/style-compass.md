# Style compass (picked 09.10)

The product owner picked from eight stills - four styles by two subjects, each column one named
difference: A realistic, B hand-painted, C idealized semi-realistic, D grim weathered realism.
The pick is A and D together: realism is the base, with a mood axis from bright (A) to grim (D).
Both ends are in play. They are the same realistic models; the mood comes from palette, wear and
lighting, never from a second art style.

Frame: [img/style-drafts-2026-10-09.jpg](img/style-drafts-2026-10-09.jpg) - the first textured
models of both ends, generated after the pick: the warrior and the wolf, bright (A) and grim (D).
The warrior there is a style test only; the game's own cast is below. The eight stills of the pick
itself are not in the repository (see the licence note).

## The two ends

- Bright (A): realistic proportions and materials, clean readable armour, even daylight, warm
  neutral palette. Heroes, townsfolk, the valley by day.
- Grim (D): the same realism with blackened scratched steel, worn cracked leather, dried mud,
  torn cloth, a muted desaturated palette and low cold light. Enemies, the wilds, caves, night,
  cursed places.
- Rejected: hand-painted shapes (B) and idealized semi-realism (C). No exaggerated silhouettes,
  no painted highlights baked into textures, no glossy idealized faces.

## How the two ends meet in one frame

- The scene (region, time of day, weather) grades everything in view: lighting, fog and colour
  grade are per scene, not per asset.
- A character carries its own wear level as a texture variant (clean / worn / grim) on the same
  mesh, never a different shape language.
- Animals follow the same rule: one realistic body, fur state and palette by mood.

## The cast: each role reads at a glance (09.10)

The product owner's rule for the player roles, in the pixel and the 3D version alike: a role is
told apart at phone size by one big item, one colour and its own body build. The patched base
clothes underneath are the same for every role; fine attire is earned later, never given by a role.

| Role | Build | Big item | Colour |
|---|---|---|---|
| Explorer | tall and lean, long limbs | soft felt traveller's hat with a wide brim and a round uncreased crown, tall backpack with a blanket roll | moss green |
| Forager | short and slight, quick | large wicker basket on the back | rust red |
| Digger | broad and heavy-set, thick arms | spade strapped across the back, blade above one shoulder | indigo blue, worn as a hood with a short shoulder cape |

- Every role has a man as the base look and a woman option in the same kit. Ethnicity is drawn at
  random for each figure and the skin tone follows the draw, so no default look is baked in.
- No head wrap in the base kit: the forager carries its colour on a neckerchief and the basket
  lining.
- The owner approved the builds, the colours and the items from the six drafts on 2026-10-09
  (frame: [img/cast-2026-10-09.jpg](img/cast-2026-10-09.jpg), man above, woman below), with one
  correction: their hats were out of period (a creased bush hat, a modern cap, a knitted beanie).
  Headwear belongs to the game's pre-modern valley: the explorer wears a soft felt traveller's hat
  with a wide brim, the digger an indigo hood with a short shoulder cape, the forager goes
  bare-headed.
- The spade and the basket are separate models, one of each, the same for the man and the woman,
  fixed to a back bone at play time (owner, 2026-10-09). The figures are generated without them:
  in three of the six drafts the item came out wrong (a spade held in the hand, a basket in the
  hand, a pick instead of a spade), and an item fused to the body stretches with the arms. The
  explorer's backpack came out right and stays part of the figure unless it stretches in the rig.
  The rig keeps empty hands; a tool the role works with is held as a separate prop at play time.
- Later rounds: Elder Maru and Pell (as drawn in the game); other roles only when the owner names them.
- The decision record is DECISIONS.md, 2026-10-09.

## Prompt clauses for generators

- Base: "realistic adult proportions, physically plausible materials, soft even studio light,
  plain light grey background".
- Bright: "clean well-kept gear, warm neutral palette, no stylization".
- Grim: "blackened scratched steel, worn cracked leather, dried mud, torn hem, muted desaturated
  palette, no stylization". For animals: "matted dirty fur with scars and bare patches, lean
  build, muted desaturated palette".
- Never name a reference game or publisher; describe the look.

## Licence note

The eight stills were made with Canva's image generator as references for the look only. Their
terms for reuse could not be checked, so they stay out of the repository and out of the game.
Both frames above (the style drafts and the cast) show models generated with Meshy (meshy.ai)
on the free plan, licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/); credit:
"generated with Meshy (meshy.ai), CC BY 4.0". Every shipped asset keeps its own licence line in
`game/public/3d/models/README.md`.
