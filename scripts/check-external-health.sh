#!/bin/sh
set -eu

script_dir=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
: "${DEPLOY_SMOKE_URL:?Set DEPLOY_SMOKE_URL}"

exec "$script_dir/http-smoke.sh" "$DEPLOY_SMOKE_URL" /healthz /
