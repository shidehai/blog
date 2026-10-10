# 提交计划（用户已一次确认）

本计划包含此前已审查的未提交清理修复，以及用户批准的 R13/R14/R15。
图片修复代码与真实镜像已验收；任务仍为 in_progress，不推送、不部署、不归档。
AC8 授权权限验收暂缓；额外发现的原有 Google 字体完全离线编译依赖已记录，
没有在图片修复中改变字体或 UI。

## 1. fix: preserve CMS fixture ownership and launch targets

恢复原字节媒体夹具，统一实际上传 UUID，保护 canonical/legacy 所有权与重放，
绑定 launch 实际目标并拒绝携带凭据的 URL，提交离线回归、verify 接线与相关规范。
根 Zod 4 删除属于前次已经审查的残留清理。

- directus/launch.mjs
- directus/seed/content.mjs
- directus/seed/editorial.mjs
- directus/seed/fixtures.mjs
- directus/seed/index.mjs
- directus/seed/assets/ai-reliability-boundaries-960.webp
- tests/launch-apply.mjs
- tests/seed-fixture.mjs
- tests/seed-install.mjs
- package.json
- pnpm-lock.yaml
- docs/operations/launch-runbook.md
- .trellis/spec/backend/database-guidelines.md
- .trellis/spec/backend/error-handling.md

## 2. fix: deliver validated CMS images in static builds

构建时校验并导出引用的公开原图，封面/头像/正文使用同站点内容寻址路径；
共享 Markdown 图片/代码边界扫描，补渲染、下载限制、并发/清理/私有拒绝回归，
将 .mts 构建入口接入常规类型/lint 检查，同步 Git/Docker 排除与交付说明。
包括此前已审查的真实前端 lint、运输错误凭据回归和开发依赖卷修复。
任务记录和验收说明按最终范围一并提交。

- .dockerignore
- .gitignore
- .trellis/spec/backend/quality-guidelines.md
- .trellis/spec/frontend/directory-structure.md
- .trellis/spec/frontend/quality-guidelines.md
- .trellis/spec/frontend/type-safety.md
- .trellis/tasks/09-20-remove-unused-code/check.jsonl
- .trellis/tasks/09-20-remove-unused-code/commit-plan.md
- .trellis/tasks/09-20-remove-unused-code/design.md
- .trellis/tasks/09-20-remove-unused-code/implement.jsonl
- .trellis/tasks/09-20-remove-unused-code/implement.md
- .trellis/tasks/09-20-remove-unused-code/prd.md
- .trellis/tasks/09-20-remove-unused-code/research/launch-cover-uuid.md
- .trellis/tasks/09-20-remove-unused-code/research/local-directus-testing.md
- .trellis/tasks/09-20-remove-unused-code/research/public-media-build-delivery.md
- .trellis/tasks/09-20-remove-unused-code/research/seed-idempotency.md
- .trellis/tasks/09-20-remove-unused-code/task.json
- .trellis/tasks/09-20-remove-unused-code/validation.md
- deploy/compose.dev.yaml
- docs/operations/deployment.md
- frontend-v2/README.md
- frontend-v2/components/MarkdownContent.tsx
- frontend-v2/lib/build.mts
- frontend-v2/lib/directus.ts
- frontend-v2/lib/env.ts
- frontend-v2/lib/fixture.selfcheck.mts
- frontend-v2/lib/markdown-images.check.mts
- frontend-v2/lib/markdown-images.ts
- frontend-v2/lib/media-files.ts
- frontend-v2/lib/media-lifecycle.check.mts
- frontend-v2/lib/media.check.mts
- frontend-v2/lib/media.ts
- frontend-v2/package.json
- frontend-v2/tsconfig.json
- tests/ops/static-contract.test.sh

## 不进入以上提交的工作区记录

以下是前次会话及本轮追加的开发日志，保留在工作区，待任务完成后的 journal
流程单独处理；不随这两个代码检查点提交。

- .trellis/workspace/shidehai/index.md
- .trellis/workspace/shidehai/journal-1.md

其余未识别脏文件：无。原任务要求保护的 globals.css、fixture.ts、mock.ts、
avatar.svg 没有本轮新增 diff。

`.data/cleanup-test/`、凭据、私有日志、数据库/上传卷、生成媒体、锁和本地镜像
均不进入 Git。用户已确认本计划；只按上面明确文件路径暂存，依次创建两个提交；不 amend。
