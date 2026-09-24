# 修复 frontend-v2 lint 假绿门禁

## Goal

让 frontend-v2 的 lint 门禁从"零检查但报告通过"的假绿状态，变为真正执行 Next.js + React Hooks + TypeScript 规则的真实门禁，同时消除 `next lint` 的 Next 16 弃用警告。

## Background

- `frontend-v2/` 没有任何 ESLint 配置文件；ESLint 配置发现会向上走到根 `eslint.config.js`，而根配置的 ignores 含 `frontend-v2/**`（该 ignore 本身的意图正确：根门禁只管 `scripts` 和 `directus`）。
- 实测证据：`pnpm exec eslint app/page.tsx` → "File ignored because of a matching ignore pattern"，exit 0。`next lint` 的 "✔ No ESLint warnings or errors" 是在零文件被检查的前提下报告的。
- 依赖约束（npm registry 已核实）：`eslint-config-next@15.5.23` peer 仅支持 eslint ^7–^9，与根 `eslint@10.8.0` 和 `strict-peer-dependencies=true` 冲突，故不采用；改用无 eslint peer 依赖的 `@next/eslint-plugin-next@15.5.23`（与 next 同版本）+ `eslint-plugin-react-hooks`（peer 支持 ^10）+ `typescript-eslint`（与根同版本 8.65.0）手写 flat config。
- `next lint` 将在 Next.js 16 移除，官方迁移方向是 ESLint CLI。

## Requirements

- 新增 `frontend-v2/eslint.config.mjs`（flat config）：typescript-eslint recommended + react-hooks recommended + @next/next recommended & core-web-vitals 规则；ignores 至少含 `.next/**`、生成的 `next-env.d.ts`。
- `frontend-v2/package.json`：`lint` 脚本从 `next lint` 改为 `eslint .`；devDependencies 增加 `@next/eslint-plugin-next@15.5.23`、`eslint-plugin-react-hooks`、`typescript-eslint@8.65.0`（eslint 本体复用根 10.8.0，经 workspace 根 node_modules 解析，不重复声明以避免版本漂移）。
- 根 `eslint.config.js` 对 `frontend-v2/**` 的 ignore 保持不变（根门禁职责不变）。
- 修复真实规则生效后暴露出的存量违规（预期很少，因为 typecheck 一直在兜底；react-hooks 类问题 typecheck 查不出，是本次的主要捕获面）。
- **负向验证**：临时引入一处 react-hooks 违规，确认 `pnpm --filter frontend-v2 lint` 失败，然后还原 —— 证明门禁不是假绿。

## Acceptance Criteria

- [x] `pnpm --filter frontend-v2 lint` 对真实文件执行检查并通过（不再是 ignored-file 假绿）
- [x] 故意引入 react-hooks 违规时 lint 失败，还原后通过（在 CommandMenu 注入条件 Hook，exit 1 捕获 `react-hooks/rules-of-hooks`，已还原）
- [x] 无 `next lint` 弃用警告残留（脚本改为 `eslint .`；构建期 lint 经 `ignoreDuringBuilds` 关闭，"plugin not detected" 警告消失）
- [x] `pnpm --filter frontend-v2 verify` 中 typecheck/lint/selfcheck/SSG 全绿（standalone trace-copy 的 Windows symlink EPERM 为已知环境问题，见 spec）
- [x] 根 `pnpm lint` 与 `pnpm format:check` 通过
- [x] spec 记录 lint 配置归属契约（quality-guidelines.md 新增 "Lint Gate Ownership"）

## 真实规则捕获并修复的存量问题

- `CommandMenu.tsx` / `Navbar.tsx`：3 处 `react-hooks/set-state-in-effect` —— 打开重置与路由收起改为渲染期间按 props 调整状态（React 官方推荐模式）；主题初始化从 localStorage 恢复属水合安全设计，加带理由的定点豁免
- `lib/directus.ts`：未使用的 `catch (error)` 绑定改为无绑定 `catch`
- `@next/next/no-img-element` 5 处警告：项目有意使用原生 `<img>`（09-20 决策），规则在配置中显式关闭并注明理由

## Out of Scope

- 不降级根目录 eslint 10 以适配 eslint-config-next。
- 不启用 type-aware（typed linting）规则集。
- 不改变根门禁对 scripts/directus 的现有规则。
