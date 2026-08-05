#!/bin/sh
set -eu

original_command=${SSH_ORIGINAL_COMMAND:-}
if [ -z "$original_command" ]; then
  echo "Forced deployment command requires one digest reference" >&2
  exit 2
fi
if [ "$(printf '%s' "$original_command" | wc -l | tr -d ' ')" -ne 0 ]; then
  echo "Deployment command contains a line break" >&2
  exit 2
fi

script_dir=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
exec "$script_dir/deploy-site.sh" "$original_command"
