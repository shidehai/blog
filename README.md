# Personal Knowledge Journal

这是一个由 Next.js 15 `frontend-v2` 提供公开页面、由 Directus 12 与
PostgreSQL 17 管理内容的个人知识库。公开站点在构建时生成内容快照；运行时
镜像不读取 CMS，也不携带 CMS 凭据。

Directus 仍是文章、随记、专题、媒体、修订和作者工作流的唯一内容来源。当前
公开 V2 只展示已发布的 article/tutorial 投影，不会删除或改写 CMS 中的 notes、
topics 或既有正文。

## 公开路由

- `/archives` 与 `/archives/[slug]` 是文章列表和详情的规范地址。
- 对当前构建快照中已发布文章，`/writing/[slug]` 会永久重定向到相同的
  `/archives/[slug]`；`/writing`、未知 slug 及所有 `/notes/*` 保持 404。
- `/healthz` 为容器健康检查；其他公开页面位于 `frontend-v2/app/`。

## 本地启动

需要 Node 24.15.0、pnpm 9.15.9、Docker 与 Docker Compose。Directus 与备份
任务使用 UID/GID `1000`；若宿主机用户不同，请让
`.data/directus/uploads` 与 `.data/backup-staging` 可由该 UID/GID 写入。

```bash
install -m 600 .env.example .env
mkdir -p \
  .data/postgres \
  .data/directus/uploads \
  .data/caddy/data \
  .data/caddy/config \
  .data/caddy/logs \
  .data/backup-staging
pnpm install --frozen-lockfile
docker compose --env-file .env -f deploy/compose.yaml -f deploy/compose.dev.yaml config --quiet
docker compose --env-file .env -f deploy/compose.yaml -f deploy/compose.dev.yaml up -d postgres directus
pnpm dev
```

`pnpm dev` 默认使用离线 fixture，并在 <http://localhost:4321> 提供 V2。
如需让本机 Next 开发服务器读取 Directus，请显式传入构建期凭据：

```bash
CONTENT_SOURCE=directus \
DIRECTUS_URL=http://localhost:8055 \
DIRECTUS_BUILD_TOKEN=<build-reader-token> \
pnpm dev
```

Directus 模式缺少 URL/token、凭据无效或内容读取失败都会报错；它不会静默回退到
fixture。替换 `.env` 中的所有占位值后再进行任何超出本地开发范围的操作。生产
部署必须将 `SITE_IMAGE` 设为真实 GHCR digest，而不是 tag。

## 构建和运行时边界

fixture 构建无需 CMS 凭据。发布镜像在构建阶段通过 BuildKit secret 读取
`DIRECTUS_BUILD_TOKEN`，例如：

```bash
docker build \
  --target runtime \
  --secret id=directus_build_token,env=DIRECTUS_BUILD_TOKEN \
  --build-arg CONTENT_SOURCE=directus \
  --build-arg DIRECTUS_URL=https://cms.example.com \
  --tag blog-site:local \
  .
```

最终镜像以 `node` 用户在 4321 监听，只包含 Next standalone 输出、静态资源和
`/healthz`，不接收 `CONTENT_SOURCE`、Directus URL 或 token 运行时环境变量。

## Directus 许可与内容治理

Directus 12.2.0 可以在 Core tier 启动，但 Build Reader 的发布状态、字段和媒体
目录限制需要自定义权限规则。`pnpm directus:bootstrap` 在该能力不可用时会停止，
`pnpm test:directus-access` 会再次验证；没有广泛读取的降级路径。

符合条件的所有者可申请 [Open Innovation Grant](https://directus.com/oig)。把许可
密钥仅放入未跟踪的 `.env` 中的 `DIRECTUS_LICENSE_KEY`。开发环境可设置稳定的
`DIRECTUS_PUBLIC_URL`；生产始终由必填的 HTTPS `CMS_DOMAIN` 生成 `PUBLIC_URL`。

将已部署的旧版本升级到本版本前，先完成常规数据库备份。随后运行
`pnpm directus:bootstrap` 会仅按固定 ID 清理历史服务读取身份及其权限；它不会按
名称批量删除资源，也不会触碰内容、作者账户或 Build Reader。该预览能力
已退休，恢复它需要经过审核的独立身份重建，而不是回滚普通站点代码。

## 健康检查、schema 与夹具

```bash
docker compose --env-file .env -f deploy/compose.yaml -f deploy/compose.dev.yaml ps
curl --fail http://127.0.0.1:8055/server/ping
curl --fail http://127.0.0.1:4321/healthz
pnpm verify
```

以下命令会显式应用 schema、数据库约束、策略/bootstrap 状态和开发夹具；它们不会
重置已有内容：

```bash
test -f directus/schema.yaml
pnpm directus:schema:diff
pnpm directus:schema:apply
pnpm directus:bootstrap
# 安装开发夹具（需要显式目标确认）：
pnpm directus:seed --confirm=CONFIRM_FIXTURE_INSTALL_http://127.0.0.1:8055
pnpm directus:schema:check
```

### 一次性编辑发布

将规范内容切换到首个真实发布时间时，先生成只读清单，再使用清单输出的确认 token：

```bash
pnpm launch:plan --base-time=2026-08-19T12:00:00.000Z
pnpm launch:apply --manifest=.generated/launch-manifest.json --confirm=CONFIRM_LAUNCH_<digest>_FOR_http://127.0.0.1:8055
```

之后的编辑和文章更新只在 Directus Studio 内进行，并受夹具非覆盖保护。

## 备份与停止

备份 profile 会创建经 `pg_restore --list` 验证的 PostgreSQL 自定义格式 dump，并将
该 dump 与 Directus uploads 发送到已配置的加密 Restic 仓库：

```bash
docker compose --env-file .env -f deploy/compose.yaml -f deploy/compose.dev.yaml --profile backup run --build --rm backup
docker compose --env-file .env -f deploy/compose.yaml -f deploy/compose.dev.yaml down
```

`down` 会保留 bind-mounted 数据。删除 `.data/`、使用 `down -v` 或运行广泛的
Docker prune 命令都不在运行手册内。
