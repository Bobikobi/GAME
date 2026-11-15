# The standards today

Read this page before building against a working system. Each section separates what ships, what is only on `develop`, and what is still closed.

## The fight

- The design standard is free action in real time: the server owns a fixed tick, receives inputs as they arrive, and decides every hit and bar ([combat frame](design/COMBAT.md#1-the-frame-in-one-paragraph), [tick contract](../kernel/src/fight.ts)).
- The tick is pure and integer-only; it takes server-stamped inputs and a creature pattern fixed at appearance, with no draw inside it ([implementation](../kernel/src/fight.ts), [purity proof](../kernel/test/fight-sharing.test.ts)).
- Move, attack, guard and dodge are implemented; a technique is typed but returns a plain refusal because its format has not landed ([input type](../kernel/src/fight.ts), [input test](../kernel/test/fight.test.ts)).
- **State: on `develop` and not yet released.** The kernel and golden tests exist here, `combat.enabled` is 0, and the game and server do not call the tick ([combat parameter](../content/core/params.json), [kernel decision](../DECISIONS.md#2026-11-14--the-fights-tick-lands-in-the-kernel-off)).
- Contributors can strengthen the pure tick, its boundary tests and its written contract today ([fight tests](../kernel/test/fight.test.ts), [combat frame](design/COMBAT.md)).
- Enabling fights, adding foes or techniques, and wiring the server or screen are not open starter work ([build order](design/COMBAT.md#6-the-order), [rule G35](design/GAME_RULES.md#g35-no-fighting-in-the-demo)).

## Weapons and gear

- A tool works a world node; a weapon is a separate block read by the fight, and the same hand holds one or the other ([equipment model](design/EQUIPMENT.md#4-a-tool-and-a-weapon-in-the-one-hand), [weapon schema](../schema/src/index.ts)).
- Worn gear uses head, top, legs, outfit, feet, two jewelry places, hand and back; work effects stay small and tier-capped ([wear schema](../schema/src/index.ts), [wear calculator](../kernel/src/state.ts)).
- **State: in the live game (on `main`).** Tools, work clothes, looks and bags already ship as content and are read by the worn-item rules ([core items](../content/core/items), [equipment status](design/EQUIPMENT.md#2-where-we-stand-read-from-the-content-and-the-schema-on-3110)).
- **State: on `develop` and not yet released.** The weapon grammar and derived category reader exist, but checks refuse weapon content while the fight is off ([weapon schema](../schema/src/index.ts), [category reader](../kernel/src/equipment.ts)).
- Contributors can add tools and worn work gear through the existing item and recipe schemas and checks ([creator guide](creators/README.md#a-worn-item), [item schema](../schema/src/index.ts)).
- Weapons, combat protection, attribute bonuses and garment traits are not open until their readers and owner gates land ([equipment status](design/EQUIPMENT.md), [clothing status](design/CLOTHING.md)).

## Figures

- The playable figures are exactly human, elf and skeleton, each with its own attributes, outfit and sprite references ([race files](../content/core/races)).
- **State: in the live game (on `main`).** Those three race files are unchanged from `main`, and their shipped travel sheets are in the core kit ([race files](../content/core/races), [character kit](../content/kit/core/kit.json)).
- A shipped race frame is 128 by 128 pixels at density 4; travel follows distance and the last pose is the standing pose ([sheet format](../tools/anim/README.md), [character kit](../content/kit/core/kit.json)).
- **State: on `develop` and not yet released.** The newer production lane uses kept 128-pixel race frames to prepare idle, work and fight motions, with eye and numeric gates before a clip passes ([production route](../tools/anim/prod/README.md), [route decision](../DECISIONS.md#2026-11-14--animation-routes-pixellab-is-the-main-route-gpts-animated-gifs-the-second)).
- Contributors can prepare and measure a motion in the documented tools; only a reviewed sheet enters `content/` ([animation tool](../tools/anim/README.md), [art reuse rule](art/REUSE.md)).
- New figure direction, unique fight motions and creature death sets are not open as isolated sprites; they start with full-frame owner review and the creature order ([creatures memo](design/CREATURES.md), [direction procedure](art/PLACE_LOOK.md#3-one-board-for-the-owner-one-answer)).

## Maps and lands

- The game ships one hand-made 64 by 64 valley with authored ground, heights, props, slots and a plan block ([valley map](../content/core/map.json), [map decision](../DECISIONS.md#2026-10-23--the-valley-v2-on-the-map-64x64-the-plan-block-filled)).
- **State: in the live game (on `main`).** The 64 by 64 valley is live; `develop` keeps that frame while adding authored props and slots ([valley map](../content/core/map.json), [map schema](../schema/src/index.ts)).
- A new land starts with a place card for world, climate, materials, shapes, at most six ramps, light, landmark and exclusions, then one owner board ([place-card procedure](art/PLACE_LOOK.md), [starting look rows](art/PLACE_LOOK.md#5-the-kinds-of-places-a-starting-card-for-each)).
- **State: not in this repository.** No generated land or stitched multi-region runtime is present; the infinite world remains a design draft and chunk files are checked but not bundled ([open-world draft](design/OPEN_WORLD.md), [assembler boundary](../tools/src/assemble.ts)).
- Contributors can build in declared slots and prepare a reviewed place card; a new map, land, crossing or core slot waits for a maintainer-owned map change ([creator limits](creators/README.md#your-next-step), [place procedure](art/PLACE_LOOK.md)).
- The repository's production map is an evidence table of built, planned and missing chains, not permission to add a land or its core slots ([production-map state words](design/PRODUCTION_MAP.md#1-how-to-read-this-page), [game rules](design/GAME_RULES.md#6-when-a-rule-collides-with-a-request)).

### The painted world's acceptance bars

The wide world beyond the valley is the shared goal, and its lands are painted pictures: on 15.11.2026, 15 of the 2,280 squares of the world's chart were drawn, and none is in this repository yet. A painted land enters the game only when its finished picture passes every bar below. The maintainers keep the register of these bars, and how the lands are made, outside this repository; this list is the register's public statement ([the shared goal and what stays private](../DECISIONS.md#2026-11-15--the-wide-world-is-the-shared-visible-goal-the-developers-area-is-a-feed-with-a-task-pool-in-points-and-agents-as-marked-accounts)).

- **Its card.** The land reads as its place card says (world, climate, materials, landmark) and holds nothing from the card's exclusions; the owner answers once, on one board ([place card](art/PLACE_LOOK.md#1-the-place-card-before-anything-is-drawn), [the board](art/PLACE_LOOK.md#3-one-board-for-the-owner-one-answer)).
- **Its scale.** It is judged in the full frame at the game's zoom 3 with the figure 51 px tall, and a door, a stair and a tree keep their height in figures ([painted scenes decision](../DECISIONS.md#2026-11-11--painted-scenes-at-zoom-3-the-figure-redrawn-to-the-paintings-51-px-the-full-frame-as-the-measure), [scale in characters](design/NATURE.md#1-scale-everything-is-measured-in-characters)).
- **The walk.** Only what stops a body blocks: at least 95% of standing things block at the foot, a crown blocks under 5% of its area, and every exit named on the card connects by a way one body wide ([the kernel's step rule](../kernel/src/world.ts)).
- **The seam.** Where two lands meet there is no step in tone and no hard straight edge that neither picture had, the shoreline carries across, and nothing standing is cut by the border (a maintainers' bar; no public page yet).
- **The figure.** The figure is seen wherever it can stand: at least 90% of its silhouette reaches the screen, and it is never drawn over a thing it stands behind ([see-through decision](../DECISIONS.md#2026-11-12--the-see-through-behind-tall-things-stays-the-halo-around-the-figure-is-a-trait-of-the-race-light-for-the-elf-black-for-the-skeleton-none-for-the-human)).
- **The light.** One sun and one light table per world: brightness and shadow turn through the day with no jump (under one level of brightness a game minute), and the darkest hour keeps the ground readable ([one sun](design/NATURE.md#5-light-one-sun-and-what-stands-in-its-way), [the night](design/STYLE.md#5-the-night-decided)).
- **No twin in sight.** One recognisable thing never stands twice within a screen's diagonal at the game's zoom; small ground motifs already follow the same law ([scatter, not rows](design/STYLE.md#3-grounds)).
