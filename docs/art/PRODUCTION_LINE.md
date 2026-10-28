# The production line: pools, waves, kept drafts, the pick as an action

A plan, not built; its seven open calls were decided by the owner on 27.10 (section 7, DECISIONS 2026-10-27). It turns `kit:gen` on the free `kaggle` route (DRAWERS.md) from a tool run by hand, wave by wave, into a line that draws the rest of the 64 px game in bulk, keeps every draft, and records the owner's pick as an action that lands the sprite in the kit. It reuses what exists: the pipeline of `tools/src/kit/gen.ts` (spec -> kernel run -> importer -> manifest -> gallery), the routes of `tools/src/kit/drawers.ts`, the picks manifest `tools/kit-gen/rich-wave.manifest.jsonl`, the pick loop of PR #368, the inventory of PR #328 (`docs/art/PRE_RICH_REDRAW.md`) and the reuse procedure of [REUSE.md](REUSE.md). Nothing here is a new direction: the look is the rich wave's (DECISIONS 2026-10-23), and where an entry's look is still a direction (a tree, the forest mass, a ground), the line draws its stills and the owner's pick goes into DECISIONS as before.

**Out of scope: the cast.** Characters are made industrially (DECISIONS 2026-10-25: a 3D model, library motion, a Blender render snapped to the palette, `pnpm anim render` and `pnpm anim check`). The line never draws a character; it only tracks the cast's kit ids so one report covers the whole game.

## 0. What already started, branch by branch

Read 27.10, read-only, from the main checkout. "Own" counts the branch's own commits, not merges of develop; a squash-merged branch still shows its own commits and is marked merged.

| Branch | Worktree | What it built or set out to build | Own commits | Last | State | What the line takes |
|---|---|---|---|---|---|---|
| `feat/kit-pick-loop` | kit-pick-loop | `kit:gen --picks`: a picked entry is drawn again from its seed and recipe; `kit:notes`, the rule of two | 1 | 27.10 | open PR #368 | the pick feeds the next round as built; waves 1 and 5 build on it |
| `docs/pre-rich-inventory` | docs-pre-rich-inventory | `PRE_RICH_REDRAW.md`, the ranked list of what still needs a 64 px picture | 1 | 27.10 | open PR #328 | the seed list of every pool (section 1). It continues `docs/pre-rich-art`, which only wrote the decision |
| `docs/pre-rich-art` | docs-pre-rich-art | the 25.10 decisions: pre-rich art is redrawn, creatures wait | 3 | 25.10 | merged (#323) | the rule; superseded as a working branch by #328 |
| `art/rich-opening-ground` | codex-rich-opening | a connected world study (water, shore, ground materials, trees around the owner-preferred original oak), `tools/src/art` family check (`docs/art/families/*.json`: anchor, hashes, review states, aspect and edge-density warnings), ART_FAMILIES.md, WORLD_STUDY_ALIGNMENT.md | 20 | 27.10 | local only, clean, another agent's | the oak anchor for the trees pool; the family check as a warning on the gallery card once that branch lands on its own (decided 27.10, section 5); its sand and paving drafts enter the draft store as found, never redrawn. Its own audit says the study is a material lab, not an approved scene |
| `docs/art-reuse-procedure` | docs-art-reuse-procedure | REUSE.md: search before making, keep every distinct draft, review states `unreviewed / keep / reuse-parts / rework / archive`, who decided | 1 | 26.10 | merged (#361) | the review vocabulary of the pick (section 4) and the rule that `.scratch` is not an archive (section 3) |
| `feat/kaggle-models` | kaggle-models | the `flux` and `qwen` recipes and the grid post-process in the kernel | 1 | 23.10 | merged (#299) | the recipes the line runs |
| `art/models-picks` | art-models-picks | the models review: nine picks, the `wrong-draws/` library | 5 | 25.10 | merged (#304) | the wrong-draw rule; the library becomes a view of the store |
| `art/props-wave-1` | art-props-wave-1 | `props-wave-1.json` (50 core props, ramps per material), `props-styles-1.json` (three lanterns, three statues), `LOCAL_SEED` | 3 | 24.10 | merged (#285) | the props pool's `what`, `detail` and `ramps` start from these specs; the six style stills are kept entries |
| `feat/rich-rule` | rich-rule | the check refuses new 16 px art; `rich.ts`, the list of 145 names waiting | 2 | 26.10 | merged (#295) | `SIXTEEN_PX_LEFT` is one input of the status |
| `fix/rich-holes` | fix-rich-holes | the importer keeps the drawing inside its outline | 2 | 24.10 | merged (#301) | the importer as is |
| `feat/ink-outline` | feat-ink-outline | `kit:ink` and the ink-edge check | 2 | 26.10 | merged (#309) | the ink pass runs on every import |
| `feat/art-ground-64` | feat-art-ground-64 | the first scatter-route ground at 64: 32 tiles, 3 props, kit.json, tests, all uncommitted (44 dirty files on a base of 19.10) | 0 | 19.10 | dirty, superseded | superseded by the ground study and the ground pool; its 32 tiles are drafts to keep: copied into the store with provenance "uncommitted, 19.10", never committed as they are |
| `art/tiles-64` | art-tiles-64 | the branch of the queued tiles-64 job of the runner outside the repo | 0 | 23.10 | merged base, nothing of its own | the runner's job/running/done/logs shape is prior art for wave 4 |
| `art/campfire-unlit` | art-campfire-unlit | the old 16 px unlit campfire saved beside the new one | 0 | 23.10 | dirty (1 untracked PNG) | one draft for the store |
| `art/redraw-prep` | art-redraw-prep | nothing of its own | 0 | 18.10 | merged base | nothing |
| `docs/art-ladder` | docs-art-ladder | the village-green ground and stepping-stone recipes for the ladder of stills | 4 | 21.10 | PR #240 closed | nothing built on; its stills are drafts for the store |
| `wip/deepseek-art` | wip-deepseek-art | shoreline and water studies, the 64 density test | 1 | 20.10 | pushed, no PR | its frames are drafts; its DECISIONS rewrite is not taken (it deletes lines) |
| `docs/scale-camera-props` | docs-scale-camera-props | the camera comes closer; tall props grow to the STYLE 1b table | 2 | 26.10 | merged (#344) | the asked sizes of the tall props |
| `docs/human-city-keyart` | docs-human-city-keyart | a world-geography page and a DECISIONS edit, uncommitted | 0 | 24.10 | dirty (2) | nothing: not art for the kit |
| `demo/cutout-cast`, `feat/anim-library`, `tools/anim-cast-50` | demo-cutout, - | the cut-out cast demo; library motion to pixels; the cast at 50 degrees | 4, -, - | 25.10 | open PR #336 (do not merge); merged (#343, #351) | the cast pool's source; nothing drawn here |

Two overlaps settled: the ground continues from the study on `art/rich-opening-ground` and the scatter route on develop, not from `feat/art-ground-64` (older, never committed, on a base of 19.10); the inventory is #328, not `docs/pre-rich-art`.

## 1. The pools

One master spec per pool, `tools/kit-gen/pools/<pool>.json`, in the `GenEntry` shape `kit:gen` already reads, plus four fields: `kit_id` (the sprite it becomes), `rank` (its row in #328), `blocked_by` (an open owner pick, by its DECISIONS title or #328's "Open for the owner" number) and `anchor` (an approved sprite the draws are compared to, such as the original oak). A wave spec is cut from a pool; nobody writes wave specs by hand.

| Pool | Seed list (#328 rows) | Asked size (STYLE 1b) | Route |
|---|---|---|---|
| ground | rows 2, 4, 5, 6, 7, 13, 22, 27: 37 tiles, of which 12 edges wait on open call 3 of #328 | 64x64 fill tiles and motifs | scatter and grid stay with Codex text routes; bridge, broken bridge, cobble and water by image on the GPU (NEXT 15) |
| trees | rows 7, 11: oak (3 variants), young tree, dead tree, canopy 1-3 | 192x320, 128x192, 192x256, 192x192 | GPU; oak with `anchor` from the family on `art/rich-opening-ground` |
| props | rows 8-10, 12, 14, 15, 22-24, 28, 29: tall grass, flowers, gather nodes, the standing stone, the lit campfire, the town set (one entry per regional style, decision 8 of 22.10), mushrooms, fog, the ruin set and statues, the wolf prop | the 1b row of each; up to 384x384 | GPU; large or thin ones that the free recipes misread go to Codex after the third round |
| items | the 19 rich items as picked; new items as they are designed (the eight borrowed outfit icons belong to the race wave) | 64x64 | GPU |
| cast | rows 1, 20: the 49 frames in use; the 25 unused ones are `retired` | 64x96, 128x128 | the industrial route; tracked only |

Every entry carries its `what`, `detail` (the sentence that draws it) and `ramps` (at most four shared ramps, from the place card of [PLACE_LOOK.md](PLACE_LOOK.md) where the entry belongs to a place). The pool is hand-edited; its **status is never written by hand**. `tools/src/art/status.ts` derives it from files:

- **missing**: no draft of the entry in the drafts index (section 3).
- **drafted**: at least one draft, no pick.
- **picked**: a picks manifest line names one of its drafts, and the kit does not yet hold it.
- **imported**: `content/kit/core/kit.json` holds `kit_id` at density 4 at the asked size, its `source.manifest` citing that pick line.
- **retired**: the entry says `retired` with the DECISIONS title that retired it (the 25 unused character frames; the edges if the engine masks win).

`pnpm art:status` prints, by pool: the counts by status, the blocked entries and what blocks them, the next wave it would cut (size, recipe, entries), the GPU minutes spent this week against the budget and the floor (section 2), the queue (waiting, running, paused and why), and the errors of the last run. `--json` for a tool. It reads; it writes nothing.

## 2. Mass production

- **A wave is cut by the runner.** `pnpm art:wave <pool> [--size N] [--dry]` takes entries in rank order: missing first, then drafted entries the owner asked to draw again (section 4); entries with `blocked_by` get one round of stills and no more until the block lifts. It groups them by recipe, since a kernel loads one model, and writes one job per kernel run. On the free route every entry goes up on both `qwen` and `flux` (DECISIONS 2026-10-23, side by side): `qwen` one seed, `flux` two (it varies more between seeds), three cards an entry, the best of three of 23.10.
- **The runner is in the repo.** `pnpm art:run` works a queue under `.scratch/art-queue/` (`jobs`, `running`, `done`, `logs`, the shape of the runner that ran outside the repo), one kernel at a time by default (Kaggle allows two; the second needs its own `KAGGLE_KERNEL`). A job is a cut wave spec and its command line; the drafts it makes go to the index, the job's log to `done`.
- **Size.** The 27.10 proof run: 6 pictures on `qwen` in one kernel run of 903 s (190 s loading, 104 s encoding the prompts, 92-194 s a picture). A wave of N costs about 5 + 1.8 N GPU minutes on `qwen` and 6 + 0.4 N on `flux`. N is 12 (decided 27.10): under 30 minutes a kernel, so a failed run loses little, and the loading stays under a fifth.
- **The budget.** Kaggle gives 30 GPU hours a week. The line spends at most **20 hours a week** and keeps a **6-hour floor** for re-draws, with 4 hours spare for other GPU work (decided 27.10); it stops when the next kernel would cut into the floor. The meter is the drafts index: the sum of each kernel run's own GPU seconds since the weekly reset, not the per-picture shares. At this rate the whole list is not the limit: the 55 trees and props of NEXT 15 at three cards an entry cost about 3 to 4 GPU hours. The limit is the owner's eye, so a wave is sized to what he reviews at one sitting.
- **Retries.** A kernel that fails (an error, a timeout, a black picture) is re-run once, same job, same seeds; a second failure stops the queue and shows in `art:status`. An entry the owner sends back gets a new round: the pick-loop's seed plus one new seed, with `kit:notes` folding a warning seen twice into its prompt (PR #368). After three rounds with no pick on the free recipes the entry goes to Codex with two picked sprites as `style_refs` (the 23.10 lesson), inside Codex's own cap.
- **Kaggle down.** When `kaggle kernels status` fails, the account is out of hours, or the GPU is refused, the queue pauses with its reason and waits. It never falls back to a local CPU or to another route on its own; a route change is a job someone writes.
- **Defect 1: the glow.** `qwen` drew a non-magenta glow behind `house_small` and the importer kept it as a patch. Two fixes: `glow, vignette, gradient background, light halo, spotlight` join `KAGGLE_NEGATIVE` and the sentence prompt says "an even flat background"; and the post-process gains a clean-up that, after the magenta key, clears every pixel joined to the border that lies outside the subject's outer ink ring, so it can never eat the subject (the wider key of 23.10 ate FLUX's earth). A border-joined patch that survives is a gallery warning with its pixel count. Proof: `house_small` drawn again keeps no background patch.
- **Defect 2: the canvas.** `kaggleCanvas` takes its shape from the old 16 px sprite, so an oak asked at 192x320 was drawn on 1024x1024 and came back 180x170. The asked size alone sets the canvas (decided 27.10); the old sprite only names the object and is no shape hint: the long side at `KAGGLE_MAX_SIDE` (default 1536, measured on a T4 at the first tall wave), the short side by the ratio, both multiples of 64. A result whose drawn box is off the asked ratio by more than a tenth is a gallery error ("drawn squat: 180x170 for 192x320"). The importer's "coarser grid" warning on `qwen` and `flux` is a known false alarm (DRAWERS.md) and is measured on the long side only.

## 3. Drafts are kept

Every draw is kept and never deleted (DECISIONS 2026-10-23; REUSE.md): the raw PNG, the grid-snapped raw (`<name>.full.png` and the fit), the imported PNG, and its line. A draft's id is the first 16 hex of the SHA-256 of its raw PNG; identical bytes are one draft with every source kept.

**The index is in the repo**: `tools/kit-gen/drafts.jsonl`, append-only, one line a draft: id, pool, name, spec, round, route, recipe and model version, seed, denoise, canvas, asked size, prompt, negative, warnings, errors, the kernel run's id and GPU seconds, the three files' hashes and where they are stored, the REUSE review state (`unreviewed` on arrival) and `looks_like` once someone writes it. About 1.5 KB a line, so a thousand drafts are 1.5 MB. `kit:gen` appends the line as it imports; the existing `.scratch/kit-gen/<spec>/manifest.jsonl` stays the run's own log. Wave 3 backfills the drafts already made: the 27.10 proof run, the rounds of the rich wave still on disk, the 32 uncommitted tiles of `feat/art-ground-64`, the study drafts of the branches in section 0, and `wrong-draws/`, whose `library.jsonl` becomes a view of the index (entries with `looks_like`) and gains no more PNGs.

**The files are too big for the repo** (about 1 MB a raw picture, hundreds of them; the repo is public and its pack is already 223 MB). Three places:

- **(a) Git LFS in this repo.**
  - For: one repo, files beside the index, `git checkout` brings them.
  - Against: the account's LFS storage and bandwidth quota is spent by every clone and CI checkout that fetches them; every contributor needs LFS.
  - Against: an LFS object cannot be removed without rewriting history, which fits "never deleted" but not a mistake.
- **(b) A separate `GAME-art-drafts` repo, one release per kernel run.**
  - For: release assets have no total quota, each file up to 2 GB; this repo's clone does not grow.
  - For: `gh release download <run>` fetches one wave; the index cites tag, asset and hash, so a draft is found from here.
  - Against: a second repo to keep, and an upload step in the runner (it already has the `gh` CLI); its visibility is the owner's.
- **(c) A drafts folder outside git, with the committed index.**
  - For: nothing to set up, no quota, the index still cites every file by hash.
  - Against: one machine's disk holds the only copy: a lost disk loses every draft, which breaks "never deleted".
  - Against: another session, machine or CI sees the index but not the pictures; REUSE.md already says scratch is not an archive.

**Decided 27.10: (b)**, a separate drafts repo with a release per kernel run, with the index of (c) in this repo and a local cache `.scratch/art-drafts/<id>.png` that the gallery reads and `pnpm art:drafts fetch` fills. The picks manifest stays the record of picks and stays append-only.

## 4. The pick as an action

- **The gallery is the pick surface.** `pnpm art:gallery <pool|wave>` writes a static page that shows every draft of each entry across all rounds (not the latest only, REUSE.md), next to the kit sprite, the anchor if any and the asked size at phone scale, with each draft's recipe, seed, round, GPU seconds, warnings and errors. Each card has three buttons: **pick**, **again** (with an optional note for the next prompt) and **wrong object** (with what it looks like). The page holds no server: its button writes a `picks-<date>.json` the browser downloads, the recorded act of the picker. This is the pick surface (decided 27.10); the single-pick command exists for a builder's dry run and a fix, not as the owner's surface.
- **`pnpm art:pick --from picks-<date>.json`**, or one at a time `pnpm art:pick <pool> <name> <draft-id>`, applies it. For a pick: the draft's imported PNG goes to `content/kit/core/<kit_id>.png`, its kit.json entry gets `w`, `h`, `density: 4`, `ramps` and `source` (the pool spec and the picks line), its name leaves `SIXTEEN_PX_LEFT`, and one line is appended to the picks manifest with the fields it has today plus `draft`, `pool` and `picked_by`. For **again**: the draft's review state becomes `rework` with the note, and the entry joins the next wave. For **wrong object**: `archive` with `looks_like`, kept for another role. Review states are REUSE.md's.
- **One pull request per wave of picks.** `pnpm art:pr <picks file>` opens it from a fresh branch off develop, with the body's `Source:` line (the drafts' route and recipe), the `Tree:` line and a phone still of the wave (NEXT 15). The session that made it merges it after the owner's approval (PARALLEL.md).
- **Who picks.** The owner, and whom he names in `tools/kit-gen/pickers.json` (decided 27.10). `art:pick` refuses a `picked_by` not in that file. A builder never picks: an agent's opinion is `suggestedBy`, never a pick.
- **Picks feed the next round** through PR #368 as built: the picked seed and recipe draw again; repeated warnings become notes.

## 5. Checks

`pnpm check` gains, all from files:

- a picked or imported entry's PNG exists, at its pool's asked size, at density 4, with its ramps named;
- every pool entry's `kit_id` exists in the kit, or the entry says `new` (a regional variant the kit gains on pick); a typo fails;
- no draft is picked twice, and every picks line with a `draft` resolves in the drafts index with matching hashes;
- every kit `source.manifest` points at a picks line of the same sprite;
- CI: `drafts.jsonl` and the picks manifest only grow (develop's file is a prefix of the branch's).
- once `art/rich-opening-ground` lands on its own, the family check of `tools/src/art` runs on every draft of an entry with an `anchor`: its aspect and edge-density deviation is a warning on the gallery card, never a block on a pick (decided 27.10).

The gallery hides nothing: a failed kernel, a black picture, a prompt past the window, a squat drawing, a kept background patch and a wrong colour are each a red card in place of the picture, counted in the page's header and in `art:status`. A filter may sort them first, never out.

## 6. Build order

Each wave is one pull request, one proving command, no design judgment inside. Waves 1 and 2 can start today: wave 1 on PR #368's branch (it changes the same functions of `drawers.ts`; its PR targets develop and lands after #368), wave 2 from develop.

| Wave | Builds | Needs | Proving command |
|---|---|---|---|
| 1 | the two defects: canvas from the asked size with `KAGGLE_MAX_SIDE`, the glow words in the negative, the border clean-up outside the ink ring, the squat and patch warnings; tests with no network | #368 | `pnpm kit:gen <the six of 27.10> --drawer kaggle --dry` prints a 896x1536 canvas for the oak; one real run of `house_small` and `tree_oak` |
| 2 | the five pool specs seeded from #328 and STYLE 1b, `status.ts`, `pnpm art:status` (GPU minutes read 0 until wave 3) | develop; #328 merged or cited by branch | `pnpm art:status` counts match #328's table (37 tiles, 34 props, 74 frames) |
| 3 | `drafts.jsonl`, draft ids, `kit:gen` appending to it, the drafts repo with a release per kernel run, `art:drafts fetch` and `verify`, the backfill of section 3 | wave 2 | `pnpm art:drafts verify` re-hashes every backfilled draft, exit 0 |
| 4 | `art:wave` and `art:run`: the queue, recipe grouping, budget and floor, retries, the pause | waves 1-3 | `pnpm art:wave props --size 12 --dry`, then one real wave |
| 5 | the gallery of every draft with the three buttons, `art:pick` (single and `--from`), `pickers.json`, the wrong-draws view | wave 3 | `pnpm art:pick props well_old <id> --dry` prints the kit.json, PNG and manifest changes |
| 6 | the checks of section 5, the append-only CI step, `art:pr`; the family check of `art/rich-opening-ground` as a card warning | wave 5; the family check waits for that branch to land | `pnpm check` red on a test fixture of each rule, green on develop |

## 7. The calls the owner decided

The owner answered all seven on 27.10, each with the default the plan recommended; each is a DECISIONS entry of 2026-10-27. The options stay as the record of what was weighed.

1. **Where the drafts live.** Decided 2026-10-27: (b). (a) Git LFS here - one repo, a quota every clone spends. (b) **A separate drafts repo with a release per kernel run** (chosen) - no quota, one more repo to keep. (c) A folder outside git with the index here - free, but one disk holds the only copy.
2. **Who picks.** Decided 2026-10-27: (a). (a) **The owner, and whom he names in `pickers.json`** (chosen) - the pace is not his alone, the record says who. (b) The owner only - every sprite waits for his sitting. (c) The manager session picks polish, the owner picks direction - fastest, but a builder's eye then lands art.
3. **Weekly GPU budget for the line.** Decided 2026-10-27: (a). (a) **20 of Kaggle's 30 hours, a 6-hour floor, 4 spare** (chosen) - the line can never starve a re-draw or a trial. (b) 12 hours - leaves half for other GPU work, slows nothing at today's rate. (c) 26 hours - fastest drafts, no room for an urgent trial.
4. **Wave size.** Decided 2026-10-27: (b). (a) 6 entries - short reviews, more of each run spent loading. (b) **12 entries** (chosen) - under 30 GPU minutes a kernel, one sitting of about 36 cards. (c) 24 - fewest loads, a review of 72 cards and a long run to lose on failure.
5. **The pick surface.** Decided 2026-10-27: (a). (a) **The gallery's buttons writing a picks file, applied by `art:pick --from`** (chosen) - the owner clicks, the file is the record. (b) The command per pick - simplest to build, but someone types for him. (c) A small local server that writes the pick at the click - no download step, a server to keep running.
6. **The old 16 px sprite as a shape hint.** Decided 2026-10-27: (a). (a) **The asked size alone sets the canvas** (chosen) - the oak is drawn tall as STYLE 1b asks; the old sprite only names the object. (b) The old sprite's shape, stretched to the asked ratio - keeps today's silhouettes, which the tall props are leaving. (c) Asked size, with the old sprite as a low-denoise reference for small props only - a second path to tune.
7. **The family check of `art/rich-opening-ground`.** Decided 2026-10-27: (a). (a) **Adopt it after it lands on its own: an anchor's aspect and edge-density warning on the gallery card** (chosen) - one check of likeness, not two. (b) Keep the line's checks only - the family stays a study tool. (c) Make a family warning block a pick - stricter, but its thresholds are tested on one oak.
