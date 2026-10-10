# Technical Design: 全系统切换 V2 与 V1 清理方案

## 架构收敛与职责分界

### 1. 仓库结构重组
- **演进前**：根目录为 Astro V1（`src/`, `astro.config.ts`, `tests/`），子目录为 Next.js V2（`frontend-v2/`），双构建系统共存。
- **演进后**：
  - 前端应用完全由 `frontend-v2`（Next.js App Router 15+）承载。
  - 根目录保留作为 pnpm workspace 根节点，管理 Directus CMS（`deploy/`, `directus/`）、运维脚本（`ops/`, `scripts/`）以及顶层格式化/校验任务。
  - 废弃 `package.json.v1.backup` 及未使用的 V1 依赖。

### 2. 依赖清洗
- **移除**：
  - Astro 运行时与插件：`astro`, `@astrojs/*`, `eslint-plugin-astro`, `prettier-plugin-astro`。
  - V1 专属构建/测试工具：`vitest`, `@playwright/test`, `@axe-core/playwright`, `pagefind`, `lighthouse`, `chrome-launcher`。
- **保留**：
  - 基础代码规范：`prettier`, `eslint`, `typescript`, `typescript-eslint`。
  - CMS 与后端交互：`@directus/sdk` 及必要的基础数据处理工具。

### 3. 构建与脚本精炼 (The Ponytail Ladder)
- 根 `package.json` scripts 遵循最少代码原则：
  - `dev`: `pnpm --filter frontend-v2 dev`
  - `build`: `pnpm --filter frontend-v2 build`
  - `typecheck`: `pnpm --filter frontend-v2 typecheck`
  - `verify`: `pnpm --filter frontend-v2 typecheck && pnpm --filter frontend-v2 build`
  - 移除已经失效的 `assets:generate` 钩子。
- Next.js Standalone 容器化交付：
  - `Dockerfile` 使用多阶段构建（base -> dependencies -> build -> runtime）。
  - 产出 standalone 输出文件并在端口 3000 暴露运行。

### 4. 静态资源托管
- `frontend-v2/public/` 已经包含 `avatar.jpg`、`avatar.png`。
- 迁移或生成基本的 favicon 至 `frontend-v2/app/` 或 `frontend-v2/public/`，避免页面缺失图标。
