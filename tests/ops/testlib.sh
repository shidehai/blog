#!/bin/sh

fail_test() {
  echo "not ok - $1" >&2
  exit 1
}

assert_equal() {
  expected=$1
  actual=$2
  message=$3
  [ "$expected" = "$actual" ] ||
    fail_test "$message (expected '$expected', got '$actual')"
}

assert_file_contains() {
  file=$1
  expected=$2
  message=$3
  grep -Fq -- "$expected" "$file" || fail_test "$message"
}

assert_file_not_contains() {
  file=$1
  unexpected=$2
  message=$3
  if grep -Fq -- "$unexpected" "$file"; then
    fail_test "$message"
  fi
}

assert_empty_directory() {
  directory=$1
  message=$2
  [ -z "$(find "$directory" -mindepth 1 -print -quit)" ] || fail_test "$message"
}

pass_test() {
  echo "ok - $1"
}
