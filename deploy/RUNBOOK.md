# The game's box, one approved action at a time

The box runs another product: its own containers, an auto-updater and the host's nginx. Their names, the
box's address and its open ports live in the owner's private notes, never in this public repo. **None of
them is touched.** This runbook adds one compose project called `openfold`, its own
network and its own named volume, and one new nginx site file. It never edits an existing container, an
existing database, an existing volume or an existing nginx file.

Every numbered step is a production gate (AGENTS.md, NEXT 18): three lines to the owner first, then check,
back up, his approval for that one action, execute, verify.

## What exists before step 1

- Docker and the compose plugin (`v5.6`), the owner's user in the `docker` group, no passwordless sudo.
- Port `5432` is taken on the host by another product's postgres, listening on `127.0.0.1` only.
- Port `8710` is free (checked 20.10 with `ss -ltn`; the full list stays in the owner's notes).

## 1. A directory of its own

Prepare: `~/openfold/` holds `compose.yml`, `Dockerfile`, `backup.sh`, `.env` (mode 600) and `backups/`.
Nothing is created outside it.
If it goes wrong: `rm -rf ~/openfold` — there is nothing else in it.
Verify: `ls -la ~/openfold` shows the four files and no `.env` in git.

## 2. The two containers up

Prepare: `.env` sets `AUTH_MODE=dev-header`, `ALLOW_DEV_HEADER=staging-only` and `IMAGE_TAG=<version>` (see `.env.example`; compose refuses to start without `AUTH_MODE`, and the API exits at boot without both). The box holds no source, so the image is built on the laptop, from the repo: `docker build -f deploy/Dockerfile -t openfold-api:<version> .`, then `docker save openfold-api:<version> | gzip > openfold-api.tar.gz`, and that file is copied to `~/openfold/`. On the box: `docker load -i openfold-api.tar.gz`, `rm openfold-api.tar.gz`, then `docker compose -f compose.yml up -d --no-build` from `~/openfold` — compose runs `image: openfold-api:${IMAGE_TAG:-latest}`, so `IMAGE_TAG` in `.env` says which build is up, and `--no-build` keeps it from looking for a source that is not on the box.
What happens if it goes wrong: the two new containers fail to start; nothing else on the box notices, and
`docker compose -f compose.yml down` removes them without touching the data volume.
Verify: `docker compose -f compose.yml ps` shows `db` and `api` both healthy (the API's check is `GET /health`, which needs no identity); the boot log carries one line saying the server trusts the `x-player-id` header; `curl -s -H 'x-player-id: smoke' -X POST http://127.0.0.1:8710/session` answers 404 "No game state exists for this account." (the row is made by the opening handover, NEXT 18 d).

## 3. The API behind nginx

Prepare: copy `nginx-openfold.conf` to the host's sites directory as a **new** file, with the real name.
What happens if it goes wrong: `nginx -t` refuses the config and nginx keeps serving what it served.
Verify: `nginx -t` passes, `systemctl reload nginx`, then the same curl through the name.
**The name is not pointed at the box while it runs `dev-header`.** That mode believes a header, so a reachable box means anyone can act as any player; it runs with `ALLOW_DEV_HEADER=staging-only` or not at all. A box the name points at runs `AUTH_MODE=session` (step 6), and only after the Fable auth review the owner asked for. The nginx file blanks `x-player-id`, so through the name every request is refused: the staging check in step 2 is made on the loopback port, never through nginx.

## 4. The certificate

Prepare: the owner's choice of tool; the name must point at the box first.
Verify: `curl -s -o /dev/null -w '%{http_code}\n' https://<name>/state` prints 401 without a player header (a GET: the API answers GET and POST only, so a `-I` HEAD would be 405).

## 5. The nightly backup

Prepare: one cron line for the owner's user, `15 3 * * * ~/openfold/backup.sh >> ~/openfold/backups/log 2>&1`.
What happens if it goes wrong: no dump is written; the game is unaffected (`set -eu` stops on the first error).
Verify: run it by hand once, then `zcat` the newest file and see `CREATE TABLE player_state`.

## 6. Sign-in on (NEXT 18 e)

Waits for: the Fable auth review of `server/src/auth/`, the name and its certificate (steps 3 and 4), and the
owner's choice of a mail sender (NEXT 18 h5; until then the only mailer writes the link to the API's log).
Prepare: in `~/openfold/.env`, remove `ALLOW_DEV_HEADER` (the session mode refuses to start beside it) and set
`AUTH_MODE=session`, `PUBLIC_ORIGIN=https://<name>`, `APP_ORIGIN=https://<the game's name>`,
`CLIENT_ADDRESS_HEADER=X-Real-IP` (the nginx file sets it; the sign-in limits count by it), and the Google pair
`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` from the owner's secrets folder on the laptop (Google project
`openfold-game`). On the Google client, add `https://<name>/auth/google/callback` as a redirect; it lists only the
laptop's `http://localhost:8080/auth/google/callback` today. While the only mailer is `log`, the API starts only
beside `ALLOW_LOG_MAILER=staging-only`: every link lands in its log, so such a box is a staging one and the name
is not given to players until a real sender replaces it. Then `docker compose -f compose.yml up -d --no-build`.
What happens if it goes wrong: the API refuses to start and says which variable; the database is untouched, and
putting the two `dev-header` lines back brings the staging box back.
Verify: the boot log carries one line beginning `AUTH_MODE=session`;
`curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' https://<name>/auth/google/start` prints 302 and an
`accounts.google.com` address (a GET: `-I` sends HEAD, which the API answers 405); `curl -s https://<name>/state`
answers 401; and a sign-in by the owner's
test address (the owner's test address, kept outside the repo, is the client's one test user while it is in Testing) lands on the game.

The country for the age limit (the owner, 21.10: "align with the big companies"). The sign-up never asks the
player where they are; the API reads the header named by `COUNTRY_HEADER`, and only our nginx may set it.
Prepare: the GeoIP2 module and a country database on the host (a new package and a new file, nothing existing
edited), then in the game's own site file replace `proxy_set_header X-Country "";` with
`proxy_set_header X-Country $geoip2_data_country_iso_code;` (the `geoip2` block that defines it goes in the same
file), and add `COUNTRY_HEADER=X-Country` to `~/openfold/.env`. `proxy_set_header` replaces whatever the client
sent, so a forged header never reaches the API, and the API port listens on 127.0.0.1 only.
What happens if it goes wrong: `nginx -t` refuses the file and nginx keeps serving the old one; without the
header the API holds every sign-up to the highest age (16), which refuses more players, never fewer.
Verify: the boot log line ends `the age limit by the country in x-country`; `curl -s -H 'X-Country: IL'` to the
loopback port is answered as Israel, and the same through the name is answered by the caller's real country.

On the laptop, the same mode runs against the dev client: `AUTH_MODE=session PUBLIC_ORIGIN=http://localhost:8080
APP_ORIGIN=http://localhost:5173 ALLOW_LOG_MAILER=staging-only` with the Google pair exported from the secrets
file, never pasted into a shell history or a chat.

## Never

- `docker system prune` on this host: the other product's images and its auto-updater live there.
- Editing a file under `/etc/nginx` that is already there, or reloading without `nginx -t`.
- Pointing the game's database at the host's postgres, or at the other product's database container.
- Ports on `db`: it is reachable inside the `openfold-game` network only, by design.
- A floating tag on `db`: the other product's auto-updater scans every container on the box daily, so `postgres:16-alpine` would be swapped for whatever upstream published, at 04:00, with no one choosing it. `compose.yml` pins the digest on purpose; to move it, take the new digest on purpose, change that one line, and run `up -d` yourself.
