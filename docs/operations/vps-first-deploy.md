# Debian 12 VPS 首次部署

适用当前服务器：Debian 12（bookworm）、x86_64、2 核、约 3.3 GiB 内存。使用仓库现有 Docker Compose：Caddy、博客、单作者后台和 PostgreSQL。代码来自 GitHub，现有文章与图片从本机 CMS 完整导出；发布文章后立即更新博客。

以下 VPS 命令在 root 的 Bash 中按顺序逐条执行，任何一步失败先处理错误再继续。首次部署使用 `codex/author-cms` 分支；记录实际提交，两个镜像依次构建。正式服务器只使用 `deploy/compose.yaml`。运行目录选 `/opt/personal-journal/current`，与现有 systemd 运维单元一致。

## 1. 域名、端口和资源

准备两个不同域名，例如 `blog.example.com` 和 `cms.example.com`，A 记录均指向 VPS 公网 IPv4。有可用公网 IPv6 才添加 AAAA 记录。首次验证建议 DNS 直连；若使用 CDN，HTML、RSC、API 和媒体都须遵守源站的 `no-store`。

保留现有 SSH 放行规则，在服务商防火墙和服务器防火墙放行 TCP 80、443；UDP 443 用于 HTTP/3，可选。PostgreSQL、4321、4322 不开放公网。检查 80/443 未被已有 Nginx、Apache 或 Caddy 占用，已有站点须先规划共用入口。

```bash
free -h
df -h /
swapon --show
ss -lntup
```

首次构建比日常运行更占内存，两个应用顺序构建。建议准备至少 10 GiB 可用磁盘，并为小内存主机预留约 2 GiB swap；已有 swap 可复用。如果构建被 OOM 杀死，可在另一台 Linux/amd64 机器构建这两个目标，用 `docker save` / `docker load` 搬运镜像，再从第 4 步继续。

## 2. 安装 Docker Engine 和 Compose

已安装且 `docker compose version` 正常时跳过本节。存在旧版或其他发行渠道的 Docker 时，按 Docker 官方 Debian 安装文档检查兼容性，不直接卸载正在承载其他服务的安装。

下面为 Docker 官方 APT 仓库安装方式，明确使用当前服务器的 `bookworm` 和 `amd64`：

```bash
apt-get update
apt-get install -y ca-certificates curl git python3
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
cat >/etc/apt/sources.list.d/docker.sources <<'EOF'
Types: deb
URIs: https://download.docker.com/linux/debian
Suites: bookworm
Components: stable
Architectures: amd64
Signed-By: /etc/apt/keyrings/docker.asc
EOF
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable --now docker
docker version
docker compose version
```

官方参考：`https://docs.docker.com/engine/install/debian/`。

## 3. 拉取代码并构建两个镜像

```bash
install -d -m 0755 /opt/personal-journal
git clone --branch codex/author-cms --single-branch https://github.com/shidehai/blog.git /opt/personal-journal/current
cd /opt/personal-journal/current
git log -1 --oneline
RELEASE=$(git rev-parse --short=12 HEAD)
docker build --target runtime --label "org.opencontainers.image.revision=$(git rev-parse HEAD)" -t "blog-site:$RELEASE" .
docker build --target cms-runtime --label "org.opencontainers.image.revision=$(git rev-parse HEAD)" -t "blog-cms:$RELEASE" .
```

私有仓库需要先为 VPS 配置 GitHub 只读访问，再用 SSH 仓库地址克隆；不要把访问令牌写进 clone URL。首次手动部署不依赖 GitHub Actions 或 GHCR，也不用在 VPS 安装 Node/pnpm。

## 4. 创建受保护配置

下面只适用于**全新目标**，已有配置或数据库时先备份并按维护流程处理。脚本保留示例中的备份位置占位符，生成随机数据库密码、读取令牌和 Restic 密码，固定为刚构建的实际 image ID；不会输出秘密。

```bash
cd /opt/personal-journal/current
RELEASE=$(git rev-parse --short=12 HEAD)
install -d -m 0755 /etc/personal-journal
python3 - "$RELEASE" <<'PY'
import os
import secrets
import subprocess
import sys
from pathlib import Path

os.umask(0o077)
target = Path('/etc/personal-journal/production.env')
sql_path = Path('/etc/personal-journal/initial-cms-role.sql')
if target.exists() or sql_path.exists():
    raise SystemExit('配置已存在，请先检查；不会覆盖。')
release = sys.argv[1]
cms_password = secrets.token_hex(32)
values = {
    'POSTGRES_PASSWORD': secrets.token_hex(32),
    'CMS_DATABASE_URL': f'postgres://blog_cms:{cms_password}@postgres:5432/blog',
    'CMS_READ_TOKEN': secrets.token_hex(32),
    'RESTIC_PASSWORD': secrets.token_hex(32),
}
for name, image in [('SITE_IMAGE', 'blog-site'), ('CMS_IMAGE', 'blog-cms')]:
    values[name] = subprocess.check_output(
        ['docker', 'image', 'inspect', '--format', '{{.Id}}', f'{image}:{release}'],
        text=True,
    ).strip()
lines = Path('ops/env/production.env.example').read_text().splitlines()
with target.open('x') as output:
    for line in lines:
        key = line.partition('=')[0]
        output.write(f'{key}={values[key]}\n' if key in values else line + '\n')
with sql_path.open('x') as output:
    output.write(
        'CREATE ROLE blog_cms LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION '
        f"PASSWORD '{cms_password}';\n"
        'CREATE SCHEMA author_cms AUTHORIZATION blog_cms;\n'
    )
PY
editor /etc/personal-journal/production.env
```

在编辑器修改 `SITE_DOMAIN`、`CMS_DOMAIN`、`ACME_EMAIL` 为真实值。域名不带 `https://`、路径或末尾斜杠；博客与后台域名不同。其余生成的数据库配置保持一致，真实秘密另存密码管理器。这里的镜像 ID 只在本机 Docker 镜像库使用；配置自动发布器时再改用允许的 GHCR registry digest。

创建目录与便捷命令；重新登录终端时重新定义 `dc` 函数：

```bash
install -d -m 0755 /srv/personal-journal/data
install -d -m 0700 /srv/personal-journal/data/postgres
install -d -o 1000 -g 1000 -m 0700 /srv/personal-journal/data/cms/media
install -d -o 1000 -g 1000 -m 0700 /srv/personal-journal/data/backup-staging
install -d -m 0700 /srv/personal-journal/data/caddy/{data,config,logs}
dc() { docker compose --env-file /etc/personal-journal/production.env -f /opt/personal-journal/current/deploy/compose.yaml "$@"; }
dc config --quiet
```

不要把完整 `docker compose config` 输出贴到聊天或公开日志；`--quiet` 仅验证，不打印秘密。

## 5. 初始化受限数据库角色与 schema

```bash
dc up -d --wait postgres
dc exec -T postgres psql -U blog -d blog -v ON_ERROR_STOP=1 --single-transaction </etc/personal-journal/initial-cms-role.sql &&
  rm /etc/personal-journal/initial-cms-role.sql &&
  dc run --rm --no-deps -T cms node author-cms/scripts/manage.mjs migrate
```

先确认 SQL 成功再删除一次性文件；出现角色已存在等错误时先核对目标，不能重复初始化或给予 CMS superuser 权限。数据库管理员 `blog` 与应用角色 `blog_cms` 分开。此时尚未启动公网入口。

## 6. 从当前本机迁入文章与图片

GitHub 不含日常数据库、私有草稿或图片。迁移当前 CMS 即可，不再运行旧 Directus。迁移窗口内暂停两端写作，完成后把 VPS 后台作为日常唯一写入端，避免两边内容分叉。

先在**当前开发机**的项目根目录执行。目录名每次使用新的，以下 `first-vps` 不可覆盖已有备份。当前开发机用户 UID 为 1000，导出父目录由该用户拥有且可写：

```bash
cd /home/sdh/vibehub/blog
install -d -m 0700 .data/exports
mkdir -m 0700 .data/exports/first-vps
docker compose --env-file .env --env-file .env.local -f deploy/compose.yaml -f deploy/compose.local.yaml run --rm --no-deps -T --volume "$PWD/.data/exports/first-vps:/protected" cms node author-cms/scripts/transfer.mjs export /protected/bundle
docker compose --env-file .env --env-file .env.local -f deploy/compose.yaml -f deploy/compose.local.yaml run --rm --no-deps -T --volume "$PWD/.data/exports/first-vps:/protected:ro" cms node author-cms/scripts/transfer.mjs verify /protected/bundle
```

在 VPS 先建立受保护接收目录：

```bash
install -d -m 0700 /srv/personal-journal/import
```

回到开发机，通过已核对主机指纹的 SSH 传输。将 `YOUR_VPS_IP` 换成实际地址；自定义 SSH 端口时给 scp 加 `-P 端口`：

```bash
scp -r .data/exports/first-vps/bundle root@YOUR_VPS_IP:/srv/personal-journal/import/
```

在 VPS 恢复进刚迁移的空内容 schema 与媒体目录：

```bash
chown -R 1000:1000 /srv/personal-journal/import/bundle
dc run --rm --no-deps -T --volume /srv/personal-journal/import/bundle:/protected:ro cms node author-cms/scripts/transfer.mjs verify /protected
dc run --rm --no-deps -T --volume /srv/personal-journal/import/bundle:/protected:ro cms node author-cms/scripts/transfer.mjs restore /protected
```

包内有原始历史和草稿，应持续私密保存。恢复不导入所有者密码或会话；遇到非空目标会拒绝，不要清空已有写作库来重试。若明确要空站启动，可跳过本节。

## 7. 设置所有者密码并启动 HTTPS

先在尚无公网入口时设置唯一所有者密码。密码至少 12 字符，通过隐藏输入及 stdin 提供：

```bash
read -r -s -p '设置后台密码（至少12字符）: ' CMS_SETUP_PASSWORD
printf '\n'
printf '%s\n' "$CMS_SETUP_PASSWORD" | dc run --rm --no-deps -T cms node author-cms/scripts/manage.mjs owner --password-stdin
unset CMS_SETUP_PASSWORD
dc up -d --wait cms
dc up -d --wait site caddy
dc ps
```

命令成功后再继续下一条；Caddy 根据实际域名申请并续期 HTTPS 证书。后台使用新设置的密码，域名为 `https://你的后台域名`；博客为 `https://你的博客域名`。

## 8. 验收与日常操作

```bash
curl -fsS https://你的博客域名/healthz
curl -fsS https://你的博客域名/ >/dev/null
curl -fsS https://你的博客域名/robots.txt
curl -fsS https://你的博客域名/sitemap.xml
dc logs --tail=100 caddy cms site
```

浏览器登录后台，核对原文章地址、历史与图片；编辑工作草稿，确认公开内容仍旧；点击发布，确认博客及 sitemap 立即更新。用未登录浏览器确认草稿与私有图片不可访问。检查 canonical/分享图使用真实域名、登录 Cookie 带 Secure，且公网仅有 SSH 与预期的 80/443 服务。

日常在后台写作和发布即可；不运行构建、Actions 或重启。`dc restart` 不会删除数据；升级程序前先备份，记录两个当前 image ID/registry digest，按[维护流程](deployment.md#cms-upgrades-and-rollback)升级 CMS、迁移与博客。

## 9. 正式使用前配置异机备份

首次启动没有自动配置备份。将 `production.env` 中 `RESTIC_REPOSITORY` 换成真实异机仓库并初始化，另存 `RESTIC_PASSWORD`；备份账号的访问方式也要准备好。现有 Compose 未挂载 SFTP 的 SSH 私钥/known_hosts，如选择 SFTP，需为备份与维护容器补充受保护的只读挂载，不能仅填写仓库地址。

按[备份恢复](backup-restore.md)完成一次备份及空目标恢复，再安装并启用 `blog-backup`、`blog-backup-freshness`、`blog-restic-forget`、`blog-restic-check` 定时器；配置 `alerts.env` 的故障通知并测试送达。所有 unit 的代码路径已与本指南一致。未完成异机恢复前，保留本机原数据、导出包与已有恢复备份。

GitHub 推送只上传代码。现有 Actions 的手动发布器只自动替换 site；首次服务器初始化、CMS/schema 升级和迁移都按上述维护路径执行。
