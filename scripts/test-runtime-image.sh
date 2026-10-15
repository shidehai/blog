#!/bin/sh
set -eu

image=${1:-}
if [ "$#" -ne 1 ] || [ -z "$image" ]; then
  echo "Usage: test-runtime-image.sh IMAGE" >&2
  exit 2
fi

container="blog-runtime-test-$$"
cleanup() {
  status=$?
  trap - EXIT HUP INT TERM
  docker rm --force "$container" >/dev/null 2>&1 || true
  exit "$status"
}
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM
trap cleanup EXIT

docker run \
  --detach \
  --name "$container" \
  --env CONTENT_SOURCE=fixture \
  --env SITE_URL=http://blog.example.test \
  --read-only \
  --tmpfs /tmp \
  --cap-drop ALL \
  --security-opt no-new-privileges \
  "$image" >/dev/null

deadline=$(($(date +%s) + 60))
health=missing
while [ "$(date +%s)" -le "$deadline" ]; do
  health=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}missing{{end}}' "$container")
  if [ "$health" = healthy ]; then
    break
  fi
  if [ "$(docker inspect --format '{{.State.Status}}' "$container")" != running ]; then
    echo "Runtime image exited before becoming healthy" >&2
    exit 1
  fi
  sleep 1
done
[ "$health" = healthy ] || {
  echo "Runtime image did not become healthy" >&2
  exit 1
}

docker exec -i "$container" node <<'JS'
  const assert = require("node:assert/strict");
  const { existsSync } = require("node:fs");
  assert.equal(process.version, "v24.22.0");
  for (const directory of ["/usr/local/lib/node_modules/npm", "/usr/local/lib/node_modules/corepack", "/opt/yarn-v1.22.22"]) assert.equal(existsSync(directory), false);
  const {createRequire} = require("node:module");
  const applicationRequire = createRequire("/app/frontend-v2/server.js");
  assert.equal(applicationRequire("next/package.json").version, "15.5.28");
  const notices = require("node:fs").readFileSync("/app/THIRD_PARTY_NOTICES.txt", "utf8");
  if (!notices.includes("Permission is hereby granted") || !notices.includes("LGPLv3")) process.exit(1);
  assert.ok(notices.includes("@fontsource-variable/jetbrains-mono@5.3.0"));
  Promise.all([
    fetch("http://127.0.0.1:4321/healthz"),
    fetch("http://127.0.0.1:4321/"),
  ]).then(async (responses) => {
    if (responses.some((response) => !response.ok)) process.exit(1);
    const html = await responses[1].text();
    const canonical = html.match(/rel="canonical" href="([^"]+)"/);
    assert.ok(canonical);
    assert.equal(new URL(canonical[1]).href, "http://blog.example.test/");
    assert.ok(html.includes("http://blog.example.test/share.png"));
    const share = await fetch("http://127.0.0.1:4321/share.png");
    assert.equal(share.status, 200);
    const png = Buffer.from(await share.arrayBuffer());
    assert.equal(png.readUInt32BE(16), 1200);
    assert.equal(png.readUInt32BE(20), 630);
    assert.equal((await fetch("http://127.0.0.1:4321/_next/image?url=%2Fshare.png&w=1200&q=75")).status, 404);
  }).catch(() => process.exit(1));
JS

user=$(docker image inspect --format '{{.Config.User}}' "$image")
[ "$user" = node ] || {
  echo "Runtime image must use the node user" >&2
  exit 1
}

if docker image inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$image" |
  grep -Eq '^(CMS_INTERNAL_URL|CMS_READ_TOKEN|DATABASE_URL|DIRECTUS_(URL|BUILD_TOKEN|PREVIEW_TOKEN)|PREVIEW_TRUSTED_HEADER|SITE_URL)='; then
  echo "Runtime image must not contain CMS build or preview configuration" >&2
  exit 1
fi

echo "runtime image test status=success image=$image"
