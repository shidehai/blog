# Debian 12：Docker Compose 部署

当前 VPS 为 Debian 12、x86_64、2 核、约 3.3 GiB 内存。根目录的 `docker-compose.yml` 已提供完整生产入口：Caddy、博客、青山写作后台、PostgreSQL。

## 首次部署

先安装 Docker Engine / Compose 插件和 Git。博客与后台各准备一个域名，A 记录解析到 VPS 公网 IP；仅在有可用公网 IPv6 时添加 AAAA。保留 SSH，放行 TCP 80、443，确认这些端口没有被其他网站占用。

在 VPS 的 root 终端执行：

```sh
mkdir -p /opt/personal-journal
git clone --branch codex/author-cms --single-branch https://github.com/shidehai/blog.git /opt/personal-journal/current
cd /opt/personal-journal/current
sh scripts/setup-vps.sh
```

按提示输入 **博客域名、后台域名、联系邮箱**，然后等待完成。域名不带 `https://` 或路径。

脚本会自动生成受保护的 `.env`、数据库密码和读取令牌，准备持久目录，顺序构建两个镜像并固定实际 image ID，创建受限数据库角色、执行迁移、初始化唯一后台密码，最后启动所有服务。第一次构建需要下载依赖；小内存主机建议预留约 2 GiB swap 和至少 10 GiB 可用磁盘。

后台初始密码只保存在 VPS 私有文件中，查看方式：

```sh
cat /srv/personal-journal/data/bootstrap/owner-password.txt
```

访问 `https://你的博客域名` 和 `https://你的后台域名`。Caddy 自动申请并续期证书；首次启动后仍须实际访问检查 HTTPS。

如果失败，解决报错后重新执行脚本即可。已有配置、密码、会话和文章会保留；脚本会拒绝接管另一套 `.env` 或非空的新数据库目录。首次部署使用全新 checkout，不在当前本机日常工作区运行。

## 带上当前本机文章和图片

GitHub 保存代码；完整内容包另行私密传输。先按[本机内容备份](local-cms.md#内容备份)导出并 verify 包，包含文章、草稿、历史、图片和原文件。把其中的 `bundle` 目录上传 VPS，例如：

```sh
# 在开发机执行；换成真实 IP，可按需加 -P SSH端口
scp -r .data/exports/my-backup/bundle root@YOUR_VPS_IP:/root/blog-content
```

在 VPS 的首次初始化命令上增加一个参数：

```sh
cd /opt/personal-journal/current
sh scripts/setup-vps.sh --import /root/blog-content
```

脚本先检查包，再恢复到空内容库，然后设置后台账号并启动服务。原包保持不变；重复传入同一包会跳过已完成的导入，保留服务器后来写的文章；不同包或已存在内容会拒绝覆盖。若导入提交后被意外终止、尚未记录导入标记，先核对已恢复内容，再不带 `--import` 完成启动，不能清库重试。

迁移窗口暂停两端写作；核对原文章地址、历史和图片后，使用 VPS 后台作为唯一日常写入端。本机原数据与备份继续保留。

## 日常管理

在 `/opt/personal-journal/current` 执行标准 Compose 命令：

```sh
docker compose up -d
docker compose ps
docker compose logs --tail=100 cms site caddy
docker compose down
```

停止服务不会删除 bind-mounted 数据。文章发布后立即更新博客，不需要重新构建或重启。代码升级前先备份并记录当前两个 image ID，按[维护流程](deployment.md#cms-upgrades-and-rollback)确认迁移兼容性；首次初始化脚本不是无人值守升级器。

## 配置、数据和备份

- `.env`：实际运行配置，权限 0600；不要公开或提交。
- `/srv/personal-journal/data/`：PostgreSQL、CMS 图片、Caddy 数据与私有初始化记录。
- `/srv/personal-journal/data/bootstrap/owner-password.txt`：首次生成的后台密码，之后重置密码不会改写此旧记录。
- 生产仅 Caddy 暴露 80/443，数据库与应用端口不开放公网。

首次启动不会自动建立异机备份仓库。按[备份恢复](backup-restore.md)配置真实 Restic 仓库、凭据和定时器，并完成一次空目标恢复。使用现有 systemd 单元时，将受保护的运行配置路径对齐到 `/etc/personal-journal/production.env`，可使用指向当前 `.env` 的 root 管理符号链接；不要保留两份逐渐不一致的秘密配置。SFTP 备份还需给备份容器准备只读 SSH 私钥与 known_hosts 挂载。

Docker 官方 Debian 安装说明：`https://docs.docker.com/engine/install/debian/`。初始化脚本要求支持 `include` 的 Compose v2.20.0 或更高版本；不支持旧版 `docker-compose` v1。

需要自定义路径或使用已准备的镜像时，查看 `sh scripts/setup-vps.sh --help`。`--skip-build` 要求两个配置中的镜像已在本机 Docker 中存在；自定义 `--env-file` 后，日常命令须继续携带相同参数。
