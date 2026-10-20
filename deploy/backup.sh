#!/bin/sh
# Nightly backup of the game's own database (NEXT 18 b), and of nothing else on the box.
# It reads the named container of this compose project, never the host's postgres and never another
# product's container. Kept 14 days; a dump is written to a temporary name and moved when it is whole.
set -eu
cd "$(dirname "$0")"
set -a; . ./.env; set +a

KEEP_DAYS=14
DIR="$HOME/openfold/backups"
mkdir -p "$DIR"
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
TMP="$DIR/$DB_NAME-$STAMP.sql.gz.part"

docker compose -f compose.yml exec -T db pg_dump --no-owner --no-privileges -U "$DB_USER" "$DB_NAME" | gzip -9 > "$TMP"
mv "$TMP" "$DIR/$DB_NAME-$STAMP.sql.gz"
find "$DIR" -name "$DB_NAME-*.sql.gz" -type f -mtime +"$KEEP_DAYS" -delete
ls -1t "$DIR" | head -n 3
