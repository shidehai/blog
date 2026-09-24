# 全系统检查与优化：全面切换 V2 并清理 V1 Astro 遗产

## Goal

全面收敛并切换至 V2 Next.js 前端，彻底清理已废弃的 V1 Astro 前端代码、依赖、脚本及配置文件，消除双包冗余与技术债，确保构建、类型检查与容器镜像交付体系稳定可靠。

## Requirements

1. **废弃代码与配置清理**：彻底移除 V1 Astro 前端源码（`src/`）、Astro 专用测试（`tests/`）、Astro 配置文件（`astro.config.ts`, `tsconfig.json` 等）及备份残留文件。
2. **依赖与脚本精简**：清理根 `package.json` 中的废弃依赖（Astro、Vitest、Playwright、Pagefind、Lighthouse 等未使用的包），收敛 scripts（`dev`, `build`, `typecheck`, `verify` 直接路由至 `frontend-v2`）。
3. **静态资源与构建链路修复**：清理/迁移失效的 `generate-assets.ts` 及其调用，确保 `frontend-v2` 所需的静态资源（如头像、favicon、manifest 等）合理托管于 `frontend-v2/public/`。
4. **容器镜像交付更新**：更新根目录 `Dockerfile`，构建并交付 Next.js standalone 生产镜像。
5. **后端与 CMS 兼容性**：保留 Directus 相关脚本（`deploy/`, `directus/`），确保 CMS 架构与模式管理功能不受影响。

## Acceptance Criteria

- [ ] V1 Astro 前端源码、测试、构建配置已彻底移除，git 状态干净有序
- [ ] 根 `package.json` 依赖和 scripts 完成精简，无废弃/失效的命令与依赖
- [ ] `pnpm verify`（包含 `typecheck` 与 `build`）一次性通过无报错
- [ ] `Dockerfile` 适配 Next.js 15+ standalone 生产运行规范
- [ ] 核心页面静态生成正常，路由完整无回退
