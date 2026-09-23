#!/bin/sh
set -eu

test_dir=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
repository_root=$(CDPATH= cd -- "$test_dir/../.." && pwd)
. "$test_dir/testlib.sh"

caddy=$repository_root/deploy/Caddyfile
compose=$repository_root/deploy/compose.yaml
workflow=$repository_root/.github/workflows/publish.yml
bootstrap=$repository_root/directus/bootstrap.mjs

assert_file_contains "$caddy" "/_next/static/*" "Next static assets need an explicit cache policy"
assert_file_contains "$caddy" "img-src 'self' data: https://{\$CMS_DOMAIN}" "public CSP must allow emitted Directus media"
assert_file_contains "$caddy" "script-src 'self' 'unsafe-inline'" "Next hydration needs the documented inline-script policy"
assert_file_contains "$caddy" "public, max-age=31536000, immutable" "hashed assets need immutable caching"
assert_file_contains "$caddy" "public, max-age=0, must-revalidate" "documents need revalidation"
assert_file_contains "$caddy" "private, no-store" "CMS must be private/no-store"
if grep -Eq '/preview|PREVIEW_|Preview|sha256-' "$caddy"; then
  fail_test "Caddy must not retain preview routing or stale CSP hashes"
fi

assert_file_contains "$compose" "image: directus/directus:12.2.0" "Directus image must remain pinned"
assert_file_contains "$compose" "image: postgres:17.9-alpine" "PostgreSQL image must remain pinned"
assert_file_contains "$compose" "profiles: [restore]" "restore must be opt-in"
assert_file_contains "$compose" "profiles: [maintenance]" "Restic maintenance must be opt-in"
if grep -Eq 'DIRECTUS_(BUILD_TOKEN|PREVIEW_TOKEN)|PREVIEW_|CONTENT_SOURCE|SITE_URL' "$compose"; then
  fail_test "production Compose must not inject build-time CMS or preview settings"
fi

assert_file_contains "$workflow" "repository_dispatch:" "Directus publication must converge on CI"
assert_file_contains "$workflow" "types: [directus-publish]" "workflow dispatch type must match Directus"
assert_file_contains "$bootstrap" '"event_type":"directus-publish"' "Directus dispatch type must match workflow"
assert_file_contains "$bootstrap" 'type: "notification"' "dispatch failure must create an owner-visible Directus notification"
assert_file_contains "$bootstrap" "reject: dispatchFailure.id" "GitHub request failure must follow the notification branch"
assert_file_contains "$workflow" "cancel-in-progress: true" "stale production builds must cancel"
assert_file_contains "$workflow" "--secret id=directus_build_token,env=DIRECTUS_BUILD_TOKEN" "build token must use BuildKit secret mount"
assert_file_contains "$workflow" "StrictHostKeyChecking=yes" "VPS host key checking must be strict"
assert_file_contains "$workflow" "imagetools inspect" "deployment identity must resolve from registry digest"
if grep -Eq 'playwright install|verify-csp-hash|SITE_URL' "$workflow"; then
  fail_test "CI must not retain deleted browser, CSP-hash, or unused site-url steps"
fi

flow_definition=$(sed -n '/const flow = await upsert/,/const dispatch = await upsert/p' "$bootstrap")
for scope in items.create items.update items.delete; do
  case "$flow_definition" in
    *\"$scope\"*) ;;
    *) fail_test "Directus publication Flow must cover $scope" ;;
  esac
done
for collection in posts topics posts_topics site_settings social_links directus_files; do
  case "$flow_definition" in
    *\"$collection\"*) ;;
    *) fail_test "Directus publication Flow must cover $collection" ;;
  esac
done
if grep -R -F 'directus-content' "$workflow" "$bootstrap" >/dev/null; then
  fail_test "legacy Directus dispatch type must not remain"
fi

if grep -R -E 'docker (system|image|builder|volume) prune' \
  "$repository_root/scripts" "$repository_root/docs/operations" >/dev/null; then
  fail_test "generic Docker prune must not be used"
fi

find "$repository_root/scripts" -maxdepth 1 -type f -name '*.sh' -print |
  while IFS= read -r script; do
    sh -n "$script" || fail_test "shell syntax failed for $script"
  done

pass_test "static operations contracts"
