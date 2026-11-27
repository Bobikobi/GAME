# Changelog

One note per tag on `main`, newest first (docs/team/PLATFORM.md section 2).

## v0.1.14 - 2026-11-27

What players notice
- The title comes up first. The game's engine and the valley now load behind it, so the title answers in about 1 second where it took about 22 seconds, measured on a slow test setup (Fast 4G, a processor four times slower). If New game is pressed before the valley is ready, a "Preparing the valley" bar shows and play starts when it is. Three long freezes in the build behind the title are cut, so the first playable moment comes about 3.8 seconds sooner on the same setup.
- Walking is smoother: ground pages are painted in small strips, so walking into a new page no longer stalls a frame (reads of 140 to 824 ms in a walk, 14 or more of them before, none after, on the test machine). Preparing each ground tile's edges once also cut the time to the title from about 48 to about 17.5 seconds on the same slow test setup, before the title work above.
- Stones in the valley can be lifted, carried, thrown and set down. A small stone goes in the bag and is thrown far; a large one is held over the head, slows the walk, cannot be run with and is thrown short; a figure without enough might is refused ("That stone is too heavy for you."). A thrown stone lands where its throw fits, sinks in water and returns to its own spot after a while; stones can be piled on a tile. Pictures and drawn clips replace the stand-ins: a drawn small stone, carry, throw and push clips for the human, the elf and the skeleton, nine drawn lift clips played across the lift time, and a splash that is a ring.
- A held press charges the throw: the longer the press, the farther the stone goes, with an aim line on the ground (on a phone, hold B and drag to aim). A quick tap now throws at half the range where it used to throw at full.
- A stone you hold keeps its size: the stone on the ground is drawn at 70 percent of its former size and the human lift and carry clips follow it, so it no longer shrinks and grows as it is lifted.
- You can jump (key C, a Jump button on a sideways phone): one tile ahead, up one level, down from any height, or across water one tile wide. A fall of 1 level costs nothing, 2 a fifth of the health, 3 half, 4 or more is death. It is refused in the first minute after waking, in a fight and without breath.
- Small game can be taken before any fight: throw a river stone at small prey within three tiles, or set a snare (two reed cords and a branch, at the work stone) on meadow ground and check it once a valley day. Raw meat and hide now spoil on a clock that moves with you, in the bag and on the ground.
- Two new things to make: bellberry broth, a tier 1 meal at the camp fire from two bellberries and a wild herb, and the Wayfarer's scarf, a worn reed look for the road with no effects, made at the workshop.
- Wild herbs wait one and a half times as long to grow back while the weather is fog.
- A dig no longer turns up the scrap of a recipe you already know or carry; the other finds come a little more often for a player who knows one.
- Effects: a spark on a landed hit, a starburst on a critical blow or a bite, a puff of dust where a jump or a thrown stone lands, and a flame for the camp fire. Fight words (damage, CRIT, BLOCK, MISS, DODGE) and a small health bar with its number under the foe are built too, but fights are still switched off (`combat.enabled` is 0), so no player sees them yet.
- Settings: the Text size choice "16" now reads 16, not 18.

What creators notice
- `pnpm slots` lists the map's slots from the command line (`--free`, `--kind <kind>`), and a map slot may carry `reserved` with its reason: `core/town-corner` and `core/grove-clearing` now show as taken. A slot clash names the free slots of the same kind, or says that none is free and a "Request for the valley" issue is the way to ask. The check's last line counts a creator's warnings apart from the core's, and the scale check words its under-floor message for every kind.
- `pnpm check`: a held object's size in every clip frame is held against the world sprite (no frame over 110 percent, the largest at least 90 percent); G69 (a straight path over its limit) is a warning, not a failure; the clothing pins are re-checked after early hunting and none moved. `pnpm balance` prints a hunt row per region and kind (the standing count, the takes a day, the players that empty it in a day).
- Content shape: lifting is general. `params.liftables` holds one entry per kind with a weight class (`hand`, `arms`, `push`, `fixed`), a weight, a throw range, a roll and a sprite, and a new liftable object needs only an entry. A clip may carry a `hand` point per frame for the thing a figure holds, and the clip verbs gain carry, throw, push and lift.
- Art and tools: the drafts store prune (`pnpm art:prune`, six written rules, a cold copy first); the player eye (a gamer's review of what a player sees and does, with a warn-only `Player eye:` line on a pull request); the effects pack (PVFX Foundry, CC0). The wolf's angle, front and back views, the bridge-mend trial and the SpriteCast trial are indexed in the drafts store.
- Decisions and design pages recorded: early hunting before the fight, loose stones, the jump and the fall, the charged throw, the owner's rulings on the systems and matrix questions, the first valley's rulings, the wolf bite as a leap, SpriteCast as a guide, the developers' area look, lifting by weight class, a held object keeping its size, and the cheap part of the boot work.
- CI runs the content check once per run instead of twice. The e2e tests no longer fail on a slow frame (the stones e2e reads the figure's clip record and the flight's own curve) or on a late stew crossing the day end.

What changed underneath
- kernel 0.1.14 (simulation 0.37.0): the jump and breath (0.34.0), early hunting with snares and spoil batches (0.33.0), loose stones (0.35.0), the charged throw (0.36.0) and lifting by weight class (0.37.0). The save format is unchanged: every new player field is optional and an old state reads it as absent, and a 0.36 or earlier stone state migrates on load, so a v0.1.13 save loads as it is.
- Client: the title opens before the engine (`game/src/game.ts` loads Phaser and the scenes after the title's first paint) and the world builds in 8 ms slices; ground pages bake in strips (`groundchunks.ts`); fog banks are cut from one period and clouds baked lazily.

## v0.1.13 - 2026-11-22

What players notice
- A day has an end now. When the valley's day ends (05:00 on the valley clock) a "Day N" window says what the day gave, as three lines and one open door: what you found, what you built, what you learned, and who has a task for you next. It comes every day, before the morning toast, and waits until you stand somewhere safe with nothing else open.
- Day 2 has its own morning: a toast says what you gathered is ready again, a bell rings below the ruins in the night, Elder Maru has a line only from day 2, and Pell has a new topic, "What each tool opens" (basket, trowel, axe, staff). The valley's days are counted in its own dawns, so away from the game it waits at the hour you left it.
- On a phone, the first tap that starts play asks the browser for fullscreen and landscape; going back to the title or leaving the page lets it go. A mouse click never asks.
- The Skills window on a sideways phone gives the map most of the screen: two columns, the school row above the map, and the node card and keys in a scrolling pane on the right.
- Work plays its own drawn clips instead of the walk: felling, quarrying, fishing and picking up, for the human, the elf and the skeleton, seen from the left, the front and the back (the human's fishing has no back view yet and keeps the walk there). Most clips are redrawn at 44 to 45 frames for a smoother move, and a race's sheets load after you wake, not at boot.
- Pell sells four plain garments, so a piece can be bought as well as made: the hare-fur hood, the roe-leather jerkin, the roe-leather leggings and the hare-leather shoes, each at the lowest price the economy allows. Buying one skips the hide chain's combat gate.
- A woven reed coat can be made at the workshop at level 6 from a woven mat and a dyed cord, and it makes gathering 8 percent faster. Its weaving page is a rare find in the deep ruins. The journal gains a "Reedwork" group.
- Dried herbs (CeosIsrael): any herb hung at the fire for three seconds becomes dried herbs, which weigh nothing in the bag and sell for more than fresh ones. Wild herb and sunleaf each give their own.

What creators notice
- Schema, additive and every existing file valid unchanged: a shop offer may leave `price_mg` out and the build sets the lowest price rule R8 allows (a typed price is kept, and R8 still refuses one below the floor); a kit sheet may wrap into rows with `cols`, and `frames` goes from 16 to 64; recipes and nodes may carry a craft `family` and a `gate`, and a node behind a closed gate is shown and never taken ("This cannot be learned yet.").
- The clothing wave's content: ten start-known hide-chain recipes behind the combat gate (scrape and tan as one action, sinew thread, four tier-1 garments), the garment and hidework classes, Handcraft's four small wear and tools nodes (`quick-seams`, `steady-needle`, `deft-grip`, `sure-edge`) and the family parity rows in `pnpm check`.
- Fight clips: strike, guard, dodge and hit are drawn for the three races in three views and wired to the fight's outcomes, and they play only when combat is switched on (`combat.enabled` is 0 today, so no player sees them yet). Digging has no drawn clip and plays the walk.
- Kit art: a worn whole set is drawn on the figure (reed-walker for three races, digger-leathers and hardened-leathers for the human) and shown only with `?sets=1` until the race art on the 35 degree figure lands. A driver for drifting pieces (`game/src/drift.ts`: smoke and embers rise, leaves and ash fall, each piece a pure function of its seed and age) runs the chimney smoke behind `?drift=sheet`.
- A release pull request (base `main`, head `develop`, from this repository) now passes the body rule and the community loop's merge rule, which the v0.1.12 release had to merge past by hand. The starter roles generator is retired (the three sprite sets stay in the kit), and the tools share one Git helper. The index of the drafts of the 45-frame work clips and of the creature clip trial, with the trial's outputs of 22.11, is in `tools/kit-gen/drafts.jsonl`.
- New design pages: how finding, the carried kit and the bag compare with seven games; how the clothing route compares and a route player on the kernel that reads the hide chain from the content; skill families split by use (set A now, the clean set B later); the content matrix audit and the armour and creature matrices (stages 1 and 2 of the content count, #789); the systems alignment map (S1-S9); the large-games figures checked against data tables; and a research page setting our work plan beside a studio's, from idea to release.
- The developers' home at `/developers/`: a page of its own with the shared goal as a meter (squares drawn of the whole, read from `.github/dev-area.json`) and a read-only feed of what people and agents are making, open pull requests included, each with its maker, its state and what it still lacks; a day and a night version. `pnpm hub:data` now also builds the feed, three gap rules over the content files (a thing with no picture or only the old 16 px one, a figure with no quest, a quest with no place) and the meter into the hub data; `/hub/` links to it. It reads GitHub only and changes nothing in the game.
- Decisions recorded: content by matrix (weapons, armour and creatures from tables by rule); what the content targets count (one item, one animation); the creature clip trial (the walk and punch route, PixMiniMax at 8 frames; the wolf bite stays open); and the first valley's base look, the painted new world (still B), with the frame it was chosen on.

What changed underneath
- kernel 0.1.13 (simulation 0.32.0): the day tally (`day`, `valleyDay`: ids found, built and learned, kept once each, integers and strings only; a step across several dawns tells the last morning once), the craft family on techniques and effects, and the gate reader (`gateOpen`: the combat gate opens with `combat.enabled`, the switch the hunt waits under; a start recipe behind a closed gate is handed out at the first load after it opens). The save format is unchanged and a v0.1.12 save loads as it is. Content tag dc6c6766 (79 items, 80 placed nodes, 332 sprites); site ca061ade, the develop commit this note was prepared on, and the release's own merge commit is the live site.

## v0.1.12 - 2026-11-21

What players notice
- The river and its shore, the ruin sand, the rubble and the old bridge are drawn in the rich 64 px art too (wave 3b), the river as the owner's approved layered water: painterly teal, deepest in the middle, softer at the shore.
- Natural things (trees, stumps, bushes, rocks, logs, mushrooms) stand mirrored or not by a hash of their tile, for more variety; the same tile looks the same for every player and after every reload.
- Fires are alive: each flame runs on its own clock, the light breathes, embers and sparks rise, and the crackle follows.
- Rain is drawn (long thin slanted streaks, splashes by ground, one cool even light) and each region of the first map has its own odds of rain and fog.
- A wolf is felt before it is seen: after dark a howl far off now and then, a prowl in the sound that grows as one comes closer, then the alert, and the bite is drawn.
- The mouse wheel zooms in whole steps closer than the default view and back; the default view stays the farthest.
- Phone landscape play: a floating stick under the left thumb and the action buttons on the right, in the dark frame's style.
- Settings gains a Controls section: which side the stick is on (Left, Right) and the buttons' size (Small, Medium, Large), applied at once and kept with the other settings.
- Every text a player reads is 16 px or more, dialogue 18, on the phone's screen.
- The bay can be crossed: after Maru's coin is found and brought home, a player on the ferry jetty by day (06:00 to 19:00) can board, sail eight acts of about ten seconds and meet one event on the way (a crate, a passenger, gulls over a shoal, a squall, a bell in the fog). The boat is safe ground; a miss never takes from the bag.
- Entering a place for the first time names it once and counts it as a find once brought home; a fall does not take the name back. The map screen is ready for the whole first map, regions outlined and named and filled once entered (today's 64 by 64 valley shows its entered areas).
- Sunleaf mushrooms, a tier 1 meal at the fire, from two forest mushrooms folded in a sunleaf (CeosIsrael). Two stone tools can be made at the workshop: the hammerstone and the knapped pick.
- The valley has 34 wild spots for its small animals instead of 17, and every phone screen of the valley and the tangle has something that belongs to it; the tangle's dead ends pay (an oak at the tip, mushrooms before it).
- Work is one click and a repeating animation: felling, mining, digging, fishing and picking no longer show a timing strip. A click starts the work, the game gives one item at the end of each work interval, and it goes on until the player moves, starts something else, the node runs out, the bag is full or danger stops it. Everything already taken stays taken; there is no miss and no jackpot. A better tool, a higher profession level and agility (now called "Quick hands") shorten the interval. The luck "of misses" row leaves the stats.
- The opening teaches work as "click the tree or the stone, watch, stop when you like", and its first tasks say where to go, not how; a wolf is met at the edge of the cobbles.
- A gain toast carries a second line: the profession and the experience it gave.
- Phones are played on their side: a phone held upright shows one quiet card asking to turn it (the home page stays as it was).
- Settings' Text size choices read 16, 18 and 20 (the pixel face had made the 16 look like an 8).
- The picture a shared link shows (Reddit, X, WhatsApp, Slack) says Loomvale and loomvale.vercel.app, not the old name.
- A lost or broken reply from the server pauses the game and reads the state instead of repeating the action; a step out of a tile and back before the server answers is no longer lost; a game played on the server says "The valley was updated since your last visit" like the phone does.

What creators notice
- Schema, each additive and every existing file valid unchanged: the `passage` file type (a way across water with its sea events inline); an area slot may carry `danger` (0 to 9); the map may declare its `frame` and `moved` offset; a creature spot may carry `rank`, `shape`, `count`; a chunk its spawns; a card its air; a `story` file type (core only, listing settlements by kind and size); portals and the ground below. Params `pay_gap_ms` and `pay_sight_tiles`.
- `pnpm check` gains: the pay-gap check (no walkable tile past the cap from a pay, G62); the danger checks (G64: d within one of the walk from the town); the passage rows; the fight rows (wind-up range, a window for a bare-handed strike, a cycle's harm under a player's bar); the world lock (`content/world.lock.json` holds the opening's legs and pays); the richness check counts the wild's creatures as movers and, when they flee, as reactors (movers 49 to 62%, reacting 34 to 73%).
- `pnpm check`'s wild check reads every generated chunk's spawn spots, not only the map's list. `pnpm test:changed` picks related tests while building, touched packages at handover and every suite at the end.
- Fight data on creature kinds: an optional `fight` block (tier, health, breath, pace, up to four moves, patterns, a weak point) and a `combat` params group; the wolf carries one as inert data. Durations are written in game milliseconds and converted in one place.
- Equipment foundations: the grammar, the check rows and the pure readers for worn gear, with every field that would carry power refused in content until the thing that reads it lands. One work rule that kernel and client both read (`gather_speed_pct` and `dig_speed_pct` replace `timing_window_pct`; the retired `game` field on a node is still accepted and ignored), and a tie rule for tools. A tenth wear place `hands` (shown as Gloves; `ice_grip` moves to it), a clothing `set` record that declares each set's own bonus (the shared `wear_set_bonus_pct` is gone), and `tan_cure_d` (a hide dries in one game day).
- Kit clips: a kit sprite may carry a `clip` (race, view, verb) and the kit and the figure play the fight and work clips by name. The animation camera follows the 35 degree law.
- Art line: `pnpm art:pixellab` (a spec of jobs, safe beside a paid account) and `pnpm art:reduce`; a nightly job on the free accounts' daily generations (`pnpm art:nightly`); `pnpm art:library` builds the image library page, which the owner sorts by hand (keep, parts, rework, archive; keys, multi-select, a saving server); `pnpm art:scale` measures every world sprite against the adult and each declares its scale; `pnpm art:stray` lists art that no drafts index holds; a drafts push rolls to a second release at GitHub's 1000 files and takes jpg, jpeg, webp and glb. The index grows by thousands of drafts (the library holds 3,163).
- Animation production tools under `tools/anim/prod/`: five gates (feet, identity, size, eye, loop), a manifest with spend, a job list and the owner's card builder.
- Creatures wear no outline (the ink rule leaves the `creatures/` group); the roe deer's sheet is the first animal in the owner's look. A sprite named in `MASKED` sways by a mask of its own height (none is named yet). `?frame=off` hides the dark frame, to measure the ground's own colour.
- Frame D's measurables (contrast, tap targets, frame colours) are a test that reads the stylesheets. The loop no longer counts a builder's edit to an extension as a proposal.
- The developer area gains the project tree (`/hub/tree/`): the game's parts as the branches, a tap grows a part's work on the tree, its data read from a published channel. The players counter's source is one repository secret read by both builds.
- A newcomer's first fifteen minutes: the guides walked and mended, one page of current standards, and a test that keeps them true. New design pages for the gear wave (clothing, weapons, quarrying), the materials gap report and the weapon matrix; decisions recorded for the camera, the painted scenes, the image tools, the animation routes and the wide world.
- CI: deploys from CI upload the source and the host builds it (off until the repository variable is set); the owner's own pull requests skip the CLA check; the browser checks lose dead time and keep a time ledger; hooks get 30 s like tests and the speed checks take the fastest batch, so a busy machine no longer fails them; the tree's e2e reads the number while the finger is down.

What changed underneath
- kernel 0.1.12 (simulation 0.30.0): the pure fight tick (integer, real time at 100 ms, tells the screen each strike's outcome by kind: attack, miss, critical, guard, dodge) lands disabled, `combat.enabled` is 0 and nothing in the client, server or game calls it; it copies only the state a tick changes (with 200 accounts a busy tick went from 160,384 µs to 253 µs at the median). Entering a place (`seen`, `explored`), the sea crossing (`aboard`, `crossings`), a save that moves with the authored valley, the one work rule is built (`gather` and `dig` yield one unit per work interval; the kernel reads no grade and has no jackpot). Hands strike a small step harder when they hold a work tool (`tool_strike_permille` 1050, `handStrikeHarm`) and only the spear is both a hunting and a fighting item; both wait behind the same off switch as the fight tick. Adapting an old save can now move a worn piece (the ice grip to the hands). A log recorded before 0.30 no longer replays to the same state, because one gather is now one unit. The save format is unchanged (3); a v0.1.11 save is adapted on load and loads.
- Sign-in with Discord is built and stays closed ("not open yet") until its pair of keys is set.

## v0.1.11 - 2026-10-31

What players notice
- The valley floor is drawn in the rich 64 px art: one continuous olive meadow varied by tone, tufts and seed heads, flowers sparse, and soft wandering joins where the grass meets a path (wave 1, the owner's pick after two passes). The plants, stones and small things of the first ten minutes follow at 64 px, 21 pictures (wave 2).
- The opening's bank path is two to three tiles wide, uneven and rounded, instead of one straight tile.
- The grass and the paths are drawn in the rich 64 px art too (wave 3): calm olive grass with leaning blades and soft lighter drifts, a worn ribbon of path inside its band, a darker damp sand on the bank, and the places where two kinds of ground meet cut per pixel instead of by tile blocks. The tall things of the opening and the town follow at 64 px: the lantern post, the broken statue, the market stall and the small house (wave 2c, the owner's yes on every draft).
- The small props stand in groups instead of single scatter: flowers in threes and more, drifts of tall grass, berry bushes, and the second well in one home near a path. Plants cast shadows now, and flat things (rubble, pebbles, logs, fences, fires) still do not.
- Flower clusters stand at half a berry bush (32 px) and are drawn again at that size, four blooms each, so the order of sizes holds: tuft, flower cluster, bush, tree.
- Light follows the hour: from 17:00 lamps and fires cast pools of light, the figure is lit by what it stands near, clouds drift their shade over the ground, and dusk and night take the tint the owner picked.
- The dark frame around the phone's view is an edge by day, not a veil: at noon the grass shows its own colour to the middle of the screen; the veil returns with the night.
- The top bar wears frame D on phone, desktop and landscape: lacquer black with a hairline of lit gold on the meter, the chips, the tracker, the toasts, the buttons and the pocket map.
- A Settings window, opened from the menu: quality (Auto, Low, Medium, High), frame rate (Auto, 30, 60, 120), mute and the accessibility switches, each change applied at once. While a row is on Auto it shows what Auto chose on this device.
- Sounds are re-levelled so a jingle no longer peaks loud, and every effect fades with its distance from your character, with other players in mind.
- The three races walk with their own looks (human, elf, skeleton), and the walk is picked by the distance covered, so a planted foot never skates when the pace changes. The elf's cloak is green.
- A content update hands out a race's outfit piece once: a piece you sold or dropped does not come back at the next update.
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
- The developer area's boards show the number of open accounts and of those opened in the last 7 days, counted by the game server and read at most once a minute; when the server cannot be read the board says unknown, never 0.
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
