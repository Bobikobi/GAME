<!-- Explains the GitHub automation that runs Openfold's community loop. -->
# The community loop

The community loop turns supported requests into open calls, checks content proposals against the published merge rule, runs votes when ready proposals compete, and posts a weekly record. It reports whether a proposal is ready, but it never merges one. A maintainer still presses the merge button.

## What runs when

The hourly workflow runs requests, proposals, and votes. A next-discovery vote opens only when a maintainer runs the `discovery` command from the Actions page, so a finished vote is not followed by an identical one an hour later. Proposal evaluation also runs when a pull request opens, changes, becomes ready, gains or loses a label, receives or loses a review, or finishes CI. At 07:07 UTC each Monday it posts the weekly summary. Maintainers can run any command from the Actions page.

The workflow always runs trusted code from the default branch. In particular, `pull_request_target` never checks out or executes code from a pull request. Proposed JSON is fetched through the GitHub contents API and parsed only as data.

`pnpm loop summary` prints a summary. `pnpm loop summary --post` opens the week's summary issue and closes older open summary issues. Every command accepts `--dry-run`, which performs reads and prints intended writes, and `--now <ISO>`, which makes reruns reproducible.

## Labels

- `request`: an open request from the community. Support is the number of 👍 reactions on its first post.
- `open call`: a request that reached the support threshold. This label is never removed.
- `capability`: an open call that needs a change to core code rather than content alone.
- `proposal`: an open, non-draft content pull request.
- `competing`: a proposal that shares a world slot or answered request with another open proposal.
- `vote`: an issue that holds a community vote.
- `vote won`: the proposal selected by its vote. This lifts the competition blocker.
- `vote lost`: a proposal not selected by its vote. It remains in the proposal archive and is not ready to merge.
- `veto`: a maintainer stopped the proposal for one of the closed reasons in `CONTRIBUTING.md`.
- `weekly summary`: the current weekly summary issue.
- `next discovery`: the vote choosing the next discovery document.

Missing labels are created automatically with descriptions and colors.

## Merge rule

A proposal changes `content/extensions/<handle>/` or `content/kit/<handle>/`, but not `content/kit/core/`. Every changed file must be inside the lowercase GitHub author's own folders. The required checks must succeed on the current head commit, the configured number of reviewers must approve that commit, no latest review may request changes, no veto may exist, and the creator must be within quota.

The quota counts only the creator's open proposals whose required checks passed. Their allowance grows with merged proposals and is capped. Oldest checked proposals take the available places first. If proposals compete, one otherwise-ready proposal may enter without a vote. Two or more otherwise-ready proposals wait for a vote.

The tool publishes a `merge rule` commit status and keeps one marked checklist comment current. Pending checks and approvals produce a pending status. Every other blocker produces failure.

## Parameters

Every adjustable number is visible in `.github/loop.json`:

- `open_call_votes`: support needed to turn a request into an open call.
- `approvals_to_merge`: current-head approvals needed for a proposal.
- `required_checks`: exact GitHub check-run names that must succeed.
- `approvals_must_match_head`: whether an approval on an older commit stops counting.
- `quota.new_creator`: open checked proposals allowed before a creator has a merged proposal.
- `quota.per_accepted`: allowance added for each accepted proposal.
- `quota.cap`: maximum allowance.
- `vote_days`: time from opening to closing a vote.
- `min_votes_to_decide`: eligible choices needed for a vote to decide.
- `min_votes_for_percent`: eligible choices needed before interim results reveal percentages.
- `min_account_age_days`: minimum account age at the moment the vote opens.

## Voting

Each option is a comment the loop posted when it opened the vote, and the vote's marker lists their keys. A comment anyone else writes, with or without the option marker, is a reply: it adds no option, its reactions count for nothing, and it labels no proposal. A voter reacts 👍 to one option. If the same account reacts to several options, only its earliest reaction counts, so that choice is final. Bots and accounts younger than the configured age at opening are ignored. Account lookups are cached for each run.

Before the display threshold, results use relative bars without numbers. At and above it, they show exact percentages. The display never states how many people voted. After the closing date, too little participation or a tie postpones the choice and closes the vote as not planned. Otherwise the first-place option wins. A proposal vote labels all options; a discovery vote announces the winning document.

GitHub voting has a known limit: anyone with an old enough GitHub account can vote. The product goal is voting by everyone who played that version. Enforcing that needs game accounts and belongs to stage 2.

## Weekly summary

The summary covers the preceding seven days. It includes new and top requests, every open call, capability requests, proposals still looking for reviewers, proposals ready to merge, current vote displays, and merged proposals with creator and reviewer credit. It ends with the request board, sorted by 👍 support. When `GITHUB_STEP_SUMMARY` is available, the same Markdown is written to the workflow summary.
