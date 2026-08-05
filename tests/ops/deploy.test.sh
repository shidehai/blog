#!/bin/sh
set -eu

test_dir=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
repository_root=$(CDPATH= cd -- "$test_dir/../.." && pwd)
. "$test_dir/testlib.sh"

old_ref=ghcr.io/example/personal-journal@sha256:1111111111111111111111111111111111111111111111111111111111111111
target_ref=ghcr.io/example/personal-journal@sha256:2222222222222222222222222222222222222222222222222222222222222222
stale_ref=ghcr.io/example/personal-journal@sha256:3333333333333333333333333333333333333333333333333333333333333333

suite_work=$(mktemp -d)
cleanup() {
  rm -rf -- "$suite_work"
}
trap cleanup EXIT INT TERM

setup_case() {
  name=$1
  case_root=$suite_work/$name
  mkdir -p "$case_root/mock" "$case_root/state"
  : >"$case_root/mock/docker.log"
  : >"$case_root/mock/smoke.log"
  : >"$case_root/compose.env"
  : >"$case_root/compose.yaml"
  printf '%s' "$old_ref" >"$case_root/mock/running-image"
  printf '%s' "$target_ref" >"$case_root/mock/target-image"
  printf '%s' "$stale_ref" >"$case_root/mock/stale-image"

  export MOCK_STATE_DIR=$case_root/mock
  export PATH=$test_dir/fixtures:$PATH
  export BLOG_DEPLOY_CONFIG=$case_root/no-config
  export DEPLOY_COMPOSE_ENV_FILE=$case_root/compose.env
  export DEPLOY_COMPOSE_FILE=$case_root/compose.yaml
  export DEPLOY_HTTP_SMOKE_SCRIPT=$test_dir/fixtures/http-smoke
  export DEPLOY_IMAGE_REPOSITORY=ghcr.io/example/personal-journal
  export DEPLOY_PREFLIGHT_PATHS='/healthz /'
  export DEPLOY_SMOKE_URL=https://blog.example.test
  export DEPLOY_STATE_DIR=$case_root/state
  export DEPLOY_TIMEOUT_SECONDS=2
  unset MOCK_CANDIDATE_FAIL MOCK_CANDIDATE_ROUTE_FAIL MOCK_REPLACE_FAIL MOCK_SMOKE_FAIL_ONCE
}

setup_case invalid
if "$repository_root/scripts/deploy-site.sh" "$target_ref" extra >"$case_root/output" 2>&1; then
  fail_test "deployment must reject extra arguments"
fi
assert_file_contains "$case_root/output" "expected_one_digest_reference" "extra arguments need a bounded diagnostic"
if "$repository_root/scripts/deploy-site.sh" "${target_ref}:tag" >"$case_root/output" 2>&1; then
  fail_test "deployment must reject a tag or suffix"
fi
assert_file_not_contains "$case_root/mock/docker.log" "docker pull" "invalid input must fail before Docker"
pass_test "digest allow-list rejects tags and extra arguments"

setup_case candidate_failure
export MOCK_CANDIDATE_FAIL=1
if "$repository_root/scripts/deploy-site.sh" "$target_ref" >"$case_root/output" 2>&1; then
  fail_test "unhealthy candidate must fail deployment"
fi
assert_equal "$old_ref" "$(cat "$case_root/mock/running-image")" "candidate failure must preserve running image"
assert_file_not_contains "$case_root/mock/docker.log" "compose-up" "candidate failure must not replace traffic"
[ ! -e "$case_root/state/previous-image" ] || fail_test "candidate failure must not invent rollback state"
pass_test "candidate failure never reaches traffic"

setup_case success
"$repository_root/scripts/deploy-site.sh" "$target_ref" >"$case_root/output" 2>&1
assert_equal "$target_ref" "$(cat "$case_root/mock/running-image")" "successful deploy must replace site"
assert_equal "$target_ref" "$(cat "$case_root/state/current-image")" "successful deploy must record current digest"
assert_equal "$old_ref" "$(cat "$case_root/state/previous-image")" "successful deploy must record prior digest"
assert_equal "SITE_IMAGE=$target_ref" "$(cat "$case_root/state/site-image.env")" "Compose image override must persist"
[ ! -e "$case_root/state/pending-deploy.env" ] || fail_test "successful deploy must clear pending state"
assert_file_contains "$case_root/mock/docker.log" "compose-up $target_ref" "target must replace the site service"
assert_file_contains "$case_root/mock/docker.log" "caddy-reload $target_ref" "Caddy must reload after replacement"
assert_file_contains "$case_root/mock/docker.log" "image-rm $stale_ref" "scoped cleanup must remove stale repository digest"
assert_file_not_contains "$case_root/mock/docker.log" "image-rm $old_ref" "cleanup must protect rollback digest"
pass_test "successful candidate replacement records current and prior digests"

setup_case rollback
export MOCK_SMOKE_FAIL_ONCE=1
if "$repository_root/scripts/deploy-site.sh" "$target_ref" >"$case_root/output" 2>&1; then
  fail_test "failed post-replacement smoke must report deployment failure"
fi
assert_equal "$old_ref" "$(cat "$case_root/mock/running-image")" "failed smoke must restore prior image"
assert_equal "$old_ref" "$(cat "$case_root/state/current-image")" "rollback must record prior as current"
assert_equal "$old_ref" "$(cat "$case_root/state/previous-image")" "rollback digest must remain protected"
assert_equal "SITE_IMAGE=$old_ref" "$(cat "$case_root/state/site-image.env")" "Compose override must point at restored digest"
[ ! -e "$case_root/state/pending-deploy.env" ] || fail_test "successful rollback must clear pending state"
assert_file_contains "$case_root/mock/docker.log" "compose-up $target_ref" "test must switch to candidate before smoke failure"
assert_file_contains "$case_root/mock/docker.log" "compose-up $old_ref" "smoke failure must recreate prior site"
assert_file_contains "$case_root/output" "rollback=success" "rollback must be visible in bounded diagnostics"
assert_equal 2 "$(wc -l <"$case_root/mock/smoke.log" | tr -d ' ')" "replacement and rollback both need external smoke"
pass_test "post-replacement smoke failure automatically restores prior digest"

setup_case interrupted_recovery
printf '%s' "$target_ref" >"$case_root/mock/running-image"
cat >"$case_root/state/pending-deploy.env" <<EOF
target_image=$target_ref
prior_image=$old_ref
started_at=2026-08-04T00:00:00Z
EOF
"$repository_root/scripts/deploy-site.sh" "$target_ref" >"$case_root/output" 2>&1
assert_equal "$target_ref" "$(cat "$case_root/state/current-image")" "recovery must retain a healthy switched image"
assert_equal "$old_ref" "$(cat "$case_root/state/previous-image")" "recovery must retain the interrupted rollback digest"
assert_equal "SITE_IMAGE=$target_ref" "$(cat "$case_root/state/site-image.env")" "recovery must persist the switched image override"
[ ! -e "$case_root/state/pending-deploy.env" ] || fail_test "successful recovery must clear pending state"
assert_file_contains "$case_root/mock/docker.log" "caddy-reload $target_ref" "recovery must refresh Caddy DNS"
assert_file_contains "$case_root/output" "recovery=completed" "interrupted recovery must be diagnosable"
pass_test "interrupted post-switch deployment is reconciled from actual state"

setup_case interrupted_rollback
printf '%s' "$target_ref" >"$case_root/mock/running-image"
cat >"$case_root/state/pending-deploy.env" <<EOF
target_image=$target_ref
prior_image=$old_ref
started_at=2026-08-04T00:00:00Z
EOF
export MOCK_SMOKE_FAIL_ONCE=1
if "$repository_root/scripts/deploy-site.sh" "$target_ref" >"$case_root/output" 2>&1; then
  fail_test "failed interrupted target smoke must report deployment failure"
fi
assert_equal "$old_ref" "$(cat "$case_root/mock/running-image")" "failed interrupted target must restore prior image"
assert_equal "$old_ref" "$(cat "$case_root/state/current-image")" "recovered rollback must record the prior image"
[ ! -e "$case_root/state/pending-deploy.env" ] || fail_test "successful recovered rollback must clear pending state"
assert_file_contains "$case_root/output" "rollback=success" "recovered rollback must be visible"
pass_test "interrupted target is rolled back when its external smoke fails"

setup_case idempotent
printf '%s' "$target_ref" >"$case_root/mock/running-image"
"$repository_root/scripts/deploy-site.sh" "$target_ref" >"$case_root/output" 2>&1
assert_file_not_contains "$case_root/mock/docker.log" "docker pull" "idempotent deployment must not pull"
assert_file_not_contains "$case_root/mock/docker.log" "compose-up" "idempotent deployment must not recreate site"
assert_file_contains "$case_root/output" "already_deployed" "idempotent result must be explicit"
pass_test "same digest deployment is idempotent"

setup_case forced_command
export SSH_ORIGINAL_COMMAND="$target_ref extra"
if "$repository_root/scripts/forced-deploy.sh" >"$case_root/output" 2>&1; then
  fail_test "forced command must reject an appended shell command"
fi
assert_file_not_contains "$case_root/mock/docker.log" "docker pull" "forced command injection must fail before Docker"
pass_test "forced SSH entrypoint preserves one bounded argument"
