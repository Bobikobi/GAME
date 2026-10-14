# Changelog

One note per tag on `main`, newest first (docs/team/PLATFORM.md section 2).

## v0.1.3 - 2026-10-13

What players notice
- A second door on the home page: the valley in 3D, marked as a trial. The same game and the same save: a character made at Play continues in 3D and back.
- The three starters have their own pixel look.

What changed underneath
- The 3D door is built by `build:3d` and shipped at /play3d/ only when that build succeeds; the classic game never waits for it. A machine that cannot keep up gets the lighter draw by itself.
- No kernel change; saves from v0.1.2 load unchanged.

## v0.1.2 - 2026-10-11

What players notice
- Crafting has no level wall: a recipe above your level can always be tried, at a lower chance; only a missing or too-small station refuses.
- A made good sells to the trader for 75 percent of its value; everything else still pays 50.
- The bag is sorted into Food, Materials, Tools, To wear, Treasures and Recipe scraps; items and recipes show their class and tier; the journal groups items by class and family.
- A craft row names the station it needs ("Needs a workshop of tier 2: the workbench").
- The night ruins are dangerous one step past their safe threshold: a pit and a wolf that hunts at night. The opening's own night walk stays out of reach.
- Hunger no longer drains health; health falls only to hazards and bad food, and work slows below a quarter of the bar.
- Two things heal: a first-aid kit at Pell's and a bandage from the workshop.

What creators notice
- A new parameter, `k_craft_permille` (750, votable from 500 to 900), sets what the trader pays for made goods; the check refuses a share that would let the trader pay what the shop charges.

What changed underneath
- kernel 0.1.2 (simulation 0.5.0); saves from v0.1.1 load unchanged.

## v0.1.1 - 2026-10-11

What players notice
- A new opening: three starters (the forager, the digger and the explorer), each finding its own axe its own way, a first fire from a felled tree, and a walk toward the first dusk that closes on a night discovery.
- Saves made before this version are dropped once, with a short notice on the title screen; from now on a save always loads.
- Trees are felled with an axe and grow back in stages; one press starts the work, a step away stops it; the player walks in four directions.
- Health and danger: a countdown to dark, a lantern box, hurt and fall animations; a fall takes back what the outing brought.
- The first maze, the tangle south of the ruins, a quest from the elder.
- The workshop: a work stone, a workbench and a workshop, two chains (stone and reed), tools that wear out and tools that last, reed clothes and a lucky charm.
- Sound under the mute: a soft click on each line of talk, voices pitched per speaker, night and ruin beds, a fire that crackles louder as you come near, and the stream by the river.
- A feedback button inside the game, and a short review after the opening.

What creators notice
- The site has the rules (`/hub/rules/`), the docs (`/docs/`), the boards and the API data (`/api/hub-data.json`), with Your card, Levels and Badges as coming-soon boxes.
- A read-only MCP server (`pnpm mcp`) answers the rules and checks content from a clone.
- Props that look workable must be workable; the check lists the ones that are not.

What changed underneath
- kernel 0.1.1; the hub data is rebuilt by the loop every six hours.
