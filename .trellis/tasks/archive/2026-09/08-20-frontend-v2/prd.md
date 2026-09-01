# 新版极简高颜值前端 V2 (PRD)

## 1. 目标与背景 (Goal)

在保留现有 V1 博客前端（Astro，端口 4321）的前提下，构建一套全新的、高美感与极佳交互体验的 V2 前端（Next.js 15，端口 4322）。
新前端完全复用现有的 Directus CMS 接口与数据模型（以及开发夹具 fallback），独立运行与构建，提供与 V1（触感浮雕/工作台）截然不同的现代光影、极简社论质感（Modern Kinetic Editorial / Studio）。

## 2. 核心功能与页面需求 (Requirements)

### 2.1 视觉风格与全局设计 (Visual & Global Shell)
- **双主题光影系统**：
  - **Dark Mode (曜黑)**：深色背景搭配微弱的环境光晕（Ambient Mesh Glow）、卡片边框流光、低噪点毛玻璃（Frosted Glass）。
  - **Light Mode (晨曦)**：温暖通透的纸质印刷质感，清晰的层级与柔和微阴影。
- **动态导航栏 (Navbar)**：
  - 悬浮胶囊/毛玻璃导航栏，集成快捷导航（首页、文章、随记、专题、关于）。
  - 全局主题切换按钮（带平滑过渡动效）。
  - ⌘K / Ctrl+K 搜索按钮入口。
- **全局极客搜索面板 (Command Menu / ⌘K)**：
  - 支持键盘快捷键（⌘K / Ctrl+K）调出。
  - 支持实时模糊搜索文章、随记、专题分类及快捷页面跳转。
  - 键盘方向键上下选择，Enter 快速进入。

### 2.2 页面规划 (Pages)
1. **首页 (`/`)**：
   - **Hero 区域**：个人品牌介绍、Tagline 标语、状态徽章、社交媒体链接。
   - **精选推荐 (Featured Posts)**：大卡片网格，展示高光文章与核心内容。
   - **最新写作 (Latest Writing) & 随记流 (Latest Notes)**：并列或分段展示最新技术文章与碎片化随记。
   - **专题分类磁贴 (Topic Clouds / Grid)**：快速探索各类技术主题。
2. **文章归档与列表 (`/writing`)**：
   - 支持按分类、按年份时间线筛选。
   - 提供视图切换（精美卡片视图 / 极简列表视图）。
3. **文章详情页 (`/writing/[slug]`)**：
   - 顶部阅读进度指示条（Scroll Progress Bar）。
   - 文章元信息（发布日期、预估阅读时间、所属专题、字数统计）。
   - Markdown 正文排版优化（标题层级、引用块、列表、图片带圆角/边框）。
   - 代码高亮与交互（带语言标签、一键复制按钮、行号）。
   - 右侧悬浮跟随目录（Table of Contents with Scrollspy）。
   - 底部文章导航（上一篇 / 下一篇推荐）与返回顶部。
4. **随记与碎片思考 (`/notes`)**：
   - 垂直时间轴（Timeline）流式布局，突出碎片化思考与快速记录。
5. **专题分类页 (`/topics` & `/topics/[slug]`)**：
   - 展示所有专题分类卡片，点击可查看该分类下的所有文章与随记。
6. **关于与站点信息 (`/about`)**：
   - 优雅的个人履历、技术栈卡片、设计理念与联系方式。

### 2.3 数据层与接口复用 (Data & Integration)
- 完美复用现有 Directus CMS 架构与环境变量 (`DIRECTUS_URL`, `DIRECTUS_BUILD_TOKEN`, `DIRECTUS_PREVIEW_TOKEN`)。
- 当 Directus 服务不可用或处于纯离线开发模式时，无缝降级到本地预设夹具（Fixture Data），确保始终可正常运行预览。

### 2.4 独立运行配置 (Port & Scripts)
- 独立配置端口为 `4322`，与 V1 前端（`4321`）及 Directus（`8055`）并行不冲突。
- 根目录提供一键启动脚本：`pnpm dev:v2`。

## 3. 验收标准 (Acceptance Criteria)

- [ ] `frontend-v2` 成功初始化，使用 Next.js 15 (App Router) + Tailwind CSS + Lucide Icons + Framer Motion。
- [ ] 数据层成功对接 Directus API，并具备完善的本地 Fixture 降级保护。
- [ ] 首页、文章列表、文章详情、随记、专题分类、关于页面全部正常渲染并具备高质量美感设计。
- [ ] 文章详情页包含：阅读进度条、TOC 目录跟随、代码高亮、一键复制代码。
- [ ] 全局支持 ⌘K / Ctrl+K 搜索面板，支持实时搜索与键盘导航。
- [ ] 支持浅色/深色主题无缝平滑切换，响应式适配移动端与桌面端。
- [ ] 在根目录执行 `pnpm dev:v2` 可在 `http://localhost:4322` 启动并流畅访问，不影响现存 V1 前端。
