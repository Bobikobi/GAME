# How the team works

This page is for the people who build the game itself: developers, artists, and the AI agents working beside them. If you want to add a fruit, a quest or a ruin to the valley, you want [CONTRIBUTING.md](../../CONTRIBUTING.md) and the [creator guide](../creators/README.md) instead.

## Branches

| Branch | What it is | Who writes to it |
|---|---|---|
| `main` | Production. Every push deploys the live game. | The lead only, by merging `develop`, with the owner's yes. |
| `develop` | Integration. Its preview is "the latest version". | Reviewed pull requests, merged by the lead. |
| `feat/<topic>`, `fix/<topic>`, `chore/<topic>`, `docs/<topic>` | One task each. | The person or agent doing that task. |

- Start every task from the newest `origin/develop` and open the pull request into `develop`.
- One concern per pull request. A refactor, a feature and a content change are three pull requests.
- Never push to `main` or `develop` directly. Never force-push a branch someone else is reviewing.

## Working in parallel

Several people and agents work at the same time, so each task gets its own folder:

```bash
git fetch origin
git worktree add -b feat/<topic> ../GAME.worktrees/feat-<topic> origin/develop
pnpm -C ../GAME.worktrees/feat-<topic> install --frozen-lockfile
```

- The main checkout belongs to the lead. Do not edit files there.
- Do not use a bare `git stash`: the stash is shared by every worktree. Commit a work-in-progress instead.
- Stage files by name (`git add <path>`), never `git add -A` or `git add .`.
- Check `git branch --show-current` right before you commit.

## Who owns what

Each area has an owner, listed in [.github/CODEOWNERS](../../.github/CODEOWNERS). GitHub asks the owner for review automatically. If your task needs a file in someone else's area, ask them first; if two tasks need the same file, the lead decides the order.

| Area | Paths | Rule |
|---|---|---|
| Simulation | `kernel/` | Pure: integers only, no clocks, timers, randomness or I/O. Every change comes with a test. |
| Content format | `schema/`, `content/core/` | A format change needs a migration or must stay backward compatible with saves. |
| Client | `game/src/` | Player-facing text uses a plain hyphen, never an em dash. |
| Look | `game/src/style.css`, `game/src/scenes/world.ts` | Visual changes start with criteria the owner can see and measure. |
| Tools and CI | `tools/`, `.github/` | CI must stay green on `develop`. |
| Creator docs | `docs/creators/`, `CONTRIBUTING.md` | Written for someone who has never coded. |

## A pull request

Before you open it:

```bash
pnpm verify                # schemas, content check, lint, types, tests, build
pnpm build && pnpm e2e     # plays the opening in Chrome, phone and desktop
```

The description says what changed and why, not a list of files, and how you checked it. CI runs the same checks; the required job is "Check, test, build and play". Vercel posts a preview link; reviewers play that, not the code alone.

The reviewer checks four things:

1. It is correct against the kernel: the client never decides an outcome.
2. Player-facing text is accurate and has no em dashes.
3. Tests come with the change.
4. It does one thing.

Pull requests are merged with squash, so the history of `develop` reads one line per task.

## Releasing

1. `develop` is green, and the owner has played its preview.
2. The lead asks the owner for a yes, then merges `develop` into `main`.
3. Vercel deploys `main`. The lead opens the live game and checks the opening.
4. The release gets a tag, `v0.<stage>.<n>`, and a short note of what players will notice.

To roll back, promote the previous production deployment in Vercel, then revert the merge on `main` with a new pull request.

## Decisions

[DECISIONS.md](../../DECISIONS.md) is the team's memory. Read it before you choose an approach. Add an entry when you make a real design choice, abandon an approach, or find that something reported as working is broken. An abandoned branch gets a tag `attempt/<yyyy-mm>-<topic>` before it is deleted, and the entry points to it.

## Secrets

Nothing secret goes into git, not even in a private repository: no `.env`, keys or tokens. They live with their owner, and the deploy reads them from Vercel's environment settings. If one is committed by mistake, treat it as exposed: rotate it first, then clean up.

## AI agents

Agents follow this page like everyone else. A task handed to an agent names one goal, the exact files it may touch, and the command that proves it worked. The commit says which model did the work, in a `Co-Authored-By` line.
