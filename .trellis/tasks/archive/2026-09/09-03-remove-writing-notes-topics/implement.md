# Implementation Plan: 移除 Writing/Notes/Topics

## Execution Checklist

### Phase 1: 删除路由页面
- [ ] 删除 `frontend-v2/app/writing/` 目录
- [ ] 删除 `frontend-v2/app/notes/page.tsx`
- [ ] 删除 `frontend-v2/app/topics/` 目录

**验证**：
```bash
ls frontend-v2/app/writing 2>&1 | grep "No such file"
ls frontend-v2/app/notes/page.tsx 2>&1 | grep "No such file"
ls frontend-v2/app/topics 2>&1 | grep "No such file"
```

### Phase 2: 清理类型定义
- [ ] 从 `frontend-v2/lib/types.ts` 删除 `Topic` 接口（第63-70行）
- [ ] 从 `frontend-v2/lib/types.ts` 删除 `Note` 接口（第72-80行）

**验证**：
```bash
pnpm --filter frontend-v2 run typecheck 2>&1 | head -20
```

### Phase 3: 清理数据层函数
- [ ] 从 `frontend-v2/lib/content.ts` 删除 `getAllTopics()`
- [ ] 从 `frontend-v2/lib/content.ts` 删除 `getTopicBySlug()`
- [ ] 从 `frontend-v2/lib/content.ts` 删除 `getPostsByTopic()`
- [ ] 从 `frontend-v2/lib/content.ts` 删除 `getAllNotes()`
- [ ] 从 `frontend-v2/lib/content.ts` 移除 `import { Note, Topic }` 中的 Note 和 Topic

**验证**：
```bash
grep -n "getAllTopics\|getTopicBySlug\|getPostsByTopic\|getAllNotes" frontend-v2/lib/content.ts
# 应该无输出
```

### Phase 4: 清理 directus.ts buildSnapshot
- [ ] 检查 `frontend-v2/lib/directus.ts` 中 `buildSnapshot()` 是否有 Note/Topic 相关代码
- [ ] 如有则删除

**验证**：
```bash
grep -n "notes\|topics\|Note\|Topic" frontend-v2/lib/directus.ts
```

### Phase 5: 清理 fixture 和 mock 数据
- [ ] 从 `frontend-v2/lib/fixture.ts` 删除 `FIXTURE_NOTES`
- [ ] 从 `frontend-v2/lib/fixture.ts` 删除 `FIXTURE_TOPICS`
- [ ] 从 `frontend-v2/lib/mock.ts` 删除 Note/Topic mock 数据
- [ ] 从 `frontend-v2/lib/mock.check.ts` 清理相关检查

**验证**：
```bash
grep -n "FIXTURE_NOTES\|FIXTURE_TOPICS" frontend-v2/lib/fixture.ts
grep -n "Note\|Topic" frontend-v2/lib/mock.ts
```

### Phase 6: 更新导航组件
- [ ] 从 `frontend-v2/components/Navbar.tsx` 删除 "文章"、"随记"、"专题" 链接

**验证**：
```bash
grep -n "writing\|notes\|topics" frontend-v2/components/Navbar.tsx
# 应该无输出
```

### Phase 7: 更新命令菜单
- [ ] 从 `frontend-v2/components/CommandMenu.tsx` 删除 nav-writing（第69-71行）
- [ ] 从 `frontend-v2/components/CommandMenu.tsx` 删除 nav-notes（第76-78行）
- [ ] 从 `frontend-v2/components/CommandMenu.tsx` 删除 nav-topics（第83-85行）
- [ ] 从 `frontend-v2/components/CommandMenu.tsx` 修正第153行链接：`/writing/${p.slug}` → `/archives/${p.slug}`

**验证**：
```bash
grep -n "writing\|notes\|topics" frontend-v2/components/CommandMenu.tsx
# 应该无输出
```

### Phase 8: 修正组件链接（Bug Fix）
- [ ] `frontend-v2/components/FeaturedPost.tsx` 第20行：`/writing/${post.slug}` → `/archives/${post.slug}`
- [ ] `frontend-v2/components/FeaturedPost.tsx` 第36行：`/writing/${post.slug}` → `/archives/${post.slug}`
- [ ] `frontend-v2/components/FeaturedPost.tsx` 第39行：`/writing/${post.slug}` → `/archives/${post.slug}`
- [ ] `frontend-v2/components/PostCard.tsx` 第18行：`/writing/${post.slug}` → `/archives/${post.slug}`
- [ ] `frontend-v2/components/PostCard.tsx` 第32行：`/writing/${post.slug}` → `/archives/${post.slug}`

**验证**：
```bash
grep "/writing/" frontend-v2/components/FeaturedPost.tsx
grep "/writing/" frontend-v2/components/PostCard.tsx
# 应该无输出
grep "/archives/" frontend-v2/components/FeaturedPost.tsx | wc -l
# 应该输出 3
grep "/archives/" frontend-v2/components/PostCard.tsx | wc -l
# 应该输出 2
```

### Phase 9: 全量验证
- [ ] TypeScript 编译：`pnpm --filter frontend-v2 run typecheck`
- [ ] ESLint 检查：`pnpm --filter frontend-v2 run lint`
- [ ] 启动开发服务器：`pnpm --filter frontend-v2 run dev`
- [ ] 浏览器验证：
  - 访问 http://localhost:4322 首页正常
  - 点击首页文章卡片能打开 `/archives/[slug]` 详情页
  - 访问 `/archives` 列表页正常
  - 访问 `/writing` 返回 404
  - 访问 `/notes` 返回 404
  - 访问 `/topics` 返回 404
  - 导航栏无"文章"、"随记"、"专题"链接
  - 按 Cmd+K 打开命令菜单，无相关条目

## Rollback Points

- **Phase 1-2 后**：如果类型检查失败，可以通过 git 恢复文件
- **Phase 8 后**：关键 bug 修复完成，可以单独提交

## Risk Assessment

- **低风险**：删除独立路由页面，不影响其他功能
- **中风险**：修改共享组件链接（FeaturedPost、PostCard），需要仔细测试
- **低风险**：清理类型定义和数据函数，TypeScript 会捕获遗漏的引用

## Follow-up Checks

完成后运行：
```bash
# 全局搜索遗漏的引用
grep -rn "getAllTopics\|getTopicBySlug\|getPostsByTopic\|getAllNotes" frontend-v2/
grep -rn "FIXTURE_NOTES\|FIXTURE_TOPICS" frontend-v2/
grep -rn "/writing/" frontend-v2/components/
grep -rn "/notes" frontend-v2/components/
grep -rn "/topics" frontend-v2/components/
```
