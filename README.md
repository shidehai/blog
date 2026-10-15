# 青山神司集

个人博客与单作者写作后台。使用 Markdown 写作，文章、草稿和图片保存在自己的服务器上。

一个域名就够：读者在首页看博客，你在 `/admin` 写文章。点击发布后，博客立即更新，无需重新构建或重启服务。

| 入口                     | 用途                                         |
| ------------------------ | -------------------------------------------- |
| `https://你的域名`       | 公开博客：阅读、归档、搜索、分类、标签和系列 |
| `https://你的域名/admin` | 青山写作：登录、写作、发布和内容管理         |

## 写作与管理

- **Markdown 编辑与实时预览**：支持代码高亮、表格、引用和提示块，预览与博客正文共用渲染和样式。
- **图片与封面**：上传、拖入或粘贴截图，也可以从媒体库选图插入正文。
- **自动保存与历史恢复**：保存工作草稿，查看历史版本，恢复后继续编辑。
- **明确的发布操作**：修改已发布文章时先保存为草稿，点击“发布更新”后才改变线上内容；归档可以撤回文章。
- **内容与站点设置**：设置固定地址、摘要、分类、标签、系列、精选、头像和站点资料。

后台始终只有一个所有者，使用密码登录。当前公开频道以文章和教程为主；随记、专题可在后台管理，尚未开放对应的公开频道。

## 部署到 VPS

以下步骤适用于 Debian 12、x86_64，在 VPS 的 root 终端执行。应用、数据库和 HTTPS 入口由 Docker Compose 管理，VPS 无需单独安装 Node.js、pnpm 或 PostgreSQL。

### 1. 准备服务器和域名

- 安装 Git、Docker Engine 和 Docker Compose 插件。Compose 需要 **v2.20.0 或更高版本**，使用 `docker compose` 命令。
- 将域名的 A 记录指向 VPS 公网 IP；有可用的公网 IPv6 时再添加 AAAA 记录。
- 放行 TCP **80、443**，确认端口没有被其他网站占用，并保留 SSH 访问。

Docker 安装方式见 [Docker 官方 Debian 安装说明](https://docs.docker.com/engine/install/debian/)。第一次构建需要下载依赖，建议预留至少 10 GiB 磁盘；约 3 GiB 内存的主机建议准备约 2 GiB swap。

### 2. 下载并初始化

部署使用 `main` 分支，待部署的改动请先合并到 `main`。代码直接放在 `/opt/blog`，无需 `current` 子目录。首次部署请使用新的检出目录和空的数据目录。

**要一并迁入本机文章和图片时，先阅读[迁入现有内容](#迁入现有内容)，初始化时使用带 `--import` 的命令。**

```sh
git clone --branch main --single-branch https://github.com/shidehai/blog.git /opt/blog
cd /opt/blog
sh scripts/setup-vps.sh
```

按提示填写两项：

1. **博客域名**，例如 `example.com`，只填域名，不带协议、端口或 `/admin`。
2. **证书联系邮箱**，用于 HTTPS 证书申请。

脚本会生成私有 `.env` 和随机凭据，构建博客与后台镜像，初始化数据库及唯一所有者，然后启动服务。让脚本创建 `.env`，无需提前复制或填写环境模板。Caddy 负责申请和续期 HTTPS 证书，后台自动使用同域名的 `/admin`。

如果初始化中断，解决报错后重新执行同一命令；脚本会保留已有密码、会话和内容。

### 3. 登录并发布第一篇文章

在 VPS 上查看初始后台密码：

```sh
cat /srv/blog/data/bootstrap/owner-password.txt
```

1. 打开 `https://你的域名/admin`，输入密码登录，无需用户名。
2. 新建文章，填写标题和 Markdown 正文；图片可上传、拖入或粘贴。
3. 设置固定地址、摘要和封面等文章属性。
4. 点击“发布文章”，再通过“查看文章”确认公开效果。

首次启动后，实际访问博客和后台，确认 HTTPS、登录和图片显示正常。日常写作只需浏览器，发布文章不需要执行部署命令。完整操作见[写作指南](docs/authoring.md)。

初始密码文件请妥善保存。后来重置密码时，这个文件仍保留旧记录；重置方法见[后台说明](author-cms/README.md#本机初始化)。

## 迁入现有内容

GitHub 保存代码，文章和图片需要单独迁入。先按[本机内容备份](docs/operations/local-cms.md#内容备份)导出并校验完整内容包，再把其中的 `bundle` 目录私密上传到 VPS。

在开发机执行，替换实际 IP 和内容包路径：

```sh
scp -r .data/exports/my-backup/bundle root@YOUR_VPS_IP:/root/blog-content
```

在 VPS 下载代码后，用下面的命令完成首次初始化：

```sh
cd /opt/blog
sh scripts/setup-vps.sh --import /root/blog-content
```

完整内容包包含文章、私有草稿、历史、图片和原文件，不包含所有者密码与会话。导入目标必须没有现有内容；重复导入同一个包会跳过已完成的导入并保留后续写作。

迁移期间暂停两端写作，核对文章地址、历史和图片后，再使用 VPS 后台作为日常写作入口。更多细节见 [Debian 12 部署指南](docs/operations/vps-first-deploy.md#带上当前本机文章和图片)。

## 日常管理

在 VPS 的 `/opt/blog` 目录执行：

```sh
# 启动服务
docker compose up -d

# 查看状态
docker compose ps

# 查看最近日志
docker compose logs --tail=100 cms site caddy

# 停止并移除容器，保留持久数据
docker compose down
```

**发布文章与更新程序是两件事。** 程序升级前需要备份，并核对博客镜像、后台镜像和数据库迁移的兼容性。部署配置固定了应用镜像 ID，更新代码后还需要构建镜像并更新配置，按[升级与回退流程](docs/operations/deployment.md#cms-upgrades-and-rollback)执行。

## 数据与备份

使用默认部署设置时，数据位置如下：

| 位置                        | 保存的内容                           |
| --------------------------- | ------------------------------------ |
| `/opt/blog/.env`            | 私有运行配置、数据库凭据和读取令牌   |
| `/srv/blog/data/postgres/`  | 文章、草稿、历史、站点资料和认证数据 |
| `/srv/blog/data/cms/media/` | 上传图片与原文件                     |
| `/srv/blog/data/caddy/`     | HTTPS 证书、配置和访问日志           |
| `/srv/blog/data/bootstrap/` | 初始密码与初始化记录                 |

推送 GitHub 只保存代码。恢复博客需要数据库和媒体的备份；上述私有配置、密码和内容包应保存在受保护的位置。

后台“导出内容”下载的是 JSON。需要连同实际图片、原文件一起迁移时，使用完整内容包。需要恢复登录状态等完整运行数据时，备份数据库与媒体目录。具体命令见[备份与恢复](docs/operations/backup-restore.md)。

首次部署不会自动完成异机备份配置。正式使用前，应配置定时备份，并验证一次恢复。

## 本地开发

源码开发需要 **Node.js 24.15.0 至 24.x** 和 **pnpm 9.15.9**。

只预览博客页面时，在仓库根目录执行：

```sh
pnpm install --frozen-lockfile
CONTENT_SOURCE=fixture pnpm dev
```

打开 `http://localhost:4321`。此模式使用示例内容，适合调整页面和样式，不需要数据库。

开发完整写作后台时，按[后台初始化说明](author-cms/README.md#本机初始化)准备 PostgreSQL、环境配置和所有者，再运行 `pnpm cms:dev`。本机后台地址为 `http://localhost:4322/admin`。源码开发使用两个端口，VPS 部署由 Caddy 合并到同一个域名。

`pnpm local:up` 等本机容器命令用于已完成私有配置和数据初始化的工作区，操作见[本地使用](docs/operations/local-cms.md)。启动源码服务前，先停止占用相同端口的容器。

常用代码检查：

```sh
pnpm lint
pnpm typecheck
pnpm verify
```

完整数据库验证还需显式配置独立的本机 `CMS_TEST_DATABASE_URL`，数据库名以 `_test` 结尾。测试会重建该库中的 `author_cms` schema，务必与日常写作库分开；详细命令见[验证说明](frontend-v2/README.md#验证)。

## 项目结构

公开博客与后台使用 Next.js，实时内容存储在 PostgreSQL 17，HTTPS 入口使用 Caddy。

| 目录                          | 职责                                     |
| ----------------------------- | ---------------------------------------- |
| `frontend-v2/`                | 公开博客、搜索和图片读取                 |
| `author-cms/`                 | 单作者后台、认证、草稿、发布、媒体和历史 |
| `packages/content-contracts/` | 博客与后台共用的内容契约                 |
| `packages/markdown/`          | 共用的 Markdown 渲染与正文样式           |
| `deploy/`                     | Docker Compose、Caddy 和容器配置         |
| `scripts/`、`ops/`            | 初始化、检查、备份、恢复和部署工具       |

## 文档导航

| 想做什么                    | 从这里开始                                          |
| --------------------------- | --------------------------------------------------- |
| 写文章、插图、发布或撤回    | [写作指南](docs/authoring.md)                       |
| 在 Debian 12 VPS 上首次部署 | [VPS 部署指南](docs/operations/vps-first-deploy.md) |
| 启动已有的本机博客和后台    | [本地使用](docs/operations/local-cms.md)            |
| 开发后台、初始化或重置密码  | [后台说明](author-cms/README.md)                    |
| 导出内容、备份和恢复        | [备份与恢复](docs/operations/backup-restore.md)     |
| 升级程序、回退和维护        | [运维文档](docs/operations/README.md)               |
