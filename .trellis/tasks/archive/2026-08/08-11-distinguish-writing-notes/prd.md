# 区分写作与笔记页签体验

## Goal

降低“写作”和“笔记”两个独立页签的重复感，让访客一眼理解：写作是可完整阅读的文章/教程集合，笔记是按时间浏览的短记录流，同时保留现有内容类型和路由。

## Background

- `src/pages/writing/index.astro` 只筛选 `article` 与 `tutorial`，并按“教程 / 文章”分组。
- `src/pages/notes/index.astro` 只筛选 `note`，以单一列表呈现。
- 两页共同复用 `PageHeader`、`browse-toolbar`、`PostList` 和 `PostListRow`；当前差异主要是筛选项、分组说明和笔记列表的紧凑 CSS。
- 内容模型与路由已经区分三种类型，问题是浏览体验的感知相似，而不是内容重复。

## Requirements

- 保留 `/writing/` 与 `/notes/` 两个独立入口，不合并内容类型或改变现有文章 URL。
- 明确写作页的“完整阅读 / 分类浏览”定位，以及笔记页的“短记录 / 时间流”定位。
- 改动范围优先限定在两个索引页及其相关展示样式；不改变文章详情页、内容模型和首页的信息架构，除非规划阶段证明必要。
- 保持现有主题、响应式布局、键盘可访问性和空状态互链行为。

## Key Decisions

- 采用“保留两个路由、强化展示差异”的方向：写作页保留分组和阅读信息；笔记页改成更轻量的时间线 / 短记录流。
- 不合并两个入口，也不引入新的内容类型或客户端状态管理。

## Acceptance Criteria

- [x] `/writing/` 与 `/notes/` 的页面结构或视觉节奏有可感知差异，且文案能解释各自定位。
- [x] 两页仍只展示各自对应的内容类型，现有路由、主题和响应式行为不回归。
- [x] 相关端到端断言覆盖新的可观察结构；现有测试通过。
- [x] 空数据状态仍能在两个页签之间顺畅跳转。

## Out of Scope

- 合并、重命名或迁移 `/writing/`、`/notes/` 路由。
- 修改 Directus 内容模型、发布流程或文章详情阅读体验。
- 重做首页、主题页、搜索页和完整归档页。

## Open Questions

- 无阻塞性问题。

## Notes

- Keep `prd.md` focused on requirements, constraints, and acceptance criteria.
- Lightweight tasks can remain PRD-only.
- For complex tasks, add `design.md` for technical design and `implement.md` for execution planning before `task.py start`.
