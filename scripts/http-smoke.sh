#!/bin/sh
set -eu

if [ "${1:-}" = -- ]; then
  shift
fi
if [ "${1:-}" = --url ]; then
  shift
fi

base_url=${1:-}
if [ "$#" -lt 1 ]; then
  echo "Usage: http-smoke.sh [--url] https://example.com [path ...]" >&2
  exit 2
fi
shift

case "$base_url" in
  https://*) ;;
  http://*)
    if [ "${ALLOW_HTTP_SMOKE:-0}" != 1 ]; then
      echo "Smoke URL must use HTTPS" >&2
      exit 2
    fi
    ;;
  *)
    echo "Smoke URL must be an absolute HTTP(S) URL" >&2
    exit 2
    ;;
esac
case "$base_url" in
  *[[:space:]?#]*)
    echo "Smoke URL must not contain whitespace, a query, or a fragment" >&2
    exit 2
    ;;
esac
base_url=${base_url%/}

if [ "$#" -eq 0 ]; then
  set -- /healthz /
fi

for path in "$@"; do
  case "$path" in
    /*) ;;
    *)
      echo "Smoke path must begin with /" >&2
      exit 2
      ;;
  esac
  case "$path" in
    *[[:space:]#]*)
      echo "Smoke path must not contain whitespace or a fragment" >&2
      exit 2
      ;;
  esac
  curl \
    --fail \
    --silent \
    --show-error \
    --location \
    --max-time "${SMOKE_TIMEOUT_SECONDS:-15}" \
    --retry "${SMOKE_RETRIES:-2}" \
    --retry-all-errors \
    --output /dev/null \
    "$base_url$path"
done

echo "http smoke status=success base_url=$base_url paths=$#"
