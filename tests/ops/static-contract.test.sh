#!/bin/sh
set -eu
test_dir=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
repository_root=$(CDPATH= cd -- "$test_dir/../.." && pwd)
. "$test_dir/testlib.sh"
caddy=$repository_root/deploy/Caddyfile
compose=$repository_root/deploy/compose.yaml
workflow=$repository_root/.github/workflows/publish.yml
assert_file_contains "$caddy" "/_next/static/*" "fingerprinted assets need immutable caching"
assert_file_contains "$caddy" "public, max-age=31536000, immutable" "code assets retain long caching"
assert_file_contains "$caddy" "private, no-store" "content and media must not retain withdrawn publications"
assert_file_contains "$caddy" "reverse_proxy cms:4322" "CMS domain must reach the custom application"
assert_file_contains "$caddy" "script-src 'self' 'unsafe-inline'" "Next hydration policy is explicit"
assert_file_contains "$compose" "CMS_INTERNAL_URL: http://cms:4322" "site reads internal published projections"
assert_file_contains "$compose" "CMS_READ_TOKEN:" "reader credential is injected only at runtime"
assert_file_contains "$compose" "target: /data/cms-media" "persistent media must be backed up"
assert_file_contains "$compose" "image: postgres:17.9-alpine" "database stays pinned"
assert_file_contains "$compose" "RESTORE_CMS_MEDIA_TARGET:" "restore includes actual CMS media"
assert_file_contains "$workflow" "StrictHostKeyChecking=yes" "deploy keeps strict host verification"
assert_file_contains "$workflow" "imagetools inspect" "code deployment uses registry digests"
assert_file_contains "$workflow" "--target cms-runtime" "CMS image is built by code CI"
if grep -Eq 'repository_dispatch|directus_build_token|DIRECTUS_BUILD_TOKEN|DIRECTUS_URL' "$workflow"; then
  fail_test "content publication must not trigger or configure image builds"
fi
if grep -Eq 'directus:|DIRECTUS_|GITHUB_DISPATCH' "$compose"; then
  fail_test "normal production topology must not depend on Directus"
fi
if grep -R -E 'docker (system|image|builder|volume) prune' "$repository_root/scripts" "$repository_root/docs/operations" >/dev/null; then
  fail_test "generic Docker prune must not be used"
fi
node --input-type=module - "$workflow" <<'NODE'
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const workflow=readFileSync(process.argv[2],"utf8");
const publish=workflow.slice(workflow.indexOf("\n  publish:\n"));
assert.match(publish,/if: >-\s+github.event_name == 'workflow_dispatch'/);
assert.match(workflow,/CMS_TEST_DATABASE_URL:/,"CI runs real database integration checks");
assert.match(workflow,/needs: quality/,"publish requires application and container gates");
NODE
find "$repository_root/scripts" -maxdepth 1 -type f -name '*.sh' -print | while IFS= read -r script; do sh -n "$script"; done
pass_test "runtime CMS and operations contracts"
