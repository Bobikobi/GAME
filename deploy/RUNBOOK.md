# The game's box, one approved action at a time

The box (`207.180.241.81`) runs another product: `yaar-ad`, `yaar-ad-db`, `watchtower` and the host's
nginx. **None of them is touched.** This runbook adds one compose project called `openfold`, its own
network and its own named volume, and one new nginx site file. It never edits an existing container, an
existing database, an existing volume or an existing nginx file.

Every numbered step is a production gate (AGENTS.md, NEXT 18): three lines to the owner first, then check,
back up, his approval for that one action, execute, verify.

## What exists before step 1

- Docker and the compose plugin (`v5.6`), the owner's user in the `docker` group, no passwordless sudo.
- Port `5432` is taken on the host by another product's postgres, listening on `127.0.0.1` only.
- Port `8710` is free (checked 20.10: listening ports are 22, 53, 5432, 44828, 53628).

## 1. A directory of its own

Prepare: `~/openfold/` holds `compose.yml`, `Dockerfile`, `backup.sh`, `.env` (mode 600) and `backups/`.
Nothing is created outside it.
If it goes wrong: `rm -rf ~/openfold` — there is nothing else in it.
Verify: `ls -la ~/openfold` shows the four files and no `.env` in git.

## 2. The two containers up

Prepare: `docker compose -f compose.yml up -d --build` from `~/openfold`.
What happens if it goes wrong: the two new containers fail to start; nothing else on the box notices, and
`docker compose -f compose.yml down` removes them without touching the data volume.
Verify: `docker compose -f compose.yml ps` shows `db` healthy and `api` up; `curl -s -H 'x-player-id: smoke' -X POST http://127.0.0.1:8710/session` answers 404 "No game state exists for this account." (the row is made by the opening handover, NEXT 18 d).

## 3. The API behind nginx

Prepare: copy `nginx-openfold.conf` to the host's sites directory as a **new** file, with the real name.
What happens if it goes wrong: `nginx -t` refuses the config and nginx keeps serving what it served.
Verify: `nginx -t` passes, `systemctl reload nginx`, then the same curl through the name.

## 4. The certificate

Prepare: the owner's choice of tool; the name must point at the box first.
Verify: `curl -sI https://<name>/state` answers 401 without a player header.

## 5. The nightly backup

Prepare: one cron line for the owner's user, `15 3 * * * ~/openfold/backup.sh >> ~/openfold/backups/log 2>&1`.
What happens if it goes wrong: no dump is written; the game is unaffected (`set -eu` stops on the first error).
Verify: run it by hand once, then `zcat` the newest file and see `CREATE TABLE player_state`.

## Never

- `docker system prune` on this host: watchtower and the other product's images live there.
- Editing a file under `/etc/nginx` that is already there, or reloading without `nginx -t`.
- Pointing the game's database at the host's postgres, or at `yaar-ad-db`.
- Ports on `db`: it is reachable inside the `openfold-game` network only, by design.
