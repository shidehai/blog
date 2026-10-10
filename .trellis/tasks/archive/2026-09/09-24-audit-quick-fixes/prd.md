# 审计快修包：构建崩溃、截断风险与文档漂移

## Goal

修复 2026-09-24 三方审计（完整存档见 `research/audit-2026-09-24.md`）中确认的低风险高价值问题，共 6 项。

## Requirements

- **F1 首页零文章崩溃**：`app/page.tsx` 在快照无任何已发布文章时必须正常渲染空态而不是构建期 TypeError。移除 `allPosts[0]!` 非空断言骗局，`featured` 为空时 featured 区与文章列表都安全降级。
- **F2 schema:dump 防截断**：根 `package.json` 的 `directus:schema:dump` 先把 pg_dump 输出写到临时文件，成功后再替换 `directus/database.sql`；任何一步失败不得留下半截 database.sql。
- **F3 保留原始错误**：`frontend-v2/lib/directus.ts` 快照加载失败时抛出的 Error 必须带 `{ cause }`，保留底层网络/解码错误用于排查；错误消息仍不得回显凭据。
- **F4 报告问题链接**：`archives/[slug]/ArticleClient.tsx` 的"报告问题"链接从 `github.com/wildalley` 改为站点所有者仓库 `github.com/shidehai/blog`（与 git remote 一致）。
- **F5 文档漂移**：`docs/operations/deployment.md` 修正两处——(a) push main 不再触发发布（仅手动 dispatch / Directus 事件）；(b) Flow 监听集合清单补全 `categories, tags, series, posts_tags`（以 `directus/bootstrap.mjs:613-624` 为准）。
- **F6 CI 并发组拆分**：`publish.yml` 的 concurrency 按事件拆分——push/PR 一组，手动 dispatch 与 directus-publish 发布各自独占 production 组，push 不得取消进行中的发布。

## Acceptance Criteria

- [x] F1：空快照经 tsx 直调 `buildSnapshot` + 页面选择器逻辑验证（featured=undefined、recentPosts=[]，无崩溃）；fixture SSG 20/20 绿
- [x] F2：`> database.sql.tmp && mv -f` 模式落地；`&&` 短路与 host 重定向语义保证失败时原文件不动（临时文件残留无害）；package.json JSON 校验通过
- [x] F3：Error 携带 `{ cause }`；typecheck + strict tsc（noUnusedLocals/Parameters）通过
- [x] F4：全库 grep 无 `wildalley` 残留
- [x] F5：deployment.md 与 publish.yml（dispatch-only 门禁 + 拆分组）和 bootstrap.mjs:613-624（10 个集合）一致
- [x] F6：publish.yml YAML 校验通过；push→`main-quality`（可取消）、发布事件→`production-publish`（不可取消）
- [x] typecheck / strict tsc / 根+前端 lint / selfcheck / format:check / SSG 全绿（standalone trace-copy EPERM 为已知环境问题）

## Out of Scope

- 审计报告中的其余 🔴/🟡 项（XSS 方案、seed 防覆盖、sftp 示例、体验类等）不在本任务，按存档备查。
