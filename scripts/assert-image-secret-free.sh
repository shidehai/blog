#!/bin/sh
set -eu

image=${1:-}
if [ "$#" -ne 1 ] || [ -z "$image" ]; then
  echo "Usage: assert-image-secret-free.sh IMAGE" >&2
  exit 2
fi
if [ -z "${DIRECTUS_BUILD_TOKEN:-}" ] || [ "${#DIRECTUS_BUILD_TOKEN}" -lt 16 ]; then
  echo "DIRECTUS_BUILD_TOKEN must be set for the image inspection" >&2
  exit 2
fi

umask 077
work=$(mktemp -d)
cleanup() {
  status=$?
  trap - EXIT HUP INT TERM
  rm -rf -- "$work"
  exit "$status"
}
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM
trap cleanup EXIT

docker history --no-trunc "$image" >"$work/history.txt"
docker image inspect "$image" >"$work/inspect.json"
docker save --output "$work/image.tar" "$image"

if grep -Fq -- "$DIRECTUS_BUILD_TOKEN" "$work/history.txt" ||
  grep -Fq -- "$DIRECTUS_BUILD_TOKEN" "$work/inspect.json" ||
  grep -aFq -- "$DIRECTUS_BUILD_TOKEN" "$work/image.tar"; then
  echo "Build credential was found in Docker image metadata or layers" >&2
  exit 1
fi
if docker image inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$image" |
  grep -Eq '^(CONTENT_SOURCE|DIRECTUS_(URL|BUILD_TOKEN|PREVIEW_TOKEN)|PREVIEW_TRUSTED_HEADER|SITE_URL)='; then
  echo "CMS build or preview configuration is present in the runtime environment" >&2
  exit 1
fi

echo "image secret inspection status=success image=$image"
