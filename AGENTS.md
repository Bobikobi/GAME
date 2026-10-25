# AI contributor guide

Read [docs/creators/README.md](docs/creators/README.md) before changing content. It documents the file layout, schemas, creator profiles, art rules and contribution flow.

- Keep simulation rules pure and integer-only in `kernel/`; put world content in declarative JSON under `content/`.
- Give extension files and ids the creator's lowercase handle prefix, use existing schemas and templates, and never hardcode item prices.
- Do not edit generated bundles, schemas, credits, values or the creators board by hand.
- Run `pnpm check` while creating content. Run `pnpm verify` before handing work back.
- Read [docs/design/GAME_RULES.md](docs/design/GAME_RULES.md) before touching quests, camps, map props, NPC lines, rewards, timing or the opening. A request that breaks a rule is not built and not bent: it goes to the owner first (section 6 there), and `pnpm check` prints a `!` line for each rule it can test.

## How work moves

Learned on the first three days of building, each line from a real cost.

- Every branch starts from `origin/develop` and every pull request targets `develop`; a release is `develop` into `main`. Never stack a pull request on another branch: it lands there, not in `develop`, and CI refuses a different base.
- Several sessions build at once. Read [docs/team/PARALLEL.md](docs/team/PARALLEL.md) before you start and run `pnpm streams` to see the other streams; generated files (`schema/json`, `content/values.lock.json`, `CREDITS.md`, `content/board.json`) are taken from `develop` and regenerated, never merged by hand, and a change to a shared file lands as its own small pull request first.
- Before taking GRUNT item P-n, check that P-(n-1) is closed on `develop`. The P items build on each other.
- A prop, tile or object built from a picture outside the game follows [docs/art/PROP_FROM_REF.md](docs/art/PROP_FROM_REF.md): the object is named by looking and confirmed, the palette decision comes before the first image call, nobody draws pixels by code, the gallery is judged by eye. `kit:gen` refuses an outside reference that skips the first two. The route that draws the picture is `--drawer` ([docs/art/DRAWERS.md](docs/art/DRAWERS.md)); a key lives in the shell, never in the repo, and a third-party reference never goes down a free tier.
- A direction is what changes the product visibly everywhere: the art style, the engine, the camera, the look of a character, the frame of the UI. A trial of a direction starts with two or three still images at phone size for the owner, each testing one named difference, before any e2e run, video, board or pull request. The owner picks one; the pick is recorded in `DECISIONS.md` with its frame and becomes the compass the polish loop follows without asking again. A detail inside an agreed direction (a texture, a flame, a shadow, a seam) is polish: iterate, do not ask. The builder does not judge direction; the owner does.
- Before a proving run, grep the tests for every string the change renamed or rewrote and fix all the expectations in one pass. Then run the single test file, then `pnpm verify`, and push: CI runs the opening e2e on the pull request. Run `pnpm e2e` on your machine only to debug a red run.
- CI retries the opening e2e once and keeps the screenshots of the failed attempt (issue #25). When CI flakes, rerun the job.
- Fetching assets from a provider: read its index or API first, check the size before downloading, and keep a cap per model. Raw photoscans run to hundreds of megabytes and a browser cannot carry them.
- One game, two doors: every rule, idea and development decided for the game holds in the classic game and in the 3D game at `/play3d/` alike, unless it is truly 2D (pixels, a sprite sheet). The builder carries it across in the other door's own means, or raises the problem to the owner; it is never dropped quietly. The pixel game gets the effort first and the 3D game follows: a 3D twin never holds back or takes builders from the pixel game's work (DECISIONS 2026-10-18, NEXT 8 e).
- One session is the manager. A building session sends every dilemma, owner question and blocker to the manager, which decides it or relays it to the owner; it does not ask the owner directly.
- Every tool runs at its stage. Each line is taken from the tool's own header or doc; a tool not listed here has no fixed stage.

| Tool | Stage: when it runs |
|---|---|
| `pnpm streams` | CI runs it on every pull request and writes it to the run summary (it informs, never fails). Run it yourself before you start, with [docs/team/PARALLEL.md](docs/team/PARALLEL.md): it shows the other streams and who touches the same files. Reads refs and GitHub only. |
| integrator skill (`.claude/skills/integrator`) | When the merge order, a collision between branches or the state of the streams is in question, or when the session's job is integration. |
| quest-designer skill (`.claude/skills/quest-designer`) | Any new or changed quest, and a review of the quests in a pull request. It proposes pitches, the owner picks. CI refuses a pull request that changes a quest file unless its body has a line `Quest review: <the skill's verdict>`. |
| story-keeper skill (`.claude/skills/story-keeper`) | From the first pitch of any quest (the quest-designer calls it on every pitch and on the built file), and on any change to text a player reads as the story: NPC lines, waking lines, the stone, finds, races, the story pages. Every finding that needs an answer goes to the manager; a fix that adds a fact waits for the answer. CI refuses a pull request that changes such a file unless its body has a line `Story review: <the skill's verdict>`. |
| `pnpm quests` | Any change to a quest, a reward or a timing: the hand per wake pocket must gain no new pair of one type. `pnpm check` prints the same breaches as `!` lines. |
| `pnpm check` | While creating content, and inside `pnpm verify`. |
| `pnpm verify` | Before handing work back. No e2e inside it. |
| `pnpm values` | Core maintainers only, when an anchor must move ([CONTRIBUTING.md](CONTRIBUTING.md)). After a merge, take `develop`'s `content/values.lock.json` and regenerate it instead of merging by hand. |
| prop-from-ref skill, `pnpm kit:gen`, `pnpm kit:import` | A sprite, prop or tile from a picture outside the game: follow [docs/art/PROP_FROM_REF.md](docs/art/PROP_FROM_REF.md). `kit:gen` calls the importer itself; run `kit:import` alone to bring a finished picture onto the grid. CI refuses a pull request that adds a picture under `content/kit/` unless its body has a line `Source: <where it came from>`. |
| `pnpm e2e` | Last in a proving run, after `pnpm verify`, one browser at a time; CI runs it on every pull request. |
| `pnpm loop` | The community loop, run by `.github/workflows/loop.yml` (hourly and on pull request events). By hand only with `--dry-run`, and it needs `GITHUB_TOKEN` and `GITHUB_REPOSITORY`. |

- Read [docs/design/STORY.md](docs/design/STORY.md) before writing lore, a line about the past, a new character or an extension's setting. The narrator never states the past, and every claim about it has a speaker (S1-S6 there).
