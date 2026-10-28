# Your first code pull request

This page is for a developer outside the core team: you have your own GitHub account and no write access to `Bobikobi/GAME`. It takes you from nothing to an open pull request that changes the game's code. Adding content (a townsperson, a fruit, a quest) is simpler and has its own guide: [Add a townsperson in 15 minutes](../creators/README.md).

You need no invitation and no access. The repository is public: you fork it, work in your fork, and open a pull request from there.

## Who is who

The docs say "the owner", "the lead" and "a core maintainer". Today all three are one GitHub account, **`Bobikobi`**. It reviews and approves every code pull request, and it merges it into `develop`. Nobody else can merge. When the team grows, [.github/CODEOWNERS](../../.github/CODEOWNERS) will name who owns each folder; today every line names `Bobikobi`.

## Read first, in this order

1. [AGENTS.md](../../AGENTS.md): the short rules every contributor follows, people and AI tools alike.
2. [CONTRIBUTING.md](../../CONTRIBUTING.md): how a pull request is merged, and the rules for changing the game.
3. [WORKFLOW.md](WORKFLOW.md): the core team's page. Read it for the branch names, who owns which folder and what a reviewer checks. Its worktree and merge steps assume write access, so skip those: this page replaces them for you.
4. [GAME_RULES.md](../design/GAME_RULES.md): the rules of play. Read it before you touch quests, camps, map props, lines a character says, rewards, timing or the opening. A change that collides with a rule goes to the owner first (its section 6).
5. [STORY.md](../design/STORY.md): before you write any text about the valley's past or a new character.

## What you need

- Node 24 (the version in `.nvmrc`; with nvm, `nvm install` in the checkout reads it) and pnpm 10 (`npm install -g pnpm@10`).
- Git, and a GitHub account. The [GitHub CLI](https://cli.github.com/) (`gh`) is optional; every step below also works on the GitHub website.

## The steps

1. **Fork.** On GitHub, open [Bobikobi/GAME](https://github.com/Bobikobi/GAME) and press **Fork**. Leave "Copy the main branch only" unticked, so your fork has `develop` too. Or:

   ```bash
   gh repo fork Bobikobi/GAME --clone=false
   ```

2. **Clone your fork and add the main repository as `upstream`.**

   ```bash
   git clone https://github.com/<you>/GAME
   cd GAME
   git remote add upstream https://github.com/Bobikobi/GAME
   git fetch upstream
   ```

3. **Make a branch from `upstream/develop`.** Every branch starts from `develop`, never from `main`. Name it after its kind and its topic: `feat/<topic>` for a feature, `fix/<topic>` for a bug, `docs/<topic>` for docs, `chore/<topic>` for tooling. One task per branch.

   ```bash
   git switch -c feat/<topic> upstream/develop
   ```

4. **Install, exactly as the lockfile says.** `--frozen-lockfile` installs what CI installs and stops instead of changing `pnpm-lock.yaml`; the shorter `pnpm install` in the README works too, but a changed lockfile does not belong in your pull request.

   ```bash
   pnpm install --frozen-lockfile
   pnpm dev            # optional: play your copy in the browser at the address it prints
   ```

5. **Make the change, and check it as you go.** These are fast; run them often:

   ```bash
   pnpm check                          # the content and the rules of play
   pnpm typecheck                      # TypeScript across the repository
   pnpm test <path of each test file you touched or that covers your change>
   ```

   A change to `kernel/` comes with a test. A change to the game's behaviour comes with a test under `game/test/` or the package it touches.

6. **Run the full check before the pull request.** It runs everything CI runs except the browser tests and the database tests, and takes a few minutes:

   ```bash
   pnpm verify
   ```

   It also fails on anything that belongs to one machine or one person: a home-directory path, a private tool's name, a personal address. Write such things in neutral words.

7. **Commit and push to your fork.** Stage files by name, never `git add -A` or `git add .`. Write the commit subject as `feat(<area>): <what changed>` (or `fix`, `docs`, `chore`). If an AI tool did the work, add a `Co-Authored-By:` line naming the model.

   ```bash
   git add <path> <path>
   git commit -m "feat(game): <what changed>"
   git push -u origin feat/<topic>
   ```

8. **Open the pull request against `develop`.** GitHub offers `main` first, because `main` holds the releases: change the base to `develop`. CI refuses any other base.

   ```bash
   gh pr create --repo Bobikobi/GAME --base develop --head <you>:feat/<topic>
   ```

   Fill in the template (see [The pull request template](#the-pull-request-template) below). The description says what changed and why, and how you checked it.

9. **Sign the contributor agreement, once.** On your first pull request a bot comments and asks you to sign [CLA.md](../../CLA.md). Post this one comment, as it is written:

   > I have read the CLA Document and I hereby sign the CLA

   It holds for every later pull request.

10. **Wait for CI.** On a first pull request from a fork, GitHub holds the workflow runs and the preview build until a maintainer approves them; this is GitHub's guard for first-time contributors, not a fault in your pull request. Then CI runs. The required check is **"Check, test, build and play"**: it is green only when `pnpm verify`, the database tests and the browser tests that play the opening in Chrome all pass (a docs-only pull request skips the browser tests). The workflow **"Pull request triggers"** reads the template's tool lines and the `Tree:` line. Vercel posts a preview link of the game with your change.

11. **Review and merge.** GitHub asks `Bobikobi` for review automatically. The owner plays the preview, may ask for changes, approves, and merges with squash, so your pull request becomes one commit on `develop`. To answer a review, push more commits to the same branch. If `develop` moved on, bring it in with a merge, not a rebase, so the review stays readable:

   ```bash
   git fetch upstream
   git merge upstream/develop
   git push
   ```

Your change reaches the live game at the next release, when `develop` is merged into `main`.

## The pull request template

The template was written for content first. For a code pull request:

- **What this adds:** what changed and why, and how you checked it.
- **`Quest review:`, `Story review:`, `Source:`** are owed only when the pull request changes a quest file, text a player reads as story, or adds a picture under `content/kit/`. Otherwise answer each with `n/a - code change`.
- **`Tree:`** is owed by every pull request. It says where the work sits in the skill tree (the schools and nodes in `content/core/schools/`). Use one of three forms: `Tree: <school>/<node ids>` for the nodes it builds or serves, `Tree: extends the tree: <path of the proposal>` for a new branch of the tree, or `Tree: none: <why nothing a player can grow in changes>`. A change to how a skill, a tool or an activity works in play (foraging, digging, cooking and the rest) names the school and the node it serves, for example `Tree: digging/quick-trowel`; the node ids are the `nodes` of that school's file in `content/core/schools/`. A fix to the build, a tool or the docs is usually `none:`, with the reason. If you are not sure, write `none:` and why: the reviewer says if it should name a node. A line in none of the three forms fails the "Pull request triggers" check with a message that names them; edit the body and the check runs again, no push needed.
- **The author checklist:** the line about `content/extensions/<my-handle>/` is for content; answer it `n/a - code change`.

## Ask before you touch these

Open an issue first and wait for the owner's answer before a pull request that:

- **changes the opening e2e** (`game/e2e/opening.ts`) or loosens what it expects. It is the game's main proof that a new player can start.
- **breaks the purity of `kernel/`.** The simulation stays pure: integers only, no clocks, timers, randomness, floats or I/O. ESLint enforces it, and `kernel/test/invariants.test.ts` replays thousands of random actions.
- **changes a value anchor** in `content/values.lock.json`. That is a core maintainer decision: run `pnpm values` and say why in the pull request.
- **edits a generated file by hand.** `schema/json/`, `content/values.lock.json`, `CREDITS.md` and `content/board.json` are written by commands (`pnpm schemas`, `pnpm values`, `pnpm credits`, `pnpm board`), never by hand. If one conflicts, take the `develop` copy and run its command again.
- **collides with a rule** in [GAME_RULES.md](../design/GAME_RULES.md). It goes to the owner before any code (its section 6).

## A design choice owes a DECISIONS.md entry

When your pull request makes a real design choice, abandons an approach, or finds that something reported as working is broken, add an entry at the end of [DECISIONS.md](../../DECISIONS.md) in the same pull request. Earlier entries are history: do not edit them.

```markdown
## YYYY-MM-DD ✅ <the choice, in one line>

What was tried, and the result with its evidence (a number, an output). Why: proven, or a hypothesis.
**Retry when:** what would have to change. Model: <the AI model, if one did the work>. Link: <the pull request>.
```

The status is ✅ chosen, ❌ failed, ⏸ superseded or postponed, or 🔁 worth retrying.
