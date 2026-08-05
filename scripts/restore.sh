#!/bin/sh
set -eu

umask 077

mode=${1:-}
snapshot=${2:-latest}

if [ "$#" -lt 1 ] || [ "$#" -gt 2 ]; then
  echo "Usage: blog-restore {verify|apply} [snapshot-id|latest]" >&2
  exit 2
fi
case "$mode" in
  verify | apply) ;;
  *)
    echo "Usage: blog-restore {verify|apply} [snapshot-id|latest]" >&2
    exit 2
    ;;
esac
case "$snapshot" in
  "" | -* | *[!A-Za-z0-9_-]*)
    echo "Snapshot must be 'latest' or an alphanumeric Restic snapshot ID" >&2
    exit 2
    ;;
esac

for name in RESTIC_PASSWORD RESTIC_REPOSITORY; do
  if [ -z "$(printenv "$name" 2>/dev/null)" ]; then
    echo "Missing required environment variable: $name" >&2
    exit 1
  fi
done

staging=${RESTORE_STAGING_DIR:-/backup-staging}
tag=${BACKUP_TAG:-personal-journal}
backup_host=${BACKUP_HOST:-personal-journal-vps}
case "$staging" in
  "" | /)
    echo "RESTORE_STAGING_DIR must be a dedicated directory" >&2
    exit 1
    ;;
esac
if [ ! -d "$staging" ] || [ ! -w "$staging" ]; then
  echo "RESTORE_STAGING_DIR must exist and be writable" >&2
  exit 1
fi

started=$(date +%s)
work=$(mktemp -d "$staging/restore.XXXXXX")
cleanup() {
  status=$?
  trap - EXIT HUP INT TERM
  rm -rf -- "$work"
  if [ "$status" -ne 0 ]; then
    duration=$(($(date +%s) - started))
    echo "restore mode=$mode status=failed duration_seconds=$duration" >&2
  fi
  exit "$status"
}
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM
trap cleanup EXIT

restic restore "$snapshot" \
  --host "$backup_host" \
  --tag "$tag" \
  --target "$work"

dump=$(find "$work" -type f -name postgres.dump -print -quit)
if [ -z "$dump" ]; then
  echo "Restored snapshot does not contain postgres.dump" >&2
  exit 1
fi
if [ -n "$(find "$work" -type f -name postgres.dump -print | sed -n '2p')" ]; then
  echo "Restored snapshot contains multiple PostgreSQL dumps" >&2
  exit 1
fi
manifest=$(dirname "$dump")/manifest.env
if [ ! -f "$manifest" ]; then
  echo "Restored snapshot does not contain manifest.env" >&2
  exit 1
fi

expected_sha=$(sed -n 's/^dump_sha256=//p' "$manifest")
case "$expected_sha" in
  "" | *[!0-9a-f]*)
    echo "Backup manifest has an invalid dump_sha256" >&2
    exit 1
    ;;
esac
if [ "${#expected_sha}" -ne 64 ]; then
  echo "Backup manifest has an invalid dump_sha256" >&2
  exit 1
fi
actual_sha=$(sha256sum "$dump" | cut -d ' ' -f 1)
if [ "$actual_sha" != "$expected_sha" ]; then
  echo "PostgreSQL dump checksum does not match the backup manifest" >&2
  exit 1
fi
pg_restore --list "$dump" >/dev/null

if [ "$mode" = verify ]; then
  duration=$(($(date +%s) - started))
  echo "restore mode=verify status=success dump_sha256=$actual_sha duration_seconds=$duration"
  exit 0
fi

for name in POSTGRES_DB POSTGRES_HOST POSTGRES_PASSWORD POSTGRES_USER RESTORE_UPLOADS_TARGET; do
  if [ -z "$(printenv "$name" 2>/dev/null)" ]; then
    echo "Missing required environment variable: $name" >&2
    exit 1
  fi
done
required_confirmation="restore-empty:$POSTGRES_DB"
if [ "${RESTORE_CONFIRM:-}" != "$required_confirmation" ]; then
  echo "Set RESTORE_CONFIRM=$required_confirmation to restore into a clean database" >&2
  exit 1
fi

uploads_source=$(find "$work" -type d -path '*/data/uploads' -print -quit)
if [ -z "$uploads_source" ]; then
  echo "Restored snapshot does not contain the uploads directory" >&2
  exit 1
fi
if [ -n "$(find "$uploads_source" -type l -print -quit)" ]; then
  echo "Restored uploads contain a symbolic link" >&2
  exit 1
fi
if [ ! -d "$RESTORE_UPLOADS_TARGET" ] || [ ! -w "$RESTORE_UPLOADS_TARGET" ]; then
  echo "RESTORE_UPLOADS_TARGET must exist and be writable" >&2
  exit 1
fi
if [ -n "$(find "$RESTORE_UPLOADS_TARGET" -mindepth 1 -print -quit)" ]; then
  echo "RESTORE_UPLOADS_TARGET must be empty" >&2
  exit 1
fi

export PGPASSWORD=$POSTGRES_PASSWORD
user_tables=$(psql \
  --host "$POSTGRES_HOST" \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  --tuples-only \
  --no-align \
  --command "SELECT count(*) FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog', 'information_schema');")
if [ "$user_tables" != 0 ]; then
  echo "Target PostgreSQL database must not contain user tables" >&2
  exit 1
fi

pg_restore \
  --host "$POSTGRES_HOST" \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  --exit-on-error \
  --no-owner \
  --no-privileges \
  "$dump"
cp -a "$uploads_source/." "$RESTORE_UPLOADS_TARGET/"

duration=$(($(date +%s) - started))
echo "restore mode=apply status=success dump_sha256=$actual_sha duration_seconds=$duration"
