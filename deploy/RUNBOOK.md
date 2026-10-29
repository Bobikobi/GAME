# The game's box, one approved action at a time

The box runs another product: its own containers, an auto-updater and the host's nginx. Their names, the
box's address and its open ports live in the owner's private notes, never in this public repo. **None of
them is touched.** This runbook adds one compose project called `openfold`, its own
network and its own named volume, one new nginx site file, and one directory of static files for the game's
build. It never edits an existing container, an existing database, an existing volume or an existing nginx file.

Every numbered step is a production gate (AGENTS.md, NEXT 18): three lines to the owner first, then check,
back up, his approval for that one action, execute, verify.

One name serves the game and its API (DECISIONS 2026-10-27, "One origin"): nginx serves the game's build as
files at the root of the name and proxies the API's own paths to the container. The site keeps serving the demo
at `/play/`, without a server; the game with an account lives at the name, and pointing the site's door at it is
the cutover (NEXT 18 h6), a release of its own.

## What exists before step 1

- Docker and the compose plugin (`v5.6`), the owner's user in the `docker` group, no passwordless sudo.
- Port `5432` is taken on the host by another product's postgres, listening on `127.0.0.1` only.
- Port `8710` is free (checked 20.10 with `ss -ltn`; the full list stays in the owner's notes).
- Read-only facts of 27.10: the host's nginx is active with no site enabled and nothing listening on 80 or 443,
  so the game's site file has no neighbour on those ports (adding it, and the certificate, still need sudo, each
  its own yes). The owner's home directory is readable by its owner only, so nginx cannot serve files from under
  `~/openfold`: the game's build lives in `/var/www/loomvale`, created once with sudo and owned by the owner's
  user (step 3). The other product's auto-updater recreated the game's `db` container on 27.10 at its daily hour:
  the first compose file on the box carried the floating tag; the pinned digest below ends that at step 2's
  next `up`. No backup cron line is installed yet (step 5).
- 28.10: steps 2 to 6 ran, each with the owner's yes, under a temporary name: a subdomain of the owner's own
  domain, lent to the game until he buys the game's domain (DECISIONS 2026-10-28, "The box's public name is
  typed once"). The name is typed once, as `PUBLIC_ORIGIN` in `.env`; the site file is derived from it (step 3)
  and the certificate is asked for it (step 4). The country for the age limit is the API's own lookup in
  a file of its image (step 6), so it needs no host change. The box is a staging one (the log mailer), so the name is not given to players.

## 1. A directory of its own

Prepare: `~/openfold/` holds `compose.yml`, `Dockerfile`, `backup.sh`, `nginx-openfold.conf`, `.env`
(mode 600) and `backups/`. Nothing is created outside it but the web root of step 3.
If it goes wrong: `rm -rf ~/openfold` — there is nothing else in it.
Verify: `ls -la ~/openfold` shows the files and no `.env` in git.

## 2. The two containers up

Prepare: `.env` sets `AUTH_MODE=dev-header`, `ALLOW_DEV_HEADER=staging-only` and `IMAGE_TAG=<version>` (see `.env.example`; compose refuses to start without `AUTH_MODE`, and the API exits at boot without both). The box holds no source, so the image is built on the laptop, from the repo: `docker build -f deploy/Dockerfile -t openfold-api:<version> .`, then `docker save openfold-api:<version> | gzip > openfold-api.tar.gz`, and that file is copied to `~/openfold/` together with the current `compose.yml` and `backup.sh`. On the box: `docker load -i openfold-api.tar.gz`, `rm openfold-api.tar.gz`, then `docker compose -f compose.yml up -d --no-build` from `~/openfold` — compose runs `image: openfold-api:${IMAGE_TAG:-latest}`, so `IMAGE_TAG` in `.env` says which build is up, and `--no-build` keeps it from looking for a source that is not on the box.
A box that already runs: a changed `db` image line (the pinned digest replacing the floating tag) makes `up -d`
recreate the `db` container, with its data volume kept; run `backup.sh` by hand first and keep that dump beside
the step's name in `backups/`.
What happens if it goes wrong: the two new containers fail to start; nothing else on the box notices, and
`docker compose -f compose.yml down` removes them without touching the data volume.
Verify: `docker compose -f compose.yml ps` shows `db` and `api` both healthy (the API's check is `GET /health`, which needs no identity); the boot log carries one line saying the server trusts the `x-player-id` header; `curl -s -H 'x-player-id: smoke' -X POST http://127.0.0.1:8710/session` answers 404 "No game state exists for this account." (the row is made by the opening handover, NEXT 18 d).

## 3. The game and the API behind nginx, under one name

Prepare, on the laptop: the game's build that names its own origin, `VITE_GAME_SERVER= pnpm --filter game build`
(the variable set and empty: the client then fetches `/state` and the rest from the page's own origin, as
`game/src/ui/signup.ts` reads it), which leaves `game/dist/`. On the box, three actions with sudo, each its own
yes: the web root, `install -d -o <the owner's user> -g <the owner's user> -m 755 /var/www/loomvale`; the site
file, derived from `nginx-openfold.conf` with the name read from `.env`, the one place the name is typed
(`NAME=$(grep -oE '^PUBLIC_ORIGIN=https://[^/]+' .env | cut -d/ -f3); sed "s/play\.loomvale\.example/$NAME/" nginx-openfold.conf > openfold.site.conf`),
installed into `/etc/nginx/sites-available/` as a **new** file and linked into `sites-enabled/`; then `nginx -t`,
and only after it passes, `systemctl reload nginx`.
Without sudo, after the root exists: `game/dist/` copied into `/var/www/loomvale/` (the owner's user owns it, so
every later build is a copy without sudo; a build replaces `index.html` and adds hashed files under `assets/`, so
the old files may be removed first, nothing else is there).
What happens if it goes wrong: `nginx -t` refuses the config and nginx keeps serving what it served; a bad
build is a bad page at the name and nothing else, and the previous `game/dist/` copied back is the way back.
Verify: `nginx -t` passes; `curl -s http://<name>/ | grep -c '<script'` is at least 1 (the game's page);
`curl -s -o /dev/null -w '%{http_code}\n' http://<name>/state` prints 401 (the API, through nginx, with the
identity header blanked); `curl -s -o /dev/null -w '%{http_code}\n' http://<name>/health` prints 404;
`curl -s -o /dev/null -w '%{http_code}\n' http://<name>/assets/` prints 404 (a directory, no listing).
**The name is not given to players while the box runs `dev-header`.** That mode believes a header, so a reachable
box means anyone can act as any player; it runs with `ALLOW_DEV_HEADER=staging-only` or not at all. The nginx file
blanks `x-player-id`, so through the name every API request is refused and the page cannot play; the staging check
in step 2 is made on the loopback port, never through nginx. A box the name is given out for runs `AUTH_MODE=session`
(step 6), and only after the Fable auth review the owner asked for.

## 4. The certificate

Prepare: the owner's choice of tool; the name must point at the box first. With certbot, `certbot --nginx -d <name>`
edits the game's own site file (the 443 block and the redirect from 80): that file is ours, the other product's files
are not touched; `nginx -t` after it, as always. certbot writes into the installed copy, never into the repo's file
or the derived one. A changed name (the one in use is temporary, see "What exists before step 1") is: edit
`PUBLIC_ORIGIN` in `.env`, derive and install the site file again (step 3), `certbot --nginx -d <new name>`,
`up -d` (step 6), and the new redirect on the Google client.
Verify: `curl -s -o /dev/null -w '%{http_code}\n' https://<name>/state` prints 401 without a player header (a GET: the API answers GET and POST only, so a `-I` HEAD would be 405), and `https://<name>/` prints 200.

## 5. The nightly backup

Prepare: one cron line for the owner's user, `15 3 * * * ~/openfold/backup.sh >> ~/openfold/backups/log 2>&1`,
appended to the lines already there (`(crontab -l; echo '<the line>') | crontab -`): the crontab carries another
product's lines, which are never replaced.
What happens if it goes wrong: no dump is written; the game is unaffected (`set -eu` stops on the first error).
Verify: run it by hand once, then `zcat` the newest file and see `CREATE TABLE player_state`.
The restore test, once (NEXT 18 h4), on a scratch database inside the game's own `db` container, never on the live
one: `docker compose -f compose.yml exec db createdb -U "$DB_USER" openfold_restore`, then
`zcat backups/<newest>.sql.gz | docker compose -f compose.yml exec -T db psql -q -U "$DB_USER" openfold_restore`,
then `docker compose -f compose.yml exec db psql -U "$DB_USER" openfold_restore -c 'select count(*) from player_state'`
must print the live count, and `docker compose -f compose.yml exec db dropdb -U "$DB_USER" openfold_restore` removes
it. The scratch database lives in the same volume for those minutes and nothing else sees it.

## 6. Sign-in on (NEXT 18 e)

Waits for: the Fable auth review of `server/src/auth/`, the name and its certificate (steps 3 and 4), and the
Resend as the mail sender (the owner's choice, 28.10): its domain verified, click tracking off for it.
Prepare: in `~/openfold/.env`, remove `ALLOW_DEV_HEADER` (the session mode refuses to start beside it) and set
`AUTH_MODE=session`, `PUBLIC_ORIGIN=https://<name>` (the game is served beside the API under it, so `APP_ORIGIN`
stays unset: the API refuses a second origin off a laptop), `CLIENT_ADDRESS_HEADER=X-Real-IP` (the nginx file sets
it; the sign-in limits count by it), and the Google pair `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` from the
owner's secrets folder on the laptop (Google project `openfold-game`). On the Google client, add
`https://<name>/auth/google/callback` as a redirect; it lists only the laptop's
`http://localhost:8080/auth/google/callback` today. Set `MAILER=resend`, `RESEND_API_KEY` (from the owner's
secrets folder) and `MAIL_FROM=Loomvale <play@<verified domain>>`. With `MAILER=log` instead, the API starts only
beside `ALLOW_LOG_MAILER=staging-only`: every link lands in its log, so such a box is a staging one and the name
is not given to players. Then `docker compose -f compose.yml up -d --no-build`.
What happens if it goes wrong: the API refuses to start and says which variable; the database is untouched, and
putting the two `dev-header` lines back brings the staging box back.
Verify: the boot log carries one line beginning `AUTH_MODE=session` and saying `the game beside it`;
`curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' https://<name>/auth/google/start` prints 302 and an
`accounts.google.com` address (a GET: `-I` sends HEAD, which the API answers 405); `curl -s https://<name>/state`
answers 401; and a sign-in by the owner's
test address (the owner's test address, kept outside the repo, is the client's one test user while it is in Testing) lands on the game at the name.

The country for the age limit (the owner, 21.10: "align with the big companies"). The sign-up never asks the
player where they are; the API looks the client's address (`X-Real-IP`, which nginx sets and the client cannot) up in
a country file inside its own image (DECISIONS 2026-10-28, "The server looks the country up itself"): DB-IP's free
country file, fetched at image build time from a pinned month and checked against its sha256 (`deploy/Dockerfile`),
read by a pure-JavaScript reader. Nothing is installed on the host, so there is no sudo step and no nginx change.
Prepare: nothing in `.env` (`COUNTRY_DB` defaults to `/app/country.mmdb`; `COUNTRY_DB=` empty runs without it). It
arrives with the next image (step 2's procedure). `COUNTRY_HEADER` stays an override: set it only to take the country
from a header nginx fills.
What happens if it goes wrong: a file that does not open stops the boot with a line naming `COUNTRY_DB`, the old image
is the way back; an address the file does not know holds the sign-up to the highest age (16), which refuses more
players, never fewer.
Verify: the boot log line says `the age limit by the country in the file /app/country.mmdb`, and
`docker compose -f compose.yml exec api ls -l /app/country.mmdb` shows the file (about 8 MB). A month's file is
replaced by taking the next month's name and sha256 into `deploy/Dockerfile` and building again; DB-IP's credit
(CC BY 4.0, https://db-ip.com) stays in the game's credits panel and in the README.

On the laptop, the same mode runs against the dev client: `AUTH_MODE=session PUBLIC_ORIGIN=http://localhost:8080
APP_ORIGIN=http://localhost:5173 ALLOW_LOG_MAILER=staging-only` with the Google pair exported from the secrets
file, never pasted into a shell history or a chat. Two loopback ports are the one pair of origins the API accepts.

## Never

- `docker system prune` on this host: the other product's images and its auto-updater live there.
- Editing a file under `/etc/nginx` that is already there, or reloading without `nginx -t`.
- Pointing the game's database at the host's postgres, or at the other product's database container.
- Ports on `db`: it is reachable inside the `openfold-game` network only, by design.
- A floating tag on `db`: the other product's auto-updater scans every container on the box daily, so `postgres:16-alpine` would be swapped for whatever upstream published, at 04:00, with no one choosing it. `compose.yml` pins the digest on purpose; to move it, take the new digest on purpose, change that one line, and run `up -d` yourself.
- Serving the game from one name and the API from another: the session cookie never crosses an origin, and the API sends no CORS headers. The game's build is served by the same nginx file, at the root of the API's name.
