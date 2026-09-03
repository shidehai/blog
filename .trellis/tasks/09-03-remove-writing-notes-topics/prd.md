# PRD: 移除文章、随记、专题三个内容类型

## Goal

从系统中完全移除 `writing`（文章）、`notes`（随记）、`topics`（专题）三个内容类型的前后端实现，简化内容架构，统一使用 `Post` 类型和 `/archives` 路由。

## Background

当前系统有多个内容类型：
- **Post**（博客文章）：主要内容类型，通过 `/archives` 和首页展示
- **Writing**（文章）：独立路由 `/writing`，有列表页和详情页
- **Note**（随记）：独立路由 `/notes`，短篇碎片记录
- **Topic**（专题）：独立路由 `/topics`，按标签维度归纳的内容集合

用户决定只保留 Post 类型，移除其他三个内容类型。

## Requirements

### R1: 删除路由页面
- 删除 `frontend-v2/app/writing/` 目录（含 `page.tsx`、`[slug]/`、`WritingListClient.tsx`）
- 删除 `frontend-v2/app/notes/page.tsx`
- 删除 `frontend-v2/app/topics/` 目录（含 `page.tsx`、`[slug]/`）

### R2: 清理类型定义
- 从 `frontend-v2/lib/types.ts` 移除 `Topic` 和 `Note` 接口（第63-80行）

### R3: 清理数据层
- 从 `frontend-v2/lib/content.ts` 移除：
  - `getAllTopics()`（第116行）
  - `getTopicBySlug()`（第120行）
  - `getPostsByTopic()`（第128行）
  - `getAllNotes()`（第134行）
- 从 `frontend-v2/lib/directus.ts` `buildSnapshot()` 中移除 Note/Topic 相关代码
- 从 `frontend-v2/lib/fixture.ts` 移除 `FIXTURE_NOTES` 和 `FIXTURE_TOPICS`
- 从 `frontend-v2/lib/mock.ts` 移除 Note/Topic mock 数据

### R4: 更新导航和链接
- 从 `frontend-v2/components/Navbar.tsx` 移除 "文章"、"随记"、"专题" 导航链接
- 从 `frontend-v2/components/CommandMenu.tsx` 移除：
  - 第69-71行：nav-writing
  - 第76-78行：nav-notes
  - 第83-85行：nav-topics
  - 第153行：writing 文章链接

### R5: 修正组件中的链接
**问题**：`FeaturedPost.tsx` 和 `PostCard.tsx` 中使用 `/writing/${post.slug}` 链接到文章详情页，但这些组件展示的是 `Post` 类型数据，应该链接到 `/archives/${post.slug}`。

- 修正 `frontend-v2/components/FeaturedPost.tsx`：
  - 第20行：`/writing/${post.slug}` → `/archives/${post.slug}`
  - 第36行：`/writing/${post.slug}` → `/archives/${post.slug}`
  - 第39行：`/writing/${post.slug}` → `/archives/${post.slug}`
- 修正 `frontend-v2/components/PostCard.tsx`：
  - 第18行：`/writing/${post.slug}` → `/archives/${post.slug}`
  - 第32行：`/writing/${post.slug}` → `/archives/${post.slug}`

## Out of Scope

- 不修改 `Post` 类型及其所有功能（`/archives`、`/archives/[slug]`）
- 不修改 `Category`、`Tag`、`Series` 类型
- 不修改 Directus CMS 后端配置（仅前端删除）
- 不迁移或转换任何现有 writing/notes/topics 内容到 Post

## Acceptance Criteria

**AC1**: `/writing`、`/notes`、`/topics` 路由访问返回 404

**AC2**: 导航栏不显示"文章"、"随记"、"专题"链接，命令菜单中无相关条目

**AC3**: 首页 FeaturedPost 和 PostCard 链接到 `/archives/${slug}`，点击后正常打开文章详情页

**AC4**: TypeScript 编译通过：`pnpm --filter frontend-v2 run typecheck`

**AC5**: ESLint 检查通过：`pnpm --filter frontend-v2 run lint`

**AC6**: 首页和 `/archives` 功能正常，显示 Post 列表

## Open Questions

_无阻塞问题_

## Technical Notes

### 影响文件清单（共13个文件）

**删除（3项）**：
```
frontend-v2/app/writing/                    ← 删除整个目录
frontend-v2/app/notes/page.tsx              ← 删除文件
frontend-v2/app/topics/                     ← 删除整个目录
```

**修改（10个文件）**：
```
frontend-v2/lib/types.ts                    ← 移除 Note, Topic 接口
frontend-v2/lib/content.ts                  ← 移除 4 个函数
frontend-v2/lib/directus.ts                 ← 清理 buildSnapshot
frontend-v2/lib/fixture.ts                  ← 移除 FIXTURE_NOTES, FIXTURE_TOPICS
frontend-v2/lib/mock.ts                     ← 移除 mock 数据
frontend-v2/components/Navbar.tsx           ← 移除导航链接
frontend-v2/components/CommandMenu.tsx      ← 移除 4 处引用
frontend-v2/components/FeaturedPost.tsx     ← 修正 3 处链接
frontend-v2/components/PostCard.tsx         ← 修正 2 处链接
```

### 关键发现

1. **FeaturedPost 和 PostCard 使用错误路由**：这两个组件接收 `Post` 类型但链接到 `/writing/${slug}`，应该链接到 `/archives/${slug}`。这是一个**既有 bug**，需要在本次清理中一并修复。

2. **保留的核心类型**：
   - `Post`, `Category`, `Tag`, `Series`, `Project`, `ActivityDay`, `ToolItem` 
   - `/archives` 和 `/archives/[slug]` 路由
   - `getPostBySlug()`, `getAllPosts()`, `getLatestPosts()` 等 Post 相关函数
