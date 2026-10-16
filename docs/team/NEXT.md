# What is next - one section per stream

Written 2026-10-11 when the first round of sessions closed. Each section is the full spec for one fresh session; it does not point at a conversation. A session reads its own section, `AGENTS.md`, and the `DECISIONS.md` entries it names, and nothing else up front.

## Rules for every stream

- Branch off `origin/develop`, worktree under `<repo>.worktrees/<branch-with-dashes>`, one pull request into `develop` per item. Never stack on another branch.
- No integration session runs now. Each session lands its own pull request: squash merge into `develop` after local proof, and the owner approves the merge at the permission prompt. Nothing goes to `main`; a release is the owner's call.
- GitHub Actions is out of minutes until the monthly reset (November 1). Red CI that never started is expected; the proof is local and is written in the pull request body: `pnpm verify` exit 0, plus `pnpm e2e` exit 0 when `game/` changed.
- One e2e on the machine at a time: `flock /tmp/game-e2e.lock pnpm e2e > <file> 2>&1`. Two at once starve the machine and time out.
- Saving tokens:
  - Long output (verify, e2e, logs, `gh run view`) goes to a file, and only the tail or the failure lines are shown.
  - Read files by range or by grep.
  - Run the single test file first, `pnpm verify` once before the push, and e2e last, only before ready.
  - Codex is the default worker and the session is the escalation (owner, 11.10; skill `gpt-consult`). A task goes to Codex unless it needs judgment, needs context only the session holds, or has no command that proves it: `codex exec --sandbox workspace-write -c sandbox_workspace_write.network_access=true "<goal> <files> <proof command>"` in the worktree, the session leaves those files alone meanwhile and re-runs the proof itself. Typical: test-expectation sweeps, tests from a spec, regenerating, e2e expectation updates, rebases onto `develop`.
  - Before ready, a bug-only review of the diff from Codex (`codex exec --sandbox read-only --skip-git-repo-check "..." < /dev/null`) and Gemini (`ask-agy`; an empty answer is a blocked tool, not a reply), each claim checked against the build. Web lookups go to `ask-agy`.
  - The pull request body names what went to Codex or Gemini and how many corrections it needed.
  - Keep `STATE.md` in the session scratchpad, updated at each step.
- Generated files (`schema/json`, `content/values.lock.json`, `CREDITS.md`, `content/board.json`) are taken from `develop` and regenerated (`pnpm schemas`, `pnpm values`, `pnpm credits`, `pnpm board`), never merged by hand. GitHub ignores the union merge of `DECISIONS.md`: resolve it locally and keep both sides.
- Toolchain: node 24 from nvm on the PATH, then `pnpm install --frozen-lockfile` in each new worktree.
- Houses and plots are paused (DECISIONS 2026-10-10): build nothing toward them. A direction (art style, camera, look of a character, UI frame) goes to the owner as two or three phone-size stills first; a detail inside an agreed direction is polish.
- At the end: the pull request is landed or handed back with its state, `STATE.md` is turned into a short note under the stream here if work is left, and the session stops.

## 1. Health on the client and in the content (P-5b, P-5c)

P-5a, the kernel slice, is in `develop` (aee8491). Read DECISIONS 2026-10-08 "The valley has a dangerous hour" and `docs/design/GAME_RULES.md` G30-G35 first.

What the kernel gives:
- The action `{t:'move', at:[x,y]}` reports a position. It is valid if the tile is walkable and within Chebyshev `2 + floor(elapsed / walk_step_ms)` of the last one. It is accepted while busy and needs a character.
- Player fields: `town`, `outing {gained, solved, visited} | null`, `chase {hazard, since, bites} | null`, `falls`, `movedAt`. `Session.restore` defaults them.
- Health is still `player.satiety` (milli-points).
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
7. Rename `satiety` to `hp` last, in its own commit, after crafting has landed.

Known wart, in DECISIONS: a quest that completed by itself during an outing keeps its reward after a fall. Mist hazards wait for P-6.

Left after P-5c (11.10): item 7, the rename of `satiety` to `hp`, waits for crafting wave 4 (#48) to land, then goes in as its own pull request. P-5b also left the mist's half of the countdown and the lantern for P-6, and the warning before a camp fire goes out for the tent (CR-25).

After P-5, in order:
- CR-60 miss tables;
- CR-62 save reset notice;
- P-4, then P-6, which defines the mist;
- CR-25 tent, then CR-38.

Starters must stay different all game: CR-37 only built the opening part.

## 2. Land the crafting stack (#45, then #46, then #48)

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

d) Before (c), branch `feat/starter-looks`: the three starters look different in the game. Today the forager, the digger and the explorer all draw `chars/player_*` (or `woman_*` with the look toggle), so the choice of starter is invisible after the title screen. The look is already decided: DECISIONS 2026-10-09 "Each player role reads at a glance: one big item, one colour, its own build" (the Explorer tall and lean with a wide-brimmed hat and a tall backpack with a blanket roll; the Forager short and slight with a large wicker basket and the rust red on a neckerchief and the basket lining, no head wrap; the Digger broad and heavy-set with a spade across the back and a cap; a man base plus a woman option each; the same patched base clothes). The 3D cast on `trial/3d` already follows it. So this is building an agreed direction, not a new one: no stills round. Draw walk, idle and work in four directions for each role and both looks, inside the pixel look, and give each starter's JSON its own `sprite` and `sprite_alt`. It runs before (c) so the every-action frames are drawn once per role. Measurable: in one capture the three starters stand side by side and are told apart at phone size by item, colour and build; no starter names `chars/player_*`; `pnpm verify` and `pnpm e2e` green.

c) After (a), (b) and (d) land, branch `feat/every-action`: one animation for each action the player takes (gather, pick, dig, fell, mine, craft at the workshop stall, cook, eat, drink, talk, pay, pitch a camp, sleep), inside the pixel look, so no stills. In the same pull request, a quest given in talk is offered in the giver's words and the "New task:" line goes (`game/src/text.ts`); the journal records the quest quietly. Measurable: every action in the list shows its own frames in a capture; no "New task" string in `game/src`; `pnpm verify` and `pnpm e2e` green.

## 5. The shops you walk into

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

`feat/first-maze` holds one unverified WIP commit (68be9a2, "the tangle"). It touches `schema/src/index.ts`, `tools/src/play.ts` and a new `tools/test/maze.test.ts`. Read GAME_RULES section 3 and DECISIONS 2026-10-09 "maze and stealth".

Steps:
1. Branch fresh off `develop`, cherry-pick the commit, and finish it.
2. Keep the schema additive, with `FORMAT_VERSION` staying 1.
3. Verify and land.

Stealth over the hazards is section 12.

## 7. Story chapter 1 (#58)

A docs pull request: chapter 1 approved, and how the three starters differ in it.
1. Merge `develop` into it and check it against `docs/design/STORY.md` S1-S6.
2. Ask the owner one question if anything there contradicts a later decision, then land it.

## 8. The 3D door at /play3d/

Read DECISIONS 2026-10-11 "The 3D version is a second door" and, on `trial/3d` (#24), `docs/3d/meshy-notes.md` and `game/public/3d/models/README.md`. The 3D game moves at its own pace and never holds the classic game back.

a) Land the door, branch `feat/play3d` off `develop`:
- Bring the valley and the cell scene from `trial/3d` (125 commits behind `develop` on 11.10) onto a fresh branch; take generated files from `develop` and regenerate them.
- The web build serves the 3D game at `/play3d/`; the 3D build step is optional, and when it fails the classic game still ships.
- The 3D game runs the same kernel and content bundle and reads and writes the same save key and format as `/play/`: walk, the opening's quests, gather, save.
- Measurable: a character made at `/play/` loads at `/play3d/` and back; `/play3d/` loads at 390x844 and 1440x900 (captures with headless Chrome on its own port, closed by PID); the home button shows only when `/play3d/` is built; `pnpm verify` and `pnpm e2e` green.

b) The rest of the cast, after (a): Elder Maru, Pell and the cook.
- Meshy drafts on the four trial accounts (Chrome profiles on ports 9341-9343 and 9333; the daily check-in already claims the bonus credits). Use credits only on drafts; download nothing before the owner picks.
- A look is a direction: two or three phone-size stills per character to the owner, opened in his browser, never an artifact link. The pick goes into DECISIONS with its frame.
- Then download the pick once, rig and reduce it in the local Blender pipeline, as the six role models were.

c) A daily routine while this stream runs (owner, 11.10), before section 9: each day, on all four Meshy accounts, do the site's daily tasks that earn credits (the check-in timer only loads the workspace), and spend what they ask for on work the game needs: the cast drafts of (b) first, then props the 3D valley lacks. Log credits earned and spent per account in `docs/3d/meshy-notes.md`.

## 9. The maze peek and the hint ladder

Read DECISIONS 2026-10-11 "Maze difficulty is a ladder of four tiers" (PR #71). After #71 lands.

- At a maze's entrance the camera shows the whole maze from above for 3 seconds, then returns to the player.
- A maze names its tier in content (schema additive, `FORMAT_VERSION` stays 1). Tier 1: the peek with a very faint route line and the landmarks. Tier 2: the peek, and only the landmarks glow for a moment. Tier 3: the shape alone. Tier 4: no peek; waits for P-5c and stealth.
- The tangle is tier 1.
- Measurable: the peek lasts 3 seconds and fits the whole maze on screen at 390x844 and 1440x900; the line shows at tier 1 only; `pnpm verify` and `pnpm e2e` green.

## 10. The stage-1 service (M5: GRUNT 17, 18, 19)

Read GRUNT items 17-19 and DECISIONS 2026-10-07 "The stage-1 service runs as Vercel Functions with Upstash Redis" and 2026-10-08 "Stage 2a after the stage-1 service". This stream is the road to the server: stage 2a is designed once its numbers are in.

- One pull request per GRUNT item, in order 17, 18, 19, each with the item's proving command.
- Upstash Redis comes from the Vercel Marketplace (free tier) in the existing project. Provisioning it and setting its two environment names on Vercel is a production change: ask the owner first, in three lines. Until then the tests run on the fake store and `usage` stays null.
- Add Vercel Web Analytics for page views (owner, 11.10): `@vercel/analytics` pinned, one component in the site layout and one call in the game's page. Turning it on in the Vercel dashboard is the owner's, at the release. It does not replace the in-game counts.
- Measurable: item 17's curl prints 204 on a preview with the env names; item 18's client tests and e2e green; item 19's page lists the fixture's numbers; `pnpm verify` green.

## 11. Night light: dark around, a sharp light, no mist on the character

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

## 13. Tending: a fire kept by hand, and Maru's hearth

Read DECISIONS 2026-10-13, GAME_RULES G48 and G31, the `tending` row of section 3, SETTLEMENT.md 3.4 and GRUNT CR-25, CR-88 and CR-94 first. Two pull requests, after section 12.

a) The kernel, branch `feat/tending-kernel`:
- Schema, additive: a map prop may carry `fire: true` (it needs an id) or `lit_by` (a fire prop's id: its note and sign read only while that fire burns); params `fire.cap` (3 logs), `fire.log_ms` (100000, one log's burn, two game hours) and `fire.warn_min` (30 game minutes; CR-94's `fire_warn_min`, grouped under `fire` beside the cap and the burn), on the game tick; a quest step `{kind:'tend', fire: Id}`; the action `{t:'feed', fire: Id, item: Id, at}`.
- `kernel/src/state.ts`: `player.fires: Record<Id, {lit: tick, until: tick}>` (restore defaults `{}`); `fireBurns(state, id, tick)` is `until > tick`; `nextLogAt(bundle, state, id, tick)` is the first tick from `tick` on at which a whole log fits, `max(tick, until - (cap - 1) * log_ms)`; `burnsAsWood(bundle, item)` and `tendHolds(bundle, state, id, tick)` are the wood and vigil tests that `feed`, `questSatisfied` and the client share.
- `kernel/src/step.ts` `feed`: the player stands within one tile of the prop, the item's class is wood (the kernel reads the class from the bundle; anything else is refused), one is removed; a fire that is out lights with `lit = tick` and `until = tick + log_ms`; a burning one adds `log_ms` when the whole log fits under `tick + cap * log_ms` (else "The fire is already full." and the log stays in the bag; `nextLogAt` says from which tick the next one fits) and keeps its `lit`; event `{e:'fire', id, until}`. `questSatisfied` for `tend`: `lit <= lastDusk(tick)` and `until >= nightEnds(lastDusk(tick))`, the dusk being the most recent at or before the state's tick, and since 2026-10-16 also `tick >= nightEnds(lastDusk(tick))`: the step is met only once that night's dawn has come, and stays met until the next dusk (DECISIONS, the vigil at dawn). The fire's clock is the game tick, so away nothing burns; no sleep exists yet, and when it comes it burns the night's wood at once and ends the vigil (DECISIONS, the world and its clocks).
- `tools/src/play.ts`: the G48 rows; `tools/src/check.ts`: the fire's params open its warning only once a log fits (`warn_min` within `cap - 1` logs of burn, so the cap is at least 2).
- Tests (`kernel/test/fire.test.ts`): feeding lights and tops up to the cap and no further, a log that would not burn whole is refused and stays in the bag, and `nextLogAt` says when the next one fits; the fire goes out on time; a vigil holds from dusk to dawn and fails on a gap, however short; a replay agrees. `KERNEL_VERSION` 0.7.0.

b) The client and the content, branch `feat/tending`, on (a):
- Client: a Feed button beside a fire prop while the player holds wood (where Build sits), the flame drawn only while the fire burns and the embers fading as it runs down, the warning `fire.warn_min` game minutes before it goes out (G31, once per burn), the journal line for `tend` ("Keep the hearth burning until dawn", then what it still needs), a prop with `lit_by` showing its note and sign only while that fire burns, and the fire's state surviving a reload.
- Content: a hearth prop `core/elder-hearth` beside Maru's house; the quest `core/the-long-night`: giver Maru, type `tending`, requires `core/a-coin-for-maru`, one `tend` step, offer and done lines in Maru's voice (a Mender: mend what is left), rep, gold and the bandage recipe (`core/bandage`, a Mender's: G4), and a remark afterwards.
- E2E (`game/e2e/tending.ts`): light the hearth before dusk, feed it through the night with the clock moved, see the warning once, see the step met at dawn and turn it in to Maru; a second pass lets it go out and sees the step unmet.
- Measurable: wood leaves the bag per feed; the flame shows only while lit; `pnpm verify` and `pnpm e2e` green.

## 14. The first expedition: the night ruins (P-6)

Read DECISIONS 2026-10-08 (the expedition), 2026-10-10 (the entrance is safe; "one mist"), 2026-10-13 (the frames), GAME_RULES G36, G37 and G49, and GRUNT P-6 first. Two pull requests, after sections 12 and 13: the container, then the ruins.

a) The container, branch `feat/expedition-kernel`:
- Schema, additive: a content kind `expedition` with `place` (an area slot), `window` (`{ bells }`: 2 to 6 hours on the game clock, all at night, in the order they ring; the first bell opens the window, the last walks out), `exit` (a safe slot), `chain` (3 to 5 quest ids, each with no giver and `requires` the one before), `climax` (`{ slot }` inside the place), `reward` (`opens`, `items`; no `rep`, there is no giver) and `on_miss: 'wait'`. `expedition` is not a quest type. `tools/src/assemble.ts` and `kernel/src/bundle.ts` carry it.
- `kernel/src/state.ts`: `player.expeditions: Record<Id, { climax: boolean, entered?: number, rung: number }>` (`entered` the tick of the first action or report inside the place on this visit, cleared by one outside; `rung` the bells reported since it); `kernel/src/expedition.ts`: `inside(bundle, state)`, `bellsRung(bundle, x, tick)`, `lastBellAt(bundle, x, tick)`.
- `kernel/src/step.ts`: on every action and report inside the place, each bell that rang after `entered` and is not yet counted in `rung` emits `{e:'bell', expedition, n}` (a bell rung while the player was outside is never reported); at or after the last bell the player is set on the exit tile, the outing closes there and `{e:'walked_out', expedition}` is emitted, no damage; a quest of the chain auto-activates only while the player stands inside the place inside the window (`autoQuests`), and its progress is kept like any quest's; the climax: standing on the climax slot inside the window with every quest of the chain done, once, emits `{e:'climax', expedition}` and applies the reward.
- `tools/src/play.ts`: the G36 row of section 8 becomes a check, and the G4 check counts a quest of a chain as rewarded by its expedition.
- Tests (`kernel/test/expedition.test.ts`, `tools/test/expedition.test.ts`): bells by the clock, the walk-out with the bag whole, a chain quest not starting by day or outside, progress kept across two nights, the climax once. `KERNEL_VERSION` 0.8.0.

b) The ruins, branch `feat/night-ruins`, on (a):
- Content: `core/night-ruins` (the expedition: an area slot over the ruins, bells at 20, 23, 2 and 4, exit `core/night-threshold`, the chain and the climax); `core/ruins-wolf` gets a round through the yard between the gate and the hall, with cover props among the pillars; the four quests, in this order of `requires`: `core/the-hall-at-night` (stealth: find `core/glowcap`, a mushroom in the hall with `hours` [20, 24); its reward opens `core/deep-way`, rubble with no inputs as the arch-way is), `core/what-the-deep-keeps` (gamble: a dig spot `core/bell-pit` in a pocket of the deep ruins behind that rubble, so the chain alone reaches it, with `core/bell-shard` one in five; its reward two logs, dry wood for the brazier), `core/the-brazier` (tending: `core/hall-brazier`, fed to reach dawn before the last bell), `core/the-hall-reads` (riddle: the hall's inscription with a Waker's and a Mender's reading of one line, STORY.md S2 and S4, answer: visit `core/bell-alcove` at night; the inscription prop carries `lit_by: core/hall-brazier`); the climax slot `core/bell-foot`; the reward opens `core/hall-stair`, a restore the player can also shore by hand with six logs by day (G37: the expedition is the sooner road, never the only one), and the stair's cellar `core/hall-cellar` is a dig spot by day whose find hints at a fold (a clockwork scrap, STORY.md section 1). Maru gets a topic about the bells. The arch and the three-stones riddle stay as they are.
- Client: the bells as the clock on screen while inside (a chip with the bells rung and the next bell's hour), the walk-out beat (the mist thickens, the screen fades, the player stands at the threshold with one box), the climax beat (the stair opens with its sound, G13, G25), and the inscription read by `lit_by` (section 13b).
- E2E (`game/e2e/expedition.ts`): enter after dark, miss the last bell and be walked out with the bag whole, return the next night, finish the four and reach the climax, dig the cellar by day.
- Measurable: the e2e log prints the climax line and the opened slot (P-6); `pnpm verify` and `pnpm e2e` green.
