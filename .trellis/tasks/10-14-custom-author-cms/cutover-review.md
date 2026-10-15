# 历史差异与本地切换记录 — 2026-10-15

状态：本地日常博客已切换到新 CMS；后续旧 Directus 清理已完成，旧服务、专属资源和原数据目录均已备份退役。用户明确说明尚未远程部署，本次“切换”仅指本地项目。
所有工作仅主会话串行；没有提交、推送或远程部署。

## 已对账的内容

固定源快照 SHA256：63e38cb0ed6ebacc5522e95250715d12bb73fe834e94be6755e085e10468b813。
该快照属于本地隔离演练，不能替代正式环境冻结后的最终快照。

- 原有 16 posts、6 topics、28 posts_topics、9 个公开地址、当前草稿/发布
  字段和媒体引用均保持一致。历史缺字段不影响这些当前内容的迁移结果。
- 5 个已删除专题有稳定 ID、完整 name/slug 和明确删除活动，已补回归档。
  description 在创建时未填写的按源 schema 的 null 默认处理。保留源修订
  时间；不自动发布、不占用地址。没有补造专题成员关系。
- 当前隔离目标共 27 contents、33 revisions、35 mappings、1 raw archive。
- 完整内容包包含 3 个实际文件：WebP、SVG 的 PNG 显示副本及 SVG 原件。
  原件必须按校验和保留；不同环境生成的 PNG 可不同，恢复必须保留该环境
  导出包中的实际 PNG 字节。
- 所有 75 条 revisions 及 20 条没有 revision 的活动均有逐条处置记录。
  6 条原有专题历史 + 5 条补回的专题历史已转换；64 条修订仍仅原档案保存。

## 剩余差异与建议

| 记录 | 数量 | 缺口 / 实际影响 | 建议处置 |
| --- | ---: | --- | --- |
| 当前 posts 的旧修订 | 16 | 无完整 tags/topics 快照，不能完整恢复当时关系；当前文章与关系已迁移 | 保留原始修订，暂不提供这些旧版本的一键恢复 |
| 已删除 posts 的旧修订 | 5 | 正文字段可查，历史关系不完整；不能补造为完整可恢复草稿 | 保留原始修订，保持已删除状态 |
| posts_topics 历史 | 34 | data/delta 只有 id，缺 posts_id/topics_id；其中一个 ID 曾删除后重建，不能用当前行倒推旧端点 | 保留原始关联历史；当前 28 条关系正常迁移 |
| site_settings 历史 | 9 | 源字段存在，新后台没有站点资料历史恢复入口；当前资料已迁移 | 保留原始历史，可离线人工查阅；不宣称可一键恢复 |
| social_links 删除活动 | 4 | 涉及 2 个已删除链接，只有活动元数据，无原字段快照 | 记录无法恢复的字段，不从 fixture 或当前默认值补造 |

因此 limitations=68（64 条修订 + 4 条活动），readyForCutover=false。
原 69 条差异补回 5 条，新增发现 4 条活动差异，数量并非直接降到 64。
完整原始快照随 source_archives 导出恢复；“保存原档案”和“后台可编辑恢复”
是两种不同的能力。逐条 ID、缺字段、时间和目标见 research/history-reconciliation.json。

## 作者已接受的取舍

- [x] 接受上述 21 条 posts 历史仅保存原始档案，不能在新后台完整一键恢复。
- [x] 接受 34 条旧关联历史和 9 条站点资料历史保存在原始档案中。
- [x] 接受 2 个已删除社交链接缺少原字段，仅保留 4 条删除活动证据。

2026-10-15 用户“可以，现在开始缺换吧”批准切换，随后澄清“尚未部署，我以为你说的切换是在本地切换”。授权范围为本机日常写入来源切换。

最终本地冻结源 SHA256：ae41cd55b4cf590341a45cb53564e3c688bed1733a84b07dc9bd53f22763d46c。
忽略导出时间及行顺序后，全部源表与此前审阅的快照相同；最终报告的 sourceCounts、targetCounts、addresses、mediaChecksums 和全部 68 条 limitations 均与审阅结果一致。保留 limitations=68、readyForCutover=false，另记录作者接受原始档案处置，不把差异改为零。

## 本地切换完成记录

- [x] 确认本地范围和切换授权，使用独立的 `blog-local` 持久环境。
- [x] 停止 `blog-cleanup-test-directus-1`，保留旧 PostgreSQL/卷；同一窗口取得 custom DB dump、源 JSON 和全部 uploads。
- [x] 用最终快照导入空的 `blog_author.author_cms`；专用 blog_cms 角色无 superuser/createdb/createrole/replication，schema 由其拥有。
- [x] 完整内容包在另一个空数据库 `blog_author_cutover_restore_1015_test` 恢复并重导出；所有数据、原始历史、媒体清单及三个实际文件字节一致。
- [x] 使用已验证的固定本地镜像 ID启动 site/CMS，唯一所有者使用新随机密码，秘密仅在被忽略的 0600 配置文件中。
- [x] 本地 9 个原文章详情、9 个 writing 永久跳转、公开图片校验和、私有图片 404 和认证边界通过。
- [x] 验证此前 404 的新地址发布立即 200，草稿修改保持隔离，再发布立即更新、归档后 404；期间镜像、PID、启动时间不变，无构建/部署/重启。
- [x] 验收文章仅留在归档，原公开 catalog 完全不变；切换后再备份完整内容包和新数据库。

博客 `http://localhost:4321`，后台 `http://localhost:4322`。日常使用 `pnpm local:up`；数据位于 `.data/local-cms/`，不再使用预览 `_test` 库。旧预览进程已正常退出，预览库及证据保留。

备份目录：`.data/backups/local-cutover-20261015-095257/`，含旧/新数据库 dump、最终源快照、uploads、原始导出包、独立恢复/重导出和切换后内容包。迁入数据为 27 contents / 33 revisions / 9 aliases；发布验收后为 28 contents / 37 revisions / 10 aliases，多出一篇已归档验收文章及其历史。原 9 篇公开文章不变。

本地切换证据见 `research/local-cutover-evidence.json`。尚未远程部署；未来部署需按相同冻结/备份/对账流程另行执行。切换后已有新 CMS 写入，回退前必须导出新内容与媒体，不能直接恢复旧库。

2026-10-15 后续清理已另存当前内容及两套旧源库逻辑/物理备份，随后移除旧容器、卷、网络、镜像和数据目录。当前 CMS 与历史内容未变，原 68 项差异报告保持原样。最近恢复备份位于 `.data/backups/legacy-cleanup-20261015-103907/`；当前镜像及核验证据以 `legacy-cleanup.md` 和 `research/legacy-cleanup-evidence.json` 为准，上方旧资源保留描述是切换当时的状态。

部署、冻结、备份及回退步骤见 docs/operations/cms-migration.md 和
docs/operations/deployment.md；本次检查证据见 acceptance.md 与 research/。
