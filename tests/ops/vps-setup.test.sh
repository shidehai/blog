#!/bin/sh
set -eu
test_dir=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
repository_root=$(CDPATH= cd -- "$test_dir/../.." && pwd)
. "$test_dir/testlib.sh"
work=$(mktemp -d)
trap 'rm -rf -- "$work"' EXIT HUP INT TERM
mkdir -p "$work/bin" "$work/project/scripts" "$work/state"
cp "$repository_root/scripts/setup-vps.sh" "$work/project/scripts/"
cat >"$work/bin/git" <<'SH'
#!/bin/sh
echo 123456789abc
SH
# Unit tests do not own a real container's UID 1000 (CI runners may use UID 1001).
cat >"$work/bin/chown" <<'SH'
#!/bin/sh
set -eu
for operand in "$@"; do
  case "$operand" in -R|1000:1000|"$MOCK_TEST_ROOT"/*) ;; *) exit 2 ;; esac
done
printf '%s\n' "$*" >>"$MOCK_STATE/ownership-requests"
SH
cat >"$work/bin/docker" <<'SH'
#!/bin/sh
set -eu
printf '%s\n' "$*" >>"$MOCK_STATE/commands"
case "$1" in
  info) exit 0 ;;
  image)
    case "$*" in
      *blog-site*|*0000000000000001) printf 'sha256:%064d\n' 1 ;;
      *) printf 'sha256:%064d\n' 2 ;;
    esac
    exit 0 ;;
  compose) shift ;;
  *) exit 2 ;;
esac
while [ "$#" -gt 0 ]; do
  case "$1" in --env-file|-f) shift 2 ;; *) break ;; esac
done
case "$1" in
  version|config|up) exit 0 ;;
  build) [ "${MOCK_FAIL_BUILD:-0}" = 0 ]; exit ;;
  exec)
    if [ -f "$MOCK_STATE/owner" ]; then echo t; else echo f; fi ;;
  run)
    case "$*" in
      *owner\ --password-stdin*)
        sha256sum >"$MOCK_STATE/owner"
        echo owner >>"$MOCK_STATE/owner-calls" ;;
      *transfer.mjs\ verify*) [ "${MOCK_FAIL_VERIFY:-0}" = 0 ] ;;
      *transfer.mjs\ restore*) echo restore >>"$MOCK_STATE/restore-calls" ;;
      *manage.mjs\ migrate*) : ;;
      *) exit 2 ;;
    esac ;;
  *) exit 2 ;;
esac
SH
chmod +x "$work/bin/git" "$work/bin/docker" "$work/bin/chown"
export PATH="$work/bin:$PATH"
export MOCK_STATE="$work/state"
export MOCK_TEST_ROOT="$work"
export SITE_DOMAIN=blog.vps.test CMS_DOMAIN=cms.vps.test ACME_EMAIL=owner@vps.test
script=$work/project/scripts/setup-vps.sh
env_file=$work/project/.env
data_root=$work/data

printf 'unrecognized local configuration\n' >"$env_file"
before=$(sha256sum "$env_file")
if sh "$script" --data-dir "$data_root" >"$work/out" 2>&1; then fail_test "must refuse an existing unrelated env"; fi
assert_equal "$before" "$(sha256sum "$env_file")" "existing env must remain unchanged"
[ ! -e "$MOCK_STATE/commands" ] || fail_test "refuse before calling Docker"
rm "$env_file"

mkdir "$data_root"
echo preserve >"$data_root/sentinel"
if sh "$script" --data-dir "$data_root" >"$work/out" 2>&1; then fail_test "must refuse populated new target"; fi
[ -f "$data_root/sentinel" ] && [ ! -e "$env_file" ] || fail_test "populated target must remain intact"
rm "$data_root/sentinel"
if SITE_DOMAIN='https://bad.example.com/path' sh "$script" --data-dir "$data_root" >"$work/out" 2>&1; then fail_test "must refuse invalid domain"; fi
[ ! -e "$env_file" ] || fail_test "invalid domain must not write credentials"

if MOCK_FAIL_BUILD=1 sh "$script" --data-dir "$data_root" >"$work/out" 2>&1; then fail_test "build failures must propagate"; fi
[ -f "$env_file" ] && [ ! -e "$MOCK_STATE/owner" ] || fail_test "failed build preserves retry config without initializing owner"
credentials_before=$(sed -n '/^POSTGRES_PASSWORD=/p;/^CMS_DB_PASSWORD=/p;/^CMS_READ_TOKEN=/p' "$env_file" | sha256sum)
sh "$script" --data-dir "$data_root" >"$work/out" 2>&1
credentials_after=$(sed -n '/^POSTGRES_PASSWORD=/p;/^CMS_DB_PASSWORD=/p;/^CMS_READ_TOKEN=/p' "$env_file" | sha256sum)
assert_equal "$credentials_before" "$credentials_after" "retry must not rotate credentials"
assert_equal 600 "$(stat -c %a "$env_file")" "private env mode"
owner_file=$data_root/bootstrap/owner-password.txt
assert_equal 600 "$(stat -c %a "$owner_file")" "private owner password mode"
assert_file_contains "$env_file" 'BLOG_SETUP_VERSION=1' "owned config has explicit format"
assert_file_contains "$env_file" 'SITE_IMAGE=sha256:' "running application image is immutable"
assert_file_contains "$MOCK_STATE/ownership-requests" "1000:1000 $data_root/cms/media $data_root/backup-staging" "container writable roots use their runtime identity"
assert_file_not_contains "$env_file" 'CMS_OWNER_PASSWORD=' "owner password never enters runtime env"
for name in POSTGRES_PASSWORD CMS_DB_PASSWORD CMS_READ_TOKEN; do
  value=$(sed -n "s/^$name=//p" "$env_file")
  [ "${#value}" -eq 64 ] || fail_test "generated secrets must have 256 bits"
  if grep -Fq -- "$value" "$work/out" "$MOCK_STATE/commands"; then fail_test "credentials leaked in output or argv"; fi
done
owner_before=$(cat "$MOCK_STATE/owner")
echo 'existing writing' >"$data_root/cms/media/sentinel"
sh "$script" --skip-build >"$work/out" 2>&1
assert_equal "$owner_before" "$(cat "$MOCK_STATE/owner")" "rerun preserves owner"
assert_equal 1 "$(wc -l <"$MOCK_STATE/owner-calls" | tr -d ' ')" "rerun must not revoke sessions"
[ -f "$data_root/cms/media/sentinel" ] || fail_test "rerun must preserve media"

mkdir "$work/bundle"
echo '{"synthetic":"bundle"}' >"$work/bundle/bundle.json"
sha256sum "$work/bundle/bundle.json" | cut -d ' ' -f 1 >"$work/bundle/bundle.sha256"
source_before=$(sha256sum "$work/bundle/bundle.json")
if MOCK_FAIL_VERIFY=1 sh "$script" --skip-build --import "$work/bundle" >"$work/out" 2>&1; then fail_test "invalid bundle must refuse restore"; fi
[ ! -e "$MOCK_STATE/restore-calls" ] && [ ! -e "$data_root/bootstrap/imported-bundle.sha256" ] || fail_test "verification failure must not restore or record success"
sh "$script" --skip-build --import "$work/bundle" >"$work/out" 2>&1
sh "$script" --skip-build --import "$work/bundle" >"$work/out" 2>&1
assert_equal 1 "$(wc -l <"$MOCK_STATE/restore-calls" | tr -d ' ')" "repeat import preserves newer writing"
assert_equal "$source_before" "$(sha256sum "$work/bundle/bundle.json")" "original bundle is unchanged"
assert_equal 1 "$(wc -l <"$MOCK_STATE/owner-calls" | tr -d ' ')" "import must preserve existing owner"
echo changed >"$work/bundle/bundle.json"
sha256sum "$work/bundle/bundle.json" | cut -d ' ' -f 1 >"$work/bundle/bundle.sha256"
if sh "$script" --skip-build --import "$work/bundle" >"$work/out" 2>&1; then fail_test "different bundle must not replace previous import"; fi
assert_equal 1 "$(wc -l <"$MOCK_STATE/restore-calls" | tr -d ' ')" "different import must not reach restore"
pass_test "VPS setup refuses unrelated data, retries safely, protects secrets, preserves owner and imports once"
