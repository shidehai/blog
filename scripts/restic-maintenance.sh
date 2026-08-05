#!/bin/sh
set -eu

for name in RESTIC_PASSWORD RESTIC_REPOSITORY; do
  if [ -z "$(printenv "$name" 2>/dev/null)" ]; then
    echo "Missing required environment variable: $name" >&2
    exit 1
  fi
done

mode=${1:-}
tag=${BACKUP_TAG:-personal-journal}
backup_host=${BACKUP_HOST:-personal-journal-vps}
started=$(date +%s)

case "$mode" in
  forget)
    if [ "$#" -ne 1 ]; then
      echo "Usage: restic-maintenance forget" >&2
      exit 2
    fi
    restic forget \
      --host "$backup_host" \
      --tag "$tag" \
      --group-by host,tags \
      --keep-daily 14 \
      --keep-weekly 8 \
      --keep-monthly 12 \
      --prune
    ;;
  check)
    if [ "$#" -ne 1 ]; then
      echo "Usage: restic-maintenance check" >&2
      exit 2
    fi
    if [ -n "${RESTIC_CHECK_SUBSET:-}" ]; then
      restic check --read-data-subset "$RESTIC_CHECK_SUBSET"
    else
      restic check
    fi
    ;;
  freshness)
    if [ "$#" -ne 1 ]; then
      echo "Usage: restic-maintenance freshness" >&2
      exit 2
    fi
    max_age=${BACKUP_MAX_AGE_SECONDS:-86400}
    case "$max_age" in
      "" | *[!0-9]*)
        echo "BACKUP_MAX_AGE_SECONDS must be a positive integer" >&2
        exit 1
        ;;
    esac
    if [ "$max_age" -eq 0 ]; then
      echo "BACKUP_MAX_AGE_SECONDS must be a positive integer" >&2
      exit 1
    fi
    snapshots=$(restic snapshots \
      --host "$backup_host" \
      --tag "$tag" \
      --latest 1 \
      --json)
    snapshot_epoch=$(printf '%s' "$snapshots" | jq -er '
      sort_by(.time)
      | last
      | .time
      | sub("\\.[0-9]+Z$"; "Z")
      | fromdateiso8601
    ')
    age=$(($(date +%s) - snapshot_epoch))
    if [ "$age" -lt 0 ] || [ "$age" -gt "$max_age" ]; then
      echo "backup freshness status=failed age_seconds=$age max_age_seconds=$max_age" >&2
      exit 1
    fi
    echo "backup freshness status=success age_seconds=$age max_age_seconds=$max_age"
    ;;
  *)
    echo "Usage: restic-maintenance {forget|check|freshness}" >&2
    exit 2
    ;;
esac

duration=$(($(date +%s) - started))
echo "restic maintenance=$mode status=success duration_seconds=$duration"
