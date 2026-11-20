# The nightly PixelLab job

The owner's free PixelLab accounts refill a few generations a day (about 5, stored up to 20). Left alone they are lost, so
this job spends them every night on the next small pieces the game names and does not yet draw
(`tools/kit-gen/pixellab/daily-queue.json`), one generation a piece, and lands the results in the drafts store as
**unreviewed**. Nothing it makes enters the game: a person reviews the drafts first (`docs/art/REUSE.md`).

`docs/art/DRAWERS.md`, "The nightly job", is the reference; this page is the install.

## Order of landing

The script works from `origin/develop`, so tonight's run needs both the pool change (`plan` and `nightly` in `pool.json`, #670) and
this job on develop. Until then it alerts "develop does not have the nightly job yet" and exits without marking the day done.
Land the pool change, then this one, then install.

The script itself was rehearsed offline before this change: against a local bare repository with stub `gh`, `pnpm` and
`notify-send` it made the branch, commit and pull-request call on a night that gave pieces, did nothing on a night that gave none,
alerted on a failing job and on a crashing one, refused a second run on the same date, and refused a develop without the job. The
job itself ran only against a fake API. **Nothing here has spent a real generation yet.**

## What runs

- `nightly.sh` works in a clean checkout of its own (`~/.cache/art-pixellab/checkout`), never the working copy the owner
  switches branches in. It fetches `origin/develop`, runs `pnpm art:nightly`, and when pieces were made it commits their
  index rows (`tools/kit-gen/drafts.jsonl`) and the night's line in `tools/kit-gen/pixellab/nightly-log.jsonl` on the branch
  `art/pixellab-nightly-YYYY-MM-DD` and opens a pull request into `develop` with the body gates (`Tree:`, `Quest review:`,
  `Story review:`, `Source:`, `Issue:`). The manager lands it.
- `art-pixellab-nightly.timer` fires at **02:30 Asia/Jerusalem** with `Persistent=true` (a night the laptop was off runs when
  it is next on). It sets no `WakeSystem`: the laptop is never woken for this. `art-pixellab-nightly.service` runs the script.
- A second run on the same date does nothing (`last-run` in the state folder).

## The accounts

Only the accounts the pool marks `"nightly": true` are used, and only a `"plan": "free"` account can carry it
(`tools/kit-gen/pixellab/pool.json`; `parsePoolConfig` refuses a paid one marked nightly). The tokens of the other accounts
are never read. A queue piece cannot name an account (`parseQueue` refuses any key but `id`, `what`, `class`, `source`).
Both are tested in `tools/test/art-pixellab-nightly.test.ts`, including a run in which every free account is refused and the
paid account holds 5,000: no call carries the paid token.

## What the server says when an account has nothing left

Found in the API's own description and used as the rule of the loop:

| answer | meaning | what the job does |
|---|---|---|
| **402** "Insufficient credits" | the account has spent its day | "none today": the account's night is over, **not a failure**, the next account runs |
| **429** "Not enough concurrent job slots" | no free slot right now | wait and ask again (`Client.post`: 10, 20, 30 s, up to 30 minutes), then it is a failure |
| 401, 403, 422, any 5xx, a dropped network, an answer with no picture | a real fault | the account's night ends, the failure is recorded, and the manager is told (popup and a line in the pending channel); the other accounts still run |

The balance read of the API is **not trusted**: it read 0 on these accounts at 10:55 on 2.11. Each account is tried until the
server says 402, with a safety stop at 25 generations an account (`--max-per-account`). `/balance` is read once an account for
the log only (`apiBalance`), so the real allowance can be compared with what the server said.

## Install (not done by the pull request)

```
mkdir -p ~/.local/share/art-pixellab ~/.config/systemd/user ~/.config/art-pixellab
cp tools/art-pixellab/nightly.sh ~/.local/share/art-pixellab/
cp tools/art-pixellab/art-pixellab-nightly.service tools/art-pixellab/art-pixellab-nightly.timer ~/.config/systemd/user/
# the line that tells the manager when something really fails: a command that takes one line of text
printf 'ART_PIXELLAB_ALERT=%s\n' "<the manager's pending script>" > ~/.config/art-pixellab/env
systemctl --user daemon-reload
systemctl --user enable --now art-pixellab-nightly.timer
systemctl --user list-timers art-pixellab-nightly.timer     # the next run is 02:30 Israel time
```

`nightly.sh` is copied, not linked, so it keeps working while any branch is checked out; copy it again when it changes.
Needs on the path: `git`, `gh` (logged in as Bobikobi, with push access to the repository and the drafts repository),
`pnpm`, `node`, `flock`, `notify-send`. The pull request is opened with `GH_TOKEN` read from `gh auth token --user Bobikobi`
for that one process: the script never runs `gh auth switch`, which would change the active account of every other session.

First run by hand, to see it work before the timer does: `systemctl --user start art-pixellab-nightly.service`, then
`journalctl --user -u art-pixellab-nightly.service -e` and `~/.local/state/art-pixellab/run.log`.

## State and logs (outside the repository)

`~/.local/state/art-pixellab/`: `done.jsonl` (every piece ever made, so a piece whose pull request has not landed is not
drawn twice), `nights.jsonl` (the log line of every night, including nights that gave nothing), `last-run`, `run.log`.
The landed log is `tools/kit-gen/pixellab/nightly-log.jsonl` (`merge=union`).

If the push of a branch fails after the pictures were stored, the commit stays on its branch in the checkout and the drafts
are already in the store: push the branch by hand from the checkout.

## Changing the queue

Add pieces at the end of `daily-queue.json`; never reorder or remove one that was made. A piece is `id`, `what`, `class`
(`pickup` or `prop`) and the `source` that names it. Every piece is drawn at the queue's `size`, in the game's camera
(`high top-down`), as a text `fill` at one generation.
