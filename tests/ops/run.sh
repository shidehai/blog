#!/bin/sh
set -eu

test_dir=$(CDPATH= cd -- "$(dirname "$0")" && pwd)

for test_script in \
  "$test_dir/static-contract.test.sh" \
  "$test_dir/deploy.test.sh" \
  "$test_dir/backup-restore.test.sh"; do
  "$test_script"
done

echo "operations tests status=success"
