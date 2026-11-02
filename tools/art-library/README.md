# Image library, kept current

`pnpm art:library` builds one static page of every draft in `tools/kit-gen/drafts.jsonl`
(see "The image library" in `docs/art/REUSE.md`). These files keep that page current without anyone running it.

- `update.sh` fetches `origin/develop` into its own clean checkout (`~/.cache/art-library/checkout`), compares the blob of
  the drafts index (and of the generator) with the last build, rebuilds only when it changed, and writes the page to
  `~/Projects/GAME/.scratch/art-library/` (gitignored). The page's top line says when it was built and how many drafts it holds.
  The first run installs the checkout's dependencies and needs `gh` logged in with access to `Bobikobi/GAME-art-drafts`
  and `ffmpeg` (with webp) on the path.
- `art-library-update.timer` runs `update.sh` 10 minutes after the last run (and 2 minutes after boot).
- `art-library-serve.service` serves that one folder on `127.0.0.1:8741` and nothing else.

The units live outside the working copy on purpose: the owner switches branches in `~/Projects/GAME`, and a reboot must
bring the page back by itself.

## Install (not done by the pull request)

```
mkdir -p ~/.local/share/art-library ~/.config/systemd/user
cp tools/art-library/update.sh ~/.local/share/art-library/
cp tools/art-library/art-library-*.service tools/art-library/art-library-update.timer ~/.config/systemd/user/
systemctl --user daemon-reload
# retire whatever holds port 8741 first (ss -ltnp | grep 8741), then:
systemctl --user enable --now art-library-update.timer art-library-serve.service
systemctl --user start art-library-update.service   # the first build, now
```

`update.sh` is copied rather than linked so that it keeps working while `~/Projects/GAME` sits on any branch; copy it again
when it changes. Paths can be overridden with `ART_LIBRARY_OUT`, `ART_LIBRARY_CHECKOUT` and `ART_LIBRARY_REPO`
(then change the serve unit's folder to match).
