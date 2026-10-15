#!/bin/sh
set -eu

test_dir=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
repository_root=$(CDPATH= cd -- "$test_dir/../.." && pwd)
. "$test_dir/testlib.sh"

suite_work=$(mktemp -d)
cleanup() {
  rm -rf -- "$suite_work"
}
trap cleanup EXIT INT TERM

export PATH=$test_dir/fixtures:$PATH
export POSTGRES_DB=blog
export POSTGRES_HOST=postgres
export POSTGRES_PASSWORD=fixture-database-password-do-not-log
export POSTGRES_USER=blog
export RESTIC_PASSWORD=fixture-restic-password-do-not-log
export RESTIC_REPOSITORY=rest:http://backup.example.test/
export BACKUP_HOST=fixture-vps
export BACKUP_TAG=personal-journal

setup_case() {
  name=$1
  case_root=$suite_work/$name
  mkdir -p "$case_root/staging" "$case_root/cms-media-source" "$case_root/cms-media-target"
  : >"$case_root/commands.log"
  export MOCK_COMMAND_LOG=$case_root/commands.log
  export BACKUP_STAGING_DIR=$case_root/staging
  export BACKUP_CMS_MEDIA_DIR=$case_root/cms-media-source
  export RESTORE_CMS_MEDIA_TARGET=$case_root/cms-media-target
  export RESTORE_STAGING_DIR=$case_root/staging
  unset MOCK_PG_RESTORE_LIST_FAIL MOCK_RESTIC_BACKUP_FAIL MOCK_USER_TABLES RESTORE_CONFIRM MOCK_BACKUP_FORMAT_VERSION MOCK_MISSING_CMS_MEDIA MOCK_CMS_MEDIA_SYMLINK
}

setup_case backup_success
"$repository_root/scripts/backup.sh" >"$case_root/output" 2>&1
assert_file_contains "$case_root/commands.log" "pg_restore --list" "backup must verify the custom dump"
assert_file_contains "$case_root/commands.log" "restic backup" "verified dump and CMS media must enter Restic"
assert_file_contains "$case_root/commands.log" "$BACKUP_CMS_MEDIA_DIR" "actual CMS media must enter the backup"
assert_file_contains "$case_root/commands.log" "dump-mode 600" "temporary dump must use mode 0600"
assert_file_contains "$case_root/output" "backup status=success" "backup must emit bounded success diagnostics"
assert_file_contains "$case_root/output" "dump_sha256=" "backup must emit checksum evidence"
assert_file_not_contains "$case_root/output" "$POSTGRES_PASSWORD" "backup output must not expose database password"
assert_file_not_contains "$case_root/output" "$RESTIC_PASSWORD" "backup output must not expose Restic password"
assert_empty_directory "$case_root/staging" "successful backup must remove temporary set"
pass_test "backup verifies dump, records checksum, and cleans temporary data"

setup_case invalid_dump
export MOCK_PG_RESTORE_LIST_FAIL=1
if "$repository_root/scripts/backup.sh" >"$case_root/output" 2>&1; then
  fail_test "invalid dump must fail backup"
fi
assert_file_not_contains "$case_root/commands.log" "restic backup" "invalid dump must never create a Restic snapshot"
assert_empty_directory "$case_root/staging" "failed dump validation must clean temporary set"
assert_file_contains "$case_root/output" "backup status=failed" "backup failure must be diagnosable"
pass_test "invalid PostgreSQL dump fails before Restic"

setup_case missing_environment
if (
  unset RESTIC_PASSWORD
  "$repository_root/scripts/backup.sh"
) >"$case_root/output" 2>&1; then
  fail_test "missing Restic password must fail before backup"
fi
assert_file_contains "$case_root/output" "RESTIC_PASSWORD" "missing field diagnostic must name the field"
assert_file_not_contains "$case_root/commands.log" "pg_dump" "missing configuration must fail before pg_dump"
pass_test "backup fails closed at configuration boundary"

setup_case restore_verify
"$repository_root/scripts/restore.sh" verify latest >"$case_root/output" 2>&1
assert_file_contains "$case_root/commands.log" "restic restore latest" "verify must restore a selected snapshot into staging"
assert_file_contains "$case_root/commands.log" "pg_restore --list" "verify must parse the restored custom dump"
assert_file_contains "$case_root/output" "restore mode=verify status=success" "verify evidence must be explicit"
assert_empty_directory "$case_root/staging" "verify must remove restored staging data"
pass_test "restore verify checks manifest and custom dump without applying"

setup_case restore_apply
export RESTORE_CONFIRM=restore-empty:blog
"$repository_root/scripts/restore.sh" apply latest >"$case_root/output" 2>&1
assert_file_contains "$case_root/commands.log" "psql" "apply must prove target database has no user tables"
assert_file_contains "$case_root/commands.log" "pg_restore --host postgres" "apply must import the verified dump"
assert_file_contains "$case_root/output" "restore mode=apply status=success" "apply evidence must be explicit"
assert_empty_directory "$case_root/staging" "apply must remove restored staging data"
assert_file_contains "$case_root/cms-media-target/cms-image.webp" "fixture-cms-media" "apply must restore CMS media bytes"
assert_file_contains "$case_root/cms-media-target/originals/source.svg" "fixture-source-original" "apply must restore private original bytes"
pass_test "clean-room apply restores database, CMS media and originals without an old uploads directory"

setup_case transition_backup
export MOCK_BACKUP_FORMAT_VERSION=1
export RESTORE_CONFIRM=restore-empty:blog
"$repository_root/scripts/restore.sh" apply latest >"$case_root/output" 2>&1
assert_file_contains "$case_root/cms-media-target/cms-image.webp" "fixture-cms-media" "transition backups with CMS media remain recoverable"
pass_test "format 1 with complete CMS media remains recoverable"

for version in 1 2; do
  setup_case "missing_cms_media_$version"
  export MOCK_BACKUP_FORMAT_VERSION=$version
  export MOCK_MISSING_CMS_MEDIA=1
  export RESTORE_CONFIRM=restore-empty:blog
  if "$repository_root/scripts/restore.sh" apply latest >"$case_root/output" 2>&1; then
    fail_test "format $version without CMS media must be refused"
  fi
  assert_file_contains "$case_root/output" "does not contain CMS media" "incomplete snapshots need a clear diagnostic"
  assert_file_not_contains "$case_root/commands.log" "pg_restore --host postgres" "missing media must be detected before importing the database"
  assert_empty_directory "$case_root/cms-media-target" "missing source must preserve the target"
  assert_empty_directory "$case_root/staging" "missing media must clean staging"
done
pass_test "both backup formats refuse missing CMS media before mutation"

setup_case unsupported_format
export MOCK_BACKUP_FORMAT_VERSION=99
if "$repository_root/scripts/restore.sh" verify latest >"$case_root/output" 2>&1; then
  fail_test "unknown backup formats must be refused"
fi
assert_file_contains "$case_root/output" "unsupported format_version" "unknown format needs an explicit failure"
assert_file_not_contains "$case_root/commands.log" "pg_restore --host postgres" "unknown format must never be applied"
pass_test "unknown snapshot formats fail closed"

setup_case symlink_media
export MOCK_CMS_MEDIA_SYMLINK=1
export RESTORE_CONFIRM=restore-empty:blog
if "$repository_root/scripts/restore.sh" apply latest >"$case_root/output" 2>&1; then
  fail_test "CMS media symlinks must be refused"
fi
assert_file_not_contains "$case_root/commands.log" "pg_restore --host postgres" "unsafe media must be detected before database import"
assert_empty_directory "$case_root/cms-media-target" "unsafe media must preserve the target"
pass_test "restore rejects unsafe CMS media before mutation"

setup_case nonempty_restore_target
printf 'existing\n' >"$case_root/cms-media-target/existing.txt"
export RESTORE_CONFIRM=restore-empty:blog
if "$repository_root/scripts/restore.sh" apply latest >"$case_root/output" 2>&1; then
  fail_test "restore must reject a non-empty CMS media target"
fi
assert_file_contains "$case_root/output" "RESTORE_CMS_MEDIA_TARGET must be empty" "non-empty target needs a clear diagnostic"
assert_file_not_contains "$case_root/commands.log" "pg_restore --host postgres" "guard failure must happen before database import"
assert_file_contains "$case_root/cms-media-target/existing.txt" "existing" "existing media must remain intact"
pass_test "restore refuses to overwrite CMS media"

setup_case nonempty_database
export RESTORE_CONFIRM=restore-empty:blog
export MOCK_USER_TABLES=1
if "$repository_root/scripts/restore.sh" apply latest >"$case_root/output" 2>&1; then
  fail_test "restore must reject a database with user tables"
fi
assert_file_contains "$case_root/output" "must not contain user tables" "non-empty database needs a clear diagnostic"
assert_file_not_contains "$case_root/commands.log" "pg_restore --host postgres" "database guard must run before import"
pass_test "restore refuses to overwrite a populated database"

setup_case retention
"$repository_root/scripts/restic-maintenance.sh" forget >"$case_root/output" 2>&1
assert_file_contains "$case_root/commands.log" "--keep-daily 14" "retention must keep fourteen daily snapshots"
assert_file_contains "$case_root/commands.log" "--keep-weekly 8" "retention must keep eight weekly snapshots"
assert_file_contains "$case_root/commands.log" "--keep-monthly 12" "retention must keep twelve monthly snapshots"
assert_file_contains "$case_root/commands.log" "--prune" "prune belongs to the separate maintenance path"
pass_test "Restic retention is separate and explicit"

setup_case freshness
export BACKUP_MAX_AGE_SECONDS=86400
export MOCK_SNAPSHOT_TIME
MOCK_SNAPSHOT_TIME=$(date -u +%Y-%m-%dT%H:%M:%SZ)
"$repository_root/scripts/restic-maintenance.sh" freshness >"$case_root/output" 2>&1
assert_file_contains "$case_root/output" "backup freshness status=success" "current recovery point must satisfy the RPO check"
pass_test "Restic freshness accepts a current scoped snapshot"

setup_case stale_backup
MOCK_SNAPSHOT_TIME=$(date -u -d '2 days ago' +%Y-%m-%dT%H:%M:%SZ)
if "$repository_root/scripts/restic-maintenance.sh" freshness >"$case_root/output" 2>&1; then
  fail_test "stale recovery point must fail the RPO check"
fi
assert_file_contains "$case_root/output" "backup freshness status=failed" "stale recovery point needs a bounded diagnostic"
pass_test "Restic freshness rejects a stale scoped snapshot"
