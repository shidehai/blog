# Implementation Plan: 全系统切换 V2 与 V1 清理方案

## 执行清单

- [ ] **1. 清理工作区残留与 V1 源码**
  - 使用 `git rm` 确认删除 `src/`、`tests/`、`astro.config.ts`、`playwright.config.ts`、`tsconfig.json`、`vitest.config.ts` 等文件。
  - 删除临时文件 `package.json.v1.backup`。
  - 清理 `.astro` 缓存目录（如有）。

- [ ] **2. 精炼根级 package.json**
  - 移除 `predev` 及 `build` 中的 `assets:generate` 依赖。
  - 剔除无用的 devDependencies（`vitest`, `@playwright/test`, `@axe-core/playwright`, `chrome-launcher`, `lighthouse`, `pagefind` 等）。
  - 更新 `pnpm install` 确保锁文件同步。

- [ ] **3. 补全 frontend-v2 静态资源**
  - 确保 favicon / 图标在 `frontend-v2` 下正常解析或放置于 `frontend-v2/public/`。

- [ ] **4. 校验 Dockerfile 交付配置**
  - 确认 Dockerfile 多阶段构建与 Next.js standalone 输出匹配无误。

- [ ] **5. 全链路验证与门禁测试**
  - 运行 `pnpm typecheck` 确认无类型错误。
  - 运行 `pnpm build` 确认 26 个路由静态页面正常构建。
  - 运行 `pnpm verify` 确保综合门禁通过。

- [ ] **6. 提交与收尾**
  - 记录更改，提交 git commit。
  - 更新 Trellis journal 与状态。
