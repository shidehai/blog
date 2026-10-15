#!/bin/sh
set -eu
umask 077

script_dir=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
repository_root=$(CDPATH= cd -- "$script_dir/.." && pwd)
env_file=$repository_root/.env
data_root=/srv/blog/data
import_source=
compose_override=
skip_build=0
temporary_env=
import_copy=

fail() { printf '%s\n' "$1" >&2; exit 1; }
usage() {
  echo "首次部署：sh scripts/setup-vps.sh [--import 内容包目录]"
  echo "可选：--env-file FILE --data-dir DIR --compose-override FILE --skip-build"
  echo "非交互输入：SITE_DOMAIN、ACME_EMAIL；后台固定使用 /admin。不会读取密码环境变量。"
}
while [ "$#" -gt 0 ]; do
  case "$1" in
    --import|--env-file|--data-dir|--compose-override)
      [ "$#" -ge 2 ] || fail "选项缺少参数。"
      case "$1" in
        --import) import_source=$2 ;;
        --env-file) env_file=$2 ;;
        --data-dir) data_root=$2 ;;
        --compose-override) compose_override=$2 ;;
      esac
      shift 2 ;;
    --skip-build) skip_build=1; shift ;;
    --help|-h) usage; exit 0 ;;
    *) usage; fail "未知选项。" ;;
  esac
done
cd "$repository_root"
case "$env_file" in /*) ;; *) env_file=$repository_root/$env_file ;; esac
env_file=$(realpath -m "$env_file")
case "$env_file" in
  "$repository_root"/.env|"$repository_root"/.env.*|"$repository_root"/.data/*|"$repository_root"/data/*|"$repository_root"/backups/*) ;;
  "$repository_root"/*) fail "私有配置需放在 .env、已忽略的数据目录或代码仓库之外。" ;;
esac
[ ! -L "$env_file" ] || fail "配置不能是符号链接。"
read_setting() { sed -n "s/^$1=//p" "$env_file"; }
if [ -e "$env_file" ]; then
  [ -f "$env_file" ] && [ "$(read_setting BLOG_SETUP_VERSION)" = 1 ] ||
    fail "已有非本脚本生成的配置；已停止，避免改动本地或现有服务。请在 VPS 的全新检出运行。"
fi
command -v docker >/dev/null 2>&1 || fail "请先安装 Docker Engine 和 Compose 插件。"
command -v flock >/dev/null 2>&1 || fail "需要系统的 flock 命令（Debian 的 util-linux）。"
docker compose version >/dev/null
docker info >/dev/null 2>&1 || fail "无法连接 Docker，请检查服务和权限。"
if [ -n "$compose_override" ]; then
  compose_override=$(realpath "$compose_override")
  [ -f "$compose_override" ] || fail "额外 Compose 文件不存在。"
fi
if [ -n "$import_source" ]; then
  import_source=$(realpath "$import_source")
  [ -f "$import_source/bundle.json" ] && [ -f "$import_source/bundle.sha256" ] ||
    fail "--import 需要完整 CMS 内容包目录。"
  [ -z "$(find "$import_source" -type l -print -quit)" ] || fail "内容包不能含符号链接。"
fi
cleanup() {
  status=$?
  trap - EXIT HUP INT TERM
  [ -z "$temporary_env" ] || rm -f -- "$temporary_env"
  [ -z "$import_copy" ] || rm -rf -- "$import_copy"
  exit "$status"
}
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM
trap cleanup EXIT
exec 9>"$env_file.setup.lock"
flock -n 9 || fail "已有初始化正在运行。"
random_secret() { od -An -N32 -tx1 /dev/urandom | tr -d ' \n'; }
release=$(git rev-parse --short=12 HEAD)
if [ ! -e "$env_file" ]; then
  site_domain=${SITE_DOMAIN:-}
  acme_email=${ACME_EMAIL:-}
  if [ -z "$site_domain" ]; then printf '博客域名（不带 https://）：'; IFS= read -r site_domain; fi
  if [ -z "$acme_email" ]; then printf 'HTTPS 证书联系邮箱：'; IFS= read -r acme_email; fi
  for domain in "$site_domain"; do
    [ "${#domain}" -le 253 ] && printf '%s\n' "$domain" | LC_ALL=C grep -Eq '^[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$' ||
      fail "域名格式无效；只填写完整域名，不含协议、端口或路径。"
    case "$domain" in blog.example.com|cms.example.com) fail "请填写自己的真实域名。" ;; esac
  done
  printf '%s\n' "$acme_email" | LC_ALL=C grep -Eq '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' || fail "邮箱格式无效。"
  project_name=${COMPOSE_PROJECT_NAME:-blog}
  printf '%s\n' "$project_name" | LC_ALL=C grep -Eq '^[a-z0-9][a-z0-9_-]*$' || fail "Compose 项目名无效。"
  case "$data_root" in /*) ;; *) fail "数据目录需要绝对路径。" ;; esac
  case "$data_root" in /|*..*|*[!A-Za-z0-9_./-]*) fail "请使用独立的普通绝对数据目录。" ;; esac
  data_root=$(realpath -m "$data_root")
  case "$data_root" in
    "$repository_root"/.data/*|"$repository_root"/data/*|"$repository_root"/backups/*) ;;
    "$repository_root"|"$repository_root"/*) fail "持久数据需放在已忽略的数据目录或代码仓库之外。" ;;
  esac
  [ ! -e "$data_root" ] || [ -d "$data_root" ] || fail "数据目录不是文件夹。"
  [ ! -d "$data_root" ] || [ -z "$(find "$data_root" -mindepth 1 -print -quit)" ] || fail "首次部署数据目录必须为空；不会接管已有数据库。"
  pg_password=$(random_secret)
  cms_password=$(random_secret)
  temporary_env=$(mktemp "$env_file.tmp.XXXXXX")
  cat >"$temporary_env" <<EOF
# Private runtime configuration. Do not commit or share.
BLOG_SETUP_VERSION=1
COMPOSE_PROJECT_NAME=$project_name
SITE_DOMAIN=$site_domain
ACME_EMAIL=$acme_email
SITE_IMAGE=${SITE_IMAGE:-blog-site:$release}
CMS_IMAGE=${CMS_IMAGE:-blog-cms:$release}
BLOG_DATA_ROOT=$data_root
POSTGRES_DB=blog
POSTGRES_USER=blog
POSTGRES_PASSWORD=$pg_password
CMS_DB_PASSWORD=$cms_password
CMS_DATABASE_URL=postgres://blog_cms:$cms_password@postgres:5432/blog
CMS_READ_TOKEN=$(random_secret)
RESTIC_REPOSITORY=sftp:user@backup.example.com:/srv/restic/blog
RESTIC_PASSWORD=$(random_secret)
BACKUP_HOST=$project_name
BACKUP_TAG=blog
BACKUP_MAX_AGE_SECONDS=86400
BLOG_CAPACITY_MAX_PERCENT=85
EOF
  mv -- "$temporary_env" "$env_file"
  temporary_env=
fi
chmod 0600 "$env_file"
# The saved configuration is authoritative on retries, even if the caller's shell
# still exports values from another checkout. Build-only image names are scoped below.
unset COMPOSE_PROJECT_NAME COMPOSE_PROFILES SITE_DOMAIN CMS_DOMAIN ACME_EMAIL SITE_IMAGE CMS_IMAGE
unset BLOG_DATA_ROOT POSTGRES_DB POSTGRES_USER POSTGRES_PASSWORD CMS_DB_PASSWORD CMS_DATABASE_URL CMS_READ_TOKEN
unset RESTIC_REPOSITORY RESTIC_PASSWORD BACKUP_HOST BACKUP_TAG BACKUP_MAX_AGE_SECONDS BLOG_CAPACITY_MAX_PERCENT
data_root=$(read_setting BLOG_DATA_ROOT)
site_domain=$(read_setting SITE_DOMAIN)
install -d -m 0755 "$data_root"
# PostgreSQL takes ownership on first startup; leave that directory untouched on retries.
[ -d "$data_root/postgres" ] || install -d -m 0700 "$data_root/postgres"
install -d -m 0700 "$data_root/bootstrap"
install -d -m 0700 "$data_root/cms/media" "$data_root/backup-staging"
chown 1000:1000 "$data_root/cms/media" "$data_root/backup-staging"
install -d -m 0700 "$data_root/caddy/data" "$data_root/caddy/config" "$data_root/caddy/logs"
dc() {
  if [ -n "$compose_override" ]; then
    docker compose --env-file "$env_file" -f "$repository_root/docker-compose.yml" -f "$compose_override" "$@"
  else
    docker compose --env-file "$env_file" -f "$repository_root/docker-compose.yml" "$@"
  fi
}
dc config --quiet
if [ "$skip_build" = 0 ]; then
  echo "正在依次构建后台和博客镜像……"
  SITE_IMAGE=blog-site:$release CMS_IMAGE=blog-cms:$release dc build cms
  SITE_IMAGE=blog-site:$release CMS_IMAGE=blog-cms:$release dc build site
  site_image=blog-site:$release
  cms_image=blog-cms:$release
else
  site_image=$(read_setting SITE_IMAGE)
  cms_image=$(read_setting CMS_IMAGE)
fi
site_image=$(docker image inspect --format '{{.Id}}' "$site_image")
cms_image=$(docker image inspect --format '{{.Id}}' "$cms_image")
for image in "$site_image" "$cms_image"; do
  printf '%s\n' "$image" | grep -Eq '^sha256:[0-9a-f]{64}$' || fail "无法确定实际应用镜像。"
done
temporary_env=$(mktemp "$env_file.tmp.XXXXXX")
sed -e "s/^SITE_IMAGE=.*/SITE_IMAGE=$site_image/" -e "s/^CMS_IMAGE=.*/CMS_IMAGE=$cms_image/" "$env_file" >"$temporary_env"
mv -- "$temporary_env" "$env_file"
temporary_env=
dc up -d --wait postgres
dc run --rm --no-deps -T cms node author-cms/scripts/manage.mjs migrate
if [ -n "$import_source" ]; then
  bundle_checksum=$(tr -d '\r\n' <"$import_source/bundle.sha256")
  printf '%s\n' "$bundle_checksum" | grep -Eq '^[0-9a-f]{64}$' || fail "内容包校验清单无效。"
  import_marker=$data_root/bootstrap/imported-bundle.sha256
  if [ -f "$import_marker" ]; then
    [ "$(cat "$import_marker")" = "$bundle_checksum" ] || fail "已有不同内容包的导入记录；不会覆盖。"
    echo "该内容包已导入，保留服务器上的当前写作。"
  else
    import_copy=$(mktemp -d "$data_root/bootstrap/import.XXXXXX")
    cp -R -- "$import_source/." "$import_copy/"
    chown -R 1000:1000 "$import_copy"
    dc run --rm --no-deps -T --volume "$import_copy:/protected:ro" cms node author-cms/scripts/transfer.mjs verify /protected
    dc run --rm --no-deps -T --volume "$import_copy:/protected:ro" cms node author-cms/scripts/transfer.mjs restore /protected
    printf '%s\n' "$bundle_checksum" >"$import_marker"
    rm -rf -- "$import_copy"
    import_copy=
  fi
fi
owner_exists=$(dc exec -T postgres psql -U blog -d blog -Atqc 'SELECT EXISTS (SELECT 1 FROM author_cms.owner WHERE id=1);')
case "$owner_exists" in
  f)
    owner_file=$data_root/bootstrap/owner-password.txt
    [ ! -L "$owner_file" ] || fail "所有者密码文件不能是符号链接。"
    if [ ! -e "$owner_file" ]; then random_secret >"$owner_file"; fi
    chmod 0600 "$owner_file"
    dc run --rm --no-deps -T cms node author-cms/scripts/manage.mjs owner --password-stdin <"$owner_file"
    printf '初始后台密码保存在：%s\n' "$owner_file"
    ;;
  t) echo "所有者已存在，保留现有密码和会话。" ;;
  *) fail "无法确认所有者状态，已停止。" ;;
esac
dc up -d --wait --wait-timeout 180
printf '\n服务已启动。博客：https://%s\n后台：https://%s/admin\n' "$site_domain" "$site_domain"
echo "请访问博客和 /admin 确认 HTTPS，并配置异机备份。日常管理使用 docker compose up -d / ps / logs / down。"
if [ "$env_file" != "$repository_root/.env" ]; then printf '本次使用自定义配置：%s；日常命令需保留 --env-file 参数。\n' "$env_file"; fi
