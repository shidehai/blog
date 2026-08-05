#!/bin/sh
set -eu

script_dir=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
repository_root=$(CDPATH= cd -- "$script_dir/.." && pwd)
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

find "$repository_root/scripts" -maxdepth 1 -type f -name '*.sh' -print |
  while IFS= read -r script; do
    sh -n "$script"
  done
find "$repository_root/tests/ops" -maxdepth 1 -type f -name '*.sh' -print 2>/dev/null |
  while IFS= read -r test_script; do
    sh -n "$test_script"
  done

mkdir -p \
  "$work/data/postgres" \
  "$work/data/directus/uploads" \
  "$work/data/caddy/data" \
  "$work/data/caddy/config" \
  "$work/data/caddy/logs" \
  "$work/data/backup-staging"

env_file=$work/compose.env
cat >"$env_file" <<EOF
COMPOSE_PROJECT_NAME=personal-journal-validation
SITE_DOMAIN=blog.example.test
CMS_DOMAIN=cms.example.test
SITE_URL=https://blog.example.test
ACME_EMAIL=owner@example.test
SITE_IMAGE=ghcr.io/example/personal-journal@sha256:0000000000000000000000000000000000000000000000000000000000000000
BLOG_DATA_ROOT=$work/data
POSTGRES_DB=blog
POSTGRES_USER=blog
POSTGRES_PASSWORD=fixture-database-password
DIRECTUS_SECRET=fixture-directus-secret-at-least-32-characters
DIRECTUS_LICENSE_KEY=
DIRECTUS_PREVIEW_TOKEN=fixture-preview-token-at-least-24-characters
GITHUB_DISPATCH_TOKEN=
GITHUB_REPOSITORY=example/personal-journal
PREVIEW_BASIC_USER=owner
PREVIEW_BASIC_PASSWORD_HASH=fixture-hash-for-compose-rendering
PREVIEW_TRUSTED_HEADER=fixture-trusted-header-at-least-24-characters
RESTIC_REPOSITORY=rest:http://backup.example.test/
RESTIC_PASSWORD=fixture-restic-password
EOF

compose_file=$repository_root/deploy/compose.yaml
dev_file=$repository_root/deploy/compose.dev.yaml
docker compose \
  --env-file "$env_file" \
  --file "$compose_file" \
  --profile backup \
  --profile restore \
  --profile maintenance \
  config --format json |
  node "$script_dir/validate-compose.mjs"
docker compose \
  --env-file "$env_file" \
  -f "$compose_file" \
  -f "$dev_file" \
  --profile backup \
  --profile restore \
  --profile maintenance \
  config --quiet

docker run --rm \
  --env ACME_EMAIL=owner@example.test \
  --env CMS_DOMAIN=cms.example.test \
  --env PREVIEW_BASIC_PASSWORD_HASH='$2a$14$abcdefghijklmnopqrstuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuu' \
  --env PREVIEW_BASIC_USER=owner \
  --env PREVIEW_TRUSTED_HEADER=fixture-trusted-header-at-least-24-characters \
  --env SITE_DOMAIN=blog.example.test \
  --volume "$repository_root/deploy/Caddyfile:/etc/caddy/Caddyfile:ro" \
  caddy:2.10.2-alpine \
  caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile

if [ "${OPS_BUILD_IMAGES:-0}" = 1 ]; then
  docker build \
    --file "$repository_root/deploy/backup.Dockerfile" \
    --tag personal-journal-ops:validation \
    "$repository_root"
fi

echo "operations validation status=success"
