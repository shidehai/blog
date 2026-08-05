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
uploads=${BACKUP_UPLOADS_DIR:-/data/uploads}
tag=${BACKUP_TAG:-personal-journal}
backup_host=${BACKUP_HOST:-personal-journal-vps}

case "$staging" in
  "" | /)
    echo "BACKUP_STAGING_DIR must be a dedicated directory" >&2
    exit 1
    ;;
esac

if [ ! -d "$staging" ] || [ ! -w "$staging" ]; then
  echo "BACKUP_STAGING_DIR must exist and be writable" >&2
  exit 1
fi
if [ ! -d "$uploads" ] || [ ! -r "$uploads" ]; then
  echo "BACKUP_UPLOADS_DIR must exist and be readable" >&2
  exit 1
fi

started=$(date +%s)
created_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)
work=$(mktemp -d "$staging/backup.XXXXXX")
dump="$work/postgres.dump"
manifest="$work/manifest.env"
child=
cleanup() {
  status=$?
  trap - EXIT HUP INT TERM
  if [ -n "$child" ]; then
    kill "$child" 2>/dev/null || true
    wait "$child" 2>/dev/null || true
  fi
  rm -rf -- "$work"
  if [ "$status" -ne 0 ]; then
    duration=$(($(date +%s) - started))
    echo "backup status=failed duration_seconds=$duration" >&2
  fi
  exit "$status"
}
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM
trap cleanup EXIT

export PGPASSWORD=$POSTGRES_PASSWORD
pg_dump \
  --host "$POSTGRES_HOST" \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  --format custom \
  --file "$dump"
pg_restore --list "$dump" >/dev/null

dump_sha256=$(sha256sum "$dump" | cut -d ' ' -f 1)
dump_bytes=$(wc -c <"$dump" | tr -d ' ')
cat >"$manifest" <<EOF
format_version=1
created_at=$created_at
dump_file=postgres.dump
dump_sha256=$dump_sha256
dump_bytes=$dump_bytes
EOF

restic backup \
  "$work" \
  "$uploads" \
  --host "$backup_host" \
  --tag "$tag" &
child=$!
wait "$child"
child=

duration=$(($(date +%s) - started))
echo "backup status=success created_at=$created_at dump_bytes=$dump_bytes dump_sha256=$dump_sha256 duration_seconds=$duration"
