# Changelog

One note per tag on `main`, newest first (docs/team/PLATFORM.md section 2).

## v0.1.11 - 2026-10-31

What players notice
- The valley floor is drawn in the rich 64 px art: one continuous olive meadow varied by tone, tufts and seed heads, flowers sparse, and soft wandering joins where the grass meets a path (wave 1, the owner's pick after two passes). The plants, stones and small things of the first ten minutes follow at 64 px, 21 pictures (wave 2).
- The opening's bank path is two to three tiles wide, uneven and rounded, instead of one straight tile.
- The grass and the paths are drawn in the rich 64 px art too (wave 3): calm olive grass with leaning blades and soft lighter drifts, a worn ribbon of path inside its band, a darker damp sand on the bank, and the places where two kinds of ground meet cut per pixel instead of by tile blocks. The tall things of the opening and the town follow at 64 px: the lantern post, the broken statue, the market stall and the small house (wave 2c, the owner's yes on every draft).
- The small props stand in groups instead of single scatter: flowers in threes and more, drifts of tall grass, berry bushes, and the second well in one home near a path. Plants cast shadows now, and flat things (rubble, pebbles, logs, fences, fires) still do not.
- Light follows the hour: from 17:00 lamps and fires cast pools of light, the figure is lit by what it stands near, clouds drift their shade over the ground, and dusk and night take the tint the owner picked.
- The dark frame around the phone's view is an edge by day, not a veil: at noon the grass shows its own colour to the middle of the screen; the veil returns with the night.
- The top bar wears frame D on phone, desktop and landscape: lacquer black with a hairline of lit gold on the meter, the chips, the tracker, the toasts, the buttons and the pocket map.
- A Settings window, opened from the menu: quality (Auto, Low, Medium, High), frame rate (Auto, 30, 60, 120), mute and the accessibility switches, each change applied at once. While a row is on Auto it shows what Auto chose on this device.
- Sounds are re-levelled so a jingle no longer peaks loud, and every effect fades with its distance from your character, with other players in mind.
- The three races walk with their own looks (human, elf, skeleton), and the walk is picked by the distance covered, so a planted foot never skates when the pace changes. The elf's cloak is green.
- Handing Maru the coin under the lantern pays a key to his house, not 20 gold.
- The Quiet glade grows glade figs, and sunleaf is slow to open in the fog.
- The Traveller's cap: a plaited reed cap with a cord tie, made at the workshop from reed and reed cord, the first thing worn on the head (CeosIsrael).
- The home page no longer shows the 3D door while 3D is paused.

What creators notice
- A creature kind can carry its behaviour (sight, ear, smell, the quiet-state weights, roam, flight, sleep, alarm), its group and its den; the hare, the crow, the roe deer and the wolf are written in those fields, and `pnpm check` gains the wild rows (weights that sum to 100, habitats the map has, no pack at danger 0, a bolt hole the den can reach).
- The hunt's foundations: a kind may say what it drops, an item may be a finer grade of a good, the kernel can dress a carcass, and the value solver prices a hunted kind like any other source. Ten hunt goods are in the core items.
- The wild brain is written as pure, integer-only functions (senses, the noticing count, the states, flee maps, groups), tested before anything steps an animal.
- The balance playtest, `pnpm map:playtest`: the simulated player plays the scripted opening, first outing and first sale on the kernel, one run per start, and prints its level against the difficulty reckoning's at every place it reaches (CeosIsrael, NEXT 19 b).
- The hunt ladder calculators and their generated page: tools by tier, value per catch, difficulty and rarity, counted on the real map at every run.
- Animals as native bodies for the hunt stream, each a CC0 model passed through Blender with pick pages for the owner: the roe deer and the white hart from one body, the wild boar, the ground fowl, and the wolf's Alert, Graze and Lie.
- The art production line grows: `pnpm art:pick` applies the owner's pick and `pnpm art:gallery` is the page he picks on; `art:wave --redo` draws again an entry he liked and asked for more of; `kit:gen --drawer gemini-web` draws a prop through Gemini's image tool on the owner's subscription; `art:measure` ranks drafts by size, a clear corner, one body, a foot, colours, palette and detail, as a filter only. The restored pool is triaged (764 drafts with review states and contact sheets) and every draft lives in a release store (`pnpm art:drafts fetch|verify|push`); `pnpm art:stray` finds unindexed art before a worktree is removed. REUSE.md: reuse first, then open and free assets, then draw.
- NEXT.md gains the presence section: players who see each other without chat, its wire shape and its proof in CI.
- New design pages: creature behaviour, hunt families and the content ladder; the lighting ladder's stills; the progression map; the first map's plan A2. Decisions recorded: music by sampled instruments by default, the home page's door as a live window on the town later, the animals' brain approved.
- The kit density test reads every kit, not only the core's, so a creator kit at 64 px no longer turns CI red.
- CI: the browser checks lose their dead time (9 min 56 s to 8 min 42 s), and the opening's criterion 8 measures play, not the run's own day skip, so a slow runner no longer fails it.

What changed underneath
- kernel 0.1.11 (simulation 0.22.0): the `dress` action and the carcass, the hunt and grade fields on kinds and items, the den's bolt hole drawn on the server only. The save format is unchanged; a v0.1.10 save loads as it is.
- The schemas gain the creature behaviour, group, den and hunt fields; nothing under `content/` steps an animal yet.
- The site shows the 3D door only with `SITE_3D_DOOR=force`; `/play3d/` still builds and plays.


## v0.1.10 - 2026-10-30 - Loomvale

What players notice
- The game is called Loomvale, and it lives at loomvale.vercel.app.
- The valley is redrawn as a larger map at 64 pixels a tile, with new paths, rocks and banks, and more of the world in the rich art style, each sprite with its own ink edge.
- The forager's first task is now "What holds the keystone": herbs grow thick around the bridge's missing stone, and picking them frees it.
- The name is chosen in one place for every race: the title screen has no name field, and you carve your name on the returners' stone after the bridge.
- Bags go on your back. You carry 12 things with nothing there, 24 with a satchel (made at the workshop or bought from Pell) and 36 with a frame pack. Weight sets one of three walking paces, and you can put things down and pick them up again.
- Press A beside a hollow log, a hollow tree or a heap of branches to search it. What you find is drawn once a day, and it refills at dawn.
- Fishing: make a rod, find the fish in the river and cast. River stones are mined the way trees are felled, and mining trains digging.
- The health bar is your health: no hunger clock drains it.
- A new player's starting gold shows beside the purse as "starter gold", spent first and only at the shop.
- Pell's counter is sorted into named groups instead of one long list.
- The game's interface has its new look: a wooden frame, canvas panels and the Jersey 15 face.
- The skill tree screen pans and zooms over a tree of any size: drag or the wheel on a computer, one finger and a pinch on a phone.
- The camera comes closer: a phone shows about 6 by 13 tiles instead of 9 by 20, and a computer screen about 11 by 7 instead of 22 by 14. The character keeps its size, so the world around you is the part that grows.
- Pell's shop is a room you walk into. Her stall is now a small house: step into its door, talk to her across the counter, buy or sell there, and walk down to go back out to the valley.
- The ground has height now: you cannot step off a rock face. A climb of one to three levels is open only at a crossing, and a mountain band of more than three levels is never walked.
- The walk has a bob, one step lifts the figure a little, and the townspeople breathe and blink on their own beat. Nothing of it moves with reduced motion.
- You can run and sneak: hold the thumb on the stick (Shift on a keyboard) to run at twice the pace, or tap Sneak beside A and B to creep at half. The wolf hears you by your gait: a run is noticed at 8 tiles, a walk at 5 and a sneak at 3.
- Every window wears a new frame: black lacquer with antique gold, a gold plaque for the name, and the Cinzel face for titles. Choices in a dialogue are a list.
- The home page on a phone gets its pass: it opens on the key art as a portrait still with the navbar as a night band above it, the headline "Write the valley back", and Play free and Build a place stacked low where a thumb reaches. A phone still downloads no video.
- Rocks, signs, trees, houses and people sit on their tiles: a cast shadow laid one row too low made them look lifted off the ground, and it now falls up-screen behind them.
- The game picks its quality and its frame rate from the device (low, medium or high; 30, 60, 120 or the screen's own). There is no settings screen yet; `?stats=1` on the address shows the frame times.

What creators notice
- New art is drawn at 64 pixels a tile: the check refuses a new 16 px sprite, and every rich sprite gets an ink edge the check measures.
- Every pull request names its place in the skill tree (the `Tree:` line) and, for story text, a `Story review:` line; CI asks for both.
- The skill tree is content: schools, nodes, keystones and prices in bands, held by `pnpm check`; `pnpm tree:coverage` shows the tree's thin spots.
- `pnpm` gains the difficulty reckoning and the balance prover, the map's plan block with its first-night check, and the art production line (`pnpm art:status`, pools, waves and every draft kept). `pnpm art:status` reads what is drafted, and the GPU time used in the last week, from the drafts index, so it is right on any checkout.
- The creators guide starts with a townsperson of your own, with lines for the four standings, and the template quest is given by her.
- The creators board and the credits are regenerated by each release; a pull request that changes the board to anything but what the history gives is refused, and a vote option counts only when the loop wrote it.
- A developer with their own GitHub account and no write access has a numbered path to a first code pull request (`docs/team/ONBOARDING.md`: fork, branch from `upstream/develop`, checks, the CLA, review), and CONTRIBUTING points to it.
- New design pages: the animation set and the feel layer (`ANIMATION.md`), the bestiary of the first twelve animals, the hunting and combat numbers in one table, the first map's plan, the sea crossing memo, and the community and launch plan.
- The art production line gains `pnpm art:wave` (cuts a pool's missing entries into Kaggle jobs within the weekly GPU budget, `--unheld` leaves out entries an owner call holds) and `pnpm art:run` (works the jobs, one retry, pauses if Kaggle is down). A pool entry marked `creature: true` goes into its own kernels, which draw with a negative prompt that does not forbid animals (`KAGGLE_NEGATIVE_KIND=creature`); a wave with no creature entry plans the jobs it always did. The first map's ground and props are in the pools, and 54 drafts wait for the owner's pick.
- The UI palette gains an antique-gold ramp and two blacks (40 colours, for windows only); the 32-colour core palette for sprites is unchanged.
- The clip tool can play a native four-legged body, and the wolf has a walk, a run and an idle.
- `content/core/params.json` gains a `gait` group (run is half the step, sneak twice, and the noise radius by gait); `pnpm check` refuses a pace that does not divide by it.

What changed underneath
- kernel 0.1.10 (simulation 0.21.1). Saves from v0.1.8 load: a saved hunger value becomes health, and the luck seed is widened to a 128-bit key the same way wherever the save loads.
- The draw behind every random outcome is keyed with SipHash-2-4 over a 128-bit secret.
- The game server (not live yet) gains the review's fixes: the email link completes in a real browser, one origin for the game and its API, the account name is the character's name, sign-in limits and timeouts, and the boards accept a kept opening. The sign-in link can now be mailed for real: `MAILER=resend` sends it through Resend, and the server refuses to start in that mode without a key and a sender address. `log` stays for a laptop or a staging box. The deploy runbook names the box's public name in one place (`PUBLIC_ORIGIN`) and records the staging run.
- Docs-only pull requests skip the browser tests, the browser tests run in parallel jobs, and a flaky script retries once.
- One step rule (`makeStepRule`) decides every step between two tiles; the walk's search, the server's travel check and the reach and difficulty tools all read it, so they cannot disagree. A test guards that the hall's road stays open after its log is felled.
- The classic client streams the world in 64 by 64 tile chunks, three by three around the player, baking ground pages while idle; the valley is one chunk, so it plays as before.
- The game server looks the sign-up's country up itself from a country file inside its image (`COUNTRY_DB`), so the age limit no longer needs a module on the host; a miss holds the sign-up to the highest age.
- The phone home's weight budget moves from 300 KB to 450 KB, because the key art still alone cannot fit under the old one; a test reads the markup to hold that a phone is given no video source.
- The feel layer is a pure module (`game/src/feel.ts`), tested and cheap per frame.

## v0.1.9 - 2026-10-23 - the new desktop home

A site-only release: the game is unchanged and stays at v0.1.8.

What players notice
- On a computer, the home page now opens on the painted valley at dawn: the elf, the human and the skeleton in a quiet looping video, with Play free and Build a place over it. With reduced motion turned on, the still picture shows instead.
- The bar over it leads to the Leaderboard, Developers, the Guide and GitHub, and Play is the one gold button.
- Every page ends in a new footer with Play, Build and Community links.
- On a phone the home page is unchanged and downloads no video.

What changed underneath
- The site self-hosts two OFL faces (Cinzel, Manrope) for the desktop home.
- Tests guard the phone home weight (under 300 KB), the desktop first paint (under 600 KB) and each video (under 12 MB).

## v0.1.8 - 2026-10-23

What players notice
- A new game starts with a race: human, elf or skeleton, each a card with its six attributes. Where you wake is drawn for you from three places (the north meadow, the west bank or the slid bank), the same for every race, and the tool of that place lies on the ground by you to pick up. For now each race is drawn with one of the old figures; their own art comes later.
- A game saved before this update goes on: the explorer is now a human, the forager an elf and the digger a skeleton, with everything they carried and did. One line says the valley was updated since your last visit.
- Outside the town you can build a fire of your own from two logs. While it burns, it and the ring around it are safe ground, and a hunt ends there; its flame shows how much wood is left. It cannot be built in the town, during a chase or where a wolf keeps watch, and a refusal keeps your logs. The long night is now kept at your own fire; Maru's hearth is still there for anyone to feed.
- The afternoon has two new tasks. Pell asks you to dig the collapsed hall south of the ruin gate for a bowl that came out whole, and pays a reed basket that picks faster. Then Maru asks for a herb stew with the grove's mushrooms, which now open at 17:00, pays two dry branches and opens the long night. A few of their lines differ by race.
- The opening comes in a calmer order: in town Maru and Pell each offer one task, the coin under the lantern waits for Maru's bells, and the arch at night comes alone, before the tangle and the south bank. The long night pays a bandage, and lines that told the past now say what is there or who says it.
- The bag is now the Field Kit: one window with Bag, Outfit, Skills, Shop and Journal, in a type that is easier to read. Outfit shows your character and every worn place; Skills shows your real attributes and levels. On Shop you can lay out a stall of six places with a quantity and a price each, and the save keeps it. Nothing sells yet.
- Menu has a Map: it draws only the ground you have walked and names only the places you have stood in. On a computer a small chart sits in the corner. At the town's empty corner, beside the trader, you can place your stall marker and lift it again.
- The valley answers small things. A berry drops under a bush left full for a while, birds lift over a find you have not seen yet, and fish ring the water at dusk. By day a cloud's shade drifts across the ground, and fog banks gather before dawn and after dusk; with reduced motion they keep still.
- Thirty-five items and small props are redrawn at four times the detail, in a deeper palette: among them the berry, the herbs, the axe, the log, the trowel, the basket, the chest, the sign, stumps, fallen logs, mossy rocks and mushrooms.

What creators notice
- Three races replace the three starters. A `race` record names six attributes that add up to 7, two home attributes, how each world grades it, an outfit of up to three worn pieces and its sprite. A wake pocket (`pocket`, core only) holds the wake tile, its mist and one to three stacks that lie on its ground. The `starter` kind is gone, and a quest's or a dig spot's `starter` field is now `pocket`. Attribute `carry` is now `might`, and `spirit` is new. Format version stays 1.
- A line may differ by race (`when.race` on a remark or a topic, and a quest's `talk.variants`); the check refuses a quest, spot, shop or recipe gated by race.
- A new `reaction` record: something on the map makes a node appear, waits its respawn longer or shorter, or shows a cue (`birds_lift`, `fish_rise`). It may hold on the day's weather (`clear`, `rain` or `fog`). The extension template drops a plum below a full bush, and the creator guide has a section on reactions.
- A quest's `tend` step and the `feed` action may name `fire: "own"`, the player's own fire. Tools gain the kinds `hammer` and `pick`. A map may name its `world` and its `regions`.
- A kit may declare `ramps`, and a sprite may name the shared ramps of the deeper palette it is drawn in; the check holds each ramp to the ramp rule. A kit sprite may declare its `scale` (its height in characters), and the check warns when it is under its kind's floor. A map body may name its `climate`. The colour count per tile and per phone window is a warning, not an error.
- `pnpm kit:gen` can draw down three routes, `--drawer codex`, `gemini` or `kaggle`, and ships the rich wave's specs for items and small props.

What changed underneath
- kernel 0.1.8 (simulation 0.14.0). Saves keep version 2, and the state moves to format 2: a v0.1.7 save loads with each starter mapped to its race and pocket, `carry` read as `might` and `spirit` at 0, and a dug slid bank stays dug. A loaded character keeps its old six attribute points; a new one starts with its race's seven.
- Races are in the engine before their art: the race figures, the outfit's worn sprites and the 3D models fall back to the old starters', the whole bowl uses the shard's sprite, and `spirit` is defined but no rule reads it yet. World grades are 0 everywhere, because the valley is neutral and no other world is built.
- Each region gets one weather a day, chosen from the world's seed, and two core reactions read it (mushrooms by a fallen log on a rainy day, reeds back sooner in rain). Rain and fog as weather are not drawn yet.
- The game server of stage 2a is in the repository: the game API, its database and migrations, sign-in with Google or an email link and an age gate, the opening handed over from the phone, the gold ledger that replays, and boards scored only from a verified log. Players cannot reach any of it yet: the demo plays on the phone's own save, and nothing goes public before the sign-in review.
- Both game doors talk to one session interface, so the same screens can later run on the server; a screen no longer sees the world's seed.
- The light is one module with an hour table in `params.json`, and the sun's shear sits beside it; today's look is unchanged.
- The e2e plays an opening for each wake pocket, the map and the shop's stall draft; CI runs the server's database tests and a simulated player against postgres 16.

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

What creators notice
- Nothing new for creators.

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
