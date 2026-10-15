# Personal Knowledge Journal

公开博客是 Next.js 15 应用 `frontend-v2/`，个人写作后台是本仓库的 `author-cms/`。PostgreSQL 17 的 `author_cms` schema 保存唯一实时内容，持久媒体目录保存图片。旧 Directus 程序、SDK 和服务已移除。

后台永久只有一个所有者：Markdown 编辑、实时预览、自动保存、历史恢复、插图、封面、分类/标签/系列与站点资料。点击发布原子更新公开版本，博客新请求立即读到内容，无需构建、部署或重启。工作草稿与线上内容分离。

## 开始使用

需要 Node 24.15.0 至 24.x、pnpm 9.15.9，以及开发 CMS 时使用的 PostgreSQL。

```sh
pnpm install --frozen-lockfile
pnpm dev
```

在已完成本地切换的工作区，用 `pnpm local:up` 同时启动博客和写作后台；博客为 `http://localhost:4321`，后台为 `http://localhost:4322`。数据保存在独立的持久目录，停止后不会丢失。启动、登录及本地备份说明见 [本地使用](docs/operations/local-cms.md)。

`pnpm dev` 运行博客源码开发服务；本机的 `frontend-v2/.env.local` 指向新 CMS，修改后台源码时另运行 `pnpm cms:dev`，先停止占用相同端口的容器。新工作区没有环境配置时，开发默认使用 fixture。CMS 的初始化、受限数据库账号和本机环境设置见 [后台说明](author-cms/README.md)。日常操作见 [写作指南](docs/authoring.md)。fixture 只用于开发与检查，不能作为内容服务故障的回退。

## 应用和契约

| 目录 | 职责 |
| --- | --- |
| `author-cms/` | 私有后台、认证、数据库迁移、草稿/修订、发布、媒体、导出工具 |
| `frontend-v2/` | 公开阅读、发现、搜索和运行时媒体代理 |
| `packages/content-contracts/` | Zod 内容请求/响应契约 |
| `packages/markdown/` | 后台预览与博客共用的安全 Markdown 渲染和正文样式 |
| `deploy/`、`scripts/`、`ops/` | 镜像、Compose、Caddy、备份、恢复和发布操作 |

`/archives/[slug]` 是规范文章地址，旧地址和 `/writing/[slug]` 永久跳到当前规范地址。未知文章、`/writing` 与 `/notes/*` 保持 404。随记、专题及其关系保留在后台管理，首版没有它们的公开频道。

## 构建与部署

VPS 首次部署使用根目录 `docker-compose.yml`。安装 Docker/Compose、解析博客与后台域名后，在 VPS 全新检出运行：

```sh
sh scripts/setup-vps.sh
# 带上本机完整内容包时：sh scripts/setup-vps.sh --import /root/blog-content
```

按提示填写两个域名和邮箱，脚本自动准备配置、数据库、后台密码和镜像并启动服务。之后用 `docker compose up -d`、`docker compose ps`、`docker compose logs` 管理。完整步骤见 [Debian 12 部署指南](docs/operations/vps-first-deploy.md)。

```sh
docker build --target runtime --tag blog-site:local .
docker build --target cms-runtime --tag blog-cms:local .
sh scripts/test-runtime-image.sh blog-site:local
sh scripts/test-cms-image.sh blog-cms:local
```

两个代码镜像构建均不需要 CMS、数据库或内容秘密。生产 site 在运行时接收 `CONTENT_SOURCE=cms`、`CMS_INTERNAL_URL`、`CMS_READ_TOKEN`；CMS 另外接收数据库、域名和媒体目录配置。凭据只进入需要它们的运行时服务，不能写入镜像或客户端。CMS 和数据库成为公开阅读依赖，故障返回明确的 503。

生产使用 `.env.example` 或 `ops/env/production.env.example` 中的配置，替换所有占位值。site 与 CMS 镜像均使用不可变 digest，仅 Caddy 暴露端口。详情见 [运维文档](docs/operations/README.md)。CI 手动发布代码镜像；文章发布不触发 CI。现有受限 SSH 发布器仍只替换 site，CMS 与 schema 升级通过经审阅的维护发布执行。

## 验证

```sh
pnpm lint
pnpm typecheck
pnpm verify
sh scripts/validate-operations.sh
```

数据库测试仅接受本机地址且数据库名以 `_test` 结尾，并会重建其中的 `author_cms` schema：

```sh
CMS_TEST_DATABASE_URL=postgres://postgres:password@127.0.0.1:55432/author_cms_test pnpm verify
CMS_TEST_DATABASE_URL=postgres://postgres:password@127.0.0.1:55432/author_cms_test pnpm test:runtime
```

`test:runtime --preview` 保留隔离预览进程供界面检查；退出后才能再次运行会重建相同 schema 的测试。实际测试密码是合成数据，不能用于生产。

## 迁移与恢复

[Directus 迁移和切换](docs/operations/cms-migration.md)记录只读源快照、隔离导入、历史差异报告和正式切换条件。[备份恢复](docs/operations/backup-restore.md)覆盖内容包、数据库以及 CMS 媒体目录（含原文件）。无法完整重建的旧 delta/关系历史保留在受保护源档案中，报告 `readyForCutover=false` 时必须先核对差异，不能宣称无损迁移。

Git 保存代码、schema 与规则，实时正文在数据库里。导出和恢复都不会覆盖已有作者写入。旧源快照和受保护恢复备份仍保留；离线转换器只供隔离恢复，不运行第二个后台。
