#!/bin/bash
# The nightly PixelLab job (docs/art/DRAWERS.md, "The nightly job"). Spends the free accounts' daily generations on the next
# pieces of tools/kit-gen/pixellab/daily-queue.json, pushes the pictures to the drafts store, and opens a pull request that
# adds their index rows. It works in a clean checkout of its own and never touches the working copy the owner switches
# branches in. It never touches the paid account: only accounts the pool marks "nightly" (all free) are read.
#
# Safe to run any time, from any directory, twice a day: a second run on the same date does nothing.
#   ART_PIXELLAB_REPO      the repository (default: GitHub Bobikobi/GAME)
#   ART_PIXELLAB_CHECKOUT  its own checkout (default ~/.cache/art-pixellab/checkout)
#   ART_PIXELLAB_STATE     what was made and the log (default ~/.local/state/art-pixellab)
#   ART_PIXELLAB_ALERT     a command that takes one line of text and tells the manager (the manager's pending channel)
#   ART_PIXELLAB_GH_USER   the GitHub account that opens the pull request (default Bobikobi)
set -euo pipefail

REPO_URL=${ART_PIXELLAB_REPO:-https://github.com/Bobikobi/GAME.git}
CHECKOUT=${ART_PIXELLAB_CHECKOUT:-$HOME/.cache/art-pixellab/checkout}
STATE=${ART_PIXELLAB_STATE:-$HOME/.local/state/art-pixellab}
ALERT=${ART_PIXELLAB_ALERT:-}
GH_USER=${ART_PIXELLAB_GH_USER:-Bobikobi}
DATE=$(TZ=Asia/Jerusalem date +%F)
BRANCH=art/pixellab-nightly-$DATE
KIT=tools/kit-gen/pixellab

mkdir -p "$STATE" "$(dirname "$CHECKOUT")"
exec 9>"$STATE/lock"
flock -n 9 || { echo "art-pixellab: another run is going"; exit 0; }
exec > >(tee -a "$STATE/run.log") 2>&1
echo "== $(date '+%F %T') nightly $DATE"

# a real failure: a popup, a line in the manager's pending channel, and a non-zero exit (the unit shows red)
alert() {
  echo "ALERT: $*"
  if [ -n "$ALERT" ]; then "$ALERT" -n "pixellab nightly $DATE: $*" || true
  else notify-send -a "GAME art" "PixelLab nightly $DATE" "$*" || true; fi
}
trap 'alert "the script stopped at line $LINENO, see $STATE/run.log"' ERR

if [ -f "$STATE/last-run" ] && [ "$(cat "$STATE/last-run")" = "$DATE" ]; then
  echo "art-pixellab: $DATE already done"
  exit 0
fi

if [ ! -d "$CHECKOUT/.git" ]; then
  git clone --quiet --no-tags "$REPO_URL" "$CHECKOUT"
fi
cd "$CHECKOUT"
git fetch --quiet --no-tags origin develop
git reset --quiet --hard
git clean --quiet -fd
git checkout --quiet -B "$BRANCH" origin/develop

lock=$(git rev-parse HEAD:pnpm-lock.yaml)
if [ ! -d node_modules ] || [ ! -f .installed ] || [ "$(cat .installed)" != "$lock" ]; then
  pnpm install --frozen-lockfile --silent
  echo "$lock" > .installed
fi

# the token of the account that opens the pull request, for this process only: no "gh auth switch", which would change
# the active account for every other session on the machine
GH_TOKEN=$(gh auth token --user "$GH_USER" 2>/dev/null || true)
[ -n "$GH_TOKEN" ] || { alert "no gh login for $GH_USER"; exit 1; }
export GH_TOKEN
git config credential.helper '!gh auth git-credential'

set +e
pnpm --silent art:nightly --state "$STATE" | tee "$STATE/last-output.txt"
code=${PIPESTATUS[0]}
set -e
# a refusal for lack of credit is "none today" and exits 0; 1 is a real failure on some account or in the push, 2 a crash
result=$(grep '^RESULT ' "$STATE/last-output.txt" | tail -1 || true)
tail -1 "$KIT/nightly-log.jsonl" >> "$STATE/nights.jsonl" 2>/dev/null || true

if [ "$code" -ge 2 ]; then alert "art:nightly crashed (exit $code), see $STATE/run.log"; exit 1; fi
if [ "$code" -eq 1 ]; then alert "$(echo "$result" | cut -c1-400)"; fi

pieces=$(grep -o '"made":[0-9]*' <<<"$result" | head -1 | cut -d: -f2 || true)
pieces=${pieces:-0}
if [ "$pieces" -gt 0 ] && ! grep -q '"pushFailed":true' <<<"$result"; then
  git add "$KIT/nightly-log.jsonl" tools/kit-gen/drafts.jsonl
  git commit --quiet -m "chore(art): the nightly PixelLab pieces of $DATE, unreviewed

$pieces small pieces from $KIT/daily-queue.json, one generation each on the free accounts. The pictures are in the drafts store under pixellab-nightly-$DATE; this adds their index rows and the night's line in the log.

Issue: #659"
  git push --quiet origin "$BRANCH"
  body=$(cat <<BODY
The nightly PixelLab job of $DATE made $pieces small pieces the game names and does not yet draw (the queue is $KIT/daily-queue.json), one generation each on the free accounts, and stored them in the drafts store as unreviewed under pixellab-nightly-$DATE. This adds their index rows and the night's line in $KIT/nightly-log.jsonl (what each account gave, so the real allowance is measured). No picture enters the game with this change.

Tree: none: drafts index only, nothing in the game changes
Quest review: not needed, no quest or content change
Story review: not needed, no lore or line change
Source: PixelLab pixflux text to image, prompts and seeds in the drafts store
Issue: #659

Made by the nightly job (tools/art-pixellab/), not by a session.
BODY
)
  gh pr create --base develop --head "$BRANCH" --title "chore(art): the nightly PixelLab pieces of $DATE, unreviewed" --body "$body"
else
  echo "art-pixellab: nothing to land tonight ($pieces made)"
fi

echo "$DATE" > "$STATE/last-run"
[ "$code" -eq 0 ] || exit 1
