# 新版极简高颜值前端 V2 (Technical Design)

## 1. 架构概览 (Architecture Overview)

`frontend-v2/` 作为一个现代化的独立 Next.js 15 (React 19) App Router 应用，位于同一代码仓库内，复用现有的 Directus CMS 接口和数据结构。

```
vibehub/blog/
├── src/                          # 现有 V1 前端 (Astro 5, port 4321)
├── directus/                     # Directus 模式与种子数据 (CMS, port 8055)
├── frontend-v2/                  # 🌟 新版 V2 前端 (Next.js 15, port 4322)
│   ├── app/
│   │   ├── layout.tsx            # 全局布局 (Theme, Navbar, Footer, CommandMenu, AmbientGlow)
│   │   ├── page.tsx              # 首页 (Hero, Bento, Featured, Latest Writing & Notes, Topics)
│   │   ├── globals.css           # Tailwind + 设计系统全局变量 (Dark/Light tokens)
│   │   ├── writing/
│   │   │   ├── page.tsx          # 文章列表与分类筛选
│   │   │   └── [slug]/page.tsx   # 文章详情 (Progress, TOC, Markdown Renderer, Code Highlighting)
│   │   ├── notes/
│   │   │   └── page.tsx          # 随记时间线 (Timeline Stream)
│   │   ├── topics/
│   │   │   ├── page.tsx          # 所有专题
│   │   │   └── [slug]/page.tsx   # 专题详情列表
│   │   └── about/
│   │       └── page.tsx          # 关于页 (Profile, Stack, Design Philosophy)
│   ├── components/
│   │   ├── Navbar.tsx            # 悬浮毛玻璃胶囊导航
│   │   ├── Footer.tsx            # 现代页脚
│   │   ├── ThemeToggle.tsx       # 主题切换器
│   │   ├── CommandMenu.tsx       # ⌘K 全局搜索弹窗 (CMDK)
│   │   ├── ReadingProgress.tsx   # 顶部滚动进度条
│   │   ├── TableOfContents.tsx   # 目录跟随与滚动高亮
│   │   ├── MarkdownContent.tsx   # 增强 Markdown 渲染器 (Shiki/Highlight + CodeCopy)
│   │   ├── PostCard.tsx          # 现代光影文章卡片
│   │   ├── NoteTimelineItem.tsx  # 随记时间线节点卡片
│   │   └── AmbientGlow.tsx       # 背景动态光晕
│   ├── lib/
│   │   ├── directus.ts           # Directus SDK 客户端与接口调用
│   │   ├── content.ts            # 数据获取统一层 (Directus + Fixture fallback)
│   │   ├── markdown.ts           # Markdown 解析、目录提取、阅读时长估算
│   │   └── types.ts              # TypeScript 类型定义
│   ├── package.json              # 独立依赖与运行脚本
│   ├── tailwind.config.ts        # Tailwind 主题与渐变、动画配置
│   ├── tsconfig.json             # TypeScript 配置
│   └── next.config.ts            # Next.js 独立端口与图片白名单配置
```

## 2. 核心技术栈与依赖 (Tech Stack)

- **框架**: Next.js 15 (App Router, Server Components + Client Components 混合)
- **UI & 样式**: Tailwind CSS (含 typography 插件与自定义阴影/发光渐变)
- **图标**: `lucide-react`
- **动效**: `framer-motion`
- **搜索弹窗**: `cmdk` (或自定义 React 19 兼容轻量指令菜单)
- **Markdown / 代码高亮**: `remark` / `rehype` / `shiki` 或 `highlight.js`

## 3. 数据流与降级策略 (Data Flow & Fallback)

1. **统一数据入口 (`frontend-v2/lib/content.ts`)**：
   - 读取 `.env` 中的 `DIRECTUS_URL` 与 Token。
   - 优先通过 `@directus/sdk` 向 Directus 获取已发布的文章 (`posts`)、专题 (`topics`)、站点设置 (`site_settings`)、社交链接 (`social_links`)。
   - 当 Directus 未启动或网络不可达时，自动回退至预设的编辑级夹具数据（Fixture），保障本地无缝开发与预览。
2. **静态生成与按需 ISR**：
   - 页面支持静态生成与动态缓存（`revalidate: 60`），兼具超快首屏与实时更新。

## 4. 视觉设计系统 (Design Tokens)

**实际色板**（`frontend-v2/app/globals.css` 定义，全站统一通过 CSS 变量消费）：

- **Light Theme**:
  - Background: `#f3f3ef` (米灰), Card: `#fffefa` (暖白)
  - Accent: `#c83a27` (砖红), Secondary: `#08776f` (青绿)
  - Text: Primary `#181b1a`, Secondary `#4d5552`, Muted `#646d6a`
  - Border: `rgba(24, 27, 26, 0.2)`, Shadow: `3px 3px 0 rgba(24, 27, 26, 0.07)` (平面偏移阴影)

- **Dark Theme**:
  - Background: `#080a0b`, Card: `rgba(16, 20, 20, 0.9)`
  - Accent: `#57d9c8` (薄荷青), Secondary: `#ff806a` (橙珊瑚)
  - Text: Primary `#f0f3ef`, Secondary `#adb8b4`, Muted `#7d8b87`
  - Border: `rgba(207, 230, 224, 0.14)`, Code: `#070909`

**字体家族**:
- Sans: `'Inter'` → `var(--font-sans)`
- Mono: `'JetBrains Mono'` → `var(--font-mono)`
- Display: `Georgia, 'Noto Serif SC'` → `var(--font-display)` (serif 正文标题)

**布局模式**:
- **三栏布局**（categories/archives/about/series/tools）: `.layout` grid `184px | 1fr | 184px` + `SideLeft` + `SideRight`，包含个人卡片、分类导航、日历小组件、活动热力图
- **全宽内容页**（topics/notes/projects/writing）: 无侧栏，专注内容消费，响应式容器最大宽度 `max-w-5xl`

**组件库**: 13 个核心组件（`ActivityHeatmap`, `BackgroundCanvas`, `CommandMenu`, `FeaturedPost`, `Footer`, `LayoutShell`, `MarkdownContent`, `Navbar`, `NoteTimelineItem`, `PostCard`, `ProjectCard`, `SideLeft`, `SideRight`），全部通过 CSS 变量系统消费色板，无硬编码颜色

## 5. 端口与脚本集成

- `frontend-v2` 的 `dev` 脚本：`next dev -p 4322`
- 根目录 `package.json` 增加快捷命令：
  ```json
  "dev:v2": "pnpm --filter frontend-v2 dev"
  ```
  或者 `pnpm -C frontend-v2 dev`
