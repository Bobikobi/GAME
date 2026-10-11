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
  - Second opinions go to Codex (`codex exec --sandbox read-only "..."`) or Gemini (`ask-agy`), and their claims are checked against the build before anything changes.
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
6. An e2e: at night, step one tile past the ruins' entrance, fall, and reappear in town with the basket gone and the quest back at step one.
7. Rename `satiety` to `hp` last, in its own commit, after crafting has landed.

Known wart, in DECISIONS: a quest that completed by itself during an outing keeps its reward after a fall. Mist hazards wait for P-6.

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

Stealth over the hazards comes after P-5c.

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

## 9. The maze peek and the hint ladder

Read DECISIONS 2026-10-11 "Maze difficulty is a ladder of four tiers" (PR #71). After #71 lands.

- At a maze's entrance the camera shows the whole maze from above for 3 seconds, then returns to the player.
- A maze names its tier in content (schema additive, `FORMAT_VERSION` stays 1). Tier 1: the peek with a very faint route line and the landmarks. Tier 2: the peek, and only the landmarks glow for a moment. Tier 3: the shape alone. Tier 4: no peek; waits for P-5c and stealth.
- The tangle is tier 1.
- Measurable: the peek lasts 3 seconds and fits the whole maze on screen at 390x844 and 1440x900; the line shows at tier 1 only; `pnpm verify` and `pnpm e2e` green.
