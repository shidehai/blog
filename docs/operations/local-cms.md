# 本地博客与青山写作

本次切换仅在本机进行，尚未部署到远程服务器。日常写作由自建 CMS 保存和发布；旧 Directus 程序、SDK、配置和本地服务已移除。旧服务的原始数据库与上传目录已归档到受保护备份，迁入的文章、图片与历史仍保留在新 CMS。

## 日常启动

当前工作区已准备私有 `.env.local` 和独立数据库、媒体目录。Docker 运行时执行：

```sh
pnpm local:up
pnpm local:status
# 查看最近日志
pnpm local:logs
# 停止服务，保留数据库与图片
pnpm local:down
```

博客为 `http://localhost:4321`，后台为 `http://localhost:4322/admin`。端口只绑定本机回环地址。后台使用唯一所有者密码，初始密码保存在已忽略的 `.data/local-cms/owner-password.txt`，不要提交或公开此文件。密码重置命令见 [后台初始化](../../author-cms/README.md)。

根 `.env` 只保存共用域名和备份配置，`.env.local` 供本地 Compose 使用；`frontend-v2/.env.local` 和 `author-cms/.env.local` 供源码开发使用。它们均不进入 Git。Compose 使用固定的本地镜像 ID；代码有改动时需要重新构建应用镜像并更新配置，文章保存和发布不需要构建或重启。

数据库和实际图片保存在 `.data/local-cms/`。这是日常内容库，不能作为 `_test` 数据库运行重建测试。停止服务不删除该目录。旧源备份和切换记录位于 `.data/backups/`，最近清理备份位置记录于 `.data/local-cms/cleanup-backup-path.txt`；单机副本用于本次切换恢复，异机备份另按 [备份恢复](backup-restore.md) 配置。

2026-10-15 本地上线准备后，日常应用已换为经过依赖审计、镜像漏洞扫描和 smoke 的补丁版本。最新冻结备份指针为 `.data/local-cms/launch-backup-path.txt`；包含数据库（含认证状态）、内容/Markdown/媒体及回退配置，已在独立空库恢复并逐项核对。原清理和切换备份继续保留。此结果只代表本地准备，真实域名 HTTPS 与异机自动备份需在正式环境验收。

## 内容备份

2026-10-15 的 `/admin` 改动已同步到本机应用镜像。更新前冻结写入并完整备份，更新后逐项核对内容、修订、实际图片及原文件一致，所有者与原有会话保留。本轮备份指针是 `.data/local-cms/admin-path-backup-path.txt`。源码/本地直连后台为 `http://localhost:4322/admin`；VPS 的 Caddy 入口为博客同域名的 `/admin`。

先创建一个全新的私有导出目录，再通过已运行的 CMS 容器导出完整内容与实际媒体：

```sh
install -d -m 0700 .data/exports
mkdir -m 0700 .data/exports/my-backup
docker compose --env-file .env --env-file .env.local -f deploy/compose.yaml -f deploy/compose.local.yaml run --rm --no-deps -T --volume "$PWD/.data/exports/my-backup:/protected" cms node author-cms/scripts/transfer.mjs export /protected/bundle
docker compose --env-file .env --env-file .env.local -f deploy/compose.yaml -f deploy/compose.local.yaml run --rm --no-deps -T --volume "$PWD/.data/exports/my-backup:/protected:ro" cms node author-cms/scripts/transfer.mjs verify /protected/bundle
```

每次使用新目录，不覆盖旧备份。内容包包含私有草稿和原始历史，不包含所有者密码或会话；恢复到另外的空数据库及媒体目录，不能覆盖日常写作库。

## 源码开发

先用 `pnpm local:down` 停止占用 4321/4322 的容器，再只启动本地 PostgreSQL，并在两个终端启动源码：

```sh
docker compose --env-file .env --env-file .env.local -f deploy/compose.yaml -f deploy/compose.local.yaml up -d postgres
pnpm cms:dev
# 另一个终端
pnpm dev
```

CLI 需显式加载 `author-cms/.env.local`；Next 开发服务会读取各自应用目录的配置。测试继续使用独立的本机 `_test` 数据库，避免修改日常内容。

上线回归另选独立测试库与 4341/4342 端口，不能复用日常库或其他预览库。`pnpm test:runtime --site-port 4341 --cms-port 4342 --proxy-port 4340 --browser` 前需设置专用 `CMS_TEST_DATABASE_URL`；Linux 使用 `xvfb-run --auto-servernum` 包裹该命令，并提前安装 Playwright Chromium。测试会重置所选 `_test` 库的 author_cms schema，端口占用会在重置前拒绝。详见[前台验证说明](../../frontend-v2/README.md)。
