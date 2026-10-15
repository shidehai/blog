# 青山写作后台

永久单作者的专用 CMS，监听 4322。后台页面和写入 API 校验所有者会话；公开服务读取 API 使用独立只读令牌，不能读取草稿或执行写入。

## 本机初始化

先准备 PostgreSQL 数据库。在该目标数据库中以管理员创建专用角色及 schema（已有目标必须先检查，不能覆盖）：

```sql
CREATE ROLE blog_cms LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
CREATE SCHEMA author_cms AUTHORIZATION blog_cms;
\password blog_cms
```

角色只拥有 `author_cms`，不授予旧 `public` schema 内容表或 Directus 系统表权限。已有数据库若向 `PUBLIC` 授过表权限，应先审计继承权限，或改用独立目标数据库；单独 REVOKE 某个角色并不能抵消 PUBLIC 继承的权限。

在 `author-cms/.env.local`（已忽略）设置：

```dotenv
DATABASE_URL=postgres://blog_cms:uri-encoded-password@127.0.0.1:5432/blog
CMS_ORIGIN=http://localhost:4322
CMS_SITE_ORIGIN=http://localhost:4321
CMS_READ_TOKEN=replace-with-at-least-32-random-characters
CMS_MEDIA_ROOT=/absolute/path/to/private/cms-media
CMS_TRUST_PROXY=false
```

CLI 不自动读取 Next 的 `.env.local`，显式加载后初始化：

```sh
pnpm --filter author-cms exec node --env-file=.env.local --import=tsx scripts/manage.mts migrate
# 交互输入密码，避免出现在 shell 历史；bash/zsh 均可用：
read -rs CMS_SETUP_PASSWORD
printf '%s\n' "$CMS_SETUP_PASSWORD" | pnpm --filter author-cms exec node --env-file=.env.local --import=tsx scripts/manage.mts owner --password-stdin
unset CMS_SETUP_PASSWORD
pnpm cms:dev
```

密码至少 12 字符。初始化和重置使用同一个 owner 命令；重置会撤销所有旧会话。没有注册、找回邮件或第二个所有者。生产镜像内命令为 `node author-cms/scripts/manage.mjs migrate` 和 `node author-cms/scripts/manage.mjs owner --password-stdin`，通过容器 stdin 提供密码。

在 `frontend-v2/.env.local` 设置 `CONTENT_SOURCE=cms`、`CMS_INTERNAL_URL=http://localhost:4322` 与相同的 `CMS_READ_TOKEN` 后运行 `pnpm dev`。不要使用 `NEXT_PUBLIC_` 前缀或把令牌传给客户端。

## 代码入口

- `components/ContentEditor.tsx` 和 `useDraft.ts`：编辑、串行防抖保存、冲突、发布与图片任务。
- `lib/store.ts`：参数化 Drizzle SQL、不可变修订、乐观锁、发布事务与公开投影。
- `lib/auth.ts`：异步 scrypt、会话摘要、限速、来源校验。
- `lib/media-files.ts`：实际栅格类型校验、文件与目录 fsync、不可覆盖的原子文件落盘。
- `migrations/*.sql`：有校验和的显式迁移。已应用文件不得修改，新增编号迁移。
- `scripts/transfer.mts`：export、verify、restore、source-export、source-import。生产使用打包的 `transfer.mjs`。

新增字段时同时更新共享 Zod 契约、编辑界面、修订/公开投影、迁移/恢复和需要的验证。JSON 修订保留历史字段，不能把新版草稿字段混入旧公开正文。详细契约见 `.trellis/spec/`，依赖许可见 [DEPENDENCIES.md](DEPENDENCIES.md)。

## 运维

生产以 UID/GID 1000 的 node 用户、只读根文件系统启动；媒体根目录必须由该用户可写。启动先执行迁移，再提供服务。数据库角色应预先拥有 schema，运行时无需 superuser 或数据库 CREATE 权限。导出包包含私有草稿及源档案，必须保存在受保护目录；浏览器“导出内容”只有 JSON，包含图片的完整恢复包使用 CLI。
