# Contributing

Welcome. Loomvale is built by the people who play it, and a first contribution is worth more than a perfect one: reviewers help you get it over the line. There are two ways to help: add something to the valley (content), or improve the game itself (code). Most people start with content. Where the game is going, and where help is most welcome now, is in [ROADMAP.md](ROADMAP.md).

## Adding content

1. Follow [Add a fruit in 10 minutes](docs/creators/README.md). It walks through a whole extension, from copying the template to opening a pull request.
2. Your files live in `content/extensions/<your-handle>/`, and art in `content/kit/<your-handle>/`. Ids start with your handle.
3. Run `pnpm check` until it reports no errors. CI runs the same check on every pull request and shows its report on the run's summary page.
4. Open a pull request against **`develop`**, not `main`. `main` is the default branch because it holds releases (a release is `develop` merged into `main`), so GitHub offers it first: change the base. CI refuses any other base, and a pull request aimed at `main` is asked to retarget. Fill in the author checklist from the template.
5. The first time, a bot asks you to sign the [contributor agreement](CLA.md) by posting one comment. You keep the copyright on what you make; the agreement lets the project publish it and move it to another licence later. It takes a minute and holds for every later pull request.

### How a pull request is merged

- The check is green, and the opening still plays in Chrome (CI does this too).
- Quests, camps, inscriptions and dialogue follow [the rules of play](docs/design/GAME_RULES.md): `pnpm check` prints a `!` line for each rule it can test, and a reviewer answers the checklist in its section 7.
- Reviewers approve, each going through the reviewer checklist in the pull request. Until five creators have had an extension merged, one approval is enough and the owner gives it; from then on, three reviewers approve.
- One extension per slot. When two proposals compete for the same request or slot, both stay open until the vote on the request decides.

### Requests and open calls

Anyone can ask for something with the "Request for the valley" issue form. Others vote with a 👍 on the first post. A request with enough votes is labelled **open call**: an invitation to every creator to build it.

## Changing the game

If you are joining the core team, read [How the team works](docs/team/WORKFLOW.md) first: branches, worktrees, who owns what and how a release happens.

- `kernel/` is the simulation. It must stay pure: no clocks, timers, randomness, floats or I/O. ESLint enforces this, and `kernel/test/invariants.test.ts` replays thousands of random actions to check it.
- A change to any value anchor (`content/values.lock.json`) is a core maintainer decision: run `pnpm values` and say why in the pull request.
- Write down a design choice, or an approach that did not work, in [DECISIONS.md](DECISIONS.md).
- A change to play that collides with a rule in [docs/design/GAME_RULES.md](docs/design/GAME_RULES.md) goes to the owner before code is written (its section 6).
- Keep the owner's machine out of the tree: no home-directory paths, no private tool names, no personal addresses. `pnpm verify` fails on them (`tools/src/private-strings.ts`).
- Before a pull request: `pnpm verify`; CI plays the opening e2e on the pull request (not on a docs-only one; run `pnpm e2e` locally, under the lock, only to debug a red run).

## The name

"Made for" the game is welcome on extensions, fan sites, videos and streams. A different game or a fork may not use the name or the logo: [TRADEMARKS.md](TRADEMARKS.md) says where the line is.

## Conduct

Be kind, assume good intent, and keep the valley's words fit for every age and its menace within its limit ([GAME_RULES.md](docs/design/GAME_RULES.md) G22 and G46). Reviewers may close anything that is not.
