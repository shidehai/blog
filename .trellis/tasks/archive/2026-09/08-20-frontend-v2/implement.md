# 新版极简高颜值前端 V2 (Implementation Plan)

## 1. 实施阶段与步骤清单 (Ordered Checklist)

### 阶段一：项目初始化与环境配置 (Scaffolding & Setup)
- [x] 在根目录下创建 `frontend-v2/` 目录结构。
- [x] 创建 `frontend-v2/package.json` 并安装核心依赖（Next.js 15, React 19, Tailwind CSS, Lucide, Framer Motion, Directus SDK, Markdown 相关库）。
- [x] 配置 `frontend-v2/tsconfig.json`, `tailwind.config.ts`, `postcss.config.mjs`, `next.config.ts`。
- [x] 配置根目录 `package.json` 中的 `dev:v2` 与 `build:v2` 脚本。
- [x] 根 `tsconfig.json` / `eslint.config.js` 排除 `frontend-v2`（子包自带 lint 与 tsconfig）；`.gitignore` 排除 `.next/`、`next-env.d.ts`、`*.tsbuildinfo`。

### 阶段二：数据层与工具库开发 (Data Layer & Utils)
- [x] 实现 `frontend-v2/lib/types.ts`（文章、随记、专题、站点设置等类型定义）。
- [x] 实现 `frontend-v2/lib/content.ts`（统一数据入口）。
- [ ] **未完成**：`frontend-v2/lib/directus.ts` 不存在，`content.ts` 无条件返回 `lib/mock.ts` 夹具，`@directus/sdk` 已装未用。PRD 验收「数据层成功对接 Directus API」未满足。
- [x] `frontend-v2/lib/fixture.ts` 保留为 Directus 形状（蛇形字段）的离线夹具，自带本地类型；接入 Directus 时需在 `content.ts` 补一层映射。
- [x] 实现 `frontend-v2/lib/markdown.ts`（Markdown 解析、目录生成 TOC、阅读时长计算）。
- [x] `frontend-v2/lib/mock.check.ts` 夹具自检（专题计数与真实文章一致、slug URL 安全且唯一、文章 slug 唯一）：`npx tsx lib/mock.check.ts`。

### 阶段三：设计系统与核心 UI 组件 (Design Tokens & UI Shell)
- [x] 编写 `frontend-v2/app/globals.css`（深浅色变量、背景、毛玻璃等）。
- [x] 实现 `Navbar.tsx`（导航、响应式抽屉、主题菜单）。修复：原先只写 `data-theme`，而 Tailwind 配的是 `darkMode: "class"`，98 处 `dark:` 变体全不生效（深色模式半残）。现同时写 `data-theme` 与 `.dark`，并加 localStorage 持久化与 system 跟随。
- [x] 导航补齐 `/writing`、`/notes`、`/topics`（原先这三个 PRD 页面在 Navbar 与 ⌘K 中都没有入口，无法访问）。
- [x] 实现 `Footer.tsx`、`CommandMenu.tsx`（⌘K 搜索与键盘交互）、`PostCard.tsx`。
- [x] `NoteTimelineItem.tsx` 改为消费 `Note` 类型并接入 `/notes`（原按 V1 蛇形字段写、且链向不存在的随记详情页，处于未使用状态）。
- [x] 实际外壳为 `LayoutShell.tsx` + `BackgroundCanvas.tsx`，非计划中的 `AmbientGlow.tsx`；主题切换内置于 Navbar，非独立 `ThemeToggle.tsx`。
- [x] 已删除 6 个无引用组件：`AmbientGlow.tsx`、`ThemeToggle.tsx`、`ReadingProgress.tsx`、`TableOfContents.tsx`、`SpotlightCard.tsx`、`BackToTop.tsx`（功能分别由 `BackgroundCanvas`、Navbar 主题菜单、`ArticleClient` 内联 TOC/进度条、`LayoutShell` 双向滚动按钮覆盖）。组件数 19 → 13，全部在用。
- [x] **色板统一**：修好深色模式后暴露出两套设计系统并存 —— `globals.css` 的 CSS 变量系统（砖红 `#c83a27` / 薄荷青 `#57d9c8`，1900+ 行，管着导航/页脚/文章详情/命令面板及 5 个三栏页面）vs 8 个文件里 153 处硬编码（暖纸白 `#f5f2eb` / 橙 `#c2410c`，无侧栏页面）。已将 153 处全部映射到 CSS 变量并删除所有 `dark:` 变体（变量本身按主题翻转，成对硬编码塌缩为单一变量引用）。现全站零硬编码颜色。
- [x] design.md 第 4 节已重写为实际色板、字体家族、两种布局模式与 13 个组件清单（原文档记的天蓝/靛蓝方案在实现中被放弃，从未落地）。

### 阶段四：全站页面开发与精细打磨 (Pages Implementation)
- [x] **首页 (`app/page.tsx`)**：Hero、精选、最新文章、活跃热力图。
- [x] **文章列表 (`app/writing/page.tsx`)**：`WritingListClient` 专题筛选。
- [x] **文章详情页 (`app/writing/[slug]/page.tsx`)**：进度条、TOC 跟随、代码高亮与一键复制、上下篇切换，均由 `ArticleClient.tsx` 内联实现（未使用计划中的独立组件）。修复字段名错误 `coverImage`→`cover`、`excerpt`→`summary`。
- [x] **随记流 (`app/notes/page.tsx`)**：改为 `NoteTimelineItem` 垂直时间轴（原为平铺卡片）。新增 `getAllNotes()` 与 5 条随记夹具。
- [x] **专题列表与详情 (`app/topics/page.tsx` & `app/topics/[slug]/page.tsx`)**：新增 `getAllTopics()` / `getTopicBySlug()` / `getPostsByTopic()`。专题由文章真实 tag 推导，计数现算（原打算复用 `MOCK_TAGS.count` 手写值，会出现「标称 7 篇、列表 1 篇」及零篇空专题页）；slug 显式给定，避免中文变成百分号编码 URL。
- [x] **关于页 (`app/about/page.tsx`)**。
- [x] **超出 PRD 的页面**（已存在且可访问）：`/archives`、`/categories`、`/categories/[slug]`、`/series`、`/series/[slug]`、`/tags`、`/tools`、`/projects`。修复 `/series` 的 `postCount`→`count`；为 `/projects` 新增 `Project` 类型、`getAllProjects()` 与 4 条夹具。
- [ ] **偏差**：站内同时存在「专题(topics)」与「分类(categories)/标签(tags)/系列(series)」两套内容归类，语义重叠。V1 的 Directus 只有 `topics`，`categories`/`tags`/`series` 是 v2 自造模型，接 Directus 时需要取舍。

### 阶段五：验证与质量检查 (Verification & QA)
- [x] 执行构建测试 `pnpm --filter frontend-v2 build`：通过，40 个静态页面。（修复前失败：`content.ts` 缺 5 个导出 + 38 个类型错误 + 1 个 lint 错误。）
- [x] `npx tsc --noEmit` 零错误；`next lint` 无告警。
- [x] `npx tsx lib/mock.check.ts` 夹具自检通过：10 专题 / 5 文章 / 5 随记 / 4 项目。
- [x] 生产模式 `next start -p 4322` 冒烟测试 16 条路由全部 200，含 `/notes`、`/topics`、`/topics/[slug]`、`/projects`；页面内容与专题计数已核对一致。
- [x] 验证 V1 未受破坏：`pnpm test:unit` 80 项通过、`pnpm lint` 干净、`pnpm format:check` 干净、`astro check` 零错误、`pnpm build` 成功。
- [x] 共存验证：V1(4321) 与 V2(4322) 同时监听，两端首页均 200。
- [ ] **未验证**：深浅色切换、响应式、⌘K 交互、TOC 跟随与代码复制均为客户端行为，仅确认了代码正确性与产物包含（`data-theme`、`toggle("dark",t)`、`getItem("theme")` 已进 layout chunk），未做真实浏览器交互测试。
