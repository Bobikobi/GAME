# Working in parallel

Several sessions build the game at the same time, in different apps and on different
machines. Three things keep that from turning into collisions, and none of them is a status
page somebody has to remember to edit, because such a page is stale at the next merge:

| What | Where | Changes |
|---|---|---|
| The rules | this page, pointed to from `AGENTS.md` | when a collision teaches something |
| The stream map | `docs/team/streams.json` | only when a stream starts, ends or changes hands |
| The live picture | `pnpm streams`, printed on demand, never committed | recomputed every time |

A fresh session can rebuild all of it from the repository and GitHub. Nothing lives only in
one session's memory.

## The live picture

```bash
pnpm streams            # fetches, then reads origin/develop, the branches and GitHub
pnpm streams --json     # the same, for a tool
pnpm streams --local    # read streams.json from this checkout (while you are editing it)
```

It lists, per stream: the pull request, its CI, how far the branch is behind `develop`, what
is stacked on what, and the files two streams both change, sorted by who settles them:
**hand** (a person), **generated** (rerun a command), **append** (both sides are kept). It
ends with a proposed merge order. It only reads: no worktree is opened and no branch is
touched, the one write is `git fetch`. It cannot see uncommitted work, or a session in another
app until that session pushes.

Run it when you start, and before you open a pull request.

## Streams

A stream is one unit of work, often several branches: what it advances in the original plan
(`docs/spec/product-spec-v4.6.html` section 9 and 16, a GRUNT item, a decision), its
branches, and the session that holds it. Starting a stream means adding its line to
`streams.json` in a small `docs/` pull request. The owner column stays `null` until the
owner names the session; nobody guesses it. A branch that is ahead of `develop` and listed in
no stream shows up as a stray in the picture.

## Shared files

Five or six streams change the same few files. A change there is small, additive and lands on
its own first, so the others merge it once instead of discovering it in a conflict.

| File | What to do |
|---|---|
| `schema/src/index.ts` | Add an optional field; do not reshape one. A reshaping is cross-cutting (below). |
| `schema/json/*`, `content/values.lock.json`, `CREDITS.md`, `content/board.json` | Generated. Never merged by hand: take `develop`'s and rerun `pnpm schemas`, `pnpm values`, `pnpm credits`, `pnpm board --base origin/develop`. CI refuses a board that is not what the merged history gives. |
| `kernel/src/step.ts`, `kernel/src/state.ts` | A new verb or field comes with its test in a pull request that does only that. |
| `tools/src/assemble.ts` | Same: the check or the bundle step first, content that needs it after. |
| `DECISIONS.md` | Append at the end only. `.gitattributes` merges both sides (see below). |
| `game/src/ui/ui.ts`, `panels.ts`, `text.ts`, `game/test/text.test.ts` | Keep the change to the lines you need; renaming a string means grepping every test for it first (`AGENTS.md`). |

Cross-cutting means everyone builds on it: a rename, a reshaped schema type, a moved folder.
It goes first, in a quiet window the owner calls, and then every stream merges `develop`
once. Mark its stream `"cross_cutting": true` in `streams.json` so the order puts it first.

## Merge order

`pnpm streams` only proposes. The session that made a pull request merges it into `develop` once the owner has approved it (the owner's rule of 23.10). A release to the public, `develop` into `main`, stays the owner's alone. The proposal follows four rules:

1. A cross-cutting stream first.
2. A branch that others are built on goes before them: it frees their pull requests.
3. Then the stream that collides with fewer others, because it asks nothing of them.
4. Then the lower pull request number.

Drafts, a failing CI and a branch with no pull request stay out of the order, each with the
reason. After every merge, the stream that is next merges `develop`, reruns the generators
and `pnpm verify` before its own pull request lands.

## Stacked branches

`AGENTS.md` says a pull request is never stacked on another branch: it would land there and
not in `develop`. A branch may still be *built on* an open branch of the same stream, as long as
its pull request targets `develop` and goes in after the base. When the base is squash-merged:

```bash
git fetch origin
git merge origin/develop     # not rebase, no force push
```

The squashed base brings the same changes the branch already holds, and identical changes
merge clean (checked on a scratch repository, 10.10). The pull request's diff then shrinks
to the branch's own work. A branch with no pull request that sits inside another branch has
no work of its own yet; the picture says so, and the work goes on in the branch that holds it.

## Conflict recipe

```bash
git fetch origin && git merge origin/develop
# generated files only, and only those in conflict: develop's version, then regenerate
git checkout --theirs schema/json content/values.lock.json
pnpm schemas && pnpm values && pnpm credits && pnpm board --base origin/develop
git add schema/json content/values.lock.json CREDITS.md content/board.json
# everything else: resolve by hand, then
pnpm verify
```

`DECISIONS.md` has `merge=union` in `.gitattributes`: both sides' entries are kept. Two
caveats: the blank line between two entries can be lost, which does not matter because the
headings still start a line; and GitHub's own merge button ignores the setting, so merge
`origin/develop` into your branch on your machine before the pull request lands.

## The integrator

The owner does not run between sessions to line them up; one session does that. It starts in
the main checkout, which belongs to the lead and which it does not edit:

```bash
claude --model opus --effort high      # then: /integrator
```

Opus at high effort because the work crosses every stream and decides order; the skill is
`.claude/skills/integrator/SKILL.md`. It runs `pnpm streams`, says where things stand,
proposes the order, and writes for each session the exact instruction to line up ("merge
develop, rerun the generators, run the opening e2e"). To reach the sessions on the same
machine it uses `ListAgents` and `SendMessage`; the sessions in another app can only be
reached through the repository, so for them the owner pastes the instruction, and the rules
on this page are what they read first.

It never edits, merges, rebases, pushes or deletes in another session's branch or worktree. It
proposes the order; the session that made each pull request merges it, after the owner's
approval, and never a pull request that is another session's. The integrator merges nothing.

A session that started before this page landed has the old `AGENTS.md` and no `pnpm streams`:
once the pull request is merged, it merges `origin/develop` and is told once to
`Read docs/team/PARALLEL.md, then run pnpm streams`. The stream map the command reads always
comes from `origin/develop`, so a stale checkout still sees the current map.
