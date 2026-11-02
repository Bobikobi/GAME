# Image library, kept current

`pnpm art:library` builds one static page of every draft in `tools/kit-gen/drafts.jsonl`
(see "The image library" in `docs/art/REUSE.md`). These files keep that page current without anyone running it.

- `update.sh` fetches `origin/develop` into its own clean checkout (`~/.cache/art-library/checkout`), compares the blob of
  the drafts index (and of the generator) with the last build, rebuilds only when it changed, and writes the page to
  `~/Projects/GAME/.scratch/art-library/` (gitignored). The page's top line says when it was built and how many drafts it holds.
  The first run installs the checkout's dependencies and needs `gh` logged in with access to `Bobikobi/GAME-art-drafts`
  and `ffmpeg` (with webp) on the path.
- `art-library-update.timer` runs `update.sh` 10 minutes after the last run (and 2 minutes after boot).
- `serve.py` (with `art-library-serve.service`) serves that one folder on `127.0.0.1:8741` and nothing else, and saves the
  owner's hand sort (below). Standard library only; it replaces `python3 -m http.server`.

## Sorting by hand

Every card and the lightbox carry the state buttons: שמור (keep), חלקים (reuse-parts), לתקן (rework), ארכיון (archive), and a way
back to לא נבדק (unreviewed), plus a short note. A click is one request, no confirmation; the page shows the state only after
the server has written it, and a save that failed shows on the card and in the header (a count and a retry). In the lightbox the keys 1 keep, 2 parts, 3 rework, 4 archive (0 unreviewed) save and move to the next picture; the
page is right to left, so ArrowLeft is the next picture and ArrowRight the previous, and neither chooses. A digit typed in the
note or in the search box never sorts. Many cards: the box on a card, shift-click for a range, "בחר את כל המוצגים" (everything the
filters show, not only what is drawn), a note for the whole selection, one state for all: one request, and a batch that fails
marks every card of it.

- **Who sorted it.** A state is *his* when it came from a choice on the page, or from an index amendment whose `review_by` is
  `owner` or `elad` (what the earlier sessions stamped in his name). The agents' sort of 30.10 (`review_by` "claude-sonnet-5-5
  ...", and `measure`) is not. The card says אתה or סוכן; "מיינת X מתוך N" counts his; the filter "לא מוין ידנית" shows the rest. His
  way back to לא נבדק takes a picture out of X. A card he has just sorted stays in the list, dimmed, until the next filter change.
- **Where a choice lives.** `reviews.jsonl` in the page's folder (gitignored with `.scratch/`): one JSON line per save,
  `{id, review, note, at}`, append-only; the last line for an id wins. The page reads the current choices from `GET /reviews` at
  every load, so a reload shows them without a rebuild; the build (`pnpm art:library`) lays them over the index too, his choice
  beating any agent's amendment, a later one included, and `update.sh` rebuilds when the file changes and never touches it. The
  build also writes `ids.json`, the list `serve.py` checks a POST against.
- **What the server refuses.** A Host other than `127.0.0.1:<port>` or `localhost:<port>` (any request), an Origin other than those
  on a POST (a missing one too), a body that is not JSON or is over 256 KB, an id the page does not hold, a state that is not one
  of the five, a note over 300 characters. No CORS header is ever sent. Any website open in a browser can post to localhost; that
  is what these refusals are for.
- **Archive is a state.** Nothing is deleted from the store or from the thumbnails.
- **Landing the choices.** `pnpm art:library:land` (a dry run: counts against `origin/develop`'s index), `--apply` (a worktree under
  `<repo>.worktrees/` on a fresh branch `art/library-reviews-<stamp>` from `origin/develop`, the amendment lines
  `{"id","amend":true,"review","review_by":"owner","review_note"}` appended, one commit that adds only the index), `--pr` (also
  pushes the branch and opens the pull request with `Issue #658` and a `Tree:` line). A choice the index already holds is not
  written twice, the last choice for an id wins, a landing pull request that is still open refuses another, and the command never
  pushes to `develop`: the manager lands the pull request. `--out DIR` points at the page's folder (default
  `~/Projects/GAME/.scratch/art-library`).

The units live outside the working copy on purpose: the owner switches branches in `~/Projects/GAME`, and a reboot must
bring the page back by itself.

## Install (not done by the pull request)

```
mkdir -p ~/.local/share/art-library ~/.config/systemd/user
cp tools/art-library/update.sh tools/art-library/serve.py ~/.local/share/art-library/
cp tools/art-library/art-library-*.service tools/art-library/art-library-update.timer ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user start art-library-update.service   # the first build, now: it writes ids.json, which serve.py needs to save a choice
# then retire whatever holds port 8741 (ss -ltnp | grep 8741: the old http.server), and:
systemctl --user enable --now art-library-update.timer art-library-serve.service
```

`update.sh` and `serve.py` are copied rather than linked so that they keep working while `~/Projects/GAME` sits on any branch;
copy them again when they change (and `systemctl --user restart art-library-serve.service` after `serve.py`). Paths can be overridden with `ART_LIBRARY_OUT`, `ART_LIBRARY_CHECKOUT` and `ART_LIBRARY_REPO`
(then change the serve unit's folder to match).
