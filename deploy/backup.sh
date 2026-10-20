#!/usr/bin/env bash
# Nightly backup of the game's own database (NEXT 18 b), and of nothing else on the box.
# It reads the named container of this compose project, never the host's postgres and never another
# product's container. Kept 14 days; a dump is written to a temporary name and moved when it is whole.
# pipefail: a failed pg_dump must fail the run, not leave an empty gzip that looks like a backup.
set -euo pipefail
cd "$(dirname "$0")"
set -a; . ./.env; set +a

KEEP_DAYS=14
# a dump of the empty schema is a few KB gzipped; anything under this is a dump that did not happen
MIN_BYTES=2048
DIR="$HOME/openfold/backups"
mkdir -p "$DIR"
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
TMP="$DIR/$DB_NAME-$STAMP.sql.gz.part"

if ! docker compose -f compose.yml exec -T db pg_dump --no-owner --no-privileges -U "$DB_USER" "$DB_NAME" | gzip -9 > "$TMP"; then
  rm -f "$TMP"
  echo "backup failed: pg_dump or gzip exited non-zero, nothing was kept" >&2
  exit 1
fi
SIZE=$(wc -c < "$TMP")
if [ "$SIZE" -lt "$MIN_BYTES" ]; then
  rm -f "$TMP"
  echo "backup failed: the dump is $SIZE bytes, under the floor of $MIN_BYTES, nothing was kept" >&2
  exit 1
fi
mv "$TMP" "$DIR/$DB_NAME-$STAMP.sql.gz"
find "$DIR" -name "$DB_NAME-*.sql.gz" -type f -mtime +"$KEEP_DAYS" -delete
ls -1t "$DIR" | head -n 3
