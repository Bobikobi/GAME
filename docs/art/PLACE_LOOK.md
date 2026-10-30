# A place's look: one card, one board, one check

The owner, 27.10: a town or an area is built by agents with several tools, and he wants it rich and full of detail, but with logic. A desert town must read as a desert town, and no colour or style may come in from another place just because another tool drew it. He does not want to be asked what each climate looks like; he wants to approve a place once, and then have the place hold together.

This file is that procedure. It applies to every new place: a town, a district, a land, a camp, a ruin, a stamp a creator adds. It sits on top of [REUSE.md](REUSE.md) (look for what exists first), [PROP_FROM_REF.md](PROP_FROM_REF.md) (one object from an outside picture), [NATURE.md](../design/NATURE.md) (climate, scale, weather) and [ART_SYSTEM.md](../design/ART_SYSTEM.md) section 3 (ramps), and repeats none of them.

## 1. The place card, before anything is drawn

The agent that builds a place writes its card first, in `docs/design/places/<place-id>.md`. One screen, these fields:

| Field | What it says | Example: a desert caravan town |
|---|---|---|
| World and people | Which of the three worlds it belongs to (DECISIONS 2026-10-22), or the neutral valley; who lives there and what they do | Human world, traders and water-sellers |
| Climate | One of NATURE section 2's climates | Dry |
| Materials | What things are made of, at most five | Sandstone, mud brick, palm wood, undyed cloth, glazed tile for the rich |
| Shapes | The shape language: roofs, openings, silhouettes, what repeats | Flat roofs, round arches, thick walls, small windows, awnings |
| Ramps | At most six colour ramps, by id: the shared ramps of `tools/src/kit/palette.ts` first, a new ramp only when none fits (it then passes the ramp rule) | stone, wood, a sand ramp, red for awnings, teal for tile, skin |
| Accent | The one colour that is allowed to shout, and where | Teal tile on the well and the rich house only |
| Light and sound | The default air, the light, the sound bed (NATURE sections 4 and 5) | Hard sun, short shadows, wind and distant bells |
| Landmark | What is seen from far away (OPEN_WORLD: one landmark per region) | A tall wind tower |
| What is there | The props and items it needs, each marked "exists" (with its kit id) or "to draw" | Well (to draw), market stall (exists, recoloured), water jars (to draw) |
| Never here | What would break it | Green meadow, pine trees, a thatched roof, snow |

## 2. References: real places first, then games, and only to learn

Before the card's materials, shapes and ramps are written, the agent collects references, and only to learn the common language of such a place, never to copy:

- **Real places, 6 to 10 photos**, from a source that states the licence of every image: Wikimedia Commons first (it has an API and a licence on every file). A web image search without a licence is used to look, never stored in the repo.
- **Games of the same kind, 2 or 3 screenshots**, from the compasses the owner named (Graveyard Keeper for nature, Drakantos for characters, Dimraeth for depth) or a game known for that kind of place. These show how pixel art simplifies the place; they are never traced or redrawn.
- **The palette is taken from the photos by a script, not by eye**: the common colours of the references, grouped, then matched to the nearest shared ramps. That gives the card's ramps a reason a reviewer can check.

The references and their sources (URL, licence, author) go in the card. Images under a licence that allows it may be kept in `docs/design/places/<place-id>/refs/`; any other image is linked, not stored.

## 3. One board for the owner, one answer

The owner sees one board at phone size, opened in his browser: the references in a strip, the card's colour ramps as swatches, and **one still** of a corner of the place drawn in the card's language. He answers once. That is the direction for this place, recorded in DECISIONS with the still as its frame. After it, everything inside the place is polish: the builder iterates and does not ask again.

A place in a climate or a world that already has an approved card starts from that card. Only what differs is put to the owner, and if nothing differs, nothing is.

## 4. The check: the place holds its card without anyone remembering

After the owner's answer, the card's ramps become data and `pnpm check` holds the place to them:

- a place declares its ramp set (at most six, ART_SYSTEM 3) where the place's map or chunk data lives;
- every sprite placed in the place uses only the core and the place's ramps; a sprite drawn by any tool that brings in a colour from outside fails, with its name and the colours it brings;
- a sprite placed in two places with different ramp sets is either in both sets or recoloured per place by a ramp swap (ART_SYSTEM 3, dyes), never left as it is;
- the place's sheet: a contact sheet of every sprite in the place side by side at phone size, built by the same command, so a style that does not belong shows at a glance.

The check is built by the first place that needs it, as its own small pull request before the place's art lands, because the ramp set needs a home in the place data first. Until then, the card and the board apply, and the contact sheet is made by hand.

## 5. The kinds of places: a starting card for each

The owner, 27.10: the guide is for what will come too, not only for what exists. Each kind below is the starting card a builder copies into its place card and then refines from its own references (section 2). These rows come from the common language of each kind in real places and in pixel games. They are a starting point, not a pick: the place's board (section 3) is where the owner sees one. Ramp ids are the shared ramps of `tools/src/kit/palette.ts`; a ramp marked *new* does not exist yet and passes the ramp rule when it is first drawn.

| Kind | Materials | Shapes | Ramps | Light and air | Never here |
|---|---|---|---|---|---|
| Temperate valley (approved, DECISIONS 2026-10-20) | Timber, thatch, fieldstone, plaster | Pitched roofs, fences, gardens, winding paths | green, wood, bark, stone, water, red | Soft sun, morning mist by water | Sand, palms, snow |
| Tropical coast or jungle | Bamboo, palm thatch, rope, wet stone, bright cloth | Stilts, steep leaf roofs, open walls, big leaves layered in height | green (deep end), moss, teal, wood, *new* sand, red or plum for flowers | Strong sun broken by canopy, humid haze, rain often | Pines, snow, bare plains |
| Desert town | Sandstone, mud brick, palm wood, undyed cloth, glazed tile | Flat roofs, arches, thick walls, small windows, awnings, walled yards | *new* sand, stone, wood, red, teal (tile only), skin | Hard sun, short dark shadows, heat shimmer, dust | Meadow, thatch, fog |
| City cut in rock | Living rock, carved stone, iron, little wood | Facades carved into cliffs, stairs, terraces, bridges between ledges, deep doorways | stone, grey, rust, fire for lamps, wood (sparse) | Light from above in slots, shaded alleys, lamps by day in the deep parts | Free-standing timber houses, wide lawns |
| Cave | Rock, wet stone, moss, crystal or ore as the one accent | Irregular walls, low and high chambers, narrow passages, pools | grey, stone, moss, teal or plum for the accent | Dark; light only from the player, fire, fungi or crystals (the night's light-pool rule) | Sky, grass, straight walls |
| Deep underground (a buried city, a mine) | Dressed stone, timber props, iron, rails, old brick | Straight shafts and halls, arches, supports every few tiles, signs of the people who dug it | stone, grey, wood, rust, fire | Lamps in pools, dust in the beams, no daylight at all | Plants that need sun, open sky |
| Snowy peaks | Snow, ice, bare rock, dark pine, stone huts | Sharp ridges, cornices, steep paths with steps, low heavy huts | grey (light end for snow), stone, *new* ice, green (dark end only, pines) | Bright and cold, blue shadows, wind and blowing snow | Warm greens, oaks, tall grass |
| Marsh | Mud, reeds, rotten wood, moss, still water | Boardwalks, stilts, half-sunk shapes, low horizon | moss, teal, bark, rust, water (brown-green) | Fog most mornings, soft overcast | Clear blue water, sand |
| Elf world, far north (DECISIONS 2026-10-22) | Living wood, leaves, pale stone, cloth in sky blue | Dense branching forest, homes grown into trees, curved lines, wayside stalls | green, moss, bark, water, plum, *new* sky-blue cloth (the elf cloak's) | Dappled light, motes, a little magic glow | Iron, brick, straight streets |
| Human world, the city across the bay | Dressed stone, brick, slate, timber, iron | A serious city: walls, streets, harbour, boats, signs of technology | stone, grey, wood, red, water, rust | Plain daylight, smoke from chimneys | Living wood, glowing plants |
| Undead world, the night ruins and below | Broken stone, bone, dead wood, iron gone dark | Ruins, arches, crypts, tilted graves, the arch to below | grey, stone, bark, plum, *new* cold green as the one accent | Dark, the night's light pools, fog | Bright greens, clean new buildings |

A builder who needs a kind that is not here adds its row in the same pull request as its place card, from its references, and the owner sees it on that place's board.

## 6. What this does not change

The direction rule (AGENTS.md) still holds: a look that changes the whole game is tried as two or three stills. A place card is one still because the art style, the scale and the light are already decided; only the place's own language is new.
