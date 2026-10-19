# Changelog

One note per tag on `main`, newest first (docs/team/PLATFORM.md section 2).

## v0.1.7 - 2026-10-19

What players notice
- Each start wakes in one box of two lines, shown whole, so the first step is one tap away, and the bridge's task is in the tracker from the start.
- A conversation option is the quest's own title: no more "Task:", "About:" or "Hand in:" in front of it. Maru no longer speaks of Pell's herbs.
- The bridge's sign is now the returners' stone: six names and a last line that you carve. The name on the title screen is optional ("carve it later"); after the mend the camera goes to the stone and holds there while it speaks, and then you cut your name.
- A success no longer shakes or flashes the screen: what you made or mended glows softly for a moment, and the level banner fades in. The screen still jolts when you are hurt or seen.
- By day the wolves are away. Their den and the paw prints along their round show where they hunt; at night they come back out of the den.
- The world is drawn at your screen's own pixels, so on a sharp phone the pixel art stays crisp.

What creators notice
- A kit sprite may say `density` 1 (16 px per tile, the default) or 4 (64 px per tile), and the kit check measures each one on its own grid. The field is additive; format version stays 1.
- The returners' stone reads its names, its default word and its purse lines from the restore's `stone` field.
- An extension's new item no longer needs an edit to the journal test.
- Until five creators have had an extension merged, one approval merges an extension.

What changed underneath
- kernel 0.1.7 (simulation 0.10.0). `start` accepts an empty name and a new `carve` action sets it once. Saves from v0.1.6 load unchanged and keep their name.
- The canvas draws at device pixels at a whole-number zoom, and the ground is baked in 16 by 16 tile chunks once any tile is 64 px.
- Every e2e test writes its screenshots where CI uploads them when a run fails.

## v0.1.6 - 2026-10-18

What players notice
- The opening begins in the mist. Each starter wakes in a small clear pocket of near-black, dithered mist, 5 tiles around them, and their first task pushes it out to 7. A reload keeps it.
- The explorer follows a mote of light to the glint by the bridge and must take the glint before the keystone opens: "Something else catches the light first."
- Mending the bridge opens the valley: the mist draws back 14 tiles in about two seconds, a far bell rings once, and the town's smoke rises at the edge of the view.
- The opening's lines say what is true. The forager's first task is a question ("Something on the west bank fits your basket"), the first fire is "A fire across the river", Maru no longer tells you to stay in at dusk, and Maru and Pell each say what their errand pays.
- In the 3D door the bank wolves are models, asleep by day; at night only their two red eyes show.
- On a slow phone or computer the world keeps real time from the first moment: work, walking, the wolf's hunts and the fires no longer crawl after the game starts or the tab comes back.

What creators notice
- New optional fields, all additive (format version stays 1): a starter's `pocket` and `pocket_grown` (the clear mist around its wake, before and after its first task), a restore's `mist` (the tiles it clears once mended) and `stone` (names, a default name and purse lines for the returners' stone; nothing reads it yet), and a resource node's `opens_after: <quest id>` (it opens only after that quest).
- `pnpm kit:gen` has a motif-scatter route for ground tiles: the model draws small motifs and the script lays them out across tile edges and measures the seam. Tools only: no kit art changed in this release.

What changed underneath
- kernel 0.1.6 (simulation 0.10.0). Saves from v0.1.5 load unchanged.
- The stealth beat and the vigil of the long night run as state tests on the walk's own rules; the stealth e2e takes the covered bank road.
- CI proves the e2e on every pull request; a machine runs it only to debug a red run.
- The 2D world advances on the browser's real frame time, capped at 250 ms like the session's own step, instead of Phaser's held delta (#194).

## v0.1.5 - 2026-10-18

What players notice
- A bank wolf walks its round after dark on the west meadow, its two eyes glowing toward where it heads; tall grass along the water hides you from it. Pell has a new errand on the south bank, for moonreed that grows there from 20:00 to midnight, and he now has a line for a player the wolf has bitten.
- Maru's hearth beside his house can be kept burning by hand with the Feed button. His quest "the long night" asks you to keep it alight until dawn; the journal says when a log still fits and when dawn is yet to come, and a vigil that comes up short at dawn says so.
- In the dark the wolf is two steady red eyes. When it sees you it growls, its eyes flare, a "!" stands over it and one red line says so, and you see it run at you.
- When a kept fire goes out, the night says so at once, wherever you stand: one red line, "tonight is lost", and a douse. The warning before a kept fire runs low opens wherever you stand, a burning fire crackles when you are near it, and Maru stands in the hearth's light at night.
- Stepping into a maze's frame shows the whole maze from above for three seconds. How much it shows depends on the maze: the tangle south of the ruins shows a faint route line and its landmarks.
- A fire takes a log whole or not at all, so a log is never wasted on a full fire; a hunt you outrun gives back most of what its bites took.
- Pop-ups come two at a time and sit low on a phone, above the action prompt; the quest tracker, the chips and the pop-ups are bigger (16px).
- The mist over an empty building plot is a soft patch with a feathered edge, no longer a pale square.
- The ruin sign no longer offers the creator guide, and the menu no longer has a "Creator guide" button: the developers' pages are reached from the home page only.

What creators notice
- New in the format, all additive (format version stays 1): an `expedition` content kind (a place, the bells of its night window, a safe exit, a chain of 3 to 5 quests and one climax; the checks are G36), `quest.maze` with `tier` 1 to 4, the `area` that frames the maze and an optional `landmark`, and a new bounded param `hazard.predator.refill_bp` (7500, from 5000 to 10000) for what an outrun hunt gives back. The creator guide documents the maze block.
- The kernel now tells a creator's client when a hunt begins (`seen`), when it ends in a safe place (`safe`) and when a vigil fire goes out (`fire_out`), and exports `nextLogAt`, `burnsAsWood` and `tendHolds` so a client asks the kernel instead of keeping a copy of its rules. `fire.cap` has a minimum of 2, and the check refuses a fire whose warning would open before a log fits.
- An expedition's climax can carry one to three narrator boxes (`climax.lines`), additive and optional.
- Search engines and AI readers find the project: every page has a canonical link, Open Graph and structured data, the site serves `/sitemap.xml`, `/robots.txt` and `/llms-full.txt` (the README, the contributing guide, the roadmap and the creator guide in one file), and the plan with the steps that wait for the owner's yes is in `docs/team/SEO_GEO.md`.
- Every page has a share card: the bridge after the mend, with no player name on it.

What changed underneath
- kernel 0.1.5 (simulation 0.10.0). Saves from v0.1.4 load unchanged; a `tend` step is now met only at or after its night's dawn (05:00).
- The hub refreshes hourly: production gets fresh hub-data, usage counts included, and nothing is deployed when nothing changed (`pnpm hub:same`).
- The opening e2e waits for dialogue and focus before picking an option, and covers the ruin sign without a guide.
- `pnpm kit:gen` redraws a kit sprite with an image model onto the kit's grid, with a text-grid route for ground tiles. Tools only: no kit art changed in this release.
- The hourly refresh refuses a deploy hook that is not a Vercel address, and its request times out instead of hanging.
- The e2e presses a minigame from inside the page, retries a walk check that saw too few frames, and confirms a task only while it is not yet taken.

## v0.1.4 - 2026-10-15

What players notice
- At night the mist no longer blurs your character, and a lit lantern throws a sharp pool of light into the dark around you.

What creators notice
- Every creator has a page on the site, `/hub/creators/<handle>/`, that lists their records with visits, pickups and reports.
- The game counts when a record is visited or picked up, where players stop in the opening, and one short report per record per browser. It uses no cookie and no identity. The counts reach the creator pages each time the site is deployed.
- New in the format, kernel half only (the client halves follow): a predator's `round`, `pace_ms` and `eyes`, and `cover` on props (check G47); fires kept by hand, with the `feed` action, the `tend` quest step and `lit_by` (check G48). New params: `hazard.predator.pace_ms`, `hazard.predator.eyes`, `fire.cap`, `fire.log_ms` and `fire.warn_min`.

What changed underneath
- kernel 0.1.4 (simulation 0.7.0). Saves from v0.1.3 load unchanged, with no fires burning.
- The site's server routes (`/api/feedback`, `/api/s1/`) are Astro functions. The stage-1 store is Upstash Redis from the Vercel Marketplace (PLATFORM.md 9.4).
- The repository is public, and CI runs on every pull request.

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
