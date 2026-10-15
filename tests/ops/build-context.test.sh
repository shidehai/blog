#!/bin/sh
set -eu
test_dir=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
repository_root=$(CDPATH= cd -- "$test_dir/../.." && pwd)
. "$test_dir/testlib.sh"
work=$(mktemp -d)
trap 'rm -rf -- "$work"' EXIT INT TERM
mkdir -p "$work/source/author-cms" "$work/source/frontend-v2"
printf 'PUBLIC_SAMPLE=value\n' >"$work/source/.env.example"
(cd "$work/source" && node "$repository_root/scripts/assert-build-context.mjs") >"$work/output" 2>&1
assert_file_contains "$work/output" "status=success" "public sample configuration is safe to build"
for relative in .env .env.local author-cms/.env.local frontend-v2/.env.local; do
  printf 'PRIVATE_SECRET=synthetic-context-secret-do-not-log\n' >"$work/source/$relative"
  if (cd "$work/source" && node "$repository_root/scripts/assert-build-context.mjs") >"$work/output" 2>&1; then
    fail_test "runtime configuration must fail image context validation"
  fi
  assert_file_not_contains "$work/output" "synthetic-context-secret-do-not-log" "context diagnostics must not read or expose file contents"
  rm "$work/source/$relative"
done
mkdir "$work/source/.data"
if (cd "$work/source" && node "$repository_root/scripts/assert-build-context.mjs") >"$work/output" 2>&1; then
  fail_test "persistent data must fail image context validation"
fi
pass_test "image context rejects root and nested runtime configuration and persistent data"
