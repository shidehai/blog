# Technical Design: 移除 Writing/Notes/Topics

## Architecture Overview

当前系统有 4 种内容类型，计划移除 3 种，只保留 Post：

```
Before:
  Post       → /archives, /archives/[slug]
  Writing    → /writing, /writing/[slug]      ❌ 删除
  Note       → /notes                         ❌ 删除  
  Topic      → /topics, /topics/[slug]        ❌ 删除

After:
  Post       → /archives, /archives/[slug]    ✅ 保留
```

## Component Dependencies

### 数据层依赖关系
```
types.ts (定义)
  ↓
fixture.ts (测试数据) → directus.ts (快照构建) → content.ts (API)
                                                    ↓
                                              页面组件 & UI组件
```

### 删除顺序
1. **页面组件**（叶子节点）：app/writing, app/notes, app/topics
2. **UI 组件链接**：Navbar, CommandMenu, FeaturedPost, PostCard
3. **数据层函数**：content.ts 中的 4 个函数
4. **数据结构**：fixture.ts, mock.ts, directus.ts
5. **类型定义**（根节点）：types.ts 中的 Note, Topic 接口

## Data Flow Changes

### 当前首页数据流
```
FIXTURE_ROWS (fixture.ts)
  → buildSnapshot() (directus.ts)
    → snapshot (content.ts)
      → getLatestPosts() (content.ts)
        → HomePage/FeaturedPost/PostCard
          → ❌ 链接到 /writing/[slug]  (Bug!)
```

### 修正后首页数据流
```
FIXTURE_ROWS (fixture.ts)
  → buildSnapshot() (directus.ts)
    → snapshot (content.ts)
      → getLatestPosts() (content.ts)
        → HomePage/FeaturedPost/PostCard
          → ✅ 链接到 /archives/[slug]  (Fixed)
```

## Key Changes

### 1. 类型系统清理
**删除类型**：
- `Note` 接口（frontend-v2/lib/types.ts:72-80）
- `Topic` 接口（frontend-v2/lib/types.ts:63-70）

**保留类型**：
- `Post`, `Category`, `Tag`, `Series`, `Project`, `ActivityDay`, `ToolItem`

**影响**：TypeScript 会在编译时捕获所有对已删除类型的引用。

### 2. API 函数清理
**删除函数**（frontend-v2/lib/content.ts）：
```typescript
getAllTopics(): Promise<Topic[]>
getTopicBySlug(slug: string): Promise<Topic | undefined>
getPostsByTopic(slug: string): Promise<Post[]>
getAllNotes(): Promise<Note[]>
```

**保留函数**：
```typescript
getPostBySlug(slug: string): Promise<Post | undefined>
getAllPosts(): Promise<Post[]>
getLatestPosts(limit?: number): Promise<Post[]>
getPostsByCategory(category: string): Promise<Post[]>
getProfile(): Promise<SiteProfile>
// ... 其他 Post 相关函数
```

### 3. 路由架构变更
**删除路由**：
- `/writing` 及 `/writing/[slug]`
- `/notes`
- `/topics` 及 `/topics/[slug]`

**保留路由**：
- `/` (首页)
- `/archives` (文章列表)
- `/archives/[slug]` (文章详情)
- `/about`, `/projects`, `/toolbox` 等其他页面

### 4. 组件链接修正（Bug Fix）
**问题根源**：
- `FeaturedPost` 和 `PostCard` 接收 `Post` 类型数据
- 但链接硬编码为 `/writing/${post.slug}`
- `/writing` 路由即将被删除

**修正方案**：
- 所有 `Post` 类型链接统一到 `/archives/${post.slug}`
- 保持组件接口不变，只修改 `href` 属性

**影响范围**：
- `FeaturedPost.tsx`：3 处链接
- `PostCard.tsx`：2 处链接
- `CommandMenu.tsx`：1 处链接（搜索结果）

## Compatibility Notes

### 前端内部兼容性
- **类型安全**：TypeScript 编译会捕获所有未更新的引用
- **运行时安全**：删除路由后访问会返回 Next.js 默认 404 页面
- **组件解耦**：所有组件使用 `Post` 类型，不依赖 Writing/Note/Topic

### 外部链接兼容性
- 如果外部网站或搜索引擎索引了 `/writing/*` 链接，访问会返回 404
- **建议**：如需保留旧链接访问，可在 `next.config.ts` 添加 redirect 规则（本次不实施）

## Migration Notes

### 无需数据迁移
- 本次只删除前端代码和类型定义
- 不修改 Directus CMS 后端配置
- 不迁移或转换任何现有内容

### 如需恢复
如果未来需要恢复 Writing/Notes/Topics 功能：
1. 从 git 历史恢复相关文件
2. 恢复类型定义和数据函数
3. 恢复路由页面
4. 恢复导航链接

## Testing Strategy

### 单元测试（类型检查）
```bash
pnpm --filter frontend-v2 run typecheck
```
验证所有类型引用正确。

### 集成测试（ESLint）
```bash
pnpm --filter frontend-v2 run lint
```
验证代码质量和导入规范。

### 手动测试（浏览器）
1. 首页加载正常
2. 文章卡片链接到 `/archives/[slug]` 并能正常打开
3. `/archives` 列表页正常
4. `/writing`, `/notes`, `/topics` 返回 404
5. 导航栏和命令菜单无相关条目

## Rollback Plan

### Git 回滚
```bash
# 如果发现问题，可以回滚整个提交
git revert <commit-hash>
```

### 分阶段提交（推荐）
```bash
# Commit 1: 删除路由页面
# Commit 2: 清理类型和数据层
# Commit 3: 修正组件链接（可独立回滚）
```

## Performance Impact

- **包体积**：删除 3 个路由页面和相关组件，预计减少约 5-10KB（gzipped）
- **运行时性能**：无影响，已删除功能不再加载
- **构建时间**：略微减少，文件数减少
