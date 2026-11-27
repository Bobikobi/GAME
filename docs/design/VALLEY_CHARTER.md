# The valley charter and budget table

**DRAFT for the owner's signature.** Written 27.11.2026 by the valley-charter lane (public tracker #895). It is a proposal to
sign or change, not a rule: nothing here binds a builder until the owner signs a row and the manager records it in
[DECISIONS.md](../../DECISIONS.md). No look direction is decided here, no rule of [GAME_RULES.md](GAME_RULES.md) is changed, and no
number below is the owner's unless the row says GIVEN.

## Why this page exists

The plan's valley stage (the MVP) exits on: everything a player meets is built at final quality (a vertical slice), polished to the
highest level we can realistically reach, passes a final comparison against the references, and the owner approves; 5 outside testers
enjoy it, 3 return within a week, and one outside creator adds an item by pull request from the README alone. Five of its sub-stages
(light, atmosphere, effects, animations, the owner's accuracy notes) and the last comparison have no measured bar, so their only exit
is the owner's eye, and the final comparison would find gaps instead of gating them. This page writes "done" as rows: each with a bar,
how it is measured, what it measures today, and who signs.

## How to read the tables

- **Bar status.** GIVEN: the owner said it, with the date. WRITTEN: already in the repo as a rule or a check. PROPOSED: this draft's
  number, with the reason; the owner moves it. OPEN: undecided, and the row names who decides.
- **Today.** MEASURED: a value taken for this page (the baseline in section 4 says on what), or read from CI. NOT YET: nothing
  measures it, and the row says what has to exist first.
- **Where the owner's eye is the only judge** (a look), the row names the evidence he judges on instead of a number: full-frame stills
  at 1920 x 1080, one art pixel to one device pixel (the direction line of [AGENTS.md](../../AGENTS.md)), beside the closest reference
  crop (the owner's word of 24.11: every valley moment beside its closest reference). A phone still at 844 x 390 may be attached as
  information. A builder or a model that checks a still beside its reference cannot sign it.
- **A bar is a band with two sides.** Passing a floor many times over is a fail when a player would see the difference. The check
  says which bar let a visible difference through.
- **Waivers.** A row the build cannot meet is waived by the owner only, as a DECISIONS entry that names the row, the reason and the
  date it comes back. A builder never waives a row.

### The owner's standing words this page rests on

| Words | Date and source |
|---|---|
| Smooth frames: zero stutter, a 60 FPS floor on a mid phone, aim 120 where supported, not at any cost | The owner in chat, 23.11, recorded by the manager (no DECISIONS entry holds them) |
| Phones play landscape; the measured phone viewport is 844 x 390 | The owner's 14.11 direction, DECISIONS 2026-11-20 (#720) |
| Path of Exile 2 is at the standard of our aims: a level bar, never copied | The owner in chat, 19.11, recorded by the manager |
| The opening teaches almost nothing: the player explores alone, tasks at the start only open a new option | The owner, 19.11, DECISIONS 2026-11-20 (G103) |
| Production is one live world, always the latest: no demo, no second version | The owner, 22.11 about 13:00, the plan's valley note |
| Before the whole world enters, the valley gets atmosphere, effects, animations, his accuracy notes and a final comparison against the references, polished to the highest level we can realistically reach | The owner in chat, 24.11 about 08:50, the plan's valley blocks |
| The valley's base look is the painted new world (still B) | The owner's pick, 22.11, DECISIONS 2026-11-22 |

## 1. The route and the promise

### The promise

Drawn only from rules and words already recorded: a player who opens the link on a phone held on its side wakes in the valley within
seconds, finds something new they can see at least every ninety seconds for ten minutes (pillar 1 of GAME_RULES), learns by acting and
not by reading (pillar 2), is left alone to discover where to go (the 19.11 ruling), and plays it at a smooth frame rate. The ten
minutes end with the first night's discovery, the day's summary, and a morning that has changed.

### The ten minutes, in order

The order is the hook ladder of [GAME_RULES.md](GAME_RULES.md) section 2, which the opening e2e plays on every pull request. Where a
moment is undecided it says OPEN and who decides. "Look gap" is what the 22.11 audit and the repo show is not at the final look yet; it
is a fact about today, not a design.

| Moment | Minutes | What the player does | Built today | OPEN or look gap |
|---|---|---|---|---|
| R1 Title and wake | 0:00 to 0:15 | Opens the link, taps New game, wakes in one of three pockets by the river, finds the pocket's tool on the ground | Built. The title shows before the engine loads (develop, 27.11) | None recorded |
| R2 First work | 0:15 to 1:00 | One click on the keystone in the shallows; the hands go on by themselves; level 1, the jingle, a skill point | Built (the work rule: a click and a repeating animation, DECISIONS 2026-11-20) | The figure's walk and stand in the new 35-degree body (#793, in work) |
| R3 The mend, the tree, the fire | 1 to 5 | The bridge mends, a tree is felled with the pocket's axe, a fire is built and cooked on | Built; the opening e2e plays it | The 16 px oak, young and dead tree (section 2, G2) |
| R4 The town | 5 to 8 | Maru or Pell first; a real choice (Maru's old trowel, or Pell's recipe and coin); Maru's coin; at dusk the riddle and the hill lantern | Built; the opening e2e plays it | How Maru and Pell are drawn on the painted ground, and whether the town's buildings stay pixel drawings or are painted: not decided (DECISIONS 2026-11-22). Owner decides |
| R5 The night arch | 8 to 10 | After dark, the way under the broken arch at the edge of the ruins to the threshold of the night ruins; nothing hunts (G35) | Built | The 16 px ruin arch and rubble |
| R6 The day's summary | session end | What was found, built and learned; one open door | Built (#806, #807; in production too) | None recorded |
| R7 Day 2 | next dawn | The morning toast, a respawned grove, a new line from an NPC, a bell at night | Built (#806, #807) | None recorded |
| R8 One outing past the edge | after the ten minutes | Leaves the town's safe ground and returns, or dies (GAME_RULES G33 defines an outing) | Pieces exist: the camp wolf at the edge of safe ground (G103), the fall and the jump, the hunt of small game. No outing is written as one route moment | OPEN. What the outing is, how long, what it pays: the owner decides; the manager writes the pitch |

The plan lists the developers' area (#727) and a fixed playtest note per release beside the valley; they are not moments of the route
(section 5).

## 2. The gate table

Twelve gates. Every row has its owner as signer unless it says otherwise; "the manager checks the numbers" never means the manager
signs a look. The rows below are written so that a builder can say, for any build, which are met.

| ID | Gate | Bar | Bar status | How it is measured | Today (27.11) | Signs |
|---|---|---|---|---|---|---|
| G1 | Gameplay | Every rung of the ladder plays in order on phone (844 x 390) and desktop. The longest stretch between two payoffs is at most 90 s. `pnpm check` (the G rules) and `pnpm quests` are green | WRITTEN: GAME_RULES pillar 1 and section 2, `LONGEST_STRETCH_MS` in `game/e2e/opening.ts` (reported as criterion 8) | CI groups `opening-phone` and `opening-desktop`: the lines "pays to ..." and "criterion 8 PASS/FAIL" in the job log. A scripted player is quicker than a person, so this is a floor on the stretch, not a ten-minute recording (that is G9) | MEASURED, develop 22f4673a, CI run 45957213104: phone 84 payoffs in 415 s of play clock, longest stretch 24.3 s against 90 s, PASS; desktop (to Pell's hand-in) 13.1 s, PASS. Moment R8 has no run | Owner signs the route; the manager signs the numbers |
| G2 | Look | One full-frame still (1920 x 1080) of each moment R1 to R8 beside its closest reference crop, judged by the owner. Floors that code holds: no sprite in the valley on the 16 px list, no old figure shown, every sprite in its place's ramps (`pnpm check`) | PROPOSED for the stills set and the pairing; WRITTEN for the floors (AGENTS.md "the whole game is drawn rich", PLACE_LOOK section 4) | The stills come from the engine at the game's zoom; the 16 px list is `SIXTEEN_PX_LEFT` in `tools/src/kit/rich.ts`; the reference crops come from the map in G12 | MEASURED: 98 names still on the 16 px list (includes the oak, young tree, dead tree, ruin arch and rubble, and the old figure sheets). NOT YET: how many of them the valley places; the stills set; the reference crops | Owner |
| G3 | Light | Six stills of one fixed view at the hours the light table keys or the build's tests name: 05:00, 08:00, 12:00, 16:30, 19:00, 22:00, beside the closest reference crop. The decided numbers hold (the hour tint table, cast shadows, the night's 92 percent). No signal a rule needs is dimmer than before (the wolf's eyes, the player's pool, the glint, the fire's stage) | PROPOSED for the hour set; WRITTEN for the numbers (LIGHTING section 1, ART_SYSTEM sections 2 and 9) | Stills by the engine with the wind frozen; the signals by an e2e check | NOT YET: no light stills set; the "never dims" check is named in ART_SYSTEM section 9 but no e2e check for it was found (grep of `game/e2e`). In work (plan): a shadow per tree (H), houses as pieces (H2), dappled wood shadow (H3, stills to the owner first), the dark pools under the trees (D2b), the blur at the top (G2 of that lane) | Owner |
| G4 | Atmosphere | A written list of the valley's atmosphere moments (what makes it alive beyond light and wind), each with a reference crop, then each judged on a still or a short clip beside it | OPEN. The plan says the content is set against the references before building. The manager writes the list from the references; the owner approves it, and only then is this row a bar | Stills, and clips at game speed for anything that moves | NOT YET. Exists today: fog banks, mist, clouds, rain (at most 600 drops, `RAIN_MAX`), the birds' cue. No list says which of these is at the bar | Owner |
| G5 | Effects | Every action and encounter in R1 to R8 has its effect on a list; each effect has a timing contract (the kernel event it starts on, its size in tiles, its life); each is judged on a clip at game speed beside a reference; each fits its frame budget (B6.5) | PROPOSED: the list and the contract. WRITTEN: the four built effects' table (ANIMATION section 8) | Clips from the engine; a counter for particles (does not exist yet, section 3) | MEASURED: four effects built (hit-spark, crit-hit, landing-dust, campfire); a splash is a ring. NOT YET: the list of what the route needs; no effect schema or check exists | Owner |
| G6 | Animation | Every moving thing in R1 to R8 has its clips; each clip passes `pnpm anim check`: palette 100 percent, foot slide at most 1 px, silhouette within 10 percent, at most 30 poses a second; a held object keeps its size (`pnpm art:held`); each is judged at game speed on a clip beside a reference | WRITTEN for the numbers (`tools/anim/anim.json` limits, ANIMATION section 5.3, `HELD_WAIVERS`); PROPOSED for the list of moving things and the reference pairing | `pnpm anim check` (needs the clip sheets built locally), `pnpm art:held` and `pnpm check` (the held rows run inside it); the owner's eye on clips | MEASURED: 6 clips on `HELD_WAIVERS` (the skeleton's lift and carry, waiting for a redraw). NOT YET: `pnpm anim check` was not run for this page (its sheets are built locally and are not in git); the list of moving things in the route | Owner |
| G7 | Audio | **OPEN for the owner: does the exit include audio quality, and from which source?** Sound exists but has no bar and no owner pick. If it is in the valley: no cue peaks above -3 dBFS at the speaker, every loop closes without a click, and the owner has picked the source (synthesised or sampled) | OPEN (the owner decides). PROPOSED: the -3 dBFS ceiling, because the loudest cue SOUND.md 1.2 lists is `jingle:level` at -4.0 dBFS and a mastered web game keeps a margin below clipping | The procedure of SOUND.md 1.1: each cue rendered alone in an `OfflineAudioContext`, multiplied by the buses | MEASURED: the game ships no audio file; every sound is the in-page synthesiser (`game/src/audio/`: three songs, three ambience beds, effects, jingles, a master mute). SOUND.md 1.2 holds peaks per effect (for example `jingle:level` -4.0, `jingle:quest` -5.2, `pickup` -11.6 dBFS). SOUND.md is Status Proposed: the 30.10 listens still wait for his pick | Owner |
| G8 | Performance | The numbers of the budget table, section 3, on the named mid phone | GIVEN as words (23.11); the numbers are B2 to B18 | See section 3 | See section 3 and the baseline. No tool runs the walk on a phone | Owner signs the table; the manager signs each measured run |
| G9 | Player evidence | Five outside testers play the valley for ten minutes each, recorded, on phone and on desktop apart; at least 3 of 5 return within 7 days; every tester's session is a row in a log in the repo | GIVEN for 5 and 3 (the plan's exit). PROPOSED for the rest: "return" means a second session of at least 5 minutes started 1 to 7 days after the first, on the same browser; "enjoy" is OPEN (the owner defines it: a tester's own words after the session, or a behaviour such as asking to play on). 3 of 5 is a delivery threshold, not proof | Recorded sessions watched before answers are read; a neutral script (no leading words); a log file; return read from the tester's own save and from a message the tester sends in the game's feedback box (it carries the build and the place, no name) | NOT YET: no outside session is recorded in the repo (no playtest log exists); the game keeps no telemetry (saves are local; the page loads Vercel Web Analytics only). The plan's optional early playtest of today's valley stays the owner's call | Owner |
| G10 | Creator path | One outside creator, who has not seen the repo, adds an item by pull request from the README alone: the pull request touches only their own `content/extensions/<handle>/` files, passes CI without the team editing the content, and is merged | GIVEN for "one outside creator, from the README alone" (the plan's exit). PROPOSED: the item is a fruit, a herb or a recipe (the README's "smaller things"), and the clock from clone to pull request is recorded | The creator's pull request in the public tracker; the CI result; a note of where they stopped and asked | NOT YET: the only extension in `content/extensions` is `ceosisrael`, written by the team and CEOS; no outside pull request has merged. The README walks one townsperson in 15 minutes | Owner |
| G11 | The owner's accuracy notes | Every note the owner gives is a row in a ledger: date, the note in his words, the build, the evidence that closes it (a still or a clip), met or not met. At exit no row is "not met" | WRITTEN in the plan (each note a row marked met or not met until all are closed). PROPOSED: the ledger is a table in its own file, created when the first note arrives | The owner marks "met" | NOT YET: no round of notes has been given | Owner |
| G12 | Final comparison | For each moment R1 to R8: the engine's full frame beside the closest reference crop, one line on what differs most to the eye, and which bar let it through; each gap closed or recorded with its reason | GIVEN in words (24.11: every moment beside its closest reference, each gap closed or recorded, last before the stage exits). PROPOSED: the reference map below | A comparison sheet per moment; a builder may pre-check it and says so, and cannot sign | NOT YET: no reference map exists in the repo. The owner's reference library lives outside git. OPEN: where the crops are kept and under what licence. PROPOSED: a manifest in the repo (moment, source, licence or "private reference, not redistributed", crop name) with the crops themselves kept out of git, since a level bar such as Path of Exile 2 is never copied | Owner |

### What has to exist before a row can be measured

These are tool gaps, stated so the charter does not pretend a row is measurable when it is not. None is built in this pull request.

1. **A frame-time walk on a phone (G8, B2 to B6).** No tool runs a scripted walk and writes frame times. `pnpm e2e:load` proves the bag's weight, not a frame, and `pnpm map:playtest` is the balance playtest. `tools/stills/frame-time.mts` takes a still frame at the old portrait phone size. `game/scripts/boot-time.ts` measures the boot only. The probe used for section 4 is a throwaway and is not committed.
2. **A real GPU or phone for the frame rows (B1 to B6).** The only browser the harness launches draws WebGL in software (SwiftShader), which inflates every frame time.
3. **Per-layer counters (B6, B14 to B16).** The game counts no lights, particles or full-screen layers in view.
4. **A valley inventory (G2, G6).** There is no table that says, per thing the player meets, its state and its reference; the 16 px list counts names, not what the valley places.
5. **The reference map (G12)** and the **comparison sheet**.
6. **Telemetry or a tester log (G9).** Nothing records a session or a return.
7. **An audio loudness check (G7)**, if audio is in.

## 3. The budget table

Every number in the Bar column is PROPOSED unless it says GIVEN or WRITTEN, with its reason. A budget is what a build must stay inside;
today's value sits beside it. Frame times from the probe of section 4 come from a software renderer and are **not** a pass or a fail.

| ID | Budget | Bar | Bar status and reason | Today, develop 22f4673a (production 957804c7 where measured) | Signs |
|---|---|---|---|---|---|
| B1 | Named phone and browser | Samsung Galaxy A54 5G, Chrome for Android at the current stable version, landscape 844 x 390 CSS px at a device ratio near 2.6 | PROPOSED. Reason: a best-selling mid-range Android phone; `tierOf` in `game/src/device.ts` returns `mid` for 8 cores, 6 GB and a Mali-G68 GPU (checked by calling the function); its screen refreshes at 120 Hz, so the 120 aim is testable. The phone's specs here are from memory (unchecked) and the owner may name another. A second phone, an iPhone, is out of this draft | Not owned: no such phone is in the house. OPEN: who borrows or buys one. Until then, the proxy is desktop Chrome with the CPU throttled x4, which says nothing about a phone's GPU | Owner |
| B2 | Frame floor | 60 FPS: on the walk of B4's tool, p95 frame time at most 16.7 ms, p99 at most 33 ms | GIVEN as words ("a 60 FPS floor on a mid phone", 23.11); PROPOSED as the percentile reading of "floor" | A frame-time walk on the named phone (tool gap 1) | NOT YET on a phone. Software GL, 844 x 390, one run: develop standing p50 50, p95 100 ms; production standing p50 33, p95 83 ms. Not a pass or a fail | Owner |
| B3 | Freeze ceiling | No frame over 50 ms in the walk | WRITTEN: "no frame blocks over 50 ms on the phone profile" (NEXT.md section 19). 50 ms is also the web platform's long-task threshold | Same walk; the page's long-task observer | NOT YET on a phone. Software GL, one 40 s walk: develop worst frame 250 ms, 10 tasks over 50 ms; production worst frame 4,433 ms, 13 tasks over 50 ms. At boot behind the title (CPU x4): five tasks of 51 to 171 ms left (DECISIONS 2026-11-27) | Manager signs the run; owner signs the table |
| B4 | Stutter count | At most 20 frames over 20 ms in a 40 s walk | PROPOSED. The sentence comes from the manager's research notes, not from the owner. The owner's word is "zero stutter": **OPEN for him** whether zero means no frame over 50 ms (B3) and this count for the smaller hitches | The same walk. The walk must cross a ground chunk border and a land edge, which is where the known freezes were; the probe of section 4 did not | NOT YET. Software GL: develop 685 of 693 walking frames over 20 ms, which is the software renderer, not the game | Owner |
| B5 | High refresh | Aim 120 where supported, not at any cost | GIVEN (23.11). WRITTEN: Auto caps at 120 only for a high-tier device over 100 Hz whose p95 is under 6 ms (`HIGH_REFRESH_HZ`, `HIGH_P95_MS` in `game/src/settings.ts`); a mid phone gets 60 | The rule is built and tested (`game/test/settings.test.ts`); nothing measures it on a 120 Hz phone | Owner |
| B6 | Frame time split (rows B6.1 to B6.8) | The eight rows below sum to 16.7 ms, the 60 FPS frame. 120 Hz is an aim of 8.3 ms and is never a budget | PROPOSED. Reason: LIGHTING.md section 4's estimates (the hour's tint and the pools about one pass, a ground motion shader 1 to 3 ms, sway on props about 0.1 ms, particles under 0.2 ms), with the rest shared by judgement. All are estimates until a phone is measured | No per-layer timer exists (tool gap 3). LIGHTING.md section 4 holds relative software-GL rungs from 30.10, not milliseconds on a phone | Owner |
| B6.1 | Simulation | 2.0 ms: the kernel's tick and the scene's update | PROPOSED | NOT YET | as B6 |
| B6.2 | Ground | 3.0 ms: drawing the ground pages and water | PROPOSED | NOT YET | as B6 |
| B6.3 | Light | 2.0 ms: the hour's shade, the pools, cast shadows | PROPOSED. About one full-screen pass plus the pools (LIGHTING section 4) | NOT YET | as B6 |
| B6.4 | Wind | 1.0 ms: sway on props, the meadow's bend, flames | PROPOSED. The ground shader alone was estimated at 1 to 3 ms, so wind may need the ground's share | NOT YET | as B6 |
| B6.5 | Effects | 1.5 ms: one-shot effects, fire, rain, mist, fog banks | PROPOSED | NOT YET | as B6 |
| B6.6 | Upload | 1.5 ms: texture uploads and the ground pages baked while walking | PROPOSED. Bank and page uploads are the tasks that broke 50 ms at boot (DECISIONS 2026-11-27) | NOT YET | as B6 |
| B6.7 | UI | 1.0 ms: the page's overlay and the in-canvas text | PROPOSED | NOT YET | as B6 |
| B6.8 | Reserve | 4.7 ms (28 percent): browser compositing, garbage collection, a slower frame | PROPOSED. A frame that fills its whole budget drops frames at the first hitch | NOT YET | as B6 |
| B7 | Texture memory | At most 256 MB of decoded textures (width times height times 4 bytes) in the valley after the route's first five minutes | PROPOSED. Reason: a ceiling that leaves room on a phone with 6 GB shared with the browser; the figure is common mobile-web guidance (unchecked) | MEASURED as a sum over the Phaser texture manager at the wake, about 13 s in: develop 407 sources, 168.5 MB; production 395 sources, 168.9 MB. The biggest are the 1,024 x 1,024 ground pages (4 MB each) and the mist (4 MB). The sum is an estimate: the GPU may hold less or more | Owner |
| B8 | Download, cold, to the title | At most 1 MB | PROPOSED. Reason: a first screen that loads within a second on a fast phone connection; unchecked against a page-weight survey | MEASURED, cold, Fast 4G: develop 193 KB (local server, gzip level 6, so not the CDN's bytes); production 2.19 MB in 541 requests before the title | Owner |
| B9 | Download, cold, to first play | At most 3 MB | PROPOSED. Reason: a typical mobile web page weighs about 2 MB to 2.5 MB (unchecked); the valley is a game and gets a little more | MEASURED: develop 2.23 MB in 557 requests (gzip); production 2.19 MB. The clip sheets of the player's race arrive after the wake and are not in this number (DECISIONS 2026-11-22: 1.1 to 2.1 MB more) | Owner |
| B10 | Download, warm | At most 50 KB to play on a return visit | PROPOSED. Reason: the assets are named by content hash and cached for a year; only the page itself is revalidated | MEASURED: production 22.7 KB to play (the revalidation); develop 0 KB from a local server that never revalidates, so read production's number | Owner |
| B11 | Boot to the title | At most 3 s on the named phone at Fast 4G | PROPOSED. Reason: the web's "good" threshold for the largest paint is 2.5 s (unchecked); the title is the first thing a player sees | MEASURED at CPU x4, Fast 4G, desktop Chrome: develop 0.83 s (the repo's `game/scripts/boot-time.ts` reads 0.88 s); production 38.1 s | Owner |
| B12 | Boot to first play | At most 15 s cold and 8 s warm on the named phone | PROPOSED. Reason: today's develop value, rounded to a clear step; the owner moves it. DECISIONS 2026-11-27 reads the title and the wait behind it as separate | MEASURED, CPU x4, Fast 4G, to a started game after New game and Wake up: develop cold 18.7 s (the world built at 16.4 s), warm 9.3 s; production cold 104 s (the world built at 47 s), warm 107 s | Owner |
| B13 | Work behind the title | No task over 50 ms while the world builds behind the title | WRITTEN: the 27.11 bar "no frame over 50 ms" (DECISIONS 2026-11-27, which records it as not yet met) | MEASURED by that entry: five tasks of 51 to 171 ms at CPU x4 | Manager signs the run |
| B14 | Lights in view | OPEN until a counter exists. Then: a number of lit pools at once in the 844 x 390 view | OPEN. No target is proposed without a count; a made-up number would gate nothing | NOT YET: no counter | Owner |
| B15 | Particles in view | At most 600 rain drops (written in code). Other particle sources: OPEN until counted | WRITTEN for rain (`RAIN_MAX`); OPEN for the rest | NOT YET for the rest: no counter | Owner |
| B16 | Transparent cover | The number of full-screen transparent layers at once: OPEN until counted. Until then each new full-screen layer shows its before and after frame time in its pull request, the way LIGHTING section 4 does | OPEN. Today's full-screen layers include the hour's shade, the pools, the fog banks, clouds, mist and the sun shaft; the count at one view is not taken | NOT YET | Owner |
| B17 | Audio bytes and voices | Zero audio files today (a synthesiser). If sampled audio comes in: at most 1 MB of audio in the first download, and a number of voices at once set by the owner | OPEN with G7 | MEASURED: 0 bytes of audio shipped. The voice count is not measured; SOUND.md reads the synthesiser's cost as 20 to 80 percent of a phone core, a guess from a desktop (SOUND.md section 5, unchecked) | Owner |
| B18 | Who approves an exception | The owner, by a DECISIONS entry naming the budget, the amount over and the date it comes back. A builder or the manager never raises a budget | PROPOSED | Not applicable | Owner |

### Two things the table cannot yet say

- **Which preset the floor is measured on.** Auto gives a mid-tier phone the medium preset, where `RICH.motion` is off, and only the high preset has it on (`richOf` in `game/src/settings.ts`). LIGHTING.md says the sway runs on phones of every tier. Which of the valley's moving things belong to that group on a mid phone is not listed anywhere. OPEN for the owner and the performance row: is the 60 FPS floor measured on the preset Auto picks for the named phone (today medium), and does the final-quality look require the high preset? A look judged on a high-preset desktop frame and a floor measured on a medium-preset phone describe two different games.
- **Auto may drop a low-tier phone to 30 FPS** (`LOW_P95_MS`). The 60 FPS floor is written for a mid phone; it says nothing about a low one.

## 4. The baseline

### What was measured, and on what

Two columns, never mixed. **Production** is `loomvale.vercel.app/play/`, which `deploy.yml` fills from `main`: commit
`957804c7` (release v0.1.13, 22.11), redeployed today at 07:36 UTC; the live bundle `index-DPxBjUce.js` carries none of the strings
that the boot work of 27.11 added. **Develop** is commit `22f4673a` built locally (`pnpm bundle`, `pnpm --filter game build`), 56 commits
ahead of production. Production is therefore not "always the latest" today (the owner's 22.11 word); the gap is 56 commits, and the
boot to the title is 38.1 s there against 0.83 s on develop. A release carries the difference; whether and when is the owner's.

The probes are throwaway scripts kept outside git (they are not a tool; see tool gap 1). They use the repo's own browser driver
(`game/e2e/cdp.ts`). Each number is **one run**; run to run spread is not measured (the 27.11 boot entry found two runs of one build
differ by hundreds of pixels in a frame, so expect spread).

- **Browser:** Chrome 157 headless, WebGL by SwiftShader (software), on a laptop with a 12-thread CPU. This inflates every frame time and
  makes the drawing's cost fall on the CPU. **The frame numbers are not a pass or a fail and say nothing about a phone's GPU.**
- **Viewport:** 844 x 390 CSS px, touch emulation on, device ratio 1 (the repo's phone profile is the same size at ratio 3 for
  stills; ratio 1 here keeps the software renderer from drowning).
- **Boot probes:** CPU throttled x4, network "Fast 4G" as DevTools adjusts it (165 ms latency, 1,012,500 bytes a second down), a fresh
  profile for the cold run and a second navigation for the warm one. "To the title" is the title button on the page; "to play" is the
  game started after New game, Human and Wake up. Develop is served by a local server with gzip level 6, so its byte counts are
  compressed bytes of that kind, not the CDN's (brotli); production's are what its CDN sent.
- **Frame probe:** CPU x1, the High preset with no cap (set in the page's settings), 10 s standing, then 40 s of a scripted walk: an arrow key held 3 s at a time,
  turning right, down, left, up. The walk covered about 5 by 9 tiles on develop and 1 by 9 on production, inside one 64-tile chunk, so
  **it never crossed a chunk border or a land edge and is not the 40 s walk the bar needs.** The intervals are `requestAnimationFrame`
  gaps, which in headless mode land on multiples of 16.7 ms.
- **Texture sum:** width times height times 4 bytes over every source in Phaser's texture manager, read at the wake plus about 13 s.
- **Unchecked claims** in this page are marked "(unchecked)": specs of the proposed phone, web-platform thresholds quoted from memory,
  the mobile page weight.

### Every row's value today

| Row | Production 957804c7 | Develop 22f4673a |
|---|---|---|
| G1 gameplay | not measured | MEASURED: phone 84 payoffs in 415 s, longest stretch 24.3 s; desktop 13.1 s (CI run 45957213104) |
| G2 look | not measured | MEASURED: 98 names on the 16 px list. NOT YET: valley subset, stills, reference crops |
| G3 light | not measured | NOT YET |
| G4 atmosphere | not measured | NOT YET (list is OPEN) |
| G5 effects | not measured | MEASURED: 4 effects built. NOT YET: the route's list |
| G6 animation | not measured | MEASURED: 6 clips on `HELD_WAIVERS`. NOT YET: `pnpm anim check`, the list of moving things |
| G7 audio | not measured | MEASURED: 0 audio files; peaks in SOUND.md 1.2 (the loudest listed, `jingle:level`, -4.0 dBFS). OPEN: whether it is in the exit |
| G8 performance | see B rows | see B rows |
| G9 player evidence | no session recorded | no session recorded (NOT YET) |
| G10 creator path | no outside pull request | no outside pull request (NOT YET) |
| G11 accuracy notes | none given | none given (NOT YET) |
| G12 final comparison | no reference map | no reference map (NOT YET) |
| B1 phone | none owned | none owned |
| B2 floor, software GL, standing | p50 33.4, p95 83.3, max 116.7 ms (246 frames) | p50 50.0, p95 100.0, max 150.1 ms (183 frames) |
| B2 floor, software GL, 40 s walk | p50 33.4, p95 116.6, p99 600, max 4,433 ms (564 frames) | p50 50.0, p95 116.7, p99 150.1, max 250 ms (693 frames) |
| B3 freeze, software GL, 40 s walk | 125 frames over 50 ms; 13 long tasks over 50 ms, the longest 4,472 ms | 288 frames over 50 ms; 10 long tasks over 50 ms, the longest 255 ms |
| B4 stutter, software GL, 40 s walk | 533 frames over 20 ms | 685 frames over 20 ms |
| B5 high refresh | rule built, not measured on a phone | rule built, not measured on a phone |
| B6 split | NOT YET | NOT YET |
| B7 texture memory | 168.9 MB (395 sources) | 168.5 MB (407 sources) |
| B8 cold bytes to title | 2.19 MB, 541 requests | 193 KB, 9 requests |
| B9 cold bytes to play | 2.19 MB, 547 requests | 2.23 MB, 557 requests |
| B10 warm bytes | 22.7 KB | 0 (local server; read production) |
| B11 boot to title | 38.1 s cold, 37.8 s warm | 0.83 s cold, 0.38 s warm (repo tool: 0.88 s) |
| B12 boot to play | 104 s cold, 107 s warm | 18.7 s cold, 9.3 s warm |
| B13 work behind the title | not measured | five tasks of 51 to 171 ms (DECISIONS 2026-11-27) |
| B14 lights | NOT YET | NOT YET |
| B15 particles | NOT YET (rain cap 600 in code) | NOT YET (rain cap 600 in code) |
| B16 transparent cover | NOT YET | NOT YET |
| B17 audio bytes | 0 | 0 |
| B18 exceptions | none | none |

What the two columns say together: on develop the boot is fast and the texture sum is the same as production's; on production the
page spends its first 38 s on the CPU before the title appears, and the first 40 s of walking hit one 4.4 s frozen frame that develop did not.
A branch on the public tracker (`perf/west-stutter`) is working on stutter; this page does not duplicate it.

## 5. What is out

- **The wide world.** Anything past the valley's edge beyond the one outing (R8): the rest of the 2,280 lands, streaming of many lands, the world's generator.
- **The 3D door (`/play3d/`) as a gate.** It is paused; the valley's bars are the classic game's. A rule decided for both doors is still carried across, as AGENTS.md says.
- **A second phone or iOS Safari** as a measured target. The owner may add one.
- **The developers' area (#727)** and **the fixed playtest note per release**: they sit beside the valley in the plan and are not moments of the route.
- **Online play, accounts and the server's load.** Not a valley gate.
- **Telemetry or analytics as a product.** G9 may read a tester's return by hand; no funnel is proposed.
- **Content volume.** Two of each new kind and their cost, and the matrix tables, are their own plan blocks.
- **A new tool.** This page names the gaps (section 2) and builds none; a tool arrives as its own pull request.
- **A look direction.** The base look is the owner's 22.11 pick; nothing here chooses a style, a palette or a still.

## Signature

Each row is signed by the owner or changed by him. The manager records it in DECISIONS.md when he does.

| Part | Rows | Signed (owner, date) |
|---|---|---|
| The route | R1 to R8 | |
| The gates | G1 to G12 | |
| The budget | B1 to B18 | |
| The baseline | section 4 | |
