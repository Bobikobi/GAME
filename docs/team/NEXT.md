# What is next - one section per stream

Written 2026-10-11 when the first round of sessions closed. Each section is the full spec for one fresh session; it does not point at a conversation. A session reads its own section, `AGENTS.md`, and the `DECISIONS.md` entries it names, and nothing else up front.

## Rules for every stream

- Every section starts with a Status line, updated in the pull request that changes it: `Status: open`, `building - <stream id>`, `built (#<n>[, #<n>])`, `built - <where>`, `paused - <why>` or `dropped - <why>`. A new section takes a slug id (`## <slug>. <title>`); the 22 numbered sections keep their numbers and no new number joins them. `pnpm check` holds both (next-status).
- Branch off `origin/develop`, worktree under `<repo>.worktrees/<branch-with-dashes>`, one pull request into `develop` per item. Never stack on another branch.
- No integration session runs now. Each session lands its own pull request: squash merge into `develop` after local proof, and the owner approves the merge at the permission prompt. Nothing goes to `main`; a release is the owner's call.
- CI proves a pull request: `pnpm verify` and the opening e2e on a phone and a desktop screen, with one retry, on every pull request into `develop` or `main` (the repository is public, so Actions costs nothing), and the landing waits for it green. The local proof before a push is `pnpm verify` exit 0, written in the pull request body; "`pnpm e2e` green" in a measurable means green in CI (owner's manager, 18.10).
- An e2e runs on the machine only to debug a red CI run or a new e2e file, the single file and one at a time: `flock /tmp/game-e2e.lock pnpm e2e > <file> 2>&1`. Two at once starve the machine and time out.
- Saving tokens:
  - Long output (verify, e2e, logs, `gh run view`) goes to a file, and only the tail or the failure lines are shown.
  - Read files by range or by grep.
  - Run the single test file first and `pnpm verify` once before the push; the e2e runs in CI.
  - Codex is the default worker and the session is the escalation (owner, 11.10; skill `gpt-consult`). A task goes to Codex unless it needs judgment, needs context only the session holds, or has no command that proves it: `codex exec --sandbox workspace-write -c sandbox_workspace_write.network_access=true "<goal> <files> <proof command>"` in the worktree, the session leaves those files alone meanwhile and re-runs the proof itself. Typical: test-expectation sweeps, tests from a spec, regenerating, e2e expectation updates, rebases onto `develop`.
  - Before ready, a bug-only review of the diff from Codex (`codex exec --sandbox read-only --skip-git-repo-check "..." < /dev/null`) and Gemini (`ask-agy`; an empty answer is a blocked tool, not a reply), each claim checked against the build. Web lookups go to `ask-agy`.
  - The pull request body names what went to Codex or Gemini and how many corrections it needed.
  - Keep `STATE.md` in the session scratchpad, updated at each step.
- Generated files (`schema/json`, `content/values.lock.json`, `CREDITS.md`, `content/board.json`) are taken from `develop` and regenerated (`pnpm schemas`, `pnpm values`, `pnpm credits`, `pnpm board`), never merged by hand. GitHub ignores the union merge of `DECISIONS.md`: resolve it locally and keep both sides.
- Toolchain: node 24 from nvm on the PATH, then `pnpm install --frozen-lockfile` in each new worktree.
- Houses and plots are paused (DECISIONS 2026-10-10): build nothing toward them. A direction (art style, camera, look of a character, UI frame) goes to the owner as two or three phone-size stills first; a detail inside an agreed direction is polish.
- At the end: the pull request is landed or handed back with its state, `STATE.md` is turned into a short note under the stream here if work is left, and the session stops.

## 1. Health on the client and in the content (P-5b, P-5c)

Status: built (#77, #84)

P-5a, the kernel slice, is in `develop` (aee8491). Read DECISIONS 2026-10-08 "The valley has a dangerous hour" and `docs/design/GAME_RULES.md` G30-G35 first.

What the kernel gives:
- The action `{t:'move', at:[x,y]}` reports a position. It is valid if the tile is walkable and within Chebyshev `2 + floor(elapsed / walk_step_ms)` of the last one. It is accepted while busy and needs a character.
- Player fields: `town`, `outing {gained, solved, visited} | null`, `chase {hazard, since, bites} | null`, `falls`, `movedAt`. `Session.restore` defaults them.
- Health was `player.satiety` (milli-points); item 7 renamed it `player.hp`.
- Events: `{e:'hurt', by, id?, hp}` and `{e:'fall', from, at, lost[]}`.
- Hazards are map props with an id and `hazard {kind: predator|pit|trap|deep_water, window:['night'], reach?}`; none ship yet.
- `Slot.safe: true` marks safe ground. Town cobble and the first built camp slot are safe.
- Clock: a day is 1,200,000 ticks, tick 0 is noon, night runs 400000 to 850000.
- Params: `walk_step_ms` 190, `hp_low_pct` 0, predator reach 4, catch 2500, bite 2000, bite 25%; pit 30, trap 20, deep water 40.
- Checks live in `tools/src/hazards.ts`: G30 (no hazard on safe ground) and G34 (running to safety costs less than a fall).

P-5b, the client, branch `feat/health-client`:
1. A silent `session.report(tile)` sends `{t:'move'}` when the tile changes, not every frame. A refused report never breaks walking.
2. The HUD bar shows health. Only when the bundle has a hazard:
   - a countdown to nightfall or the mist, whichever comes first (G31);
   - entering the mist lights the lantern with one warning, once per night;
   - a burning camp warns before its fire goes out.
3. Hazard sprites, and a fall animation on the `fall` event.
4. Fix the item text in `game/src/text.ts` that divides by drain.
5. An Eat label for foods that hurt.
6. A test that `STEP_MS` equals `walk_step_ms`.

P-5c, the content, a second pull request after P-5b:
1. Hazard props in the night ruins: the opening ends at the entrance, the entrance slot is safe, the danger is one step inside.
2. Healing items: a first-aid kit and a bandage.
3. Hunger drains to 0 (param minimum 0), and only once hazards exist.
4. Raise `hp_low_pct`.
5. Add the GAME_RULES G30 and G34 rows.
6. An e2e: at night, step one tile past the ruins' entrance, fall, and reappear in town with nothing lost. The safe threshold has just closed the outing, so the bag, the basket and the quests stay whole (DECISIONS 2026-10-10: a fall takes back only what the outing brought); a fall that takes the outing's finds is proven in the kernel tests until P-6 opens another way in.
7. Rename `satiety` to `hp` last, in its own commit, after crafting has landed. Built: `player.hp`, `hpCap`, `params.hp_cap`, no hunger drain left (DECISIONS 2026-10-26).

Known wart, in DECISIONS: a quest that completed by itself during an outing keeps its reward after a fall. Mist hazards wait for P-6.

Left after P-5c (11.10): item 7, the rename of `satiety` to `hp`, waits for crafting wave 4 (#48) to land, then goes in as its own pull request. P-5b also left the mist's half of the countdown and the lantern for P-6, and the warning before a camp fire goes out for the tent (CR-25).

After P-5, in order:
- CR-60 miss tables;
- CR-62 save reset notice;
- P-4, then P-6, which defines the mist;
- CR-25 tent, then CR-38.

Races must stay different all game: CR-37 only built the opening part.

## 2. Land the crafting stack (#45, then #46, then #48)

Status: built (#45, #80, #86)

Owner's answer 10.10: land all three, one at a time.
- `KERNEL_VERSION` 0.5.0 (from the economy branch) wins over 0.4.0.
- CR-61 is not built: recipes given by quests stay quest rewards.
- Any crafting text that points at a house is reworded toward the town workshop.

State at handover:
- #45 `feat/crafting-wave3`:
  - `develop` was merged in as 61cd0f1 and pushed; `pnpm verify` is green; still a draft.
  - The e2e failed three times, all with other e2e runs loading the machine:
    - Phone, both attempts: after the bridge, A on "Build: Campfire" built the fire, but the test saw no open dialogue at "Build it". A second A press picked the first option, so the dialogue opened and closed between polls.
    - Desktop: "timed out waiting for the step to end" after the audio check.
    - A later run under the lock: the phone passed the fire and the town, then failed the same way at "I will do it".
  - Hypothesis, not proven: CPU starvation. The only `game/src` change against `develop` is the craft and build panel in `panels.ts`.
- #46 `feat/crafting-economy` (dbb0968) and #48 `feat/crafting-wave4` (668a39e) are not yet merged with `develop`.

How the #45 merge was resolved, for reference:
- The GRUNT CR table took develop's rows, without CR-8, CR-16 and CR-22 (closed by wave 3) and CR-23 (deleted on develop), plus wave 3's CR-27 to CR-31.
- The creators README took wave 3's lines plus develop's find, dig and instead lines.
- Imports in `panels.ts` and `text.test.ts` were unioned.
- `kernel/test/tools.test.ts`: `started()` marks `core/fix-the-bridge` done.
- `game/test/text.test.ts`: the basket line includes bell bushes.

Steps:
1. On a quiet machine, run the e2e under the lock on #45.
   - If it is red, run the same e2e on `origin/develop` to tell the branch apart from develop.
   - A real dialogue race is fixed in the client, not in the test.
2. When green, mark #45 ready, land it, then do #46 the same way (merge `develop`, regenerate, verify, e2e), then #48.

3. After #48: the workshop moves into the town (DECISIONS 2026-10-11 "The workshop is a large stall in the town"). A stall larger than today's shelf, placed in the town, opened by a quest, with a working animation of its own (built with section 4c). Recipes, tiers and tools stay as wave 3 built them. Measurable: no workshop station outside the town on the map; the stall refuses work until its quest is done; `pnpm verify` and `pnpm e2e` green.

## 3. The site: the MCP server, then the coming-soon boxes

Status: built (#69, #73)

Read DECISIONS 2026-10-08 "Stage 2a" and the 2026-10-10 site entries.

a) #69 `feat/site-mcp` (daf2bd5), GRUNT 15 and 16: built, `pnpm verify` exit 0 (538 repo tests and 40 web tests), draft.
- Left to do: write the diff to a gitignored `.scratch/` file, ask Codex and Gemini about bugs only, fix what holds up, verify, mark ready, land.
- Design, for answering a reviewer:
  - `mcp/src/server.ts` sets `tools/list` and `tools/call` on the low-level server, with the TypeBox schemas as JSON schema. `Value.Check` validates input and output, and a misfit returns `isError` with the issues.
  - Answers return a note line plus JSON, and `structuredContent`.
  - The root script is `"mcp": "tsx mcp/src/server.ts"`, not `pnpm --filter`, whose banner would break stdout.
  - `answers/hub.ts` reads `web/public/api/hub-data.json` when valid, otherwise builds the data live; it never uses the fixture.
  - `answers/value.ts` works on a temporary copy of `content/`, refuses paths outside it, and cleans up in `finally`.
  - `answers/guide.ts` slugs exactly as Astro does.
  - `@modelcontextprotocol/sdk` is pinned at 1.32.1.
  - `.mcp.json` and `.cursor/mcp.json` register `pnpm -s mcp`. The creators README has the section "Your AI tool and the project", and the hub shows one `claude mcp add` line.

b) The coming-soon boxes, branch `feat/site-coming-soon`. Owner's answers are in issue #57.
- On the hub and home, "Your card", Levels and Badges become coming-soon boxes with no sample numbers: every number on a page equals `content/board.json`.
- The 3D version ships as a parallel version, with its own button on the home page (owner, 11.10, DECISIONS "The 3D version is a second door"). The button starts the 3D game at `/play3d/` and hides while `/play3d/` is not in the build; section 8 puts it there.
- Measurable: no digit inside a coming-soon box; the home page has the 3D button; captures at 390x844 and 1440x900 with headless Chrome on its own port, closed by PID; `pnpm verify` green.

## 4. Game feel: walk, swing, auto-work, sound

Status: built (#78, #81)

Two pull requests. Read DECISIONS 2026-10-07 (sound rules) and 2026-10-11 "Felling and digging run by themselves".

a) Animation, branch `feat/walk-swing`:
- A walk cycle in four directions plus idle, drawn from the existing pixel character.
- Swing animations for the axe and the pick.
- One press on a tree starts felling: the character swings by itself until the tree falls, with no pop-up and no bar. Each swing throws chips and plays a sound; the tree shakes and cracks; moving away cancels; the tree falls with its own animation.
- Digging and mining follow the same pattern with their own tool.
- Missing frames come from the universal-modder sidecar (a venv, never a plugin).
- This is polish inside the agreed pixel look, so no stills are needed.
- Measurable: four directions visible in a capture; one press fells a tree with no further input; a step away stops the work.

b) Sound, branch `feat/sound-pass`, all under the existing mute:
- a soft click once per dialogue advance;
- gibberish voices, pitched per speaker;
- ambient beds for night and for scary places;
- a campfire crackle that grows as you approach;
- stream water by position near the river.

Measurable: each source's volume falls with distance; the click plays exactly once per advance; mute silences all of it.

d) Superseded by decision 43 of 22.10 (nothing new is built on the starter looks; whether to rewrite it as race figures stays with the owner). Before (c), branch `feat/starter-looks`: the three starters look different in the game. Today the forager, the digger and the explorer all draw `chars/player_*` (or `woman_*` with the look toggle), so the choice of starter is invisible after the title screen. The look is already decided: DECISIONS 2026-10-09 "Each player role reads at a glance: one big item, one colour, its own build" (the Explorer tall and lean with a wide-brimmed hat and a tall backpack with a blanket roll; the Forager short and slight with a large wicker basket and the rust red on a neckerchief and the basket lining, no head wrap; the Digger broad and heavy-set with a spade across the back and a cap; a man base plus a woman option each; the same patched base clothes). The 3D cast on `trial/3d` already follows it. So this is building an agreed direction, not a new one: no stills round. Draw walk, idle and work in four directions for each role and both looks, inside the pixel look, and give each starter's JSON its own `sprite` and `sprite_alt`. It runs before (c) so the every-action frames are drawn once per role. Measurable: in one capture the three starters stand side by side and are told apart at phone size by item, colour and build; no starter names `chars/player_*`; `pnpm verify` and `pnpm e2e` green.

c) After (a), (b) and (d) land, branch `feat/every-action`: one animation for each action the player takes (gather, pick, dig, fell, mine, craft at the workshop stall, cook, eat, drink, talk, pay, pitch a camp, sleep), inside the pixel look, so no stills. In the same pull request, a quest given in talk is offered in the giver's words and the "New task:" line goes (`game/src/text.ts`); the journal records the quest quietly. Measurable: every action in the list shows its own frames in a capture; no "New task" string in `game/src`; `pnpm verify` and `pnpm e2e` green.

## 5. The shops you walk into

Status: open

Read DECISIONS 2026-10-10 "Player houses and plots are paused" and 2026-10-11 "The shop interior". Frame C (`docs/design/frames/2026-10-11-shop-interior.png`) is the compass:
- one room, the door at the bottom;
- a runner that leads to the counter, with the shopkeeper behind it;
- the back wall shows the trade;
- each shop has its own floor and wall, window light, shadows and small life.

The build:
- The door of the food and medicine shop leads into its interior scene, and the trade happens by talking to the shopkeeper. There is no pop-up at the door.
- Then the other shops, with prices from the values, never hardcoded.
- Known polish from the stills: the stove is too large, the light patches are faint, the sacks and crates are quick props.
- How many shops is still open: build one, and ask the owner before the next ones.
- Measurable:
  - walking through the door changes the scene and back;
  - the shopkeeper's dialogue opens the trade;
  - the e2e covers one purchase inside.

## 6. The first maze

Status: built (#71)

`feat/first-maze` holds one unverified WIP commit (68be9a2, "the tangle"). It touches `schema/src/index.ts`, `tools/src/play.ts` and a new `tools/test/maze.test.ts`. Read GAME_RULES section 3 and DECISIONS 2026-10-09 "maze and stealth".

Steps:
1. Branch fresh off `develop`, cherry-pick the commit, and finish it.
2. Keep the schema additive, with `FORMAT_VERSION` staying 1.
3. Verify and land.

Stealth over the hazards is section 12.

## 7. Story chapter 1 (#58)

Status: built (#58)

A docs pull request: chapter 1 approved, and how the three races differ in it.
1. Merge `develop` into it and check it against `docs/design/STORY.md` S1-S6.
2. Ask the owner one question if anything there contradicts a later decision, then land it.

## 8. The 3D door at /play3d/

Status: built (#96)

Read DECISIONS 2026-10-11 "The 3D version is a second door" and "The 3D door lands", 2026-10-18 "The Meshy credits are spent, not saved", `docs/3d/meshy-notes.md` (plans, costs, the credits log), `docs/3d/style-compass.md` and `game/public3d/models/README.md`. The 3D game moves at its own pace and never holds the classic game back.

a) Landed 11.10: `/play3d/` runs the classic game's kernel, bundle and save under a three.js world. `game/src/play3d/art.ts` names the model for a sprite or a person; anything without an entry is drawn as the bundle's flat picture, or as a Kenney mini character for a person.

b) First the gap and the budget, before any credit is spent (owner, 18.10):
- The gap: everything the valley shows without a model of its own, read from the bundle, `art.ts` and `scenery.ts`: the people (Maru and the trader stand in as Kenney minis; Pell, the cook and the others have nothing), the nodes and props drawn flat, camps, mended places, buildings, the ruins. One table in `docs/3d/gap.md`: the thing, where a player meets it, how it is drawn now, the route (a person from the cast sheet's text, a prop from its sprite), its credits and its one download.
- The budget, read in the app on each of the four accounts: credits now; how many are the month's own (they reset on the 1st with no rollover, and burn first); the check-in credits and when they expire (about a month after they were earned); downloads left this month. Add the next month: 100 per account on the 1st, and a new check-in cycle if Meshy opens one.
- When the gap is larger than the budget (it will be), the owner chooses: two or three options, each with what it leaves undone, and the session's recommendation, in one message. Nothing is generated before his answer.

c) The looks are a direction. Before a cast is generated in a look, phone-size stills of the drafts of 13.10 (Elder Maru, Pell, the cook as a man and as a woman, the market stall, the old well; which account holds which is in the credits log) go to the owner, opened in his browser, never an artifact link. The pick goes into DECISIONS with its frame, and the rest of the cast follows it without asking again.

d) Spend and download (owner, 18.10: more credits may not come, so none is left to expire):
- Each day on all four accounts (Chrome profiles on ports 9341-9343 and 9333): first the site's tasks that earn credits, the check-in and any task that neither publishes nor connects an account; then spend, the credits that expire soonest first, in the order the owner picked in (b).
- Search before generating (owner, 18.10): for each thing in the gap, first look in the Meshy community for a model other users made. A find costs no credits, only a download. It is taken under any open licence, share-alike included (DECISIONS 2026-10-22, decision 4: a sprite derived from share-alike material obliges the art to carry the same licence, and the source and licence stay in the kit, CREDITS generated), it fits the look picked in (c), and it stays under the caps below. Each find goes into `docs/3d/gap.md` as the route "community", with its link, its author and its licence; a credit is spent only where the search found nothing that fits.
- Things the plan will need later (a horse, owner 18.10) are searched for too, and their finds are listed in `docs/3d/gap.md` under "Found for later". The month's downloads that would otherwise go unused go to them, in the order of that list.
- Generate on Meshy 6 Lite only, the one model a Free account may download; a textured draft is 20 credits, rigging is free.
- Download only what the owner picked, once per model, with every clip added first. Downloads are capped per account per month (10, one more on check-in day 5): what does not fit this month waits for the next, since a generated model stays in its account.
- Then rig and reduce it in the local Blender pipeline (`game/tools/blender/`), add its attribution line to the models README (CC BY 4.0, generated with Meshy; for a community find, its author and licence), name it in `art.ts`; one pull request per batch.
- Measurable for each batch: every new model loads at `/play3d/` at 390x844 and 1440x900 (captures with headless Chrome on its own port, closed by PID); a person is at most 50,000 triangles with 1024 px maps, as the six role models; `pnpm verify` and `pnpm e2e` green.
- Not without the owner's yes: posting a draft to the Meshy community (+50, it publishes the draft), connecting a Discord account (+100), a paid month.
- Log each day's credits earned and spent per account in `docs/3d/meshy-notes.md`.

e) One game, two doors (owner, 18.10): every rule and every development decided for the game holds in `/play3d/` too, in 3D's own means; only what is truly 2D (pixels, a sprite sheet) has no twin. The pixel game gets the effort first and the 3D game follows: a twin is built after its original lands in the classic game, and never takes a builder from the pixel game's work. First on the list, after the cast of (c) and (d):
- The proportions of STYLE.md section 1b, measured in world units against a character's height: a grown tree at least 3, a small house 3, a street lamp 2, a bush half. The six role models set the height of 1.
- Light and shadow (STYLE 4, C): the sun's shadows exist; add the body's own shade and the light on it.
- The night (STYLE 5): darker than N3 out in the wild, the town lit by its own lights.
- Height (STYLE 6, T2): the same levels and rock faces from the same data, when stage 3 brings them.
- The six depth cues (STYLE 7): reflections in water, sinking into grass (the cover signal kept), cloud shadows, footprints, a shadow that stays on the ground, height; and the wind as the plants' sway.
- Measurable: each item shows in a 390x844 capture of `/play3d/` beside the same place in the classic game, and the proportions are measured in world units, not by eye. A rule that will not carry across goes to the owner through the manager with options; it is never dropped quietly.
- The 3D game need not run on a phone (owner, 18.10): the phone is the pixel game's. Where a phone's limits (memory, triangles, frame rate) block a rule or a model, the 3D game gives up the phone, not the rule, and is measured at 1440x900 only; say so in the pull request.

## 9. The maze peek and the hint ladder

Status: built (#132)

Read DECISIONS 2026-10-11 "Maze difficulty is a ladder of four tiers" (PR #71). After #71 lands.

- At a maze's entrance the camera shows the whole maze from above for 3 seconds, then returns to the player.
- A maze names its tier in content (schema additive, `FORMAT_VERSION` stays 1). Tier 1: the peek with a very faint route line and the landmarks. Tier 2: the peek, and only the landmarks glow for a moment. Tier 3: the shape alone. Tier 4: no peek; waits for P-5c and stealth.
- The tangle is tier 1.
- Measurable: the peek lasts 3 seconds and fits the whole maze on screen at 390x844 and 1440x900; the line shows at tier 1 only; `pnpm verify` and `pnpm e2e` green.

## 10. The stage-1 service (M5: GRUNT 17, 18, 19)

Status: built (#107)

Read GRUNT items 17-19 and DECISIONS 2026-10-07 "The stage-1 service runs as Vercel Functions with Upstash Redis" and 2026-10-08 "Stage 2a after the stage-1 service". This stream is the road to the server: stage 2a is designed once its numbers are in.

- One pull request per GRUNT item, in order 17, 18, 19, each with the item's proving command.
- Upstash Redis comes from the Vercel Marketplace (free tier) in the existing project. Provisioning it and setting its two environment names on Vercel is a production change: ask the owner first, in three lines. Until then the tests run on the fake store and `usage` stays null.
- Add Vercel Web Analytics for page views (owner, 11.10): `@vercel/analytics` pinned, one component in the site layout and one call in the game's page. Turning it on in the Vercel dashboard is the owner's, at the release. It does not replace the in-game counts.
- Measurable: item 17's curl prints 204 on a preview with the env names; item 18's client tests and e2e green; item 19's page lists the fixture's numbers; `pnpm verify` green.

## 11. Night light: dark around, a sharp light, no mist on the character

Status: built (#97)

The owner, 11.10, on production v0.1.2: at night the mist is drawn over the character itself, so the character blurs and the game looks as if its quality dropped. Wanted: darkness around, the light around the character sharper, and no mist on the character. This is polish inside the agreed look (the night, the lantern's light and the mist stay), so no stills round; a before and after capture goes to the owner.

- Read `game/src/scenes/world.ts`: the valley-wide mist (`DEPTH.mist`), the slot fogs (`DEPTH.fog`), the shade and the lantern glow, and the WebGL vignette ("an old, worn picture").
- The player, and what the player holds, draw above the mist and the fog; the mist still covers the ground, the props and the other figures.
- At night the dark outside the lantern's light is deeper, and the light's edge is short and clear instead of a long soft fade.
- Measurable, at 390x844 and 1440x900, by day and at night, with headless Chrome on its own port, closed by PID:
  - the pixels in the player's box equal the same frame drawn with the mist, the fog and the vignette off (mean absolute difference at most 2 of 255 per channel);
  - at night the mean luminance of a ring outside the light is at most 40% of the mean inside it;
  - at night the light's edge falls from 90% to 10% of the inside level within 12 px at 390 wide;
  - `pnpm verify` and `pnpm e2e` green.

## 12. Stealth over the hazards: the wolf's round and the south bank

Status: built (#103, #118)

Read DECISIONS 2026-10-13 "The frames of stealth, tending and the first expedition", GAME_RULES G30-G35 and G47, and the `stealth` row of section 3 first. Two pull requests; (b) is built on (a) and lands after it (PARALLEL.md, stacked branches).

a) The kernel, branch `feat/stealth-kernel`:
- Schema, additive, `FORMAT_VERSION` stays 1: `stealth` joins `QUEST_TYPES`; a map prop may carry `cover: true` (non-solid only); a predator's `hazard` may carry `round` (4 to 64 tiles, a closed loop: each tile adjacent to the next on a row or a column, the last to the first, the first tile inside the prop's footprint, every tile walkable with the predator's own footprint counted as walkable), `pace_ms` and `eyes` (optional, else the params); params `hazard.predator.pace_ms` (600) and `hazard.predator.eyes` (5), on the game tick.
- `kernel/src/danger.ts`: `predatorAt(bundle, hazard, tick)` is the round's first tile while the window is shut, else `round[idiv(tick - lastDusk(bundle, tick), pace) % round.length]`, with `lastDusk` a new helper beside `nightFalls`: the most recent dusk at or before the tick; its heading is the step to the next tile; `sees(bundle, hazard, tick, at)` (cover read from the map): one tile away or less is seen whatever the cover; on cover, unseen; else seen when `at` lies 1 to `eyes` tiles ahead along the heading and at most half that far to the side (`2 * side <= ahead`). A predator without a round keeps `distanceTo(at, rect) <= reach`.
- `kernel/src/step.ts` `strike`: a predator with a round starts the chase when it sees the reported tile. Nothing else moves: the chase, its bites and its end at a safe tile or at dawn stay as P-5 built them.
- `tools/src/hazards.ts`: the G47 rows of GAME_RULES section 8 (the loop's shape, no safe ground under it, cover inside its watch, a stealth quest's target inside a watch); G34's run to safety walks from every tile any round watches.
- Tests (`kernel/test/stealth.test.ts`, `tools/test/stealth.test.ts`): the wolf sleeps on its den by day and walks the loop after dark at its pace; a replay gives the same place; seen in the cone, unseen on cover, seen when adjacent on cover; the check refuses an open loop, a loop over safe ground, a stealth quest with no round and a round with no cover.
- Measurable: `pnpm verify` green; `KERNEL_VERSION` 0.6.0.

b) The client and the content, branch `feat/stealth`, on (a):
- `game/src/scenes/world.ts`: a hazard with a round walks it after dark (a tween tile to tile at the kernel's pace, placed from `predatorAt` so the drawing never drifts from the rule), with two eyes that glow in the dark facing its heading; by day it sleeps on its den. Cover props draw as the tall grass they are, and the player's sprite dims a little while standing on cover. No cone is drawn (G47: the window is learned by the eyes).
- Content: a wolf `core/bank-wolf` on the meadow west of the river with a round of about twenty tiles between the glade and the bank; a strip of tall grass (`cover` props) along the water between the round and the river (not reeds: the reed sprite is the look of the reed nodes, and DECISIONS 2026-10-10 keeps a node's look off scenery); a resource `core/moon-reeds` (output `core/moonreed`, `hours` [20, 24), no tool, on a new slot at the bank's south end, inside the round's watch); the quest `core/the-south-bank`: giver Pell, type `stealth`, requires `core/herbs-for-pell`, one `find` step with its clue, rep, gold and a first-aid kit (`core/first-aid-kit`, for the bites: G4) as the reward, offer and done lines in Pell's voice (rumours with a price, STORY.md).
- GAME_RULES: the stealth row's "waits for the hazard system" clause goes; the G47 row of section 8 reads "error".
- E2E (`game/e2e/stealth.ts`, added to `pnpm e2e`): after dark, wait on cover until the eyes turn away, cross to the moon-reeds and pick the moonreed with no chase; then step into the cone, see the chase start and end at the camp. Under the lock.
- Measurable: in one capture after dark the wolf stands elsewhere than its den; `pnpm verify` and `pnpm e2e` green.

c) The threat telegraph, branch `feat/threat-telegraph` off `develop` once `feat/stealth-cues` has landed. The owner, 11.10, after playing production at night: "The wolf did not chase the character and did not feel scary. There should be an exclamation mark or something that marks that the chase begins. Maybe you hear the wolf howl from far away now and then, and as you come closer you hear strange noises that grow the closer you get, and then the alert! This can be a pattern that hints at other threats in the game." And: "An animation for the bite itself too." `feat/stealth-cues` (DECISIONS 2026-10-16, the bank wolf's eyes) already brings the alert: on `seen` the growl, the flare, the "!" for 1.2s, the jolt, the hunt's song and the drawn chase. This item adds the rest of the pattern, display only (the kernel keeps the predator on its round, sees and bites by its own clock, and nothing here decides a sight, a bite or a safe place):
- Four beats, each with its visible twin (G24, G27), under the existing mute, every number in `content/core/params.json` (a `telegraph` group under `hazard.predator`, additive):
  1. the far cue: after dark, a howl now and then, heard from far (a gain above 0 at 12 tiles), with its twin a short line in the toast band the first time a night ("A howl, far off.");
  2. the rising cue: a layer of strange noises (low breath, a snapped twig, a padding) whose gain grows as the player comes closer to the predator, 0 beyond `near_tiles`, with its twin the eyes, already seen at that range at night;
  3. the alert on `seen`, as `feat/stealth-cues` built it;
  4. the act made visible: while the hunt runs, the drawn wolf closes on the player so that it stands within one tile of them when the first bite lands (`catch_ms` after `chase.since`) and stays beside them for each later bite; the bite is drawn: a short lunge of the wolf, a flinch of the player and the health meter's own reaction, once per bite, read from the kernel's `hurt` events. Menace with a limit (G46): the person never bleeds at the moment of harm; reduced motion drops the lunge and the flinch and keeps the meter.
- The pattern belongs to every threat that acts, not to the wolf alone: the beats live in one module (`game/src/telegraph.ts`, say) fed by a hazard's kind and position, so the pit, the trap, deep water and later the road thieves take it with their own sounds.
- Measurable, in tests of the module and the e2e under the lock: at 12 tiles the howl's gain is above 0 and the rising layer's is 0; at 3 tiles the layer's gain is at least three times its value at 8 tiles; the "!" is visible within 100 ms of `seen`; through a hunt the drawn wolf's distance to the player never grows while they stand still and is at most 1 tile at the first bite; the bite animation plays once per `hurt` from the predator; muted, the output is 0 and every visual cue still shows; `pnpm verify` and `pnpm e2e` green. How scary it feels, and how loud, stay for the owner to judge on a preview.

## 13. Tending: a fire kept by hand, and Maru's hearth

Status: built (#104, #120)

Read DECISIONS 2026-10-13, GAME_RULES G48 and G31, the `tending` row of section 3, SETTLEMENT.md 3.4 and GRUNT CR-25, CR-88 and CR-94 first. Two pull requests, after section 12.

a) The kernel, branch `feat/tending-kernel`:
- Schema, additive: a map prop may carry `fire: true` (it needs an id) or `lit_by` (a fire prop's id: its note and sign read only while that fire burns); params `fire.cap` (3 logs), `fire.log_ms` (100000, one log's burn, two game hours) and `fire.warn_min` (30 game minutes; CR-94's `fire_warn_min`, grouped under `fire` beside the cap and the burn), on the game tick; a quest step `{kind:'tend', fire: Id}`; the action `{t:'feed', fire: Id, item: Id, at}`.
- `kernel/src/state.ts`: `player.fires: Record<Id, {lit: tick, until: tick, kept?: tick}>` (restore defaults `{}`; `kept`, since 2026-10-16, is the dawn of a night an earlier burn kept, carried by a fire lit again by day while that vigil holds); `fireBurns(state, id, tick)` is `until > tick`; `nextLogAt(bundle, state, id, tick)` is the first tick from `tick` on at which a whole log fits, `max(tick, until - (cap - 1) * log_ms)`; `burnsAsWood(bundle, item)` and `tendHolds(bundle, state, id, tick)` are the wood and vigil tests that `feed`, `questSatisfied` and the client share.
- `kernel/src/step.ts` `feed`: the player stands within one tile of the prop, the item's class is wood (the kernel reads the class from the bundle; anything else is refused), one is removed; a fire that is out lights with `lit = tick` and `until = tick + log_ms`; a burning one adds `log_ms` when the whole log fits under `tick + cap * log_ms` (else "The fire is already full." and the log stays in the bag; `nextLogAt` says from which tick the next one fits) and keeps its `lit`; event `{e:'fire', id, until}`. `questSatisfied` for `tend`: `lit <= lastDusk(tick)` and `until >= nightEnds(lastDusk(tick))`, the dusk being the most recent at or before the state's tick, and since 2026-10-16 also `tick >= nightEnds(lastDusk(tick))`: the step is met only once that night's dawn has come, and stays met until the next dusk, a relight by day included: `feed` lighting a fire that is out while its vigil holds stores that night's dawn as `kept`, and `tendHolds` reads it (DECISIONS, the vigil at dawn). The fire's clock is the game tick, so away nothing burns; no sleep exists yet, and when it comes it burns the night's wood at once and ends the vigil (DECISIONS, the world and its clocks).
- `tools/src/play.ts`: the G48 rows; `tools/src/check.ts`: the fire's params open its warning only once a log fits (`warn_min` within `cap - 1` logs of burn, so the cap is at least 2).
- Tests (`kernel/test/fire.test.ts`): feeding lights and tops up to the cap and no further, a log that would not burn whole is refused and stays in the bag, and `nextLogAt` says when the next one fits; the fire goes out on time; a vigil holds from dusk to dawn and fails on a gap, however short; a replay agrees. `KERNEL_VERSION` 0.7.0.

b) The client and the content, branch `feat/tending`, on (a):
- Client: a Feed button beside a fire prop while the player holds wood (where Build sits), the flame drawn only while the fire burns and the embers fading as it runs down, the warning `fire.warn_min` game minutes before it goes out (G31, once per burn; since 2026-10-16 only while the fire still needs wood for the night it keeps), the journal line for `tend` ("Keep the hearth burning until dawn", then what it still needs), a prop with `lit_by` showing its note and sign only while that fire burns, and the fire's state surviving a reload.
- Content: a hearth prop `core/elder-hearth` beside Maru's house; the quest `core/the-long-night`: giver Maru, type `tending`, requires `core/a-coin-for-maru`, one `tend` step, offer and done lines in Maru's voice (a Mender: mend what is left), rep, gold and the bandage recipe (`core/bandage`, a Mender's: G4), and a remark afterwards.
- E2E (`game/e2e/tending.ts`): light the hearth before dusk, feed it through the night with the clock moved, see the warning once, see the step met at dawn and turn it in to Maru; a second pass lets it go out and sees the step unmet.
- Measurable: wood leaves the bag per feed; the flame shows only while lit; `pnpm verify` and `pnpm e2e` green.

## 14. The first expedition: the night ruins (P-6)

Status: building - variety

Read DECISIONS 2026-10-08 (the expedition), 2026-10-10 (the entrance is safe; "one mist"), 2026-10-11 (P-5c: the doorstep and its pit), 2026-10-13 (the frames), 2026-10-16 (the vigil closes at dawn; the night ruins' one way in), GAME_RULES G36, G37 and G49, and GRUNT P-6 first. Two pull requests, after sections 12 and 13: the container, then the ruins.

a) The container, branch `feat/expedition-kernel`, in `develop` as #119 (2719343); (b) builds on it:
- Schema, additive: a content kind `expedition` with `place` (an area slot), `window` (`{ bells }`: 2 to 6 hours on the game clock, all at night, in the order they ring; the first bell opens the window, the last walks out), `exit` (a safe slot), `chain` (3 to 5 quest ids, each with no giver and `requires` the one before), `climax` (`{ slot }` inside the place), `reward` (`opens`, `items`; no `rep`, there is no giver) and `on_miss: 'wait'`. `expedition` is not a quest type. `tools/src/assemble.ts` and `kernel/src/bundle.ts` carry it.
- `kernel/src/state.ts`: `player.expeditions: Record<Id, { climax: boolean, entered?: number, rung: number }>` (`entered` the tick of the first action or report inside the place on this visit, cleared by one outside; `rung` the bells reported since it); `kernel/src/expedition.ts`: `inside(bundle, state, x)`, `bellsRung(bundle, x, tick)`, `lastBellAt(bundle, x, tick)`.
- `kernel/src/step.ts`: on every action and report inside the place, each bell that rang after `entered` and is not yet counted in `rung` emits `{e:'bell', expedition, n}` (a bell rung while the player was outside is never reported); at or after the last bell the player is set on the exit tile, the outing closes there and `{e:'walked_out', expedition}` is emitted, no damage; a quest of the chain auto-activates only while the player stands inside the place inside the window (`autoQuests`), and its progress is kept like any quest's; the climax: standing on the climax slot inside the window with every quest of the chain done, once, emits `{e:'climax', expedition}` and applies the reward.
- `tools/src/play.ts`: the G36 row of section 8 becomes a check, and the G4 check counts a quest of a chain as rewarded by its expedition.
- Tests (`kernel/test/expedition.test.ts`, `tools/test/expedition.test.ts`): bells by the clock, the walk-out with the bag whole, a chain quest not starting by day or outside, progress kept across two nights, the climax once. `KERNEL_VERSION` 0.8.0.

b) The ruins, branch `feat/night-ruins` off `develop` once the vigil at dawn (`feat/vigil-dawn`, `KERNEL_VERSION` 0.10.0) has landed; section 13b (#120) is in, and its Feed button and its `lit_by` reading are used here. Nothing in `kernel/src/` changes.
- One way in, open before dusk. Today the threshold's doorstep (36,21) is sealed by rubble on three sides while the ruins open onto the meadow. On `map.ground` the doorstep's south tile (36,22) turns from rubble `%` to ruin floor `#`, so the doorstep and its pit lead from the threshold into the ruins, and walls (rubble on the ground or solid props, as `walls()` in `tools/test/expedition.test.ts` lays them) close the rest of the place's edge. The place is one area slot over the doorstep and the ground behind it: the yard, the hall and the gamble's pocket. Its bounds are forced, about x 32 to 39 and y 21 to 31: the threshold, its exit, stays outside above it and touches it; the garden's bell bushes (`core/ruins-garden`, from x 40 on the doorstep's rows) and `core/lantern-foot` (44,26) stay outside the walls, reachable from the meadow by day, since the opening needs both before the arch opens (`tools/test/opening.test.ts`, `game/e2e/opening.ts`); and row 33 stays open meadow, the only road to the tangle's mouth at (39,34), so the south wall runs on row 32 at the lowest. The gate rubble (`core/ruins-gate`, x 34 to 38, y 22 to 26) lies inside: it is dug by day through the threshold once the arch is open, and `kernel/test/invariants.test.ts`, which walks there, opens the arch first. The deep ruins (`core/ruins-deep`, x 39 to 43, y 26 to 30) stay outside the walls, a day dig from the meadow as today (the east wall takes at most their first column). The G36 check in `tools/src/play.ts` refuses a second way in, on the map by day before anything is mended and once every passable restore outside the place is mended (what its reward opens aside), and an exit that touches no walkable tile of the place by day; so once the arch is open the way in is open at every hour, and the brazier can be lit before dusk.
- The doorstep's pit is the night's toll. The one way in crosses `core/doorstep-pit`, so at night every crossing, in or out, costs its harm (30% of the bar); by day it sleeps. Nothing routes round it: the pit is where the floor is broken (G34). G34's run in `tools/src/hazards.ts` adds the harm of each pit on its road to the bites (today it counts bites only), so the worst run from the wolf's watch back to the threshold, toll paid, still ends short of a fall. The doorstep test in `kernel/test/hazards.test.ts` and step 12 of `game/e2e/opening.ts` (one step past the threshold at night: the pit, then the wolf, then a fall that takes nothing) rest on a dead end that the den's reach covers; both are restated for the open doorstep and the round: the toll on the step in, then the fall once the round's eyes find the player, still with nothing lost.
- Content: `core/night-ruins` (the expedition: the area slot above, bells at 20, 23, 2 and 4, exit `core/night-threshold`, the chain and the climax); `core/ruins-wolf` gets a round through the yard between the gate and the hall, with cover props among the pillars. The round keeps the opening's night walk out of its eyes: the test in `kernel/test/hazards.test.ts` that the walk to the arch and its threshold stays out of the wolf's reach is restated for the round, so no tile of the walk (the arch mouth, the arch, the stone and the threshold, all at y 20 or above) lies in its watch (`watchOf` in `tools/src/hazards.ts`) or is seen (`sees`) at any tick of the night. A round heading north at (36,24) already sees the arch at (36,19); one whose tiles all lie at y 26 or below sees no higher than y 21. The four quests, in this order of `requires`:
  - `core/the-hall-at-night` (stealth): find `core/glowcap`, a mushroom in the hall with `hours` [20, 4), so it can be found until the last bell (hours wrap past midnight, as `core/forest-mushrooms`' [17, 10) do); its reward opens `core/deep-way`, rubble with no inputs as the arch-way is.
  - `core/what-the-deep-keeps` (gamble): a dig spot `core/bell-pit` in a new pocket of the place behind that rubble, so inside the walls only the chain reaches it: for example the south-west corner below the ruin wall at (32,27) and the rock at (34,27), closed on its other sides by the walls and new rubble, one tile of which is `core/deep-way`. It finds `core/bell-shard` one in five at a perfect dig (`chance_pct` 20); its other rows follow the gate rubble's, where three digs in four turn up something at a perfect dig (a pottery shard, an old coin), so most digs pay something even without the shard (G15); their shares sum to 100, and `pnpm values` regenerates the lock. Its numbers allow at least 8 digs in one window at the base speed: a spot is ready again `active_ms + respawn_ms` after its dig starts and the window runs 400000 ms from the first bell to the last, so `count * (1 + floor((400000 - active_ms) / (active_ms + respawn_ms))) >= 8`; the gate rubble's `count` 3, `active_ms` 5000 and `respawn_ms` 120000 give 12, the deep ruins' 2, 7000 and 300000 only 4. That bound counts the spots as if they were dug side by side, and the player digs one at a time, so a test digs the pit in a loop through one window, each dig at the later of the last one's end and the spot's `readyAt`, as `digLog` in `kernel/test/invariants.test.ts` digs the gate, and counts at least 8. The pit can be dug by day too: a treasure has no `hours`, the deep way stays open once mended and the place is open at every hour, and a find with no giver is met by the journal, so a shard dug at noon finishes the quest the moment it begins at night. DECISIONS 2026-10-16 records the owner's call: its default accepts the day dig, and the window's cadence is then the night player's pace, not the gamble's pressure; the other answer is an optional `hours` on a treasure, a kernel pull request of its own before 14b. The quest's reward is two logs, dry wood for the brazier.
  - `core/the-brazier` (tending): `core/hall-brazier`, kept by the dawn rule (DECISIONS 2026-10-16): lit at or before dusk, burning without a gap, and met only at dawn, 05:00. The last bell rings at 4, so the step is met at the dawn after the walk-out, and the quest, which has no giver, finishes itself at the first step from then on, wherever the player stands; the riddle after it and the climax come on a later night. A fire lit at dusk needs at least five logs to reach dawn (nine hours at two a log), fed before the last bell, and with a cap of three the log that carries it to dawn goes in at 23:00, the second bell, or later; the gamble's two logs can be the last two. The chain reaches the brazier only after dark, so the world and Maru tell of it before (below); the rule stays as the kernel has it, with no anchor of its own.
  - `core/the-hall-reads` (riddle): the hall's inscription with a Waker's and a Mender's reading of one line, STORY.md S2 and S4, answer: visit `core/bell-alcove` at night; the inscription prop carries `lit_by: core/hall-brazier`, so on that later night the brazier burns again for it (one more log), unless the player read it by the vigil's fire.
- The climax slot `core/bell-foot`; the reward opens `core/hall-stair`, a restore the player can also shore by hand with six logs by day (G37: the expedition is the sooner road, never the only one), and gives items of its own (a keepsake of the bells, say), because `applyReward` skips a restore already mended and the climax must pay on the hand road too. The stair's cellar `core/hall-cellar` is a dig spot by day whose find hints at a fold (a clockwork scrap, STORY.md section 1).
- Maru gets one topic about the hall's fire, open once `core/the-night-arch` is done (`when.done`, as her lanterns topic waits on `core/a-coin-for-maru`), at any hour (no `when.time`). Her sheet forbids a straight answer about the bells, so it is a Mender's hint in her voice with no bell, no hour and no count: the hall's fire was lit before the dark came, and it wanted a night's wood (for example "The hall had a fire once. They lit it before the dark, never in it." and "It took a night's wood. Someone always stayed to feed it."). The world says it first (G19): by day the brazier stands cold in the hall with the Feed button beside it, the inscription beside it reads "Too dark to read." until the fire burns, and once the quest begins the journal's tend line says what the fire still needs (13b). The brazier carries no note: a note no riddle cites is refused (G8).
- The arch and the three-stones riddle stay as they are, and so does the threshold's first-visit box ("Not tonight. The way stays open.", `game/src/ui/ui.ts`): it is the opening's invitation on its first night (DECISIONS 2026-10-10, with its own Retry-when), and the way does stay open.
- Client:
  - the bells as the clock on screen while inside the place inside the window: one chip with the bells rung and the time to the last bell (`Last bell in m:ss`), read from `bellsRung` and `lastBellAt`, not counted from the events (a bell rung before the entry counts but is never reported), urgent in its last minute as the dark chip is (`nightCountdown`);
  - the bells land on a player standing still: the kernel tells a bell and the walk-out only inside `step`, on an action or a report; the client reports only on a new tile, during a hunt and at a predator's first sight, and `Session.advance` moves the clock without a step; so while the player stands inside the place the scene reports the tile again once (`s.report(s.pos, true)`, as a hunt does) whenever `bellsRung` changes, and each bell and the last bell's walk-out come on time;
  - each `bell` event plays a sound of its own (a new `SfxId` in `game/src/audio/sfx.ts`, not `bell`, which the night bed rings at random and a fall plays an octave down) and flashes the chip, its visible twin (G24, G27); the night bed's random bell (`game/src/audio/ambience.ts`) is silent inside the place, so a bell heard there is the clock;
  - the walk-out beat: on `walked_out` the session sets `pos` from `state.player.at`, where the kernel set it (the exit's corner), and drops the undo; it keeps the deferred events and the pickup of work under way, which land as usual, since a walk-out takes nothing back (G49) and a find made at the last bell is still announced (`Session.wake` drops them only for a fall, which takes the outing back). Both scenes end their walk, auto-work and work as they do for a fall (`fallDown` in `game/src/scenes/world.ts`, the `fall` handler in `game/src/play3d/world3d.ts`), so the next report starts at the threshold; then the mist thickens, the screen fades, and the player stands at the threshold with one box;
  - the climax beat: the `climax` event plays a sound of its own (a new `SfxId`: each beat has its own effect, G24, as the bells have theirs) and shows a banner with the expedition's title and a box of its own, the narrator's lines in a new optional `climax.lines` (one to three; additive, `FORMAT_VERSION` stays 1), the same whether the bells opened the stair or it was already shored by hand. When the reward opens the stair, the same batch's `restore` of `core/hall-stair` plays no quest jingle and shows no "restored" toast and no `done` lines (one beat, one sound, one box), and its tiles still change; the stair's `done` lines are the box of the hand road and read true there;
  - the inscription read by `lit_by` (section 13b).
- E2E (`game/e2e/expedition.ts`, added to `pnpm e2e`, under the lock), over two nights: by day hear Maru's topic and light the brazier before dusk; on the first night find the glowcap, dig the bell pit until the shard and feed the brazier the gamble's logs, then stand still across the last bell and be walked out with no input and the bag whole, drawn on the threshold where the kernel set the player; see the brazier's step met at dawn and not before; on the second night light the brazier again, answer the inscription at the alcove and reach the climax; dig the cellar by day.
- Measurable: the e2e log prints the climax line and the opened slot (P-6); the dig-loop test counts at least 8 digs of `core/bell-pit` in one window; `pnpm verify` and `pnpm e2e` green.

## 15. The art at 64 px per tile: the engine step

Status: built (#191)

Read DECISIONS 2026-10-18 ("The art moves to 64 px per tile") and its frames, `docs/design/frames/2026-10-18-density.md`, then `docs/design/STYLE.md` sections 1 and 1b, first. The art stream (`art` in `streams.json`) holds it. One pull request, branch `feat/art-density`, opened when the manager calls it: after the opening's hook build has merged (section 16), as the first item of stage 3, never mid-release. No sprite is redrawn here. The redraws come after it, in waves made with `pnpm kit:gen` (`tools/src/kit/gen.ts`).

The route: the world keeps its unit, 16 per tile (`T`, `game/src/config.ts:11`), and no tile coordinate, e2e coordinate or literal pixel offset moves. Two things change. The canvas draws at the device's own pixels, and a sprite drawn at 64 shows at a quarter scale. The camera's zoom is then 4k canvas pixels per world unit, where k is a whole number: an art pixel at 64 is k device pixels, and an art pixel of today's 16 px art is 4k. The other route, `T` 64 with every sprite of today at 4x, gives the same picture and touches all 107 uses of `T` and every literal offset; it is not taken.

The camera's rule: k = max(1, floor(S / (9 x 64))), where S is the canvas's shorter side in device pixels, so the short side shows at least 9 tiles.

| Screen | Device pixels | k | Tiles across x down | Today |
|---|---|---|---|---|
| 2K phone (a 2024 flagship) | 1440 x 3120 | 2 | 11.3 x 24.4 | 12.9 x 27.9 (412 CSS px at zoom 2) |
| e2e phone, 390x844 at 3x | 1170 x 2532 | 2 | 9.1 x 19.8 | 12.2 x 26.4 |
| 1080 px phone (not a target) | 1080 x 2400 | 1 | 16.9 x 37.5 | about 12 |
| e2e desktop | 1440 x 900 | 1 | 22.5 x 14.1 | 18 x 11.3 (zoom 5) |
| 1920 x 1080 desktop | 1920 x 1080 | 1 | 30 x 16.9 | 20 x 11.3 (zoom 6) |

0. **A still for the owner first.** The camera is a direction (AGENTS.md): before the build, the opening's first frame today and with this rule, at 1440x3120 and at 1440x900, one difference each. The phone comes a little closer and the desktop shows more of the world. His pick goes into DECISIONS with its frame; if he wants another k on a screen, the rule changes here first.
1. **The canvas at device resolution.** `game/src/main.ts:27` sizes the canvas in CSS pixels today (`Phaser.Scale.RESIZE`, `window.innerWidth`). It takes the device's pixels instead: the size from `devicePixelContentBoxSize` where the browser gives it, else `Math.round(css x devicePixelRatio)`; the CSS size stays the window's; both are redone on a resize and when `devicePixelRatio` changes (a window moved to another screen). `pixelArt` and `roundPixels` stay. The HUD is DOM (`#ui`) and does not change. What converts the world to the page goes back to CSS pixels: `worldToPage` (`world.ts:1801`) divides by the ratio, and so `screenOf` does, which `game/e2e/hud.ts:77` reads. The screen-sized effect canvas (`fx-frame`, `world.ts:1167`, filled pixel by pixel) is built at CSS size and drawn stretched, unless its cost at device size is measured and fine. The shade and dusk rectangles take the canvas's size as today.
2. **Schema, additive** (`schema/src/index.ts`, `KitBody.sprites`): an optional `density`, 1 (16 art px per tile, the default) or 4 (64 per tile); `w` and `h` go from at most 64 to at most 384 (a prop six tiles a side at density 4); and the optional `source` of ASSET_PATH section 4, item 2: the `kit:gen` spec and the `manifest.jsonl` line the sprite came from. The descriptions name both grids. `pnpm schemas` regenerates `schema/json`.
3. **The check** (`tools/src/check.ts`, the size rules at lines 482 to 491): tiles and items are 16x16 at density 1 and 64x64 at density 4, character frames 16x24 or 64x96, work poses 32x32 or 128x128, props up to 64x64 or 384x384; a sprite whose size belongs to the other density is an error. The bundle (`tools/src/assemble.ts`) carries `density` into `bundle.sprites`, in this pull request, since nothing before it needs it.
4. **The client:**
   - `game/src/scenes/boot.ts:13-15` loads as today; a frame's size is its `w` and `h`.
   - One helper makes every kit image and sprite the scenes create (31 `add.image` and `add.sprite` in `game/src/scenes/world.ts`, 3 in `game/src/senses.ts`, 1 in `game/src/scenes/peek.ts`) and gives it the base scale `1 / density`. The scale writes (8 in `world.ts`, 1 in `senses.ts`: `setScale` and scale tweens) become relative to that base, so a sway or a squash never quadruples a density-4 sprite. Mirroring by `flipX` stays.
   - The camera (`fit()`, `world.ts:2444`, today `Math.max(2, Math.min(6, Math.floor(Math.min(w / (15 * T), h / (10 * T)))))` in CSS pixels) sets the zoom to 4k by the rule above, on the device-pixel canvas. The peek's fitted zoom (`scenes/peek.ts`) stays fractional, an overview as today.
   - The hook's close stop on the stone (section 16 e, built at zoom 3 where the world was at 2) is settled here: it holds k' = max(k + 1, round(1.5 k)), so 3 on a 2K phone, and the stone's art stays whole.
   - The mouse wheel (GRUNT CR-109) is not in this pull request. It lands right after it as `feat/wheel-zoom`: whole steps from the default k up to k + 2 and back, never out past the default.
   - The baked ground (`world.ts:598`, `createCanvas('ground-' + frame, m.width * T, m.height * T)`, two frames or more): while every ground tile is at density 1 it bakes as today. Once one is at density 4 the ground bakes at 4x, a density-1 tile drawn at 4x with smoothing off and a density-4 tile at 1x, and shows at a quarter scale. The 48x49 valley is then 3072x3136 per frame, about 38 MB each, so the bake goes per chunk of 16x16 tiles (1024x1024): only the chunks in view and one ring around them are kept, built as the camera moves. The open world's generated ground needs the same chunks.
   - `game/src/richground.ts` (`remapTone(data, width, tone, frameWidth)`) works per art pixel; a test runs it on a 64-wide frame. The scatter of ground motifs (STYLE.md section 3) is not in this step; it comes with the ground wave.
5. **Docs, at this step and not before:** `docs/creators/README.md:238` (both grids: a new sprite is drawn at 64 with `density: 4`, and 16 is still accepted), `docs/design/ASSET_PATH.md:14`, `docs/team/INTRO_HE.md:101`, `docs/team/SEO_GEO.md:50` and the schema's descriptions; grep `docs/`, `templates/` and `web/` for `16x16`, `16x24` and `32x32` once more before the push.
6. **Before the proving run** (AGENTS.md): grep `game/e2e/` and `game/test/` for the zoom, pixel sizes, screen positions and screenshot clips (`zoom`, `* 16`, `16x`, `clip`, `toScreen`, `screenOf`, `scale.width`), above all `game/e2e/hud.ts:77` and `:254`, and fix every expectation in one pass. Then the single test files, then `pnpm verify`, then `pnpm e2e` last.
7. **Tests:** in `tools/test`, the check accepts each grid at its density and refuses a mixed one, and the bundle carries `density`; in `game/test`, k for every row of the table above, the zoom always a multiple of 4, a scale tween on a density-4 sprite that ends at its base scale, and `worldToPage` in CSS pixels on a 3x canvas.

Measurable, in headless Chrome on its own port, closed by PID, at 480x1040 with a device scale of 3 (1440x3120) and at 1440x900:
- the canvas's pixel size equals the screen's device pixels;
- k is 2 (zoom 8) at 1440x3120, 1 (zoom 4) at 1440x900, and 2 at 390x844 at 3x;
- with one density-4 sprite in a scratch bundle (the 64x96 Pell of the trial, not committed), every art pixel of it is a 2x2 block of device pixels on the 2K phone, and its feet stand on the same tile as the 16 px trader's;
- an art pixel of today's 16 px art is an 8x8 block on the 2K phone, with no blur and no uneven rows;
- the frame time and the texture memory at 1440x3120 are written into the pull request body, before and after;
- `pnpm verify` and `pnpm e2e` green.

After it, not in this pull request: the waves, in this order.
- (a) The ground at 64: the fill tiles and the scatter motifs of STYLE.md section 3, with its measures, for the valley's grounds and the first ring's.
- (b) The opening's characters at 64x96 in the look of the frame `density-64`: the four starters, Maru and Pell, then their walk, idle and work frames. Superseded (DECISIONS 2026-10-22, decisions 3, 41 and 43): the cast is the races and the NPCs on one unclothed rig with slot wear, drawn after the animation route of decision 6.
- (c) The props and trees at the sizes of STYLE.md section 1b, with the see-through rule.
- (d) The items.

Each wave is a pull request of kit PNGs with `density: 4` and their `source`, with a phone still of the wave. The first wave's still shows the proportions table to the owner once (STYLE.md section 1b); after that a wave is polish inside the agreed direction, with no stills round. The shadows, the night and depth cues 1 to 5 did not land with this step: they come in the engine-ladder session of decision 6 of 22.10 (after the map plan and the Pell pick), with the doubled numbers of STYLE.md.

### The waves' tools

Written 2026-10-18 after one measured image per tool (the same 64x64 axe item, `.scratch`, not committed). Elad's word that day: the art at 64 is redrawn anew with every tool we have, and there is a lot of it.

| Tool | Measured | Good at | Not good at | Cap per day |
|---|---|---|---|---|
| Codex images (`pnpm kit:gen`, subscription) | 116 s, 28,408 tokens; the importer read it as a 33x46 art grid for the 64x64 asked, so it warned "coarser grid" and voted it down | everything with a reference: characters, props, items, in the house style of `gen.ts`; the importer snaps it onto the palette | fine pixel detail: it draws about half the grid asked, so a 64 px sprite comes out at about 32 px of detail | 20 images, a hard cap set by the owner's allowance (18 used on 18.10 before this section) |
| Gemini images through `ask-agy` (skill antigravity) | 68 s for the image, but only with `--write --allow-cmd cp -C <dir>` (without them the run is denied twice, 45 s and 68 s spent); gave a 1024x1024 JPEG at 2x the pixel density of the Codex one, a clean outline and a flat magenta ground | props and items (it draws the finest pixels of the three); characters untried | exact grids (it is a JPEG, so the importer must snap it and may lose the outline); it carries 14k input tokens a call against the account's quota | not measured. `rotation.log` shows a 429 "Individual quota reached" with resets of 87 to 152 hours on three accounts (10 to 11.10), so it is weekly or longer per account and per model family; three accounts are signed in. Do not plan on a number until a day's run is counted |
| Gemini images through the browser (`~/browser-agent/gemini_image.py`) | 39 s, 709x708 PNG | a quick look at a direction | the screenshot takes the page's prompt bar into the picture (seen at the bottom of the axe), so every result needs a crop; one account | not measured; Google enforces a small daily limit on this account's Deep Research and may on images |
| ChatGPT images (`~/browser-agent/ask_gpt.py`, skill gpt-consult) | 79 s, one image created in the chat | characters and scenes with a reference image (`--image`) | `ask_gpt.py` does not save the picture: it returns the chat link and text only, so a save step has to be written first (the way `gemini_image.py` does it) | not published; the model said it cannot see the quota. Business seat, so treated as unmetered until a refusal appears |
| Text-grid route (`route: grid`) | exact grid, seam measured (DECISIONS 2026-10-18) | tiles that are a pattern (rock slabs, cobble); no image budget | scatter (rows) | none: text, about 10k to 26k Codex tokens a tile |
| Scatter script (`route: scatter`, PR #166) | the layout is the script's; 23 tests; no real motif drawn yet | every ground: meadow, sand, snow, mud, the first ring's grounds; a motif is a few hundred characters, so a whole ground is about 6 small text calls and no image | anything that is a single object | none: text |
| The importer (`importSprite`, `importTile`) | snaps any picture onto the 32-colour palette and the asked size, warns when the drawn grid is off | all of the above | restoring detail a model did not draw | none, local |

Order, as the player sees it:

1. **The opening's ground** (4 images, then text): bridge, broken bridge, cobble and water by image; meadow, sand, path, forest floor, grove and ruin floor by scatter, with shores, banks and fringes left to the engine's edge masks (STYLE.md section 3), which retires 16 of the kit's 37 tiles from the redraw.
2. **The cast** (52 images; superseded by decisions 3, 9, 41 and 43 of 22.10, which put the races and the NPCs on one rig): the four starters in both builds (`player`, `woman`, `explorer`, `forager`, `digger`, each with its `_w` form, 8 in all) at 6 images each (one strip per direction for walk and idle, one for the work pose; left is the right one mirrored), then Maru's and Pell's frames (elder, trader, 2 each).
3. **The trees around the wake and the bridge, then the town** (55 images): oak (3 variants), young tree, dead tree, canopy 1 to 3 first; then house, stall, well, lamp, stone and totem, the ruin set, then the small ground props (bushes, grass, flowers, rocks, signs, hazards), the large ones at the sizes of section 1b.
4. **The items** (19 images, or 5 if four icons share a picture): the ones a quest names first (axe, basket, berry, herb, stone, log), then the rest.

Count: 4 + 52 + 55 + 19 = **130 images**. At one retry in two (the Codex measure above says the first try often needs a second one) that is about **195 draws**, of which Codex alone takes **10 days at 20 a day** (7 days if every draw were kept). Gemini through `ask-agy` and ChatGPT would cut that, but neither cap is measured, so no number of days is credited to them here: after the first day of counting, the line is rewritten with them in. The ground costs no image budget beyond its 4, so the first days go to the scatter route's motifs and the cast.

## 16. The opening's hook: the receding mist, the bridge's moment, the returners' stone

Status: built (#157, #160, #172, #182, #206)

Stage 1 of the order (DECISIONS 2026-10-17, "The order from here"). Read first: DECISIONS 2026-10-10 "The hook is the receding mist", 2026-10-17 "The opening's renewal: the owner's three answers", 2026-10-18 "The hook's stills: the glint, the close stop, the mist drawn back 13 tiles"; `docs/design/OPENING_REVIEW.md` sections 3 to 5; the frames `docs/design/frames/2026-10-17-hook-*` and their note; `docs/design/GAME_RULES.md` (G12, G14, G21, G30, G31, G59 and section 6); `docs/design/STORY.md` S1 to S6. The stream is `hook` in `streams.json`.

Six pull requests, in this order, each off `origin/develop` once the one before it has merged. A change to a shared file (the schema, `NEXT.md`, `streams.json`) lands as its own small pull request first. The art at 64 px (section 15) waits for this section to close: do not touch the density, the zoom or the tile size here.

a) **B2, the mist layer** (`feat/hook-mist`). One layer in world space in the classic client: an ordered 4x4 dither on game pixels in `#3a3554`, `#5d6177` and `#1b1a2e`, clear for 5 tiles around a centre, then 6 tiles thickening, at least 96% at the map's edge, the HUD above it (frame `2026-10-10-receding-mist.png`, matched by the stills). `world.ts:988`'s mist sprite goes. The night light (section 11: no mist on the character, the dark pool and the lantern) sits over it unchanged. The 3D door keeps its own fog and is not part of this section. Tests on a captured frame, not by eye: criteria 1 and 2 of OPENING_REVIEW section 5.

b) **The schema step** (`feat/hook-schema`, additive, format stays 1). A pocket radius on a starter and a `mist` radius on a restore, so the kernel stays integer-only and the client draws only what content declares. The mist's state is a pure function of the save (the starter's wake, the first task done, the places restored), which is why a reload keeps it. `pnpm schemas` regenerates `schema/json`.

c) **The pockets and the first push** (`feat/hook-pockets`). Each starter wakes in a 5-tile pocket: forager (6,17), digger (9,23), explorer (7,6). The first task grows the pocket from 5 to 7 tiles within 1 s, and a reload keeps it (criterion 3). The explorer's cue (picked, frame `hook-1-explorer-cue`): a mote of light at the circle's edge toward the glint (11,19), read by the senses attribute. G10: today the explorer strikes the keystone (12,18) before the glint and the glint's task completes in passing; propose the smallest change that makes the glint a question the senses answer before the keystone, without moving any prop or wake tile (G59). Write the proposal into the pull request body; a change to a prop's place or the map goes to the manager before it is built. Built since in section 17 a: the proposal of #163 (a gate on the keystone) is accepted there.

d) **The bridge's moment** (`feat/hook-bridge`). The mend clears at least 13 tiles around the bridge (14,17) within 3 s, all three wake tiles inside, kept on reload (criterion 4, the review's correction of the 10.10 "7"). A bell rings once, far off: `bell` from `game/src/audio/sfx.ts`, quieter than the threshold's bell and low-passed, no new asset, never twice and not before the mend (criterion 5). The town's smoke (picked, frames `hook-3-day-edge` and `hook-3-night-edge`): a column of single puffs bending at the top, held at the view's edge in the town's direction while its chimney is off screen and drawn at the chimney once it is in view; it dims with the night (criterion 9). This closes G4: "Smoke over the town" now has the cue it names. No far smoke beyond the valley (Q3: it lands with the first ring's first stamped place).

e) **The stone and the name** (`feat/hook-stone`). The "Mended by" sign (`world.ts:2303`, `world3d.ts:1288`) becomes the returners' stone: six written names, one word each, written content, above one empty line (criterion 6). The camera glides down the names and stops close, at zoom 3 on the stone (picked, frame `hook-2-stop-close`); the carve is a beat of the moment that replaces no input (`hook-2-carved`). The stop is a held zoom of its own: section 15 moves the world's camera to whole steps for the 64 px art, and settles this stop when it lands. The mend's pay (the tile, the bell, the stone) lands first; the carve is the last beat, with a default for a player who does not type: propose its wording in the pull request body, and the owner judges it on the release preview. `start` accepts an empty name and a later action sets it (kernel `step.ts`: 1 to 16 letters, digits, spaces, `_`, `-`); a save made before keeps its name and its stone line. The stone speaks only of people who came back and carved a name, never why or when (S1, S2). The opening e2e asserts `Mended by Tess`: grep every renamed string first and fix every expectation in one pass. The bridge's purse line (`content/core/restores/old-bridge.json`, "Under it hangs a purse: thirty gold, a tool's price. Fell a tree before dark.") gets the stone as its speaker (review gap G9: nobody left the purse, and S1 forbids the narrator to say who) and loses "before dark" (gap G6, section 17); propose its wording in the pull request body.

f) **The waking lines and one box** (`feat/hook-waking`). One box of two lines per start, in place of today's three (Q1, the exact text in DECISIONS 2026-10-17); the bridge and its keystone come from the task tracker. The first movement is possible after at most one tap (criterion 7; the e2e's "6 clicks for 6 advances" assertion changes with it). Maru's last box adds "Pell still waits for herbs" (Q2).

- Before every proving run (AGENTS.md): grep the tests for every string the change renamed, fix them in one pass, then the single test file, then `pnpm verify`, then `pnpm e2e` last, one heavy job at a time on a shared machine.
- Measurable at the end of f): criteria 1 to 10 of OPENING_REVIEW section 5, each by a test or a capture; in the timed run of each starter no stretch passes 90 s of play clock between the wake and the threshold, the wait before the dark included (criterion 8).
- For the owner on a real phone, from the release preview: the mist's shade and density, the dither's shimmer while walking, the bell's loudness, whether the smoke reads as a compass, and a human playthrough's timing (OPENING_REVIEW section 8).

Notes for e and f from the session that built c and d (18.10; line numbers as of #172, grep before trusting them):
- "Mended by" lives in: `game/src/ui/panels.ts:815` (the sign panel's `sign-mended` line, fed by `mendedBy` in `world.ts` near 2477 and 2498); `world.ts` near 2498 and `game/src/play3d/world3d.ts` near 1283 push `Mended by ${p.name}.` into the sign lines; `content/core/restores/old-bridge.json` lines 25-26 (the `done` text, the purse line being the one that moves to the stone); `game/e2e/opening.ts:693` asserts `Mended by Tess` and `game/test/text.test.ts:179` pushes a `Mended by Test` journal line. `game/e2e/opening.ts:617` counts the clicks for advances: that is f, not e.
- The mend's moment is `celebrate()` in `world.ts`, on the `restore` event. The far bell is queued there (`farBellDue`, `FAR_BELL.delayMs` 1500); the carve comes after the bell and the clearing, not before.
- The kernel applies a mend when its 4 s of work start, so the mist clears about 2 s in, before the `restore` event: anything that follows the mend keys on the event, not on the save. The clearing is around the slot's middle tile; the pure helpers are `game/src/hookbridge.ts`, tested in `game/test/hookbridge.test.ts`.
- A new worktree needs `pnpm install --frozen-lockfile` and `pnpm bundle` before `pnpm typecheck` (`game/src/generated/bundle.json` is missing until then).
- The forager has no `wake` in its JSON: tests use `starter.wake ?? b.map.spawn`.
- The e2e lock had seven sessions queued on 18.10 (about 50 minutes to a turn): start it early, in the background; `fuser -v /tmp/game-e2e.lock` shows the queue.
- Keep the Codex review: it found a real defect in both c and d.

## 17. The opening's quest logic: the gaps of the review that are not the hook

Status: built (#174, #179)

Stage 1 of the order (DECISIONS 2026-10-17, "The order from here": the opening's renewal is logic and a hook). The owner asked on 18.10 for these to land now, beside the hook build (DECISIONS 2026-10-18, "The opening's quest logic is built beside the hook"). Read first: `docs/design/OPENING_REVIEW.md` sections 3 and 4.4 (the gaps are numbered G1 to G10 there; they are not the rules of the same numbers); `docs/design/GAME_RULES.md` pillars 1 to 3, the ladder (section 2), G1, G4, G12, G14, G17, G18, G59 and section 6; `docs/design/STORY.md` S1 to S6; DECISIONS 2026-10-10 "No dead props". The stream is `opening-logic` in `streams.json`.

No rung moves, no prop, wake tile or map place moves (G59), and nothing here touches what section 16 owns: the mist, the bridge's moment, the stone, the waking box, Maru's last box (16 f) and the purse line (16 e). The lines here are content: the builder writes them inside the rules, and the owner judges them on the release preview. A line that would need a new fact about the past goes to the manager first.

a) **The glint before the keystone** (gap G10; the proposal of #163). Two pull requests, the shared file first.
   1. `feat/node-opens-after` (schema only, additive, format stays 1): an optional `opens_after: <quest id>` on a resource node, with its description; `pnpm schemas` regenerates `schema/json`; `pnpm check` refuses an id that is not a quest.
   2. `feat/glint-first` (kernel and content): one check in the strike path of `kernel/src/step.ts`. A node with `opens_after` can be struck by a character who was never offered that quest (`offeredTo`), or who has it done. `core/keystone` gets `"opens_after": "core/glint-by-the-bridge"`, so the forager and the digger strike it as today and the explorer takes the glint first. A refused strike is never silent (No dead props): it costs no busy time and no stamina, and it says one line that points at the glint, at most 80 characters (the proposal: "Something else catches the light first."). Tests in `kernel/test`: the three starts before and after the glint; the explorer e2e takes the glint first (grep `game/e2e/opening.ts`, `game/e2e/hud.ts` and `tools/test/opening.test.ts` for the keystone's order before the run).
b) **The forager's first task is a question** (gaps G5 and G1 against the rules G1 and G17). `core/first-pickings` is `skill` and so is `core/fix-the-bridge` after it, and its summary is a count ("Pick two herbs"). Give it a type that is not `skill`, chosen from the palette by what the player does, and a summary that names what is unknown, with a `find` step and a clue if that is the honest shape. It keeps the rung: herbs on the west bank, something in the bag within 15 s of the first input, found the forager's own way. `pnpm check` prints no G17 line for any start's chain.
c) **"Before dark" says what is true** (gap G6). At danger level 0 nothing happens at dark to a player without a fire (G30), and the 8-10 minute rung sends the player to the arch after dark, so: the first fire's title and summary (`content/core/quests/first-fire.json`) drop the deadline, or name a stake the game really keeps; and Maru's stranger line "Stay by the fire after dark. The mist is kinder by day." (`content/core/npcs/elder.json`) stops telling the player to stay in, without spoiling the arch. Keep each box within two lines of 80 characters (G14).
d) **The choice is said once** (gap G8). "Whom you help first is yours" stands three times in a row: the `core/into-town` done box, Maru's first meeting, Pell's first meeting. Keep it in the `into-town` box; Maru's and Pell's first lines keep what their own errand gives and in what kind (G12: each neighbour says what its errand gives), without the choice sentence.

b, c and d are one pull request, `feat/opening-lines`, off `origin/develop`, in any order with a; a and the hook's d to f touch different files, and a conflict in `content/core/npcs/elder.json` with 16 f is resolved by keeping both.

- Before every proving run (AGENTS.md): grep `game/e2e`, `game/test`, `kernel/test` and `tools/test` for every line and title changed, fix the expectations in one pass, then the single test file, then `pnpm check` (no new `!` line), then `pnpm verify`, then `pnpm e2e` last, all one heavy job at a time on a shared machine.
- Measurable at the end: in the explorer's timed run the glint's find comes before the keystone's strike; striking the keystone first gives the line and changes nothing else in the state; the forager's and the digger's runs strike the keystone at the same step as before; `pnpm check` has no G17 line; the sentence about whom to help first appears once in `content/`; no text box over two lines of 80 characters.
- For the owner on the release preview: the wording of the new lines.

## 18. Accounts and a server

Status: building - accounts

Stage 3 of the order (DECISIONS 2026-10-17, "The order from here"), the first of its two parallel streams; it is not built before stages 1 and 2 close (sections 16 and 17 merged, v0.1.5 shipped). Read first: the spec stage 2a under `docs/spec/`; `docs/kernel-review-v1.md` (R4 the secret seed, R5 the versions, S1 the forged hours, K3); `docs/design/PLATFORM.md`; DECISIONS 2026-10-07 "A save is a state snapshot plus the last actions", 2026-10-07 "Every action names the player's tile", 2026-10-08 "Stage 2a after the stage-1 service", 2026-10-09 "An account asks for little"; `GRUNT.md` CR-26, CR-49, CR-53, CR-85, CR-101; the stage-1 service (`web/src/pages/api/s1/*`, `game/src/net/s1.ts`); and the owner's answers of 18.10 in DECISIONS 2026-10-18 "Accounts and a server: the owner's answers". The stream is `accounts` in `streams.json`.

The model of the stage, in one paragraph: the server runs the same kernel as the phone (`step`, `replay`, `serialize`), keeps the only copy of the seed, and holds every part of a player's game state. The phone sends actions and shows what the server answers. It keeps settings and nothing else. No trade, no shared world, no chat (stage 4 and later): this section builds one player alone on a server. About 8 to 12 thousand lines, as the spec says; no save conversion, since the saves of today are replayed (d), not converted.

Where it runs (the owner, 18.10): on his own rented server, from the first day, no new monthly cost. Its address and how to reach it stay in the owner's private notes, never in this public repo. The box also runs another product (its own app and postgres containers, nginx, and a host postgres 16): the game never touches those. The game's API and its database are two new containers of their own, each with its own database user, its own memory cap and its own nightly backup. Read-only facts measured on 18.10: 4 cores, 7.8 GB RAM with 7 GB free, 36 GB disk free, idle. If real-time load outgrows the box, the options go back to the owner; this section does not pre-empt that. This supersedes "functions and a managed database" of 8.10; nothing here uses a paid vendor.

**Every step that touches the server is a production gate** (the working agreement): three lines to the owner first (what I am about to do, what happens if it goes wrong, how to get back), then check, back up, approve, execute, verify, and no sudo without his yes. A session never touches the server from a laptop session that was not told to; the builder prepares the files and the runbook, and the owner approves each execution. One approval covers one action.

Eight pull requests, in this order, each off `origin/develop` once the one before it has merged (the gates are listed under h):

a) **The server package and the protocol** (`feat/server-core`). A new pnpm package `server/` (Node, TypeScript, the same toolchain) that imports the kernel and the bundle and exposes: `POST /action` (one action, the player's tile, the client tick), `POST /moves` (a batch of `move` reports), `GET /state`, `POST /session` (resume), and what the later entries added (`GET /health`, the `/auth/*` routes). The rules of the wire:
   - The world's hour is the server's clock (DECISIONS 2026-10-20, "The world's hour is the server's clock"): `world.epoch`, one origin per world with tick 0 a noon; the server sets `state.tick` at every accepted action; a return after an absence is one kernel action `resume`; a player leaves after `logout_countdown_s` outside a safe place.
   - Every action except `move` waits for the server's reply, which carries a merge patch of the state and the events of the step. The seed is secret on the server, so the client cannot predict a drawn action (kernel-review R4); an optimistic client would guess wrong. `move` reports are batched and shown at once, and the server checks them as G56 describes (the BFS with `move_reach_max`, moved into the kernel by this item with its test). A movement-time credit is kept with the player: four-way path length spends it, elapsed game time refills it, and `move_reach_max` caps it (DECISIONS 2026-10-20, the wire as built).
   - Room for combat. G35 is the demo's rule and combat is a core part after this stage (DECISIONS 2026-10-19), so the wire must not rule it out: a real-time encounter cannot wait for a reply per blow. The proposal, which the owner has not yet seen: an encounter plays on the client at a fixed tick inside the kernel (pure, integer) and reaches the server as one batch, which the server replays and checks the way it checks `move` reports, with caps from `params.json` on what one encounter can pay. So `POST /moves` takes a batch of client-played steps with a `kind` field, `move` the only kind this item accepts; adding a kind later adds no endpoint and changes no rule above.
   - The time proof (kernel-review S1): the server keeps the wall-clock instant of the current state tick and refuses an action whose claimed tick advance is more than the gap since that instant plus 2 s of slack, and only accepted game time moves the instant, so a run of requests cannot claim the slack again (DECISIONS 2026-10-20, the wire as built). A refusal changes nothing and says why in plain words.
   - A dropped line pauses the game at once (the owner, Q5): the client shows one box, "Waiting for the connection", takes no input, and resumes with `GET /state` and a replay of nothing; the server never runs a tick the player did not ask for. No offline play in an account.
   - The kernel stays pure and integer-only; nothing in `kernel/` learns about HTTP or time.
   - Tests: a table of forged requests (a tile far from the last, an action from a future tick, a repeated action, a stale state version), each refused with no state change; `pnpm verify` green.
b) **The database** (`feat/server-db`). Migrations for: accounts (id, email, name, age check passed, country, created), sign-in identities (provider, subject), the player's state (the serialized kernel state, the seed, the kernel and content versions, the clock anchor and the unspent movement-time credit, one row per player), an append-only action log (the audit and the verified-board source), a gold ledger (every grant with its action and tick), boards. Integers only for money, a version column on the state row, and an optimistic lock on write. CI runs the migrations against a postgres service container; no production database exists yet.
c) **The client over the wire** (`feat/client-remote`). A `RemoteSession` with the same surface as `Session` (`game/src/session.ts`) beside it: the classic client and the 3D door call one interface, and the local `Session` stays for the demo and for tests. The device keeps settings only (sound, language, zoom, the demo-since stamp `openfold.demo-since`, kept outside any save as CR-85 decided); met/heard, the last position (the logout spot) and the bag all live on the server (the owner, Q3). Tests: a fake server in `game/test` answers actions; a 30-minute scripted run gives the same state through `RemoteSession` as through `Session`.
d) **From the demo to an account: the opening handover** (`feat/handover-opening`). The owner's Q4, option A: the phone plays the opening under its own seed, as today. At sign-up it uploads the full opening log, the server replays it under that seed, checks that every action was legal, that the wake-to-threshold timing is plausible, and that the opening's pay stayed under its fixed caps, and then keeps the replayed state and switches to a server-secret seed. A forged opening gains the fixed opening pay and nothing else. The session today keeps a 40-action tail (decision 2026-10-07); this item makes it keep the whole opening log until the account exists, capped at 2000 actions. If the replay does not match the phone's state, the player starts fresh after sign-up (option B, the owner's fallback), and the box says so in one line. Nothing else carries from the demo but the title and the look item (DECISIONS 9.10). Tests: a captured opening of each starter replays to the same state; a log with one illegal action is refused whole; a log with a tampered coin count falls back to a fresh start.
e) **Sign-in** (`feat/signin`). Email, Google and Discord (the owner, Q2). Email by a link, with the sender decided at the gate under h (test mails go only to the owner's test address, kept outside the repo). Google and Discord by OAuth; the builder creates the two OAuth apps in the browser at build time and asks the owner only where his own login is needed, each step approved. An account is made after the opening, for a player of 13 or the country's higher age of digital consent (CR-49; a younger player is pointed to the demo), and asks for an email and a name, nothing else (DECISIONS 9.10). One person, one account in a world (CR-53): the sign-up says it. A session cookie that is httpOnly, secure and same-site; secrets kept outside the repo and in the container's environment, never in git. Closing an account hides it at once (its sessions end, it cannot be found by name) and marks it with the time; signing in within 30 days brings it back, and after 30 days a daily job erases the personal details (email, name, identities, the game state) while the gold ledger and the action log keep their rows under the account number (migration 0004, the owner's answer of 23.10 in #305). Sign-up keeps only that the age check passed, and the country.
f) **Luck and the ledger on the server** (`feat/server-luck`). The draws `draw(seed, entity, counter)` already run from the state's seed; with the seed secret they are the server's luck. The gold ledger records every grant. A test replays any account's action log from its start state and must land on the stored state byte for byte (`serialize`).
g) **The simulated player in CI and the verified boards** (`feat/server-sim`). A script plays a starter's whole opening, the first expedition and the first sale through the real server in CI (against the service container), and the run must reach the same state as `replay` on the laptop. The boards read only the verified log: a score that did not replay is not posted.
h) **Provisioning and cutover** (docs plus the owner's gates; the builder prepares everything and executes nothing alone). `deploy/RUNBOOK.md` is the runbook, with a gate per step; each is three lines to the owner first:
   1. Read-only inventory of the box (containers, ports, nginx sites, disk, RAM) written into the runbook.
   2. A new nginx site file for the game's name only, `nginx -t` first, reload only after the test; the other product's sites are not edited. The hostname and its DNS record are the owner's to choose and add. The same file serves the game's build as files at the root of that name and proxies the API's paths, so the game and its API are one origin (DECISIONS 2026-10-27, "One origin"); the site's `/play/` stays the demo.
   3. The two containers with their caps and their own database user; the database is not reachable from outside the box.
   4. The nightly backup off the box with a restore test run once on a scratch database.
   5. The OAuth apps' redirect addresses and the mail sender.
   6. The cutover: the build on the box names its own origin (`VITE_GAME_SERVER` set and empty), so the flag is the site's door pointing at the name, tried by the owner on the preview first.

- Before every proving run (AGENTS.md): grep the tests for every string the change renamed, fix them in one pass, then the single test file, then `pnpm verify`, and push: CI runs the opening e2e. A local e2e only to debug a red run, one heavy job at a time on a shared machine.
- Measurable at the end:
  - Replaying any account's action log from its start state reproduces the stored state byte for byte, for the three starters' scripted runs.
  - Every forged request in a's table is refused and leaves the state row unchanged.
  - A forged tick advance of 1 hour in 1 second is refused (the time proof).
  - The restore test of h4 brings a scratch database back and `GET /state` for a test account matches the pre-backup state.
  - A memory cap shows in `docker stats` for both game containers and the other product's containers are untouched (their image ids and uptimes unchanged).
  - With the wire cut for 10 s the client takes no input and, once back, the state equals the server's.
  - The sign-up asks for a name, a full date of birth and the one-account agreement, and refuses a player under 13 or under the country's higher age (DECISIONS 2026-10-21, the age-gate entry).
- For the owner: the wording of the sign-up and the pause box; whether the pause on a dropped line feels too sharp on a real phone; and the three-line gates, which he answers one by one.

## 19. The first map by hand, and a generator that sets the difficulty

Status: open

Stage 3 of the order, the second stream, beside section 18; it does not wait for accounts, and it is not built before stages 1 and 2 close and section 15 (the 64 px engine step) is merged. Read first: DECISIONS 2026-10-23 "The world: a hand-made first map, and a generator that sets the difficulty" (the owner's answer that rewrote this section), 2026-10-22 "The first map is composed by hand (decision 5 of 22.10)", 2026-10-17 "The world has no end" and "Beyond the mist", 2026-10-18 "Height: levels with rock faces (T2)", "The art moves to 64 px per tile", "The ground by motif scatter", and "Height crossings and winding paths", "The valley and the one-time G59 exception", "The first ring's three stills"; `docs/design/OPEN_WORLD.md` (a parts bin: G50 to G67 and D1 to D5 are drafts); `docs/design/STYLE.md` sections 6 and 8; `GAME_RULES.md` (G56 is in the draft; G68 and G69 are new, in "The open world"); `docs/design/STORY.md` (S1 to S6); the stills `docs/design/frames/2026-10-18-ring-*` and their note. The stream is `open-world` in `streams.json`.

What changed on 23.10, in the owner's words: the 17.10 seed rings and decision 5's hand-made first map are combined. **The first map is planned and drawn by hand**, as decision 5 says. **The generator's job becomes difficulty.** From a place's distance to the game's start and the level the character is expected to have there (from the quests before it and the grinding open to it), it recommends the place's difficulty: how many quests and of what kind, which monsters, how many and how strong, and what else opens there. The same reckoning later grows the world past the first map's edges. So this section no longer builds a ground generator, a seeded chunk maker or a seed sweep: the ground, heights, props and places of the first map are authored data, and the code that is new is the difficulty reckoning and its checks.

Two names that must not be confused. A **world chunk** is 64 by 64 tiles, the unit the map is stored and streamed in. A **bake page** is 16 by 16 tiles, the unit the engine bakes its ground into (section 15). A chunk holds 16 pages; "chunk" alone means the world chunk.

The decisions this section builds on, all the owner's:
- The first map is about 3 by 3 chunks, 192 by 192 tiles, with the valley in the middle (17.10). Its size is a plan on paper first (item 0), not a number to hit.
- The first map is composed by hand: a plan on paper (regions, landmarks, paths, heights, climate), then 2 or 3 phone-size direction stills for the owner's pick, then the library is produced to the plan. No random scatter on a flat ground (22.10).
- The stills of 18.10 (the manager chose them on the owner's "everything looks good"): S1 big sweeps of ground (A); S2 levels with rock faces, a valley framed by mountains and a pass (B); S3 dense props with the boathouse's smoke on the skyline (B). They are the look the hand-drawn map aims at. One correction from the owner: the straight path is too boring (G69).
- The first stamped place is a lakeside boathouse with a keeper and one small errand (Q6, A).
- Creators change ground by pull request in the first map's regions and the ones after it (Q7, A).
- A rock face blocks both ways; the crossings vary by place (Q8, G68).
- The valley (48 by 49) is too small. It must feel like a valley framed by mountains in parts, with passes out; after the first bridge the player must feel the world is huge; the starters' areas must be really apart. A one-time, pointed exception to G59 lets the core team reshape the valley and improve the opening when the first map is built; creators never touch the opening (DECISIONS and GAME_RULES section 6).
- Danger rises with distance from town (G64) and not through doors; the difficulty reckoning is how that rule gets numbers.
- The pixel game comes first; everything here holds in the 3D door too, which may be desktop-only. The 3D door reads the same height and chunk data.

Ten items, in this order (the branch names are the ones `streams.json` lists, so `ring-gen` now holds the difficulty reckoning), each off `origin/develop` once the one before it has merged. A change to a shared file (the schema, `NEXT.md`, `streams.json`, `GAME_RULES.md`) lands as its own small pull request first.

0. **The map plan and the valley's new frame, to the owner** (no code). Before any change to the map: the builder sends the owner the plan on paper (regions, landmarks, paths, heights, climate, where the three starters' areas sit and where the boathouse's lake is) and then two or three stills or one map at phone size, each testing one named difference (how large the valley floor is, how many passes, how far the starters' areas sit apart). The pick is recorded in DECISIONS with its frame. The proposal to test: the valley floor about 96 by 96 inside the middle chunk's mountain frame, three passes (one east, one north, one south-west), and the starters' areas at least twice today's distance apart as `tools/src/starts.ts` measures it. These are proposals, not decisions.
a) **The schema** (`feat/ring-schema`, shared file first). The height layer as digits 0 to 9 beside the ground layer (STYLE section 6), a chunk file format (a 64 by 64 block with its coordinates, its grounds, its heights, its props and its stamps), and a `stamp` that places a hand-made place (the boathouse, later a creator's) into a chunk. Additive; the format stays 1; `pnpm schemas` regenerates `schema/json`.
b) **The difficulty reckoning** (`feat/ring-gen`, in `tools/`, pure, integer-only; it recommends and never places). Inputs: a place's distance to the game's start (walking steps from the wake tile by the BFS of G56, not straight-line distance) and the level the character is expected to have there. The expected level comes from the quests that come before the place (the experience they pay, from `content/`) and the grinding open to the character on the way (what the nearer places let it kill and gather, up to the level cap); it is computed, not typed in. Output, per place: the recommended number and kind of quests, the monsters (which kinds, how many, how strong), and what else opens there (a station, a tool gate, a shop, a shortcut). The tuning numbers live in `params.json` and the content, never in code (AGENTS.md). Two honest limits: the reckoning is a recommendation a designer reads and the owner can overrule place by place, and combat is not built yet (DECISIONS 2026-10-14 on its order), so "how strong" is a tier name and a number until combat fixes what strength means. The tool prints a table (`pnpm map:difficulty`, a name to settle in the pull request) and writes nothing into the map.
c) **The rules in the kernel** (`feat/ring-walk`). The height layer enters the walk: a move is refused between tiles whose levels differ, except across a tile flagged as a crossing (stairs, a ramp, a lift, a cable car, a tool-gated way; G68). The check is one function, shared with the BFS of G56 so that reach and walking cannot disagree. The kernel version rises (KERNEL_VERSION 0.10.0 today) and a save of the old kind is adapted by relocating the player to the nearest walkable tile of the same place, never a fall (the same adapt path as DECISIONS 2026-10-07). A new action kind is not needed: `move` carries it.
d) **Chunk streaming in the client** (`feat/ring-stream`). The classic client loads the 3 by 3 chunks around the player, drops those beyond one ring away, and bakes by 16-tile pages (section 15). The stream never holds more than 9 chunks in memory; a chunk loads in under 1 frame of blocking work per page (idle-sliced), and the mist of "Beyond the mist" hides the seam. The 3D door reads the same files.
e) **The first map drawn, the valley reshaped** (`feat/ring-valley`; the one-time G59 exception, only after 0 is picked and only the core team). The map is produced by hand to the plan and the frame chosen in 0: mountains in parts, passes out, the starters' areas apart, the wake tiles and the opening's legs moved as the frame needs. Each place's quests, monsters and unlocks are set against the table of b, and where the author departs from the recommendation the pull request says why. The exception does not cover the rung payoffs, the ladder minutes or the 90 s ceiling, and the opening's pay stays what it is (GAME_RULES section 6). The world lock is re-anchored at the end with the owner's yes (OPEN_WORLD G59's command). Saves are relocated by placement.
f) **The boathouse** (`feat/ring-boathouse`). The first stamped place, on a lake in the map: a boathouse with a chimney whose smoke shows on the skyline (S3), a keeper (one NPC, with a voice and a want by the rules of G12 and STORY.md; a line about the past needs a speaker, S1 to S6) and one small errand that is not a fetch (G1, G17), paying what the ladder allows and no more. The keeper's errand uses a crossing of G68 (a ramp or a boat lift) so the first crossing is shown, not told.
g) **The checks** (`feat/ring-checks`, in `tools/`; each prints an error (`x`) line and fails `pnpm check`):
   - every place and every stamp is reachable on foot from the wake tiles within the pay-gap proxy of G62 (`floor(90000/(2*190)) + 5 = 241` steps for the first gap, read from `params.json`, not hard-coded);
   - no crossing is a tool gate that wears out and strands a player (dec 1094);
   - no straight run of a path is over 8 tiles (G69), authored;
   - the pillar-1 check from each starter's wake tile: the first rung's target is reachable and the first danger is not in the way;
   - the opening legs measured by `starts.ts` are as the re-anchored lock says;
   - the difficulty of each authored place stays within a band of what b recommends for its distance and expected level, and a place outside the band prints the place, the recommendation and the authored value (the band is a number in `params.json`, set with the owner).
h) **Creators and the map** (`feat/ring-creators`). The creator guide (`docs/creators/README.md`) gains the ground: how a creator edits a chunk file or adds a stamp by pull request in the first map's regions and later ones, under their handle prefix, and how to read the difficulty table for the place they add; the creators board and the guide are regenerated, never edited by hand; the opening stays out of reach (a check refuses a creator's change inside the valley's reserved area). One worked example in `docs/creators/`.
i) **The look pass** (`feat/ring-look`, polish inside the agreed direction, no asking): the ground waves of section 15 on the new grounds, the rock faces' lips and foot lines (STYLE section 6), the smoke, and the path rule applied to the authored paths.

Past the first map's edges (not built here): the same reckoning grows the world, with ground generated from the world seed around the hand-made map as the 17.10 entries say, each new place's difficulty recommended from its distance and the expected level. That is a later section, written when the first map is closed and the table of b has been checked against a playtest; the 17.10 decisions on generated ground, the world seed and the community growing the world stay in force for it.

- Before every proving run (AGENTS.md): grep the tests for every string the change renamed, fix them in one pass, then the single test file, then `pnpm check`, then `pnpm verify`, and push: CI runs the opening e2e. A local e2e only to debug a red run, one heavy job at a time on a shared machine.
- Measurable at the end:
  - The difficulty table is reproducible: the same content and params give the same table on two machines, and every number in it traces to `params.json` or the content.
  - Each authored place is inside the band of its recommendation, or its pull request says why not and the owner has seen it.
  - From the wake tile the walk to the first bridge takes the steps the re-anchored lock says; from the first bridge the view shows no tile of the other two starters' areas, and the nearest of them is at least twice today's distance (as `starts.ts` measures it).
  - Every tile pair with different levels and no crossing between them is refused by `step`, in both directions; each crossing kind in the map has a passing test.
  - No path in the map has a straight run over 8 tiles, except at most one run in five of up to 12 tiles on a bridge or a causeway (G69); the checker prints each offender.
  - The boathouse is reachable, its errand completes in the timed run of each starter, and the chimney's smoke is on screen when the lake enters the frame.
  - Streaming: with a scripted walk across the whole map, no more than 9 chunks are loaded at any frame and no frame blocks over 50 ms on the phone profile.
  - `pnpm verify` and the opening e2e green; the opening's rung payoffs, ladder minutes and 90 s ceiling unchanged.
- For the owner on a real phone: the feel of the valley's frame and of the first view of the world's size; whether the passes read as ways out; the sweeps' size and the props' density; the path's winding; and whether the recommended difficulty of each place feels right when played, which only a playtest can say.

## 20. Polish after v0.1.6: a success without a jolt, the wolf gone by day, the e2e screenshots

Status: built (#200)

The owner, 18.10, approved all three (DECISIONS 2026-10-18 "A success never shakes the screen" and "By day the wolf is away and its den stays"). One pull request, branch `fix/success-and-wolf-day` off `origin/develop`. The pixel game first; the 3D twin goes in the same pull request only where it is a line or two, otherwise as a note for NEXT 8 e.

a) A success without a jolt. Today `celebrate()` in `game/src/scenes/world.ts` shakes the camera on every `restore` and `build`, and the level banner pops (`@keyframes banner` in `game/src/style.css`). The jolt and the red flash now belong to danger only: `hurt` keeps its flash and shake, `seen` keeps its jolt (off under reduced motion, as today). A tree landing is an impact, not a success, and keeps its small shake. On a success the camera does not move and nothing flashes the whole screen; the jingle stays, the dust and sparks may stay, and the made thing gets a soft light on its slot for at most 1 s.
- Measurable: (1) after a quest done, a restore, a build or a level, the camera's shake effect is not running and its scroll is unchanged for the next 1000 ms; (2) `cameras.main.flash` is called only on `hurt`; (3) the jingle plays and the light on the made thing lasts at most 1000 ms; (4) `hurt` and `seen` still jolt. Feel stays for the owner on the preview.

b) By day the wolf is away and its den stays (G30 as changed on 18.10). Between dawn (05:00) and the dusk ramp no wolf is drawn: no sprite, no eyes. Its den is drawn instead: a dark den mouth on the first tile of its round, where it slept, and paw prints along the round, so a player still learns by day where it hunts. At dusk it comes out of the den, on the den tile, and walks its round as today. Both wolves (the bank wolf and the ruins wolf). The kernel does not change: by day its place stays the den tile, and every state test of the hunts stays as it is. In `/play3d/` hide the wolf model by day (#177 shows it asleep); a den there is a note unless it is one simple shape.
- Measurable: (1) in a 390x844 capture of the west meadow at 12:00 no wolf pixel is drawn, and at 21:00 the eyes show as today; (2) by day the den mouth and the prints are visible on the round's tiles; (3) at dusk the wolf first appears on the den tile, not mid-round; (4) the hunt's state tests pass unchanged. The look of the den and the prints is polish inside the agreed pixel style: iterate, do not ask.

c) The e2e screenshots. `pnpm e2e e2e-shots` passes the folder only to `play3d.ts`; hud, opening, stealth and tending write theirs to `.scratch/e2e`, so CI uploads nothing when one of them fails (run 39147952528, "No files were found"). Pass the folder to all of them.

- Before the proving run (AGENTS.md): grep the tests for every changed line, fix all expectations in one pass, then the single test files, then `pnpm verify` (one heavy job at a time on a shared machine), then push: CI proves the e2e. Post "PR ready #N" with the four PASS/FAIL lines of a) and of b).

## 21. A fire anywhere outside the town, and the long night out in the wild

Status: built (#211, #227)

The owner, 19.10 (DECISIONS 2026-10-19, the entry on a fire anywhere; GAME_RULES G30 as changed that day; SETTLEMENT 3.4; GRUNT CR-102 and CR-25). Read section 13 (the fire kept by hand), G31, G34, G47 and G48 first. Two pull requests, both off `origin/develop`: (a), and (b) only once (a) is in `develop`, never stacked on it. The pixel game first; the 3D twin as a note for NEXT 8 e unless it is a line or two.

a) The kernel, branch `feat/fire-anywhere-kernel`:
- A fire of one's own. A new action, `{t:'kindle', fire: Tile, at}`, builds it on a free walkable tile next to the player, from `core/campfire`'s inputs (2 logs) and its `active_ms`. It is refused, the logs kept, on a town tile, inside any slot, on water or a solid prop, while `player.chase` is set ("Not with the wolf at your heels." or the like), and when any tile of the fire's safe area lies in a predator round's watch. Move `watchOf` from `tools/src/hazards.ts` into `kernel/src/danger.ts` so the kernel and the check share one watch. One fire of one's own stands at a time: kindling another puts the old one out and removes it. State: `player.own: {at, lit, until, kept?, log} | null` (restore defaults `null`), lit by the kindling itself with one log's burn, then fed as section 13's fires are (`feed` takes `fire: 'own'`).
- Safe while it burns: `isSafe` adds the tiles within `fire.safe_tiles` (new param, 1: the fire's tile and the ring around it) of a burning own fire, so no hazard acts there and a chase ends there, as at the camp.
- Wood by danger, never shown: a log in an own fire lasts `fire.log_ms * 100 / (100 + fire.burn_pct_per_d * d)` (new param, proposal 50: half again as fast per danger step), integer, fixed into `log` at kindling so `until` and `nextLogAt` stay single numbers. Areas carry no `d` yet (CR-38): read it from one function, `dangerAt(bundle, at)`, which returns 1 everywhere outside the town and the safe slots until CR-38 fills it from the map. The hearth and the other map fires keep `log_ms`.
- The long night: a `tend` step may name `fire: 'own'`, met by the player's own fire under `tendHolds`' rule (lit by that dusk, no gap to dawn, met at dawn), and only while it stands outside the town.
- Tests (`kernel/test/fire-own.test.ts`): kindled outside the town it is safe while it burns and not after; refused in the town, in a slot, during a chase and inside a round's watch, with the logs kept; a second fire puts out the first; at `d` 1 a log lasts `log_ms * 100 / 150`; a `tend` own step holds at dawn and fails on a gap; a replay agrees. `KERNEL_VERSION` minor up.

b) The client and the content, branch `feat/fire-anywhere`, after (a) is in `develop`:
- Client: a "Build a fire" button while the player holds 2 logs outside the town (where Build sits), the refusals as toasts in the world's voice; the fire drawn on its tile with its flame in four stages by the wood left (full, steady, low, embers), so the player sees it dim; the warning before it goes out as section 13's; its light is the safe ring. No number of logs, minutes or `d` on screen.
- Content: `core/the-long-night` takes `fire: 'own'`; Maru's offer, waiting and done lines send the player out past the last house to a place of their choosing, inside G14 and STORY.md (Maru may speak of his own hearth; the narrator states no past). The hearth beside his house stays as a fire anyone may feed, and no quest names it.
- E2E (`game/e2e/tending.ts`): take the long night from Maru, walk out of the town, build a fire, feed it through the night with the clock moved, see the warning once, see the step met at dawn and hand it in; building inside the bank wolf's round and during a chase is refused; a second pass lets the fire go out and the step stays unmet.
- Measurable: (1) at 390x844 a fire built six tiles or more outside the town draws, and at 21:00 a chase that reaches its ring ends there; (2) a build inside a round's watch or during a chase is refused and no log leaves the bag; (3) a capture at each of the four flame stages shows no digit about the fire; (4) the long night is met at dawn by a fire of one's own and not by the hearth; `pnpm verify` and `pnpm e2e` green. The look of the flame stages is polish inside the agreed pixel style: iterate, do not ask.
- Before the proving run (AGENTS.md): grep the tests for every changed line ("the hearth", Maru's long-night lines), fix all expectations in one pass, then the single test files, then `pnpm verify` (one heavy job at a time on a shared machine), then push. Post "PR ready #N" with the PASS/FAIL lines.

## 22. Free movement: the body walks freely, the world and the kernel stay on tiles

Status: built - develop, commit b1fe4f8b (pull request 280, merged 24.10)

The owner, 18.10 (DECISIONS 2026-10-18, the entry on free movement) and 21.10: "free movement now, but graphics come first for me". So this stream starts now, and it takes no builder, review or machine time from the art and light streams (the ladder and #240, the cast shadow pass #256, the 64 px waves): when both want the machine, the art's job runs first. Read DECISIONS 2026-10-07 "Grid movement", the 18.10 entry, [GAP_DIMRAETH_DRAKANTOS.md](../design/GAP_DIMRAETH_DRAKANTOS.md) section 5, G47 and G56 first.

What there is today:
- `game/src/input.ts`: four held directions; `game/src/ui/touch.ts`: the pad picks one of four sectors, with a dead zone of 12% of its width.
- `game/src/scenes/world.ts` `tryStep`: one tile per `walk_step_ms` (190), `facing`, `strideFrame` by step count, and `landStep` reports the tile. `game/src/play3d/world3d.ts` walks by the same rules.
- `game/src/walking.ts`: `canEnter` (the kernel's walkable, and a ready plant or stone stands in the way), `landStep`, `StandingReports`.
- The kernel: `{t:'move', at}` is valid within Chebyshev `2 + floor(elapsed / walk_step_ms)` of the last tile; `validateTravel` (G56) asks four-way reachability inside that square.
- The server (`server/src/api.ts` `nextMovementCredit`): a report costs its four-way `walkDistance` times `walk_step_ms`, from a pool of `move_reach_max` (32) steps that refills with time. `RemoteSession` (`game/src/remote.ts`) batches the reports with `kind: 'move'`; #254 is open on it.
- The e2e (`game/e2e/opening.ts`, `stealth.ts`, `tending.ts`) walk by held arrow keys or the pad, counted in tiles.

One pull request, branch `feat/free-walk`, off `origin/develop`. The pixel game first; the walk's rules move into `walking.ts`, so the 3D door takes them in the same pull request if that is a few lines, and otherwise as a note under section 8 e.

a) The walk:
- The body's position is in art pixels (a float, in the client only). Its velocity comes from the held input: eight directions on the keyboard (two arrows at once), normalised so a diagonal is as fast as a straight line. Speed: one tile per `walk_step_ms`, as today. No acceleration yet; the feel is polish.
- Collision: a small body box at the feet (proposal 28 x 16 art px, a param) against the tiles `canEnter` refuses. Resolve x and y apart, so the body slides along a wall. No corner cut between two refused tiles.
- Tiles: the tile under the feet's centre is `s.pos`, and `landStep` reports it when it changes. When the centre crosses a corner in one frame, report first the side tile the box crossed, so the reports stay four-connected (G56).
- Facing: the dominant axis of the motion, with a little hysteresis so a walk near 45 degrees does not flicker; drawn with today's three directions and the mirror. The faced tile is the one beside the feet's tile in that direction, and every action that reads `pos + DIRS[facing]` today reads it.
- The stride: today's walk frames, advanced by the distance walked (one stride per tile), not by the step count. No new art: a diagonal walk shows its dominant facing, as Stardew Valley does. New poses wait for the owner's pick of Pell A, B or C (wave b).
- Standing still, for `StandingReports`, is a frame with no motion.

b) The phone: the pad becomes a stick. The direction is the finger's offset from the centre at any angle, the dead zone stays 12% of the width, and full speed comes at 40%. A and B do not change, and neither do the keys.

c) The server's move check. A diagonal walk at full speed covers about 1.41 four-way tiles per `walk_step_ms`, so today's charge (the four-way distance) drains the pool and refuses an honest diagonal walk after about 15 s (32 / 0.41 steps). Proposal: the charge becomes the path's octile length (a diagonal pair of steps costs 1.414, integer as 1414 per 1000), in one kernel function that the server reads; the reachability stays four-way (G56). It is a rule's number: G56's line and a DECISIONS entry change with it, and `KERNEL_VERSION` takes the next minor.

d) The e2e: a `walkTo(tile)` helper in `game/e2e` that holds the input until the feet's centre is on the tile, with a timeout, in place of counted presses; every e2e that walks moves to it, and a phone run drives the stick.

e) Records: a DECISIONS entry as built (the 2026-10-07 entry's first half is already marked superseded), and G56 if its number changes.

Measurable:
1. Holding right for 1.9 s moves the feet 10 tiles (within 0.3); holding right and down for 1.9 s moves them 10 tiles in a straight line (7.07 on each axis, within 0.3).
2. On release the body stops in the same frame. Over 200 frames of walking into a wall at every angle, the body box never overlaps a refused tile.
3. Every tile report is four-connected to the one before. A 20 s diagonal walk at full speed passes the server's check (a server test), and a jump of 3 tiles in one frame is still refused.
4. After a diagonal walk an action hits the tile in front of the feet in the facing direction (a test for pick, dig and talk); `pnpm verify` green, and the opening, stealth and tending e2e green in CI.

The feel (speed, acceleration, the stick's dead zone and size) is for the owner on a preview: deploy one and open it in his browser, then iterate on his word without asking again about the numbers inside it.

Before the proving run (AGENTS.md): grep the tests for every counted walk and every `DIRS[` use, fix all expectations in one pass, then the single test files, then `pnpm verify` (one heavy job at a time on a shared machine), then push. If #254 lands first, merge `develop` in, never rebase. Post "PR ready #N" with the PASS/FAIL lines on the pull request. Model: opus, effort high (the walk in two doors, the server's check and every e2e).

## camera-closer. The camera comes closer: the owner's picked view in the real client

Status: open

Read DECISIONS 2026-10-25 "The camera comes closer; the character is the measure; tall props grow to the table" first. The owner picked the closer camera on 25.10. Today `cameraZoom` (`game/src/view.ts`) gives the world zoom 4k with k whole from the short side: 8 on a 390x844 phone at 3x, 4 on a 1440x900 desktop at 1x. The picked view is the whole zoom step at or above 1.5 times that, `4 * ceil(1.5 * base / 4)`: 12 on that phone (6 x 13 tiles in view instead of 9 x 20), 8 on that desktop. The cut-out demo (#336, never merged) shows it.

a) The world's zoom is the picked step everywhere the base zoom is used today; the hold on the stone keeps its own zoom, and a resize recomputes both.
b) `game/e2e/camera.ts` (zoom 8 at a 3x phone today) expects the new step; every e2e that counts tiles in the window, or walks by screen distance, is checked against it.
c) The HUD, the dialogue box, the quest tracker and the touch controls still leave the player and the tile in front of the feet in view at 390x844.
d) Records: the DECISIONS entry marked built.

Measurable:
1. At 390x844 on a 3x screen the world zoom is 12, at 1440x900 on a 1x screen 8, and every art pixel covers a whole number of device pixels (density 1 and 4).
2. The camera e2e and the opening e2e are green in CI on a phone and a desktop screen; `pnpm verify` exit 0 in the pull request body.
3. Phone and desktop stills of the opening's first frame in the pull request, the character at 1x.

Not here: the size of the character (it stays at 1x, each body at its rig height ratio) and the props (`tall-props-to-table`).

## tall-props-to-table. The tall props at the STYLE 1b table's sizes

Status: open

Read DECISIONS 2026-10-25 "The camera comes closer; the character is the measure; tall props grow to the table" and `docs/art/PRE_RICH_REDRAW.md` (#328) first. The character is the measure at 1x (1.5 tiles), and the tall props grow to STYLE.md section 1b's table, approved by the owner on the grown-props still. Today they stand at the 16 px grid's sizes: the oak 2 tiles (the table 5), the young tree 1.44 (3), the dead tree 2 (4), the lantern post 2 (3), the standing stone 1.81 (2.25 to 3), the small house 3 with a door of 0.875 (5, a door of 1.75), the market stall 2 (3), the canopies 2 x 2 (3 x 3), the ruin arch, wall, pillar, statues and totem 1.4 to 2.

a) Every one of them is on the pre-rich redraw list (#328): rows 7 (the canopies), 11 (the trees), 14 (the standing stone), 22 (the house, the well, the stall, the lantern post) and 28 (the ruin set and the statues). The real fix is that redraw, at the table's sizes, in the rich style at 64 px a tile, in the list's order; where a row is a direction (a tree, the forest mass), its stills go to the owner first, as the list says.
b) A nearest-neighbour upscale of the 16 px art is only a stopgap: it reads blocky beside the rich sprites. If one ships before the redraw, it is named a stopgap in DECISIONS and each kind is replaced by its redraw.
c) STYLE 1b's rules hold: the map does not move (a bigger drawing grows upward and over its neighbours, never into a new solid tile), a thing that draws over the player shows the player through it, and nothing a task names is hidden.
d) Records: STYLE 1b's header says the tall props' numbers were seen by the owner (25.10), and the DECISIONS entry is marked built per kind.

Measurable:
1. Per kind, the opaque height in tiles against the character (1.5 tiles) is in the pull request and inside its STYLE 1b row.
2. Phone stills at the closer camera of the opening's wake window and the bridge, with no wake tile, pickup or task prop covered over more than half its area (STYLE 1b's wave measure).
3. `pnpm check` (the kit's density and size check) and `pnpm verify` exit 0.
