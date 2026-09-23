# 清理前后端无用代码

## Goal

清理当前博客中已失效、无消费者或与 Next.js V2 运行方式不一致的代码、配置、测试和文档；恢复已经被所有文章入口引用的文章详情页，同时不改变 Directus 中现有内容数据。

## Background

- 当前可运行的公开前端是 frontend-v2（Next.js）。根目录已经没有 Astro V1 应用源码，但部分部署配置、测试、文档和 Trellis 规范仍描述 V1、Pagefind、RSS 或草稿预览。
- 本任务开始前，工作区已有用户未提交改动，必须原样保留其意图：frontend-v2/app/globals.css、frontend-v2/lib/fixture.ts、frontend-v2/lib/mock.ts，以及新增的 frontend-v2/public/avatar.svg。Trellis 工具链相关的未提交改动也不属于本任务。
- 本任务尚未修改产品代码；所有删除项会先由静态引用、框架约定、构建产物或现有质量门禁交叉证明。

## Confirmed Facts

- 首页、归档、文章卡片和命令菜单均链接到 /archives/[slug]，但 V2 路由树没有该详情页。被误删的旧详情实现可从提交 d49164d 的父提交恢复并迁移到该路径。
- 当前自检仍访问已删除的 snap.notes、snap.topics 和 postSlugsByTopic，导致 pnpm --filter frontend-v2 selfcheck 失败；该投影已没有页面消费者。
- V2 的 Directus 读取层仍请求和解码 topics，尽管最终 ContentSnapshot、页面和组件都不再暴露它。V2 离线夹具中被筛掉的 note 行、无消费者的 MOCK_POSTS、MOCK_TOOLS、getTools 和 ToolItem 同属残留。
- CategoriesClient.tsx、category-link.active，以及 app/page.tsx 的 Link 和 CommandMenu.tsx 的 PenLine 没有消费者或有效使用。
- 站点没有 RSS 路由，但 Footer、SiteProfile、Directus 映射与夹具仍保留 /feed.xml 或 /rss.xml。
- Tailwind 没有入口指令，生产 CSS 未生成项目书写的 utility class；其配置、插件和依赖无法产生效果。CommandMenu、ProjectCard、projects 页面和根布局仍包含这些无效 utility class，需要改为项目自己的语义 CSS，不能只删除依赖而让现有页面失去布局。
- next.config.ts 的 images.remotePatterns 没有 next/image 消费者。
- Dockerfile 已改为 Next standalone，但镜像监听 3000、没有 node 用户和健康检查；Compose、Caddy、部署脚本和运行时测试仍要求 4321 与 /healthz。开发 Compose 还指向不存在的 development stage。
- CI 传入 Directus build URL/token，但 Docker build stage 没有消费它们，导致生产构建可能静默退回夹具。Directus 必须保留为构建时公开内容快照的来源，且 build token 不得进入运行时镜像。
- Directus 的 Posts 预览 URL、Preview Reader 服务账户/策略/权限、预览反向代理、运行时环境变量、测试和文档仍存在；V1 的 /preview/[id] 已删除，V2 也没有预览路由。
- Directus 的 topics、posts_topics 和 note 仍是 CMS 数据模型、种子、数据库约束和作者工作流的一部分。它们不能因 V2 当前未展示而被删除，也不得批量改写生产文章正文。
- 已发布正文含旧 /writing/[slug] 与 /notes/[slug] 链接。公开文章可以从当前构建快照安全确认 slug；notes 没有可靠的一对一替代路径。

## Requirements

- R1：审查并处理 frontend-v2、根级构建/依赖文件、Directus、deploy、scripts、CI、测试和与其行为直接相关的文档及 Trellis 规范。
- R2：仅删除有可复核证据的项目内残留；框架文件路由、动态入口、部署脚本和外部可访问路由不得仅因缺少静态导入而删除。
- R3：不覆盖、回退或误删任务开始前已有的用户工作区改动；若必须触及同一文件，只做最小且可区分的合并。
- R4：恢复 /archives/[slug] 的静态文章详情页，复用现有内容映射、Markdown 展示、目录、相邻文章和相关推荐能力；未知 slug 必须返回 404。
- R5：为当前构建快照中的公开文章提供 /writing/[slug] 到 /archives/[slug] 的永久重定向；/writing 根路径、未知 writing slug 和所有 /notes/* 继续返回 404。
- R6：移除 V2 中已经没有消费者的内容投影、夹具/模拟数据、组件、导入、无效 RSS 表面和 Tailwind 残留，同时保留可访问的现有页面及其可用布局。
- R7：让 Directus 成为明确的构建时内容源：fixture 构建可离线成功，Directus 模式缺 URL、token 或读取失败时在构建阶段失败；token 只能经 BuildKit secret 使用，不能进入 runtime 镜像或 runtime 环境。
- R8：使 Next 容器、开发/生产 Compose、Caddy、部署检查、CI 和运行时镜像统一使用 4321、/healthz、非 root node 用户、只读运行时根目录与 Next 的静态资源路径。
- R9：删除失效的草稿预览能力：Posts preview URL、Preview Reader 服务账户/策略/权限、预览 Caddy 代理及凭据、运行时变量、相关测试和文档均不再作为活跃功能保留。对已经由旧 bootstrap 创建的固定 ID 资源，保留一个只删除这些精确 ID 的幂等清理步骤；不触碰内容记录、作者账户或 Build Reader。
- R10：保留 Directus 中的 topics、posts_topics、note、文章和正文；不执行生产内容批量重写。仅可缩小 Build Reader 到 V2 实际查询的字段/集合。
- R11：更新受影响的 README、运维文档和 Trellis 规范，使其描述 Next.js V2 的实际边界，而非已经删除的 Astro、Pagefind、RSS 或预览流程。

## Acceptance Criteria

- [ ] AC1：每个删除或缩减项均有引用分析、框架约定或构建/测试证据；最终报告列出保留的项目和理由。
- [ ] AC2：所有现有文章入口及命令菜单结果可打开 /archives/[slug]；详情页包含正文、目录、相邻文章和相关推荐，未知 slug 为 404。
- [ ] AC3：已知公开 /writing/[slug] 返回永久重定向到等价 archives 路径；未知 writing slug、/writing 与 /notes/* 不发生错误重定向。
- [ ] AC4：V2 自检不再访问 notes/topics 投影并通过；V2 类型检查、lint 和生产构建通过，构建产物包含详情页和兼容重定向。
- [ ] AC5：RSS、无消费者的工具/旧模拟数据、CategoriesClient、未使用导入、无效 Tailwind 配置和 next/image 远程策略不再残留；保留页面在项目自有 CSS 下仍有可用布局。
- [ ] AC6：Directus build 使用 URL 和只读 token 生成内容快照；fixture 构建无需该 token；Directus 构建的凭据缺失或读取失败会失败，且 token 不存在于最终镜像层、历史或环境。
- [ ] AC7：运行时镜像以 node 用户在 4321 提供 /healthz 和首页；Compose/Caddy/运行时镜像测试与开发 Compose 配置均通过。
- [ ] AC8：仓库和已执行 bootstrap 的 Directus 中均不再有活跃预览 URL、Preview Reader、预览 token/变量、/preview 代理或预览测试；Build Reader、作者权限、私有草稿资产和所有 CMS 内容数据保留。
- [ ] AC9：CI 不再安装删除的 Playwright 或调用缺失的 CSP-hash 脚本；Caddy 的缓存与 CSP 规则面向 Next 资源和实际 hydration。
- [ ] AC10：用户任务开始前的四项 V2 改动和全部 Trellis 工具链改动未被覆盖或回退。
- [ ] AC11：相关 README、运维文档和项目规范不再把当前系统描述为 Astro/Pagefind/RSS/预览运行时。

## Out of Scope

- 删除 Directus 的 topics、posts_topics、note、文章、媒体、数据库约束或作者编辑能力。
- 批量改写现有 CMS 正文中的 /writing 或 /notes 链接。
- 重建草稿预览、RSS、Pagefind 或已删除的 V1 页面。
- 为未知 slug 或 notes 人为猜测重定向目标。
- 与本任务无关的 UI 重设计、Markdown 渲染器安全改造或生产数据库迁移。
- 覆盖、回退或删除任务开始前已有的用户改动。

## Key Decisions

- 用户确认恢复缺失的 /archives/[slug] 详情页。
- 用户确认删除失效的草稿预览链路，而非在 V2 重建它。
- 用户确认采用兼容策略：已知公开 /writing/[slug] 永久重定向到 /archives/[slug]；/notes/* 保持 404。
- Directus 保持为内容源，且 CMS 数据模型及生产内容不作为本轮删除对象。

## Open Questions

无阻塞问题。
