# Frontend V2

公开 Next.js 15 App Router 应用，监听 4321。`lib/content.ts` 是唯一页面读取边界，运行时从自建 CMS 读取已发布 article/tutorial；React cache 只在同一次服务器渲染内去重，没有跨请求正文快照。

## 开发与运行

```sh
pnpm --filter frontend-v2 dev
```

开发默认 fixture，数据库不是开发阅读界面的前提。要接入编辑后台，在 `.env.local` 设置：

```dotenv
CONTENT_SOURCE=cms
SITE_URL=http://localhost:4321
CMS_INTERNAL_URL=http://localhost:4322
CMS_READ_TOKEN=the-same-private-service-reader-token-as-cms
```

生产默认 CMS，缺配置或 CMS 失败不会回退 fixture。两个镜像构建均无需内容凭据；Inter 和 JetBrains Mono 从锁定的 Fontsource 包本地编译，无需连接 Google Fonts。令牌只在服务端使用，不能传给浏览器。

生产 CMS 模式还要求 `SITE_URL` 为无路径、凭据、查询参数的 HTTP(S) 站点根地址。Compose 正式环境从 `SITE_DOMAIN` 生成 HTTPS 地址，本地覆盖为 `http://localhost:4321`。canonical、Open Graph、Twitter、robots 和动态 sitemap 统一使用此配置，不使用来访 Host。sitemap 只包含当前已发布内容及有公开文章的分类/系列；草稿、归档、历史别名和媒体地址不收录。页面使用原生图片，Next 图片优化接口已关闭。

## 内容与路由

- `/archives` 和 `/archives/[slug]` 为规范列表/详情，新增发布地址无需重新构建。
- 旧 `/writing/[slug]` 与历史地址对已发布文章永久跳到当前规范地址；未知内容、`/writing` 和 `/notes/*` 为 404。
- 分类、系列、标签、搜索和侧栏使用 PostSummary；目录不批量向客户端传递全部正文。
- `/media/[id]` 同源代理当前公开引用的图片，响应 no-store；草稿素材不开放。
- `/api/content-generation` 只返回公开版本号。导航、focus、pageshow/popstate 和可见性恢复时检查版本；变化时重载文档，清除曾为 404 的缓存边界。
- CMS 故障时 middleware 返回明确的 503。`/healthz` 为独立进程存活检查，不代表内容依赖健康。

预览与公开正文均来自 `@blog/markdown`，文章样式来自共享包。旧 SDK、构建取文和图片物化流程已移除。`fixture-projector.ts` 仅映射离线开发样本；图片扫描器供 Markdown 自检与离线源快照转换使用。

## 验证

```sh
pnpm --filter frontend-v2 verify
```

覆盖严格类型、ESLint、实际 fixture/Markdown 自检和生产构建。跨应用即时发布测试由根 `pnpm test:runtime` 执行，数据库只能使用本机 `_test` 目标。

本机已有日常博客时，必须使用独立数据库和空闲端口。例如设置 `CMS_TEST_DATABASE_URL` 指向专门的本机 `_test` 库，再运行 `xvfb-run --auto-servernum pnpm test:runtime --site-port 4341 --cms-port 4342 --browser`。需要先执行 `pnpm --filter author-cms exec playwright install chromium`，Linux 需安装 Xvfb。测试会关闭 Playwright 默认的焦点模拟，在隔离显示器内实际切换标签页。端口占用会在重置测试 schema 前拒绝；`--browser` 仅在这一隔离实例执行登录、原生 CDP 文件投递、发布、实际标签页焦点/可见性、历史导航和归档。截图、trace 与证据保存在运行日志目录；不会使用日常账户。浏览器原生事件不等同于物理桌面文件管理器拖拽，Link 预取保持关闭，测试另行验证 RSC 预取请求的 no-store 边界。
