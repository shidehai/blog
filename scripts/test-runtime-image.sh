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
  --read-only \
  --tmpfs /tmp \
  --cap-drop ALL \
  --security-opt no-new-privileges \
  --env CONTENT_SOURCE=fixture \
  --env DIRECTUS_PREVIEW_TOKEN=fixture-preview-token-at-least-24-characters \
  --env DIRECTUS_URL=http://127.0.0.1:8055 \
  --env PREVIEW_TRUSTED_HEADER=fixture-trusted-header-at-least-24-characters \
  --env SITE_URL=https://blog.example.test \
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

docker exec "$container" node -e '
  Promise.all([
    fetch("http://127.0.0.1:4321/healthz"),
    fetch("http://127.0.0.1:4321/"),
  ]).then((responses) => {
    if (responses.some((response) => !response.ok)) process.exit(1);
  }).catch(() => process.exit(1));
'

user=$(docker image inspect --format '{{.Config.User}}' "$image")
[ "$user" = node ] || {
  echo "Runtime image must use the node user" >&2
  exit 1
}

echo "runtime image test status=success image=$image"
