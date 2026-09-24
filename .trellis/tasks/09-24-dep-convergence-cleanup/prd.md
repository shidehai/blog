# 依赖版本收敛与遗留收尾

## Goal

消除项目评审中发现的依赖版本漂移与未收尾工作，让仓库回到"单一权威版本 + 无悬挂状态"的基线。

## Background

评审发现四组问题：

1. **zod 大版本分裂**：根目录 `zod@4.4.3`（directus/seed 使用），`frontend-v2` 仍 `zod@^3.24.2`，大版本 API 不兼容。
2. **@types/node 漂移**：根目录 `24.13.3`，`frontend-v2` 为 `^22.13.4`，而 engines 要求 Node 24。
3. **未提交删除**：工作区中 `frontend-v2/public/avatar.jpg`、`avatar.png`、`favicon.svg` 已删除但未提交，需核实无残留引用后随本任务提交。
4. **悬挂任务**：`09-20-remove-unused-code` 仍 `in_progress`，但近期提交已完成其主体清理；`lib/mock.ts` 仍被 `content.ts` / `directus.ts` 引用（projects / activity / profile 数据），属于"有意的静态内容"而非死代码，该任务应核实后归档。

## Requirements

- `frontend-v2` 升级到 zod 4（与根目录 4.4.3 对齐），迁移弃用 API：
  - `z.string().url()` → `z.url()`（`lib/env.ts`）
  - `z.string().datetime({ offset: true })` → `z.iso.datetime({ offset: true })`（`lib/directus.ts`）
  - 其余用法（object/enum/nullish/nullable/default/parse）在 v4 中兼容，逐一核实。
- `frontend-v2` 的 `@types/node` 升级到 `^24`，与 engines `node >=24.15.0 <25` 对齐。
- 核实 `avatar.jpg` / `avatar.png` / `favicon.svg` 删除后无代码引用（fixture 头像路径处理已在 223beae 修正），将删除纳入本任务提交批次。
- 核实 `09-20-remove-unused-code` 无遗留可删死代码后将其归档（archive）。
- **明确排除**：不引入单元测试框架（用户已确认另开任务规划）；不重命名 `frontend-v2`；不调整 monorepo 结构。

## Acceptance Criteria

- [ ] `frontend-v2/package.json` 中 zod 为 `^4.4.3`，`@types/node` 为 `^24`
- [ ] 代码中无 zod v3 弃用 API 残留（无 `z.string().url()`、无 `z.string().datetime(`）
- [ ] `pnpm install --frozen-lockfile` 更新后 `pnpm verify` 全绿（typecheck + lint + selfcheck + build）
- [ ] `pnpm format:check` 与根目录 lint 通过
- [ ] 三个 public 资源删除已提交，且全库 grep 无 `/avatar.jpg`、`/avatar.png`、`/favicon.svg` 引用
- [ ] `09-20-remove-unused-code` 已归档
