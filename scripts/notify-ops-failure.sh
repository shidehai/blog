#!/bin/sh
set -eu

unit=${1:-}
if [ "$#" -ne 1 ]; then
  echo "Usage: notify-ops-failure.sh SYSTEMD_UNIT" >&2
  exit 2
fi
case "$unit" in
  "" | *[!A-Za-z0-9_.@-]*)
    echo "Invalid systemd unit name" >&2
    exit 2
    ;;
esac
: "${OPS_ALERT_WEBHOOK_URL:?Set OPS_ALERT_WEBHOOK_URL}"
case "$OPS_ALERT_WEBHOOK_URL" in
  https://*) ;;
  *)
    echo "OPS_ALERT_WEBHOOK_URL must use HTTPS" >&2
    exit 2
    ;;
esac

payload=$(printf '{"text":"Personal journal operation failed: %s"}' "$unit")
curl \
  --fail \
  --silent \
  --show-error \
  --max-time 15 \
  --retry 2 \
  --retry-all-errors \
  --header 'Content-Type: application/json' \
  --data-binary "$payload" \
  --output /dev/null \
  "$OPS_ALERT_WEBHOOK_URL"

echo "operations alert status=sent unit=$unit"
