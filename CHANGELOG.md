# Changelog

One note per tag on `main`, newest first (docs/team/PLATFORM.md section 2).

## v0.1.1 - 2026-10-11

What players notice
- A new opening: three starters (the forager, the digger and the explorer), each finding its own axe its own way, a first fire from a felled tree, and a walk toward the first dusk that closes on a night discovery.
- Saves made before this version are dropped once, with a short notice on the title screen; from now on a save always loads.
- Trees are felled with an axe and grow back in stages; one press starts the work, a step away stops it; the player walks in four directions.
- Health and danger: a countdown to dark, a lantern box, hurt and fall animations; a fall takes back what the outing brought.
- The first maze, the tangle south of the ruins, a quest from the elder.
- The workshop: a work stone, a workbench and a workshop, two chains (stone and reed), tools that wear out and tools that last, reed clothes and a lucky charm.
- A feedback button inside the game, and a short review after the opening.

What creators notice
- The site has the rules (`/hub/rules/`), the docs (`/docs/`), the boards and the API data (`/api/hub-data.json`), with Your card, Levels and Badges as coming-soon boxes.
- A read-only MCP server (`pnpm mcp`) answers the rules and checks content from a clone.
- Props that look workable must be workable; the check lists the ones that are not.

What changed underneath
- kernel 0.1.1; the hub data is rebuilt by the loop every six hours.
