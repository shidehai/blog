#!/bin/sh
set -eu

data_root=${BLOG_DATA_ROOT:?Set BLOG_DATA_ROOT}
max_percent=${BLOG_CAPACITY_MAX_PERCENT:-85}

case "$max_percent" in
  "" | *[!0-9]*)
    echo "BLOG_CAPACITY_MAX_PERCENT must be an integer" >&2
    exit 2
    ;;
esac
if [ "$max_percent" -le 0 ] || [ "$max_percent" -ge 100 ]; then
  echo "BLOG_CAPACITY_MAX_PERCENT must be between 1 and 99" >&2
  exit 2
fi
[ -d "$data_root" ] || {
  echo "BLOG_DATA_ROOT does not exist" >&2
  exit 1
}

disk_percent=$(df -P "$data_root" | awk 'NR == 2 { gsub(/%/, "", $5); print $5 }')
inode_percent=$(df -Pi "$data_root" | awk 'NR == 2 { gsub(/%/, "", $5); print $5 }')
for value in "$disk_percent" "$inode_percent"; do
  case "$value" in
    "" | *[!0-9]*)
      echo "Could not read capacity for BLOG_DATA_ROOT" >&2
      exit 1
      ;;
  esac
done

if [ "$disk_percent" -ge "$max_percent" ] || [ "$inode_percent" -ge "$max_percent" ]; then
  echo "capacity status=failed disk_percent=$disk_percent inode_percent=$inode_percent threshold=$max_percent" >&2
  exit 1
fi

echo "capacity status=success disk_percent=$disk_percent inode_percent=$inode_percent threshold=$max_percent"
