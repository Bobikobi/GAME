#!/bin/bash
# Keeps the image library page current (docs/art/REUSE.md, "The image library").
# Fetches origin/develop into a clean checkout of its own, compares the drafts index's blob (and the generator's) with
# the last build (the generators are tools/src/art as a whole), rebuilds only when one changed, and leaves the page at $ART_LIBRARY_OUT. Safe to run any time and from
# any directory: it never touches the working copy the owner switches branches in. It never touches $OUT/reviews.jsonl either:
# that file is the owner's hand sort (serve.py appends to it), the build lays it over the index, and a rebuild is also made
# when it changes so that the baked page is current.
set -euo pipefail

REPO_URL=${ART_LIBRARY_REPO:-https://github.com/Bobikobi/GAME.git}
BRANCH=${ART_LIBRARY_BRANCH:-develop}
CHECKOUT=${ART_LIBRARY_CHECKOUT:-$HOME/.cache/art-library/checkout}
OUT=${ART_LIBRARY_OUT:-$HOME/Projects/GAME/.scratch/art-library}
STAMP=$OUT/.built

mkdir -p "$(dirname "$CHECKOUT")" "$OUT"
exec 9>"$(dirname "$CHECKOUT")/lock"
flock -n 9 || { echo "art-library: another update is running"; exit 0; }

if [ ! -d "$CHECKOUT/.git" ]; then
  git clone --quiet --depth 1 --no-tags --branch "$BRANCH" "$REPO_URL" "$CHECKOUT"
fi
cd "$CHECKOUT"
git fetch --quiet --depth 1 --no-tags origin "$BRANCH"
git reset --quiet --hard FETCH_HEAD

reviews=none
[ -f "$OUT/reviews.jsonl" ] && reviews=$(sha256sum "$OUT/reviews.jsonl" | cut -c1-16)
now=$(git rev-parse HEAD:tools/kit-gen/drafts.jsonl)+$(git rev-parse HEAD:tools/src/art)+$reviews
if [ -f "$STAMP" ] && [ "$(cat "$STAMP")" = "$now" ] && [ -f "$OUT/index.html" ]; then
  echo "art-library: unchanged ($now)"
  exit 0
fi

lock=$(git rev-parse HEAD:pnpm-lock.yaml)
if [ ! -d node_modules ] || [ ! -f .installed ] || [ "$(cat .installed)" != "$lock" ]; then
  pnpm install --frozen-lockfile --silent
  echo "$lock" > .installed
fi

pnpm --silent art:library --out "$OUT"
echo "$now" > "$STAMP"
echo "art-library: built $now"
