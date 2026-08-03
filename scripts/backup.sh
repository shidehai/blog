#!/bin/sh
set -eu

umask 077

for name in POSTGRES_DB POSTGRES_HOST POSTGRES_PASSWORD POSTGRES_USER RESTIC_PASSWORD RESTIC_REPOSITORY; do
  if [ -z "$(printenv "$name" 2>/dev/null)" ]; then
    echo "Missing required environment variable: $name" >&2
    exit 1
  fi
done

staging=${BACKUP_STAGING_DIR:-/backup-staging}
dump="$staging/postgres-$(date -u +%Y%m%dT%H%M%SZ).dump"
child=
cleanup() {
  trap - EXIT INT TERM
  if [ -n "$child" ]; then
    kill "$child" 2>/dev/null || true
  fi
  rm -f "$dump"
}
trap cleanup EXIT INT TERM

export PGPASSWORD=$POSTGRES_PASSWORD
pg_dump \
  --host "$POSTGRES_HOST" \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  --format custom \
  --file "$dump"
pg_restore --list "$dump" >/dev/null

restic backup "$dump" /data/uploads --tag personal-journal &
child=$!
wait "$child"
child=
