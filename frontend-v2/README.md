# Frontend V2

`frontend-v2` 是博客当前公开使用的 Next.js 15 App Router 前端。页面在构建期
从统一内容快照生成；默认 fixture 让离线开发和 CI 可复现，生产构建则显式读取
Directus 的已发布 article/tutorial 数据。

## 开发

在仓库根目录执行：

```bash
pnpm --filter frontend-v2 dev
```

访问 <http://localhost:4321>。默认 `CONTENT_SOURCE=fixture`，无需启动数据库。

要在本机使用 Directus 内容，必须同时提供 URL 和 Build Reader token；错误凭据、
读取失败或不完整配置都会让构建/页面渲染失败，而不会回退到 fixture：

```bash
CONTENT_SOURCE=directus \
DIRECTUS_URL=http://localhost:8055 \
DIRECTUS_BUILD_TOKEN=<build-reader-token> \
pnpm --filter frontend-v2 build
```

运行时 standalone 镜像不需要也不接收这些变量；它只提供已生成的页面和
`/healthz`。

## 路由

| 路径                              | 用途                                                |
| --------------------------------- | --------------------------------------------------- |
| `/`                               | 首页                                                |
| `/archives`                       | 已发布文章归档                                      |
| `/archives/[slug]`                | 规范文章详情页                                      |
| `/writing/[slug]`                 | 当前已发布文章的永久兼容重定向到 `/archives/[slug]` |
| `/categories`、`/tags`、`/series` | 分类、标签和系列浏览                                |
| `/projects`、`/tools`、`/about`   | 站点附属公开页面                                    |
| `/healthz`                        | 容器健康检查                                        |

`/writing`、未知的 `/writing/[slug]` 和所有 `/notes/*` 没有兼容 catch-all，均为
404。Directus 中的 notes、topics 和它们的关系仍保留给 CMS/作者工作流，只是不再
进入 V2 的公开快照。

## 质量检查

```bash
pnpm --filter frontend-v2 typecheck
pnpm --filter frontend-v2 lint
pnpm --filter frontend-v2 selfcheck
pnpm --filter frontend-v2 build
pnpm --filter frontend-v2 verify
```

页面使用 `app/globals.css` 中的项目语义样式；本项目不再包含 utility-CSS、RSS 或
预览运行时。
